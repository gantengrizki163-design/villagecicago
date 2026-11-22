"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.foreclose = exports.earlyRepay = exports.payMortgage = exports.applyMortgage = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const bank_1 = require("../helpers/bank");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const law_1 = require("../helpers/law");
const ledger_1 = require("../helpers/ledger");
const location_1 = require("../helpers/location");
const phase2_1 = require("../helpers/phase2");
const propertyAdvanced_1 = require("../helpers/propertyAdvanced");
/**
 * 1. applyMortgage: Ajukan KPR di Bank Priangan / Kantor Agen Properti.
 */
exports.applyMortgage = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const propertyId = (0, housing_1.isValidSimpleId)(data.propertyId) ? data.propertyId.trim() : '';
    const offerId = (0, housing_1.isValidSimpleId)(data.offerId) ? data.offerId.trim() : '';
    const downPaymentRate = Number(data.downPaymentRate ?? propertyAdvanced_1.mortgageConfig.minDownPaymentRate);
    const termCycles = Math.floor(Number(data.termCycles ?? 12));
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    if (!propertyId) {
        throw new https_1.HttpsError('invalid-argument', 'ID properti wajib diisi.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const propRef = firebase_1.db.collection('properties').doc(propertyId);
    const offerRef = offerId ? firebase_1.db.collection('offers').doc(offerId) : null;
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const [charPre, activeMortSnap, completedShiftsSnap] = await Promise.all([
        charRef.get(),
        firebase_1.db
            .collection('mortgages')
            .where('borrowerId', '==', uid)
            .where('status', '==', 'active')
            .limit(propertyAdvanced_1.mortgageConfig.maxActiveMortgages + 1)
            .get(),
        charRef
            .collection('shifts')
            .where('status', '==', 'completed')
            .limit(propertyAdvanced_1.mortgageConfig.minCompletedShifts)
            .get(),
    ]);
    if (!charPre.exists)
        throw new https_1.HttpsError('not-found', 'Karakter belum ditemukan.');
    const charPreData = charPre.data();
    if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
        throw new https_1.HttpsError('failed-precondition', 'Pengajuan KPR hanya dilayani di zona Cicalengka.');
    }
    await (0, location_1.assertNearLocation)(firebase_1.rtdb, uid, charPreData, ['bank', 'kantor_agen'], 0, [], 'Datangi Bank Priangan atau Kantor Agen Properti untuk mengajukan KPR.');
    if (activeMortSnap.size >= propertyAdvanced_1.mortgageConfig.maxActiveMortgages) {
        throw new https_1.HttpsError('failed-precondition', `Maksimal ${propertyAdvanced_1.mortgageConfig.maxActiveMortgages} kontrak KPR aktif sekaligus.`);
    }
    const recordedShifts = Math.max(Number(charPreData.completedShifts ?? charPreData.totalShiftsCompleted ?? 0), completedShiftsSnap.size);
    if (recordedShifts < propertyAdvanced_1.mortgageConfig.minCompletedShifts) {
        throw new https_1.HttpsError('failed-precondition', `Minimal selesaikan ${propertyAdvanced_1.mortgageConfig.minCompletedShifts} shift kerja terlebih dahulu sebelum mengajukan KPR.`);
    }
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, accDoc, propDoc, offerDoc, treasuryDoc] = await Promise.all([
            tx.get(charRef),
            tx.get(accRef),
            tx.get(propRef),
            offerRef ? tx.get(offerRef) : Promise.resolve(null),
            tx.get(treasuryRef),
        ]);
        if (!charDoc.exists || !propDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Karakter atau properti tidak ditemukan.');
        }
        if (!accDoc.exists) {
            throw new https_1.HttpsError('failed-precondition', 'Buka rekening Bank Priangan terlebih dahulu untuk mengajukan KPR.');
        }
        const charData = charDoc.data();
        const accData = accDoc.data();
        const prop = propDoc.data();
        if (charData.sentence?.active) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak dapat mengajukan KPR saat menjalani hukuman.');
        }
        const wanted = (0, law_1.computeLazyWantedLevel)(Number(charData.wantedLevel || 0), Number(charData.wantedUpdatedAtMs || nowMs), nowMs);
        if (wanted > propertyAdvanced_1.mortgageConfig.maxWantedLevelAllowed) {
            throw new https_1.HttpsError('failed-precondition', 'Lunasi status DPO / masalah hukum terlebih dahulu sebelum mengajukan KPR.');
        }
        const creditScore = Number(accData.creditScore ?? charData.creditScore ?? 65);
        const reputation = Number(charData.reputation ?? 50);
        if (creditScore < propertyAdvanced_1.mortgageConfig.minCreditScore) {
            throw new https_1.HttpsError('failed-precondition', `Skor kredit minimal ${propertyAdvanced_1.mortgageConfig.minCreditScore} untuk lolos KPR (saat ini: ${creditScore}).`);
        }
        if (reputation < propertyAdvanced_1.mortgageConfig.minReputation) {
            throw new https_1.HttpsError('failed-precondition', `Reputasi warga minimal ${propertyAdvanced_1.mortgageConfig.minReputation} untuk lolos KPR (saat ini: ${reputation}).`);
        }
        if (prop.ownerId === uid) {
            throw new https_1.HttpsError('failed-precondition', 'Properti ini sudah menjadi milikmu.');
        }
        if (prop.activeLeaseId || prop.activeAuctionId || prop.mortgageInfo?.status === 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Properti sedang terikat sewa, lelang, atau agunan KPR lain.');
        }
        const listingId = typeof prop.activeListingId === 'string' ? prop.activeListingId : null;
        const listingRef = listingId ? firebase_1.db.collection('property_listings').doc(listingId) : null;
        const sellerRef = prop.ownerType === 'player' ? firebase_1.db.collection('characters').doc(String(prop.ownerId)) : null;
        const [listingDoc, sellerDoc] = await Promise.all([
            listingRef ? tx.get(listingRef) : Promise.resolve(null),
            sellerRef ? tx.get(sellerRef) : Promise.resolve(null),
        ]);
        let price = 0;
        if (offerDoc?.exists) {
            const off = offerDoc.data();
            if (off.buyerId !== uid ||
                off.propertyId !== propertyId ||
                off.kind !== 'sale' ||
                off.status !== 'accepted') {
                throw new https_1.HttpsError('failed-precondition', 'Penawaran beli belum disetujui atau tidak valid.');
            }
            if (nowMs > Number(off.expiresAtMs || 0)) {
                throw new https_1.HttpsError('failed-precondition', 'Penawaran sudah kedaluwarsa.');
            }
            price = Number(off.amount || 0);
        }
        else {
            if (!listingDoc?.exists || listingDoc.data()?.status !== 'active' || listingDoc.data()?.kind !== 'sale') {
                throw new https_1.HttpsError('failed-precondition', 'Properti ini tidak sedang berstatus dijual.');
            }
            price = Number(listingDoc.data().price || 0);
        }
        const quote = (0, propertyAdvanced_1.computeMortgageQuote)(price, downPaymentRate, termCycles);
        if (!quote) {
            throw new https_1.HttpsError('invalid-argument', 'Rasio uang muka (20%–60%) atau tenor KPR (8/12/16 siklus) tidak valid.');
        }
        // Cek kecukupan dana untuk DP + Bea Balik Nama 2.5%
        const walletMoney = Number(charData.money || 0);
        const bankBalance = Number(accData.balance || 0);
        if (payFrom === 'bank') {
            if (bankBalance < quote.upfrontTotal) {
                throw new https_1.HttpsError('failed-precondition', `Saldo rekening kurang. Butuh DP + BPHTB Rp ${quote.upfrontTotal.toLocaleString('id-ID')}.`);
            }
        }
        else if (walletMoney < quote.upfrontTotal) {
            throw new https_1.HttpsError('failed-precondition', `Uang tunai kurang. Butuh DP + BPHTB Rp ${quote.upfrontTotal.toLocaleString('id-ID')}.`);
        }
        const nextWalletMoney = payFrom === 'wallet' ? walletMoney - quote.upfrontTotal : walletMoney;
        const nextBankBalance = payFrom === 'bank' ? bankBalance - quote.upfrontTotal : bankBalance;
        // Bayar penjual properti (jika properti milik pemain lain)
        if (sellerDoc?.exists && sellerRef) {
            const sellerNextMoney = Number(sellerDoc.data().money || 0) + price;
            tx.update(sellerRef, { money: sellerNextMoney, updatedAt: now });
            (0, phase2_1.appendTransaction)(tx, firebase_1.db, String(prop.ownerId), {
                type: 'income',
                category: 'jual_properti_kpr',
                amount: price,
                balanceAfter: sellerNextMoney,
                description: `Penjualan ${String(prop.name)} via KPR Bank Priangan ke ${String(charData.name)}`,
                nowMs,
            });
        }
        const condition = (0, housing_1.computeLazyPropertyCondition)(Number(prop.condition ?? 80), Number(prop.lastConditionDecayAtMs ?? nowMs), nowMs);
        const mortgageId = `kpr_${propertyId}_${nowMs}`;
        const certificateId = `SHM_KPR_${propertyId}_${nowMs}`;
        const nextDueAtMs = nowMs + propertyAdvanced_1.mortgageConfig.cycleMs;
        tx.set(firebase_1.db.collection('mortgages').doc(mortgageId), {
            id: mortgageId,
            borrowerId: uid,
            borrowerName: String(charData.name || 'Warga'),
            propertyId,
            propertyName: String(prop.name),
            propertyPrice: price,
            principal: quote.principal,
            downPayment: quote.downPayment,
            rate: quote.interestRatePerTerm,
            termCycles: quote.termCycles,
            paidCycles: 0,
            installment: quote.installment,
            nextDueAtMs,
            remaining: quote.totalRepayment,
            missedCount: 0,
            lastPenaltyCycle: 0,
            status: 'active',
            createdAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        tx.update(propRef, {
            ownerId: uid,
            ownerType: 'player',
            ownerName: String(charData.name || 'Warga'),
            activeListingId: null,
            mortgageInfo: {
                mortgageId,
                remaining: quote.totalRepayment,
                status: 'active',
            },
            certificateId,
            condition,
            lastConditionDecayAtMs: nowMs,
            lastTaxAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        if (listingDoc?.exists && listingRef) {
            tx.update(listingRef, { status: 'closed' });
        }
        if (offerDoc?.exists && offerRef) {
            tx.update(offerRef, { status: 'completed' });
        }
        tx.set((0, housing_1.buildMemberAccessRef)(firebase_1.db, propertyId, uid), {
            uid,
            propertyId,
            role: 'owner',
            grantedAtMs: nowMs,
        });
        const nextCredit = (0, bank_1.clampCreditScore)(creditScore + 2);
        const nextRep = Math.min(100, reputation + 4);
        if (payFrom === 'bank') {
            tx.update(accRef, {
                balance: nextBankBalance,
                creditScore: nextCredit,
                updatedAtMs: nowMs,
            });
        }
        else {
            tx.update(accRef, {
                creditScore: nextCredit,
                updatedAtMs: nowMs,
            });
        }
        tx.update(charRef, {
            money: nextWalletMoney,
            currentHomeId: charData.currentHomeId || propertyId,
            homeless: false,
            creditScore: nextCredit,
            reputation: nextRep,
            updatedAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'kpr_dp',
            amount: quote.upfrontTotal,
            balanceAfter: nextWalletMoney,
            description: `Uang muka & pajak KPR ${String(prop.name)} (${Math.round(quote.downPaymentRate * 100)}%)`,
            nowMs,
        });
        (0, ledger_1.applyTreasuryCredit)(tx, firebase_1.db, treasuryDoc, quote.transferTax, 'property', nowMs);
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: uid,
            to: 'system:treasury',
            amount: quote.transferTax,
            taxAmount: quote.transferTax,
            reason: 'property_kpr_transfer_tax',
            refId: mortgageId,
            nowMs,
        });
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: 'system:bank',
            to: prop.ownerType === 'player' ? String(prop.ownerId) : 'system:property',
            amount: quote.principal,
            reason: 'mortgage_principal_disbursed',
            refId: mortgageId,
            nowMs,
        });
        return {
            mortgageId,
            propertyId,
            certificateId,
            quote,
            nextDueAtMs,
            money: nextWalletMoney,
            bankBalance: nextBankBalance,
            creditScore: nextCredit,
        };
    });
    return { ok: true, ...result };
});
/**
 * 2. payMortgage: Bayar cicilan KPR berkala (1 atau beberapa siklus sekaligus).
 */
