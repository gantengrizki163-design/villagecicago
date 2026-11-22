import { getDeterministicTrainState } from './phase2ConfigCache';
import { getDefaultVehicleConfig, getTrafficConfig } from './vehicleConfigCache';
import { getDeterministicTrafficLightPhase } from '../world3d/assets/TrafficInfrastructure3D';
import { LAYOUT_DATA } from '../world3d/layout/layoutHelpers';
import { DEFAULT_GAME_CONFIG, distance2D } from '../world3d/worldConstants';
import type {
  TrafficConfigDoc,
  TrainScheduleConfig,
  VehicleModelConfig,
  ZoneId,
} from '../types/game';

export type TrafficPoolKind = 'all' | 'transit' | 'gang' | 'patrol';

export interface TrafficRouteWaypoint {
  x: number;
  z: number;
  width: number;
  hierarchy: 'arteri' | 'kolektor' | 'lingkungan' | 'gang';
}

export interface TrafficRouteDefinition {
  id: string;
  label: string;
  slotCount: number;
  poolKind: TrafficPoolKind;
  waypoints: TrafficRouteWaypoint[];
}

export interface PrecomputedRoutePoint {
  x: number;
  z: number;
  ux: number;
  uz: number;
  rotY: number;
  distFromStart: number;
  hierarchy: 'arteri' | 'kolektor' | 'lingkungan' | 'gang';
  /** Sudut belok lokal (radian) untuk animasi setir depan */
  turnCurvature: number;
}

export interface RouteStopTrigger {
  kind: 'traffic_light_ew' | 'traffic_light_ns' | 'rail_gate' | 'halte';
  sTrigger: number;
  tlIndex?: number;
  halteId?: string;
}

export interface DeterministicTrafficVehiclePose {
  slotKey: string;
  routeId: string;
  slotIndex: number;
  modelId: string;
  color: string;
  plateNumber: string;
  x: number;
  z: number;
  rotY: number;
  speedMps: number;
  steerAngle: number;
  isStopped: boolean;
  stopReason: 'red_light' | 'rail_gate' | 'halte' | null;
  sirenActive: boolean;
  distanceToPlayer: number;
  lod: 'full' | 'simple';
}

interface CompiledTrafficRoute {
  def: TrafficRouteDefinition;
  samples: PrecomputedRoutePoint[];
  totalLength: number;
  triggers: RouteStopTrigger[];
}

interface SlotScheduleTable {
  slotKey: string;
  routeId: string;
  slotIndex: number;
  periodSec: number;
  dtSec: number;
  sArray: Float64Array;
  vArray: Float32Array;
  stopReasonArray: Uint8Array; // 0 = none, 1 = red_light, 2 = rail_gate, 3 = halte
}

const STOP_NONE = 0;
const STOP_RED_LIGHT = 1;
const STOP_RAIL_GATE = 2;
const STOP_HALTE = 3;

const TRAFFIC_CYCLE_PERIOD_SEC = 420; // LCM(28s lampu lalu lintas, 60s kereta) = 420 detik
const TABLE_DT_SEC = 0.25;

function getRoadWidth(roadId: string, fallback = 7): number {
  const road = LAYOUT_DATA.roads.find((r) => r.id === roadId);
  return road?.width ?? fallback;
}

function getRoadHierarchy(
  roadId: string,
  fallback: 'arteri' | 'kolektor' | 'lingkungan' | 'gang' = 'kolektor'
): 'arteri' | 'kolektor' | 'lingkungan' | 'gang' {
  const road = LAYOUT_DATA.roads.find((r) => r.id === roadId);
  return (road?.hierarchy as 'arteri' | 'kolektor' | 'lingkungan' | 'gang') ?? fallback;
}

const W_RAYA = getRoadWidth('jalan_raya', 10);
const W_STASIUN = getRoadWidth('jalan_stasiun', 7);
const W_ALUN_SEL = getRoadWidth('jalan_alun_selatan', 5);
const W_KAMPUNG_SEL = getRoadWidth('jalan_kampung_selatan', 5);
const W_GANG = getRoadWidth('gang_hunian_selatan', 3);
const W_BARAT = getRoadWidth('jalan_barat', 7);
const W_ALUN_BARAT = getRoadWidth('jalan_alun_barat', 7);
const W_ALUN_TIMUR = getRoadWidth('jalan_alun_timur', 7);
const W_TIMUR = getRoadWidth('jalan_perumahan_timur', 7);

/**
 * 9 Rute Lingkar Tertutup deterministik di jaringan jalan `cicalengka.layout.json`:
 * - Total 24 slot kendaraan (= maxActiveNpcVehiclesDesktop)
 * - Mendukung lalu lintas dua arah di lajur kiri Indonesia
 * - Melayani seluruh 4 halte angkot, 2 lampu lalu lintas simpang alun-alun, dan perlintasan rel KA x=60
 */
