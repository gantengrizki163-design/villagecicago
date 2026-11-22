import type { RTDBVehicle, RTDBVehiclePassenger, ZoneId } from '../../types/game';
import { getVehicleSeatAnchors } from './vehicleMaterials';
import type { TurnSignalMode } from './vehiclePhysics';

export const VEHICLE_CULL_RADIUS_METERS = 78;
export const VEHICLE_LOD_SIMPLE_RADIUS_METERS = 42;
export const VEHICLE_STALE_MS = 90_000;
export const VEHICLE_HEARTBEAT_MS = 8_000;

const SESSION_STORAGE_KEY = 'cicalengka_rtdb_tab_session_id';
let fallbackSessionId: string | null = null;

/**
 * ID sesi unik per tab browser (disimpan di sessionStorage agar 2 tab berbeda tidak menimpa/menduplikasi kendaraan aktif).
 */
export function getTabSessionId(): string {
  if (typeof window !== 'undefined') {
    try {
      const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
        return existing;
      }
      const created = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
      return created;
    } catch {
      // Abaikan jika sessionStorage dibatasi
    }
  }
  if (!fallbackSessionId) {
    fallbackSessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return fallbackSessionId;
}

/**
 * Normalisasi sudut radian ke rentang [-PI, PI] agar aman untuk aturan RTDB (-7..7) & interpolasi shortest-arc.
 */
