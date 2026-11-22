import interactionLocationsJson from '../config/interactionLocations.json';

export const WORLD_BOUNDS = {
  minX: -80,
  maxX: 80,
  minY: -2,
  maxY: 25,
  minZ: -80,
  maxZ: 80,
};

// Lokasi stasiun (area spawn awal)
export const STATION_SPAWN = {
  x: 0,
  y: 1.0,
  z: -46,
  rotY: 0,
};

// Lokasi Warung Teh Neng (Cicalengka)
export const WARUNG_POS = { x: -30, z: -22 };

// Lokasi 5 Kontrakan Cicalengka
export const KONTRAKAN_POSITIONS = [
  { id: 'kontrakan_1', x: -36, z: 40 },
  { id: 'kontrakan_2', x: -28, z: 40 },
  { id: 'kontrakan_3', x: -8, z: 40 },
  { id: 'kontrakan_4', x: 0, z: 40 },
  { id: 'kontrakan_5', x: 8, z: 40 },
];

export const INTERACT_RADIUS_METERS = interactionLocationsJson.interactRadiusMeters;

export function distance2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function isValidHexColor(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

export function isValidCharacterName(name: unknown): name is string {
  return typeof name === 'string' && /^[a-zA-Z0-9 _.-]{3,20}$/.test(name.trim());
}

export function clampWorldPos(pos: { x: number; y: number; z: number; rotY?: number }) {
  return {
    x: Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, Number(pos.x) || 0)),
    y: Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, Number(pos.y) || 1)),
    z: Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, Number(pos.z) || 0)),
    rotY: Math.max(-Math.PI * 2, Math.min(Math.PI * 2, Number(pos.rotY) || 0)),
  };
}
