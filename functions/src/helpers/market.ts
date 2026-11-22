import { FieldValue, type DocumentData, type Firestore, type Transaction } from 'firebase-admin/firestore';
import economyConfig from '../config/economy.json';
import productsConfig from '../config/products.json';
import taxConfig from '../config/tax.json';

export { economyConfig, productsConfig, taxConfig };

export interface ProductMeta {
  id: string;
  name: string;
  category: string;
  supplierId: string | null;
  wholesalePrice: number;
  basePrice: number;
  suggestedRetail: number;
  shelfLifeGameDays: number;
  hungerRestore?: number;
  thirstRestore?: number;
  energyRestore?: number;
  businessTypes: string[];
}

export interface RecipeMeta {
  id: string;
  name: string;
  outputItemId: string;
  outputQty: number;
  businessTypes: string[];
  inputs: Array<{ itemId: string; qty: number }>;
  energyCost: number;
}

export function getProductMeta(itemId: string): ProductMeta | null {
  return (productsConfig.products as ProductMeta[]).find((p) => p.id === itemId) ?? null;
}

export function getSupplierMeta(supplierId: string | null) {
  if (!supplierId) return null;
  return productsConfig.suppliers.find((s) => s.id === supplierId) ?? null;
}

export function getRecipeMeta(recipeId: string): RecipeMeta | null {
  return (productsConfig.recipes as RecipeMeta[]).find((r) => r.id === recipeId) ?? null;
}

export function getActiveEconomicEvent(treasuryData: DocumentData | undefined, nowMs: number) {
  const activeId = String(treasuryData?.activeEventId || 'normal');
  const untilMs = Number(treasuryData?.activeEventUntilMs || 0);
  if (untilMs > 0 && nowMs > untilMs) {
    return economyConfig.events[0];
  }
  return economyConfig.events.find((e) => e.id === activeId) ?? economyConfig.events[0];
}

export function computeDynamicMarketPrice(params: {
  basePrice: number;
  supply: number;
  demand: number;
  inflationIndex: number;
  eventMultiplier: number;
}): number {
  const safeSupply = Math.max(10, params.supply);
  const safeDemand = Math.max(10, params.demand);
  const ratio = (safeDemand - safeSupply) / Math.max(safeSupply, safeDemand);
  const rawSdFactor = 1 + ratio * economyConfig.supplyDemandSensitivity;
  const sdFactor = Math.max(
    economyConfig.minSupplyDemandFactor,
    Math.min(economyConfig.maxSupplyDemandFactor, rawSdFactor)
  );
  const inflation = Math.max(
    economyConfig.minInflationIndex,
    Math.min(economyConfig.maxInflationIndex, params.inflationIndex)
  );

  const computed = params.basePrice * sdFactor * params.eventMultiplier * inflation;
  return Math.max(500, Math.round(computed / 100) * 100);
}

export function getFairPriceBounds(marketPrice: number): { minPrice: number; maxPrice: number } {
  return {
    minPrice: Math.max(500, Math.round((marketPrice * economyConfig.minPriceRatioVsMarket) / 100) * 100),
    maxPrice: Math.max(1000, Math.round((marketPrice * economyConfig.maxPriceRatioVsMarket) / 100) * 100),
  };
}

export function queueMarketVolumeDelta(
  tx: Transaction,
  firestore: Firestore,
  itemId: string,
  supplyDelta: number,
  demandDelta: number
): void {
  const ref = firestore.collection('market_stats').doc(itemId);
  const meta = getProductMeta(itemId);
  if (!meta) return;

  // Menggunakan set merge dengan FieldValue.increment untuk buffer delta market_stats
  tx.set(
    ref,
    {
      itemId,
      name: meta.name,
      category: meta.category,
      basePrice: meta.basePrice,
      pendingSupplyDelta: FieldValue.increment(Math.round(supplyDelta)),
      pendingDemandDelta: FieldValue.increment(Math.round(demandDelta)),
    },
    { merge: true }
  );
}