export function normalizeAngleRad(rad: number): number {
  if (!Number.isFinite(rad)) return 0;
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Interpolasi sudut terpendek (radian).
 */
export function lerpAngleRad(fromRad: number, toRad: number, alpha: number): number {
  const diff = normalizeAngleRad(toRad - fromRad);
  return normalizeAngleRad(fromRad + diff * alpha);
}

export interface VehicleSyncSample {
  vehicleId: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  vx: number;
  vz: number;
  speed: number;
  steerAngle: number;
  headlights: boolean;
  turnSignal: TurnSignalMode;
  hornAtMs: number;
}

export interface VehicleSyncRecord extends VehicleSyncSample {
  sentAtMs: number;
}

/**
 * Interval adaptif sinkronisasi posisi kendaraan ke RTDB:
 * - Cepat / berbelok tajam: ~100ms
 * - Berkendara normal: ~150ms
 * - Merayap pelan: ~260ms
 */
export function computeAdaptiveVehicleSyncIntervalMs(
  speedMps: number,
  steerAngle: number
): number {
  const absSpeed = Math.abs(speedMps);
  const absSteer = Math.abs(steerAngle);
  if (absSpeed >= 8 || absSteer >= 0.16) return 100;
  if (absSpeed >= 1.6) return 150;
  return 260;
}

/**
 * Tentukan apakah perlu menulis update ke RTDB (hemat kuota: skip saat diam kecuali ada perubahan diskret / heartbeat).
 */
export function shouldSendVehicleSyncUpdate(
  prev: VehicleSyncRecord | null,
  next: VehicleSyncSample,
  nowMs: number
): boolean {
  if (!prev || prev.vehicleId !== next.vehicleId) return true;

  const elapsed = nowMs - prev.sentAtMs;
  if (elapsed < 60) {
    // Tetap kirim segera bila ada event diskret penting (klakson, lampu, sein)
    if (
      prev.headlights !== next.headlights ||
      prev.turnSignal !== next.turnSignal ||
      prev.hornAtMs !== next.hornAtMs
    ) {
      return true;
    }
    return false;
  }

  // Perubahan diskret langsung terkirim
  if (
    prev.headlights !== next.headlights ||
    prev.turnSignal !== next.turnSignal ||
    prev.hornAtMs !== next.hornAtMs
  ) {
    return true;
  }

  const distMoved = Math.hypot(next.x - prev.x, next.z - prev.z);
  const rotDiff = Math.abs(normalizeAngleRad(next.rotY - prev.rotY));
  const isMovingNow = Math.abs(next.speed) > 0.15 || Math.hypot(next.vx, next.vz) > 0.15;
  const wasMoving = Math.abs(prev.speed) > 0.15;

  // Paket berhenti agar klien lain langsung menonaktifkan dead-reckoning
  if (wasMoving && !isMovingNow) {
    return true;
  }

  if (isMovingNow || distMoved > 0.08 || rotDiff > 0.05) {
    const interval = computeAdaptiveVehicleSyncIntervalMs(next.speed, next.steerAngle);
    return elapsed >= interval;
  }

  // Heartbeat ringan saat berhenti agar node RTDB tidak dianggap kadaluwarsa
  return elapsed >= VEHICLE_HEARTBEAT_MS;
}

export interface CulledRemoteVehicle {
  vehicle: RTDBVehicle;
  distance: number;
  lod: 'full' | 'simple';
  isLocalPassenger: boolean;
}

/**
 * Culling kendaraan jarak jauh, zona berbeda, kendaraan milik sendiri yang sedang dikemudikan, serta node kadaluwarsa.
 * Kendaraan di mana pemain lokal sedang menumpang tidak pernah di-cull.
 */
export function cullRemoteVehicles(
  rawVehicles: Record<string, RTDBVehicle> | RTDBVehicle[],
  opts: {
    myUid: string;
    myZone: ZoneId;
    myX: number;
    myZ: number;
    activeDriveVehicleId: string | null;
    nowMs: number;
    cullRadiusMeters?: number;
    lodSimpleRadiusMeters?: number;
    staleMs?: number;
  }
): CulledRemoteVehicle[] {
  const cullRadius = opts.cullRadiusMeters ?? VEHICLE_CULL_RADIUS_METERS;
  const simpleRadius = opts.lodSimpleRadiusMeters ?? VEHICLE_LOD_SIMPLE_RADIUS_METERS;
  const staleMs = opts.staleMs ?? VEHICLE_STALE_MS;

  const list = Array.isArray(rawVehicles) ? rawVehicles : Object.values(rawVehicles || {});
  const out: CulledRemoteVehicle[] = [];

  for (const v of list) {
    if (!v || !v.vehicleId) continue;
    if (v.zone !== opts.myZone) continue;
    if (opts.activeDriveVehicleId && v.vehicleId === opts.activeDriveVehicleId) continue;
    if (v.driverId === opts.myUid) continue;
    if (opts.nowMs - Number(v.updatedAt || 0) > staleMs) continue;

    const isLocalPassenger = Boolean(v.passengers && v.passengers[opts.myUid]);
    const dist = Math.hypot((v.x ?? 0) - opts.myX, (v.z ?? 0) - opts.myZ);
    if (!isLocalPassenger && dist > cullRadius) continue;

    out.push({
      vehicle: v,
      distance: dist,
      lod: isLocalPassenger || dist <= simpleRadius ? 'full' : 'simple',
      isLocalPassenger,
    });
  }

  out.sort((a, b) => a.distance - b.distance);
  return out;
}

export interface InterpolatedPose {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/**
 * Hitung target dead-reckoning singkat + interpolasi halus untuk kendaraan remote di frame rendering.
 */
export function stepInterpolatedVehiclePose(
  current: InterpolatedPose,
  target: {
    x: number;
    y: number;
    z: number;
    rotY: number;
    vx: number;
    vz: number;
    updatedAt: number;
  },
  opts: {
    nowServerMs: number;
    dt: number;
    hasArrivedFirstPacket?: boolean;
  }
): InterpolatedPose {
  // Prediksi dead-reckoning dibatasi maksimal 0.25 detik agar tidak overshoot saat lag/belok
  const ageSec = Math.max(0, Math.min(0.25, (opts.nowServerMs - target.updatedAt) / 1000));
  const predX = target.x + (target.vx || 0) * ageSec;
  const predZ = target.z + (target.vz || 0) * ageSec;

  const jumpDist = Math.hypot(predX - current.x, predZ - current.z);
  if (jumpDist > 18) {
    return {
      x: target.x,
      y: target.y,
      z: target.z,
      rotY: normalizeAngleRad(target.rotY),
    };
  }

  const safeDt = Math.min(Math.max(opts.dt, 0.001), 0.1);
  const posAlpha = 1 - Math.exp(-11 * safeDt);
  const rotAlpha = 1 - Math.exp(-12 * safeDt);

  return {
    x: current.x + (predX - current.x) * posAlpha,
    y: current.y + (target.y - current.y) * posAlpha,
    z: current.z + (predZ - current.z) * posAlpha,
    rotY: lerpAngleRad(current.rotY, target.rotY, rotAlpha),
  };
}

/**
 * Ubah offset kursi lokal kendaraan menjadi koordinat dunia (Three.js right-handed Y-up, +Z depan).
 */
export function computeWorldSeatPosition(
  vehX: number,
  vehY: number,
  vehZ: number,
  rotY: number,
  offset: [number, number, number]
): [number, number, number] {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const [ox, oy, oz] = offset;
  return [
    vehX + ox * cosY + oz * sinY,
    vehY + oy,
    vehZ - ox * sinY + oz * cosY,
  ];
}

/**
 * Ambil posisi offset lokal untuk kursi penumpang berdasarkan `seatIndex` (1-indexed).
 */
export function getPassengerSeatOffset(
  modelId: string,
  seatIndex: number
): [number, number, number] {
  const anchors = getVehicleSeatAnchors(modelId);
  const list = anchors.passengerOffsets;
  if (!list || list.length === 0) {
    return [0, 0.65, -0.45];
  }
  const idx = Math.max(0, seatIndex - 1) % list.length;
  return list[idx];
}

/**
 * Hitung nomor kursi penumpang berikutnya yang kosong (1 .. seatCapacity - 1).
 * Mengembalikan `null` bila semua kursi terisi.
 */
export function allocateNextPassengerSeat(
  passengers: Record<string, RTDBVehiclePassenger> | undefined,
  seatCapacity: number
): number | null {
  const maxSeats = Math.max(1, Math.floor(seatCapacity));
  if (maxSeats <= 1) return null;
  const used = new Set<number>();
  if (passengers) {
    for (const p of Object.values(passengers)) {
      if (p && Number.isFinite(p.seatIndex)) {
        used.add(Math.floor(p.seatIndex));
      }
    }
  }
  for (let seat = 1; seat < maxSeats; seat++) {
    if (!used.has(seat)) return seat;
  }
  return null;
}

/**
 * Hitung jumlah kursi penumpang tersisa pada kendaraan RTDB aktif.
 */
export function getAvailablePassengerSeats(vehicle: RTDBVehicle): number {
  const usedCount = vehicle.passengers ? Object.keys(vehicle.passengers).length : 0;
  return Math.max(0, Math.max(1, vehicle.seatCapacity) - 1 - usedCount);
}

const LAST_DRIVE_POS_STORAGE_PREFIX = 'cicalengka_last_drive_pos:';

export interface SavedDrivePos {
  vehicleId: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  distanceKm: number;
  updatedAtMs: number;
}

export function saveLocalLastDrivePos(uid: string, data: SavedDrivePos): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LAST_DRIVE_POS_STORAGE_PREFIX}${uid}`, JSON.stringify(data));
  } catch {
    // Abaikan kegagalan storage
  }
}

export function loadLocalLastDrivePos(uid: string): SavedDrivePos | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${LAST_DRIVE_POS_STORAGE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedDrivePos;
    if (!parsed || typeof parsed.vehicleId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalLastDrivePos(uid: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${LAST_DRIVE_POS_STORAGE_PREFIX}${uid}`);
  } catch {
    // Abaikan
  }
}
