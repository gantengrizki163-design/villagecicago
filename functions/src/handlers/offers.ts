import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import { isValidSimpleId } from '../helpers/housing';
import { housingConfig } from '../helpers/phase2';

export const makeOffer = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as {
      listingId?: unknown;
      amount?: unknown;
      note?: unknown;
    };

    const listingId = typeof data?.listingId === 'string' ? data.listingId.trim() : '';
    const amount = Math.round(Number(data?.amount || 0));
    const note = typeof data?.note === 'string' ? data.note.trim().slice(0, 140) : '';

    if (!isValidSimpleId(listingId) || amount < 10_000 || amount > 100_000_000) {
      throw new HttpsError('invalid-argument', 'Listing atau nominal penawaran tidak valid.');
    }

    const nowMs = Date.now();
    const charRef = db.collection('characters').doc(uid);
    const listingRef = db.collection('property_listings').doc(listingId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, listingDoc] = await Promise.all([tx.get(charRef), tx.get(listingRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      if (!listingDoc.exists) throw new HttpsError('not-found', 'Listing tidak ditemukan.');

      const charData = charDoc.data()!;
      const listing = listingDoc.data()!;

      if (listing.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Listing sudah tidak aktif.');
      }
      if (listing.ownerId === uid) {
        throw new HttpsError('failed-precondition', 'Tidak bisa menawar properti milik sendiri.');
      }

      const askingPrice = Number(listing.price);
      const ns = housingConfig.negotiationSettings;
      const reputation = Number(charData.reputation ?? 60);

      let status: 'pending' | 'accepted' | 'rejected' | 'countered' = 'pending';
      let counterAmount: number | null = null;
      let responseNote = note;

      if (listing.ownerType === 'npc') {
        const maxDiscount =
          reputation >= ns.npcHighRepThreshold
            ? ns.npcMaxDiscountHighRep
            : ns.npcMaxDiscountBase;
        const minAcceptable = Math.round((askingPrice * (1 - maxDiscount)) / 1000) * 1000;

        if (amount >= minAcceptable) {
          status = 'accepted';
          responseNote = `Agen menyetujui tawaran Rp ${amount.toLocaleString('id-ID')}!`;
        } else if (amount >= askingPrice * ns.npcAutoCounterRatio) {
          status = 'countered';
          counterAmount =
            Math.round(((amount + minAcceptable) * ns.npcCounterMidpointShare) / 1000) * 1000;
          responseNote = `Agen memberi counter-offer Rp ${counterAmount.toLocaleString('id-ID')}.`;
        } else {
          status = 'rejected';
          responseNote = `Tawaran terlalu rendah. Maksimal diskon agen ${(maxDiscount * 100).toFixed(0)}%.`;
        }
      }

      const offerId = `offer_${listingId}_${uid}_${nowMs}`;
      const expiresAtMs = nowMs + ns.offerExpiryMs;

      tx.set(db.collection('offers').doc(offerId), {
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
  }
);

export const respondOffer = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as {
      offerId?: unknown;
      action?: unknown;
      counterAmount?: unknown;
    };

    const offerId = typeof data?.offerId === 'string' ? data.offerId.trim() : '';
    const action = data?.action;
    if (
      !isValidSimpleId(offerId) ||
      (action !== 'accept' && action !== 'reject' && action !== 'counter' && action !== 'accept_counter')
    ) {
      throw new HttpsError('invalid-argument', 'Aksi atau ID penawaran tidak valid.');
    }

    const nowMs = Date.now();
    const offerRef = db.collection('offers').doc(offerId);

    const result = await db.runTransaction(async (tx) => {
      const offerDoc = await tx.get(offerRef);
      if (!offerDoc.exists) throw new HttpsError('not-found', 'Penawaran tidak ditemukan.');

      const offer = offerDoc.data()!;
      if (nowMs > Number(offer.expiresAtMs || 0)) {
        tx.update(offerRef, { status: 'expired' });
        throw new HttpsError('failed-precondition', 'Penawaran ini sudah kedaluwarsa.');
      }

      if (action === 'accept_counter') {
        if (offer.buyerId !== uid) {
          throw new HttpsError('permission-denied', 'Hanya penawar yang dapat menyetujui counter-offer.');
        }
        if (offer.status !== 'countered' || !offer.counterAmount) {
          throw new HttpsError('failed-precondition', 'Tidak ada counter-offer aktif.');
        }
        tx.update(offerRef, {
          status: 'accepted',
          amount: Number(offer.counterAmount),
        });
        return { offerId, status: 'accepted', amount: Number(offer.counterAmount) };
      }

      if (offer.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Hanya pemilik properti yang dapat merespons tawaran.');
      }
      if (offer.status !== 'pending' && offer.status !== 'countered') {
        throw new HttpsError('failed-precondition', 'Status tawaran sudah final.');
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
        throw new HttpsError('invalid-argument', 'Nominal counter-offer tidak valid.');
      }
      tx.update(offerRef, {
        status: 'countered',
        counterAmount: counterVal,
        expiresAtMs: nowMs + housingConfig.negotiationSettings.offerExpiryMs,
      });
      return { offerId, status: 'countered', counterAmount: counterVal };
    });

    return { ok: true, ...result };
  }
);
