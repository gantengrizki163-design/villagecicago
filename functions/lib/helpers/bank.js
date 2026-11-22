"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankConfig = void 0;
exports.clampCreditScore = clampCreditScore;
exports.getLoanTierForScore = getLoanTierForScore;
exports.computeLazySavingsInterest = computeLazySavingsInterest;
exports.assertNearBankOrAtm = assertNearBankOrAtm;
exports.syncLazyLoanInstallments = syncLazyLoanInstallments;
const bank_json_1 = __importDefault(require("../config/bank.json"));
exports.bankConfig = bank_json_1.default;
const ledger_1 = require("./ledger");
const location_1 = require("./location");
const phase2_1 = require("./phase2");
function clampCreditScore(score) {
    return Math.max(bank_json_1.default.creditScore.min, Math.min(bank_json_1.default.creditScore.max, Math.round(score)));
}
function getLoanTierForScore(creditScore) {
    for (const tier of bank_json_1.default.loan.tiers) {
        if (creditScore >= tier.minScore && creditScore <= tier.maxScore) {
            return tier;
        }
    }
    return null;
}
function computeLazySavingsInterest(savings, lastInterestAtMs, nowMs) {
    if (savings <= 0 || nowMs <= lastInterestAtMs) {
        return { interest: 0, nextLastInterestAtMs: lastInterestAtMs };
    }
    const elapsedDays = Math.min(bank_json_1.default.maxInterestDaysPerClaim, Math.max(0, nowMs - lastInterestAtMs) / phase2_1.GAME_DAY_DURATION_MS);
    const rawInterest = savings * bank_json_1.default.savingsDailyInterestRate * elapsedDays;
    const interest = Math.floor(rawInterest);
    if (interest < 1) {
        return { interest: 0, nextLastInterestAtMs: lastInterestAtMs };
    }
    return { interest, nextLastInterestAtMs: nowMs };
}
async function assertNearBankOrAtm(rtdb, uid, charData, bankBranchOnly = false) {
    const locationIds = bankBranchOnly
        ? ['bank']
        : ['bank', 'atm_stasiun', 'atm_alun', 'atm_pasar'];
    const customMessage = bankBranchOnly
        ? 'Harap datang ke Gedung Bank Priangan Cicalengka terlebih dahulu.'
        : 'Harap dekati Gedung Bank Priangan atau ATM terdekat terlebih dahulu.';
    const match = await (0, location_1.assertNearLocation)(rtdb, uid, charData, locationIds, 0, [], customMessage);
    return match.label;
}
/**
 * Evaluasi cicilan pinjaman aktif secara lazy (tanpa loop server):
 * - Menghasilkan tagihan loan_installment di characters/{uid}/bills jika memasuki jatuh tempo
 * - Menandai keterlambatan melewati grace period dan menurunkan creditScore
 */
async function syncLazyLoanInstallments(db, uid, nowMs) {
    const activeLoansSnap = await db
        .collection('loans')
        .where('borrowerId', '==', uid)
        .where('status', '==', 'active')
        .limit(5)
        .get();
    if (activeLoansSnap.empty)
        return;
    for (const loanDoc of activeLoansSnap.docs) {
        await db.runTransaction(async (tx) => {
            const loanRef = loanDoc.ref;
            const charRef = db.collection('characters').doc(uid);
            const accRef = db.collection('accounts').doc(uid);
            const [freshLoan, freshChar, freshAcc] = await Promise.all([
                tx.get(loanRef),
                tx.get(charRef),
                tx.get(accRef),
            ]);
            if (!freshLoan.exists || !freshChar.exists)
                return;
            const loan = freshLoan.data();
            if (loan.status !== 'active')
                return;
            const remaining = Number(loan.remaining || 0);
            if (remaining <= 0) {
                tx.update(loanRef, { status: 'paid', remaining: 0, updatedAtMs: nowMs });
                return;
            }
            const nextDueAtMs = Number(loan.nextDueAtMs || nowMs);
            const paidCycles = Number(loan.paidCycles || 0);
            const installmentIndex = paidCycles + 1;
            const billId = `loan_${loan.id}_c${installmentIndex}`;
            const billRef = charRef.collection('bills').doc(billId);
            const billDoc = await tx.get(billRef);
            const installmentDue = Math.min(remaining, Number(loan.installment || remaining));
            if (!billDoc.exists && nowMs >= nextDueAtMs - phase2_1.GAME_DAY_DURATION_MS) {
                tx.set(billRef, {
                    uid,
                    billType: 'loan_installment',
                    title: `Cicilan Bank #${installmentIndex} (${String(loan.id).slice(-5)})`,
                    periodIndex: installmentIndex,
                    baseAmount: installmentDue,
                    lateFee: 0,
                    status: 'unpaid',
                    loanId: loan.id,
                    dueAtMs: nextDueAtMs,
                });
            }
            // Cek keterlambatan melewati grace period (penalti kredit 1x per siklus telat)
            const graceEnd = nextDueAtMs + bank_json_1.default.loan.gracePeriodMs;
            const lastPenaltyCycle = Number(loan.lastPenaltyCycle || 0);
            if (nowMs > graceEnd && lastPenaltyCycle < installmentIndex) {
                const currentScore = Number(freshAcc.exists
                    ? freshAcc.data().creditScore
                    : freshChar.data().creditScore ?? bank_json_1.default.creditScore.defaultScore);
                const nextScore = clampCreditScore(currentScore + bank_json_1.default.creditScore.latePaymentDelta);
                const nextMissed = Number(loan.missedCount || 0) + 1;
                const defaulted = nextMissed >= 3;
                tx.update(charRef, { creditScore: nextScore });
                if (freshAcc.exists) {
                    tx.update(accRef, { creditScore: nextScore, updatedAtMs: nowMs });
                }
                const latePenaltyFee = Math.round(installmentDue * bank_json_1.default.loan.lateFeeRate);
                if (billDoc.exists && billDoc.data().status === 'unpaid') {
                    tx.update(billRef, {
                        lateFee: latePenaltyFee,
                        ...(defaulted ? { status: 'defaulted' } : {}),
                    });
                }
                if (defaulted) {
                    const scoreAfterDefault = clampCreditScore(nextScore + bank_json_1.default.creditScore.defaultPenalty);
                    tx.update(charRef, { creditScore: scoreAfterDefault });
                    if (freshAcc.exists) {
                        tx.update(accRef, { creditScore: scoreAfterDefault, updatedAtMs: nowMs });
                    }
                    tx.update(loanRef, {
                        missedCount: nextMissed,
                        lastPenaltyCycle: installmentIndex,
                        status: 'defaulted',
                        updatedAtMs: nowMs,
                    });
                    (0, ledger_1.appendLedger)(tx, db, {
                        from: uid,
                        to: 'system:bank',
                        amount: 0,
                        reason: 'loan_default_penalty',
                        refId: String(loan.id),
                        nowMs,
                    });
                }
                else {
                    tx.update(loanRef, {
                        missedCount: nextMissed,
                        lastPenaltyCycle: installmentIndex,
                        updatedAtMs: nowMs,
                    });
                }
            }
        });
    }
}
//# sourceMappingURL=bank.js.map