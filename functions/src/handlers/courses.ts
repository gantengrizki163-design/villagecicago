import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { assertNearLocation } from '../helpers/location';
import { appendTransaction, coursesConfig, DEFAULT_SKILLS } from '../helpers/phase2';

export const enrollCourse = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as { courseId?: unknown };
    const courseId = typeof data?.courseId === 'string' ? data.courseId.trim() : '';

    const course = coursesConfig.courses.find((c) => c.id === courseId);
    if (!course) {
      throw new HttpsError('invalid-argument', 'Kursus tidak ditemukan.');
    }

    const charRef = db.collection('characters').doc(uid);
    const charPre = await charRef.get();
    if (!charPre.exists) {
      throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    const charPreData = charPre.data()!;
    if ((charPreData.currentZone || 'cicalengka') !== coursesConfig.schoolLocation.zone) {
      throw new HttpsError('failed-precondition', 'Balai Kursus berada di zona Cicalengka.');
    }
    await assertNearLocation(
      rtdb,
      uid,
      charPreData,
      ['sekolah'],
      0,
      [],
      'Mendekatlah ke Balai Kursus & Sekolah Cicalengka.'
    );

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);

    const result = await db.runTransaction(async (tx) => {
      const charDoc = await tx.get(charRef);
      if (!charDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      if ((charData.currentZone || 'cicalengka') !== coursesConfig.schoolLocation.zone) {
        throw new HttpsError('failed-precondition', 'Balai Kursus berada di zona Cicalengka.');
      }

      if (charData.activeCourse) {
        throw new HttpsError('failed-precondition', 'Selesaikan atau klaim kursus aktif terlebih dahulu.');
      }

      const currentMoney = Number(charData.money);
      if (currentMoney < course.cost) {
        throw new HttpsError('failed-precondition', 'Saldo Rupiah tidak cukup untuk mendaftar kursus.');
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

      appendTransaction(tx, db, uid, {
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
  }
);

export const claimCourse = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const charRef = db.collection('characters').doc(uid);
    const nowMs = Date.now();

    const result = await db.runTransaction(async (tx) => {
      const charDoc = await tx.get(charRef);
      if (!charDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      const activeCourse = charData.activeCourse;
      if (!activeCourse) {
        throw new HttpsError('failed-precondition', 'Tidak ada kursus aktif.');
      }

      if (nowMs < Number(activeCourse.completesAtMs)) {
        const waitSec = Math.ceil((Number(activeCourse.completesAtMs) - nowMs) / 1000);
        throw new HttpsError('failed-precondition', `Kursus masih berlangsung, selesai dalam ${waitSec} detik.`);
      }

      const skills = { ...DEFAULT_SKILLS, ...(charData.skills || {}) } as Record<string, number>;
      const sk = String(activeCourse.skillKey);
      skills[sk] = (skills[sk] || 0) + Number(activeCourse.skillGain || 5);

      tx.update(charRef, {
        skills,
        activeCourse: null,
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      tx.update(
        charRef.collection('course_enrollments').doc(String(activeCourse.enrollmentId)),
        { status: 'claimed' }
      );

      return { skills };
    });

    return { ok: true, ...result };
  }
);
