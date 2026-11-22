import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { assertNearLocation } from '../helpers/location';
import {
  appendTransaction,
  getDeterministicTrainState,
  trainScheduleConfig,
  type ZoneId,
} from '../helpers/phase2';

export const buyTicket = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as { destination?: unknown };
    const destination = typeof data?.destination === 'string' ? data.destination.trim() : '';

    const destCfg = trainScheduleConfig.destinations.find((d) => d.id === destination);
    if (!destCfg) {
      throw new HttpsError('invalid-argument', 'Tujuan kereta tidak valid.');
    }

    const charRef = db.collection('characters').doc(uid);
    const charPre = await charRef.get();
    if (!charPre.exists) {
      throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    const charPreData = charPre.data()!;
    const fromZonePre = (charPreData.currentZone || 'cicalengka') as ZoneId;
    const stationPre = trainScheduleConfig.stations[fromZonePre];
    const stationLocIds =
      fromZonePre === 'cicalengka' ? ['stasiun', 'loket_tiket'] : [`station_${fromZonePre}`];
    await assertNearLocation(
      rtdb,
      uid,
      charPreData,
      stationLocIds,
      0,
      [],
      `Mendekatlah ke ${stationPre.name}.`
    );

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);

    const result = await db.runTransaction(async (tx) => {
      const charDoc = await tx.get(charRef);
      if (!charDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }

      const charData = charDoc.data()!;
      const fromZone = (charData.currentZone || 'cicalengka') as ZoneId;
      if (fromZone === destination) {
        throw new HttpsError('failed-precondition', 'Kamu sudah berada di stasiun tujuan ini.');
      }
      if (charData.activeShift) {
        throw new HttpsError('failed-precondition', 'Selesaikan shift kerja sebelum naik kereta.');
      }
      if (charData.activeTrip) {
        throw new HttpsError('failed-precondition', 'Sudah ada perjalanan kereta aktif.');
      }

      const station = trainScheduleConfig.stations[fromZone];
      if (!station) {
        throw new HttpsError('failed-precondition', 'Stasiun asal tidak ditemukan.');
      }

      const trainState = getDeterministicTrainState(nowMs);
      if (!trainState.boardingOpen) {
        throw new HttpsError(
          'failed-precondition',
          `Kereta belum masuk peron. Tiba dalam ${trainState.nextBoardingInSec} detik.`
        );
      }

      const currentMoney = Number(charData.money);
      if (currentMoney < destCfg.ticketPrice) {
        throw new HttpsError('failed-precondition', 'Saldo tidak cukup untuk membeli tiket.');
      }

      const nextMoney = currentMoney - destCfg.ticketPrice;
      const ticketId = `ticket_${nowMs}`;
      const arrivesAtMs = nowMs + destCfg.travelDurationSec * 1000;

      const activeTrip = {
        ticketId,
        fromZone,
        toZone: destCfg.id,
        toLabel: destCfg.label,
        departedAtMs: nowMs,
        arrivesAtMs,
      };

      tx.update(charRef, {
        money: nextMoney,
        activeTrip,
        updatedAt: now,
      });

      tx.set(charRef.collection('tickets').doc(ticketId), {
        uid,
        fromZone,
        toZone: destCfg.id,
        price: destCfg.ticketPrice,
        departedAtMs: nowMs,
        arrivesAtMs,
        status: 'traveling',
      });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'kereta',
        amount: destCfg.ticketPrice,
        balanceAfter: nextMoney,
        description: `Tiket Kereta ${fromZone} -> ${destCfg.label}`,
        nowMs,
      });

      return { money: nextMoney, activeTrip };
    });

    return { ok: true, ...result };
  }
);

export const completeTrip = onCall(
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
      const activeTrip = charData.activeTrip;
      if (!activeTrip) {
        throw new HttpsError('failed-precondition', 'Tidak ada perjalanan kereta aktif.');
      }
      if (nowMs < Number(activeTrip.arrivesAtMs)) {
        const remain = Math.ceil((Number(activeTrip.arrivesAtMs) - nowMs) / 1000);
        throw new HttpsError('failed-precondition', `Kereta masih dalam perjalanan (${remain} detik lagi).`);
      }

      const toZone = String(activeTrip.toZone) as ZoneId;
      const destStation = trainScheduleConfig.stations[toZone];
      const arrivalPos = destStation.platformPos;

      tx.update(charRef, {
        currentZone: toZone,
        lastPosition: arrivalPos,
        activeTrip: null,
        updatedAt: Timestamp.fromMillis(nowMs),
      });

      tx.update(charRef.collection('tickets').doc(String(activeTrip.ticketId)), {
        status: 'arrived',
      });

      return { currentZone: toZone, lastPosition: arrivalPos };
    });

    return { ok: true, ...result };
  }
);
