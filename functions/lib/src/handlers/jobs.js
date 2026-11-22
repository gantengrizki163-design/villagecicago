"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endShift = exports.startShift = exports.resignJob = exports.applyJob = void 0;
exports.evaluateLazyDismissal = evaluateLazyDismissal;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const phase2_1 = require("../helpers/phase2");
const stats_1 = require("../helpers/stats");
const validation_1 = require("../helpers/validation");
/**
 * Cek pemecatan secara lazy berdasarkan jarak waktu sejak shift terakhir / diterima kerja.
 */
function evaluateLazyDismissal(tx, firestore, uid, charData, nowMs) {
    const currentJob = charData.currentJob;
    if (!currentJob)
        return { fired: false, missedShifts: 0 };
    const lastWorkMs = Number(currentJob.lastShiftAtMs || currentJob.hiredAtMs || nowMs);
    const elapsed = Math.max(0, nowMs - lastWorkMs);
    const missed = Math.floor(elapsed / phase2_1.economyConfig.expectedShiftIntervalMs);
    if (missed >= phase2_1.economyConfig.maxMissedShiftsBeforeFiring) {
        tx.update(firestore.collection('characters').doc(uid), {
            currentJob: null,
            activeShift: null,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        if (currentJob.employmentId) {
            tx.update(firestore.collection('characters').doc(uid).collection('employments').doc(String(currentJob.employmentId)), {
                status: 'fired',
                endedAtMs: nowMs,
                reason: `Bolos kerja ${missed} periode berturut-turut`,
            });
        }
        return { fired: true, missedShifts: missed };
    }
    return { fired: false, missedShifts: missed };
}
exports.applyJob = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const jobId = typeof data?.jobId === 'string' ? data.jobId.trim() : '';
    const job = phase2_1.jobsConfig.jobs.find((j) => j.id === jobId);
    if (!job) {
        throw new https_1.HttpsError('invalid-argument', 'Lowongan pekerjaan tidak ditemukan.');
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter belum dibuat.');
        }
        const charData = charDoc.data();
        const dismissal = evaluateLazyDismissal(tx, firebase_1.db, uid, charData, nowMs);
        const effectiveJob = dismissal.fired ? null : charData.currentJob;
        if (effectiveJob) {
            throw new https_1.HttpsError('failed-precondition', `Kamu masih bekerja sebagai ${String(effectiveJob.title)}. Resign dulu jika ingin pindah.`);
        }
        const skills = { ...phase2_1.DEFAULT_SKILLS, ...(charData.skills || {}) };
        const reqSkills = job.requiredSkills;
        for (const [key, minVal] of Object.entries(reqSkills)) {
            if ((skills[key] || 0) < minVal) {
                throw new https_1.HttpsError('failed-precondition', `Skill ${key} minimal ${minVal} (saat ini ${skills[key] || 0}). Ikuti kursus dulu.`);
            }
        }
        const employmentId = `emp_${nowMs}`;
        const newJob = {
            employmentId,
            jobId: job.id,
            title: job.title,
            employer: job.employer,
            rankIndex: 0,
            rankTitle: job.ranks[0].title,
            totalWorkSeconds: 0,
            shiftsCompleted: 0,
            hiredAtMs: nowMs,
            lastShiftAtMs: nowMs,
        };
        tx.update(charRef, {
            currentJob: newJob,
            updatedAt: now,
        });
        tx.set(charRef.collection('employments').doc(employmentId), {
            uid,
            jobId: job.id,
            title: job.title,
            status: 'active',
            hiredAtMs: nowMs,
        });
        return { currentJob: newJob };
    });
    return { ok: true, ...result };
});
exports.resignJob = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const nowMs = Date.now();
    await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        if (!charData.currentJob) {
            throw new https_1.HttpsError('failed-precondition', 'Kamu sedang tidak terikat pekerjaan.');
        }
        if (charData.activeShift) {
            throw new https_1.HttpsError('failed-precondition', 'Selesaikan shift aktif terlebih dahulu.');
        }
        const empId = charData.currentJob.employmentId;
        tx.update(charRef, {
            currentJob: null,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        if (empId) {
            tx.update(charRef.collection('employments').doc(String(empId)), {
                status: 'resigned',
                endedAtMs: nowMs,
                reason: 'Mengundurkan diri',
            });
        }
    });
    return { ok: true };
});
exports.startShift = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const rtdbSnap = await firebase_1.rtdb.ref(`players/${uid}`).get();
    const rtdbPos = rtdbSnap.exists() ? rtdbSnap.val() : null;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
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
            throw new https_1.HttpsError('failed-precondition', 'Sedang dalam perjalanan kereta.');
        }
        const dismissal = evaluateLazyDismissal(tx, firebase_1.db, uid, charData, nowMs);
        if (dismissal.fired) {
            return { fired: true, missedShifts: dismissal.missedShifts };
        }
        const currentJob = charData.currentJob;
        if (!currentJob) {
            throw new https_1.HttpsError('failed-precondition', 'Lamar pekerjaan terlebih dahulu.');
        }
        if (charData.activeShift) {
            throw new https_1.HttpsError('failed-precondition', 'Shift kerja sudah aktif.');
        }
        const job = phase2_1.jobsConfig.jobs.find((j) => j.id === currentJob.jobId);
        if (!job) {
            throw new https_1.HttpsError('not-found', 'Data konfigurasi pekerjaan tidak valid.');
        }
        const currentZone = charData.currentZone || 'cicalengka';
        if (currentZone !== job.zone) {
            throw new https_1.HttpsError('failed-precondition', `Pekerjaan ini berada di zona ${job.zone.toUpperCase()}. Naik kereta dari Stasiun dulu.`);
        }
        const px = typeof rtdbPos?.x === 'number' ? rtdbPos.x : charData.lastPosition?.x ?? 999;
        const pz = typeof rtdbPos?.z === 'number' ? rtdbPos.z : charData.lastPosition?.z ?? 999;
        if ((0, validation_1.distance2D)(px, pz, job.location.x, job.location.z) > validation_1.INTERACT_RADIUS_METERS + 3) {
            throw new https_1.HttpsError('failed-precondition', `Mendekatlah ke ${job.location.label}.`);
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
            tx.update(statsRef, { ...faintCheck.stats, lastCalculatedAt: now });
            return { fainted: true };
        }
        if (currentStats.energy < job.energyCost) {
            throw new https_1.HttpsError('failed-precondition', `Energi tidak cukup (butuh ${job.energyCost}%, tersisa ${Math.round(currentStats.energy)}%). Istirahat atau makan dulu.`);
        }
        const shiftId = `shift_${nowMs}`;
        const { prompt, secret } = (0, phase2_1.generateServerMiniGameTask)(job.id);
        const minDurationMs = job.minDurationSec * 1000;
        const activeShift = {
            shiftId,
            jobId: job.id,
            jobTitle: job.title,
            startedAtMs: nowMs,
            minDurationMs,
            taskPrompt: prompt,
        };
        tx.update(charRef, {
            activeShift,
            health: currentStats.health,
            hygiene: currentStats.hygiene,
            mood: currentStats.mood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: currentStats.hunger,
            thirst: currentStats.thirst,
            energy: currentStats.energy,
            health: currentStats.health,
            hygiene: currentStats.hygiene,
            mood: currentStats.mood,
            lastCalculatedAt: now,
        });
        tx.set(charRef.collection('shifts').doc(shiftId), {
            uid,
            jobId: job.id,
            status: 'active',
            startedAtMs: nowMs,
        });
        // Simpan kunci jawaban di subkoleksi server-only
        tx.set(charRef.collection('shift_secrets').doc(shiftId), {
            uid,
            answers: secret,
        });
        return { fired: false, fainted: false, activeShift };
    });
    return { ok: true, ...result };
});
exports.endShift = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const submission = (request.data || {});
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const configRef = firebase_1.db.collection('config').doc('game');
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
        const activeShift = charData.activeShift;
        if (!activeShift) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak ada shift aktif.');
        }
        const shiftId = String(activeShift.shiftId);
        const shiftRef = charRef.collection('shifts').doc(shiftId);
        const secretRef = charRef.collection('shift_secrets').doc(shiftId);
        const [shiftDoc, secretDoc] = await Promise.all([tx.get(shiftRef), tx.get(secretRef)]);
        if (!shiftDoc.exists || shiftDoc.data()?.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Shift sudah selesai atau tidak valid.');
        }
        const startedAtMs = Number(activeShift.startedAtMs);
        const minDurationMs = Number(activeShift.minDurationMs || 20000);
        if (nowMs - startedAtMs < minDurationMs) {
            const waitSec = Math.ceil((minDurationMs - (nowMs - startedAtMs)) / 1000);
            throw new https_1.HttpsError('failed-precondition', `Durasi minimal shift belum tercapai, tunggu ${waitSec} detik lagi.`);
        }
        const job = phase2_1.jobsConfig.jobs.find((j) => j.id === String(activeShift.jobId));
        if (!job) {
            throw new https_1.HttpsError('not-found', 'Konfigurasi pekerjaan tidak valid.');
        }
        const secret = secretDoc.exists ? secretDoc.data()?.answers : {};
        const score = (0, phase2_1.gradeServerMiniGameTask)(job.id, secret, submission);
        const currentJob = charData.currentJob || { totalWorkSeconds: 0, shiftsCompleted: 0 };
        const workedSec = Math.min(1800, Math.round((nowMs - startedAtMs) / 1000));
        const newTotalSec = Number(currentJob.totalWorkSeconds || 0) + workedSec;
        const rankInfo = (0, phase2_1.computeRankForJob)(job.id, newTotalSec);
        // Gaji dihitung server: 50% dasar + 50% performa mini-game, dikali pengali jabatan
        const perfFactor = 0.5 + 0.5 * (score / 100);
        const payEarned = Math.round(job.basePay * rankInfo.payMultiplier * perfFactor);
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
        const nextEnergy = Math.max(0, currentStats.energy - job.energyCost);
        const nextHygiene = Math.max(0, currentStats.hygiene - job.hygieneCost);
        const nextMood = Math.max(0, Math.min(100, currentStats.mood + (score >= 70 ? 4 : -6)));
        const nextSkills = { ...phase2_1.DEFAULT_SKILLS, ...(charData.skills || {}) };
        for (const [sk, gain] of Object.entries(job.skillGain)) {
            nextSkills[sk] = (nextSkills[sk] || 0) + gain;
        }
        const nextMoney = Number(charData.money) + payEarned;
        const updatedJob = {
            ...currentJob,
            rankIndex: rankInfo.rankIndex,
            rankTitle: rankInfo.title,
            totalWorkSeconds: newTotalSec,
            shiftsCompleted: Number(currentJob.shiftsCompleted || 0) + 1,
            lastShiftAtMs: nowMs,
        };
        tx.update(charRef, {
            money: nextMoney,
            skills: nextSkills,
            currentJob: updatedJob,
            activeShift: null,
            health: currentStats.health,
            hygiene: nextHygiene,
            mood: nextMood,
            statsUpdatedAt: now,
            updatedAt: now,
        });
        tx.update(statsRef, {
            hunger: currentStats.hunger,
            thirst: currentStats.thirst,
            energy: nextEnergy,
            health: currentStats.health,
            hygiene: nextHygiene,
            mood: nextMood,
            lastCalculatedAt: now,
        });
        tx.update(shiftRef, {
            status: 'completed',
            endedAtMs: nowMs,
            score,
            payEarned,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'income',
            category: 'gaji',
            amount: payEarned,
            balanceAfter: nextMoney,
            description: `Gaji shift ${job.title} (Skor ${score}%)`,
            nowMs,
        });
        return {
            money: nextMoney,
            payEarned,
            score,
            rankTitle: rankInfo.title,
            skills: nextSkills,
        };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=jobs.js.map