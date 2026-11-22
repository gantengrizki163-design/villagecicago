"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respondOffer = exports.makeOffer = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const housing_1 = require("../helpers/housing");
const phase2_1 = require("../helpers/phase2");
exports.makeOffer = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const listingId = typeof data?.listingId === 'string' ? data.listingId.trim() : '';
    const amount = Math.round(Number(data?.amount || 0));
    const note = typeof data?.note === 'string' ? data.note.trim().slice(0, 140) : '';
    if (!(0, housing_1.isValidSimpleId)(listingId) || amount < 10_000 || amount > 100_000_000) {
        throw new https_1.HttpsError('invalid-argument', 'Listing atau nominal penawaran tidak valid.');
    }
    const nowMs = Date.now();
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const listingRef = firebase_1.db.collection('property_listings').doc(listingId);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const [charDoc, listingDoc] = await Promise.all([tx.get(charRef), tx.get(listingRef)]);
        if (!charDoc.exists)
            throw new https_1.HttpsError('not-found', 'Karakter tidak ditemukan.');
        if (!listingDoc.exists)
            throw new https_1.HttpsError('not-found', 'Listing tidak ditemukan.');
        const charData = charDoc.data();
        const listing = listingDoc.data();
        if (listing.status !== 'active') {
            throw new https_1.HttpsError('failed-precondition', 'Listing sudah tidak aktif.');
        }
        if (listing.ownerId === uid) {
            throw new https_1.HttpsError('failed-precondition', 'Tidak bisa menawar properti milik sendiri.');
        }
        const askingPrice = Number(listing.price);
        const ns = phase2_1.housingConfig.negotiationSettings;
        const reputation = Number(charData.reputation ?? 60);
        let status = 'pending';
        let counterAmount = null;
        let responseNote = note;
        if (listing.ownerType === 'npc') {
            const maxDiscount = reputation >= ns.npcHighRepThreshold
                ? ns.npcMaxDiscountHighRep
                : ns.npcMaxDiscountBase;
            const minAcceptable = Math.round((askingPrice * (1 - maxDiscount)) / 1000) * 1000;
            if (amount >= minAcceptable) {
                status = 'accepted';
                responseNote = `Agen menyetujui tawaran Rp ${amount.toLocaleString('id-ID')}!`;
            }
            else if (amount >= askingPrice * ns.npcAutoCounterRatio) {
                status = 'countered';
                counterAmount =
                    Math.round(((amount + minAcceptable) * ns.npcCounterMidpointShare) / 1000) * 1000;
                responseNote = `Agen memberi counter-offer Rp ${counterAmount.toLocaleString('id-ID')}.`;
            }
            else {
                status = 'rejected';
                responseNote = `Tawaran terlalu rendah. Maksimal diskon agen ${(maxDiscount * 100).toFixed(0)}%.`;
            }
        }
        const offerId = `offer_${listingId}_${uid}_${nowMs}`;
        const expiresAtMs = nowMs + ns.offerExpiryMs;
        tx.set(firebase_1.db.collection('offers').doc(offerId), {
            id: offerId,
            listingId,
            propertyId: String(listing.propertyId),
            propertyName: String(listing.propertyName),
            kind: String(listing.kind),
            buyerId: uid,
            buyerName: String(charData.name),
            ownerId: String(listing.ownerId),
            ownerType: String(listing.ownerType),
            askingPrice,
            amount,
            counterAmount,
            status,
            note: responseNote,
            createdAtMs: nowMs,
            expiresAtMs,
        });
        return {
            offerId,
            status,
            amount,
            counterAmount,
            note: responseNote,
            expiresAtMs,
        };
    });
    return { ok: true, ...result };
});
exports.respondOffer = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const offerId = typeof data?.offerId === 'string' ? data.offerId.trim() : '';
    const action = data?.action;
    if (!(0, housing_1.isValidSimpleId)(offerId) ||
        (action !== 'accept' && action !== 'reject' && action !== 'counter' && action !== 'accept_counter')) {
        throw new https_1.HttpsError('invalid-argument', 'Aksi atau ID penawaran tidak valid.');
    }
    const nowMs = Date.now();
    const offerRef = firebase_1.db.collection('offers').doc(offerId);
    const result = await firebase_1.db.runTransaction(async (tx) => {
        const offerDoc = await tx.get(offerRef);
        if (!offerDoc.exists)
            throw new https_1.HttpsError('not-found', 'Penawaran tidak ditemukan.');
        const offer = offerDoc.data();
        if (nowMs > Number(offer.expiresAtMs || 0)) {
            tx.update(offerRef, { status: 'expired' });
            throw new https_1.HttpsError('failed-precondition', 'Penawaran ini sudah kedaluwarsa.');
        }
        if (action === 'accept_counter') {
            if (offer.buyerId !== uid) {
                throw new https_1.HttpsError('permission-denied', 'Hanya penawar yang dapat menyetujui counter-offer.');
            }
            if (offer.status !== 'countered' || !offer.counterAmount) {
                throw new https_1.HttpsError('failed-precondition', 'Tidak ada counter-offer aktif.');
            }
            tx.update(offerRef, {
                status: 'accepted',
                amount: Number(offer.counterAmount),
            });
            return { offerId, status: 'accepted', amount: Number(offer.counterAmount) };
        }
        if (offer.ownerId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Hanya pemilik properti yang dapat merespons tawaran.');
        }
        if (offer.status !== 'pending' && offer.status !== 'countered') {
            throw new https_1.HttpsError('failed-precondition', 'Status tawaran sudah final.');
        }
        if (action === 'accept') {
            tx.update(offerRef, { status: 'accepted' });
            return { offerId, status: 'accepted', amount: Number(offer.amount) };
        }
        if (action === 'reject') {
            tx.update(offerRef, { status: 'rejected' });
            return { offerId, status: 'rejected', amount: Number(offer.amount) };
        }
        const counterVal = Math.round(Number(data?.counterAmount || 0));
        if (counterVal < 10_000 || counterVal > 100_000_000) {
            throw new https_1.HttpsError('invalid-argument', 'Nominal counter-offer tidak valid.');
        }
        tx.update(offerRef, {
            status: 'countered',
            counterAmount: counterVal,
            expiresAtMs: nowMs + phase2_1.housingConfig.negotiationSettings.offerExpiryMs,
        });
        return { offerId, status: 'countered', counterAmount: counterVal };
    });
    return { ok: true, ...result };
});
//# sourceMappingURL=offers.js.map