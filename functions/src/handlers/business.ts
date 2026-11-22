import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  businessConfig,
  getGameDayKey,
  settleBusinessLazy,
  upsertDailyReportInTx,
} from '../helpers/business';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { isValidSimpleId } from '../helpers/housing';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { assertNearLocation, buildDynamicPropertyTarget, type DynamicLocationTarget } from '../helpers/location';
import {
  getActiveEconomicEvent,
  getFairPriceBounds,
  getProductMeta,
  getRecipeMeta,
  getSupplierMeta,
  queueMarketVolumeDelta,
  taxConfig,
} from '../helpers/market';
import { appendTransaction, GAME_DAY_DURATION_MS } from '../helpers/phase2';
import { computeSurvivalStats } from '../helpers/stats';
import { getAccessoryCfg, getVehicleModel } from '../helpers/vehicles';

const VALID_BIZ_TYPES = Object.keys(businessConfig.businessTypes);

async function resolveBusinessTarget(businessId: string): Promise<{
  bizData: FirebaseFirestore.DocumentData;
  target: DynamicLocationTarget;
} | null> {
  const bizPre = await db.collection('businesses').doc(businessId).get();
  if (!bizPre.exists) return null;
  const bizData = bizPre.data()!;
  const propId = typeof bizData.propertyId === 'string' ? bizData.propertyId : '';
  const propPre = propId ? await db.collection('properties').doc(propId).get() : null;
  const target = buildDynamicPropertyTarget(
    businessId,
    propPre?.exists ? propPre.data()! : bizData,
    String(bizData.name || 'Lokasi Bisnis')
  );
  return { bizData, target };
}

async function assertNearBusiness(
  uid: string,
  businessId: string,
  extraLocationIds: string[] = [],
  customMessage?: string
) {
  const [charPre, resolved] = await Promise.all([
    db.collection('characters').doc(uid).get(),
    resolveBusinessTarget(businessId),
  ]);
  if (!charPre.exists || !resolved) {
    throw new HttpsError('not-found', 'Bisnis atau karakter tidak ditemukan.');
  }
  await assertNearLocation(
    rtdb,
    uid,
    charPre.data()!,
    extraLocationIds,
    0,
    [resolved.target],
    customMessage || `Datangi lokasi ${resolved.target.label} terlebih dahulu.`
  );
}

