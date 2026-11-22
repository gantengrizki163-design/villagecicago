import npcsConfigJson from '../../../functions/src/config/npcs.json';
import type { GraphicsQuality, ZoneId } from '../types/game';
import { LAYOUT_DATA } from '../world3d/layout/layoutHelpers';
import { DEFAULT_GAME_CONFIG, distance2D } from '../world3d/worldConstants';

export interface NpcScheduleSlot {
  startHour: number;
  endHour: number;
  activity: string;
  zoneTag: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  personality: string;
  gender: 'laki-laki' | 'perempuan';
  appearance: {
    skinColor: string;
    hairColor: string;
    shirtColor: string;
    pantsColor: string;
  };
  homePos: { x: number; z: number };
  workPos: { x: number; z: number };
  speed: number;
  patrolRoute: number[][];
  defaultInventory: string[];
  schedule: NpcScheduleSlot[];
}

export interface NpcsConfigBundle {
  maxActiveRenderCount: Record<GraphicsQuality, number>;
  lodActiveRadiusMeters: number;
  npcs: NpcDefinition[];
}

export interface ClientLawAlert {
  id: string;
  kind?: string;
  message?: string;
  x: number;
  z: number;
  createdAt: number;
  expiresAt: number;
}

export interface ClientDeterministicNpcPose {
  npcId: string;
  name: string;
  role: string;
  personality: string;
  gender: 'laki-laki' | 'perempuan';
  appearance: NpcDefinition['appearance'];
  x: number;
  z: number;
  rotY: number;
  anim: 'walk' | 'idle';
  activity: string;
  zoneTag: string;
  isSleeping: boolean;
  isPatrolling: boolean;
  respondingAlertId: string | null;
  distanceToPlayer: number;
  lodTier: 'near' | 'mid' | 'culled';
}

export const DEFAULT_NPCS_CONFIG: NpcsConfigBundle = npcsConfigJson as NpcsConfigBundle;

const ZONE_TAG_ANCHORS: Record<string, { x: number; z: number }> = LAYOUT_DATA.anchors.zoneTagAnchors;

const WALKING_ACTIVITIES = new Set([
  'patroli_pagi',
  'patroli_sore',
  'patroli_malam',
  'jalan_pagi',
  'survei_lokasi',
  'sambang_warga',
  'belanja_pasar',
  'pulang_tidur',
]);