export const CICALENGKA_TRAFFIC_ROUTES: TrafficRouteDefinition[] = [
  {
    id: 'arteri_selatan_cw',
    label: 'Lingkar Arteri Selatan',
    slotCount: 3,
    poolKind: 'all',
    waypoints: [
      { x: -60, z: -10, width: W_RAYA, hierarchy: getRoadHierarchy('jalan_raya', 'arteri') },
      { x: 60, z: -10, width: W_TIMUR, hierarchy: getRoadHierarchy('jalan_perumahan_timur', 'kolektor') },
      { x: 60, z: 18, width: W_ALUN_SEL, hierarchy: getRoadHierarchy('jalan_alun_selatan', 'lingkungan') },
      { x: -60, z: 18, width: W_BARAT, hierarchy: getRoadHierarchy('jalan_barat', 'kolektor') },
    ],
  },
  {
    id: 'arteri_utara_ccw',
    label: 'Lingkar Stasiun - Raya',
    slotCount: 3,
    poolKind: 'all',
    waypoints: [
      { x: 60, z: -10, width: W_RAYA, hierarchy: getRoadHierarchy('jalan_raya', 'arteri') },
      { x: -60, z: -10, width: W_BARAT, hierarchy: getRoadHierarchy('jalan_barat', 'kolektor') },
      { x: -60, z: -40, width: W_STASIUN, hierarchy: getRoadHierarchy('jalan_stasiun', 'kolektor') },
      { x: 60, z: -40, width: W_TIMUR, hierarchy: getRoadHierarchy('jalan_perumahan_timur', 'kolektor') },
    ],
  },
  {
    id: 'angkot_lintas_stasiun',
    label: 'Trayek Angkot Stasiun - Alun',
    slotCount: 2,
    poolKind: 'transit',
    waypoints: [
      { x: -18, z: -40, width: W_STASIUN, hierarchy: 'kolektor' },
      { x: 60, z: -40, width: W_TIMUR, hierarchy: 'kolektor' },
      { x: 60, z: -10, width: W_RAYA, hierarchy: 'arteri' },
      { x: -18, z: -10, width: W_ALUN_BARAT, hierarchy: 'kolektor' },
    ],
  },
  {
    id: 'angkot_timur_perumahan',
    label: 'Trayek Angkot Pasar - Perumahan',
    slotCount: 2,
    poolKind: 'transit',
    waypoints: [
      { x: 18, z: -10, width: W_RAYA, hierarchy: 'arteri' },
      { x: 60, z: -10, width: W_TIMUR, hierarchy: 'kolektor' },
      { x: 60, z: 48, width: W_KAMPUNG_SEL, hierarchy: 'lingkungan' },
      { x: 18, z: 48, width: W_ALUN_TIMUR, hierarchy: 'kolektor' },
    ],
  },
  {
    id: 'koridor_rel_utara',
    label: 'Koridor Perlintasan Kereta Timur',
    slotCount: 3,
    poolKind: 'all',
    waypoints: [
      { x: 18, z: -40, width: W_STASIUN, hierarchy: 'kolektor' },
      { x: 60, z: -40, width: W_TIMUR, hierarchy: 'kolektor' },
      { x: 60, z: -73, width: W_TIMUR, hierarchy: 'kolektor' },
      { x: 60, z: 18, width: W_ALUN_SEL, hierarchy: 'lingkungan' },
      { x: 18, z: 18, width: W_ALUN_TIMUR, hierarchy: 'kolektor' },
    ],
  },
  {
    id: 'patroli_alun_barat',
    label: 'Patroli Alun - Klinik Barat',
    slotCount: 2,
    poolKind: 'patrol',
    waypoints: [
      { x: -60, z: -10, width: W_RAYA, hierarchy: 'arteri' },
      { x: -18, z: -10, width: W_ALUN_BARAT, hierarchy: 'kolektor' },
      { x: -18, z: 48, width: W_KAMPUNG_SEL, hierarchy: 'lingkungan' },
      { x: -60, z: 48, width: W_BARAT, hierarchy: 'kolektor' },
    ],
  },
  {
    id: 'lingkar_kampung_selatan',
    label: 'Lingkar Kampung Selatan',
    slotCount: 3,
    poolKind: 'all',
    waypoints: [
      { x: -60, z: 18, width: W_ALUN_SEL, hierarchy: 'lingkungan' },
      { x: 60, z: 18, width: W_TIMUR, hierarchy: 'kolektor' },
      { x: 60, z: 48, width: W_KAMPUNG_SEL, hierarchy: 'lingkungan' },
      { x: -60, z: 48, width: W_BARAT, hierarchy: 'kolektor' },
    ],
  },
  {
    id: 'gang_hunian_motor',
    label: 'Gang Hunian Dalam (Motor/Becak)',
    slotCount: 2,
    poolKind: 'gang',
    waypoints: [
      { x: -18, z: 18, width: W_ALUN_SEL, hierarchy: 'lingkungan' },
      { x: 18, z: 18, width: W_ALUN_TIMUR, hierarchy: 'kolektor' },
      { x: 18, z: 66, width: W_GANG, hierarchy: 'gang' },
      { x: -18, z: 66, width: W_ALUN_BARAT, hierarchy: 'kolektor' },
    ],
  },
  {
    id: 'poros_alun_utama',
    label: 'Poros Tengah Cicalengka',
    slotCount: 4,
    poolKind: 'all',
    waypoints: [
      { x: -60, z: -40, width: W_STASIUN, hierarchy: 'kolektor' },
      { x: 18, z: -40, width: W_ALUN_TIMUR, hierarchy: 'kolektor' },
      { x: 18, z: 48, width: W_KAMPUNG_SEL, hierarchy: 'lingkungan' },
      { x: -60, z: 48, width: W_BARAT, hierarchy: 'kolektor' },
    ],
  },
];

