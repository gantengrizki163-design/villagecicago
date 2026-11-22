"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerPhase6DailyMaintenance = exports.scheduledPhase6DailyMaintenance = void 0;
exports.computeDynamicLandPlotPrice = computeDynamicLandPlotPrice;
exports.runPhase6DailyMaintenance = runPhase6DailyMaintenance;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const business_1 = require("../helpers/business");
const firebase_1 = require("../helpers/firebase");
const law_1 = require("../helpers/law");
const propertyAdvanced_1 = require("../helpers/propertyAdvanced");
function getUtcDayKey(nowMs) {
    const d = new Date(nowMs);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function computeDynamicLandPlotPrice(params) {
    const safeBase = Math.max(100_000, Math.round(params.basePrice));
    const safeInflation = Math.max(0.85, Math.min(1.5, Number(params.inflationIndex || 1.0)));
    const scarcityFactor = 1 + Math.max(0, Math.min(1, params.soldRatio)) * 0.18;
    const dailyJitter = 0.96 + (0, business_1.deterministicUnit)(`land_${params.plotId}_${params.daySeed}`) * 0.08;
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
async function runPhase6DailyMaintenance(nowMs = Date.now()) {
    await (0, law_1.ensurePhase6Configs)();
    const dayKey = getUtcDayKey(nowMs);
    const sinceMs = nowMs - 86_400_000;
    const { daySeed } = (0, law_1.getGameClockFromMs)(nowMs);
    const [recentCrimesSnap, activeSentencesSnap, treasurySnap, plotsSnap, expiredMemSnap] = await Promise.all([
        firebase_1.db.collection('crime_records').where('atMs', '>=', sinceMs).limit(100).get(),
        firebase_1.db.collection('sentences').where('status', '==', 'serving').limit(50).get(),
        firebase_1.db.collection('state').doc('treasury').get(),
        firebase_1.db.collection('land_plots').limit(40).get(),
        firebase_1.db.collection('npc_memory').where('expiresAtMs', '<=', nowMs).limit(30).get(),
    ]);
    // 1. Rekap kriminalitas harian
    const offenseBreakdown = {};
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
    const basePlotMap = new Map(propertyAdvanced_1.landConfig.plots.map((p) => [p.id, Number(p.price || 400_000)]));
    const totalPlots = plotsSnap.size;
    let soldPlots = 0;
    for (const pDoc of plotsSnap.docs) {
        const ownerId = String(pDoc.data()?.ownerId || propertyAdvanced_1.SYSTEM_PLOT_OWNER_ID);
        if (ownerId && ownerId !== propertyAdvanced_1.SYSTEM_PLOT_OWNER_ID) {
            soldPlots += 1;
        }
    }
    const soldRatio = totalPlots > 0 ? soldPlots / totalPlots : 0;
    const batch = firebase_1.db.batch();
    batch.set(firebase_1.db.collection('crime_recaps').doc(dayKey), recapPayload, { merge: true });
    batch.set(firebase_1.db.collection('state').doc('law_recap'), recapPayload, { merge: true });
    let updatedPlotsCount = 0;
    for (const pDoc of plotsSnap.docs) {
        const pData = pDoc.data();
        const ownerId = String(pData.ownerId || propertyAdvanced_1.SYSTEM_PLOT_OWNER_ID);
        if (ownerId && ownerId !== propertyAdvanced_1.SYSTEM_PLOT_OWNER_ID) {
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
exports.scheduledPhase6DailyMaintenance = (0, scheduler_1.onSchedule)({
    schedule: 'every 24 hours',
    region: firebase_1.FUNCTIONS_REGION,
}, async () => {
    await runPhase6DailyMaintenance(Date.now());
});
/**
 * Trigger manual khusus admin/emulator untuk menguji rekap kriminalitas & pembaruan harga tanah.
 */
exports.triggerPhase6DailyMaintenance = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const isAdminOrEmulator = request.auth.token?.admin === true || process.env.FUNCTIONS_EMULATOR === 'true';
    if (!isAdminOrEmulator) {
        throw new https_1.HttpsError('permission-denied', 'Hanya admin/emulator yang dapat memicu pemeliharaan harian Fase 6.');
    }
    const summary = await runPhase6DailyMaintenance(Date.now());
    return { ok: true, ...summary };
});
//# sourceMappingURL=phase6Scheduler.js.map