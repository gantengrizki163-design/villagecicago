import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  assertNearBankOrAtm,
  bankConfig,
  clampCreditScore,
  computeLazySavingsInterest,
  getLoanTierForScore,
  syncLazyLoanInstallments,
} from '../helpers/bank';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { isValidSimpleId } from '../helpers/housing';
import { appendLedger } from '../helpers/ledger';
import { appendTransaction } from '../helpers/phase2';

function parsePositiveInt(val: unknown, label: string): number {
  const num = Math.floor(Number(val));
  if (!Number.isFinite(num) || num <= 0) {
    throw new HttpsError('invalid-argument', `${label} harus berupa angka positif.`);
  }
  return num;
}

export const openAccount = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { initialDeposit?: unknown };
    const initialDeposit = Math.max(0, Math.floor(Number(data.initialDeposit || 0)));
    if (initialDeposit > bankConfig.maxDepositPerTx) {
      throw new HttpsError('invalid-argument', 'Setoran awal melebihi batas maksimum.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);

    const charPreSnap = await charRef.get();
    if (!charPreSnap.exists) throw new HttpsError('not-found', 'Karakter belum dibuat.');
    try {
      await assertNearBankOrAtm(rtdb, uid, charPreSnap.data()!, true);
    } catch (e) {
      throw new HttpsError('failed-precondition', (e as Error).message);
    }

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc] = await Promise.all([tx.get(charRef), tx.get(accRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (accDoc.exists) throw new HttpsError('already-exists', 'Kamu sudah memiliki rekening bank.');

      const cData = charDoc.data()!;
      const totalNeeded = bankConfig.openAccountFee + initialDeposit;
      const currentMoney = Number(cData.money || 0);
      if (currentMoney < totalNeeded) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang. Butuh Rp ${totalNeeded.toLocaleString('id-ID')} (admin + setoran awal).`
        );
      }

      const nextMoney = currentMoney - totalNeeded;
      const accountNumber = `CLG-${Math.floor(1000 + Math.random() * 9000)}-${uid
        .slice(0, 4)
        .toUpperCase()}`;
      const creditScore = Number(cData.creditScore ?? bankConfig.creditScore.defaultScore);

      tx.set(accRef, {
        uid,
        accountNumber,
        balance: initialDeposit,
        savings: 0,
        lastInterestAtMs: nowMs,
        creditScore,
        totalInterestEarned: 0,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      tx.update(charRef, {
        money: nextMoney,
        creditScore,
        bankAccount: {
          hasAccount: true,
          accountNumber,
          openedAtMs: nowMs,
        },
        updatedAt: now,
      });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'bank_buka_rekening',
        amount: totalNeeded,
        balanceAfter: nextMoney,
        description: `Buka Rekening Bank Priangan (${accountNumber})`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: 'system:bank',
        amount: bankConfig.openAccountFee,
        reason: 'open_bank_account_fee',
        refId: accountNumber,
        nowMs,
      });

      if (initialDeposit > 0) {
        appendLedger(tx, db, {
          from: uid,
          to: `bank:${uid}`,
          amount: initialDeposit,
          reason: 'bank_initial_deposit',
          refId: accountNumber,
          nowMs,
        });
      }

      return { accountNumber, balance: initialDeposit, money: nextMoney, creditScore };
    });

    return { ok: true, ...result };
  }
);

export const deposit = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { amount?: unknown; target?: unknown };
    const amount = parsePositiveInt(data.amount, 'Nominal setor');
    if (amount > bankConfig.maxDepositPerTx) {
      throw new HttpsError('invalid-argument', 'Nominal setor melebihi batas per transaksi.');
    }
    const target = data.target === 'savings' ? 'savings' : 'balance';

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);

    const charPreSnap = await charRef.get();
    if (!charPreSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    try {
      await assertNearBankOrAtm(rtdb, uid, charPreSnap.data()!, false);
    } catch (e) {
      throw new HttpsError('failed-precondition', (e as Error).message);
    }

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc] = await Promise.all([tx.get(charRef), tx.get(accRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!accDoc.exists) {
        throw new HttpsError('failed-precondition', 'Buka rekening terlebih dahulu di Bank Priangan.');
      }

      const money = Number(charDoc.data()!.money || 0);
      if (money < amount) {
        throw new HttpsError('failed-precondition', 'Uang tunai di dompet tidak cukup.');
      }

      const acc = accDoc.data()!;
      const oldSavings = Number(acc.savings || 0);
      const { interest, nextLastInterestAtMs } = computeLazySavingsInterest(
        oldSavings,
        Number(acc.lastInterestAtMs || nowMs),
        nowMs
      );

      const nextMoney = money - amount;
      const nextBalance =
        Number(acc.balance || 0) + (target === 'balance' ? amount : 0);
      const nextSavings =
        oldSavings + interest + (target === 'savings' ? amount : 0);

      tx.update(charRef, { money: nextMoney, updatedAt: now });
      tx.update(accRef, {
        balance: nextBalance,
        savings: nextSavings,
        lastInterestAtMs: target === 'savings' && oldSavings === 0 ? nowMs : nextLastInterestAtMs,
        totalInterestEarned: Number(acc.totalInterestEarned || 0) + interest,
        updatedAtMs: nowMs,
      });

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: target === 'savings' ? 'bank_tabung' : 'bank_setor',
        amount,
        balanceAfter: nextMoney,
        description: `Setor ke ${target === 'savings' ? 'Tabungan' : 'Rekening Giro'}`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: `bank:${uid}`,
        amount,
        reason: target === 'savings' ? 'bank_deposit_savings' : 'bank_deposit_checking',
        refId: String(acc.accountNumber),
        nowMs,
      });

      return { money: nextMoney, balance: nextBalance, savings: nextSavings, interestCredited: interest };
    });

    return { ok: true, ...result };
  }
);

export const withdraw = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { amount?: unknown; source?: unknown };
    const amount = parsePositiveInt(data.amount, 'Nominal tarik');
    const source = data.source === 'savings' ? 'savings' : 'balance';

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);

    const charPreSnap = await charRef.get();
    if (!charPreSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    try {
      await assertNearBankOrAtm(rtdb, uid, charPreSnap.data()!, false);
    } catch (e) {
      throw new HttpsError('failed-precondition', (e as Error).message);
    }

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc] = await Promise.all([tx.get(charRef), tx.get(accRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!accDoc.exists) throw new HttpsError('failed-precondition', 'Rekening bank belum ada.');

      const acc = accDoc.data()!;
      const oldSavings = Number(acc.savings || 0);
      const { interest, nextLastInterestAtMs } = computeLazySavingsInterest(
        oldSavings,
        Number(acc.lastInterestAtMs || nowMs),
        nowMs
      );

      let nextBalance = Number(acc.balance || 0);
      let nextSavings = oldSavings + interest;

      if (source === 'savings') {
        if (nextSavings < amount) {
          throw new HttpsError('failed-precondition', 'Saldo tabungan tidak mencukupi.');
        }
        nextSavings -= amount;
      } else {
        if (nextBalance < amount) {
          throw new HttpsError('failed-precondition', 'Saldo rekening giro tidak mencukupi.');
        }
        nextBalance -= amount;
      }

      const nextMoney = Number(charDoc.data()!.money || 0) + amount;
      tx.update(charRef, { money: nextMoney, updatedAt: now });
      tx.update(accRef, {
        balance: nextBalance,
        savings: nextSavings,
        lastInterestAtMs: nextLastInterestAtMs,
        totalInterestEarned: Number(acc.totalInterestEarned || 0) + interest,
        updatedAtMs: nowMs,
      });

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'bank_tarik',
        amount,
        balanceAfter: nextMoney,
        description: `Tarik tunai dari ${source === 'savings' ? 'Tabungan' : 'Rekening Giro'}`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: `bank:${uid}`,
        to: uid,
        amount,
        reason: source === 'savings' ? 'bank_withdraw_savings' : 'bank_withdraw_checking',
        refId: String(acc.accountNumber),
        nowMs,
      });

      return { money: nextMoney, balance: nextBalance, savings: nextSavings, interestCredited: interest };
    });

    return { ok: true, ...result };
  }
);

export const transfer = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { targetName?: unknown; amount?: unknown; note?: unknown };
    const targetNameRaw = typeof data.targetName === 'string' ? data.targetName.trim().toLowerCase() : '';
    if (!targetNameRaw || targetNameRaw.length < 3 || targetNameRaw.length > 20) {
      throw new HttpsError('invalid-argument', 'Nama karakter penerima tidak valid.');
    }
    const amount = parsePositiveInt(data.amount, 'Nominal transfer');
    if (amount < bankConfig.minTransferAmount) {
      throw new HttpsError(
        'invalid-argument',
        `Transfer minimal Rp ${bankConfig.minTransferAmount.toLocaleString('id-ID')}.`
      );
    }

    const nameLockSnap = await db.collection('character_names').doc(targetNameRaw).get();
    if (!nameLockSnap.exists) {
      throw new HttpsError('not-found', 'Karakter penerima tidak ditemukan.');
    }
    const targetUid = String(nameLockSnap.data()!.uid);
    if (targetUid === uid) {
      throw new HttpsError('invalid-argument', 'Tidak bisa transfer ke rekening sendiri.');
    }

    const nowMs = Date.now();
    const senderAccRef = db.collection('accounts').doc(uid);
    const targetAccRef = db.collection('accounts').doc(targetUid);
    const targetCharRef = db.collection('characters').doc(targetUid);

    const adminFee = Math.min(
      bankConfig.transferAdminFeeMax,
      bankConfig.transferAdminFeeFlat + Math.round(amount * bankConfig.transferAdminFeeRate)
    );

    const result = await db.runTransaction(async (tx) => {
      const [senderAccDoc, targetAccDoc, targetCharDoc] = await Promise.all([
        tx.get(senderAccRef),
        tx.get(targetAccRef),
        tx.get(targetCharRef),
      ]);

      if (!senderAccDoc.exists) {
        throw new HttpsError('failed-precondition', 'Kamu belum memiliki rekening bank.');
      }
      if (!targetAccDoc.exists || !targetCharDoc.exists) {
        throw new HttpsError('failed-precondition', 'Penerima belum membuka rekening di Bank Priangan.');
      }

      const senderBalance = Number(senderAccDoc.data()!.balance || 0);
      const totalDebit = amount + adminFee;
      if (senderBalance < totalDebit) {
        throw new HttpsError(
          'failed-precondition',
          `Saldo giro kurang. Butuh Rp ${totalDebit.toLocaleString('id-ID')} (termasuk admin).`
        );
      }

      const nextSenderBalance = senderBalance - totalDebit;
      const nextTargetBalance = Number(targetAccDoc.data()!.balance || 0) + amount;

      tx.update(senderAccRef, { balance: nextSenderBalance, updatedAtMs: nowMs });
      tx.update(targetAccRef, { balance: nextTargetBalance, updatedAtMs: nowMs });

      const refId = `trf_${nowMs}`;
      appendLedger(tx, db, {
        from: uid,
        to: targetUid,
        amount,
        taxAmount: adminFee,
        reason: 'bank_transfer',
        refId,
        nowMs,
      });

      return {
        balance: nextSenderBalance,
        amount,
        adminFee,
        targetName: String(targetCharDoc.data()!.name || targetNameRaw),
      };
    });

    return { ok: true, ...result };
  }
);

export const applyLoan = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { amount?: unknown };
    const principal = parsePositiveInt(data.amount, 'Nominal pinjaman');

    const nowMs = Date.now();
    await syncLazyLoanInstallments(db, uid, nowMs);

    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const charPreSnap = await charRef.get();
    if (!charPreSnap.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');

    try {
      await assertNearBankOrAtm(rtdb, uid, charPreSnap.data()!, true);
    } catch (e) {
      throw new HttpsError('failed-precondition', (e as Error).message);
    }

    const activeLoansSnap = await db
      .collection('loans')
      .where('borrowerId', '==', uid)
      .where('status', '==', 'active')
      .limit(2)
      .get();
    if (activeLoansSnap.size >= bankConfig.loan.maxActiveLoans) {
      throw new HttpsError('failed-precondition', 'Lunasi pinjaman aktif sebelum mengajukan lagi.');
    }

    const loanId = `loan_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const loanRef = db.collection('loans').doc(loanId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc] = await Promise.all([tx.get(charRef), tx.get(accRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!accDoc.exists) {
        throw new HttpsError('failed-precondition', 'Buka rekening bank terlebih dahulu.');
      }

      const cData = charDoc.data()!;
      const accData = accDoc.data()!;
      const creditScore = Number(accData.creditScore ?? cData.creditScore ?? bankConfig.creditScore.defaultScore);

      if (creditScore < bankConfig.loan.minCreditScore) {
        throw new HttpsError(
          'failed-precondition',
          `Skor kredit terlalu rendah (${creditScore}). Minimal ${bankConfig.loan.minCreditScore}.`
        );
      }

      const shiftsCompleted = Number(cData.currentJob?.shiftsCompleted ?? 0);
      const hasBusiness = Array.isArray(cData.businesses) && cData.businesses.length > 0;
      if (shiftsCompleted < bankConfig.loan.minCompletedShifts && !hasBusiness) {
        throw new HttpsError(
          'failed-precondition',
          `Butuh penghasilan tetap minimal ${bankConfig.loan.minCompletedShifts} shift kerja selesai atau memiliki bisnis aktif.`
        );
      }

      const tier = getLoanTierForScore(creditScore);
      if (!tier || principal > tier.maxPrincipal) {
        throw new HttpsError(
          'invalid-argument',
          `Plafon pinjaman untuk skor kredit ${creditScore} maksimal Rp ${(tier?.maxPrincipal || 0).toLocaleString('id-ID')}.`
        );
      }

      const totalRepayable = Math.round(principal * (1 + tier.flatInterestRate));
      const installment = Math.ceil(totalRepayable / tier.termCycles / 100) * 100;
      const nextDueAtMs = nowMs + bankConfig.loan.cycleMs;

      tx.set(loanRef, {
        id: loanId,
        borrowerId: uid,
        borrowerName: String(cData.name || 'Warga'),
        principal,
        rate: tier.flatInterestRate,
        installment,
        termCycles: tier.termCycles,
        paidCycles: 0,
        nextDueAtMs,
        remaining: totalRepayable,
        missedCount: 0,
        lastPenaltyCycle: 0,
        status: 'active',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      const nextBalance = Number(accData.balance || 0) + principal;
      tx.update(accRef, { balance: nextBalance, updatedAtMs: nowMs });

      appendLedger(tx, db, {
        from: 'system:bank',
        to: uid,
        amount: principal,
        reason: 'bank_loan_disbursement',
        refId: loanId,
        nowMs,
      });

      return {
        loanId,
        principal,
        totalRepayable,
        installment,
        termCycles: tier.termCycles,
        nextDueAtMs,
        balance: nextBalance,
      };
    });

    return { ok: true, ...result };
  }
);

export const repayLoan = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { loanId?: unknown; payFull?: unknown; source?: unknown };
    const loanId = isValidSimpleId(data.loanId) ? data.loanId.trim() : '';
    if (!loanId) throw new HttpsError('invalid-argument', 'ID pinjaman tidak valid.');
    const payFull = data.payFull === true;
    const useWallet = data.source === 'wallet';

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    await syncLazyLoanInstallments(db, uid, nowMs);

    const charRef = db.collection('characters').doc(uid);
    const accRef = db.collection('accounts').doc(uid);
    const loanRef = db.collection('loans').doc(loanId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, accDoc, loanDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(accRef),
        tx.get(loanRef),
      ]);

      if (!charDoc.exists || !loanDoc.exists) {
        throw new HttpsError('not-found', 'Data karakter atau pinjaman tidak ditemukan.');
      }

      const loan = loanDoc.data()!;
      if (loan.borrowerId !== uid) {
        throw new HttpsError('permission-denied', 'Ini bukan pinjaman milikmu.');
      }
      if (loan.status === 'paid') {
        throw new HttpsError('failed-precondition', 'Pinjaman ini sudah lunas.');
      }

      const remaining = Number(loan.remaining || 0);
      const paidCycles = Number(loan.paidCycles || 0);
      const currentCycle = paidCycles + 1;
      const billId = `loan_${loanId}_c${currentCycle}`;
      const billRef = charRef.collection('bills').doc(billId);
      const billDoc = await tx.get(billRef);

      const basePay = payFull ? remaining : Math.min(remaining, Number(loan.installment || remaining));
      const isLate = nowMs > Number(loan.nextDueAtMs || nowMs) + bankConfig.loan.gracePeriodMs;
      const lateFee =
        billDoc.exists && Number(billDoc.data()!.lateFee || 0) > 0
          ? Number(billDoc.data()!.lateFee)
          : isLate
            ? Math.round(basePay * bankConfig.loan.lateFeeRate)
            : 0;
      const totalPay = basePay + lateFee;

      if (useWallet) {
        const money = Number(charDoc.data()!.money || 0);
        if (money < totalPay) {
          throw new HttpsError('failed-precondition', 'Uang tunai dompet tidak cukup.');
        }
        const nextMoney = money - totalPay;
        tx.update(charRef, { money: nextMoney, updatedAt: now });
        appendTransaction(tx, db, uid, {
          type: 'expense',
          category: 'cicilan_bank',
          amount: totalPay,
          balanceAfter: nextMoney,
          description: `Bayar cicilan pinjaman ${loanId.slice(-5)}`,
          nowMs,
        });
      } else {
        if (!accDoc.exists) throw new HttpsError('failed-precondition', 'Rekening bank tidak ditemukan.');
        const balance = Number(accDoc.data()!.balance || 0);
        if (balance < totalPay) {
          throw new HttpsError('failed-precondition', 'Saldo rekening giro tidak cukup.');
        }
        tx.update(accRef, { balance: balance - totalPay, updatedAtMs: nowMs });
      }

      const nextRemaining = Math.max(0, remaining - basePay);
      const nextStatus = nextRemaining <= 0 ? 'paid' : 'active';
      const oldScore = Number(
        accDoc.exists
          ? accDoc.data()!.creditScore
          : charDoc.data()!.creditScore ?? bankConfig.creditScore.defaultScore
      );
      const scoreDelta =
        (!isLate ? bankConfig.creditScore.onTimePaymentDelta : 0) +
        (nextStatus === 'paid' ? bankConfig.creditScore.loanRepaidBonus : 0);
      const nextScore = clampCreditScore(oldScore + scoreDelta);

      tx.update(loanRef, {
        remaining: nextRemaining,
        paidCycles: currentCycle,
        nextDueAtMs: Number(loan.nextDueAtMs || nowMs) + bankConfig.loan.cycleMs,
        status: nextStatus,
        updatedAtMs: nowMs,
      });

      tx.update(charRef, { creditScore: nextScore, updatedAt: now });
      if (accDoc.exists) {
        tx.update(accRef, { creditScore: nextScore, updatedAtMs: nowMs });
      }

      if (billDoc.exists && billDoc.data()!.status !== 'paid') {
        tx.update(billRef, { status: 'paid', lateFee, paidAtMs: nowMs });
      }

      appendLedger(tx, db, {
        from: uid,
        to: 'system:bank',
        amount: totalPay,
        reason: nextStatus === 'paid' ? 'bank_loan_paid_off' : 'bank_loan_installment',
        refId: loanId,
        nowMs,
      });

      return {
        paid: totalPay,
        remaining: nextRemaining,
        status: nextStatus,
        creditScore: nextScore,
      };
    });

    return { ok: true, ...result };
  }
);

