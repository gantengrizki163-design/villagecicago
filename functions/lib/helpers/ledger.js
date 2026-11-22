"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendLedger = appendLedger;
exports.applyTreasuryCredit = applyTreasuryCredit;
function appendLedger(tx, firestore, entry) {
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
function applyTreasuryCredit(tx, firestore, treasurySnap, taxAmount, category, nowMs) {
    const cleanTax = Math.max(0, Math.round(taxAmount));
    if (cleanTax <= 0)
        return;
    const ref = firestore.collection('state').doc('treasury');
    const data = treasurySnap.exists ? treasurySnap.data() || {} : {};
    const balance = Number(data.balance || 0) + cleanTax;
    const totalTaxCollected = Number(data.totalTaxCollected || 0) + cleanTax;
    const incomeTaxTotal = Number(data.incomeTaxTotal || 0) + (category === 'income' ? cleanTax : 0);
    const businessTaxTotal = Number(data.businessTaxTotal || 0) + (category === 'business' ? cleanTax : 0);
    const propertyTaxTotal = Number(data.propertyTaxTotal || 0) + (category === 'property' ? cleanTax : 0);
    const marketFeeTotal = Number(data.marketFeeTotal || 0) + (category === 'market' ? cleanTax : 0);
    const auctionFeeTotal = Number(data.auctionFeeTotal || 0) + (category === 'auction' ? cleanTax : 0);
    if (!treasurySnap.exists) {
        tx.set(ref, {
            balance,
            totalTaxCollected,
            incomeTaxTotal,
            businessTaxTotal,
            propertyTaxTotal,
            marketFeeTotal,
            auctionFeeTotal,
            inflationIndex: 1.0,
            activeEventId: 'normal',
            activeEventUntilMs: nowMs + 7_200_000,
            estimatedMoneySupply: 0,
            updatedAtMs: nowMs,
        });
    }
    else {
        tx.update(ref, {
            balance,
            totalTaxCollected,
            incomeTaxTotal,
            businessTaxTotal,
            propertyTaxTotal,
            marketFeeTotal,
            auctionFeeTotal,
            updatedAtMs: nowMs,
        });
    }
}
//# sourceMappingURL=ledger.js.map