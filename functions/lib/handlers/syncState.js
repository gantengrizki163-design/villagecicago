"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyJobAttendanceCheck = exports.syncPlayerState = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const bank_1 = require("../helpers/bank");
const business_1 = require("../helpers/business");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const law_1 = require("../helpers/law");
const phase2_1 = require("../helpers/phase2");
const propertyAdvanced_1 = require("../helpers/propertyAdvanced");
const stats_1 = require("../helpers/stats");
const vehicles_1 = require("../helpers/vehicles");
const bills_1 = require("./bills");
const jobs_1 = require("./jobs");
const security_1 = require("./security");
/**
 * Sinkronisasi lazy saat login atau aksi berkala:
 * menghitung penurunan status, cek pingsan, cek pemecatan, tagihan terlewat, & sewa/pengusiran Fase 3.
 */
exports.syncPlayerState = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    await Promise.all([(0, phase2_1.ensurePhase2Configs)(), (0, law_1.ensurePhase6Configs)(), (0, vehicles_1.ensureVehicleConfigs)()]);
    const uid = request.auth.uid;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const [housingSync, , lawSync, propertyPhase6Sync, secSync, vehicleSync] = await Promise.all([
        (0, housing_1.syncLazyHousingState)(firebase_1.db, uid, nowMs),
        (0, bank_1.syncLazyLoanInstallments)(firebase_1.db, uid, nowMs),
        (0, law_1.syncLazySentenceAndWanted)(firebase_1.db, uid, nowMs),
        (0, propertyAdvanced_1.syncLazyMortgageAndConstructionState)(firebase_1.db, uid, nowMs),
        (0, security_1.syncLazySecurityAndInsurance)(firebase_1.db, uid, nowMs),
        (0, vehicles_1.syncLazyVehicleState)(firebase_1.db, uid, nowMs),
    ]);
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
        const isHomeless = typeof charData.homeless === 'boolean' ? charData.homeless : false;
        const computed = (0, stats_1.calculateLazyStats)({
            hunger: Number(statsData.hunger),
            thirst: Number(statsData.thirst),
            energy: Number(statsData.energy),
            health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
            hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
            mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
            lastCalculatedAtMs: lastCalc,
        }, nowMs, rates, { isHomeless });
        const homeRespawn = charData.respawnAtHome === true &&
            !isHomeless &&
            charData.lastSleepLocation &&
            typeof charData.lastSleepLocation.x === 'number'
            ? charData.lastSleepLocation
            : null;
        const faintCheck = (0, phase2_1.applyFaintingOutcome)(tx, firebase_1.db, uid, computed, Number(charData.money), Number(charData.faintedCount || 0), nowMs, homeRespawn);
        if (faintCheck.fainted) {
            tx.update(statsRef, {
                ...faintCheck.stats,
                lastCalculatedAt: now,
            });
        }
        const dismissal = (0, jobs_1.evaluateLazyDismissal)(tx, firebase_1.db, uid, charData, nowMs);
        const createdAtMs = charData.createdAt instanceof firestore_1.Timestamp ? charData.createdAt.toMillis() : nowMs;
        const lastPeriod = Number(charData.lastBillPeriod || 0);
        const billsRes = await (0, bills_1.syncLazyBillsForUser)(tx, firebase_1.db, uid, createdAtMs, lastPeriod, nowMs, Boolean(charData.activeLeaseId));
        return {
            exists: true,
            fainted: faintCheck.fainted,
            fired: dismissal.fired,
            evicted: housingSync.evicted,
            autoReleased: lawSync.autoReleased,
            wantedLevel: lawSync.wantedLevel,
            permitsApproved: propertyPhase6Sync.permitsApproved,
            constructionsAdvanced: propertyPhase6Sync.constructionsAdvanced,
            foreclosedCount: propertyPhase6Sync.foreclosedCount,
            repossessedVehicles: vehicleSync.repossessedCount,
            impoundedVehicles: vehicleSync.impoundedCount,
            newBillsCreated: billsRes.createdCount +
                housingSync.newHousingBills +
                propertyPhase6Sync.mortgageBillsCreated +
                secSync.billsCreated +
                vehicleSync.vehicleBillsCreated,
            ownedBizIds: Array.isArray(charData.businesses)
                ? charData.businesses.slice(0, 3)
                : [],
        };
    });
    if (outcome.exists && Array.isArray(outcome.ownedBizIds)) {
        for (const bizId of outcome.ownedBizIds) {
            await (0, business_1.settleBusinessLazy)(firebase_1.db, bizId, nowMs).catch(() => { });
        }
    }
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