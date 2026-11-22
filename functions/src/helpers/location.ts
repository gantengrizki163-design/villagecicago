import type { Database } from 'firebase-admin/database';
import type { DocumentData } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import interactionLocationsJson from '../config/interactionLocations.json';
import { getPlayerWorldPos } from './housing';
import { distance2D } from './validation';

export interface StaticLocationEntry {
  zone: string;
  label: string;
  x: number;
  z: number;
  doorX: number;
  doorZ: number;
}

export interface DynamicLocationTarget {
  id: string;
  label: string;
  zone?: string;
  x: number;
  z: number;
  doorX?: number;
  doorZ?: number;
  radius?: number;
}

export const INTERACTION_RADII_CONFIG = interactionLocationsJson as {
  interactRadiusMeters: number;
  hysteresisMeters: number;
  npcInteractRadiusMeters: number;
  locations: Record<string, StaticLocationEntry>;
};

export const SHARED_INTERACT_RADIUS_METERS = INTERACTION_RADII_CONFIG.interactRadiusMeters;
export const NPC_INTERACT_RADIUS_METERS = INTERACTION_RADII_CONFIG.npcInteractRadiusMeters;

export function getStaticLocation(locationId: string): StaticLocationEntry | null {
  return INTERACTION_RADII_CONFIG.locations[locationId] ?? null;
}

export function buildDynamicPropertyTarget(
  id: string,
  propData: DocumentData,
  labelOverride?: string,
  radiusPadding = 4.8
): DynamicLocationTarget {
  const staticLot = getStaticLocation(id);
  const pos = (propData.position || {}) as { x?: number; z?: number };
  const size = (propData.size || {}) as { width?: number; depth?: number };
  const x = Number(pos.x ?? staticLot?.x ?? 0);
  const z = Number(pos.z ?? staticLot?.z ?? 0);
  const w = Number(size.width ?? 6);
  const d = Number(size.depth ?? 6);
  const radius = Math.max(SHARED_INTERACT_RADIUS_METERS, Math.max(w, d) / 2 + radiusPadding);

  return {
    id,
    label: labelOverride || String(propData.name || staticLot?.label || id),
    zone: String(propData.zone || staticLot?.zone || 'cicalengka'),
    x,
    z,
    doorX: staticLot?.doorX ?? x,
    doorZ: staticLot?.doorZ ?? z + Math.max(2.5, d / 2 + 1.2),
    radius,
  };
}

export function buildDynamicLandPlotTarget(
  id: string,
  plotData: DocumentData
): DynamicLocationTarget {
  const staticLot = getStaticLocation(id);
  const pos = (plotData.position || {}) as { x?: number; z?: number };
  const size = (plotData.size || {}) as { width?: number; depth?: number };
  const x = Number(pos.x ?? staticLot?.x ?? 0);
  const z = Number(pos.z ?? staticLot?.z ?? 0);
  const w = Number(size.width ?? 8);
  const d = Number(size.depth ?? 8);
  const radius = Math.max(SHARED_INTERACT_RADIUS_METERS, Math.max(w, d) / 2 + 4.5);

  return {
    id,
    label: String(plotData.name || staticLot?.label || id),
    zone: String(plotData.zone || staticLot?.zone || 'cicalengka'),
    x,
    z,
    doorX: staticLot?.doorX ?? x,
    doorZ: staticLot?.doorZ ?? z,
    radius,
  };
}

export interface NearLocationMatch {
  locationId: string;
  label: string;
  distanceMeters: number;
  pos: { x: number; z: number };
}

/**
 * Helper terpadu sisi server untuk memverifikasi jarak real-time pemain (RTDB dengan fallback Firestore)
 * terhadap daftar lokasi statis (door/center) atau target dinamis (properti/bisnis/kavling).
 */
export async function assertNearLocation(
  rtdb: Database,
  uid: string,
  charData: DocumentData,
  locationIds: string[],
  toleransi = 0,
  dynamicTargets: DynamicLocationTarget[] = [],
  customErrorMessage?: string
): Promise<NearLocationMatch> {
  const pos = await getPlayerWorldPos(rtdb, uid, charData);
  const playerZone = String(charData.currentZone || 'cicalengka');
  const radiusBase = SHARED_INTERACT_RADIUS_METERS;

  const candidates: Array<{
    id: string;
    label: string;
    zone: string;
    x: number;
    z: number;
    doorX: number;
    doorZ: number;
    radius: number;
  }> = [];

  for (const id of locationIds) {
    const entry = getStaticLocation(id);
    if (entry) {
      candidates.push({
        id,
        label: entry.label,
        zone: entry.zone,
        x: entry.x,
        z: entry.z,
        doorX: entry.doorX,
        doorZ: entry.doorZ,
        radius: radiusBase,
      });
    }
  }

  for (const dyn of dynamicTargets) {
    candidates.push({
      id: dyn.id,
      label: dyn.label,
      zone: dyn.zone || 'cicalengka',
      x: dyn.x,
      z: dyn.z,
      doorX: dyn.doorX ?? dyn.x,
      doorZ: dyn.doorZ ?? dyn.z,
      radius: dyn.radius ?? radiusBase,
    });
  }

  let bestMatch: NearLocationMatch | null = null;
  const targetLabels: string[] = [];

  for (const c of candidates) {
    if (!targetLabels.includes(c.label)) targetLabels.push(c.label);
    if (c.zone !== playerZone) continue;

    const distDoor = distance2D(pos.x, pos.z, c.doorX, c.doorZ);
    const distCenter = distance2D(pos.x, pos.z, c.x, c.z);
    const effectiveDist = Math.min(distDoor, distCenter);
    const allowedRadius = c.radius + toleransi;

    if (effectiveDist <= allowedRadius) {
      if (!bestMatch || effectiveDist < bestMatch.distanceMeters) {
        bestMatch = {
          locationId: c.id,
          label: c.label,
          distanceMeters: effectiveDist,
          pos,
        };
      }
    }
  }

  if (!bestMatch) {
    const labelText = targetLabels.length > 0 ? targetLabels.join(' / ') : 'lokasi yang ditentukan';
    throw new HttpsError(
      'failed-precondition',
      customErrorMessage || `Harap datang dan dekati ${labelText} terlebih dahulu.`
    );
  }

  return bestMatch;
}