export const createBusiness = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      type?: unknown;
      name?: unknown;
      propertyId?: unknown;
      capital?: unknown;
    };

    const bizType = typeof data.type === 'string' ? data.type.trim() : '';
    if (!VALID_BIZ_TYPES.includes(bizType)) {
      throw new HttpsError('invalid-argument', 'Jenis bisnis tidak valid.');
    }
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (name.length < 3 || name.length > 64) {
      throw new HttpsError('invalid-argument', 'Nama usaha harus 3–64 karakter.');
    }
    const propertyId = isValidSimpleId(data.propertyId) ? data.propertyId.trim() : '';
    if (!propertyId) {
      throw new HttpsError('invalid-argument', 'Properti ruko atau lapak pasar wajib dipilih.');
    }

    const typeMeta = (businessConfig.businessTypes as Record<
      string,
      {
        label: string;
        allowedPropertyTypes: string[];
        permitFee: number;
        minCapital: number;
        basePopularity: number;
      }
    >)[bizType];

    const capital = Math.floor(Number(data.capital || 0));
    if (!Number.isFinite(capital) || capital < typeMeta.minCapital) {
      throw new HttpsError(
        'invalid-argument',
        `Modal awal minimal untuk ${typeMeta.label} adalah Rp ${typeMeta.minCapital.toLocaleString('id-ID')}.`
      );
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const propRef = db.collection('properties').doc(propertyId);
    const treasuryRef = db.collection('state').doc('treasury');

    const [charPreSnap, propPreSnap] = await Promise.all([charRef.get(), propRef.get()]);
    if (!charPreSnap.exists) throw new HttpsError('not-found', 'Karakter belum ditemukan.');
    if (!propPreSnap.exists) throw new HttpsError('not-found', 'Properti tidak ditemukan.');

    const propTarget = buildDynamicPropertyTarget(propertyId, propPreSnap.data()!);
    await assertNearLocation(
      rtdb,
      uid,
      charPreSnap.data()!,
      ['kantor_desa'],
      0,
      [propTarget],
      'Datangi Kantor Desa Cicalengka atau properti ruko/lapak tujuan untuk mengurus izin usaha.'
    );

    const existingBizSnap = await db
      .collection('businesses')
      .where('ownerId', '==', uid)
      .limit(10)
      .get();
    const activeOwnedCount = existingBizSnap.docs.filter((d) => d.data().status === 'active').length;
    if (activeOwnedCount >= businessConfig.maxBusinessesPerPlayer) {
      throw new HttpsError(
        'failed-precondition',
        `Maksimal memiliki ${businessConfig.maxBusinessesPerPlayer} bisnis aktif.`
      );
    }

    const businessId = `biz_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const bizRef = db.collection('businesses').doc(businessId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, propDoc, treasuryDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(propRef),
        tx.get(treasuryRef),
      ]);

      if (!charDoc.exists || !propDoc.exists) {
        throw new HttpsError('not-found', 'Karakter atau properti tidak ditemukan.');
      }

      const cData = charDoc.data()!;
      const pData = propDoc.data()!;

      if (!typeMeta.allowedPropertyTypes.includes(String(pData.type))) {
        throw new HttpsError(
          'failed-precondition',
          `${typeMeta.label} hanya dapat dibuka di ${typeMeta.allowedPropertyTypes.join(' / ')}.`
        );
      }

      if (pData.activeBusinessId) {
        throw new HttpsError('already-exists', 'Properti ini sudah dipakai untuk bisnis aktif lain.');
      }

      const isOwner = pData.ownerId === uid;
      let isTenant = false;
      if (!isOwner && pData.activeLeaseId) {
        const leaseDoc = await tx.get(db.collection('leases').doc(String(pData.activeLeaseId)));
        if (leaseDoc.exists && leaseDoc.data()!.status === 'active' && leaseDoc.data()!.tenantId === uid) {
          isTenant = true;
        }
      }
      if (!isOwner && !isTenant) {
        throw new HttpsError(
          'permission-denied',
          'Kamu harus memiliki atau menyewa properti ini untuk membuka usaha.'
        );
      }

      const permitFee = typeMeta.permitFee;
      const totalUpfront = permitFee + capital;
      const money = Number(cData.money || 0);
      if (money < totalUpfront) {
        throw new HttpsError(
          'failed-precondition',
          `Dana kurang! Butuh Rp ${totalUpfront.toLocaleString('id-ID')} (izin + modal).`
        );
      }

      const nextMoney = money - totalUpfront;
      const currentBizList = Array.isArray(cData.businesses) ? (cData.businesses as string[]) : [];

      tx.set(bizRef, {
        id: businessId,
        ownerId: uid,
        ownerName: String(cData.name || 'Pemilik'),
        type: bizType,
        name,
        propertyId,
        areaTag: String(pData.areaTag || 'pasar'),
        position: pData.position || { x: 0, y: 0, z: 0 },
        capital,
        cash: capital,
        popularity: typeMeta.basePopularity,
        level: 1,
        isOpen: true,
        hours: { openHour: 6, closeHour: 22 },
        lastSettledAtMs: nowMs,
        lastWageAtMs: nowMs,
        permits: {
          permitId: `SIUP-${nowMs.toString().slice(-6)}`,
          issuedAtMs: nowMs,
          feePaid: permitFee,
        },
        promoBoostUntilMs: 0,
        promoBoostValue: 0,
        status: 'active',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      tx.update(propRef, {
        activeBusinessId: businessId,
        updatedAtMs: nowMs,
      });

      tx.update(charRef, {
        money: nextMoney,
        businesses: [...currentBizList, businessId],
        updatedAt: now,
      });

      applyTreasuryCredit(tx, db, treasuryDoc, permitFee, 'business', nowMs);

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'buka_bisnis',
        amount: totalUpfront,
        balanceAfter: nextMoney,
        description: `Izin & modal awal ${name}`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: `biz:${businessId}`,
        amount: capital,
        taxAmount: permitFee,
        reason: 'business_open_capital_and_permit',
        refId: businessId,
        nowMs,
      });

      return { businessId, name, money: nextMoney, cash: capital, permitFee };
    });

    return { ok: true, ...result };
  }
);

export const setBusinessSettings = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      businessId?: unknown;
      name?: unknown;
      isOpen?: unknown;
      openHour?: unknown;
      closeHour?: unknown;
    };

    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    if (!businessId) throw new HttpsError('invalid-argument', 'ID bisnis tidak valid.');

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    await settleBusinessLazy(db, businessId, nowMs);

    const bizRef = db.collection('businesses').doc(businessId);
    await db.runTransaction(async (tx) => {
      const bizDoc = await tx.get(bizRef);
      if (!bizDoc.exists) throw new HttpsError('not-found', 'Bisnis tidak ditemukan.');
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');
      if (biz.status !== 'active') throw new HttpsError('failed-precondition', 'Bisnis sudah ditutup.');

      const updates: Record<string, unknown> = { updatedAtMs: nowMs };
      if (typeof data.name === 'string') {
        const clean = data.name.trim();
        if (clean.length < 3 || clean.length > 64) {
          throw new HttpsError('invalid-argument', 'Nama usaha harus 3–64 karakter.');
        }
        updates.name = clean;
      }
      if (typeof data.isOpen === 'boolean') {
        updates.isOpen = data.isOpen;
      }
      if (data.openHour !== undefined || data.closeHour !== undefined) {
        const openHour = Math.max(0, Math.min(23, Math.floor(Number(data.openHour ?? biz.hours?.openHour ?? 6))));
        const closeHour = Math.max(0, Math.min(23, Math.floor(Number(data.closeHour ?? biz.hours?.closeHour ?? 22))));
        updates.hours = { openHour, closeHour };
      }
      tx.update(bizRef, updates);
    });

    return { ok: true };
  }
);

export const withdrawBusinessProfit = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown; amount?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const amount = Math.floor(Number(data.amount || 0));

    if (!businessId) throw new HttpsError('invalid-argument', 'ID bisnis tidak valid.');
    if (
      !Number.isFinite(amount) ||
      amount < businessConfig.withdrawal.minWithdrawAmount ||
      amount > businessConfig.withdrawal.maxWithdrawPerTx
    ) {
      throw new HttpsError(
        'invalid-argument',
        `Nominal tarik harus Rp ${businessConfig.withdrawal.minWithdrawAmount.toLocaleString('id-ID')} – Rp ${businessConfig.withdrawal.maxWithdrawPerTx.toLocaleString('id-ID')}.`
      );
    }

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    await settleBusinessLazy(db, businessId, nowMs);

    const bizRef = db.collection('businesses').doc(businessId);
    const charRef = db.collection('characters').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    const result = await db.runTransaction(async (tx) => {
      const [bizDoc, charDoc, treasuryDoc] = await Promise.all([
        tx.get(bizRef),
        tx.get(charRef),
        tx.get(treasuryRef),
      ]);
      if (!bizDoc.exists || !charDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');

      const bizCash = Number(biz.cash || 0);
      if (bizCash - amount < businessConfig.withdrawal.minReserveCash) {
        throw new HttpsError(
          'failed-precondition',
          `Sisakan minimal Rp ${businessConfig.withdrawal.minReserveCash.toLocaleString('id-ID')} di kas usaha.`
        );
      }

      const tax = Math.round(amount * taxConfig.businessProfitTaxRate);
      const netAmount = Math.max(0, amount - tax);
      const nextMoney = Number(charDoc.data()!.money || 0) + netAmount;
      const nextCash = bizCash - amount;

      tx.update(bizRef, { cash: nextCash, updatedAtMs: nowMs });
      tx.update(charRef, { money: nextMoney, updatedAt: now });
      applyTreasuryCredit(tx, db, treasuryDoc, tax, 'business', nowMs);

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'laba_bisnis',
        amount: netAmount,
        balanceAfter: nextMoney,
        description: `Tarik kas ${String(biz.name)} (pajak 8%: Rp ${tax.toLocaleString('id-ID')})`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: `biz:${businessId}`,
        to: uid,
        amount: netAmount,
        taxAmount: tax,
        reason: 'business_profit_withdrawal',
        refId: businessId,
        nowMs,
      });

      return { cash: nextCash, money: nextMoney, netAmount, tax };
    });

    return { ok: true, ...result };
  }
);

export const closeBusiness = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    if (!businessId) throw new HttpsError('invalid-argument', 'ID bisnis tidak valid.');

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const bizRef = db.collection('businesses').doc(businessId);
    const charRef = db.collection('characters').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    const result = await db.runTransaction(async (tx) => {
      const [bizDoc, charDoc, treasuryDoc] = await Promise.all([
        tx.get(bizRef),
        tx.get(charRef),
        tx.get(treasuryRef),
      ]);
      if (!bizDoc.exists || !charDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');
      if (biz.status !== 'active') throw new HttpsError('failed-precondition', 'Bisnis sudah tutup.');

      const propRef = db.collection('properties').doc(String(biz.propertyId));
      const propDoc = await tx.get(propRef);

      const remainingCash = Math.max(0, Number(biz.cash || 0));
      const profitPart = Math.max(0, remainingCash - Number(biz.capital || 0));
      const tax = Math.round(profitPart * taxConfig.businessProfitTaxRate);
      const payout = Math.max(0, remainingCash - tax);
      const nextMoney = Number(charDoc.data()!.money || 0) + payout;
      const curList = Array.isArray(charDoc.data()!.businesses)
        ? (charDoc.data()!.businesses as string[]).filter((id) => id !== businessId)
        : [];

      tx.update(bizRef, { status: 'closed', isOpen: false, cash: 0, updatedAtMs: nowMs });
      if (propDoc.exists && propDoc.data()!.activeBusinessId === businessId) {
        tx.update(propRef, { activeBusinessId: null, updatedAtMs: nowMs });
      }
      tx.update(charRef, { money: nextMoney, businesses: curList, updatedAt: now });
      applyTreasuryCredit(tx, db, treasuryDoc, tax, 'business', nowMs);

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'tutup_bisnis',
        amount: payout,
        balanceAfter: nextMoney,
        description: `Tutup usaha ${String(biz.name)}`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: `biz:${businessId}`,
        to: uid,
        amount: payout,
        taxAmount: tax,
        reason: 'business_close_liquidation',
        refId: businessId,
        nowMs,
      });

      return { payout, tax, money: nextMoney };
    });

    return { ok: true, ...result };
  }
);

export const sellBusiness = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    if (!businessId) throw new HttpsError('invalid-argument', 'ID bisnis tidak valid.');

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    await settleBusinessLazy(db, businessId, nowMs);

    const bizRef = db.collection('businesses').doc(businessId);
    const charRef = db.collection('characters').doc(uid);
    const treasuryRef = db.collection('state').doc('treasury');

    const result = await db.runTransaction(async (tx) => {
      const [bizDoc, charDoc, treasuryDoc] = await Promise.all([
        tx.get(bizRef),
        tx.get(charRef),
        tx.get(treasuryRef),
      ]);
      if (!bizDoc.exists || !charDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');
      if (biz.status !== 'active') throw new HttpsError('failed-precondition', 'Bisnis tidak aktif.');

      const propRef = db.collection('properties').doc(String(biz.propertyId));
      const propDoc = await tx.get(propRef);

      const grossSale =
        Math.max(0, Number(biz.cash || 0)) +
        Math.round(Number(biz.capital || 0) * businessConfig.sellBusinessCapitalRefundRatio);
      const tax = Math.round(grossSale * taxConfig.businessProfitTaxRate);
      const netSale = Math.max(0, grossSale - tax);
      const nextMoney = Number(charDoc.data()!.money || 0) + netSale;
      const curList = Array.isArray(charDoc.data()!.businesses)
        ? (charDoc.data()!.businesses as string[]).filter((id) => id !== businessId)
        : [];

      tx.update(bizRef, { status: 'closed', isOpen: false, cash: 0, updatedAtMs: nowMs });
      if (propDoc.exists && propDoc.data()!.activeBusinessId === businessId) {
        tx.update(propRef, { activeBusinessId: null, updatedAtMs: nowMs });
      }
      tx.update(charRef, { money: nextMoney, businesses: curList, updatedAt: now });
      applyTreasuryCredit(tx, db, treasuryDoc, tax, 'business', nowMs);

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'jual_bisnis',
        amount: netSale,
        balanceAfter: nextMoney,
        description: `Jual aset usaha ${String(biz.name)} (pajak 8%)`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: 'system:npc',
        to: uid,
        amount: netSale,
        taxAmount: tax,
        reason: 'business_sold_to_investor',
        refId: businessId,
        nowMs,
      });

      return { grossSale, netSale, tax, money: nextMoney };
    });

    return { ok: true, ...result };
  }
);

export const buyStock = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      businessId?: unknown;
      itemId?: unknown;
      qty?: unknown;
      payFrom?: unknown;
    };

    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const itemId = isValidSimpleId(data.itemId) ? data.itemId.trim() : '';
    const qty = Math.floor(Number(data.qty || 0));
    const payFrom = data.payFrom === 'wallet' ? 'wallet' : 'business';

    if (!businessId || !itemId || !Number.isFinite(qty) || qty < 1 || qty > 200) {
      throw new HttpsError('invalid-argument', 'Parameter pembelian stok (qty 1–200) tidak valid.');
    }

    const meta = getProductMeta(itemId);
    if (!meta) throw new HttpsError('not-found', 'Produk tidak ditemukan di katalog grosir.');

    const nowMs = Date.now();
    const dayKey = getGameDayKey(nowMs);
    const charRef = db.collection('characters').doc(uid);
    const bizRef = db.collection('businesses').doc(businessId);
    const stockRef = bizRef.collection('stock').doc(itemId);
    const statRef = db.collection('market_stats').doc(itemId);
    const treasuryRef = db.collection('state').doc('treasury');
    const reportRef = bizRef.collection('daily_reports').doc(dayKey);

    const [charPre, resolved, ownedVehiclesSnap] = await Promise.all([
      charRef.get(),
      resolveBusinessTarget(businessId),
      db.collection('vehicles').where('ownerId', '==', uid).limit(6).get(),
    ]);
    if (!charPre.exists || !resolved) throw new HttpsError('not-found', 'Bisnis/karakter tidak ada.');

    let bestTrunkBonus = 0;
    for (const vDoc of ownedVehiclesSnap.docs) {
      const vd = vDoc.data();
      if (vd.status !== 'parked' && vd.status !== 'driving') continue;
      const model = getVehicleModel(String(vd.modelId || ''));
      if (!model) continue;
      const accBonus = Array.isArray(vd.accessories)
        ? (vd.accessories as string[]).reduce((sum, accId) => sum + (getAccessoryCfg(accId)?.trunkBonus || 0), 0)
        : 0;
      bestTrunkBonus = Math.max(bestTrunkBonus, Math.max(0, model.trunkCapacity || 0) + accBonus);
    }
    const maxAllowedQty = Math.min(200, 50 + bestTrunkBonus);
    if (qty > maxAllowedQty) {
      throw new HttpsError(
        'failed-precondition',
        `Kapasitas angkut maks ${maxAllowedQty} unit/transaksi (dasar 50 + bagasi kendaraan ${bestTrunkBonus}). Gunakan Pickup/Truk Kecil untuk beli lebih banyak.`
      );
    }

    await assertNearLocation(
      rtdb,
      uid,
      charPre.data()!,
      ['pasar_grosir'],
      0,
      [resolved.target],
      'Datangi Pasar Grosir Cicalengka atau toko kamu untuk restok.'
    );

    const supplier = getSupplierMeta(meta.supplierId);

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, bizDoc, stockDoc, statDoc, treasuryDoc, reportDoc] = await Promise.all([
        tx.get(charRef),
        tx.get(bizRef),
        tx.get(stockRef),
        tx.get(statRef),
        tx.get(treasuryRef),
        tx.get(reportRef),
      ]);

      if (!charDoc.exists || !bizDoc.exists) throw new HttpsError('not-found', 'Data tidak ditemukan.');
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');
      if (biz.status !== 'active') throw new HttpsError('failed-precondition', 'Bisnis tutup.');
      if (!meta.businessTypes.includes(String(biz.type))) {
        throw new HttpsError('invalid-argument', `${meta.name} tidak cocok dijual di jenis usaha ini.`);
      }

      const activeEvent = getActiveEconomicEvent(treasuryDoc.data(), nowMs);
      const eventMult = Number(
        ((activeEvent?.categoryMultipliers || {}) as Record<string, number>)[meta.category] ?? 1.0
      );
      const baseDynamicWholesale = statDoc.exists
        ? Math.round((Number(statDoc.data()!.currentPrice || meta.basePrice) / meta.basePrice) * meta.wholesalePrice)
        : meta.wholesalePrice;
      const unitWholesale = Math.max(
        500,
        Math.round(baseDynamicWholesale * eventMult * (1 - (supplier?.discountRate || 0)))
      );
      const totalCost = unitWholesale * qty;

      if (payFrom === 'wallet') {
        const money = Number(charDoc.data()!.money || 0);
        if (money < totalCost) {
          throw new HttpsError('failed-precondition', `Uang tunai kurang. Butuh Rp ${totalCost.toLocaleString('id-ID')}.`);
        }
        const nextMoney = money - totalCost;
        tx.update(charRef, { money: nextMoney, updatedAt: Timestamp.fromMillis(nowMs) });
        appendTransaction(tx, db, uid, {
          type: 'expense',
          category: 'beli_stok',
          amount: totalCost,
          balanceAfter: nextMoney,
          description: `Beli stok ${qty}x ${meta.name}`,
          nowMs,
        });
      } else {
        const cash = Number(biz.cash || 0);
        if (cash < totalCost) {
          throw new HttpsError('failed-precondition', `Kas usaha kurang. Butuh Rp ${totalCost.toLocaleString('id-ID')}.`);
        }
        tx.update(bizRef, { cash: cash - totalCost, updatedAtMs: nowMs });
      }

      const oldQty = stockDoc.exists ? Number(stockDoc.data()!.qty || 0) : 0;
      const oldCost = stockDoc.exists ? Number(stockDoc.data()!.avgCost || unitWholesale) : unitWholesale;
      const newQty = oldQty + qty;
      const newAvgCost = Math.round((oldQty * oldCost + totalCost) / Math.max(1, newQty));
      const expiresAtMs =
        meta.shelfLifeGameDays > 0 ? nowMs + meta.shelfLifeGameDays * GAME_DAY_DURATION_MS : 0;

      tx.set(stockRef, {
        businessId,
        ownerId: uid,
        itemId,
        name: meta.name,
        category: meta.category,
        qty: newQty,
        avgCost: newAvgCost,
        sellPrice: stockDoc.exists ? Number(stockDoc.data()!.sellPrice || meta.suggestedRetail) : meta.suggestedRetail,
        expiresAtMs,
        updatedAtMs: nowMs,
      });

      upsertDailyReportInTx(
        tx,
        db,
        businessId,
        uid,
        dayKey,
        reportDoc.exists ? reportDoc.data() : undefined,
        { stockCost: totalCost },
        nowMs
      );

      queueMarketVolumeDelta(tx, db, itemId, 0, qty);

      appendLedger(tx, db, {
        from: payFrom === 'wallet' ? uid : `biz:${businessId}`,
        to: 'system:wholesale',
        amount: totalCost,
        reason: 'business_buy_stock',
        refId: `${businessId}_${itemId}`,
        nowMs,
      });

      return { itemId, newQty, unitWholesale, totalCost };
    });

    return { ok: true, ...result };
  }
);

export const produceItem = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown; recipeId?: unknown; batchCount?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const recipeId = isValidSimpleId(data.recipeId) ? data.recipeId.trim() : '';
    const batchCount = Math.max(1, Math.min(20, Math.floor(Number(data.batchCount || 1))));

    const recipe = getRecipeMeta(recipeId);
    if (!businessId || !recipe) {
      throw new HttpsError('invalid-argument', 'ID bisnis atau resep produksi tidak valid.');
    }
    const outMeta = getProductMeta(recipe.outputItemId);
    if (!outMeta) throw new HttpsError('not-found', 'Produk hasil resep tidak ditemukan.');

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    const bizRef = db.collection('businesses').doc(businessId);
    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const [bizDoc, charDoc, statsDoc] = await Promise.all([
        tx.get(bizRef),
        tx.get(charRef),
        tx.get(statsRef),
      ]);
      if (!bizDoc.exists || !charDoc.exists || !statsDoc.exists) {
        throw new HttpsError('not-found', 'Data bisnis atau karakter tidak ditemukan.');
      }
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');
      if (!recipe.businessTypes.includes(String(biz.type))) {
        throw new HttpsError('failed-precondition', 'Resep ini tidak sesuai jenis usaha kamu.');
      }

      const computed = computeSurvivalStats(statsDoc.data()!, nowMs, {
        homeless: Boolean(charDoc.data()!.homeless),
      });
      const energyNeed = recipe.energyCost * batchCount;
      if (computed.energy < energyNeed) {
        throw new HttpsError('failed-precondition', `Energi kurang (${Math.round(computed.energy)}/${energyNeed}). Istirahat atau makan dulu.`);
      }

      const inputDocs = await Promise.all(
        recipe.inputs.map((inp) => tx.get(bizRef.collection('stock').doc(inp.itemId)))
      );
      const outputRef = bizRef.collection('stock').doc(recipe.outputItemId);
      const outputDoc = await tx.get(outputRef);

      for (let i = 0; i < recipe.inputs.length; i++) {
        const inp = recipe.inputs[i];
        const sDoc = inputDocs[i];
        const avail = sDoc.exists ? Number(sDoc.data()!.qty || 0) : 0;
        const expired = sDoc.exists && Number(sDoc.data()!.expiresAtMs || 0) > 0 && nowMs >= Number(sDoc.data()!.expiresAtMs);
        if (expired || avail < inp.qty * batchCount) {
          throw new HttpsError(
            'failed-precondition',
            `Bahan ${inp.itemId} tidak cukup atau sudah kedaluwarsa (butuh ${inp.qty * batchCount}).`
          );
        }
      }

      for (let i = 0; i < recipe.inputs.length; i++) {
        const inp = recipe.inputs[i];
        const sDoc = inputDocs[i];
        tx.update(sDoc.ref, {
          qty: Number(sDoc.data()!.qty || 0) - inp.qty * batchCount,
          updatedAtMs: nowMs,
        });
      }

      const addedQty = recipe.outputQty * batchCount;
      const oldOutQty = outputDoc.exists ? Number(outputDoc.data()!.qty || 0) : 0;
      const newOutQty = oldOutQty + addedQty;
      const expiresAtMs =
        outMeta.shelfLifeGameDays > 0 ? nowMs + outMeta.shelfLifeGameDays * GAME_DAY_DURATION_MS : 0;

      tx.set(outputRef, {
        businessId,
        ownerId: uid,
        itemId: recipe.outputItemId,
        name: outMeta.name,
        category: outMeta.category,
        qty: newOutQty,
        avgCost: outMeta.wholesalePrice,
        sellPrice: outputDoc.exists
          ? Number(outputDoc.data()!.sellPrice || outMeta.suggestedRetail)
          : outMeta.suggestedRetail,
        expiresAtMs,
        updatedAtMs: nowMs,
      });

      const nextEnergy = Math.max(0, Math.round(computed.energy - energyNeed));
      tx.update(statsRef, {
        ...computed,
        energy: nextEnergy,
        lastCalculatedAt: Timestamp.fromMillis(nowMs),
      });

      return { outputItemId: recipe.outputItemId, addedQty, newOutQty, energy: nextEnergy };
    });

    return { ok: true, ...result };
  }
);

export const setPrice = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown; itemId?: unknown; sellPrice?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const itemId = isValidSimpleId(data.itemId) ? data.itemId.trim() : '';
    const sellPrice = Math.floor(Number(data.sellPrice || 0));

    const meta = getProductMeta(itemId);
    if (!businessId || !meta || !Number.isFinite(sellPrice)) {
      throw new HttpsError('invalid-argument', 'Parameter harga jual tidak valid.');
    }

    const statSnap = await db.collection('market_stats').doc(itemId).get();
    const refMarket = statSnap.exists
      ? Number(statSnap.data()!.currentPrice || meta.suggestedRetail)
      : meta.suggestedRetail;
    const bounds = getFairPriceBounds(Math.max(refMarket, meta.basePrice));
    if (sellPrice < bounds.minPrice || sellPrice > bounds.maxPrice * 1.2) {
      throw new HttpsError(
        'invalid-argument',
        `Harga jual wajar untuk ${meta.name}: Rp ${bounds.minPrice.toLocaleString('id-ID')} – Rp ${Math.round(bounds.maxPrice * 1.2).toLocaleString('id-ID')}.`
      );
    }

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    const bizRef = db.collection('businesses').doc(businessId);
    const stockRef = bizRef.collection('stock').doc(itemId);

    await db.runTransaction(async (tx) => {
      const [bizDoc, stockDoc] = await Promise.all([tx.get(bizRef), tx.get(stockRef)]);
      if (!bizDoc.exists || !stockDoc.exists) throw new HttpsError('not-found', 'Stok tidak ditemukan.');
      if (bizDoc.data()!.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');

      tx.update(stockRef, { sellPrice, updatedAtMs: nowMs });
    });

    return { ok: true, itemId, sellPrice };
  }
);

export const discardStock = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown; itemId?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const itemId = isValidSimpleId(data.itemId) ? data.itemId.trim() : '';
    if (!businessId || !itemId) throw new HttpsError('invalid-argument', 'ID tidak valid.');

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    const bizRef = db.collection('businesses').doc(businessId);
    const stockRef = bizRef.collection('stock').doc(itemId);

    await db.runTransaction(async (tx) => {
      const [bizDoc, stockDoc] = await Promise.all([tx.get(bizRef), tx.get(stockRef)]);
      if (!bizDoc.exists || !stockDoc.exists) throw new HttpsError('not-found', 'Stok tidak ditemukan.');
      if (bizDoc.data()!.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');
      tx.update(stockRef, { qty: 0, updatedAtMs: nowMs });
    });

    return { ok: true };
  }
);

export const buyFromBusiness = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown; itemId?: unknown; qty?: unknown; consumeNow?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const itemId = isValidSimpleId(data.itemId) ? data.itemId.trim() : '';
    const qty = Math.max(1, Math.min(20, Math.floor(Number(data.qty || 1))));
    const consumeNow = data.consumeNow === true;

    if (!businessId || !itemId) throw new HttpsError('invalid-argument', 'Parameter belanja tidak valid.');

    await assertNearBusiness(uid, businessId, [], 'Datangi lokasi bisnis untuk membeli di kasir.');

    const nowMs = Date.now();
    await settleBusinessLazy(db, businessId, nowMs);

    const dayKey = getGameDayKey(nowMs);
    const bizRef = db.collection('businesses').doc(businessId);
    const stockRef = bizRef.collection('stock').doc(itemId);
    const buyerRef = db.collection('characters').doc(uid);
    const buyerStatsRef = db.collection('character_stats').doc(uid);
    const invRef = buyerRef.collection('inventory').doc(itemId);
    const treasuryRef = db.collection('state').doc('treasury');
    const reportRef = bizRef.collection('daily_reports').doc(dayKey);

    const meta = getProductMeta(itemId);

    const result = await db.runTransaction(async (tx) => {
      const [bizDoc, stockDoc, buyerDoc, buyerStatsDoc, invDoc, treasuryDoc, reportDoc] =
        await Promise.all([
          tx.get(bizRef),
          tx.get(stockRef),
          tx.get(buyerRef),
          tx.get(buyerStatsRef),
          tx.get(invRef),
          tx.get(treasuryRef),
          tx.get(reportRef),
        ]);

      if (!bizDoc.exists || !stockDoc.exists || !buyerDoc.exists) {
        throw new HttpsError('not-found', 'Data stok atau pembeli tidak ditemukan.');
      }

      const biz = bizDoc.data()!;
      if (biz.ownerId === uid) {
        throw new HttpsError('failed-precondition', 'Pemilik tidak boleh membeli di tokonya sendiri (cegah wash trading).');
      }
      if (biz.status !== 'active' || !biz.isOpen) {
        throw new HttpsError('failed-precondition', 'Toko sedang tutup.');
      }

      const sData = stockDoc.data()!;
      const stockQty = Number(sData.qty || 0);
      if (stockQty < qty) {
        throw new HttpsError('failed-precondition', 'Stok barang di toko tidak mencukupi.');
      }
      if (Number(sData.expiresAtMs || 0) > 0 && nowMs >= Number(sData.expiresAtMs)) {
        throw new HttpsError('failed-precondition', 'Stok barang sudah kedaluwarsa.');
      }

      const unitPrice = Number(sData.sellPrice || 5000);
      const total = unitPrice * qty;
      const buyerMoney = Number(buyerDoc.data()!.money || 0);
      if (buyerMoney < total) {
        throw new HttpsError('failed-precondition', 'Uang tunai di dompet kurang.');
      }

      const vat = Math.round(total * taxConfig.businessSalesVatRate);
      const netSeller = total - vat;
      const nextBuyerMoney = buyerMoney - total;

      tx.update(buyerRef, { money: nextBuyerMoney, updatedAt: Timestamp.fromMillis(nowMs) });
      tx.update(bizRef, {
        cash: Number(biz.cash || 0) + netSeller,
        popularity: Math.min(100, Number(biz.popularity || 30) + 0.5),
        updatedAtMs: nowMs,
      });
      tx.update(stockRef, { qty: stockQty - qty, updatedAtMs: nowMs });
      applyTreasuryCredit(tx, db, treasuryDoc, vat, 'business', nowMs);

      if (consumeNow && meta && ((meta.hungerRestore || 0) > 0 || (meta.thirstRestore || 0) > 0) && buyerStatsDoc.exists) {
        const computed = computeSurvivalStats(buyerStatsDoc.data()!, nowMs, {
          homeless: Boolean(buyerDoc.data()!.homeless),
        });
        tx.update(buyerStatsRef, {
          ...computed,
          hunger: Math.min(100, computed.hunger + (meta.hungerRestore || 0) * qty),
          thirst: Math.min(100, computed.thirst + (meta.thirstRestore || 0) * qty),
          energy: Math.min(100, computed.energy + (meta.energyRestore || 0) * qty),
          lastCalculatedAt: Timestamp.fromMillis(nowMs),
        });
      } else {
        const oldInvQty = invDoc.exists ? Number(invDoc.data()!.quantity || 0) : 0;
        tx.set(invRef, {
          uid,
          itemId,
          category: meta?.category === 'raw' ? 'raw' : 'product',
          name: String(sData.name || meta?.name || itemId),
          quantity: oldInvQty + qty,
          updatedAtMs: nowMs,
        });
      }

      upsertDailyReportInTx(
        tx,
        db,
        businessId,
        String(biz.ownerId),
        dayKey,
        reportDoc.exists ? reportDoc.data() : undefined,
        { revenue: total, playerSales: qty, taxPaid: vat },
        nowMs
      );

      queueMarketVolumeDelta(tx, db, itemId, 0, qty);

      appendTransaction(tx, db, uid, {
        type: 'expense',
        category: 'belanja_toko',
        amount: total,
        balanceAfter: nextBuyerMoney,
        description: `Beli ${qty}x ${String(sData.name)} di ${String(biz.name)}`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: uid,
        to: `biz:${businessId}`,
        amount: netSeller,
        taxAmount: vat,
        reason: 'business_player_sale',
        refId: `${businessId}_${itemId}`,
        nowMs,
      });

      return { total, money: nextBuyerMoney, itemName: String(sData.name), qty };
    });

    return { ok: true, ...result };
  }
);

export const runPromotion = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown; tierId?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const tierId = typeof data.tierId === 'string' ? data.tierId.trim() : '';
    const tier = businessConfig.promotions.find((p) => p.id === tierId);

    if (!businessId || !tier) throw new HttpsError('invalid-argument', 'Paket promosi tidak valid.');

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    const dayKey = getGameDayKey(nowMs);
    const bizRef = db.collection('businesses').doc(businessId);
    const promoId = `promo_${nowMs}`;
    const promoRef = bizRef.collection('promotions').doc(promoId);
    const reportRef = bizRef.collection('daily_reports').doc(dayKey);

    await db.runTransaction(async (tx) => {
      const [bizDoc, reportDoc] = await Promise.all([tx.get(bizRef), tx.get(reportRef)]);
      if (!bizDoc.exists) throw new HttpsError('not-found', 'Bisnis tidak ditemukan.');
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');

      const cash = Number(biz.cash || 0);
      if (cash < tier.cost) {
        throw new HttpsError('failed-precondition', `Kas usaha kurang (butuh Rp ${tier.cost.toLocaleString('id-ID')}).`);
      }

      const expiresAtMs = nowMs + tier.durationMs;
      tx.update(bizRef, {
        cash: cash - tier.cost,
        promoBoostUntilMs: expiresAtMs,
        promoBoostValue: tier.popularityBoost,
        updatedAtMs: nowMs,
      });

      tx.set(promoRef, {
        id: promoId,
        businessId,
        ownerId: uid,
        tier: tier.id,
        cost: tier.cost,
        popularityBoost: tier.popularityBoost,
        startedAtMs: nowMs,
        expiresAtMs,
      });

      upsertDailyReportInTx(
        tx,
        db,
        businessId,
        uid,
        dayKey,
        reportDoc.exists ? reportDoc.data() : undefined,
        { promoCost: tier.cost },
        nowMs
      );

      appendLedger(tx, db, {
        from: `biz:${businessId}`,
        to: 'system:marketing',
        amount: tier.cost,
        reason: `business_promo_${tier.id}`,
        refId: promoId,
        nowMs,
      });
    });

    return { ok: true, tier: tier.label, expiresAtMs: nowMs + tier.durationMs };
  }
);

export const settleNpcSales = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    if (!businessId) throw new HttpsError('invalid-argument', 'ID bisnis tidak valid.');

    await assertNearBusiness(uid, businessId);

    const bizDoc = await db.collection('businesses').doc(businessId).get();
    if (!bizDoc.exists) throw new HttpsError('not-found', 'Bisnis tidak ditemukan.');
    if (bizDoc.data()!.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'Hanya pemilik yang dapat menghitung laporan penjualan.');
    }

    const res = await settleBusinessLazy(db, businessId, Date.now());
    return { ok: true, ...res };
  }
);

export const postBusinessJob = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      businessId?: unknown;
      roleTitle?: unknown;
      wagePerShift?: unknown;
      slotsOpen?: unknown;
      closePostId?: unknown;
    };

    const nowMs = Date.now();
    if (typeof data.closePostId === 'string' && isValidSimpleId(data.closePostId)) {
      const postRef = db.collection('business_job_posts').doc(data.closePostId);
      const postPre = await postRef.get();
      if (!postPre.exists) throw new HttpsError('not-found', 'Lowongan tidak ditemukan.');
      if (postPre.data()!.businessId) {
        await assertNearBusiness(uid, String(postPre.data()!.businessId));
      }
      await db.runTransaction(async (tx) => {
        const postDoc = await tx.get(postRef);
        if (!postDoc.exists) throw new HttpsError('not-found', 'Lowongan tidak ditemukan.');
        if (postDoc.data()!.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik.');
        tx.update(postRef, { status: 'closed' });
      });
      return { ok: true };
    }

    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const roleTitle = typeof data.roleTitle === 'string' ? data.roleTitle.trim().slice(0, 40) : 'Staf Toko';
    const wagePerShift = Math.floor(Number(data.wagePerShift || 25000));
    const slotsOpen = Math.max(1, Math.min(3, Math.floor(Number(data.slotsOpen || 1))));

    if (
      !businessId ||
      wagePerShift < businessConfig.playerEmployee.minWagePerShift ||
      wagePerShift > businessConfig.playerEmployee.maxWagePerShift
    ) {
      throw new HttpsError(
        'invalid-argument',
        `Upah shift harus Rp ${businessConfig.playerEmployee.minWagePerShift.toLocaleString('id-ID')} – Rp ${businessConfig.playerEmployee.maxWagePerShift.toLocaleString('id-ID')}.`
      );
    }

    await assertNearBusiness(uid, businessId);

    const bizDoc = await db.collection('businesses').doc(businessId).get();
    if (!bizDoc.exists) throw new HttpsError('not-found', 'Bisnis tidak ditemukan.');
    const biz = bizDoc.data()!;
    if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');

    const postId = `jobpost_${nowMs}_${Math.random().toString(36).slice(2, 5)}`;
    await db.collection('business_job_posts').doc(postId).set({
      id: postId,
      businessId,
      businessName: String(biz.name),
      businessType: String(biz.type),
      ownerId: uid,
      roleTitle,
      wagePerShift,
      slotsOpen,
      status: 'open',
      createdAtMs: nowMs,
    });

    return { ok: true, postId };
  }
);

export const hireEmployee = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as {
      businessId?: unknown;
      mode?: unknown;
      targetName?: unknown;
      roleTitle?: unknown;
      wagePerShift?: unknown;
      postId?: unknown;
    };

    const nowMs = Date.now();
    let businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';

    // Jalur pelamar menerima lowongan terbuka dari business_job_posts
    if (typeof data.postId === 'string' && isValidSimpleId(data.postId)) {
      const postRef = db.collection('business_job_posts').doc(data.postId);
      const postSnap = await postRef.get();
      if (!postSnap.exists || postSnap.data()!.status !== 'open') {
        throw new HttpsError('failed-precondition', 'Lowongan sudah tutup.');
      }
      const post = postSnap.data()!;
      businessId = String(post.businessId);
      if (post.ownerId === uid) {
        throw new HttpsError('invalid-argument', 'Pemilik tidak melamar ke lowongannya sendiri.');
      }

      await assertNearBusiness(
        uid,
        businessId,
        [],
        'Datangi lokasi bisnis ini terlebih dahulu untuk melamar lowongan.'
      );

      const empId = `emp_${uid}`;
      const bizRef = db.collection('businesses').doc(businessId);
      const charRef = db.collection('characters').doc(uid);
      await db.runTransaction(async (tx) => {
        const [bizDoc, charDoc, empDoc, postDoc] = await Promise.all([
          tx.get(bizRef),
          tx.get(charRef),
          tx.get(bizRef.collection('employees').doc(empId)),
          tx.get(postRef),
        ]);
        if (!bizDoc.exists || !charDoc.exists || !postDoc.exists) {
          throw new HttpsError('not-found', 'Data lowongan tidak lengkap.');
        }
        if (charDoc.data()!.currentJob) {
          throw new HttpsError('failed-precondition', 'Resign dari pekerjaan aktifmu terlebih dahulu.');
        }
        if (empDoc.exists && empDoc.data()!.status === 'active') {
          throw new HttpsError('already-exists', 'Kamu sudah bekerja di bisnis ini.');
        }
        const slots = Number(postDoc.data()!.slotsOpen || 0);
        if (slots <= 0 || postDoc.data()!.status !== 'open') {
          throw new HttpsError('failed-precondition', 'Slot lowongan penuh.');
        }

        tx.set(bizRef.collection('employees').doc(empId), {
          id: empId,
          businessId,
          ownerId: String(bizDoc.data()!.ownerId),
          uid,
          name: String(charDoc.data()!.name || 'Karyawan'),
          isNpc: false,
          roleTitle: String(post.roleTitle || 'Staf'),
          wagePerCycle: Number(post.wagePerShift || 25000),
          productivity: businessConfig.playerEmployee.productivityBonus,
          status: 'active',
          hiredAtMs: nowMs,
          lastPaidAtMs: nowMs,
          unpaidWage: 0,
        });

        tx.update(charRef, {
          currentJob: {
            employmentId: empId,
            jobId: `biz_${businessId}`,
            businessId,
            title: `${String(post.roleTitle)} (${String(bizDoc.data()!.name)})`,
            employer: String(bizDoc.data()!.name),
            rankIndex: 0,
            rankTitle: String(post.roleTitle),
            totalWorkSeconds: 0,
            shiftsCompleted: Number(charDoc.data()!.currentJob?.shiftsCompleted || 0),
            hiredAtMs: nowMs,
            lastShiftAtMs: 0,
          },
          updatedAt: Timestamp.fromMillis(nowMs),
        });

        tx.update(postRef, {
          slotsOpen: FieldValue.increment(-1),
          ...(slots - 1 <= 0 ? { status: 'closed' } : {}),
        });
      });

      return { ok: true, businessId };
    }

    if (!businessId) throw new HttpsError('invalid-argument', 'ID bisnis tidak valid.');
    const mode = data.mode === 'player' ? 'player' : 'npc';

    await assertNearBusiness(uid, businessId);

    const bizRef = db.collection('businesses').doc(businessId);
    const bizSnap = await bizRef.get();
    if (!bizSnap.exists) throw new HttpsError('not-found', 'Bisnis tidak ditemukan.');
    const biz = bizSnap.data()!;
    if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Hanya pemilik yang bisa merekrut.');

    const typeMeta = (businessConfig.businessTypes as Record<string, { maxEmployees: number }>)[
      String(biz.type)
    ];
    const activeEmps = await bizRef.collection('employees').where('status', '==', 'active').get();
    if (activeEmps.size >= (typeMeta?.maxEmployees || 2)) {
      throw new HttpsError('failed-precondition', 'Kapasitas karyawan sudah penuh.');
    }

    if (mode === 'npc') {
      const empId = `npc_${nowMs}_${Math.random().toString(36).slice(2, 5)}`;
      const npcNames = ['Kang Dede', 'Teh Santi', 'Mang Udin', 'Neng Rika', 'Kang Yogi'];
      const npcName = npcNames[activeEmps.size % npcNames.length];
      await bizRef.collection('employees').doc(empId).set({
        id: empId,
        businessId,
        ownerId: uid,
        uid: empId,
        name: npcName,
        isNpc: true,
        roleTitle: 'Asisten Toko (NPC)',
        wagePerCycle: businessConfig.npcEmployee.wagePerGameDay,
        productivity: businessConfig.npcEmployee.productivityBonus,
        status: 'active',
        hiredAtMs: nowMs,
        lastPaidAtMs: nowMs,
        unpaidWage: 0,
      });
      return { ok: true, empId, name: npcName, isNpc: true };
    }

    const targetName = typeof data.targetName === 'string' ? data.targetName.trim().toLowerCase() : '';
    const nameLock = targetName ? await db.collection('character_names').doc(targetName).get() : null;
    if (!nameLock || !nameLock.exists) {
      throw new HttpsError('not-found', 'Karakter pemain target tidak ditemukan.');
    }
    const targetUid = String(nameLock.data()!.uid);
    if (targetUid === uid) throw new HttpsError('invalid-argument', 'Tidak bisa merekrut diri sendiri.');

    const wage = Math.max(
      businessConfig.playerEmployee.minWagePerShift,
      Math.min(businessConfig.playerEmployee.maxWagePerShift, Math.floor(Number(data.wagePerShift || 25000)))
    );
    const roleTitle = typeof data.roleTitle === 'string' ? data.roleTitle.trim().slice(0, 40) : 'Staf Bisnis';
    const empId = `emp_${targetUid}`;
    const targetCharRef = db.collection('characters').doc(targetUid);

    await db.runTransaction(async (tx) => {
      const targetCharDoc = await tx.get(targetCharRef);
      tx.set(bizRef.collection('employees').doc(empId), {
        id: empId,
        businessId,
        ownerId: uid,
        uid: targetUid,
        name: String(nameLock.data()!.name || targetName),
        isNpc: false,
        roleTitle,
        wagePerCycle: wage,
        productivity: businessConfig.playerEmployee.productivityBonus,
        status: 'active',
        hiredAtMs: nowMs,
        lastPaidAtMs: nowMs,
        unpaidWage: 0,
      });

      if (targetCharDoc.exists && !targetCharDoc.data()!.currentJob) {
        tx.update(targetCharRef, {
          currentJob: {
            employmentId: empId,
            jobId: `biz_${businessId}`,
            businessId,
            title: `${roleTitle} (${String(biz.name)})`,
            employer: String(biz.name),
            rankIndex: 0,
            rankTitle: roleTitle,
            totalWorkSeconds: 0,
            shiftsCompleted: 0,
            hiredAtMs: nowMs,
            lastShiftAtMs: 0,
          },
          updatedAt: Timestamp.fromMillis(nowMs),
        });
      }
    });

    return { ok: true, empId, targetUid, isNpc: false };
  }
);

export const fireEmployee = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown; empId?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    const empId = isValidSimpleId(data.empId) ? data.empId.trim() : '';
    if (!businessId || !empId) throw new HttpsError('invalid-argument', 'ID tidak valid.');

    await assertNearBusiness(uid, businessId);

    const bizRef = db.collection('businesses').doc(businessId);
    const empRef = bizRef.collection('employees').doc(empId);
    await db.runTransaction(async (tx) => {
      const [bizDoc, empDoc] = await Promise.all([tx.get(bizRef), tx.get(empRef)]);
      if (!bizDoc.exists || !empDoc.exists) throw new HttpsError('not-found', 'Data karyawan tidak ada.');
      if (bizDoc.data()!.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');

      const empData = empDoc.data()!;
      tx.update(empRef, { status: 'fired' });
      if (!empData.isNpc && typeof empData.uid === 'string') {
        const targetCharRef = db.collection('characters').doc(String(empData.uid));
        const targetCharDoc = await tx.get(targetCharRef);
        if (targetCharDoc.exists && targetCharDoc.data()!.currentJob?.jobId === `biz_${businessId}`) {
          tx.update(targetCharRef, {
            currentJob: null,
            activeShift: null,
            updatedAt: Timestamp.now(),
          });
        }
      }
    });

    return { ok: true };
  }
);

export const payWages = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login diperlukan.');
    const uid = request.auth.uid;
    const data = (request.data || {}) as { businessId?: unknown };
    const businessId = isValidSimpleId(data.businessId) ? data.businessId.trim() : '';
    if (!businessId) throw new HttpsError('invalid-argument', 'ID bisnis tidak valid.');

    await assertNearBusiness(uid, businessId);

    const nowMs = Date.now();
    await settleBusinessLazy(db, businessId, nowMs);

    const dayKey = getGameDayKey(nowMs);
    const bizRef = db.collection('businesses').doc(businessId);
    const empSnap = await bizRef.collection('employees').where('status', '==', 'active').get();
    if (empSnap.empty) {
      return { ok: true, totalPaid: 0, count: 0 };
    }

    const result = await db.runTransaction(async (tx) => {
      const [bizDoc, reportDoc] = await Promise.all([
        tx.get(bizRef),
        tx.get(bizRef.collection('daily_reports').doc(dayKey)),
      ]);
      if (!bizDoc.exists) throw new HttpsError('not-found', 'Bisnis tidak ditemukan.');
      const biz = bizDoc.data()!;
      if (biz.ownerId !== uid) throw new HttpsError('permission-denied', 'Bukan pemilik bisnis.');

      const empDocs = await Promise.all(empSnap.docs.map((d) => tx.get(d.ref)));
      let totalDue = 0;
      const toPay: Array<{ ref: FirebaseFirestore.DocumentReference; amount: number; name: string }> = [];

      for (const eDoc of empDocs) {
        if (!eDoc.exists) continue;
        const ed = eDoc.data()!;
        const unpaid = Math.max(0, Number(ed.unpaidWage || 0));
        const due = unpaid > 0 ? unpaid : Number(ed.isNpc ? ed.wagePerCycle : 0);
        if (due > 0) {
          totalDue += due;
          toPay.push({ ref: eDoc.ref, amount: due, name: String(ed.name) });
        }
      }

      if (totalDue <= 0) return { totalPaid: 0, count: 0 };

      const cash = Number(biz.cash || 0);
      if (cash < totalDue) {
        throw new HttpsError('failed-precondition', `Kas usaha kurang untuk bayar gaji Rp ${totalDue.toLocaleString('id-ID')}.`);
      }

      tx.update(bizRef, { cash: cash - totalDue, lastWageAtMs: nowMs, updatedAtMs: nowMs });
      for (const p of toPay) {
        tx.update(p.ref, { unpaidWage: 0, lastPaidAtMs: nowMs });
      }

      upsertDailyReportInTx(
        tx,
        db,
        businessId,
        uid,
        dayKey,
        reportDoc.exists ? reportDoc.data() : undefined,
        { wageCost: totalDue },
        nowMs
      );

      appendLedger(tx, db, {
        from: `biz:${businessId}`,
        to: 'system:wages',
        amount: totalDue,
        reason: 'business_pay_wages',
        refId: `${businessId}_${dayKey}`,
        nowMs,
      });

      return { totalPaid: totalDue, count: toPay.length };
    });

    return { ok: true, ...result };
  }
);
