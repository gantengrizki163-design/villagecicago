import rawLayoutJson from './cicalengka.layout.json';
import {
  ensureSafeSpawnPosition as ensureSafeSpawnPositionRule,
  generateDeterministicPlants,
  generateDeterministicProps,
  getRailBoxes,
  getRoadBoxes,
  type SafeSpawnOptions,
  type SafeSpawnResult,
} from './rules';
import type {
  CicalengkaLayout,
  GeneratedPlant,
  GeneratedPropsBundle,
  LotDef,
} from './types';

export const LAYOUT_DATA: CicalengkaLayout = rawLayoutJson as unknown as CicalengkaLayout;

const LOT_MAP = new Map<string, LotDef>(LAYOUT_DATA.lots.map((l) => [l.id, l]));

let cachedPlants: { trees: GeneratedPlant[]; palms: GeneratedPlant[] } | null = null;
let cachedProps: GeneratedPropsBundle | null = null;

export interface LotPlacement {
  id: string;
  x: number;
  z: number;
  rotDeg: 0 | 90 | 180 | 270;
  rotY: number;
  footprint: { width: number; depth: number };
  colliderArgs: [number, number, number];
  colliderOffset: [number, number, number];
  door: { x: number; z: number };
  facing: LotDef['facing'];
  lot: LotDef;
}

export interface UnifiedColliderProps {
  args: [number, number, number];
  position: [number, number, number];
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function getLotById(id: string): LotDef {
  const found = LOT_MAP.get(id);
  if (!found) {
    throw new Error(`[layoutHelpers] Lot "${id}" tidak ditemukan di cicalengka.layout.json.`);
  }
  return found;
}

export function findLotPlacement(id: string): LotPlacement | null {
  return LOT_MAP.has(id) ? getLotPlacement(id) : null;
}

export function getLotPlacement(id: string): LotPlacement {
  const lot = getLotById(id);
  const colW = lot.collider?.width ?? lot.footprint.width;
  const colD = lot.collider?.depth ?? lot.footprint.depth;
  const colH = lot.collider?.height ?? 3.6;
  const offX = lot.collider?.offsetX ?? lot.footprintOffset?.x ?? 0;
  const offZ = lot.collider?.offsetZ ?? lot.footprintOffset?.z ?? 0;

  return {
    id: lot.id,
    x: lot.position.x,
    z: lot.position.z,
    rotDeg: lot.rotDeg,
    rotY: degToRad(lot.rotDeg),
    footprint: lot.footprint,
    colliderArgs: [colW / 2, colH / 2, colD / 2],
    colliderOffset: [offX, colH / 2, offZ],
    door: lot.door,
    facing: lot.facing,
    lot,
  };
}

/**
 * Satu fungsi pembentuk parameter CuboidCollider Rapier langsung dari footprint / collider JSON.
 */
export function getFootprintColliderProps(
  width: number,
  height: number,
  depth: number,
  offsetX = 0,
  offsetZ = 0
): UnifiedColliderProps {
  return {
    args: [width / 2, height / 2, depth / 2],
    position: [offsetX, height / 2, offsetZ],
  };
}

/**
 * Mengambil parameter CuboidCollider Rapier terpadu dari ID lot pada cicalengka.layout.json.
 */
export function getUnifiedColliderProps(
  lotId: string,
  override?: { width?: number; height?: number; depth?: number; offsetX?: number; offsetZ?: number }
): UnifiedColliderProps {
  const lot = getLotById(lotId);
  const w = override?.width ?? lot.collider?.width ?? lot.footprint.width;
  const d = override?.depth ?? lot.collider?.depth ?? lot.footprint.depth;
  const h = override?.height ?? lot.collider?.height ?? 3.6;
  const ox = override?.offsetX ?? lot.collider?.offsetX ?? lot.footprintOffset?.x ?? 0;
  const oz = override?.offsetZ ?? lot.collider?.offsetZ ?? lot.footprintOffset?.z ?? 0;
  return getFootprintColliderProps(w, h, d, ox, oz);
}

/**
 * Wrapper safe-position untuk client login / spawn: memindahkan posisi lama yang tertimpa
 * bangunan/objek solid ke titik aman terdekat berdasarkan layout aktif.
 */
export function ensureSafeSpawnPosition(
  pos: { x: number; y?: number; z: number; rotY?: number } | null | undefined,
  opts: SafeSpawnOptions = {}
): SafeSpawnResult {
  return ensureSafeSpawnPositionRule(pos, opts.layout ?? LAYOUT_DATA, opts);
}

export function getLayoutPlants(): { trees: GeneratedPlant[]; palms: GeneratedPlant[] } {
  if (!cachedPlants) {
    cachedPlants = generateDeterministicPlants(LAYOUT_DATA);
  }
  return cachedPlants;
}

export function getLayoutProps(): GeneratedPropsBundle {
  if (!cachedProps) {
    cachedProps = generateDeterministicProps(LAYOUT_DATA);
  }
  return cachedProps;
}

export function getLayoutRoads() {
  return getRoadBoxes(LAYOUT_DATA.roads);
}

export function getLayoutRails() {
  return getRailBoxes(
    LAYOUT_DATA.rails,
    LAYOUT_DATA.rules.railSafeMeters,
    LAYOUT_DATA.lots
  );
}