exports.payMortgage = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const mortgageId = (0, housing_1.isValidSimpleId)(data.mortgageId) ? data.mortgageId.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    const cycles = Math.max(1, Math.min(4, Math.floor(Number(data.cycles ?? 1))));
    if (!mortgageId) {
        throw new https_1.HttpsError('invalid-argument', 'ID kontrak KPR tidak valid.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const mortRef = firebase_1.db.collection('mortgages').doc(mortgageId);
    const unpaidBillsSnap = await charRef
        .collection('bills')
        .where('uid', '==', uid)
        .where('status', '==', 'unpaid')
        .limit(20)
        .get();
    const relatedBillRefs = unpaidBillsSnap.docs
        .filter((d) => d.data().mortgageId === mortgageId)
        .map((d) => d.ref);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, accDoc, mortDoc, ...billDocs] = await Promise.all([
            tx.get(charRef),
            tx.get(accRef),
            tx.get(mortRef),
            ...relatedBillRefs.map((r) => tx.get(r)),
        ]);
        if (!charDoc.exists || !mortDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Data karakter atau KPR tidak ditemukan.');
        }
        const mort = mortDoc.data();
        if (mort.borrowerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Kamu bukan debitur KPR ini.');
        }
        if (mort.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', `Kontrak KPR berstatus ${String(mort.status)}.`);
        }
        const propId = String(mort.propertyId);
        const propRef = firebase_1.db.collection('properties').doc(propId);
        const propDoc = await tx.get(propRef);
        const remaining = Number(mort.remaining || 0);
        const installment = Number(mort.installment || remaining);
        const principalToPay = Math.min(remaining, installment * cycles);
        const isLate = nowMs > Number(mort.nextDueAtMs || nowMs) + propertyAdvanced_1.mortgageConfig.gracePeriodMs;
        const lateFee = isLate ? Math.round(installment * propertyAdvanced_1.mortgageConfig.lateFeeRate) : 0;
        const totalPay = principalToPay + lateFee;
        const charData = charDoc.data();
        const walletMoney = Number(charData.money || 0);
        const bankBalance = accDoc.exists ? Number(accDoc.data().balance || 0) : 0;
        if (payFrom === 'bank') {
            if (!accDoc.exists || bankBalance < totalPay) {
                throw new https_1.HttpsError('failed-precondition', `Saldo bank kurang. Butuh Rp ${totalPay.toLocaleString('id-ID')}.`);
            }
        }
        else if (walletMoney < totalPay) {
            throw new https_1.HttpsError('failed-precondition', `Uang tunai kurang. Butuh Rp ${totalPay.toLocaleString('id-ID')}.`);
        }
        const nextWalletMoney = payFrom === 'wallet' ? walletMoney - totalPay : walletMoney;
        const nextBankBalance = payFrom === 'bank' ? bankBalance - totalPay : bankBalance;
        const nextRemaining = Math.max(0, remaining - principalToPay);
        const nextPaidCycles = Number(mort.paidCycles || 0) + cycles;
        const paidOff = nextRemaining <= 0;
        const nextDueAtMs = Number(mort.nextDueAtMs || nowMs) + cycles * propertyAdvanced_1.mortgageConfig.cycleMs;
        const curCredit = Number(accDoc.exists ? accDoc.data().creditScore : charData.creditScore ?? 65);
        const creditDelta = (isLate ? 0 : 2) + (paidOff ? 6 : 0);
        const nextCredit = (0, bank_1.clampCreditScore)(curCredit + creditDelta);
        const nextRep = Math.min(100, Number(charData.reputation ?? 50) + (paidOff ? 5 : 1));
        tx.update(mortRef, {
            remaining: nextRemaining,
            paidCycles: nextPaidCycles,
            nextDueAtMs,
            missedCount: 0,
            status: paidOff ? 'paid' : 'active',
            updatedAtMs: nowMs,
        });
        if (propDoc.exists) {
            tx.update(propRef, {
                mortgageInfo: paidOff
                    ? null
                    : { mortgageId, remaining: nextRemaining, status: 'active' },
                updatedAtMs: nowMs,
            });
        }
        // Tandai tagihan cicilan yang terbayar
        const maxCoveredCycle = nextPaidCycles;
        for (const bDoc of billDocs) {
            if (!bDoc.exists)
                continue;
            const pIdx = Number(bDoc.data().periodIndex || 0);
            if (paidOff || pIdx <= maxCoveredCycle) {
                tx.update(bDoc.ref, { status: 'paid', lateFee, paidAtMs: nowMs });
            }
        }
        if (accDoc.exists) {
            tx.update(accRef, {
                balance: nextBankBalance,
                creditScore: nextCredit,
                updatedAtMs: nowMs,
            });
        }
        tx.update(charRef, {
            money: nextWalletMoney,
            creditScore: nextCredit,
            reputation: nextRep,
            updatedAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'cicilan_kpr',
            amount: totalPay,
            balanceAfter: nextWalletMoney,
            description: paidOff
                ? `Pelunasan cicilan KPR ${String(mort.propertyName)}`
                : `Bayar ${cycles}x cicilan KPR ${String(mort.propertyName)}`,
            nowMs,
        });
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: uid,
            to: 'system:bank',
            amount: totalPay,
            reason: paidOff ? 'mortgage_paid_off' : 'mortgage_installment_paid',
            refId: mortgageId,
            nowMs,
        });
        return {
            mortgageId,
            paidOff,
            remaining: nextRemaining,
            paidCycles: nextPaidCycles,
            totalPay,
            lateFee,
            money: nextWalletMoney,
            bankBalance: nextBankBalance,
            creditScore: nextCredit,
        };
    });
    return { ok: true, ...result };
});
/**
 * 3. earlyRepay: Pelunasan dipercepat seluruh sisa KPR (+ penalti penalti pelunasan awal 3%).
 */