export function hashTrafficSeed(key: string, daySeed: number): number {
  const input = `${key}:${daySeed}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getTrafficDensityForHour(
  hour: number,
  densityByHour: TrafficConfigDoc['densityByHour']
): number {
  const h = ((hour % 24) + 24) % 24;
  const matched = densityByHour.find((slot) => h >= slot.startHour && h < slot.endHour);
  return matched ? Math.max(0.1, Math.min(1, matched.density)) : 0.65;
}

function getSegmentRoadInfo(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  fallbackHierarchy: 'arteri' | 'kolektor' | 'lingkungan' | 'gang'
): { width: number; hierarchy: 'arteri' | 'kolektor' | 'lingkungan' | 'gang' } {
  const isEW = Math.abs(az - bz) <= 0.5;
  const midZ = (az + bz) * 0.5;
  const midX = (ax + bx) * 0.5;

  if (isEW) {
    if (Math.abs(midZ - -10) < 2) return { width: W_RAYA, hierarchy: 'arteri' };
    if (Math.abs(midZ - -40) < 2) return { width: W_STASIUN, hierarchy: 'kolektor' };
    if (Math.abs(midZ - 18) < 2) return { width: W_ALUN_SEL, hierarchy: 'lingkungan' };
    if (Math.abs(midZ - 48) < 2) return { width: W_KAMPUNG_SEL, hierarchy: 'lingkungan' };
    if (Math.abs(midZ - 66) < 2) return { width: W_GANG, hierarchy: 'gang' };
  } else {
    if (Math.abs(midX - -60) < 2) return { width: W_BARAT, hierarchy: 'kolektor' };
    if (Math.abs(midX - -18) < 2) return { width: W_ALUN_BARAT, hierarchy: 'kolektor' };
    if (Math.abs(midX - 18) < 2) return { width: W_ALUN_TIMUR, hierarchy: 'kolektor' };
    if (Math.abs(midX - 60) < 2) return { width: W_TIMUR, hierarchy: 'kolektor' };
  }
  return { width: 7, hierarchy: fallbackHierarchy };
}

/**
 * Mengonversi rute garis tengah menjadi jalur lajur kiri Indonesia (offset = width * laneOffsetRatio)
 * dengan tikungan mulus (fillet) di setiap persimpangan.
 */
function compileTrafficRoute(
  def: TrafficRouteDefinition,
  trafficCfg: TrafficConfigDoc
): CompiledTrafficRoute {
  const n = def.waypoints.length;
  const laneRatio = trafficCfg.laneOffsetRatio ?? 0.25;

  interface OffsetSeg {
    ax: number;
    az: number;
    bx: number;
    bz: number;
    ux: number;
    uz: number;
    hierarchy: 'arteri' | 'kolektor' | 'lingkungan' | 'gang';
  }

  const segs: OffsetSeg[] = [];
  for (let i = 0; i < n; i++) {
    const a = def.waypoints[i];
    const b = def.waypoints[(i + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const ux = dx / len;
    const uz = dz / len;
    const roadInfo = getSegmentRoadInfo(a.x, a.z, b.x, b.z, a.hierarchy);
    // Lajur kiri Indonesia pada sistem koordinat (+X timur, +Z selatan): normal kiri = (uz, -ux)
    const offsetMag = Math.min(roadInfo.width * laneRatio, roadInfo.hierarchy === 'gang' ? 0.65 : 2.5);
    const lx = uz * offsetMag;
    const lz = -ux * offsetMag;
    segs.push({
      ax: a.x + lx,
      az: a.z + lz,
      bx: b.x + lx,
      bz: b.z + lz,
      ux,
      uz,
      hierarchy: roadInfo.hierarchy,
    });
  }

  // Bangun polyline tertutup dengan sudut melengkung mulus (fillet 2.2m)
  const poly: Array<{ x: number; z: number; hierarchy: 'arteri' | 'kolektor' | 'lingkungan' | 'gang'; curvature: number }> = [];
  for (let i = 0; i < segs.length; i++) {
    const cur = segs[i];
    const next = segs[(i + 1) % segs.length];
    const segLen = Math.hypot(cur.bx - cur.ax, cur.bz - cur.az);
    const nextLen = Math.hypot(next.bx - next.ax, next.bz - next.az);
    const trimEnd = Math.min(2.4, segLen * 0.28);
    const trimStart = Math.min(2.4, nextLen * 0.28);

    const pStart = {
      x: cur.ax + cur.ux * Math.min(2.4, segLen * 0.28),
      z: cur.az + cur.uz * Math.min(2.4, segLen * 0.28),
    };
    const pBeforeCorner = {
      x: cur.bx - cur.ux * trimEnd,
      z: cur.bz - cur.uz * trimEnd,
    };
    const pAfterCorner = {
      x: next.ax + next.ux * trimStart,
      z: next.az + next.uz * trimStart,
    };

    // Hitung tanda belok (cross product 2D)
    const cross = cur.ux * next.uz - cur.uz * next.ux;
    const turnSign = cross > 0.05 ? -0.32 : cross < -0.05 ? 0.32 : 0;

    if (poly.length === 0) {
      poly.push({ x: pStart.x, z: pStart.z, hierarchy: cur.hierarchy, curvature: 0 });
    }
    poly.push({ x: pBeforeCorner.x, z: pBeforeCorner.z, hierarchy: cur.hierarchy, curvature: turnSign * 0.5 });

    // Titik tengah lengkungan tikungan
    const cornerMidX = (cur.bx + next.ax) * 0.5;
    const cornerMidZ = (cur.bz + next.az) * 0.5;
    const q1x = 0.25 * pBeforeCorner.x + 0.5 * cornerMidX + 0.25 * pAfterCorner.x;
    const q1z = 0.25 * pBeforeCorner.z + 0.5 * cornerMidZ + 0.25 * pAfterCorner.z;
    poly.push({ x: q1x, z: q1z, hierarchy: cur.hierarchy, curvature: turnSign });
    poly.push({ x: pAfterCorner.x, z: pAfterCorner.z, hierarchy: next.hierarchy, curvature: turnSign * 0.4 });
  }

  // Sampling seragam per ~1.5 meter agar pencarian trigger dan posisi O(1) cepat & mulus
  const dense: PrecomputedRoutePoint[] = [];
  let accumDist = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 0.05) continue;
    const ux = dx / segLen;
    const uz = dz / segLen;
    const rotY = Math.atan2(ux, uz);
    const steps = Math.max(1, Math.round(segLen / 1.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      dense.push({
        x: a.x + dx * t,
        z: a.z + dz * t,
        ux,
        uz,
        rotY,
        distFromStart: accumDist + segLen * t,
        hierarchy: a.hierarchy,
        turnCurvature: a.curvature * (1 - t) + b.curvature * t,
      });
    }
    accumDist += segLen;
  }

  const totalLength = Math.max(10, accumDist);

  // Deteksi otomatis trigger Lampu Lalu Lintas, Palang KA, dan Halte Angkot sepanjang rute
  const triggers: RouteStopTrigger[] = [];

  // 1. Lampu Lalu Lintas
  trafficCfg.trafficLights.forEach((tl, tlIndex) => {
    let bestEwSampleIdx = -1;
    let bestEwDist = 999;
    let bestNsSampleIdx = -1;
    let bestNsDist = 999;

    for (let i = 0; i < dense.length; i++) {
      const p = dense[i];
      if (Math.abs(p.ux) > 0.85 && Math.abs(p.z - tl.z) < 5.5) {
        // Berhenti di garis stop 6.8m SEBELUM pusat simpang tl.x
        const stopX = tl.x - Math.sign(p.ux) * 6.8;
        const d = Math.abs(p.x - stopX);
        if (d < 2.2 && d < bestEwDist) {
          bestEwDist = d;
          bestEwSampleIdx = i;
        }
      }
      if (Math.abs(p.uz) > 0.85 && Math.abs(p.x - tl.x) < 4.5) {
        // Berhenti di garis stop 7.5m SEBELUM pusat simpang tl.z
        const stopZ = tl.z - Math.sign(p.uz) * 7.5;
        const d = Math.abs(p.z - stopZ);
        if (d < 2.2 && d < bestNsDist) {
          bestNsDist = d;
          bestNsSampleIdx = i;
        }
      }
    }

    if (bestEwSampleIdx >= 0) {
      triggers.push({
        kind: 'traffic_light_ew',
        sTrigger: dense[bestEwSampleIdx].distFromStart,
        tlIndex,
      });
    }
    if (bestNsSampleIdx >= 0) {
      triggers.push({
        kind: 'traffic_light_ns',
        sTrigger: dense[bestNsSampleIdx].distFromStart,
        tlIndex,
      });
    }
  });

  // 2. Perlintasan Rel Kereta Api di (x = 60, z = -62)
  const railZ = LAYOUT_DATA.rails[0]?.points[0]?.[1] ?? -62;
  const railCrossX = LAYOUT_DATA.rails[0]?.crossingX ?? 60;
  let bestNorthIdx = -1;
  let bestNorthDist = 999;
  let bestSouthIdx = -1;
  let bestSouthDist = 999;

  for (let i = 0; i < dense.length; i++) {
    const p = dense[i];
    if (Math.abs(p.x - railCrossX) < 4.2 && Math.abs(p.uz) > 0.85) {
      if (p.uz < -0.85) {
        // Bergerak ke utara: berhenti di selatan palang (z = railZ + 6.8)
        const d = Math.abs(p.z - (railZ + 6.8));
        if (d < 2.2 && d < bestNorthDist) {
          bestNorthDist = d;
          bestNorthIdx = i;
        }
      } else {
        // Bergerak ke selatan: berhenti di utara palang (z = railZ - 6.8)
        const d = Math.abs(p.z - (railZ - 6.8));
        if (d < 2.2 && d < bestSouthDist) {
          bestSouthDist = d;
          bestSouthIdx = i;
        }
      }
    }
  }
  if (bestNorthIdx >= 0) {
    triggers.push({ kind: 'rail_gate', sTrigger: dense[bestNorthIdx].distFromStart });
  }
  if (bestSouthIdx >= 0) {
    triggers.push({ kind: 'rail_gate', sTrigger: dense[bestSouthIdx].distFromStart });
  }

  // 3. Halte Angkot untuk rute transit
  if (def.poolKind === 'transit') {
    for (const halte of trafficCfg.halteSpots) {
      let bestIdx = -1;
      let bestD = 999;
      for (let i = 0; i < dense.length; i++) {
        const d = distance2D(dense[i].x, dense[i].z, halte.x, halte.z);
        if (d < 5.5 && d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        triggers.push({
          kind: 'halte',
          sTrigger: dense[bestIdx].distFromStart,
          halteId: halte.id,
        });
      }
    }
  }

  return { def, samples: dense, totalLength, triggers };
}

function sampleRoutePointAtS(
  route: CompiledTrafficRoute,
  rawS: number
): PrecomputedRoutePoint {
  const L = route.totalLength;
  const s = ((rawS % L) + L) % L;
  const pts = route.samples;
  if (pts.length === 0) {
    return { x: 0, z: 0, ux: 0, uz: 1, rotY: 0, distFromStart: 0, hierarchy: 'arteri', turnCurvature: 0 };
  }
  // Binary search pada distFromStart
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].distFromStart <= s) lo = mid;
    else hi = mid - 1;
  }
  const a = pts[lo];
  const b = pts[(lo + 1) % pts.length];
  const bDist = lo === pts.length - 1 ? L : b.distFromStart;
  const span = Math.max(0.01, bDist - a.distFromStart);
  const t = Math.max(0, Math.min(1, (s - a.distFromStart) / span));

  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  const ux = a.ux + (b.ux - a.ux) * t;
  const uz = a.uz + (b.uz - a.uz) * t;
  const rotY = Math.atan2(ux, uz);
  const turnCurvature = a.turnCurvature * (1 - t) + b.turnCurvature * t;

  return {
    x,
    z,
    ux,
    uz,
    rotY,
    distFromStart: s,
    hierarchy: a.hierarchy,
    turnCurvature,
  };
}

function forwardCyclicDist(fromS: number, toS: number, loopLen: number): number {
  const diff = toS - fromS;
  return ((diff % loopLen) + loopLen) % loopLen;
}

function simulateSlotOverPeriod(
  route: CompiledTrafficRoute,
  initialS: number,
  cruiseSpeedMps: number,
  trafficCfg: TrafficConfigDoc,
  trainSchedule: TrainScheduleConfig,
  epochMs: number,
  recordTable: boolean,
  speedScale = 1.0
): {
  totalDist: number;
  sArray?: Float64Array;
  vArray?: Float32Array;
  stopReasonArray?: Uint8Array;
} {
  const steps = Math.round(TRAFFIC_CYCLE_PERIOD_SEC / TABLE_DT_SEC); // 1680 langkah @ 0.25s
  const sArray = recordTable ? new Float64Array(steps + 1) : undefined;
  const vArray = recordTable ? new Float32Array(steps + 1) : undefined;
  const stopReasonArray = recordTable ? new Uint8Array(steps + 1) : undefined;

  let totalDist = 0;
  let currentSpeed = cruiseSpeedMps;
  let halteCooldownSec = 0;
  let halteDwellSec = 0;

  for (let i = 0; i <= steps; i++) {
    const tSec = i * TABLE_DT_SEC;
    // Waktu acuan deterministik relatif epochMs agar modulo 420s selaras persis untuk lampu & kereta
    const nowMs = epochMs + tSec * 1000;
    const sMod = ((initialS + totalDist) % route.totalLength + route.totalLength) % route.totalLength;
    const pt = sampleRoutePointAtS(route, sMod);
    const roadMax = trafficCfg.speedLimitsMps[pt.hierarchy] ?? 10;
    const cornerSlowFactor = Math.abs(pt.turnCurvature) > 0.15 ? 0.78 : 1;
    let targetSpeed =
      Math.min(cruiseSpeedMps * speedScale, roadMax * 0.86 * speedScale, roadMax) *
      cornerSlowFactor;
    let stopReason = STOP_NONE;

    if (halteCooldownSec > 0) halteCooldownSec = Math.max(0, halteCooldownSec - TABLE_DT_SEC);

    if (halteDwellSec > 0) {
      halteDwellSec = Math.max(0, halteDwellSec - TABLE_DT_SEC);
      targetSpeed = 0;
      stopReason = STOP_HALTE;
    } else {
      for (const trig of route.triggers) {
        const ahead = forwardCyclicDist(sMod, trig.sTrigger, route.totalLength);
        if (trig.kind === 'halte') {
          if (halteCooldownSec <= 0 && ahead <= 2.0) {
            halteDwellSec = 3.0;
            halteCooldownSec = 25;
            targetSpeed = 0;
            stopReason = STOP_HALTE;
            break;
          }
        } else if (trig.kind === 'rail_gate') {
          if (ahead <= 5.5) {
            const train = getDeterministicTrainState(nowMs, trainSchedule, epochMs);
            const trainSoon = getDeterministicTrainState(nowMs + 1500, trainSchedule, epochMs);
            const gateClosed =
              train.phase === 'approaching' ||
              train.phase === 'boarding' ||
              train.phase === 'departing' ||
              trainSoon.phase === 'approaching';
            if (gateClosed) {
              targetSpeed = 0;
              stopReason = STOP_RAIL_GATE;
              break;
            }
          }
        } else if (trig.kind === 'traffic_light_ew' || trig.kind === 'traffic_light_ns') {
          if (ahead <= 5.5) {
            const tl = trafficCfg.trafficLights[trig.tlIndex ?? 0];
            if (tl) {
              const phase = getDeterministicTrafficLightPhase(
                nowMs,
                tl.phaseOffsetMs,
                trafficCfg.trafficLightCycleMs,
                trafficCfg.trafficLightGreenMs,
                trafficCfg.trafficLightYellowMs
              );
              const sig = trig.kind === 'traffic_light_ew' ? phase.ewSignal : phase.nsSignal;
              // Berhenti sebelum garis stop saat merah maupun kuning agar seluruh kendaraan sempat mengosongkan simpang
              if (sig !== 'green') {
                targetSpeed = 0;
                stopReason = STOP_RED_LIGHT;
                break;
              }
            }
          }
        }
      }
    }

    if (targetSpeed === 0) {
      currentSpeed = 0;
    } else {
      const accel = 7.5 * TABLE_DT_SEC;
      if (currentSpeed < targetSpeed) currentSpeed = Math.min(targetSpeed, currentSpeed + accel);
      else currentSpeed = Math.max(targetSpeed, currentSpeed - accel);
    }

    if (recordTable && sArray && vArray && stopReasonArray) {
      sArray[i] = initialS + totalDist;
      vArray[i] = currentSpeed;
      stopReasonArray[i] = stopReason;
    }

    if (i < steps) {
      totalDist += currentSpeed * TABLE_DT_SEC;
    }
  }

  return { totalDist, sArray, vArray, stopReasonArray };
}

function buildPeriodicSlotTable(
  route: CompiledTrafficRoute,
  slotIndex: number,
  trafficCfg: TrafficConfigDoc,
  trainSchedule: TrainScheduleConfig,
  epochMs: number
): SlotScheduleTable {
  const L = route.totalLength;
  const initialS = (slotIndex / Math.max(1, route.def.slotCount)) * L;
  const baseCruise =
    route.def.poolKind === 'gang'
      ? 5.0
      : route.def.poolKind === 'transit'
        ? 8.2
        : route.def.poolKind === 'patrol'
          ? 8.8
          : 9.2;

  const loSpeed = Math.max(3.8, baseCruise * 0.65);
  const hiSpeed = Math.min(13.5, baseCruise * 1.45);
  let bestSpeed = baseCruise;
  let bestTargetLaps = 2;
  let bestDiff = Infinity;

  // Pemindaian kasar untuk memilih pasangan (jumlah lap, kecepatan) paling akurat tanpa terjebak diskontinuitas lampu merah
  const coarseSamples = 18;
  for (let idx = 0; idx <= coarseSamples; idx++) {
    const candSpeed = loSpeed + ((hiSpeed - loSpeed) * idx) / coarseSamples;
    const sim = simulateSlotOverPeriod(route, initialS, candSpeed, trafficCfg, trainSchedule, epochMs, false, 1.0);
    const laps = Math.max(2, Math.round(sim.totalDist / L));
    const diff = Math.abs(sim.totalDist - laps * L);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSpeed = candSpeed;
      bestTargetLaps = laps;
    }
  }

  const targetDist = bestTargetLaps * L;
  const stepWidth = (hiSpeed - loSpeed) / coarseSamples;
  let bLo = Math.max(loSpeed, bestSpeed - stepWidth);
  let bHi = Math.min(hiSpeed, bestSpeed + stepWidth);

  for (let iter = 0; iter < 14; iter++) {
    const mid = (bLo + bHi) * 0.5;
    const sim = simulateSlotOverPeriod(route, initialS, mid, trafficCfg, trainSchedule, epochMs, false, 1.0);
    const diff = sim.totalDist - targetDist;
    if (Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff);
      bestSpeed = mid;
    }
    if (diff < 0) bLo = mid;
    else bHi = mid;
  }

  // Penyesuaian skala kecepatan halus secara live (tetap mematuhi lampu & palang KA)
  let bestScale = 1.0;
  let curScale = 1.0;
  for (let refine = 0; refine < 4 && bestDiff > 0.2; refine++) {
    const sim = simulateSlotOverPeriod(
      route,
      initialS,
      bestSpeed,
      trafficCfg,
      trainSchedule,
      epochMs,
      false,
      curScale
    );
    const signedDiff = targetDist - sim.totalDist;
    if (Math.abs(signedDiff) < bestDiff) {
      bestDiff = Math.abs(signedDiff);
      bestScale = curScale;
    }
    if (Math.abs(signedDiff) <= 0.2) break;
    const adjust = Math.max(-0.04, Math.min(0.04, signedDiff / Math.max(120, sim.totalDist)));
    curScale = Math.max(0.85, Math.min(1.16, curScale * (1 + adjust)));
  }

  const finalSim = simulateSlotOverPeriod(
    route,
    initialS,
    bestSpeed,
    trafficCfg,
    trainSchedule,
    epochMs,
    true,
    bestScale
  );
  const sArray = finalSim.sArray!;
  const vArray = finalSim.vArray!;
  const stopReasonArray = finalSim.stopReasonArray!;

  // Sebarkan sisa mikro (< 1.5m) secara mulus pada langkah cruising bebas agar penutupan siklus 420 detik sempurna
  const residual = targetDist - finalSim.totalDist;
  if (Math.abs(residual) > 1e-4 && Math.abs(residual) <= 1.5) {
    let movingWeightSum = 0;
    for (let i = 1; i < sArray.length; i++) {
      if (vArray[i - 1] > 0.5 && stopReasonArray[i] === STOP_NONE) movingWeightSum += vArray[i - 1];
    }
    if (movingWeightSum > 0) {
      let accumFix = 0;
      for (let i = 1; i < sArray.length; i++) {
        if (vArray[i - 1] > 0.5 && stopReasonArray[i] === STOP_NONE) {
          accumFix += residual * (vArray[i - 1] / movingWeightSum);
        }
        sArray[i] += accumFix;
      }
    }
  }

  return {
    slotKey: `${route.def.id}#${slotIndex}`,
    routeId: route.def.id,
    slotIndex,
    periodSec: TRAFFIC_CYCLE_PERIOD_SEC,
    dtSec: TABLE_DT_SEC,
    sArray,
    vArray,
    stopReasonArray,
  };
}

