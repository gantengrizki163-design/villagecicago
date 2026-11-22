import type { Firestore, Transaction } from 'firebase-admin/firestore';
import businessConfig from '../config/business.json';
import { appendLedger, applyTreasuryCredit } from './ledger';
import { getActiveEconomicEvent, getProductMeta, taxConfig } from './market';
import { GAME_DAY_DURATION_MS, GAME_EPOCH_MS } from './phase2';

export { businessConfig };

export function getGameDayIndex(nowMs: number): number {
  return Math.floor(Math.max(0, nowMs - GAME_EPOCH_MS) / GAME_DAY_DURATION_MS);
}

export function getGameDayKey(nowMs: number): string {
  return `day_${getGameDayIndex(nowMs)}`;
}

export function getGameHour(nowMs: number): number {
  const progress = ((Math.max(0, nowMs - GAME_EPOCH_MS) % GAME_DAY_DURATION_MS) / GAME_DAY_DURATION_MS);
  return Math.floor(progress * 24) % 24;
}

export function deterministicUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function getBusinessLocationFactor(areaTag: string): number {
  switch (areaTag) {
    case 'pasar':
      return 1.25;
    case 'stasiun':
      return 1.2;
    case 'alun_alun':
      return 1.15;
    case 'perumahan':
      return 0.95;
    default:
      return 0.9;
  }
}

export function upsertDailyReportInTx(
  tx: Transaction,
  firestore: Firestore,
  businessId: string,
  ownerId: string,
  dayKey: string,
  existingData: Record<string, unknown> | undefined,
  delta: {
    revenue?: number;
    npcSales?: number;
    playerSales?: number;
    stockCost?: number;
    wageCost?: number;
    taxPaid?: number;
    promoCost?: number;
  },
  nowMs: number
) {
  const ref = firestore
    .collection('businesses')
    .doc(businessId)
    .collection('daily_reports')
    .doc(dayKey);

  const cur = existingData || {};
  const revenue = Number(cur.revenue || 0) + Math.round(delta.revenue || 0);
  const npcSales = Number(cur.npcSales || 0) + Math.round(delta.npcSales || 0);
  const playerSales = Number(cur.playerSales || 0) + Math.round(delta.playerSales || 0);
  const stockCost = Number(cur.stockCost || 0) + Math.round(delta.stockCost || 0);
  const wageCost = Number(cur.wageCost || 0) + Math.round(delta.wageCost || 0);
  const taxPaid = Number(cur.taxPaid || 0) + Math.round(delta.taxPaid || 0);
  const promoCost = Number(cur.promoCost || 0) + Math.round(delta.promoCost || 0);
  const netProfit = revenue - stockCost - wageCost - taxPaid - promoCost;

  tx.set(ref, {
    dayKey,
    businessId,
    ownerId,
    revenue,
    npcSales,
    playerSales,
    stockCost,
    wageCost,
    taxPaid,
    promoCost,
    netProfit,
    updatedAtMs: nowMs,
  });
}

/**
 * Simulasi penjualan NPC, pembusukan stok (spoilage), dan akumulasi gaji karyawan secara lazy
 * berbasis timestamp tanpa cron/loop server.
 */
