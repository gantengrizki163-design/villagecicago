"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxConfig = exports.productsConfig = exports.economyConfig = void 0;
exports.getProductMeta = getProductMeta;
exports.getSupplierMeta = getSupplierMeta;
exports.getRecipeMeta = getRecipeMeta;
exports.getActiveEconomicEvent = getActiveEconomicEvent;
exports.computeDynamicMarketPrice = computeDynamicMarketPrice;
exports.getFairPriceBounds = getFairPriceBounds;
exports.queueMarketVolumeDelta = queueMarketVolumeDelta;
const firestore_1 = require("firebase-admin/firestore");
const economy_json_1 = __importDefault(require("../config/economy.json"));
exports.economyConfig = economy_json_1.default;
const products_json_1 = __importDefault(require("../config/products.json"));
exports.productsConfig = products_json_1.default;
const tax_json_1 = __importDefault(require("../config/tax.json"));
exports.taxConfig = tax_json_1.default;
function getProductMeta(itemId) {
    return products_json_1.default.products.find((p) => p.id === itemId) ?? null;
}
function getSupplierMeta(supplierId) {
    if (!supplierId)
        return null;
    return products_json_1.default.suppliers.find((s) => s.id === supplierId) ?? null;
}
function getRecipeMeta(recipeId) {
    return products_json_1.default.recipes.find((r) => r.id === recipeId) ?? null;
}
function getActiveEconomicEvent(treasuryData, nowMs) {
    const activeId = String(treasuryData?.activeEventId || 'normal');
    const untilMs = Number(treasuryData?.activeEventUntilMs || 0);
    if (untilMs > 0 && nowMs > untilMs) {
        return economy_json_1.default.events[0];
    }
    return economy_json_1.default.events.find((e) => e.id === activeId) ?? economy_json_1.default.events[0];
}
function computeDynamicMarketPrice(params) {
    const safeSupply = Math.max(10, params.supply);
    const safeDemand = Math.max(10, params.demand);
    const ratio = (safeDemand - safeSupply) / Math.max(safeSupply, safeDemand);
    const rawSdFactor = 1 + ratio * economy_json_1.default.supplyDemandSensitivity;
    const sdFactor = Math.max(economy_json_1.default.minSupplyDemandFactor, Math.min(economy_json_1.default.maxSupplyDemandFactor, rawSdFactor));
    const inflation = Math.max(economy_json_1.default.minInflationIndex, Math.min(economy_json_1.default.maxInflationIndex, params.inflationIndex));
    const computed = params.basePrice * sdFactor * params.eventMultiplier * inflation;
    return Math.max(500, Math.round(computed / 100) * 100);
}
function getFairPriceBounds(marketPrice) {
    return {
        minPrice: Math.max(500, Math.round((marketPrice * economy_json_1.default.minPriceRatioVsMarket) / 100) * 100),
        maxPrice: Math.max(1000, Math.round((marketPrice * economy_json_1.default.maxPriceRatioVsMarket) / 100) * 100),
    };
}
function queueMarketVolumeDelta(tx, firestore, itemId, supplyDelta, demandDelta) {
    const ref = firestore.collection('market_stats').doc(itemId);
    const meta = getProductMeta(itemId);
    if (!meta)
        return;
    // Menggunakan set merge dengan FieldValue.increment untuk buffer delta market_stats
    tx.set(ref, {
        itemId,
        name: meta.name,
        category: meta.category,
        basePrice: meta.basePrice,
        pendingSupplyDelta: firestore_1.FieldValue.increment(Math.round(supplyDelta)),
        pendingDemandDelta: firestore_1.FieldValue.increment(Math.round(demandDelta)),
    }, { merge: true });
}
//# sourceMappingURL=market.js.map