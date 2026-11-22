"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyJobAttendanceCheck = exports.syncPlayerState = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_1 = require("../helpers/firebase");
const phase2_1 = require("../helpers/phase2");
const stats_1 = require("../helpers/stats");
const bills_1 = require("./bills");
const jobs_1 = require("./jobs");
/**
 * Sinkronisasi lazy saat login atau aksi berkala:
 * menghitung penurunan status, cek pingsan, cek pemecatan, & generate tagihan terlewat.
 */
exports.syncPlayerState = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    await (0, phase2_1.ensurePhase2Configs)();
    const uid = request.auth.uid;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const outcome = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, configDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(configRef),
        ]);
        if (!charDoc.exists || !statsDoc.exists) {
            return { exists: false };
        }
        const charData = charDoc.data();
        const statsData = statsDoc.data();
        const rates = configDoc.exists
            ? {
                hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.hungerDecayPerHour),
                thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.thirstDecayPerHour),
                energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.energyDecayPerHour),
            }
            : stats_1.DEFAULT_DECAY_RATES;
        const lastCalc = statsData.lastCalculatedAt instanceof firestore_1.Timestamp
            ? statsData.lastCalculatedAt.toMillis()
            : nowMs;
        const computed = (0, stats_1.calculateLazyStats)({
            hunger: Number(statsData.hunger),
            thirst: Number(statsData.thirst),
            energy: Number(statsData.energy),
            health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
            hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
            mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
            lastCalculatedAtMs: lastCalc,
        }, nowMs, rates);
        const faintCheck = (0, phase2_1.applyFaintingOutcome)(tx, firebase_1.db, uid, computed, Number(charData.money), Number(charData.faintedCount || 0), nowMs);
        if (faintCheck.fainted) {
            tx.update(statsRef, {
                ...faintCheck.stats,
                lastCalculatedAt: now,
            });
        }
        const dismissal = (0, jobs_1.evaluateLazyDismissal)(tx, firebase_1.db, uid, charData, nowMs);
        const createdAtMs = charData.createdAt instanceof firestore_1.Timestamp ? charData.createdAt.toMillis() : nowMs;
        const lastPeriod = Number(charData.lastBillPeriod || 0);
        const billsRes = await (0, bills_1.syncLazyBillsForUser)(tx, firebase_1.db, uid, createdAtMs, lastPeriod, nowMs);
        return {
            exists: true,
            fainted: faintCheck.fainted,
            fired: dismissal.fired,
            newBillsCreated: billsRes.createdCount,
        };
    });
    return { ok: true, ...outcome };
});
/**
 * Opsional ringan: pengecekan pemecatan harian (bukan loop per detik).
 */
exports.dailyJobAttendanceCheck = (0, scheduler_1.onSchedule)({ schedule: 'every 24 hours', region: firebase_1.FUNCTIONS_REGION }, async () => {
    const nowMs = Date.now();
    const snap = await firebase_1.db
        .collection('characters')
        .where('currentJob', '!=', null)
        .limit(100)
        .get();
    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const job = data.currentJob;
        if (!job)
            continue;
        const lastShift = Number(job.lastShiftAtMs || job.hiredAtMs || nowMs);
        const missed = Math.floor((nowMs - lastShift) / phase2_1.economyConfig.expectedShiftIntervalMs);
        if (missed >= phase2_1.economyConfig.maxMissedShiftsBeforeFiring) {
            await docSnap.ref.update({
                currentJob: null,
                activeShift: null,
                updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
            });
        }
    }
});
//# sourceMappingURL=syncState.js.map