import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { buildMemberAccessRef, isValidSimpleId } from '../helpers/housing';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { assertNearLocation } from '../helpers/location';
import { economyConfig, getProductMeta, queueMarketVolumeDelta, taxConfig } from '../helpers/market';
import { appendTransaction } from '../helpers/phase2';

type AuctionSubjectType = 'item' | 'property' | 'business';

export async function settleAuctionTx(
  firestore: Firestore,
  auctionId: string,
  callerUid: string | null,
  options: { cancelIfNoBids?: boolean; nowMs?: number } = {}
) {
  const nowMs = options.nowMs ?? Date.now();
  const now = Timestamp.fromMillis(nowMs);
  const auctionRef = firestore.collection('auctions').doc(auctionId);
  const treasuryRef = firestore.collection('state').doc('treasury');

  return await firestore.runTransaction(async (tx) => {
    const [auctionDoc, treasuryDoc] = await Promise.all([tx.get(auctionRef), tx.get(treasuryRef)]);
    if (!auctionDoc.exists) {
      throw new HttpsError('not-found', 'Lelang tidak ditemukan.');
    }

    const auc = auctionDoc.data()!;
    if (auc.status !== 'active') {
      return { alreadySettled: true, status: String(auc.status), auctionId };
    }

    const bidCount = Number(auc.bidCount || 0);
    const sellerId = String(auc.sellerId);
    const canEarlyCancel =
      options.cancelIfNoBids === true && callerUid !== null && callerUid === sellerId && bidCount === 0;

    if (!canEarlyCancel && nowMs < Number(auc.endsAtMs || 0)) {
      throw new HttpsError('failed-precondition', 'Waktu lelang belum berakhir.');
    }

    const subjectType = String(auc.subjectType) as AuctionSubjectType;
    const subjectId = String(auc.subjectId || '');
    const subject = (auc.subject || {}) as Record<string, unknown>;
    const sellerRef = firestore.collection('characters').doc(sellerId);
    const sellerDoc = await tx.get(sellerRef);

    // Kasus 1: Tidak ada penawar -> kembalikan aset dari escrow ke penjual
    if (!auc.currentBidderId || bidCount === 0) {
      if (subjectType === 'item') {
        const itemId = String(subject.itemId || subjectId);
        const qty = Math.max(1, Number(subject.qty || 1));
        const sellerInvRef = sellerRef.collection('inventory').doc(itemId);
        const sellerInvDoc = await tx.get(sellerInvRef);
        const oldQty = sellerInvDoc.exists ? Number(sellerInvDoc.data()!.quantity || 0) : 0;
        tx.set(sellerInvRef, {
          uid: sellerId,
          itemId,
          category: String(subject.category || 'misc'),
          name: String(subject.itemName || itemId),
          quantity: oldQty + qty,
          updatedAtMs: nowMs,
        });
      } else if (subjectType === 'property') {
        const propRef = firestore.collection('properties').doc(subjectId);
        const propDoc = await tx.get(propRef);
        if (propDoc.exists) {
          tx.update(propRef, { activeAuctionId: null, updatedAtMs: nowMs });
        }
      } else if (subjectType === 'business') {
        const bizRef = firestore.collection('businesses').doc(subjectId);
        const bizDoc = await tx.get(bizRef);
        if (bizDoc.exists) {
          tx.update(bizRef, { status: 'active', activeAuctionId: null, updatedAtMs: nowMs });
        }
      }

      const finalStatus = canEarlyCancel ? 'cancelled' : 'settled';
      tx.update(auctionRef, {
        status: finalStatus,
        settledAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      appendLedger(tx, firestore, {
        from: 'escrow:auction',
        to: sellerId,
        amount: 0,
        reason: canEarlyCancel ? 'auction_cancelled_no_bids' : 'auction_expired_no_bids',
        refId: auctionId,
        nowMs,
      });

      return { alreadySettled: false, status: finalStatus, auctionId, winnerId: null, finalPrice: 0 };
    }

    // Kasus 2: Ada pemenang lelang -> transfer dana escrow (potong biaya lelang 5%) & pindah kepemilikan aset
    const winnerId = String(auc.currentBidderId);
    const winnerName = String(auc.currentBidderName || 'Pemenang');
    const finalPrice = Number(auc.currentBid || 0);
    const fee = Math.round(finalPrice * taxConfig.auctionFeeRate);
    const netSeller = Math.max(0, finalPrice - fee);

    const winnerRef = firestore.collection('characters').doc(winnerId);
    const winnerDoc = await tx.get(winnerRef);

    let winnerInvDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    let propDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    let bizDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    let bizPropDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    if (subjectType === 'item') {
      const itemId = String(subject.itemId || subjectId);
      winnerInvDoc = await tx.get(winnerRef.collection('inventory').doc(itemId));
    } else if (subjectType === 'property') {
      propDoc = await tx.get(firestore.collection('properties').doc(subjectId));
    } else if (subjectType === 'business') {
      bizDoc = await tx.get(firestore.collection('businesses').doc(subjectId));
      if (bizDoc.exists && bizDoc.data()!.propertyId) {
        bizPropDoc = await tx.get(firestore.collection('properties').doc(String(bizDoc.data()!.propertyId)));
      }
    }

    if (sellerDoc.exists) {
      const nextSellerMoney = Number(sellerDoc.data()!.money || 0) + netSeller;
      tx.update(sellerRef, { money: nextSellerMoney, updatedAt: now });
      appendTransaction(tx, firestore, sellerId, {
        type: 'income',
        category: 'lelang_jual',
        amount: netSeller,
        balanceAfter: nextSellerMoney,
        description: `Hasil lelang ${String(subject.name || subject.itemName || subjectId)} (biaya 5%: Rp ${fee.toLocaleString('id-ID')})`,
        nowMs,
      });
    }

    applyTreasuryCredit(tx, firestore, treasuryDoc, fee, 'auction', nowMs);

    if (subjectType === 'item') {
      const itemId = String(subject.itemId || subjectId);
      const qty = Math.max(1, Number(subject.qty || 1));
      const oldQty = winnerInvDoc?.exists ? Number(winnerInvDoc.data()!.quantity || 0) : 0;
      tx.set(winnerRef.collection('inventory').doc(itemId), {
        uid: winnerId,
        itemId,
        category: String(subject.category || 'misc'),
        name: String(subject.itemName || itemId),
        quantity: oldQty + qty,
        updatedAtMs: nowMs,
      });
      if (getProductMeta(itemId)) {
        queueMarketVolumeDelta(tx, firestore, itemId, 0, qty);
      }
    } else if (subjectType === 'property' && propDoc?.exists) {
      const propRef = propDoc.ref;
      tx.update(propRef, {
        ownerId: winnerId,
        ownerType: 'player',
        ownerName: winnerName,
        activeAuctionId: null,
        activeListingId: null,
        activeLeaseId: null,
        mortgageInfo: null,
        certificateId: `SHM_AUC_${subjectId}_${nowMs}`,
        lastTaxAtMs: nowMs,
        updatedAtMs: nowMs,
      });
      tx.delete(buildMemberAccessRef(firestore, subjectId, sellerId));
      tx.set(buildMemberAccessRef(firestore, subjectId, winnerId), {
        uid: winnerId,
        propertyId: subjectId,
        role: 'owner',
        grantedAtMs: nowMs,
      });
      if (winnerDoc.exists && !winnerDoc.data()!.currentHomeId) {
        tx.update(winnerRef, { currentHomeId: subjectId, homeless: false, updatedAt: now });
      }
    } else if (subjectType === 'business' && bizDoc?.exists) {
      const bizData = bizDoc.data()!;
      tx.update(bizDoc.ref, {
        ownerId: winnerId,
        ownerName: winnerName,
        status: 'active',
        activeAuctionId: null,
        updatedAtMs: nowMs,
      });
      if (sellerDoc.exists) {
        const sList = Array.isArray(sellerDoc.data()!.businesses)
          ? (sellerDoc.data()!.businesses as string[]).filter((id) => id !== subjectId)
          : [];
        tx.update(sellerRef, { businesses: sList });
      }
      if (winnerDoc.exists) {
        const wList = Array.isArray(winnerDoc.data()!.businesses)
          ? (winnerDoc.data()!.businesses as string[])
          : [];
        if (!wList.includes(subjectId)) {
          tx.update(winnerRef, { businesses: [...wList, subjectId], updatedAt: now });
        }
      }
      if (bizPropDoc?.exists && bizPropDoc.data()!.ownerId === sellerId) {
        const bpId = String(bizData.propertyId);
        tx.update(bizPropDoc.ref, {
          ownerId: winnerId,
          ownerType: 'player',
          ownerName: winnerName,
          updatedAtMs: nowMs,
        });
        tx.delete(buildMemberAccessRef(firestore, bpId, sellerId));
        tx.set(buildMemberAccessRef(firestore, bpId, winnerId), {
          uid: winnerId,
          propertyId: bpId,
          role: 'owner',
          grantedAtMs: nowMs,
        });
      }
    }

    tx.update(auctionRef, {
      status: 'settled',
      winnerId,
      winnerName,
      finalPrice,
      fee,
      settledAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    appendLedger(tx, firestore, {
      from: 'escrow:auction',
      to: sellerId,
      amount: netSeller,
      taxAmount: fee,
      reason: 'auction_settled_payout',
      refId: auctionId,
      nowMs,
    });

    return {
      alreadySettled: false,
      status: 'settled',
      auctionId,
      winnerId,
      winnerName,
      finalPrice,
      fee,
      netSeller,
    };
  });
}

export const createAuction = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      subjectType?: unknown;
      subjectId?: unknown;
      qty?: unknown;
      startPrice?: unknown;
      minIncrement?: unknown;
      durationMinutes?: unknown;
    };

    const subjectType =
      data.subjectType === 'item' || data.subjectType === 'property' || data.subjectType === 'business'
        ? data.subjectType
        : null;
    const subjectId = isValidSimpleId(data.subjectId) ? data.subjectId.trim() : '';
    const startPrice = Math.floor(Number(data.startPrice || 0));
    const minIncrement = Math.floor(Number(data.minIncrement || 5000));
    const requestedDurationMs = Math.floor(Number(data.durationMinutes || 60)) * 60_000;
    const durationMs = Math.max(
      economyConfig.auctionMinDurationMs,
      Math.min(economyConfig.auctionMaxDurationMs, requestedDurationMs)
    );

    if (!subjectType || !subjectId) {
      throw new HttpsError('invalid-argument', 'Jenis aset dan ID objek lelang wajib diisi.');
    }
    if (!Number.isFinite(startPrice) || startPrice < 5000 || startPrice > 500_000_000) {
      throw new HttpsError('invalid-argument', 'Harga pembukaan minimal Rp 5.000.');
    }
    if (!Number.isFinite(minIncrement) || minIncrement < 1000) {
      throw new HttpsError('invalid-argument', 'Kenaikan minimum bid minimal Rp 1.000.');
    }

    const activeAuctionsSnap = await db
      .collection('auctions')
      .where('sellerId', '==', uid)
      .where('status', '==', 'active')
      .limit(economyConfig.maxAuctionsPerPlayer + 1)
      .get();
    if (activeAuctionsSnap.size >= economyConfig.maxAuctionsPerPlayer) {
      throw new HttpsError(
        'failed-precondition',
        `Maksimal ${economyConfig.maxAuctionsPerPlayer} lelang aktif sekaligus.`
      );
    }

    const sellerRef = db.collection('characters').doc(uid);
    const sellerPre = await sellerRef.get();
    if (!sellerPre.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
    await assertNearLocation(
      rtdb,
      uid,
      sellerPre.data()!,
      ['balai_lelang'],
      0,
      [],
      'Datangi Balai Lelang Kota Cicalengka untuk membuat lelang.'
    );

    const nowMs = Date.now();
    const auctionId = `auc_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const auctionRef = db.collection('auctions').doc(auctionId);

    const result = await db.runTransaction(async (tx) => {
      const sellerDoc = await tx.get(sellerRef);
      if (!sellerDoc.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
      const sellerName = String(sellerDoc.data()!.name || 'Warga');

      let subjectPayload: Record<string, unknown> = {};

      if (subjectType === 'item') {
        const qty = Math.max(1, Math.min(100, Math.floor(Number(data.qty || 1))));
        const invRef = sellerRef.collection('inventory').doc(subjectId);
        const invDoc = await tx.get(invRef);
        if (!invDoc.exists || Number(invDoc.data()!.quantity || 0) < qty) {
          throw new HttpsError('failed-precondition', 'Stok barang di inventaris tidak mencukupi.');
        }
        const avail = Number(invDoc.data()!.quantity || 0);
        if (avail - qty <= 0) tx.delete(invRef);
        else tx.update(invRef, { quantity: avail - qty, updatedAtMs: nowMs });

        const meta = getProductMeta(subjectId);
        subjectPayload = {
          itemId: subjectId,
          itemName: String(invDoc.data()!.name || meta?.name || subjectId),
          category: String(invDoc.data()!.category || meta?.category || 'misc'),
          qty,
        };
      } else if (subjectType === 'property') {
        const propRef = db.collection('properties').doc(subjectId);
        const propDoc = await tx.get(propRef);
        if (!propDoc.exists) throw new HttpsError('not-found', 'Properti tidak ditemukan.');
        const prop = propDoc.data()!;
        if (prop.ownerId !== uid || prop.ownerType !== 'player') {
          throw new HttpsError('permission-denied', 'Kamu bukan pemilik sah properti ini.');
        }
        if (prop.mortgageInfo?.status === 'active') {
          throw new HttpsError(
            'failed-precondition',
            'Properti masih terikat agunan KPR aktif dan tidak dapat dilelang.'
          );
        }
        if (prop.activeRenovationId) {
          throw new HttpsError(
            'failed-precondition',
            'Selesaikan renovasi properti sebelum melelangnya.'
          );
        }
        if (prop.activeListingId || prop.activeLeaseId || prop.activeBusinessId || prop.activeAuctionId) {
          throw new HttpsError(
            'failed-precondition',
            'Properti sedang terikat listing, sewa, bisnis aktif, atau lelang lain.'
          );
        }
        tx.update(propRef, { activeAuctionId: auctionId, updatedAtMs: nowMs });
        subjectPayload = {
          propertyId: subjectId,
          name: String(prop.name),
          type: String(prop.type),
          areaTag: String(prop.areaTag),
          baseValue: Number(prop.baseValue || 0),
        };
      } else {
        const bizRef = db.collection('businesses').doc(subjectId);
        const bizDoc = await tx.get(bizRef);
        if (!bizDoc.exists) throw new HttpsError('not-found', 'Bisnis tidak ditemukan.');
        const biz = bizDoc.data()!;
        if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');
        if (biz.status !== 'active' || biz.activeAuctionId) {
          throw new HttpsError('failed-precondition', 'Bisnis harus berstatus aktif dan tidak sedang dilelang.');
        }
        tx.update(bizRef, {
          status: 'auctioning',
          isOpen: false,
          activeAuctionId: auctionId,
          updatedAtMs: nowMs,
        });
        subjectPayload = {
          businessId: subjectId,
          name: String(biz.name),
          type: String(biz.type),
          propertyId: String(biz.propertyId),
          cash: Number(biz.cash || 0),
          popularity: Number(biz.popularity || 30),
        };
      }

      const endsAtMs = nowMs + durationMs;
      tx.set(auctionRef, {
        id: auctionId,
        sellerId: uid,
        sellerName,
        subject: subjectPayload,
        subjectType,
        subjectId,
        startPrice,
        minIncrement,
        currentBid: 0,
        currentBidderId: null,
        currentBidderName: null,
        currentBidderSource: null,
        bidCount: 0,
        extensionsUsed: 0,
        endsAtMs,
        status: 'active',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: 'escrow:auction',
        amount: 0,
        reason: `auction_created_${subjectType}`,
        refId: auctionId,
        nowMs,
      });

      return { auctionId, subjectType, subjectId, endsAtMs, startPrice };
    });

    return { ok: true, ...result };
  }
);

export const placeBid = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      auctionId?: unknown;
      amount?: unknown;
      payFrom?: unknown;
    };

    const auctionId = isValidSimpleId(data.auctionId) ? data.auctionId.trim() : '';
    const amount = Math.floor(Number(data.amount || 0));
    const payFrom = data.payFrom === 'bank' ? 'bank' : 'wallet';

    if (!auctionId || !Number.isFinite(amount) || amount < 5000) {
      throw new HttpsError('invalid-argument', 'ID lelang atau nominal tawaran tidak valid.');
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const auctionRef = db.collection('auctions').doc(auctionId);
    const bidderCharRef = db.collection('characters').doc(uid);
    const bidderAccRef = db.collection('accounts').doc(uid);

    const bidderPre = await bidderCharRef.get();
    if (!bidderPre.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
    await assertNearLocation(
      rtdb,
      uid,
      bidderPre.data()!,
      ['balai_lelang'],
      0,
      [],
      'Datangi Balai Lelang Kota Cicalengka untuk memasang tawaran.'
    );

    const result = await db.runTransaction(async (tx) => {
      const [auctionDoc, bidderCharDoc, bidderAccDoc] = await Promise.all([
        tx.get(auctionRef),
        tx.get(bidderCharRef),
        payFrom === 'bank' ? tx.get(bidderAccRef) : Promise.resolve(null),
      ]);

      if (!auctionDoc.exists) throw new HttpsError('not-found', 'Lelang tidak ditemukan.');
      if (!bidderCharDoc.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');

      const auc = auctionDoc.data()!;
      if (auc.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Lelang sudah ditutup.');
      }
      if (nowMs >= Number(auc.endsAtMs || 0)) {
        throw new HttpsError('failed-precondition', 'Waktu lelang telah habis. Silakan selesaikan penutupan lelang.');
      }
      if (auc.sellerId === uid) {
        throw new HttpsError('failed-precondition', 'Penjual tidak boleh menawar di lelangnya sendiri.');
      }
      if (auc.currentBidderId === uid) {
        throw new HttpsError('failed-precondition', 'Kamu sudah memegang tawaran tertinggi saat ini.');
      }

      const bidCount = Number(auc.bidCount || 0);
      const currentBid = Number(auc.currentBid || 0);
      const minRequired =
        bidCount === 0 ? Number(auc.startPrice || 5000) : currentBid + Number(auc.minIncrement || 1000);
      if (amount < minRequired) {
        throw new HttpsError(
          'invalid-argument',
          `Tawaran minimal Rp ${minRequired.toLocaleString('id-ID')}.`
        );
      }

      // Cek & tahan dana penawar (anti bid palsu tanpa dana)
      if (payFrom === 'bank') {
        if (!bidderAccDoc?.exists) {
          throw new HttpsError('failed-precondition', 'Kamu belum membuka rekening Bank Cicalengka.');
        }
        const bankBal = Number(bidderAccDoc.data()!.balance || 0);
        if (bankBal < amount) {
          throw new HttpsError('failed-precondition', 'Saldo rekening bank kurang untuk menahan bid.');
        }
      } else {
        const walletMoney = Number(bidderCharDoc.data()!.money || 0);
        if (walletMoney < amount) {
          throw new HttpsError('failed-precondition', 'Uang tunai dompet kurang untuk menahan bid.');
        }
      }

      // Kembalikan dana penawar sebelumnya jika ada
      const prevBidderId = auc.currentBidderId ? String(auc.currentBidderId) : null;
      const prevBidderSource = auc.currentBidderSource === 'bank' ? 'bank' : 'wallet';
      let prevCharDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      let prevAccDoc: FirebaseFirestore.DocumentSnapshot | null = null;

      if (prevBidderId && currentBid > 0) {
        if (prevBidderSource === 'bank') {
          prevAccDoc = await tx.get(db.collection('accounts').doc(prevBidderId));
        } else {
          prevCharDoc = await tx.get(db.collection('characters').doc(prevBidderId));
        }
      }

      // Eksekusi hold penawar baru
      if (payFrom === 'bank') {
        const nextBank = Number(bidderAccDoc!.data()!.balance || 0) - amount;
        tx.update(bidderAccRef, { balance: nextBank, updatedAtMs: nowMs });
      } else {
        const nextMoney = Number(bidderCharDoc.data()!.money || 0) - amount;
        tx.update(bidderCharRef, { money: nextMoney, updatedAt: now });
        appendTransaction(tx, db, uid, {
          type: 'expense',
          category: 'hold_lelang',
          amount,
          balanceAfter: nextMoney,
          description: `Dana ditahan untuk bid lelang #${auctionId.slice(-6)}`,
          nowMs,
        });
      }

      appendLedger(tx, db, {
        from: uid,
        to: 'escrow:auction',
        amount,
        reason: `auction_bid_hold_${payFrom}`,
        refId: auctionId,
        nowMs,
      });

      // Eksekusi refund penawar sebelumnya
      if (prevBidderId && currentBid > 0) {
        if (prevBidderSource === 'bank' && prevAccDoc?.exists) {
          const refundedBank = Number(prevAccDoc.data()!.balance || 0) + currentBid;
          tx.update(prevAccDoc.ref, { balance: refundedBank, updatedAtMs: nowMs });
        } else if (prevCharDoc?.exists) {
          const refundedMoney = Number(prevCharDoc.data()!.money || 0) + currentBid;
          tx.update(prevCharDoc.ref, { money: refundedMoney, updatedAt: now });
          appendTransaction(tx, db, prevBidderId, {
            type: 'income',
            category: 'refund_lelang',
            amount: currentBid,
            balanceAfter: refundedMoney,
            description: `Pengembalian dana bid lelang #${auctionId.slice(-6)} (terkalahkan)`,
            nowMs,
          });
        }

        appendLedger(tx, db, {
          from: 'escrow:auction',
          to: prevBidderId,
          amount: currentBid,
          reason: 'auction_outbid_refund',
          refId: auctionId,
          nowMs,
        });
      }

      // Anti-sniping: perpanjang durasi bila menawar di menit terakhir
      let endsAtMs = Number(auc.endsAtMs || nowMs);
      let extensionsUsed = Number(auc.extensionsUsed || 0);
      let antiSnipeExtended = false;
      if (
        endsAtMs - nowMs <= economyConfig.auctionAntiSnipeWindowMs &&
        extensionsUsed < economyConfig.auctionMaxExtensions
      ) {
        endsAtMs = Math.max(endsAtMs, nowMs + economyConfig.auctionAntiSnipeExtendMs);
        extensionsUsed += 1;
        antiSnipeExtended = true;
      }

      const bidderName = String(bidderCharDoc.data()!.name || 'Penawar');
      const bidId = `bid_${nowMs}_${Math.random().toString(36).slice(2, 5)}`;

      tx.update(auctionRef, {
        currentBid: amount,
        currentBidderId: uid,
        currentBidderName: bidderName,
        currentBidderSource: payFrom,
        bidCount: FieldValue.increment(1),
        endsAtMs,
        extensionsUsed,
        updatedAtMs: nowMs,
      });

      tx.set(auctionRef.collection('bids').doc(bidId), {
        id: bidId,
        auctionId,
        bidderId: uid,
        bidderName,
        amount,
        createdAtMs: nowMs,
      });

      return {
        auctionId,
        currentBid: amount,
        endsAtMs,
        antiSnipeExtended,
        bidCount: bidCount + 1,
      };
    });

    return { ok: true, ...result };
  }
);

export const settleAuction = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { auctionId?: unknown; cancel?: unknown };
    const auctionId = isValidSimpleId(data.auctionId) ? data.auctionId.trim() : '';
    if (!auctionId) throw new HttpsError('invalid-argument', 'ID lelang tidak valid.');

    const charPre = await db.collection('characters').doc(uid).get();
    if (!charPre.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
    await assertNearLocation(
      rtdb,
      uid,
      charPre.data()!,
      ['balai_lelang'],
      0,
      [],
      'Datangi Balai Lelang Kota Cicalengka untuk menyelesaikan lelang.'
    );

    const res = await settleAuctionTx(db, auctionId, uid, {
      cancelIfNoBids: data.cancel === true,
      nowMs: Date.now(),
    });

    return { ok: true, ...res };
  }
);