interface CompiledTrafficBundle {
  signature: string;
  routesById: Map<string, CompiledTrafficRoute>;
  slotsByKey: Map<string, SlotScheduleTable>;
  interleavedSlots: SlotScheduleTable[];
}

let cachedBundle: CompiledTrafficBundle | null = null;

function ensureCompiledTrafficBundle(
  trafficCfg: TrafficConfigDoc,
  trainSchedule: TrainScheduleConfig,
  epochMs: number
): CompiledTrafficBundle {
  const sig = `${epochMs}:${trainSchedule.cycleRealMs}:${trafficCfg.trafficLightCycleMs}:${trafficCfg.trafficLights.length}`;
  if (cachedBundle && cachedBundle.signature === sig) {
    return cachedBundle;
  }

  const routesById = new Map<string, CompiledTrafficRoute>();
  const slotsByKey = new Map<string, SlotScheduleTable>();
  const perRouteTables: SlotScheduleTable[][] = [];

  for (const def of CICALENGKA_TRAFFIC_ROUTES) {
    const compiled = compileTrafficRoute(def, trafficCfg);
    routesById.set(def.id, compiled);
    const tables: SlotScheduleTable[] = [];
    for (let s = 0; s < def.slotCount; s++) {
      const tbl = buildPeriodicSlotTable(compiled, s, trafficCfg, trainSchedule, epochMs);
      tables.push(tbl);
      slotsByKey.set(tbl.slotKey, tbl);
    }
    perRouteTables.push(tables);
  }

  // Susun round-robin antar rute agar saat kepadatan malam berkurang, semua jalan tetap terdistribusi merata
  const interleavedSlots: SlotScheduleTable[] = [];
  const maxSlotsPerRoute = Math.max(...perRouteTables.map((t) => t.length));
  for (let s = 0; s < maxSlotsPerRoute; s++) {
    for (const tables of perRouteTables) {
      if (s < tables.length) interleavedSlots.push(tables[s]);
    }
  }

  cachedBundle = { signature: sig, routesById, slotsByKey, interleavedSlots };
  return cachedBundle;
}

