"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledMarketTick = exports.triggerEconomicEvent = exports.updateMarketStats = void 0;
exports.recalculateMarketStatsAndMacro = recalculateMarketStatsAndMacro;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const auctions_1 = require("./auctions");
const business_1 = require("../helpers/business");
const firebase_1 = require("../helpers/firebase");
const market_1 = require("../helpers/market");
const phase2_1 = require("../helpers/phase2");
function pickScheduledEvent(nowMs, currentEventId) {
    const slot = Math.floor(nowMs / 7_200_000);
    const events = market_1.economyConfig.events;
    const roll = (0, business_1.deterministicUnit)(`macro_event_${slot}`);
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
async function recalculateMarketStatsAndMacro(options) {
    const nowMs = Date.now();
    const treasuryRef = firebase_1.db.collection('state').doc('treasury');
    const treasurySnap = await treasuryRef.get();
    const treasury = treasurySnap.exists ? treasurySnap.data() : {};
    const lastUpdatedMs = Number(treasury.updatedAtMs || 0);
    if (!options?.force &&
        !options?.overrideEventId &&
        lastUpdatedMs > 0 &&
        nowMs - lastUpdatedMs < market_1.economyConfig.marketStatsCooldownMs) {
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
    let activeEvent = market_1.economyConfig.events.find((e) => e.id === String(treasury.activeEventId || 'normal')) ??
        market_1.economyConfig.events[0];
    let activeEventUntilMs = Number(treasury.activeEventUntilMs || 0);
    if (options?.overrideEventId) {
        const found = market_1.economyConfig.events.find((e) => e.id === options.overrideEventId);
        if (found) {
            activeEvent = found;
            activeEventUntilMs = nowMs + found.durationMs;
        }
    }
    else if (activeEventUntilMs <= 0 || nowMs >= activeEventUntilMs) {
        activeEvent = pickScheduledEvent(nowMs, activeEvent.id);
        activeEventUntilMs = nowMs + activeEvent.durationMs;
    }
    // 2. Hitung inflasi pelan + mean-reversion halus agar ekonomi tetap sehat
    const prevInflation = Number(treasury.inflationIndex || 1.0);
    const elapsedDays = Math.min(3, Math.max(0, (nowMs - (lastUpdatedMs || nowMs)) / phase2_1.GAME_DAY_DURATION_MS));
    const drift = elapsedDays * market_1.economyConfig.inflationRatePerGameDay;
    const meanReversion = (1.05 - prevInflation) * 0.02 * elapsedDays;
    const nextInflation = Math.max(market_1.economyConfig.minInflationIndex, Math.min(market_1.economyConfig.maxInflationIndex, Math.round((prevInflation + drift + meanReversion) * 10000) / 10000));
    // 3. Batch baca market_stats, sample uang beredar (bounded limit), & lelang kedaluwarsa
    const [marketSnap, charsSnap, accountsSnap, bizSnap, expiredAuctionsSnap] = await Promise.all([
        firebase_1.db.collection('market_stats').get(),
        firebase_1.db.collection('characters').limit(100).get(),
        firebase_1.db.collection('accounts').limit(100).get(),
        firebase_1.db.collection('businesses').where('status', '==', 'active').limit(100).get(),
        firebase_1.db
            .collection('auctions')
            .where('status', '==', 'active')
            .where('endsAtMs', '<=', nowMs)
            .limit(10)
            .get(),
    ]);
    let moneySupply = 0;
    for (const c of charsSnap.docs)
        moneySupply += Math.max(0, Number(c.data().money || 0));
    for (const a of accountsSnap.docs) {
        moneySupply += Math.max(0, Number(a.data().balance || 0)) + Math.max(0, Number(a.data().savings || 0));
    }
    for (const b of bizSnap.docs)
        moneySupply += Math.max(0, Number(b.data().cash || 0));
    const batch = firebase_1.db.batch();
    const eventMults = (activeEvent.categoryMultipliers || {});
    const existingMap = new Map(marketSnap.docs.map((d) => [d.id, d.data()]));
    let ratioSum = 0;
    let ratioCount = 0;
    for (const prod of market_1.productsConfig.products) {
        const meta = (0, market_1.getProductMeta)(prod.id);
        if (!meta)
            continue;
        const existing = existingMap.get(prod.id);
        const curSupply = Number(existing?.supply ?? 100);
        const curDemand = Number(existing?.demand ?? 100);
        const pendingSupply = Number(existing?.pendingSupplyDelta ?? 0);
        const pendingDemand = Number(existing?.pendingDemandDelta ?? 0);
        // Mean-reversion 8% per batch update agar lonjakan sementara kembali seimbang
        const nextSupply = Math.max(10, Math.round(curSupply * 0.92 + 100 * 0.08 + pendingSupply));
        const nextDemand = Math.max(10, Math.round(curDemand * 0.92 + 100 * 0.08 + pendingDemand));
        const eventMultiplier = Number(eventMults[meta.category] ?? 1.0);
        const currentPrice = (0, market_1.computeDynamicMarketPrice)({
            basePrice: meta.basePrice,
            supply: nextSupply,
            demand: nextDemand,
            inflationIndex: nextInflation,
            eventMultiplier,
        });
        const wholesalePrice = Math.max(500, Math.round((meta.wholesalePrice * (currentPrice / Math.max(500, meta.basePrice))) / 100) * 100);
        ratioSum += currentPrice / Math.max(500, meta.basePrice);
        ratioCount += 1;
        batch.set(firebase_1.db.collection('market_stats').doc(prod.id), {
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
        }, { merge: true });
    }
    const avgMarketPriceIndex = ratioCount > 0 ? Math.round((ratioSum / ratioCount) * 1000) / 1000 : 1.0;
    batch.set(treasuryRef, {
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
    }, { merge: true });
    await batch.commit();
    // 4. Tutup lelang yang sudah kedaluwarsa secara bertahap (maks 10 per tick)
    let settledAuctions = 0;
    for (const aucDoc of expiredAuctionsSnap.docs) {
        try {
            await (0, auctions_1.settleAuctionTx)(firebase_1.db, aucDoc.id, null, { nowMs });
            settledAuctions += 1;
        }
        catch {
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
exports.updateMarketStats = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const res = await recalculateMarketStatsAndMacro({ force: false });
    return { ok: true, ...res };
});
exports.triggerEconomicEvent = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const isAdminOrEmulator = request.auth.token?.admin === true || process.env.FUNCTIONS_EMULATOR === 'true';
    if (!isAdminOrEmulator) {
        throw new https_1.HttpsError('permission-denied', 'Hanya admin/emulator yang dapat memicu event ekonomi secara manual.');
    }
    const eventId = typeof request.data?.eventId === 'string' ? request.data.eventId.trim() : 'normal';
    const exists = market_1.economyConfig.events.some((e) => e.id === eventId);
    if (!exists) {
        throw new https_1.HttpsError('invalid-argument', 'ID event ekonomi tidak terdaftar.');
    }
    const res = await recalculateMarketStatsAndMacro({
        force: true,
        overrideEventId: eventId,
    });
    return { ok: true, ...res };
});
exports.scheduledMarketTick = (0, scheduler_1.onSchedule)({
    schedule: 'every 60 minutes',
    region: firebase_1.FUNCTIONS_REGION,
}, async () => {
    await recalculateMarketStatsAndMacro({ force: true });
});
//# sourceMappingURL=economy.js.map