exports.earlyRepay = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const mortgageId = (0, housing_1.isValidSimpleId)(data.mortgageId) ? data.mortgageId.trim() : '';
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';
    if (!mortgageId) {
        throw new https_1.HttpsError('invalid-argument', 'ID kontrak KPR tidak valid.');
    }
    const nowMs = Date.now();
    const now = firestore_1.Timestamp.fromMillis(nowMs);
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const accRef = firebase_1.db.collection('accounts').doc(uid);
    const mortRef = firebase_1.db.collection('mortgages').doc(mortgageId);
    const unpaidSnap = await charRef
        .collection('bills')
        .where('uid', '==', uid)
        .where('status', '==', 'unpaid')
        .limit(20)
        .get();
    const relatedBillRefs = unpaidSnap.docs
        .filter((d) => d.data().mortgageId === mortgageId)
        .map((d) => d.ref);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, accDoc, mortDoc, ...billDocs] = await Promise.all([
            tx.get(charRef),
            tx.get(accRef),
            tx.get(mortRef),
            ...relatedBillRefs.map((r) => tx.get(r)),
        ]);
        if (!charDoc.exists || !mortDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Data KPR tidak ditemukan.');
        }
        const mort = mortDoc.data();
        if (mort.borrowerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Bukan pemilik kontrak KPR ini.');
        }
        if (mort.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'KPR sudah tidak aktif.');
        }
        const propRef = firebase_1.db.collection('properties').doc(String(mort.propertyId));
        const propDoc = await tx.get(propRef);
        const remaining = Number(mort.remaining || 0);
        const penalty = Math.round(remaining * propertyAdvanced_1.mortgageConfig.earlyRepayPenaltyRate);
        const totalPay = remaining + penalty;
        const charData = charDoc.data();
        const walletMoney = Number(charData.money || 0);
        const bankBalance = accDoc.exists ? Number(accDoc.data().balance || 0) : 0;
        if (payFrom === 'bank') {
            if (!accDoc.exists || bankBalance < totalPay) {
                throw new https_1.HttpsError('failed-precondition', `Saldo bank kurang untuk pelunasan dipercepat (Rp ${totalPay.toLocaleString('id-ID')}).`);
            }
        }
        else if (walletMoney < totalPay) {
            throw new https_1.HttpsError('failed-precondition', `Uang tunai kurang untuk pelunasan dipercepat (Rp ${totalPay.toLocaleString('id-ID')}).`);
        }
        const nextWalletMoney = payFrom === 'wallet' ? walletMoney - totalPay : walletMoney;
        const nextBankBalance = payFrom === 'bank' ? bankBalance - totalPay : bankBalance;
        const curCredit = Number(accDoc.exists ? accDoc.data().creditScore : charData.creditScore ?? 65);
        const nextCredit = (0, bank_1.clampCreditScore)(curCredit + 7);
        const nextRep = Math.min(100, Number(charData.reputation ?? 50) + 5);
        tx.update(mortRef, {
            remaining: 0,
            paidCycles: Number(mort.termCycles || mort.paidCycles || 1),
            missedCount: 0,
            status: 'paid',
            earlyRepaidAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        if (propDoc.exists) {
            tx.update(propRef, {
                mortgageInfo: null,
                updatedAtMs: nowMs,
            });
        }
        for (const bDoc of billDocs) {
            if (bDoc.exists) {
                tx.update(bDoc.ref, { status: 'paid', paidAtMs: nowMs });
            }
        }
        if (accDoc.exists) {
            tx.update(accRef, {
                balance: nextBankBalance,
                creditScore: nextCredit,
                updatedAtMs: nowMs,
            });
        }
        tx.update(charRef, {
            money: nextWalletMoney,
            creditScore: nextCredit,
            reputation: nextRep,
            updatedAt: now,
        });
        (0, phase2_1.appendTransaction)(tx, firebase_1.db, uid, {
            type: 'expense',
            category: 'pelunasan_kpr',
            amount: totalPay,
            balanceAfter: nextWalletMoney,
            description: `Pelunasan dipercepat KPR ${String(mort.propertyName)} (termasuk penalti 3%)`,
            nowMs,
        });
        (0, ledger_1.appendLedger)(tx, firebase_1.db, {
            from: uid,
            to: 'system:bank',
            amount: totalPay,
            reason: 'mortgage_early_repay',
            refId: mortgageId,
            nowMs,
        });
        return {
            mortgageId,
            remainingPaid: remaining,
            penalty,
            totalPay,
            money: nextWalletMoney,
            bankBalance: nextBankBalance,
            creditScore: nextCredit,
        };
    });
    return { ok: true, ...result };
});
/**
 * 4. foreclose: Eksekusi penyitaan properti KPR yang menunggak melewati batas toleransi -> lelang sitaan bank.
 */