const GANG_ELIGIBLE_MODELS = new Set([
  'motor_bebek',
  'motor_matic',
  'motor_ojek',
  'motor_tua',
  'npc_becak',
]);

const NPC_FALLBACK_COLORS: Record<string, string[]> = {
  npc_becak: ['#16A34A', '#2563EB', '#DC2626'],
  npc_bus: ['#1D4ED8', '#0F766E', '#CA8A04'],
  npc_truk_besar: ['#D97706', '#475569', '#15803D'],
  npc_polisi: ['#1E3A8A'],
  npc_ambulans: ['#F8FAFC'],
};

function pickVehicleIdentityForSlot(
  slotKey: string,
  poolKind: TrafficPoolKind,
  slotIndex: number,
  daySeed: number,
  trafficCfg: TrafficConfigDoc,
  models: VehicleModelConfig[]
): { modelId: string; color: string; plateNumber: string } {
  const h = hashTrafficSeed(slotKey, daySeed);
  let modelId = 'motor_matic';

  if (poolKind === 'transit') {
    modelId = h % 5 === 0 ? 'npc_bus' : 'mobil_angkot';
  } else if (poolKind === 'patrol' && slotIndex === 0) {
    modelId = h % 3 === 0 ? 'npc_ambulans' : 'npc_polisi';
  } else {
    const candidates =
      poolKind === 'gang'
        ? trafficCfg.npcPoolWeights.filter((w) => GANG_ELIGIBLE_MODELS.has(w.modelId))
        : trafficCfg.npcPoolWeights;
    const totalWeight = candidates.reduce((acc, w) => acc + Math.max(1, w.weight), 0);
    let pick = h % Math.max(1, totalWeight);
    for (const item of candidates) {
      pick -= Math.max(1, item.weight);
      if (pick < 0) {
        modelId = item.modelId;
        break;
      }
    }
  }

  const catalogModel = models.find((m) => m.id === modelId);
  const colorList = catalogModel?.colors?.length
    ? catalogModel.colors
    : NPC_FALLBACK_COLORS[modelId] || ['#334155', '#E2E8F0'];
  const color = colorList[(h >>> 8) % colorList.length];

  const num = 1000 + ((h >>> 12) % 8999);
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const l1 = letters[(h >>> 4) % letters.length];
  const l2 = letters[(h >>> 16) % letters.length];
  const plateNumber = `D ${num} ${l1}${l2}`;

  return { modelId, color, plateNumber };
}

