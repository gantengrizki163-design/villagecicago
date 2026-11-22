import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { bankConfig, clampCreditScore, syncLazyLoanInstallments } from '../helpers/bank';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import { syncLazyHousingState } from '../helpers/housing';
import { ensurePhase6Configs } from '../helpers/law';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { appendTransaction, economyConfig, housingConfig } from '../helpers/phase2';
import { mortgageConfig, syncLazyMortgageAndConstructionState } from '../helpers/propertyAdvanced';
import { dealerConfig, ensureVehicleConfigs, syncLazyVehicleState, vehiclesConfig } from '../helpers/vehicles';
import { syncLazySecurityAndInsurance } from './security';

/**
 * Menghasilkan tagihan mingguan dasar (Fase 2) secara lazy bagi pemain tanpa kontrak sewa khusus,
 * sementara kontrak sewa Fase 3 menghasilkan tagihan sewa, utilitas & PBB lewat syncLazyHousingState.
 */
export async function syncLazyBillsForUser(
  tx: Transaction,
  firestore: Firestore,
  uid: string,
  createdAtMs: number,
  lastBillPeriod: number,
  nowMs: number,
  hasActiveHousingLease = false
) {
  const cycleMs = economyConfig.billCycleMs;
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
          baseAmount: economyConfig.electricityBillAmount,
          lateFee: 0,
          status: 'unpaid',
          dueAtMs,
        });
        createdCount += 1;
      }
    }

    tx.update(firestore.collection('characters').doc(uid), {
      lastBillPeriod: currentPeriod,
      updatedAt: Timestamp.fromMillis(nowMs),
    });
  }

  return { currentPeriod, createdCount };
}

export function computeBillLateFee(
  bill: {
    billType: string;
    baseAmount?: number;
    leaseId?: string;
    mortgageId?: string;
    dueAtMs: number;
    status: string;
  },
  nowMs: number
): number {
  if (bill.status === 'paid') return 0;
  if (nowMs <= bill.dueAtMs + economyConfig.billGraceMs) return 0;
  if (bill.billType === 'mortgage_installment' || bill.mortgageId) {
    return Math.round(Number(bill.baseAmount || 20000) * mortgageConfig.lateFeeRate);
  }
  if (bill.billType === 'vehicle_lease_installment') {
    return Math.round(Number(bill.baseAmount || 20000) * dealerConfig.leasing.lateFeeRate);
  }
  if (bill.billType === 'vehicle_tax') {
    return Math.round(Number(bill.baseAmount || 15000) * vehiclesConfig.stnkLatePenaltyRate);
  }
  if (bill.billType === 'vehicle_ticket_fine') {
    return Math.round(Number(bill.baseAmount || 25000) * 0.1);
  }
  if (bill.billType === 'security_fee' || bill.billType === 'insurance_premium' || bill.billType === 'fine') {
    return Math.round(Number(bill.baseAmount || 10000) * 0.1);
  }
  if (bill.leaseId || bill.billType === 'water' || bill.billType === 'internet' || bill.billType === 'property_tax') {
    return Math.round(Number(bill.baseAmount || 20000) * housingConfig.leaseSettings.lateFeeRate);
  }
  return bill.billType === 'rent'
    ? economyConfig.rentLatePenalty
    : economyConfig.electricityLatePenalty;
}

export const getBills = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    await Promise.all([ensurePhase6Configs(), ensureVehicleConfigs()]);

    const uid = request.auth.uid;
    const nowMs = Date.now();
    const charRef = db.collection('characters').doc(uid);

    await Promise.all([
      syncLazyHousingState(db, uid, nowMs),
      syncLazyLoanInstallments(db, uid, nowMs),
      syncLazyMortgageAndConstructionState(db, uid, nowMs),
      syncLazySecurityAndInsurance(db, uid, nowMs),
      syncLazyVehicleState(db, uid, nowMs),
    ]);

    await db.runTransaction(async (tx) => {
      const charDoc = await tx.get(charRef);
      if (!charDoc.exists) {
        throw new HttpsError('not-found', 'Karakter belum ditemukan.');
      }
      const data = charDoc.data()!;
      const createdAtMs =
        data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : nowMs;
      const lastPeriod = Number(data.lastBillPeriod || 0);
      await syncLazyBillsForUser(
        tx,
        db,
        uid,
        createdAtMs,
        lastPeriod,
        nowMs,
        Boolean(data.activeLeaseId)
      );
    });

    const billsSnap = await charRef
      .collection('bills')
      .where('uid', '==', uid)
      .orderBy('dueAtMs', 'asc')
      .limit(30)
      .get();

    const bills = billsSnap.docs.map((d) => {
      const b = d.data();
      const lateFee = computeBillLateFee(
        {
          billType: String(b.billType),
          baseAmount: Number(b.baseAmount),
          leaseId: typeof b.leaseId === 'string' ? b.leaseId : undefined,
          mortgageId: typeof b.mortgageId === 'string' ? b.mortgageId : undefined,
          dueAtMs: Number(b.dueAtMs),
          status: String(b.status),
        },
        nowMs
      );
      return {
        id: d.id,
        ...b,
        lateFee,
        totalDue: Number(b.baseAmount) + lateFee,
      };
    });

    return { ok: true, bills };
  }
);

