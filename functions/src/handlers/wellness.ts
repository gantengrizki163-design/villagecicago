import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { assertNearLocation } from '../helpers/location';
import {
  appendTransaction,
  applyFaintingOutcome,
  clinicConfig,
  economyConfig,
} from '../helpers/phase2';
import { calculateLazyStats, DEFAULT_DECAY_RATES } from '../helpers/stats';

export const takeBath = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan untuk mandi.');
    }

    const uid = request.auth.uid;
    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const configRef = db.collection('config').doc('game');

    const charPre = await charRef.get();
    if (!charPre.exists) {
      throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    await assertNearLocation(
      rtdb,
      uid,
      charPre.data()!,
      ['bath_mck', 'kontrakan_1', 'kontrakan_2', 'kontrakan_3', 'kontrakan_4', 'kontrakan_5'],
      0,
      [],
      'Mendekatlah ke Kontrakan atau Kamar Mandi Umum Alun-Alun.'
    );

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, statsDoc, configDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(statsRef),
        tx.get(configRef),
      ]);

      if (!charDoc.exists || !statsDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      const statsData = statsDoc.data()!;

      if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
        throw new HttpsError('failed-precondition', 'Tidak bisa mandi saat naik kereta.');
      }

      const lastBathAt = statsData.lastBathAt as Timestamp | undefined;
      const cooldownMs = economyConfig.bathCooldownSec * 1000;
      if (lastBathAt && nowMs - lastBathAt.toMillis() < cooldownMs) {
        const wait = Math.ceil((cooldownMs - (nowMs - lastBathAt.toMillis())) / 1000);
        throw new HttpsError('resource-exhausted', `Baru saja mandi, tunggu ${wait} detik lagi.`);
      }

      const rates = configDoc.exists
        ? {
            hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? DEFAULT_DECAY_RATES.hungerDecayPerHour),
            thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? DEFAULT_DECAY_RATES.thirstDecayPerHour),
            energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? DEFAULT_DECAY_RATES.energyDecayPerHour),
          }
        : DEFAULT_DECAY_RATES;

      const currentStats = calculateLazyStats(
        {
          hunger: Number(statsData.hunger),
          thirst: Number(statsData.thirst),
          energy: Number(statsData.energy),
          health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
          hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
          mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
          lastCalculatedAtMs: (statsData.lastCalculatedAt as Timestamp).toMillis(),
        },
        nowMs,
        rates,
        { isHomeless: Boolean(charData.homeless) }
      );

      const faintCheck = applyFaintingOutcome(
        tx,
        db,
        uid,
        currentStats,
        Number(charData.money),
        Number(charData.faintedCount || 0),
        nowMs
      );
      if (faintCheck.fainted) {
        tx.update(statsRef, {
          ...faintCheck.stats,
          lastCalculatedAt: now,
        });
        return { fainted: true, stats: faintCheck.stats };
      }

      const nextHygiene = Math.min(100, currentStats.hygiene + economyConfig.bathHygieneRestore);
      const nextMood = Math.min(100, currentStats.mood + economyConfig.bathMoodRestore);

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
  }
);

export const visitClinic = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as { clinicId?: unknown; packageId?: unknown };
    const clinicId = typeof data?.clinicId === 'string' ? data.clinicId.trim() : '';
    const packageId = typeof data?.packageId === 'string' ? data.packageId.trim() : '';

    const clinic = clinicConfig.clinics.find((c) => c.id === clinicId);
    const pkg = clinic?.packages.find((p) => p.id === packageId);
    if (!clinic || !pkg) {
      throw new HttpsError('invalid-argument', 'Klinik atau paket perawatan tidak valid.');
    }

    const charRef = db.collection('characters').doc(uid);
    const charPre = await charRef.get();
    if (!charPre.exists) {
      throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    const charPreData = charPre.data()!;
    if ((charPreData.currentZone || 'cicalengka') !== clinic.zone) {
      throw new HttpsError('failed-precondition', 'Kamu harus berada di Cicalengka untuk ke klinik.');
    }
    await assertNearLocation(
      rtdb,
      uid,
      charPreData,
      [clinic.id],
      0,
      [],
      `Mendekatlah ke ${clinic.name}.`
    );

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);

    const result = await db.runTransaction(async (tx) => {
      const charDoc = await tx.get(charRef);
      if (!charDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      if ((charData.currentZone || 'cicalengka') !== clinic.zone) {
        throw new HttpsError('failed-precondition', 'Kamu harus berada di Cicalengka untuk ke klinik.');
      }

      if (charData.activeClinic && nowMs < Number(charData.activeClinic.completesAtMs || 0)) {
        throw new HttpsError('failed-precondition', 'Sedang menunggu giliran perawatan klinik.');
      }

      const currentMoney = Number(charData.money);
      if (currentMoney < pkg.cost) {
        throw new HttpsError('failed-precondition', 'Saldo Rupiah tidak mencukupi.');
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

      appendTransaction(tx, db, uid, {
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
  }
);

export const claimClinic = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, statsDoc] = await Promise.all([tx.get(charRef), tx.get(statsRef)]);
      if (!charDoc.exists || !statsDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      const statsData = statsDoc.data()!;
      const activeClinic = charData.activeClinic;
      if (!activeClinic) {
        throw new HttpsError('failed-precondition', 'Tidak ada antrean klinik aktif.');
      }
      if (nowMs < Number(activeClinic.completesAtMs)) {
        const remain = Math.ceil((Number(activeClinic.completesAtMs) - nowMs) / 1000);
        throw new HttpsError('failed-precondition', `Antrean belum selesai, tunggu ${remain} detik.`);
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
  }
);