/**
 * Evaluasi O(1) pose satu slot kendaraan NPC pada timestamp `serverNowMs` (untuk animasi 60 FPS di useFrame).
 */
export function evaluateTrafficSlotPose(params: {
  slotKey: string;
  serverNowMs: number;
  daySeed: number;
  playerPos: { x: number; z: number };
  trainSchedule: TrainScheduleConfig;
  epochMs?: number;
  trafficCfg?: TrafficConfigDoc;
}): DeterministicTrafficVehiclePose | null {
  const trafficCfg = params.trafficCfg || getTrafficConfig();
  const epochMs = params.epochMs ?? DEFAULT_GAME_CONFIG.epochMs;
  const bundle = ensureCompiledTrafficBundle(trafficCfg, params.trainSchedule, epochMs);
  const slot = bundle.slotsByKey.get(params.slotKey);
  if (!slot) return null;
  const route = bundle.routesById.get(slot.routeId);
  if (!route) return null;

  const relMs = params.serverNowMs - epochMs;
  const periodMs = TRAFFIC_CYCLE_PERIOD_SEC * 1000;
  const wrappedMs = ((relMs % periodMs) + periodMs) % periodMs;
  const tSec = wrappedMs / 1000;
  const fIdx = tSec / TABLE_DT_SEC;
  const idx0 = Math.floor(fIdx) % Math.round(TRAFFIC_CYCLE_PERIOD_SEC / TABLE_DT_SEC);
  const idx1 = idx0 + 1;
  const frac = fIdx - Math.floor(fIdx);

  const sInterp = slot.sArray[idx0] + (slot.sArray[idx1] - slot.sArray[idx0]) * frac;
  const speedMps = slot.vArray[idx0] + (slot.vArray[idx1] - slot.vArray[idx0]) * frac;
  const pose = sampleRoutePointAtS(route, sInterp);
  const distToPlayer = distance2D(params.playerPos.x, params.playerPos.z, pose.x, pose.z);
  const simpleRadius = trafficCfg.lodSimpleRadiusMeters ?? 46;
  const models = getDefaultVehicleConfig().vehicles.models;
  const identity = pickVehicleIdentityForSlot(
    slot.slotKey,
    route.def.poolKind,
    slot.slotIndex,
    params.daySeed,
    trafficCfg,
    models
  );
  const stopCode = slot.stopReasonArray[idx0];
  const stopReason =
    stopCode === STOP_RED_LIGHT
      ? 'red_light'
      : stopCode === STOP_RAIL_GATE
        ? 'rail_gate'
        : stopCode === STOP_HALTE
          ? 'halte'
          : null;

  return {
    slotKey: slot.slotKey,
    routeId: slot.routeId,
    slotIndex: slot.slotIndex,
    modelId: identity.modelId,
    color: identity.color,
    plateNumber: identity.plateNumber,
    x: pose.x,
    z: pose.z,
    rotY: pose.rotY,
    speedMps,
    steerAngle: pose.turnCurvature,
    isStopped: speedMps < 0.25,
    stopReason,
    sirenActive: identity.modelId === 'npc_polisi' || identity.modelId === 'npc_ambulans',
    distanceToPlayer: distToPlayer,
    lod: distToPlayer <= simpleRadius ? 'full' : 'simple',
  };
}