exports.foreclose = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    await (0, law_1.ensurePhase6Configs)();
    const uid = request.auth.uid;
    const data = (request.data || {});
    const mortgageId = (0, housing_1.isValidSimpleId)(data.mortgageId) ? data.mortgageId.trim() : '';
    if (!mortgageId) {
        throw new https_1.HttpsError('invalid-argument', 'ID kontrak KPR tidak valid.');
    }
    const nowMs = Date.now();
    const mortRef = firebase_1.db.collection('mortgages').doc(mortgageId);
    const callerCharRef = firebase_1.db.collection('characters').doc(uid);
    const [mortPre, callerPre] = await Promise.all([mortRef.get(), callerCharRef.get()]);
    if (!mortPre.exists)
        throw new https_1.HttpsError('not-found', 'Kontrak KPR tidak ditemukan.');
    const mortPreData = mortPre.data();
    const borrowerId = String(mortPreData.borrowerId);
    const isAdmin = request.auth.token?.admin === true;
    const isPolice = callerPre.exists && callerPre.data()?.currentJob?.jobId === 'polisi';
    if (borrowerId !== uid && !isAdmin && !isPolice) {
        throw new https_1.HttpsError('permission-denied', 'Hanya debitur, petugas bank/polisi, atau admin yang dapat mengeksekusi sitaan.');
    }
    const propId = String(mortPreData.propertyId);
    const borrowerRef = firebase_1.db.collection('characters').doc(borrowerId);
    const [ownedPropsSnap, unpaidSnap] = await Promise.all([
        firebase_1.db.collection('properties').where('ownerId', '==', borrowerId).limit(10).get(),
        borrowerRef
            .collection('bills')
            .where('uid', '==', borrowerId)
            .where('status', '==', 'unpaid')
            .limit(20)
            .get(),
    ]);
    const fallbackHomeId = ownedPropsSnap.docs.find((d) => d.id !== propId)?.id ?? null;
    const relatedBillRefs = unpaidSnap.docs
        .filter((d) => d.data().mortgageId === mortgageId)
        .map((d) => d.ref);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const propRef = firebase_1.db.collection('properties').doc(propId);
        const accRef = firebase_1.db.collection('accounts').doc(borrowerId);
        const [mortDoc, propDoc, borrowerDoc, accDoc, ...billDocs] = await Promise.all([
            tx.get(mortRef),
            tx.get(propRef),
            tx.get(borrowerRef),
            tx.get(accRef),
            ...relatedBillRefs.map((r) => tx.get(r)),
        ]);
        if (!mortDoc.exists)
            throw new https_1.HttpsError('not-found', 'Kontrak KPR tidak ditemukan.');
        const m = mortDoc.data();
        if (m.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Kontrak KPR sudah tidak aktif.');
        }
        const nextDueAtMs = Number(m.nextDueAtMs || nowMs);
        const graceEnd = nextDueAtMs + propertyAdvanced_1.mortgageConfig.gracePeriodMs;
        const computedMissed = nowMs > graceEnd
            ? 1 + Math.floor(Math.max(0, nowMs - graceEnd) / propertyAdvanced_1.mortgageConfig.cycleMs)
            : 0;
        const effectiveMissed = Math.max(Number(m.missedCount || 0), computedMissed);
        if (effectiveMissed < propertyAdvanced_1.mortgageConfig.maxMissedBeforeForeclosure) {
            throw new https_1.HttpsError('failed-precondition', `KPR belum memenuhi syarat penyitaan (baru menunggak ${effectiveMissed}/${propertyAdvanced_1.mortgageConfig.maxMissedBeforeForeclosure} siklus).`);
        }
        const outcome = (0, propertyAdvanced_1.applyForeclosureInTx)(tx, firebase_1.db, {
            mortgageSnap: mortDoc,
            propSnap: propDoc,
            borrowerSnap: borrowerDoc,
            accSnap: accDoc.exists ? accDoc : null,
            unpaidMortgageBills: billDocs.filter((b) => b.exists && b.data().status === 'unpaid'),
            fallbackHomeId,
            nowMs,
        });
        return outcome;
    });
    return { ok: true, mortgageId, ...result };
});
//# sourceMappingURL=mortgage.js.map