export const getAccountSummary = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const nowMs = Date.now();

    await syncLazyLoanInstallments(db, uid, nowMs);

    const accRef = db.collection('accounts').doc(uid);
    const charRef = db.collection('characters').doc(uid);

    const summary = await db.runTransaction(async (tx) => {
      const [accDoc, charDoc] = await Promise.all([tx.get(accRef), tx.get(charRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');

      const cData = charDoc.data()!;
      const creditScore = Number(
        accDoc.exists ? accDoc.data()!.creditScore : cData.creditScore ?? bankConfig.creditScore.defaultScore
      );

      if (!accDoc.exists) {
        return {
          hasAccount: false,
          account: null,
          creditScore,
          eligibleLoanTier: getLoanTierForScore(creditScore),
        };
      }

      const acc = accDoc.data()!;
      const oldSavings = Number(acc.savings || 0);
      const { interest, nextLastInterestAtMs } = computeLazySavingsInterest(
        oldSavings,
        Number(acc.lastInterestAtMs || nowMs),
        nowMs
      );
      const nextSavings = oldSavings + interest;

      if (interest > 0) {
        tx.update(accRef, {
          savings: nextSavings,
          lastInterestAtMs: nextLastInterestAtMs,
          totalInterestEarned: Number(acc.totalInterestEarned || 0) + interest,
          updatedAtMs: nowMs,
        });
        appendLedger(tx, db, {
          from: 'system:bank',
          to: uid,
          amount: interest,
          reason: 'bank_savings_interest',
          refId: String(acc.accountNumber),
          nowMs,
        });
      }

      return {
        hasAccount: true,
        account: {
          ...acc,
          savings: nextSavings,
          creditScore,
          interestJustCredited: interest,
        },
        creditScore,
        eligibleLoanTier: getLoanTierForScore(creditScore),
      };
    });

    const loansSnap = await db
      .collection('loans')
      .where('borrowerId', '==', uid)
      .limit(5)
      .get();

    const ledgerOutSnap = await db
      .collection('ledger')
      .where('from', '==', uid)
      .orderBy('atMs', 'desc')
      .limit(10)
      .get();

    const ledgerInSnap = await db
      .collection('ledger')
      .where('to', '==', uid)
      .orderBy('atMs', 'desc')
      .limit(10)
      .get();

    const ledgerMap = new Map<string, Record<string, unknown>>();
    for (const d of [...ledgerOutSnap.docs, ...ledgerInSnap.docs]) {
      ledgerMap.set(d.id, d.data());
    }
    const recentLedger = Array.from(ledgerMap.values())
      .sort((a, b) => Number(b.atMs || 0) - Number(a.atMs || 0))
      .slice(0, 12);

    return {
      ok: true,
      ...summary,
      loans: loansSnap.docs.map((d) => d.data()),
      recentLedger,
    };
  }
);
