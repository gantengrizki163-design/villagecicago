import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import aiConfig from '../config/ai.json';
import constructionConfig from '../config/construction.json';
import landConfig from '../config/land.json';
import lawConfig from '../config/law.json';
import mortgageConfig from '../config/mortgage.json';
import npcsConfig from '../config/npcs.json';
import questsConfig from '../config/quests.json';
import { db, rtdb } from './firebase';
import { GAME_DAY_DURATION_MS, GAME_EPOCH_MS } from './phase2';
import { distance2D } from './validation';

export {
  aiConfig,
  constructionConfig,
  landConfig,
  lawConfig,
  mortgageConfig,
  npcsConfig,
  questsConfig,
};

let phase6ConfigEnsured = false;

export async function ensurePhase6Configs(): Promise<void> {
  if (phase6ConfigEnsured) return;
  const entries: Array<[string, Record<string, unknown>]> = [
    ['law', lawConfig as unknown as Record<string, unknown>],
    ['npcs', npcsConfig as unknown as Record<string, unknown>],
    ['quests', questsConfig as unknown as Record<string, unknown>],
    ['mortgage', mortgageConfig as unknown as Record<string, unknown>],
    ['land', landConfig as unknown as Record<string, unknown>],
    ['construction', constructionConfig as unknown as Record<string, unknown>],
    ['ai', aiConfig as unknown as Record<string, unknown>],
  ];

  for (const [id, payload] of entries) {
    const ref = db.collection('config').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(payload);
    }
  }
  phase6ConfigEnsured = true;
}

export function getGameClockFromMs(nowMs: number): { gameHour: number; dayIndex: number; daySeed: number } {
  const elapsed = Math.max(0, nowMs - GAME_EPOCH_MS);
  const dayIndex = Math.floor(elapsed / GAME_DAY_DURATION_MS);
  const frac = (elapsed % GAME_DAY_DURATION_MS) / GAME_DAY_DURATION_MS;
  const gameHour = Math.floor(frac * 24) % 24;
  return { gameHour, dayIndex, daySeed: (dayIndex * 9301 + 49297) % 233280 };
}

export function computeLazyWantedLevel(
  currentWanted: number,
  wantedUpdatedAtMs: number,
  nowMs: number
): number {
  const cleanWanted = Math.max(0, Math.min(lawConfig.wantedMax, Number(currentWanted || 0)));
  if (cleanWanted <= 0) return 0;
  const lastMs = Number(wantedUpdatedAtMs || nowMs);
  const elapsedMs = Math.max(0, nowMs - lastMs);
  const elapsedGameHours = (elapsedMs / GAME_DAY_DURATION_MS) * 24;
  const decay = elapsedGameHours * Number(lawConfig.wantedDecayPerGameHour || 2.5);
  return Math.max(0, Math.round((cleanWanted - decay) * 10) / 10);
}

export function computeCatchChance(params: {
  baseCatchChance: number;
  witnessCount: number;
  posX: number;
  posZ: number;
  propertyProtectionScore?: number;
  nowMs: number;
  skills?: { fisik?: number; teknis?: number };
  reputation?: number;
}): {
  catchChance: number;
  cctvTriggered: boolean;
  isNight: boolean;
  cctvLabel: string | null;
} {
  let chance = Number(params.baseCatchChance || 0.35);

  // Saksi mata di sekitar lokasi (NPC + pemain lain)
  const witnessBonus = Math.min(0.35, Math.max(0, params.witnessCount) * 0.11);
  chance += witnessBonus;

  // Cek zona CCTV publik
  let cctvTriggered = false;
  let cctvLabel: string | null = null;
  for (const zone of lawConfig.cctvZones) {
    if (distance2D(params.posX, params.posZ, zone.x, zone.z) <= zone.radius) {
      chance += zone.catchBonus;
      cctvTriggered = true;
      cctvLabel = zone.label;
      break;
    }
  }

  // Keamanan properti/bisnis target (alarm, CCTV privat, gembok, satpam)
  const prot = Math.max(0, Math.min(100, Number(params.propertyProtectionScore || 0)));
  chance += (prot / 100) * 0.35;

  // Faktor jam malam vs siang
  const { gameHour } = getGameClockFromMs(params.nowMs);
  const isNight = gameHour >= lawConfig.nightHours.start || gameHour < lawConfig.nightHours.end;
  if (isNight) {
    chance += lawConfig.nightHours.catchRiskDelta;
  } else {
    chance += 0.05;
  }

  // Skill teknis & fisik mengurangi sedikit risiko tertangkap (maks -12%)
  const skillSum = Number(params.skills?.teknis || 0) + Number(params.skills?.fisik || 0);
  const skillReduction = Math.min(0.12, skillSum * 0.004);
  chance -= skillReduction;

  // Reputasi buruk membuat warga lebih waspada
  const rep = Number(params.reputation ?? 50);
  if (rep < 35) {
    chance += 0.08;
  }

  return {
    catchChance: Math.max(0.1, Math.min(0.96, chance)),
    cctvTriggered,
    isNight,
    cctvLabel,
  };
}

