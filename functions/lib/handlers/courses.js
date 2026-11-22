"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimCourse = exports.enrollCourse = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
exports.enrollCourse = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const courseId = typeof data?.courseId === 'string' ? data.courseId.trim() : '';
    const course = phase2_1.coursesConfig.courses.find((c) => c.id === courseId);
    if (!course) {
        throw new https_1.HttpsError('invalid-argument', 'Kursus tidak ditemukan.');
    }
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const charPre = await charRef.get();
    if (!charPre.exists) {
        throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== phase2_1.coursesConfig.schoolLocation.zone) {
        throw new https_1.HttpsError('failed-precondition', 'Balai Kursus berada di zona Cicalengka.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, ['sekolah'], 0, [], 'Mendekatlah ke Balai Kursus & Sekolah Cicalengka.');
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        if ((charData.currentZone || 'cicalengka') !== phase2_1.coursesConfig.schoolLocation.zone) {
            throw new https_1.HttpsError('failed-precondition', 'Balai Kursus berada di zona Cicalengka.');
        }
        if (charData.activeCourse) {
            throw new https_1.HttpsError('failed-precondition', 'Selesaikan atau klaim kursus aktif terlebih dahulu.');
        }
        const currentMoney = Number(charData.money);
        if (currentMoney < course.cost) {
            throw new https_1.HttpsError('failed-precondition', 'Saldo Rupiah tidak cukup untuk mendaftar kursus.');
        }
        const nextMoney = currentMoney - course.cost;
        const enrollmentId = `course_${nowMs}`;
        const completesAtMs = nowMs + course.durationSec * 1000;
        const activeCourse = {
            enrollmentId,
            courseId: course.id,
            title: course.title,
            skillKey: course.skillKey,
            skillGain: course.skillGain,
            startedAtMs: nowMs,
            completesAtMs,
        };
        tx.update(charRef, {
            money: nextMoney,
            activeCourse,
            updatedAt: now,
        });
        tx.set(charRef.collection('course_enrollments').doc(enrollmentId), {
            uid,
            courseId: course.id,
            skillKey: course.skillKey,
            skillGain: course.skillGain,
            cost: course.cost,
            startedAtMs: nowMs,
            completesAtMs,
            status: 'studying',
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'kursus',
            amount: course.cost,
            balanceAfter: nextMoney,
            description: `Daftar ${course.title}`,
            nowMs,
        });
        return { money: nextMoney, activeCourse };
    });
    return { ok: true, ...result };
});
exports.claimCourse = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const nowMs = Date.now();
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        const activeCourse = charData.activeCourse;
        if (!activeCourse) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak ada kursus aktif.');
        }
        if (nowMs < Number(activeCourse.completesAtMs)) {
            const waitSec = Math.ceil((Number(activeCourse.completesAtMs) - nowMs) / 1000);
            throw new https_1.HttpsError('failed-precondition', `Kursus masih berlangsung, selesai dalam ${waitSec} detik.`);
        }
        const skills = { ...phase2_1.DEFAULT_SKILLS, ...(charData.skills || {}) };
        const sk = String(activeCourse.skillKey);
        skills[sk] = (skills[sk] || 0) + Number(activeCourse.skillGain || 5);
        tx.update(charRef, {
            skills,
            activeCourse: null,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        tx.update(charRef.collection('course_enrollments').doc(String(activeCourse.enrollmentId)), { status: 'claimed' });
        return { skills };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=courses.js.map