export async function settleBusinessLazy(
  db: Firestore,
  businessId: string,
  nowMs: number
): Promise<{
  npcCustomersServed: number;
  itemsSold: number;
  grossRevenue: number;
  spoiledCount: number;
  wageAccrued: number;
}> {
  const bizRef = db.collection('businesses').doc(businessId);
  const dayKey = getGameDayKey(nowMs);

  const [bizSnap, stockSnap, empSnap, marketSnap, treasurySnap] = await Promise.all([
    bizRef.get(),
    bizRef.collection('stock').get(),
    bizRef.collection('employees').where('status', '==', 'active').get(),
    db.collection('market_stats').get(),
    db.collection('state').doc('treasury').get(),
  ]);

  if (!bizSnap.exists) {
    return { npcCustomersServed: 0, itemsSold: 0, grossRevenue: 0, spoiledCount: 0, wageAccrued: 0 };
  }

  const biz = bizSnap.data()!;
  if (biz.status !== 'active') {
    return { npcCustomersServed: 0, itemsSold: 0, grossRevenue: 0, spoiledCount: 0, wageAccrued: 0 };
  }

  const lastSettledAtMs = Number(biz.lastSettledAtMs || biz.createdAtMs || nowMs);
  const elapsedMs = Math.max(0, nowMs - lastSettledAtMs);
  if (elapsedMs < 30_000) {
    // Cooldown 30 detik agar panggilan berulang tidak memicu write tidak perlu
    return { npcCustomersServed: 0, itemsSold: 0, grossRevenue: 0, spoiledCount: 0, wageAccrued: 0 };
  }

  const marketMap = new Map<string, number>();
  for (const m of marketSnap.docs) {
    marketMap.set(m.id, Number(m.data().currentPrice || m.data().basePrice || 10000));
  }
  const activeEvent = getActiveEconomicEvent(treasurySnap.data(), nowMs);
  const eventMults = (activeEvent?.categoryMultipliers || {}) as Record<string, number>;

  return await db.runTransaction(async (tx) => {
    const freshBizSnap = await tx.get(bizRef);
    if (!freshBizSnap.exists) {
      return { npcCustomersServed: 0, itemsSold: 0, grossRevenue: 0, spoiledCount: 0, wageAccrued: 0 };
    }
    const freshBiz = freshBizSnap.data()!;
    const freshLastSettled = Number(freshBiz.lastSettledAtMs || nowMs);
    const freshElapsedMs = Math.max(0, nowMs - freshLastSettled);
    if (freshElapsedMs < 30_000 || freshBiz.status !== 'active') {
      return { npcCustomersServed: 0, itemsSold: 0, grossRevenue: 0, spoiledCount: 0, wageAccrued: 0 };
    }

    const reportRef = bizRef.collection('daily_reports').doc(dayKey);
    const [freshTreasury, reportDoc] = await Promise.all([
      tx.get(db.collection('state').doc('treasury')),
      tx.get(reportRef),
    ]);

    const stockDocs = await Promise.all(stockSnap.docs.map((d) => tx.get(d.ref)));
    const empDocs = await Promise.all(empSnap.docs.map((d) => tx.get(d.ref)));

    let spoiledCount = 0;
    const sellableItems: Array<{
      ref: FirebaseFirestore.DocumentReference;
      itemId: string;
      qty: number;
      sellPrice: number;
      category: string;
    }> = [];

    for (const sDoc of stockDocs) {
      if (!sDoc.exists) continue;
      const sd = sDoc.data()!;
      const qty = Math.max(0, Number(sd.qty || 0));
      const expiresAtMs = Number(sd.expiresAtMs || 0);
      if (qty > 0 && expiresAtMs > 0 && nowMs >= expiresAtMs) {
        spoiledCount += qty;
        tx.update(sDoc.ref, { qty: 0, updatedAtMs: nowMs });
        continue;
      }
      if (qty > 0) {
        sellableItems.push({
          ref: sDoc.ref,
          itemId: String(sd.itemId),
          qty,
          sellPrice: Math.max(500, Number(sd.sellPrice || 5000)),
          category: String(sd.category || 'product'),
        });
      }
    }

    // Hitung bonus karyawan aktif & tunggakan gaji NPC lazy
    const elapsedDays = Math.min(
      businessConfig.maxNpcSettleGameDaysPerCall,
      freshElapsedMs / GAME_DAY_DURATION_MS
    );
    let employeeCapBoost = 0;
    let wageAccrued = 0;

    for (const eDoc of empDocs) {
      if (!eDoc.exists) continue;
      const ed = eDoc.data()!;
      if (ed.status !== 'active') continue;
      employeeCapBoost += Number(ed.productivity || 0.25);

      if (ed.isNpc) {
        const lastPaid = Number(ed.lastPaidAtMs || ed.hiredAtMs || nowMs);
        const unpaidDays = Math.max(0, nowMs - lastPaid) / GAME_DAY_DURATION_MS;
        if (unpaidDays >= 0.25) {
          const owed = Math.round(unpaidDays * Number(ed.wagePerCycle || businessConfig.npcEmployee.wagePerGameDay));
          const maxUnpaid =
            Number(ed.wagePerCycle || businessConfig.npcEmployee.wagePerGameDay) *
            businessConfig.npcEmployee.maxUnpaidCyclesBeforeResign;
          const totalUnpaid = Number(ed.unpaidWage || 0) + owed;
          wageAccrued += owed;
          if (totalUnpaid > maxUnpaid) {
            tx.update(eDoc.ref, {
              unpaidWage: totalUnpaid,
              status: 'resigned',
              lastPaidAtMs: nowMs,
            });
          } else {
            tx.update(eDoc.ref, {
              unpaidWage: totalUnpaid,
              lastPaidAtMs: nowMs,
            });
          }
        }
      }
    }

    let npcCustomersServed = 0;
    let itemsSold = 0;
    let grossRevenue = 0;
    let vatTax = 0;

    const typeMeta =
      (businessConfig.businessTypes as Record<
        string,
        { npcMaxCustomersPerGameDay?: number }
      >)[String(freshBiz.type)] || {};

    if (freshBiz.isOpen && sellableItems.length > 0) {
      const basePop = Number(freshBiz.popularity || 30);
      const promoActive =
        Number(freshBiz.promoBoostUntilMs || 0) > nowMs ? Number(freshBiz.promoBoostValue || 0) : 0;
      const effectivePop = Math.min(100, basePop + promoActive);

      const gameHour = getGameHour(nowMs);
      const rushFactor =
        (gameHour >= 7 && gameHour <= 10) || (gameHour >= 17 && gameHour <= 20) ? 1.25 : 0.9;
      const locFactor = getBusinessLocationFactor(String(freshBiz.areaTag || 'kampung'));
      const maxCap = Number(typeMeta.npcMaxCustomersPerGameDay || 16);
      const popRatio = 0.25 + (effectivePop / 100) * 0.75;
      const empMult = 1 + Math.min(1.0, employeeCapBoost);
      const windowSeed = `${businessId}_${Math.floor(nowMs / 60_000)}`;
      const jitter = 0.8 + deterministicUnit(windowSeed) * 0.4;

      const rawPotentialCustomers = Math.floor(
        maxCap * elapsedDays * popRatio * locFactor * rushFactor * empMult * jitter
      );

      // Utamakan produk jadi (category !== 'raw') atau barang stok tersedia
      const prioritized = [...sellableItems].sort((a, b) =>
        a.category === b.category ? 0 : a.category === 'raw' ? 1 : -1
      );

      let remainingCust = Math.max(0, rawPotentialCustomers);
      for (let i = 0; i < prioritized.length && remainingCust > 0; i++) {
        const item = prioritized[i];
        const meta = getProductMeta(item.itemId);
        const marketRefPrice =
          marketMap.get(item.itemId) ||
          (meta ? meta.suggestedRetail : item.sellPrice);
        const eventMult = eventMults[item.category] ?? 1.0;
        const fairPrice = marketRefPrice * eventMult;
        const priceRatio = item.sellPrice / Math.max(500, fairPrice);

        // Harga terlalu tinggi mengurangi minat NPC drastis
        const priceAppeal =
          priceRatio <= 1.0 ? 1.0 : priceRatio <= 1.3 ? 0.65 : priceRatio <= 1.6 ? 0.25 : 0.0;
        if (priceAppeal <= 0) continue;

        const wantQty = Math.max(
          0,
          Math.floor((remainingCust / Math.max(1, prioritized.length - i)) * priceAppeal)
        );
        const soldQty = Math.min(item.qty, wantQty);
        if (soldQty <= 0) continue;

        itemsSold += soldQty;
        npcCustomersServed += soldQty;
        remainingCust -= soldQty;
        grossRevenue += soldQty * item.sellPrice;

        tx.update(item.ref, {
          qty: item.qty - soldQty,
          updatedAtMs: nowMs,
        });
      }
    }

    if (grossRevenue > 0) {
      vatTax = Math.round(grossRevenue * taxConfig.businessSalesVatRate);
      const netRev = grossRevenue - vatTax;
      const nextCash = Number(freshBiz.cash || 0) + netRev;

      tx.update(bizRef, {
        cash: nextCash,
        lastSettledAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      applyTreasuryCredit(tx, db, freshTreasury, vatTax, 'business', nowMs);
      upsertDailyReportInTx(
        tx,
        db,
        businessId,
        String(freshBiz.ownerId),
        dayKey,
        reportDoc.exists ? reportDoc.data() : undefined,
        {
          revenue: grossRevenue,
          npcSales: itemsSold,
          taxPaid: vatTax,
        },
        nowMs
      );

      appendLedger(tx, db, {
        from: 'system:npc',
        to: `biz:${businessId}`,
        amount: netRev,
        taxAmount: vatTax,
        reason: 'business_npc_sales',
        refId: `${businessId}_${dayKey}`,
        nowMs,
      });
    } else {
      tx.update(bizRef, {
        lastSettledAtMs: nowMs,
        updatedAtMs: nowMs,
      });
    }

    return {
      npcCustomersServed,
      itemsSold,
      grossRevenue,
      spoiledCount,
      wageAccrued,
    };
  });
}