/**
 * Evaluasi lazy status tahanan & peluruhan wantedLevel saat login / syncPlayerState / aksi hukum.
 */
export async function syncLazySentenceAndWanted(
  firestore: Firestore,
  uid: string,
  nowMs: number
): Promise<{ autoReleased: boolean; wantedLevel: number }> {
  const charRef = firestore.collection('characters').doc(uid);
  const sentRef = firestore.collection('sentences').doc(uid);

  return firestore.runTransaction(async (tx) => {
    const [charSnap, sentSnap] = await Promise.all([tx.get(charRef), tx.get(sentRef)]);
    if (!charSnap.exists) {
      return { autoReleased: false, wantedLevel: 0 };
    }

    const charData = charSnap.data()!;
    const decayedWanted = computeLazyWantedLevel(
      Number(charData.wantedLevel || 0),
      Number(charData.wantedUpdatedAtMs || nowMs),
      nowMs
    );

    const updates: Record<string, unknown> = {};
    if (decayedWanted !== Number(charData.wantedLevel || 0)) {
      updates.wantedLevel = decayedWanted;
      updates.wantedUpdatedAtMs = nowMs;
    }

    let autoReleased = false;
    if (sentSnap.exists) {
      const sentData = sentSnap.data()!;
      if (sentData.status === 'serving' && nowMs >= Number(sentData.endAtMs || 0)) {
        tx.update(sentRef, {
          status: 'released',
          releasedAtMs: nowMs,
        });
        updates.sentence = null;
        updates.lastPosition = {
          ...lawConfig.policeStation.releaseSpawn,
          rotY: 0,
        };
        autoReleased = true;
      }
    } else if (charData.sentence && charData.sentence.active) {
      updates.sentence = null;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.fromMillis(nowMs);
      tx.update(charRef, updates);
    }

    return { autoReleased, wantedLevel: decayedWanted };
  });
}

export async function writeCrimeSceneRtdb(
  sceneId: string,
  payload: {
    type: string;
    label: string;
    zone: string;
    x: number;
    z: number;
    severity: number;
    nowMs: number;
  }
): Promise<void> {
  try {
    await rtdb.ref(`crimeScenes/${sceneId}`).set({
      id: sceneId,
      type: payload.type,
      label: payload.label.slice(0, 64),
      zone: payload.zone,
      x: Math.round(payload.x * 10) / 10,
      z: Math.round(payload.z * 10) / 10,
      severity: payload.severity,
      createdAt: payload.nowMs,
      expiresAt: payload.nowMs + 180_000,
    });
  } catch {
    // Non-fatal jika RTDB belum tersedia di environment tertentu
  }
}

export async function writeLawAlertRtdb(
  alertId: string,
  payload: {
    kind: 'alarm' | 'dispatch';
    targetUid: string;
    propertyId?: string;
    message: string;
    x: number;
    z: number;
    nowMs: number;
  }
): Promise<void> {
  try {
    await rtdb.ref(`lawAlerts/${alertId}`).set({
      id: alertId,
      kind: payload.kind,
      targetUid: payload.targetUid,
      propertyId: payload.propertyId || '',
      message: payload.message.slice(0, 140),
      x: Math.round(payload.x * 10) / 10,
      z: Math.round(payload.z * 10) / 10,
      createdAt: payload.nowMs,
      expiresAt: payload.nowMs + 120_000,
    });
  } catch {
    // Non-fatal
  }
}

export function applyReputationAndCredit(
  tx: Transaction,
  firestore: Firestore,
  uid: string,
  charData: FirebaseFirestore.DocumentData,
  accountSnap: FirebaseFirestore.DocumentSnapshot | null,
  repDelta: number,
  creditDelta: number,
  nowMs: number
): { reputation: number; creditScore: number } {
  const nextRep = Math.max(0, Math.min(100, Number(charData.reputation ?? 50) + repDelta));
  const nextCredit = Math.max(0, Math.min(100, Number(charData.creditScore ?? 65) + creditDelta));

  if (accountSnap && accountSnap.exists && creditDelta !== 0) {
    const accCredit = Math.max(
      0,
      Math.min(100, Number(accountSnap.data()?.creditScore ?? nextCredit) + creditDelta)
    );
    tx.update(firestore.collection('accounts').doc(uid), {
      creditScore: accCredit,
      updatedAtMs: nowMs,
    });
  }

  return { reputation: nextRep, creditScore: nextCredit };
}
