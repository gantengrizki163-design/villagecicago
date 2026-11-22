"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeTrip = exports.buyTicket = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const phase2_1 = require("../helpers/phase2");
const validation_1 = require("../helpers/validation");
exports.buyTicket = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const destination = typeof data?.destination === 'string' ? data.destination.trim() : '';
    const destCfg = phase2_1.trainScheduleConfig.destinations.find((d) => d.id === destination);
    if (!destCfg) {
        throw new https_1.HttpsError('invalid-argument', 'Tujuan kereta tidak valid.');
    }
    const rtdbSnap = await firebase_1.rtdb.ref(`players/${uid}`).get();
    const rtdbPos = rtdbSnap.exists() ? rtdbSnap.val() : null;
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        const charData = charDoc.data();
        const fromZone = (charData.currentZone || 'cicalengka');
        if (fromZone === destination) {
            throw new https_1.HttpsError('failed-precondition', 'Kamu sudah berada di stasiun tujuan ini.');
        }
        if (charData.activeShift) {
            throw new https_1.HttpsError('failed-precondition', 'Selesaikan shift kerja sebelum naik kereta.');
        }
        if (charData.activeTrip) {
            throw new https_1.HttpsError('failed-precondition', 'Sudah ada perjalanan kereta aktif.');
        }
        const station = phase2_1.trainScheduleConfig.stations[fromZone];
        const px = typeof rtdbPos?.x === 'number' ? rtdbPos.x : charData.lastPosition?.x ?? 999;
        const pz = typeof rtdbPos?.z === 'number' ? rtdbPos.z : charData.lastPosition?.z ?? 999;
        const nearPlatform = (0, validation_1.distance2D)(px, pz, station.ticketBooth.x, station.ticketBooth.z) <= validation_1.INTERACT_RADIUS_METERS + 5 ||
            (0, validation_1.distance2D)(px, pz, station.platformPos.x, station.platformPos.z) <= validation_1.INTERACT_RADIUS_METERS + 5;
        if (!nearPlatform) {
            throw new https_1.HttpsError('failed-precondition', `Mendekatlah ke ${station.name}.`);
        }
        const trainState = (0, phase2_1.getDeterministicTrainState)(nowMs);
        if (!trainState.boardingOpen) {
            throw new https_1.HttpsError('failed-precondition', `Kereta belum masuk peron. Tiba dalam ${trainState.nextBoardingInSec} detik.`);
        }
        const currentMoney = Number(charData.money);
        if (currentMoney < destCfg.ticketPrice) {
            throw new https_1.HttpsError('failed-precondition', 'Saldo tidak cukup untuk membeli tiket.');
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
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
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
});
exports.completeTrip = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
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
        const activeTrip = charData.activeTrip;
        if (!activeTrip) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak ada perjalanan kereta aktif.');
        }
        if (nowMs < Number(activeTrip.arrivesAtMs)) {
            const remain = Math.ceil((Number(activeTrip.arrivesAtMs) - nowMs) / 1000);
            throw new https_1.HttpsError('failed-precondition', `Kereta masih dalam perjalanan (${remain} detik lagi).`);
        }
        const toZone = String(activeTrip.toZone);
        const destStation = phase2_1.trainScheduleConfig.stations[toZone];
        const arrivalPos = destStation.platformPos;
        tx.update(charRef, {
            currentZone: toZone,
            lastPosition: arrivalPos,
            activeTrip: null,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
        tx.update(charRef.collection('tickets').doc(String(activeTrip.ticketId)), {
            status: 'arrived',
        });
        return { currentZone: toZone, lastPosition: arrivalPos };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=train.js.map