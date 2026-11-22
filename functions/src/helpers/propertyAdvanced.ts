import { Timestamp, type DocumentSnapshot, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { clampCreditScore } from './bank';
import { buildMemberAccessRef } from './housing';
import {
  constructionConfig,
  landConfig,
  lawConfig,
  mortgageConfig,
} from './law';
import { appendLedger } from './ledger';
import { appendTransaction, furnitureConfig, GAME_DAY_DURATION_MS } from './phase2';
import { distance2D } from './validation';

export { constructionConfig, furnitureConfig, landConfig, mortgageConfig };

export const KANTOR_DESA_POS = { x: -30, z: 4, label: 'Kantor Desa Cicalengka' };
export const AGENT_OFFICE_POS = constructionConfig.agentSettings.officePos;
export const STATION_COORDS = { x: 0, z: -46 };

export const SYSTEM_PLOT_OWNER_ID = 'npc_pemdes_cicalengka';

export function computeStationTier(x: number, z: number): 'dekat' | 'sedang' | 'jauh' {
  const d = distance2D(x, z, STATION_COORDS.x, STATION_COORDS.z);
  if (d <= 35) return 'dekat';
  if (d <= 68) return 'sedang';
  return 'jauh';
}

export function isPlotAvailableForPurchase(plotData: FirebaseFirestore.DocumentData): boolean {
  const ownerId = plotData.ownerId ? String(plotData.ownerId) : '';
  return !ownerId || ownerId === SYSTEM_PLOT_OWNER_ID;
}

export function computeLandPlotPrice(plotData: {
  areaTag?: unknown;
  roadAccess?: unknown;
  size?: { width?: unknown; depth?: unknown };
  price?: unknown;
}): number {
  const explicitPrice = Number(plotData.price || 0);
  if (explicitPrice > 0) {
    return Math.round(explicitPrice / 1000) * 1000;
  }
  const width = Math.max(4, Number(plotData.size?.width || 6));
  const depth = Math.max(4, Number(plotData.size?.depth || 6));
  const areaSqm = width * depth;
  const areaTag = String(plotData.areaTag || 'kampung');
  const roadAccess = String(plotData.roadAccess || 'gang');

  const sqmMap = landConfig.areaBasePricePerSqm as Record<string, number>;
  const roadMap = landConfig.roadAccessMultiplier as Record<string, number>;
  const baseSqm = sqmMap[areaTag] ?? 6500;
  const roadMult = roadMap[roadAccess] ?? 1.0;

  return Math.max(200_000, Math.round((areaSqm * baseSqm * roadMult) / 1000) * 1000);
}

export interface MortgageQuote {
  price: number;
  downPaymentRate: number;
  downPayment: number;
  transferTax: number;
  upfrontTotal: number;
  principal: number;
  interestRatePerTerm: number;
  totalInterest: number;
  totalRepayment: number;
  termCycles: number;
  installment: number;
}

export function computeMortgageQuote(
  price: number,
  downPaymentRate: number,
  termCycles: number
): MortgageQuote | null {
  const cleanPrice = Math.max(0, Math.round(price));
  if (cleanPrice <= 0) return null;
  if (
    !Number.isFinite(downPaymentRate) ||
    downPaymentRate < mortgageConfig.minDownPaymentRate - 1e-6 ||
    downPaymentRate > mortgageConfig.maxDownPaymentRate + 1e-6
  ) {
    return null;
  }

  const tenor = mortgageConfig.tenors.find((t) => t.termCycles === termCycles);
  if (!tenor) return null;

  const normalizedRate = Math.max(
    mortgageConfig.minDownPaymentRate,
    Math.min(mortgageConfig.maxDownPaymentRate, Math.round(downPaymentRate * 100) / 100)
  );

  const downPayment = Math.round((cleanPrice * normalizedRate) / 500) * 500;
  const transferTax = Math.round(cleanPrice * 0.025);
  const upfrontTotal = downPayment + transferTax;
  const principal = Math.max(0, cleanPrice - downPayment);
  const totalInterest = Math.round(principal * tenor.interestRatePerTerm);
  const totalRepayment = principal + totalInterest;
  const installment = Math.max(1000, Math.ceil(totalRepayment / tenor.termCycles));

  return {
    price: cleanPrice,
    downPaymentRate: normalizedRate,
    downPayment,
    transferTax,
    upfrontTotal,
    principal,
    interestRatePerTerm: tenor.interestRatePerTerm,
    totalInterest,
    totalRepayment,
    termCycles: tenor.termCycles,
    installment,
  };
}

export function computeElapsedConstructionPhase(params: {
  currentPhase: string;
  phaseStartedAtMs: number;
  phaseEndsAtMs: number;
  phaseDurationSec: number;
  nowMs: number;
}): {
  phase: 'pondasi' | 'dinding' | 'atap' | 'finishing' | 'selesai';
  phaseStartedAtMs: number;
  phaseEndsAtMs: number;
  advanced: boolean;
} {
  const phases = constructionConfig.phasesOrder as Array<'pondasi' | 'dinding' | 'atap' | 'finishing'>;
  const phaseDurationMs = Math.max(5_000, Math.round(params.phaseDurationSec * 1000));

  let idx = phases.indexOf(params.currentPhase as 'pondasi' | 'dinding' | 'atap' | 'finishing');
  if (params.currentPhase === 'selesai') {
    return {
      phase: 'selesai',
      phaseStartedAtMs: params.phaseStartedAtMs,
      phaseEndsAtMs: params.phaseEndsAtMs,
      advanced: false,
    };
  }
  if (idx < 0) idx = 0;

  let curStart = params.phaseStartedAtMs;
  let curEnd = params.phaseEndsAtMs;
  let advanced = false;

  while (params.nowMs >= curEnd) {
    advanced = true;
    if (idx >= phases.length - 1) {
      return {
        phase: 'selesai',
        phaseStartedAtMs: curEnd,
        phaseEndsAtMs: curEnd,
        advanced: true,
      };
    }
    idx += 1;
    curStart = curEnd;
    curEnd = curStart + phaseDurationMs;
  }

  return {
    phase: phases[idx],
    phaseStartedAtMs: curStart,
    phaseEndsAtMs: curEnd,
    advanced,
  };
}

export interface ForecloseTxInputs {
  mortgageSnap: DocumentSnapshot;
  propSnap: DocumentSnapshot;
  borrowerSnap: DocumentSnapshot;
  accSnap: DocumentSnapshot | null;
  unpaidMortgageBills: DocumentSnapshot[];
  fallbackHomeId: string | null;
  nowMs: number;
}

/**
 * Eksekusi penyitaan KPR dalam transaksi Firestore yang seluruh dokumennya sudah dibaca terlebih dahulu.
 * Memindahkan kepemilikan properti ke Bank Priangan dan membuat lelang sitaan aktif.
 */
export function applyForeclosureInTx(
  tx: Transaction,
  firestore: Firestore,
  inputs: ForecloseTxInputs
): { auctionId: string; propertyId: string; startPrice: number } {
  const {
    mortgageSnap,
    propSnap,
    borrowerSnap,
    accSnap,
    unpaidMortgageBills,
    fallbackHomeId,
    nowMs,
  } = inputs;

  const mort = mortgageSnap.data()!;
  const borrowerId = String(mort.borrowerId);
  const propertyId = String(mort.propertyId);
  const propData = propSnap.exists ? propSnap.data()! : null;
  const propName = String(propData?.name || mort.propertyName || propertyId);
  const baseValue = Number(propData?.baseValue || mort.propertyPrice || 500_000);
  const startPrice = Math.max(
    50_000,
    Math.round((baseValue * mortgageConfig.foreclosureStartPriceRatio) / 1000) * 1000
  );

  const auctionId = `auc_kpr_${propertyId}_${nowMs}`;
  const now = Timestamp.fromMillis(nowMs);

  // 1. Transfer kepemilikan properti ke Bank Priangan & buka agunan
  if (propSnap.exists) {
    tx.update(propSnap.ref, {
      ownerId: 'bank_priangan',
      ownerType: 'system',
      ownerName: 'Bank Priangan (Sitaan KPR)',
      activeListingId: null,
      activeLeaseId: null,
      activeAuctionId: auctionId,
      mortgageInfo: null,
      certificateId: `SHM_SITAAN_${propertyId}_${nowMs}`,
      updatedAtMs: nowMs,
    });
  }

  // 2. Cabut kunci akses penghuni lama
  tx.delete(buildMemberAccessRef(firestore, propertyId, borrowerId));

  // 3. Jika ada listing/sewa aktif di properti tsb, batalkan referensinya
  if (propData?.activeListingId) {
    tx.update(firestore.collection('property_listings').doc(String(propData.activeListingId)), {
      status: 'cancelled',
    });
  }
  if (propData?.activeLeaseId) {
    tx.update(firestore.collection('leases').doc(String(propData.activeLeaseId)), {
      status: 'terminated',
      endedAtMs: nowMs,
    });
  }

  // 4. Buat lelang sitaan Bank Priangan
  tx.set(firestore.collection('auctions').doc(auctionId), {
    id: auctionId,
    sellerId: 'bank_priangan',
    sellerName: 'Bank Priangan (Sitaan KPR)',
    subjectType: 'property',
    subjectId: propertyId,
    subject: {
      propertyId,
      name: propName,
      type: String(propData?.type || 'rumah'),
      areaTag: String(propData?.areaTag || 'perumahan'),
      baseValue,
      foreclosureMortgageId: mortgageSnap.id,
    },
    startPrice,
    minIncrement: 10_000,
    currentBid: 0,
    currentBidderId: null,
    currentBidderName: null,
    currentBidderSource: null,
    bidCount: 0,
    extensionsUsed: 0,
    endsAtMs: nowMs + mortgageConfig.foreclosureAuctionDurationMs,
    status: 'active',
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  });

  // 5. Update status KPR & tagihan tertunggak
  tx.update(mortgageSnap.ref, {
    status: 'foreclosed',
    foreclosedAtMs: nowMs,
    foreclosureAuctionId: auctionId,
    updatedAtMs: nowMs,
  });

  for (const billDoc of unpaidMortgageBills) {
    tx.update(billDoc.ref, { status: 'defaulted' });
  }

  // 6. Penalti skor kredit & reputasi borrower + bersihkan currentHomeId bila properti disita
  if (borrowerSnap.exists) {
    const bData = borrowerSnap.data()!;
    const curCredit = Number(
      accSnap?.exists ? accSnap.data()!.creditScore : bData.creditScore ?? 65
    );
    const nextCredit = clampCreditScore(curCredit - 18);
    const nextRep = Math.max(0, Number(bData.reputation ?? 50) - 10);
    const nextHomeId = bData.currentHomeId === propertyId ? fallbackHomeId : bData.currentHomeId ?? null;

    tx.update(borrowerSnap.ref, {
      currentHomeId: nextHomeId,
      homeless: !nextHomeId,
      creditScore: nextCredit,
      reputation: nextRep,
      updatedAt: now,
    });

    if (accSnap?.exists) {
      tx.update(accSnap.ref, {
        creditScore: nextCredit,
        updatedAtMs: nowMs,
      });
    }

    appendTransaction(tx, firestore, borrowerId, {
      type: 'penalty',
      category: 'sitaan_kpr',
      amount: 0,
      balanceAfter: Number(bData.money || 0),
      description: `Penyitaan KPR ${propName} akibat tunggakan cicilan`,
      nowMs,
    });
  }

  appendLedger(tx, firestore, {
    from: borrowerId,
    to: 'system:bank',
    amount: Math.round(Number(mort.remaining || 0)),
    reason: 'mortgage_foreclosed',
    refId: mortgageSnap.id,
    nowMs,
  });

  return { auctionId, propertyId, startPrice };
}

/**
 * Evaluasi lazy Fase 6 (KPR, IMB Kavling, dan Konstruksi multi-fase) pada login / syncPlayerState / getBills.
 */
export async function syncLazyMortgageAndConstructionState(
  firestore: Firestore,
  uid: string,
  nowMs: number
): Promise<{
  mortgageBillsCreated: number;
  foreclosedCount: number;
  permitsApproved: number;
  constructionsAdvanced: number;
}> {
  let mortgageBillsCreated = 0;
  let foreclosedCount = 0;
  let permitsApproved = 0;
  let constructionsAdvanced = 0;

  // 1. Proses KPR aktif milik pemain
  const activeMortSnap = await firestore
    .collection('mortgages')
    .where('borrowerId', '==', uid)
    .where('status', '==', 'active')
    .limit(5)
    .get();

  if (!activeMortSnap.empty) {
    const ownedPropsSnap = await firestore
      .collection('properties')
      .where('ownerId', '==', uid)
      .limit(10)
      .get();

    for (const mDoc of activeMortSnap.docs) {
      const mDataPre = mDoc.data();
      const propId = String(mDataPre.propertyId);
      const fallbackHomeId = ownedPropsSnap.docs.find((p) => p.id !== propId)?.id ?? null;

      const unpaidSnapPre = await firestore
        .collection('characters')
        .doc(uid)
        .collection('bills')
        .where('uid', '==', uid)
        .where('status', '==', 'unpaid')
        .limit(30)
        .get();
      const relatedBillRefs = unpaidSnapPre.docs
        .filter((d) => d.data().mortgageId === mDoc.id)
        .map((d) => d.ref);

      await firestore.runTransaction(async (tx) => {
        const mortRef = mDoc.ref;
        const propRef = firestore.collection('properties').doc(propId);
        const charRef = firestore.collection('characters').doc(uid);
        const accRef = firestore.collection('accounts').doc(uid);

        const [freshMort, freshProp, freshChar, freshAcc, ...billSnaps] = await Promise.all([
          tx.get(mortRef),
          tx.get(propRef),
          tx.get(charRef),
          tx.get(accRef),
          ...relatedBillRefs.map((ref) => tx.get(ref)),
        ]);

        if (!freshMort.exists || !freshChar.exists) return;
        const m = freshMort.data()!;
        if (m.status !== 'active') return;

        const remaining = Number(m.remaining || 0);
        if (remaining <= 0) {
          tx.update(mortRef, { status: 'paid', remaining: 0, updatedAtMs: nowMs });
          if (freshProp.exists) tx.update(propRef, { mortgageInfo: null, updatedAtMs: nowMs });
          return;
        }

        const nextDueAtMs = Number(m.nextDueAtMs || nowMs);
        const paidCycles = Number(m.paidCycles || 0);
        const cycleIdx = paidCycles + 1;
        const billId = `kpr_${mDoc.id}_c${cycleIdx}`;
        const billRef = charRef.collection('bills').doc(billId);
        const billSnap = await tx.get(billRef);
        const dueAmount = Math.min(remaining, Number(m.installment || remaining));

        if (!billSnap.exists && nowMs >= nextDueAtMs - GAME_DAY_DURATION_MS) {
          tx.set(billRef, {
            id: billId,
            uid,
            billType: 'mortgage_installment',
            title: `Cicilan KPR ${String(m.propertyName || propId)} (#${cycleIdx})`,
            periodIndex: cycleIdx,
            baseAmount: dueAmount,
            lateFee: 0,
            status: 'unpaid',
            propertyId: propId,
            mortgageId: mDoc.id,
            dueAtMs: nextDueAtMs,
          });
          mortgageBillsCreated += 1;
        }

        const graceEnd = nextDueAtMs + mortgageConfig.gracePeriodMs;
        const lastPenaltyCycle = Number(m.lastPenaltyCycle || 0);
        if (nowMs > graceEnd && lastPenaltyCycle < cycleIdx) {
          const overdueCycles =
            1 + Math.floor(Math.max(0, nowMs - graceEnd) / mortgageConfig.cycleMs);
          const nextMissed = Math.max(Number(m.missedCount || 0) + 1, overdueCycles);
          const lateFee = Math.round(dueAmount * mortgageConfig.lateFeeRate);

          if (billSnap.exists && billSnap.data()!.status === 'unpaid') {
            tx.update(billRef, { lateFee });
          }

          if (nextMissed >= mortgageConfig.maxMissedBeforeForeclosure) {
            const existingUnpaid = billSnaps.filter(
              (b) => b.exists && b.data()!.status === 'unpaid'
            );
            applyForeclosureInTx(tx, firestore, {
              mortgageSnap: freshMort,
              propSnap: freshProp,
              borrowerSnap: freshChar,
              accSnap: freshAcc.exists ? freshAcc : null,
              unpaidMortgageBills: existingUnpaid,
              fallbackHomeId,
              nowMs,
            });
            foreclosedCount += 1;
            return;
          }

          const curScore = Number(
            freshAcc.exists ? freshAcc.data()!.creditScore : freshChar.data()!.creditScore ?? 65
          );
          const nextScore = clampCreditScore(curScore - 6);
          tx.update(charRef, { creditScore: nextScore });
          if (freshAcc.exists) {
            tx.update(accRef, { creditScore: nextScore, updatedAtMs: nowMs });
          }
          tx.update(mortRef, {
            missedCount: nextMissed,
            lastPenaltyCycle: cycleIdx,
            updatedAtMs: nowMs,
          });
        }
      });
    }
  }

  // 2. Auto-approve IMB kavling bila permitReadyAtMs sudah tercapai
  const pendingPermitsSnap = await firestore
    .collection('land_plots')
    .where('ownerId', '==', uid)
    .where('permitStatus', '==', 'pending')
    .limit(10)
    .get();

  for (const pDoc of pendingPermitsSnap.docs) {
    const pData = pDoc.data();
    if (nowMs >= Number(pData.permitReadyAtMs || 0)) {
      await pDoc.ref.update({
        permitStatus: 'approved',
        updatedAtMs: nowMs,
      });
      permitsApproved += 1;
    }
  }

  // 3. Auto-advance fase konstruksi berdasarkan timestamp
  const activeConstructionsSnap = await firestore
    .collection('constructions')
    .where('ownerId', '==', uid)
    .where('status', '==', 'active')
    .limit(8)
    .get();

  for (const cDoc of activeConstructionsSnap.docs) {
    const cData = cDoc.data();
    const blueprints = constructionConfig.blueprints as Record<
      string,
      { phaseDurationSec?: number }
    >;
    const bp = blueprints[String(cData.blueprintId)] ?? blueprints.kecil;
    const progress = computeElapsedConstructionPhase({
      currentPhase: String(cData.phase || 'pondasi'),
      phaseStartedAtMs: Number(cData.phaseStartedAtMs || cData.startedAtMs || nowMs),
      phaseEndsAtMs: Number(cData.phaseEndsAtMs || nowMs),
      phaseDurationSec: Number(bp?.phaseDurationSec || 40),
      nowMs,
    });
    if (progress.advanced) {
      await cDoc.ref.update({
        phase: progress.phase,
        phaseStartedAtMs: progress.phaseStartedAtMs,
        phaseEndsAtMs: progress.phaseEndsAtMs,
      });
      constructionsAdvanced += 1;
    }
  }

  return { mortgageBillsCreated, foreclosedCount, permitsApproved, constructionsAdvanced };
}

export function isNearPoliceOrCourt(x: number, z: number): boolean {
  return distance2D(x, z, lawConfig.policeStation.x, lawConfig.policeStation.z) <= 18;
}
