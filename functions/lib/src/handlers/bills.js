"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payBill = exports.getBills = void 0;
exports.syncLazyBillsForUser = syncLazyBillsForUser;
exports.computeBillLateFee = computeBillLateFee;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const phase2_1 = require("../helpers/phase2");
/**
 * Menghasilkan tagihan mingguan (sewa kontrakan & listrik) secara lazy
 * berdasarkan jumlah periode yang terlewat sejak karakter dibuat.
 */
async function syncLazyBillsForUser(tx, firestore, uid, createdAtMs, lastBillPeriod, nowMs) {
    const cycleMs = phase2_1.economyConfig.billCycleMs;
    const elapsed = Math.max(0, nowMs - createdAtMs);
    const currentPeriod = Math.floor(elapsed / cycleMs);
    let createdCount = 0;
    if (currentPeriod > lastBillPeriod) {
        // Batasi max 4 periode per panggilan agar hemat biaya transaksi
        const startP = Math.max(lastBillPeriod + 1, currentPeriod - 3);
        for (let p = startP; p <= currentPeriod; p++) {
            const dueAtMs = createdAtMs + p * cycleMs;
            const rentRef = firestore.collection('characters').doc(uid).collection('bills').doc(`rent_p${p}`);
            const elecRef = firestore.collection('characters').doc(uid).collection('bills').doc(`elec_p${p}`);
            tx.set(rentRef, {
                uid,
                billType: 'rent',
                title: `Sewa Kontrakan Minggu ke-${p}`,
                periodIndex: p,
                baseAmount: phase2_1.economyConfig.rentBillAmount,
                lateFee: 0,
                status: 'unpaid',
                dueAtMs,
            });
            tx.set(elecRef, {
                uid,
                billType: 'electricity',
                title: `Tagihan Listrik Minggu ke-${p}`,
                periodIndex: p,
                baseAmount: phase2_1.economyConfig.electricityBillAmount,
                lateFee: 0,
                status: 'unpaid',
                dueAtMs,
            });
            createdCount += 2;
        }
        tx.update(firestore.collection('characters').doc(uid), {
            lastBillPeriod: currentPeriod,
            updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        });
    }
    return { currentPeriod, createdCount };
}
function computeBillLateFee(bill, nowMs) {
    if (bill.status === 'paid')
        return 0;
    if (nowMs <= bill.dueAtMs + phase2_1.economyConfig.billGraceMs)
        return 0;
    return bill.billType === 'rent'
        ? phase2_1.economyConfig.rentLatePenalty
        : phase2_1.economyConfig.electricityLatePenalty;
}
exports.getBills = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter belum ditemukan.');
        }
        const data = charDoc.data();
        const createdAtMs = data.createdAt instanceof firestore_1.Timestamp ? data.createdAt.toMillis() : nowMs;
        const lastPeriod = Number(data.lastBillPeriod || 0);
        await syncLazyBillsForUser(tx, firebase_1.db, uid, createdAtMs, lastPeriod, nowMs);
    });
    const billsSnap = await charRef
        .collection('bills')
        .where('uid', '==', uid)
        .orderBy('dueAtMs', 'asc')
        .limit(20)
        .get();
    const bills = billsSnap.docs.map((d) => {
        const b = d.data();
        const lateFee = computeBillLateFee({
            billType: String(b.billType),
            dueAtMs: Number(b.dueAtMs),
            status: String(b.status),
        }, nowMs);
        return {
            id: d.id,
            ...b,
            lateFee,
            totalDue: Number(b.baseAmount) + lateFee,
        };
    });
    return { ok: true, bills };
});
exports.payBill = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const billId = typeof data?.billId === 'string' ? data.billId.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(billId)) {
        throw new https_1.HttpsError('invalid-argument', 'ID tagihan tidak valid.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const statsRef = firebase_1.db.collection('character_stats').doc(uid);
    const billRef = charRef.collection('bills').doc(billId);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, billDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(billRef),
        ]);
        if (!charDoc.exists || !statsDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        }
        if (!billDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Tagihan tidak ditemukan.');
        }
        const billData = billDoc.data();
        if (billData.status === 'paid') {
            throw new https_1.HttpsError('failed-precondition', 'Tagihan ini sudah lunas.');
        }
        const lateFee = computeBillLateFee({
            billType: String(billData.billType),
            dueAtMs: Number(billData.dueAtMs),
            status: String(billData.status),
        }, nowMs);
        const totalDue = Number(billData.baseAmount) + lateFee;
        const currentMoney = Number(charDoc.data().money);
        if (currentMoney < totalDue) {
            throw new https_1.HttpsError('failed-precondition', `Saldo kurang! Butuh Rp ${totalDue.toLocaleString('id-ID')}.`);
        }
        const nextMoney = currentMoney - totalDue;
        const nextMood = Math.min(100, Number(statsDoc.data().mood ?? 80) + 5);
        tx.update(charRef, {
            money: nextMoney,
            mood: nextMood,
            updatedAt: now,
        });
        tx.update(statsRef, {
            mood: nextMood,
        });
        tx.update(billRef, {
            lateFee,
            status: 'paid',
            paidAtMs: nowMs,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'tagihan',
            amount: totalDue,
            balanceAfter: nextMoney,
            description: `Bayar ${String(billData.title)}${lateFee > 0 ? ' (+denda)' : ''}`,
            nowMs,
        });
        return { money: nextMoney, totalDue, title: String(billData.title) };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=bills.js.map