export const payBill = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as { billId?: unknown };
    const billId = typeof data?.billId === 'string' ? data.billId.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(billId)) {
      throw new HttpsError('invalid-argument', 'ID tagihan tidak valid.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const billRef = charRef.collection('bills').doc(billId);
    const accRef = db.collection('accounts').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, statsDoc, billDoc, accDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(statsRef),
        tx.get(billRef),
        tx.get(accRef),
        tx.get(treasuryRef),
      ]);

      if (!charDoc.exists || !statsDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }
      if (!billDoc.exists) {
        throw new HttpsError('not-found', 'Tagihan tidak ditemukan.');
      }

      const billData = billDoc.data()!;
      if (billData.status === 'paid') {
        throw new HttpsError('failed-precondition', 'Tagihan ini sudah lunas.');
      }

      const leaseId = typeof billData.leaseId === 'string' ? billData.leaseId : null;
      const loanId = typeof billData.loanId === 'string' ? billData.loanId : null;
      const mortgageId = typeof billData.mortgageId === 'string' ? billData.mortgageId : null;
      const vehicleLeaseId = typeof billData.vehicleLeaseId === 'string' ? billData.vehicleLeaseId : null;
      const billVehicleId = typeof billData.vehicleId === 'string' ? billData.vehicleId : null;
      const leaseRef = leaseId ? db.collection('leases').doc(leaseId) : null;
      const loanRef = loanId ? db.collection('loans').doc(loanId) : null;
      const mortRef = mortgageId ? db.collection('mortgages').doc(mortgageId) : null;
      const vLeaseRef = vehicleLeaseId ? db.collection('vehicle_leases').doc(vehicleLeaseId) : null;
      const billVehRef = billVehicleId ? db.collection('vehicles').doc(billVehicleId) : null;
      const [leaseDoc, loanDoc, mortDoc, vLeaseDoc, billVehDoc] = await Promise.all([
        leaseRef ? tx.get(leaseRef) : Promise.resolve(null),
        loanRef ? tx.get(loanRef) : Promise.resolve(null),
        mortRef ? tx.get(mortRef) : Promise.resolve(null),
        vLeaseRef ? tx.get(vLeaseRef) : Promise.resolve(null),
        billVehRef ? tx.get(billVehRef) : Promise.resolve(null),
      ]);

      const mortPropRef =
        mortDoc?.exists && typeof mortDoc.data()?.propertyId === 'string'
          ? db.collection('properties').doc(String(mortDoc.data()!.propertyId))
          : null;
      const mortPropDoc = mortPropRef ? await tx.get(mortPropRef) : null;

      const ownerId =
        leaseDoc?.exists && leaseDoc.data()?.ownerType === 'player'
          ? String(leaseDoc.data()!.ownerId)
          : null;
      const ownerRef = ownerId && ownerId !== uid ? db.collection('characters').doc(ownerId) : null;
      const ownerDoc = ownerRef ? await tx.get(ownerRef) : null;

      const lateFee = computeBillLateFee(
        {
          billType: String(billData.billType),
          baseAmount: Number(billData.baseAmount),
          leaseId: leaseId ?? undefined,
          mortgageId: mortgageId ?? undefined,
          dueAtMs: Number(billData.dueAtMs),
          status: String(billData.status),
        },
        nowMs
      );
      const totalDue = Number(billData.baseAmount) + lateFee;
      const currentMoney = Number(charDoc.data()!.money);

      if (currentMoney < totalDue) {
        throw new HttpsError(
          'failed-precondition',
          `Saldo kurang! Butuh Rp ${totalDue.toLocaleString('id-ID')}.`
        );
      }

      const nextMoney = currentMoney - totalDue;
      const nextMood = Math.min(100, Number(statsDoc.data()!.mood ?? 80) + 5);
      const curScore = Number(
        accDoc.exists
          ? accDoc.data()!.creditScore
          : charDoc.data()!.creditScore ?? bankConfig.creditScore.defaultScore
      );
      let nextScore = curScore;

      if (billData.billType === 'rent' && ownerDoc?.exists && ownerRef && ownerId) {
        const tax = Math.round(totalDue * housingConfig.leaseSettings.rentalIncomeTaxRate);
        const netIncome = Math.max(0, totalDue - tax);
        const ownerNextMoney = Number(ownerDoc.data()!.money || 0) + netIncome;
        tx.update(ownerRef, { money: ownerNextMoney, updatedAt: now });
        appendTransaction(tx, db, ownerId, {
          type: 'income',
          category: 'sewa_properti',
          amount: netIncome,
          balanceAfter: ownerNextMoney,
          description: `Penerimaan ${String(billData.title)} (potong pajak 5%)`,
          nowMs,
        });
        if (tax > 0) {
          applyTreasuryCredit(tx, db, treasuryDoc, tax, 'property', nowMs);
          appendLedger(tx, db, {
            from: ownerId,
            to: 'system:treasury',
            amount: tax,
            taxAmount: tax,
            reason: 'property_rental_bill_tax',
            refId: billId,
            nowMs,
          });
        }
      } else if (billData.billType === 'property_tax') {
        applyTreasuryCredit(tx, db, treasuryDoc, totalDue, 'property', nowMs);
        appendLedger(tx, db, {
          from: uid,
          to: 'system:treasury',
          amount: totalDue,
          taxAmount: totalDue,
          reason: 'property_annual_tax',
          refId: billId,
          nowMs,
        });
      } else if (billData.billType === 'vehicle_tax' || billData.billType === 'vehicle_ticket_fine') {
        applyTreasuryCredit(tx, db, treasuryDoc, totalDue, 'vehicle', nowMs);
        if (billData.billType === 'vehicle_tax' && billVehDoc?.exists && billVehRef) {
          tx.update(billVehRef, {
            stnkExpiresAtMs: nowMs + vehiclesConfig.stnkPeriodMs,
            taxLastPaidAtMs: nowMs,
            updatedAtMs: nowMs,
          });
        }
        appendLedger(tx, db, {
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
        const loanData = loanDoc.data()!;
        const principalPaid = Math.min(Number(loanData.remaining || 0), Number(billData.baseAmount || 0));
        const nextRemaining = Math.max(0, Number(loanData.remaining || 0) - principalPaid);
        const nextStatus = nextRemaining <= 0 ? 'paid' : 'active';
        const paidBonus = nextStatus === 'paid' ? bankConfig.creditScore.loanRepaidBonus : 0;
        const delta = (lateFee === 0 ? bankConfig.creditScore.onTimePaymentDelta : 0) + paidBonus;
        nextScore = clampCreditScore(curScore + delta);

        tx.update(loanRef, {
          remaining: nextRemaining,
          paidCycles: Number(loanData.paidCycles || 0) + 1,
          nextDueAtMs: Number(loanData.nextDueAtMs || nowMs) + bankConfig.loan.cycleMs,
          status: nextStatus,
          updatedAtMs: nowMs,
        });

        appendLedger(tx, db, {
          from: uid,
          to: 'system:bank',
          amount: totalDue,
          reason: nextStatus === 'paid' ? 'bank_loan_paid_off_bill' : 'bank_loan_installment_bill',
          refId: String(loanData.id),
          nowMs,
        });
      } else if (billData.billType === 'mortgage_installment' && mortDoc?.exists && mortRef) {
        const mortData = mortDoc.data()!;
        const principalPaid = Math.min(Number(mortData.remaining || 0), Number(billData.baseAmount || 0));
        const nextRemaining = Math.max(0, Number(mortData.remaining || 0) - principalPaid);
        const paidOff = nextRemaining <= 0;
        nextScore = clampCreditScore(curScore + (lateFee === 0 ? 2 : 0) + (paidOff ? 6 : 0));

        tx.update(mortRef, {
          remaining: nextRemaining,
          paidCycles: Number(mortData.paidCycles || 0) + 1,
          nextDueAtMs: Number(mortData.nextDueAtMs || nowMs) + mortgageConfig.cycleMs,
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

        appendLedger(tx, db, {
          from: uid,
          to: 'system:bank',
          amount: totalDue,
          reason: paidOff ? 'mortgage_paid_off_bill' : 'mortgage_installment_bill',
          refId: String(mortData.id),
          nowMs,
        });
      } else if (billData.billType === 'vehicle_lease_installment' && vLeaseDoc?.exists && vLeaseRef) {
        const vlData = vLeaseDoc.data()!;
        const principalPaid = Math.min(Number(vlData.remaining || 0), Number(billData.baseAmount || 0));
        const nextRemaining = Math.max(0, Number(vlData.remaining || 0) - principalPaid);
        const paidOff = nextRemaining <= 0;
        nextScore = clampCreditScore(curScore + (lateFee === 0 ? 2 : 0) + (paidOff ? 4 : 0));

        tx.update(vLeaseRef, {
          remaining: nextRemaining,
          paidCycles: Number(vlData.paidCycles || 0) + 1,
          nextDueAtMs: Number(vlData.nextDueAtMs || nowMs) + dealerConfig.leasing.cycleMs,
          missedCount: 0,
          status: paidOff ? 'paid' : 'active',
          updatedAtMs: nowMs,
        });
        if (paidOff && billVehDoc?.exists && billVehRef) {
          tx.update(billVehRef, { leaseId: null, updatedAtMs: nowMs });
        }
        appendLedger(tx, db, {
          from: uid,
          to: 'system:bank',
          amount: totalDue,
          reason: paidOff ? 'vehicle_lease_paid_off_bill' : 'vehicle_lease_installment_bill',
          refId: String(vlData.id),
          nowMs,
        });
      } else {
        // Bayar tagihan/sewa tepat waktu menaikkan skor kredit secara bertahap
        nextScore = clampCreditScore(curScore + (lateFee === 0 ? 1 : -1));
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

      appendTransaction(tx, db, uid, {
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
  }
);
