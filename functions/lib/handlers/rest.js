"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rest = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
const stats_1 = require("../helpers/stats");
const REST_COOLDOWN_MS = 30_000;
const ENERGY_RESTORE_AMOUNT = 40;
exports.rest = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan untuk beristirahat.');
    }
    const uid = request.auth.uid;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
    const charPre = await charRef.get();
    if (!charPre.exists) {
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPre.data(), ['kontrakan_1', 'kontrakan_2', 'kontrakan_3', 'kontrakan_4', 'kontrakan_5'], 0, [], 'Mendekatlah ke salah satu kontrakan untuk istirahat.');
    const now = firestore_1.Timestamp.now();
    const nowMs = now.toMillis();
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, configDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(configRef),
        ]);
        if (!charDoc.exists || !statsDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        const statsData = statsDoc.data();
        if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
            throw new https_1.HttpsError('failed-precondition', 'Sedang dalam perjalanan kereta.');
        }
        const lastRestAt = statsData.lastRestAt;
        if (lastRestAt && nowMs - lastRestAt.toMillis() < REST_COOLDOWN_MS) {
            const waitSec = Math.ceil((REST_COOLDOWN_MS - (nowMs - lastRestAt.toMillis())) / 1000);
            throw new https_1.HttpsError('resource-exhausted', `Baru saja istirahat, tunggu ${waitSec} detik lagi.`);
        }
        const rates = configDoc.exists
            ? {
                hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.hungerDecayPerHour),
                thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.thirstDecayPerHour),
                energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? stats_1.DEFAULT_DECAY_RATES.energyDecayPerHour),
            }
            : stats_1.DEFAULT_DECAY_RATES;
        const currentStats = (0, stats_1.calculateLazyStats)({
            hunger: Number(statsData.hunger),
            thirst: Number(statsData.thirst),
            energy: Number(statsData.energy),
            health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
            hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
            mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
            lastCalculatedAtMs: statsData.lastCalculatedAt.toMillis(),
        }, nowMs, rates);
        const faintCheck = (0, phase2_1.applyFaintingOutcome)(tx, firebase_1.db, uid, currentStats, Number(charData.money), Number(charData.faintedCount || 0), nowMs);
        if (faintCheck.fainted) {
            tx.update(statsRef, {
                hunger: faintCheck.stats.hunger,
                thirst: faintCheck.stats.thirst,
                energy: faintCheck.stats.energy,
                health: faintCheck.stats.health,
                hygiene: faintCheck.stats.hygiene,
                mood: faintCheck.stats.mood,
                lastCalculatedAt: now,
            });
            return { fainted: true, stats: faintCheck.stats };
        }
        const newEnergy = Math.min(100, currentStats.energy + ENERGY_RESTORE_AMOUNT);
        const newMood = Math.min(100, currentStats.mood + 10);
        tx.update(charRef, {
            health: currentStats.health,
            hygiene: currentStats.hygiene,
            mood: newMood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: currentStats.hunger,
            thirst: currentStats.thirst,
            energy: newEnergy,
            health: currentStats.health,
            hygiene: currentStats.hygiene,
            mood: newMood,
            lastCalculatedAt: now,
            lastRestAt: now,
        });
        return {
            fainted: false,
            stats: {
                energy: newEnergy,
                hunger: currentStats.hunger,
                thirst: currentStats.thirst,
                health: currentStats.health,
                hygiene: currentStats.hygiene,
                mood: newMood,
            },
        };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=rest.js.map