export function hashNpcSeed(npcId: string, daySeed: number): number {
  const input = `${npcId}:${daySeed}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getClientNpcClockState(serverNowMs: number): {
  dayIndex: number;
  daySeed: number;
  gameHourFloat: number;
  gameHour: number;
} {
  const dayDurationMs = Math.max(60_000, DEFAULT_GAME_CONFIG.dayDurationMs);
  const elapsed = Math.max(0, serverNowMs - DEFAULT_GAME_CONFIG.epochMs);
  const dayIndex = Math.floor(elapsed / dayDurationMs);
  const frac = (elapsed % dayDurationMs) / dayDurationMs;
  const gameHourFloat = frac * 24;
  const gameHour = Math.floor(gameHourFloat) % 24;
  const daySeed = (dayIndex * 9301 + 49297) % 233280;
  return { dayIndex, daySeed, gameHourFloat, gameHour };
}

function getSlotAnchor(npc: NpcDefinition, slot: NpcScheduleSlot, daySeed: number): { x: number; z: number } {
  if (slot.zoneTag === 'rumah' || slot.activity === 'tidur' || slot.activity === 'pulang_tidur') {
    return npc.homePos;
  }
  if (slot.activity === 'kerja' || slot.activity === 'jaga_tahanan') {
    return npc.workPos;
  }
  const base = ZONE_TAG_ANCHORS[slot.zoneTag] || npc.workPos;
  const h = hashNpcSeed(npc.id + ':' + slot.zoneTag, daySeed);
  const offsetX = ((h % 9) - 4) * 0.45;
  const offsetZ = (((h >> 4) % 9) - 4) * 0.45;
  return { x: base.x + offsetX, z: base.z + offsetZ };
}

function interpolateWaypoints(
  pts: number[][],
  speed: number,
  nowMs: number,
  phaseOffsetSec: number
): { x: number; z: number; rotY: number } {
  if (pts.length === 0) return { x: 0, z: 0, rotY: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], rotY: 0 };

  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segLengths.push(len);
    totalLen += len;
  }

  if (totalLen <= 0.01) {
    return { x: pts[0][0], z: pts[0][1], rotY: 0 };
  }

  const sec = Math.max(0, nowMs / 1000 + phaseOffsetSec);
  let dist = (sec * Math.max(0.8, speed)) % totalLen;

  for (let i = 0; i < pts.length; i++) {
    const segLen = segLengths[i];
    if (dist <= segLen || i === pts.length - 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const t = segLen > 0 ? dist / segLen : 0;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const rotY = Math.atan2(b[0] - a[0], b[1] - a[1]);
      return { x, z, rotY };
    }
    dist -= segLen;
  }

  return { x: pts[0][0], z: pts[0][1], rotY: 0 };
}

export function computeClientNpcPose(
  npc: NpcDefinition,
  serverNowMs: number,
  playerPos: { x: number; z: number },
  lodActiveRadiusMeters: number,
  activeAlerts?: ClientLawAlert[]
): ClientDeterministicNpcPose {
  const { daySeed, gameHourFloat, gameHour } = getClientNpcClockState(serverNowMs);
  const schedule = npc.schedule;
  let slotIdx = schedule.findIndex((s) => gameHour >= s.startHour && gameHour < s.endHour);
  if (slotIdx < 0) slotIdx = 0;

  const currentSlot = schedule[slotIdx];
  const prevSlot = schedule[(slotIdx - 1 + schedule.length) % schedule.length];
  const seedHash = hashNpcSeed(npc.id, daySeed);
  const phaseOffsetSec = (seedHash % 360) * 0.5;
  const isSleeping = currentSlot.activity === 'tidur';
  const isPatrolOfficer = npc.role === 'polisi_patroli';

  let respondingAlert: ClientLawAlert | null = null;
  if (isPatrolOfficer && !isSleeping && activeAlerts && activeAlerts.length > 0) {
    let bestDist = 65;
    for (const al of activeAlerts) {
      if (al.expiresAt > serverNowMs) {
        const d = distance2D(npc.workPos.x, npc.workPos.z, al.x, al.z);
        if (d < bestDist) {
          bestDist = d;
          respondingAlert = al;
        }
      }
    }
  }

  const slotElapsedHours = Math.max(0, gameHourFloat - currentSlot.startHour);
  const currentAnchor = getSlotAnchor(npc, currentSlot, daySeed);
  const prevAnchor = getSlotAnchor(npc, prevSlot, daySeed);

  let x = currentAnchor.x;
  let z = currentAnchor.z;
  let rotY = ((seedHash % 628) / 100) - Math.PI;
  let anim: 'walk' | 'idle' = 'idle';
  let isPatrolling = false;

  if (respondingAlert) {
    const patrolMid = npc.patrolRoute[0] || [npc.workPos.x, npc.workPos.z];
    const p = interpolateWaypoints(
      [
        [patrolMid[0], patrolMid[1]],
        [respondingAlert.x, respondingAlert.z],
      ],
      npc.speed * 1.25,
      serverNowMs,
      phaseOffsetSec
    );
    x = p.x;
    z = p.z;
    rotY = p.rotY;
    anim = 'walk';
    isPatrolling = true;
  } else if (
    !isSleeping &&
    npc.patrolRoute.length >= 2 &&
    (WALKING_ACTIVITIES.has(currentSlot.activity) ||
      (currentSlot.activity === 'mangkal' && seedHash % 3 === 0))
  ) {
    const p = interpolateWaypoints(npc.patrolRoute, npc.speed, serverNowMs, phaseOffsetSec);
    x = p.x;
    z = p.z;
    rotY = p.rotY;
    anim = 'walk';
    isPatrolling = currentSlot.activity.startsWith('patroli');
  } else if (slotElapsedHours < 0.25 && distance2D(prevAnchor.x, prevAnchor.z, currentAnchor.x, currentAnchor.z) > 2) {
    const t = Math.min(1, slotElapsedHours / 0.25);
    x = prevAnchor.x + (currentAnchor.x - prevAnchor.x) * t;
    z = prevAnchor.z + (currentAnchor.z - prevAnchor.z) * t;
    rotY = Math.atan2(currentAnchor.x - prevAnchor.x, currentAnchor.z - prevAnchor.z);
    anim = 'walk';
  }

  const distanceToPlayer = distance2D(playerPos.x, playerPos.z, x, z);
  let lodTier: 'near' | 'mid' | 'culled' = 'culled';
  if (!isSleeping && distanceToPlayer <= lodActiveRadiusMeters) {
    lodTier = distanceToPlayer <= 20 ? 'near' : 'mid';
  }

  return {
    npcId: npc.id,
    name: npc.name,
    role: npc.role,
    personality: npc.personality,
    gender: npc.gender,
    appearance: npc.appearance,
    x,
    z,
    rotY,
    anim,
    activity: respondingAlert ? 'respons_laporan' : currentSlot.activity,
    zoneTag: currentSlot.zoneTag,
    isSleeping,
    isPatrolling,
    respondingAlertId: respondingAlert ? respondingAlert.id : null,
    distanceToPlayer,
    lodTier,
  };
}

export function getVisibleDeterministicNpcs(params: {
  config?: NpcsConfigBundle;
  serverNowMs: number;
  playerPos: { x: number; z: number };
  quality: GraphicsQuality;
  zone: ZoneId;
  activeAlerts?: ClientLawAlert[];
}): {
  visibleNpcs: ClientDeterministicNpcPose[];
  nearestTalkableNpc: ClientDeterministicNpcPose | null;
} {
  if (params.zone !== 'cicalengka') {
    return { visibleNpcs: [], nearestTalkableNpc: null };
  }

  const cfg = params.config || DEFAULT_NPCS_CONFIG;
  const maxCount = cfg.maxActiveRenderCount[params.quality] ?? 12;
  const radius = cfg.lodActiveRadiusMeters ?? 45;

  const computed = cfg.npcs
    .map((npc) => computeClientNpcPose(npc, params.serverNowMs, params.playerPos, radius, params.activeAlerts))
    .filter((p) => p.lodTier !== 'culled')
    .sort((a, b) => {
      // Prioritaskan polisi yang sedang merespons laporan atau NPC terdekat
      if (a.respondingAlertId && !b.respondingAlertId) return -1;
      if (!a.respondingAlertId && b.respondingAlertId) return 1;
      return a.distanceToPlayer - b.distanceToPlayer;
    });

  const visibleNpcs = computed.slice(0, maxCount);
  const nearest = visibleNpcs.find((n) => n.distanceToPlayer <= 6.5) || null;

  return { visibleNpcs, nearestTalkableNpc: nearest };
}

export function formatNpcActivityLabel(activity: string): string {
  const labels: Record<string, string> = {
    tidur: 'Beristirahat di rumah',
    pulang_tidur: 'Perjalanan pulang',
    kerja: 'Sedang bekerja',
    patroli_pagi: 'Patroli Pagi',
    patroli_sore: 'Patroli Sore',
    patroli_malam: 'Patroli Malam',
    jaga_polsek: 'Jaga Piket Polsek',
    jaga_tahanan: 'Menjaga Tahanan',
    respons_laporan: 'Merespons Laporan Warga',
    belanja_pasar: 'Belanja di Pasar',
    makan_siang: 'Makan Siang',
    makan_sore: 'Istirahat Makan',
    sarapan: 'Sarapan Pagi',
    santai: 'Bersantai',
    jalan_pagi: 'Jalan Pagi',
    survei_lokasi: 'Survei Kavling Tanah',
    sambang_warga: 'Sambang Warga Kampung',
    kerja_rumah: 'Mengurus Rumah',
    sekolah: 'Mengajar / Belajar',
    main: 'Bermain',
    mangkal: 'Menunggu Penumpang',
    jual_panen: 'Berjualan Hasil Panen',
    berkebun: 'Merawat Kebun',
    istirahat: 'Istirahat Sebentar',
  };
  return labels[activity] || activity.replace(/_/g, ' ');
}
