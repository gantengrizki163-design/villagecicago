import type { DocumentSnapshot, Firestore, Transaction } from 'firebase-admin/firestore';

export type TreasuryTaxCategory =
  | 'income'
  | 'business'
  | 'property'
  | 'market'
  | 'auction'
  | 'bank'
  | 'vehicle';

export function appendLedger(
  tx: Transaction,
  firestore: Firestore,
  entry: {
    from: string;
    to: string;
    amount: number;
    taxAmount?: number;
    reason: string;
    refId: string;
    nowMs: number;
  }
): string {
  const entryId = `led_${entry.nowMs}_${Math.random().toString(36).slice(2, 8)}`;
  const ref = firestore.collection('ledger').doc(entryId);
  tx.set(ref, {
    id: entryId,
    from: entry.from,
    to: entry.to,
    amount: Math.max(0, Math.round(entry.amount)),
    taxAmount: Math.max(0, Math.round(entry.taxAmount ?? 0)),
    reason: entry.reason.slice(0, 64),
    refId: entry.refId.slice(0, 80),
    atMs: entry.nowMs,
  });
  return entryId;
}

export function applyTreasuryCredit(
  tx: Transaction,
  firestore: Firestore,
  treasurySnap: DocumentSnapshot,
  taxAmount: number,
  category: TreasuryTaxCategory,
  nowMs: number
): void {
  const cleanTax = Math.max(0, Math.round(taxAmount));
  if (cleanTax <= 0) return;

  const ref = firestore.collection('state').doc('treasury');
  const data = treasurySnap.exists ? treasurySnap.data() || {} : {};

  const balance = Number(data.balance || 0) + cleanTax;
  const totalTaxCollected = Number(data.totalTaxCollected || 0) + cleanTax;
  const incomeTaxTotal = Number(data.incomeTaxTotal || 0) + (category === 'income' ? cleanTax : 0);
  const businessTaxTotal =
    Number(data.businessTaxTotal || 0) + (category === 'business' ? cleanTax : 0);
  const propertyTaxTotal =
    Number(data.propertyTaxTotal || 0) + (category === 'property' ? cleanTax : 0);
  const marketFeeTotal = Number(data.marketFeeTotal || 0) + (category === 'market' ? cleanTax : 0);
  const auctionFeeTotal = Number(data.auctionFeeTotal || 0) + (category === 'auction' ? cleanTax : 0);
  const vehicleTaxTotal = Number(data.vehicleTaxTotal || 0) + (category === 'vehicle' ? cleanTax : 0);

  if (!treasurySnap.exists) {
    tx.set(ref, {
      balance,
      totalTaxCollected,
      incomeTaxTotal,
      businessTaxTotal,
      propertyTaxTotal,
      marketFeeTotal,
      auctionFeeTotal,
      vehicleTaxTotal,
      inflationIndex: 1.0,
      activeEventId: 'normal',
      activeEventUntilMs: nowMs + 7_200_000,
      estimatedMoneySupply: 0,
      updatedAtMs: nowMs,
    });
  } else {
    tx.update(ref, {
      balance,
      totalTaxCollected,
      incomeTaxTotal,
      businessTaxTotal,
      propertyTaxTotal,
      marketFeeTotal,
      auctionFeeTotal,
      vehicleTaxTotal,
      updatedAtMs: nowMs,
    });
  }
}