/**
 * Menghitung daftar kendaraan lalu lintas NPC deterministik untuk klien pada waktu server tertentu.
 * Murni komputasi klien (0 write ke database). Semua klien pada timestamp sama melihat kendaraan di titik sama.
 */
export function computeDeterministicTrafficVehicles(params: {
  serverNowMs: number;
  daySeed: number;
  gameHour: number;
  zone: ZoneId;
  playerPos: { x: number; z: number };
  isMobile: boolean;
  trainSchedule: TrainScheduleConfig;
  epochMs?: number;
  trafficCfg?: TrafficConfigDoc;
}): DeterministicTrafficVehiclePose[] {
  if (params.zone !== 'cicalengka') return [];

  const trafficCfg = params.trafficCfg || getTrafficConfig();
  if (!trafficCfg.enabled) return [];

  const epochMs = params.epochMs ?? DEFAULT_GAME_CONFIG.epochMs;
  const bundle = ensureCompiledTrafficBundle(trafficCfg, params.trainSchedule, epochMs);
  const models = getDefaultVehicleConfig().vehicles.models;

  const density = getTrafficDensityForHour(params.gameHour, trafficCfg.densityByHour);
  const deviceCap = params.isMobile
    ? trafficCfg.maxActiveNpcVehiclesMobile
    : trafficCfg.maxActiveNpcVehiclesDesktop;
  const activeSlotCount = Math.max(
    2,
    Math.min(bundle.interleavedSlots.length, deviceCap, Math.round(deviceCap * density))
  );

  // Hitung waktu siklik terhadap epochMs dalam periode 420 detik (mulus tanpa lompatan)
  const relMs = params.serverNowMs - epochMs;
  const periodMs = TRAFFIC_CYCLE_PERIOD_SEC * 1000;
  const wrappedMs = ((relMs % periodMs) + periodMs) % periodMs;
  const tSec = wrappedMs / 1000;
  const fIdx = tSec / TABLE_DT_SEC;
  const idx0 = Math.floor(fIdx) % Math.round(TRAFFIC_CYCLE_PERIOD_SEC / TABLE_DT_SEC);
  const idx1 = idx0 + 1;
  const frac = fIdx - Math.floor(fIdx);

  const cullRadius = trafficCfg.cullRadiusMeters ?? 88;
  const simpleRadius = trafficCfg.lodSimpleRadiusMeters ?? 46;

  const result: DeterministicTrafficVehiclePose[] = [];

  for (let i = 0; i < activeSlotCount; i++) {
    const slot = bundle.interleavedSlots[i];
    const route = bundle.routesById.get(slot.routeId);
    if (!route) continue;

    const sInterp = slot.sArray[idx0] + (slot.sArray[idx1] - slot.sArray[idx0]) * frac;
    const speedMps = slot.vArray[idx0] + (slot.vArray[idx1] - slot.vArray[idx0]) * frac;
    const pose = sampleRoutePointAtS(route, sInterp);
    const distToPlayer = distance2D(params.playerPos.x, params.playerPos.z, pose.x, pose.z);

    if (distToPlayer > cullRadius) continue;

    const identity = pickVehicleIdentityForSlot(
      slot.slotKey,
      route.def.poolKind,
      slot.slotIndex,
      params.daySeed,
      trafficCfg,
      models
    );

    const stopCode = slot.stopReasonArray[idx0];
    const stopReason =
      stopCode === STOP_RED_LIGHT
        ? 'red_light'
        : stopCode === STOP_RAIL_GATE
          ? 'rail_gate'
          : stopCode === STOP_HALTE
            ? 'halte'
            : null;

    result.push({
      slotKey: slot.slotKey,
      routeId: slot.routeId,
      slotIndex: slot.slotIndex,
      modelId: identity.modelId,
      color: identity.color,
      plateNumber: identity.plateNumber,
      x: pose.x,
      z: pose.z,
      rotY: pose.rotY,
      speedMps,
      steerAngle: pose.turnCurvature,
      isStopped: speedMps < 0.25,
      stopReason,
      sirenActive: identity.modelId === 'npc_polisi' || identity.modelId === 'npc_ambulans',
      distanceToPlayer: distToPlayer,
      lod: distToPlayer <= simpleRadius ? 'full' : 'simple',
    });
  }

  result.sort((a, b) => a.distanceToPlayer - b.distanceToPlayer);
  return result.slice(0, deviceCap);
}
