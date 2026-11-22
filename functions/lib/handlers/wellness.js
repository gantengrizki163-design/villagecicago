"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimClinic = exports.visitClinic = exports.takeBath = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
const stats_1 = require("../helpers/stats");
exports.takeBath = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan untuk mandi.');
    }
    const uid = request.auth.uid;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
    const charPre = await charRef.get();
    if (!charPre.exists) {
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPre.data(), ['bath_mck', 'kontrakan_1', 'kontrakan_2', 'kontrakan_3', 'kontrakan_4', 'kontrakan_5'], 0, [], 'Mendekatlah ke Kontrakan atau Kamar Mandi Umum Alun-Alun.');
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
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
            throw new https_1.HttpsError('failed-precondition', 'Tidak bisa mandi saat naik kereta.');
        }
        const lastBathAt = statsData.lastBathAt;
        const cooldownMs = phase2_1.economyConfig.bathCooldownSec * 1000;
        if (lastBathAt && nowMs - lastBathAt.toMillis() < cooldownMs) {
            const wait = Math.ceil((cooldownMs - (nowMs - lastBathAt.toMillis())) / 1000);
            throw new https_1.HttpsError('resource-exhausted', `Baru saja mandi, tunggu ${wait} detik lagi.`);
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
        }, nowMs, rates, { isHomeless: Boolean(charData.homeless) });
        const faintCheck = (0, phase2_1.applyFaintingOutcome)(tx, firebase_1.db, uid, currentStats, Number(charData.money), Number(charData.faintedCount || 0), nowMs);
        if (faintCheck.fainted) {
            tx.update(statsRef, {
                ...faintCheck.stats,
                lastCalculatedAt: now,
            });
            return { fainted: true, stats: faintCheck.stats };
        }
        const nextHygiene = Math.min(100, currentStats.hygiene + phase2_1.economyConfig.bathHygieneRestore);
        const nextMood = Math.min(100, currentStats.mood + phase2_1.economyConfig.bathMoodRestore);
        tx.update(charRef, {
            health: currentStats.health,
            hygiene: nextHygiene,
            mood: nextMood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: currentStats.hunger,
            thirst: currentStats.thirst,
            energy: currentStats.energy,
            health: currentStats.health,
            hygiene: nextHygiene,
            mood: nextMood,
            lastCalculatedAt: now,
            lastBathAt: now,
        });
        return {
            fainted: false,
            hygiene: nextHygiene,
            mood: nextMood,
        };
    });
    return { ok: true, ...result };
});
exports.visitClinic = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const clinicId = typeof data?.clinicId === 'string' ? data.clinicId.trim() : '';
    const packageId = typeof data?.packageId === 'string' ? data.packageId.trim() : '';
    const clinic = phase2_1.clinicConfig.clinics.find((c) => c.id === clinicId);
    const pkg = clinic?.packages.find((p) => p.id === packageId);
    if (!clinic || !pkg) {
        throw new https_1.HttpsError('invalid-argument', 'Klinik atau paket perawatan tidak valid.');
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const charPre = await charRef.get();
    if (!charPre.exists) {
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== clinic.zone) {
        throw new https_1.HttpsError('failed-precondition', 'Kamu harus berada di Cicalengka untuk ke klinik.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, [clinic.id], 0, [], `Mendekatlah ke ${clinic.name}.`);
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        if ((charData.currentZone || 'cicalengka') !== clinic.zone) {
            throw new https_1.HttpsError('failed-precondition', 'Kamu harus berada di Cicalengka untuk ke klinik.');
        }
        if (charData.activeClinic && nowMs < Number(charData.activeClinic.completesAtMs || 0)) {
            throw new https_1.HttpsError('failed-precondition', 'Sedang menunggu giliran perawatan klinik.');
        }
        const currentMoney = Number(charData.money);
        if (currentMoney < pkg.cost) {
            throw new https_1.HttpsError('failed-precondition', 'Saldo Rupiah tidak mencukupi.');
        }
        const nextMoney = currentMoney - pkg.cost;
        const completesAtMs = nowMs + pkg.waitSec * 1000;
        const visitId = `clinic_${nowMs}`;
        const activeClinic = {
            visitId,
            clinicId: clinic.id,
            clinicName: clinic.name,
            packageId: pkg.id,
            packageName: pkg.name,
            startedAtMs: nowMs,
            completesAtMs,
            healthRestore: pkg.healthRestore,
            moodRestore: pkg.moodRestore,
        };
        tx.update(charRef, {
            money: nextMoney,
            activeClinic,
            updatedAt: now,
        });
        tx.set(charRef.collection('clinic_visits').doc(visitId), {
            uid,
            clinicId: clinic.id,
            packageId: pkg.id,
            cost: pkg.cost,
            startedAtMs: nowMs,
            completesAtMs,
            status: 'waiting',
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'klinik',
            amount: pkg.cost,
            balanceAfter: nextMoney,
            description: `${pkg.name} di ${clinic.name}`,
            nowMs,
        });
        return { money: nextMoney, activeClinic };
    });
    return { ok: true, ...result };
});
exports.claimClinic = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc] = await Promise.all([tx.get(charRef), tx.get(statsRef)]);
        if (!charDoc.exists || !statsDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        const statsData = statsDoc.data();
        const activeClinic = charData.activeClinic;
        if (!activeClinic) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak ada antrean klinik aktif.');
        }
        if (nowMs < Number(activeClinic.completesAtMs)) {
            const remain = Math.ceil((Number(activeClinic.completesAtMs) - nowMs) / 1000);
            throw new https_1.HttpsError('failed-precondition', `Antrean belum selesai, tunggu ${remain} detik.`);
        }
        const baseHealth = typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100);
        const baseMood = typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80);
        const nextHealth = Math.min(100, baseHealth + Number(activeClinic.healthRestore || 25));
        const nextMood = Math.min(100, baseMood + Number(activeClinic.moodRestore || 5));
        tx.update(charRef, {
            health: nextHealth,
            mood: nextMood,
            activeClinic: null,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            health: nextHealth,
            mood: nextMood,
            lastCalculatedAt: now,
        });
        tx.update(charRef.collection('clinic_visits').doc(String(activeClinic.visitId)), {
            status: 'claimed',
        });
        return { health: nextHealth, mood: nextMood };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=wellness.js.map