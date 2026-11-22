"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payBill = exports.getBills = void 0;
exports.syncLazyBillsForUser = syncLazyBillsForUser;
exports.computeBillLateFee = computeBillLateFee;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const bank_1 = require("../helpers/bank");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const law_1 = require("../helpers/law");
const ledger_1 = require("../helpers/ledger");
const phase2_1 = require("../helpers/phase2");
const propertyAdvanced_1 = require("../helpers/propertyAdvanced");
const vehicles_1 = require("../helpers/vehicles");
const security_1 = require("./security");
/**
 * Menghasilkan tagihan mingguan dasar (Fase 2) secara lazy bagi pemain tanpa kontrak sewa khusus,
 * sementara kontrak sewa Fase 3 menghasilkan tagihan sewa, utilitas & PBB lewat syncLazyHousingState.
 */
async function syncLazyBillsForUser(tx, firestore, uid, createdAtMs, lastBillPeriod, nowMs, hasActiveHousingLease = false) {
    const cycleMs = phase2_1.economyConfig.billCycleMs;
    const elapsed = Math.max(0, nowMs - createdAtMs);
    const currentPeriod = Math.floor(elapsed / cycleMs);
    let createdCount = 0;
    if (currentPeriod > lastBillPeriod) {
        // Jika sudah terikat kontrak sewa Fase 3, jangan gandakan tagihan sewa Fase 2 lama
        if (!hasActiveHousingLease) {
            const startP = Math.max(lastBillPeriod + 1, currentPeriod - 3);
            for (let p = startP; p <= currentPeriod; p++) {
                const dueAtMs = createdAtMs + p * cycleMs;
                const elecRef = firestore.collection('characters').doc(uid).collection('bills').doc(`elec_p${p}`);
                tx.set(elecRef, {
                    uid,
                    billType: 'electricity',
                    title: `Tagihan Listrik Dasar Minggu ke-${p}`,
                    periodIndex: p,
                    baseAmount: phase2_1.economyConfig.electricityBillAmount,
                    lateFee: 0,
                    status: 'unpaid',
                    dueAtMs,
                });
                createdCount += 1;
            }
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
    if (bill.billType === 'mortgage_installment' || bill.mortgageId) {
        return Math.round(Number(bill.baseAmount || 20000) * propertyAdvanced_1.mortgageConfig.lateFeeRate);
    }
    if (bill.billType === 'vehicle_lease_installment') {
        return Math.round(Number(bill.baseAmount || 20000) * vehicles_1.dealerConfig.leasing.lateFeeRate);
    }
    if (bill.billType === 'vehicle_tax') {
        return Math.round(Number(bill.baseAmount || 15000) * vehicles_1.vehiclesConfig.stnkLatePenaltyRate);
    }
    if (bill.billType === 'vehicle_ticket_fine') {
        return Math.round(Number(bill.baseAmount || 25000) * 0.1);
    }
    if (bill.billType === 'security_fee' || bill.billType === 'insurance_premium' || bill.billType === 'fine') {
        return Math.round(Number(bill.baseAmount || 10000) * 0.1);
    }
    if (bill.leaseId || bill.billType === 'water' || bill.billType === 'internet' || bill.billType === 'property_tax') {
        return Math.round(Number(bill.baseAmount || 20000) * phase2_1.housingConfig.leaseSettings.lateFeeRate);
    }
    return bill.billType === 'rent'
        ? phase2_1.economyConfig.rentLatePenalty
        : phase2_1.economyConfig.electricityLatePenalty;
}
exports.getBills = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    await Promise.all([(0, law_1.ensurePhase6Configs)(), (0, vehicles_1.ensureVehicleConfigs)()]);
    const uid = request.auth.uid;
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    await Promise.all([
        (0, housing_1.syncLazyHousingState)(firebase_1.db, uid, nowMs),
        (0, bank_1.syncLazyLoanInstallments)(firebase_1.db, uid, nowMs),
        (0, propertyAdvanced_1.syncLazyMortgageAndConstructionState)(firebase_1.db, uid, nowMs),
        (0, security_1.syncLazySecurityAndInsurance)(firebase_1.db, uid, nowMs),
        (0, vehicles_1.syncLazyVehicleState)(firebase_1.db, uid, nowMs),
    ]);
    await firebase_1.db.runTransaction(async (tx) => {
        const charDoc = await tx.get(charRef);
        if (!charDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter belum ditemukan.');
        }
        const data = charDoc.data();
        const createdAtMs = data.createdAt instanceof firestore_1.Timestamp ? data.createdAt.toMillis() : nowMs;
        const lastPeriod = Number(data.lastBillPeriod || 0);
        await syncLazyBillsForUser(tx, firebase_1.db, uid, createdAtMs, lastPeriod, nowMs, Boolean(data.activeLeaseId));
    });
    const billsSnap = await charRef
        .collection('bills')
        .where('uid', '==', uid)
        .orderBy('dueAtMs', 'asc')
        .limit(30)
        .get();
    const bills = billsSnap.docs.map((d) => {
        const b = d.data();
        const lateFee = computeBillLateFee({
            billType: String(b.billType),
            baseAmount: Number(b.baseAmount),
            leaseId: typeof b.leaseId === 'string' ? b.leaseId : undefined,
            mortgageId: typeof b.mortgageId === 'string' ? b.mortgageId : undefined,
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
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, statsDoc, billDoc, accDoc, treasuryDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(statsRef),
            tx.get(billRef),
            tx.get(accRef),
            tx.get(treasuryRef),
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
        const leaseId = typeof billData.leaseId === 'string' ? billData.leaseId : null;
        const loanId = typeof billData.loanId === 'string' ? billData.loanId : null;
        const mortgageId = typeof billData.mortgageId === 'string' ? billData.mortgageId : null;
        const vehicleLeaseId = typeof billData.vehicleLeaseId === 'string' ? billData.vehicleLeaseId : null;
        const billVehicleId = typeof billData.vehicleId === 'string' ? billData.vehicleId : null;
        const leaseRef = leaseId ? firebase_1.db.collection('leases').doc(leaseId) : null;
        const loanRef = loanId ? firebase_1.db.collection('loans').doc(loanId) : null;
        const mortRef = mortgageId ? firebase_1.db.collection('mortgages').doc(mortgageId) : null;
        const vLeaseRef = vehicleLeaseId ? firebase_1.db.collection('vehicle_leases').doc(vehicleLeaseId) : null;
        const billVehRef = billVehicleId ? firebase_1.db.collection('vehicles').doc(billVehicleId) : null;
        const [leaseDoc, loanDoc, mortDoc, vLeaseDoc, billVehDoc] = await Promise.all([
            leaseRef ? tx.get(leaseRef) : Promise.resolve(null),
            loanRef ? tx.get(loanRef) : Promise.resolve(null),
            mortRef ? tx.get(mortRef) : Promise.resolve(null),
            vLeaseRef ? tx.get(vLeaseRef) : Promise.resolve(null),
            billVehRef ? tx.get(billVehRef) : Promise.resolve(null),
        ]);
        const mortPropRef = mortDoc?.exists && typeof mortDoc.data()?.propertyId === 'string'
            ? firebase_1.db.collection('properties').doc(String(mortDoc.data().propertyId))
            : null;
        const mortPropDoc = mortPropRef ? await tx.get(mortPropRef) : null;
        const ownerId = leaseDoc?.exists && leaseDoc.data()?.ownerType === 'player'
            ? String(leaseDoc.data().ownerId)
            : null;
        const ownerRef = ownerId && ownerId !== uid ? firebase_1.db.collection('characters').doc(ownerId) : null;
        const ownerDoc = ownerRef ? await tx.get(ownerRef) : null;
        const lateFee = computeBillLateFee({
            billType: String(billData.billType),
            baseAmount: Number(billData.baseAmount),
            leaseId: leaseId ?? undefined,
            mortgageId: mortgageId ?? undefined,
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
        const curScore = Number(accDoc.exists
            ? accDoc.data().creditScore
            : charDoc.data().creditScore ?? bank_1.bankConfig.creditScore.defaultScore);
        let nextScore = curScore;
        if (billData.billType === 'rent' && ownerDoc?.exists && ownerRef && ownerId) {
            const tax = Math.round(totalDue * phase2_1.housingConfig.leaseSettings.rentalIncomeTaxRate);
            const netIncome = Math.max(0, totalDue - tax);
            const ownerNextMoney = Number(ownerDoc.data().money || 0) + netIncome;
            tx.update(ownerRef, { money: ownerNextMoney, updatedAt: now });
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, ownerId, {
                type: 'income',
                category: 'sewa_properti',
                amount: netIncome,
                balanceAfter: ownerNextMoney,
                description: `Penerimaan ${String(billData.title)} (potong pajak 5%)`,
                nowMs,
            });
            if (tax > 0) {
                (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, tax, 'property', nowMs);
                (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                    from: ownerId,
                    to: 'system:treasury',
                    amount: tax,
                    taxAmount: tax,
                    reason: 'property_rental_bill_tax',
                    refId: billId,
                    nowMs,
                });
            }
        }
        else if (billData.billType === 'property_tax') {
            (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, totalDue, 'property', nowMs);
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: uid,
                to: 'system:treasury',
                amount: totalDue,
                taxAmount: totalDue,
                reason: 'property_annual_tax',
                refId: billId,
                nowMs,
            });
        }
        else if (billData.billType === 'vehicle_tax' || billData.billType === 'vehicle_ticket_fine') {
            (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, totalDue, 'vehicle', nowMs);
            if (billData.billType === 'vehicle_tax' && billVehDoc?.exists && billVehRef) {
                tx.update(billVehRef, {
                    stnkExpiresAtMs: nowMs + vehicles_1.vehiclesConfig.stnkPeriodMs,
                    taxLastPaidAtMs: nowMs,
                    updatedAtMs: nowMs,
                });
            }
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: uid,
                to: 'system:treasury',
                amount: totalDue,
                taxAmount: totalDue,
                reason: String(billData.billType),
                refId: billId,
                nowMs,
            });
        }
        // Sinkronkan pembayaran tagihan cicilan bank (loan_installment) & skor kredit
        if (billData.billType === 'loan_installment' && loanDoc?.exists && loanRef) {
            const loanData = loanDoc.data();
            const principalPaid = Math.min(Number(loanData.remaining || 0), Number(billData.baseAmount || 0));
            const nextRemaining = Math.max(0, Number(loanData.remaining || 0) - principalPaid);
            const nextStatus = nextRemaining <= 0 ? 'paid' : 'active';
            const paidBonus = nextStatus === 'paid' ? bank_1.bankConfig.creditScore.loanRepaidBonus : 0;
            const delta = (lateFee === 0 ? bank_1.bankConfig.creditScore.onTimePaymentDelta : 0) + paidBonus;
            nextScore = (0, bank_1.clampCreditScore)(curScore + delta);
            tx.update(loanRef, {
                remaining: nextRemaining,
                paidCycles: Number(loanData.paidCycles || 0) + 1,
                nextDueAtMs: Number(loanData.nextDueAtMs || nowMs) + bank_1.bankConfig.loan.cycleMs,
                status: nextStatus,
                updatedAtMs: nowMs,
            });
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: uid,
                to: 'system:bank',
                amount: totalDue,
                reason: nextStatus === 'paid' ? 'bank_loan_paid_off_bill' : 'bank_loan_installment_bill',
                refId: String(loanData.id),
                nowMs,
            });
        }
        else if (billData.billType === 'mortgage_installment' && mortDoc?.exists && mortRef) {
            const mortData = mortDoc.data();
            const principalPaid = Math.min(Number(mortData.remaining || 0), Number(billData.baseAmount || 0));
            const nextRemaining = Math.max(0, Number(mortData.remaining || 0) - principalPaid);
            const paidOff = nextRemaining <= 0;
            nextScore = (0, bank_1.clampCreditScore)(curScore + (lateFee === 0 ? 2 : 0) + (paidOff ? 6 : 0));
            tx.update(mortRef, {
                remaining: nextRemaining,
                paidCycles: Number(mortData.paidCycles || 0) + 1,
                nextDueAtMs: Number(mortData.nextDueAtMs || nowMs) + propertyAdvanced_1.mortgageConfig.cycleMs,
                missedCount: 0,
                status: paidOff ? 'paid' : 'active',
                updatedAtMs: nowMs,
            });
            if (mortPropDoc?.exists && mortPropRef) {
                tx.update(mortPropRef, {
                    mortgageInfo: paidOff
                        ? null
                        : { mortgageId: String(mortData.id), remaining: nextRemaining, status: 'active' },
                    updatedAtMs: nowMs,
                });
            }
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: uid,
                to: 'system:bank',
                amount: totalDue,
                reason: paidOff ? 'mortgage_paid_off_bill' : 'mortgage_installment_bill',
                refId: String(mortData.id),
                nowMs,
            });
        }
        else if (billData.billType === 'vehicle_lease_installment' && vLeaseDoc?.exists && vLeaseRef) {
            const vlData = vLeaseDoc.data();
            const principalPaid = Math.min(Number(vlData.remaining || 0), Number(billData.baseAmount || 0));
            const nextRemaining = Math.max(0, Number(vlData.remaining || 0) - principalPaid);
            const paidOff = nextRemaining <= 0;
            nextScore = (0, bank_1.clampCreditScore)(curScore + (lateFee === 0 ? 2 : 0) + (paidOff ? 4 : 0));
            tx.update(vLeaseRef, {
                remaining: nextRemaining,
                paidCycles: Number(vlData.paidCycles || 0) + 1,
                nextDueAtMs: Number(vlData.nextDueAtMs || nowMs) + vehicles_1.dealerConfig.leasing.cycleMs,
                missedCount: 0,
                status: paidOff ? 'paid' : 'active',
                updatedAtMs: nowMs,
            });
            if (paidOff && billVehDoc?.exists && billVehRef) {
                tx.update(billVehRef, { leaseId: null, updatedAtMs: nowMs });
            }
            (0, ledger_1.appendLedger)(tx, firebase_1.db, {
                from: uid,
                to: 'system:bank',
                amount: totalDue,
                reason: paidOff ? 'vehicle_lease_paid_off_bill' : 'vehicle_lease_installment_bill',
                refId: String(vlData.id),
                nowMs,
            });
        }
        else {
            // Bayar tagihan/sewa tepat waktu menaikkan skor kredit secara bertahap
            nextScore = (0, bank_1.clampCreditScore)(curScore + (lateFee === 0 ? 1 : -1));
        }
        tx.update(charRef, {
            money: nextMoney,
            mood: nextMood,
            creditScore: nextScore,
            updatedAt: now,
        });
        if (accDoc.exists) {
            tx.update(accRef, { creditScore: nextScore, updatedAtMs: nowMs });
        }
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
        return { money: nextMoney, totalDue, title: String(billData.title), creditScore: nextScore };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=bills.js.map