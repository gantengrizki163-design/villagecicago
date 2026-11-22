import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { settleAuctionTx } from './auctions';
import { deterministicUnit } from '../helpers/business';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import {
  computeDynamicMarketPrice,
  economyConfig,
  getProductMeta,
  productsConfig,
} from '../helpers/market';
import { GAME_DAY_DURATION_MS } from '../helpers/phase2';

function pickScheduledEvent(nowMs: number, currentEventId?: string) {
  const slot = Math.floor(nowMs / 7_200_000);
  const events = economyConfig.events;
  const roll = deterministicUnit(`macro_event_${slot}`);
  const idx = Math.floor(roll * events.length) % events.length;
  const picked = events[idx] ?? events[0];
  if (picked.id === currentEventId && events.length > 1) {
    return events[(idx + 1) % events.length] ?? picked;
  }
  return picked;
}

/**
 * Menghitung ulang harga pasar dinamis (batch), indeks inflasi lambat, rotasi event ekonomi,
 * estimasi uang beredar, dan menutup lelang kedaluwarsa secara hemat biaya.
 */
export async function recalculateMarketStatsAndMacro(options?: {
  force?: boolean;
  overrideEventId?: string;
}) {
  const nowMs = Date.now();
  const treasuryRef = db.collection('state').doc('treasury');
  const treasurySnap = await treasuryRef.get();
  const treasury = treasurySnap.exists ? treasurySnap.data()! : {};

  const lastUpdatedMs = Number(treasury.updatedAtMs || 0);
  if (
    !options?.force &&
    !options?.overrideEventId &&
    lastUpdatedMs > 0 &&
    nowMs - lastUpdatedMs < economyConfig.marketStatsCooldownMs
  ) {
    return {
      skippedCooldown: true,
      inflationIndex: Number(treasury.inflationIndex || 1.0),
      activeEventId: String(treasury.activeEventId || 'normal'),
      activeEventUntilMs: Number(treasury.activeEventUntilMs || nowMs + 7_200_000),
      estimatedMoneySupply: Number(treasury.estimatedMoneySupply || 0),
      avgMarketPriceIndex: Number(treasury.avgMarketPriceIndex || 1.0),
      settledAuctions: 0,
    };
  }

  // 1. Tentukan event ekonomi aktif (rotasi otomatis saat kedaluwarsa atau override admin)
  let activeEvent =
    economyConfig.events.find((e) => e.id === String(treasury.activeEventId || 'normal')) ??
    economyConfig.events[0];
  let activeEventUntilMs = Number(treasury.activeEventUntilMs || 0);

  if (options?.overrideEventId) {
    const found = economyConfig.events.find((e) => e.id === options.overrideEventId);
    if (found) {
      activeEvent = found;
      activeEventUntilMs = nowMs + found.durationMs;
    }
  } else if (activeEventUntilMs <= 0 || nowMs >= activeEventUntilMs) {
    activeEvent = pickScheduledEvent(nowMs, activeEvent.id);
    activeEventUntilMs = nowMs + activeEvent.durationMs;
  }

  // 2. Hitung inflasi pelan + mean-reversion halus agar ekonomi tetap sehat
  const prevInflation = Number(treasury.inflationIndex || 1.0);
  const elapsedDays = Math.min(
    3,
    Math.max(0, (nowMs - (lastUpdatedMs || nowMs)) / GAME_DAY_DURATION_MS)
  );
  const drift = elapsedDays * economyConfig.inflationRatePerGameDay;
  const meanReversion = (1.05 - prevInflation) * 0.02 * elapsedDays;
  const nextInflation = Math.max(
    economyConfig.minInflationIndex,
    Math.min(
      economyConfig.maxInflationIndex,
      Math.round((prevInflation + drift + meanReversion) * 10000) / 10000
    )
  );

  // 3. Batch baca market_stats, sample uang beredar (bounded limit), & lelang kedaluwarsa
  const [marketSnap, charsSnap, accountsSnap, bizSnap, expiredAuctionsSnap] = await Promise.all([
    db.collection('market_stats').get(),
    db.collection('characters').limit(100).get(),
    db.collection('accounts').limit(100).get(),
    db.collection('businesses').where('status', '==', 'active').limit(100).get(),
    db
      .collection('auctions')
      .where('status', '==', 'active')
      .where('endsAtMs', '<=', nowMs)
      .limit(10)
      .get(),
  ]);

  let moneySupply = 0;
  for (const c of charsSnap.docs) moneySupply += Math.max(0, Number(c.data().money || 0));
  for (const a of accountsSnap.docs) {
    moneySupply += Math.max(0, Number(a.data().balance || 0)) + Math.max(0, Number(a.data().savings || 0));
  }
  for (const b of bizSnap.docs) moneySupply += Math.max(0, Number(b.data().cash || 0));

  const batch = db.batch();
  const eventMults = (activeEvent.categoryMultipliers || {}) as Record<string, number>;
  const existingMap = new Map(marketSnap.docs.map((d) => [d.id, d.data()]));

  let ratioSum = 0;
  let ratioCount = 0;

  for (const prod of productsConfig.products) {
    const meta = getProductMeta(prod.id);
    if (!meta) continue;

    const existing = existingMap.get(prod.id);
    const curSupply = Number(existing?.supply ?? 100);
    const curDemand = Number(existing?.demand ?? 100);
    const pendingSupply = Number(existing?.pendingSupplyDelta ?? 0);
    const pendingDemand = Number(existing?.pendingDemandDelta ?? 0);

    // Mean-reversion 8% per batch update agar lonjakan sementara kembali seimbang
    const nextSupply = Math.max(10, Math.round(curSupply * 0.92 + 100 * 0.08 + pendingSupply));
    const nextDemand = Math.max(10, Math.round(curDemand * 0.92 + 100 * 0.08 + pendingDemand));
    const eventMultiplier = Number(eventMults[meta.category] ?? 1.0);

    const currentPrice = computeDynamicMarketPrice({
      basePrice: meta.basePrice,
      supply: nextSupply,
      demand: nextDemand,
      inflationIndex: nextInflation,
      eventMultiplier,
    });
    const wholesalePrice = Math.max(
      500,
      Math.round((meta.wholesalePrice * (currentPrice / Math.max(500, meta.basePrice))) / 100) * 100
    );

    ratioSum += currentPrice / Math.max(500, meta.basePrice);
    ratioCount += 1;

    batch.set(
      db.collection('market_stats').doc(prod.id),
      {
        itemId: prod.id,
        name: meta.name,
        category: meta.category,
        basePrice: meta.basePrice,
        currentPrice,
        wholesalePrice,
        supply: nextSupply,
        demand: nextDemand,
        pendingSupplyDelta: 0,
        pendingDemandDelta: 0,
        eventMultiplier,
        updatedAtMs: nowMs,
      },
      { merge: true }
    );
  }

  const avgMarketPriceIndex =
    ratioCount > 0 ? Math.round((ratioSum / ratioCount) * 1000) / 1000 : 1.0;

  batch.set(
    treasuryRef,
    {
      balance: Number(treasury.balance || 0),
      totalTaxCollected: Number(treasury.totalTaxCollected || 0),
      incomeTaxTotal: Number(treasury.incomeTaxTotal || 0),
      businessTaxTotal: Number(treasury.businessTaxTotal || 0),
      propertyTaxTotal: Number(treasury.propertyTaxTotal || 0),
      marketFeeTotal: Number(treasury.marketFeeTotal || 0),
      auctionFeeTotal: Number(treasury.auctionFeeTotal || 0),
      inflationIndex: nextInflation,
      activeEventId: activeEvent.id,
      activeEventLabel: activeEvent.label,
      activeEventUntilMs,
      estimatedMoneySupply: Math.round(moneySupply),
      avgMarketPriceIndex,
      updatedAtMs: nowMs,
    },
    { merge: true }
  );

  await batch.commit();

  // 4. Tutup lelang yang sudah kedaluwarsa secara bertahap (maks 10 per tick)
  let settledAuctions = 0;
  for (const aucDoc of expiredAuctionsSnap.docs) {
    try {
      await settleAuctionTx(db, aucDoc.id, null, { nowMs });
      settledAuctions += 1;
    } catch {
      // Abaikan bila sudah diselesaikan oleh pemanggilan lazy klien bersamaan
    }
  }

  return {
    skippedCooldown: false,
    inflationIndex: nextInflation,
    activeEventId: activeEvent.id,
    activeEventLabel: activeEvent.label,
    activeEventUntilMs,
    estimatedMoneySupply: Math.round(moneySupply),
    avgMarketPriceIndex,
    settledAuctions,
  };
}

export const updateMarketStats = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const res = await recalculateMarketStatsAndMacro({ force: false });
    return { ok: true, ...res };
  }
);

export const triggerEconomicEvent = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const isAdminOrEmulator =
      request.auth.token?.admin === true || process.env.FUNCTIONS_EMULATOR === 'true';
    if (!isAdminOrEmulator) {
      throw new HttpsError(
        'permission-denied',
        'Hanya admin/emulator yang dapat memicu event ekonomi secara manual.'
      );
    }

    const eventId =
      typeof request.data?.eventId === 'string' ? request.data.eventId.trim() : 'normal';
    const exists = economyConfig.events.some((e) => e.id === eventId);
    if (!exists) {
      throw new HttpsError('invalid-argument', 'ID event ekonomi tidak terdaftar.');
    }

    const res = await recalculateMarketStatsAndMacro({
      force: true,
      overrideEventId: eventId,
    });
    return { ok: true, ...res };
  }
);

export const scheduledMarketTick = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: FUNCTIONS_REGION,
  },
  async () => {
    await recalculateMarketStatsAndMacro({ force: true });
  }
);
