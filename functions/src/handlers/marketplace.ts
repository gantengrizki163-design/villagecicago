import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import { isValidSimpleId } from '../helpers/housing';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import {
  economyConfig,
  getFairPriceBounds,
  getProductMeta,
  queueMarketVolumeDelta,
  taxConfig,
} from '../helpers/market';
import { appendTransaction } from '../helpers/phase2';

export const createMarketListing = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      itemId?: unknown;
      qty?: unknown;
      unitPrice?: unknown;
      areaTag?: unknown;
    };

    const itemId = isValidSimpleId(data.itemId) ? data.itemId.trim() : '';
    const qty = Math.floor(Number(data.qty || 0));
    const unitPrice = Math.floor(Number(data.unitPrice || 0));
    const areaTag =
      typeof data.areaTag === 'string' &&
      ['stasiun', 'pasar', 'kampung', 'perumahan', 'alun_alun', 'cicalengka'].includes(data.areaTag)
        ? data.areaTag
        : 'pasar';

    if (!itemId || !Number.isFinite(qty) || qty < 1 || qty > 100) {
      throw new HttpsError('invalid-argument', 'ID barang atau jumlah (1–100) tidak valid.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 500) {
      throw new HttpsError('invalid-argument', 'Harga satuan minimal Rp 500.');
    }

    const meta = getProductMeta(itemId);
    const [activeSnap, statSnap] = await Promise.all([
      db
        .collection('market_listings')
        .where('sellerId', '==', uid)
        .where('status', '==', 'active')
        .limit(economyConfig.maxMarketListingsPerPlayer + 1)
        .get(),
      db.collection('market_stats').doc(itemId).get(),
    ]);

    if (activeSnap.size >= economyConfig.maxMarketListingsPerPlayer) {
      throw new HttpsError(
        'failed-precondition',
        `Maksimal ${economyConfig.maxMarketListingsPerPlayer} listing aktif per pemain (anti-spam).`
      );
    }

    if (meta) {
      const refMarket = statSnap.exists
        ? Number(statSnap.data()!.currentPrice || meta.suggestedRetail)
        : meta.suggestedRetail;
      const bounds = getFairPriceBounds(Math.max(refMarket, meta.basePrice));
      if (unitPrice < bounds.minPrice || unitPrice > bounds.maxPrice) {
        throw new HttpsError(
          'invalid-argument',
          `Harga wajar ${meta.name}: Rp ${bounds.minPrice.toLocaleString('id-ID')} – Rp ${bounds.maxPrice.toLocaleString('id-ID')} (cegah arbitrase & wash trading).`
        );
      }
    } else if (unitPrice > 50_000_000) {
      throw new HttpsError('invalid-argument', 'Harga satuan melebihi batas maksimum.');
    }

    const nowMs = Date.now();
    const listingId = `mkt_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const charRef = db.collection('characters').doc(uid);
    const invRef = charRef.collection('inventory').doc(itemId);
    const listingRef = db.collection('market_listings').doc(listingId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, invDoc] = await Promise.all([tx.get(charRef), tx.get(invRef)]);
      if (!charDoc.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
      if (!invDoc.exists) throw new HttpsError('failed-precondition', 'Barang tidak ada di inventaris.');

      const invData = invDoc.data()!;
      const avail = Number(invData.quantity || 0);
      if (avail < qty) {
        throw new HttpsError(
          'failed-precondition',
          `Stok inventaris kurang (tersedia ${avail}, butuh ${qty}).`
        );
      }

      const remaining = avail - qty;
      if (remaining <= 0) {
        tx.delete(invRef);
      } else {
        tx.update(invRef, { quantity: remaining, updatedAtMs: nowMs });
      }

      const itemName = String(invData.name || meta?.name || itemId);
      const category = String(invData.category || meta?.category || 'misc');
      const totalPrice = unitPrice * qty;

      tx.set(listingRef, {
        id: listingId,
        sellerId: uid,
        sellerName: String(charDoc.data()!.name || 'Warga'),
        itemId,
        itemName,
        category,
        qty,
        unitPrice,
        price: totalPrice,
        areaTag,
        status: 'active',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      if (meta) {
        queueMarketVolumeDelta(tx, db, itemId, qty, 0);
      }

      appendLedger(tx, db, {
        from: uid,
        to: 'escrow:market',
        amount: 0,
        reason: 'market_listing_escrow_lock',
        refId: listingId,
        nowMs,
      });

      return { listingId, itemId, itemName, qty, unitPrice, price: totalPrice };
    });

    return { ok: true, ...result };
  }
);

export const buyMarketListing = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = (request.data || {}) as { listingId?: unknown; buyQty?: unknown };
    const listingId = isValidSimpleId(data.listingId) ? data.listingId.trim() : '';
    const requestedQty = data.buyQty !== undefined ? Math.floor(Number(data.buyQty)) : null;

    if (!listingId) {
      throw new HttpsError('invalid-argument', 'ID listing marketplace tidak valid.');
    }
    if (requestedQty !== null && (!Number.isFinite(requestedQty) || requestedQty < 1 || requestedQty > 100)) {
      throw new HttpsError('invalid-argument', 'Jumlah beli harus 1–100.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const listingRef = db.collection('market_listings').doc(listingId);
    const buyerRef = db.collection('characters').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    const result = await db.runTransaction(async (tx) => {
      const [listingDoc, buyerDoc, treasuryDoc] = await Promise.all([
        tx.get(listingRef),
        tx.get(buyerRef),
        tx.get(treasuryRef),
      ]);

      if (!listingDoc.exists) throw new HttpsError('not-found', 'Listing tidak ditemukan.');
      if (!buyerDoc.exists) throw new HttpsError('not-found', 'Karakter pembeli tidak ditemukan.');

      const listing = listingDoc.data()!;
      if (listing.status !== 'active' || Number(listing.qty || 0) <= 0) {
        throw new HttpsError('failed-precondition', 'Listing sudah terjual atau dibatalkan.');
      }

      const sellerId = String(listing.sellerId);
      if (sellerId === uid) {
        throw new HttpsError(
          'failed-precondition',
          'Tidak dapat membeli listing milik sendiri (cegah wash trading).'
        );
      }

      const availQty = Number(listing.qty || 0);
      const buyQty = requestedQty ?? availQty;
      if (buyQty > availQty) {
        throw new HttpsError('failed-precondition', `Stok listing tersisa ${availQty}.`);
      }

      const sellerRef = db.collection('characters').doc(sellerId);
      const buyerInvRef = buyerRef.collection('inventory').doc(String(listing.itemId));
      const [sellerDoc, buyerInvDoc] = await Promise.all([tx.get(sellerRef), tx.get(buyerInvRef)]);
      if (!sellerDoc.exists) {
        throw new HttpsError('not-found', 'Akun penjual tidak ditemukan.');
      }

      const unitPrice = Number(listing.unitPrice || 0);
      const gross = unitPrice * buyQty;
      const buyerMoney = Number(buyerDoc.data()!.money || 0);
      if (buyerMoney < gross) {
        throw new HttpsError(
          'failed-precondition',
          `Uang tunai kurang! Butuh Rp ${gross.toLocaleString('id-ID')}.`
        );
      }

      const fee =
        gross >= taxConfig.minTaxableAmount ? Math.round(gross * taxConfig.marketplaceFeeRate) : 0;
      const netSeller = Math.max(0, gross - fee);

      const nextBuyerMoney = buyerMoney - gross;
      const nextSellerMoney = Number(sellerDoc.data()!.money || 0) + netSeller;
      const remainingQty = availQty - buyQty;

      tx.update(buyerRef, { money: nextBuyerMoney, updatedAt: now });
      tx.update(sellerRef, { money: nextSellerMoney, updatedAt: now });

      const oldBuyerInvQty = buyerInvDoc.exists ? Number(buyerInvDoc.data()!.quantity || 0) : 0;
      tx.set(buyerInvRef, {
        uid,
        itemId: String(listing.itemId),
        category: String(listing.category || 'misc'),
        name: String(listing.itemName || listing.itemId),
        quantity: oldBuyerInvQty + buyQty,
        updatedAtMs: nowMs,
      });

      tx.update(listingRef, {
        qty: remainingQty,
        price: remainingQty * unitPrice,
        status: remainingQty <= 0 ? 'sold' : 'active',
        lastBuyerId: uid,
        updatedAtMs: nowMs,
      });

      applyTreasuryCredit(tx, db, treasuryDoc, fee, 'market', nowMs);

      if (getProductMeta(String(listing.itemId))) {
        queueMarketVolumeDelta(tx, db, String(listing.itemId), 0, buyQty);
      }

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'marketplace_beli',
        amount: gross,
        balanceAfter: nextBuyerMoney,
        description: `Beli ${buyQty}x ${String(listing.itemName)} dari ${String(listing.sellerName)}`,
        nowMs,
      });

      appendTransaction(tx, db, sellerId, {
        type: 'income',
        category: 'marketplace_jual',
        amount: netSeller,
        balanceAfter: nextSellerMoney,
        description: `Terjual ${buyQty}x ${String(listing.itemName)} (biaya admin Rp ${fee.toLocaleString('id-ID')})`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: sellerId,
        amount: netSeller,
        taxAmount: fee,
        reason: 'marketplace_escrow_sale',
        refId: listingId,
        nowMs,
      });

      return {
        listingId,
        itemId: String(listing.itemId),
        itemName: String(listing.itemName),
        buyQty,
        gross,
        fee,
        money: nextBuyerMoney,
        remainingQty,
      };
    });

    return { ok: true, ...result };
  }
);

export const cancelMarketListing = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = (request.data || {}) as { listingId?: unknown };
    const listingId = isValidSimpleId(data.listingId) ? data.listingId.trim() : '';
    if (!listingId) {
      throw new HttpsError('invalid-argument', 'ID listing tidak valid.');
    }

    const nowMs = Date.now();
    const listingRef = db.collection('market_listings').doc(listingId);

    const result = await db.runTransaction(async (tx) => {
      const listingDoc = await tx.get(listingRef);
      if (!listingDoc.exists) throw new HttpsError('not-found', 'Listing tidak ditemukan.');

      const listing = listingDoc.data()!;
      if (listing.sellerId !== uid) {
        throw new HttpsError('permission-denied', 'Hanya penjual yang dapat membatalkan listing.');
      }
      if (listing.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Listing sudah tidak aktif.');
      }

      const itemId = String(listing.itemId);
      const returnQty = Math.max(0, Number(listing.qty || 0));
      const invRef = db.collection('characters').doc(uid).collection('inventory').doc(itemId);
      const invDoc = await tx.get(invRef);

      if (returnQty > 0) {
        const oldQty = invDoc.exists ? Number(invDoc.data()!.quantity || 0) : 0;
        tx.set(invRef, {
          uid,
          itemId,
          category: String(listing.category || 'misc'),
          name: String(listing.itemName || itemId),
          quantity: oldQty + returnQty,
          updatedAtMs: nowMs,
        });

        if (getProductMeta(itemId)) {
          queueMarketVolumeDelta(tx, db, itemId, -returnQty, 0);
        }
      }

      tx.update(listingRef, {
        status: 'cancelled',
        updatedAtMs: nowMs,
      });

      appendLedger(tx, db, {
        from: 'escrow:market',
        to: uid,
        amount: 0,
        reason: 'market_listing_cancelled',
        refId: listingId,
        nowMs,
      });

      return { listingId, returnedQty: returnQty };
    });

    return { ok: true, ...result };
  }
);
