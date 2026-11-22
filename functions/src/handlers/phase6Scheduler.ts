import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { deterministicUnit } from '../helpers/business';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import { ensurePhase6Configs, getGameClockFromMs } from '../helpers/law';
import { landConfig, SYSTEM_PLOT_OWNER_ID } from '../helpers/propertyAdvanced';

function getUtcDayKey(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function computeDynamicLandPlotPrice(params: {
  plotId: string;
  basePrice: number;
  inflationIndex: number;
  soldRatio: number;
  daySeed: number;
}): number {
  const safeBase = Math.max(100_000, Math.round(params.basePrice));
  const safeInflation = Math.max(0.85, Math.min(1.5, Number(params.inflationIndex || 1.0)));
  const scarcityFactor = 1 + Math.max(0, Math.min(1, params.soldRatio)) * 0.18;
  const dailyJitter = 0.96 + deterministicUnit(`land_${params.plotId}_${params.daySeed}`) * 0.08;

  const raw = safeBase * safeInflation * scarcityFactor * dailyJitter;
  const minBound = Math.round((safeBase * 0.85) / 5000) * 5000;
  const maxBound = Math.round((safeBase * 1.45) / 5000) * 5000;
  const rounded = Math.round(raw / 5000) * 5000;

  return Math.max(minBound, Math.min(maxBound, rounded));
}

/**
 * Tugas harian ringan Fase 6 (tanpa loop frame/detik):
 * 1. Rekap kriminalitas 24 jam terakhir -> state/law_recap & crime_recaps/{dayKey}
 * 2. Pembaruan harga tanah dinamis untuk kavling yang belum terjual (land_plots)
 * 3. Pembersihan memori dialog NPC yang sudah kedaluwarsa (maks 30 dok per siklus)
 */
export async function runPhase6DailyMaintenance(nowMs = Date.now()): Promise<{
  dayKey: string;
  totalRecentCrimes: number;
  activeWantedCount: number;
  activePrisonersCount: number;
  updatedPlotsCount: number;
  cleanedMemoriesCount: number;
}> {
  await ensurePhase6Configs();

  const dayKey = getUtcDayKey(nowMs);
  const sinceMs = nowMs - 86_400_000;
  const { daySeed } = getGameClockFromMs(nowMs);

  const [recentCrimesSnap, activeSentencesSnap, treasurySnap, plotsSnap, expiredMemSnap] =
    await Promise.all([
      db.collection('crime_records').where('atMs', '>=', sinceMs).limit(100).get(),
      db.collection('sentences').where('status', '==', 'serving').limit(50).get(),
      db.collection('state').doc('treasury').get(),
      db.collection('land_plots').limit(40).get(),
      db.collection('npc_memory').where('expiresAtMs', '<=', nowMs).limit(30).get(),
    ]);

  // 1. Rekap kriminalitas harian
  const offenseBreakdown: Record<string, number> = {};
  let activeWantedCount = 0;
  let totalFinesValue = 0;

  for (const docSnap of recentCrimesSnap.docs) {
    const c = docSnap.data();
    const offId = String(c.offenseId || 'lainnya');
    offenseBreakdown[offId] = (offenseBreakdown[offId] || 0) + 1;
    if (c.status === 'wanted' || c.status === 'reported') {
      activeWantedCount += 1;
    }
    totalFinesValue += Math.max(0, Number(c.fine || 0));
  }

  let topOffense = 'none';
  let topCount = 0;
  for (const [k, count] of Object.entries(offenseBreakdown)) {
    if (count > topCount) {
      topCount = count;
      topOffense = k;
    }
  }

  const recapPayload = {
    dayKey,
    totalRecentCrimes: recentCrimesSnap.size,
    activeWantedCount,
    activePrisonersCount: activeSentencesSnap.size,
    totalFinesValue,
    topOffense,
    offenseBreakdown,
    updatedAtMs: nowMs,
  };

  // 2. Pembaruan harga kavling tanah belum terjual berdasarkan inflasi & kelangkaan
  const inflationIndex = treasurySnap.exists
    ? Number(treasurySnap.data()?.inflationIndex || 1.0)
    : 1.0;

  const basePlotMap = new Map(landConfig.plots.map((p) => [p.id, Number(p.price || 400_000)]));
  const totalPlots = plotsSnap.size;
  let soldPlots = 0;
  for (const pDoc of plotsSnap.docs) {
    const ownerId = String(pDoc.data()?.ownerId || SYSTEM_PLOT_OWNER_ID);
    if (ownerId && ownerId !== SYSTEM_PLOT_OWNER_ID) {
      soldPlots += 1;
    }
  }
  const soldRatio = totalPlots > 0 ? soldPlots / totalPlots : 0;

  const batch = db.batch();
  batch.set(db.collection('crime_recaps').doc(dayKey), recapPayload, { merge: true });
  batch.set(db.collection('state').doc('law_recap'), recapPayload, { merge: true });

  let updatedPlotsCount = 0;
  for (const pDoc of plotsSnap.docs) {
    const pData = pDoc.data();
    const ownerId = String(pData.ownerId || SYSTEM_PLOT_OWNER_ID);
    if (ownerId && ownerId !== SYSTEM_PLOT_OWNER_ID) {
      continue; // Jangan mengubah harga kavling yang sudah dimiliki pemain
    }
    const basePrice = Number(pData.basePrice || basePlotMap.get(pDoc.id) || pData.price || 400_000);
    const nextPrice = computeDynamicLandPlotPrice({
      plotId: pDoc.id,
      basePrice,
      inflationIndex,
      soldRatio,
      daySeed,
    });
    batch.update(pDoc.ref, {
      basePrice,
      price: nextPrice,
      priceUpdatedAtMs: nowMs,
    });
    updatedPlotsCount += 1;
  }

  // 3. Hapus dokumen memori NPC yang kedaluwarsa (maks 30 per batch)
  let cleanedMemoriesCount = 0;
  for (const mDoc of expiredMemSnap.docs) {
    batch.delete(mDoc.ref);
    cleanedMemoriesCount += 1;
  }

  await batch.commit();

  return {
    dayKey,
    totalRecentCrimes: recentCrimesSnap.size,
    activeWantedCount,
    activePrisonersCount: activeSentencesSnap.size,
    updatedPlotsCount,
    cleanedMemoriesCount,
  };
}

/**
 * Cloud Scheduler ringan harian untuk rekap hukum & pembaruan harga tanah Cicalengka.
 */
export const scheduledPhase6DailyMaintenance = onSchedule(
  {
    schedule: 'every 24 hours',
    region: FUNCTIONS_REGION,
  },
  async () => {
    await runPhase6DailyMaintenance(Date.now());
  }
);

/**
 * Trigger manual khusus admin/emulator untuk menguji rekap kriminalitas & pembaruan harga tanah.
 */
export const triggerPhase6DailyMaintenance = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const isAdminOrEmulator =
      request.auth.token?.admin === true || process.env.FUNCTIONS_EMULATOR === 'true';
    if (!isAdminOrEmulator) {
      throw new HttpsError(
        'permission-denied',
        'Hanya admin/emulator yang dapat memicu pemeliharaan harian Fase 6.'
      );
    }

    const summary = await runPhase6DailyMaintenance(Date.now());
    return { ok: true, ...summary };
  }
);
