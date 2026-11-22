import { doc, getDoc } from 'firebase/firestore';
import bankJson from '../../../functions/src/config/bank.json';
import businessJson from '../../../functions/src/config/business.json';
import productsJson from '../../../functions/src/config/products.json';
import taxJson from '../../../functions/src/config/tax.json';
import type {
  BankConfigDoc,
  BusinessConfigDoc,
  MarketStatDoc,
  ProductsConfigDoc,
  TaxConfigDoc,
  TreasuryStateDoc,
} from '../types/game';
import { db } from './config';

export interface Phase4BundleConfig {
  bank: BankConfigDoc;
  business: BusinessConfigDoc;
  products: ProductsConfigDoc;
  tax: TaxConfigDoc;
}

const DEFAULT_PHASE4_BUNDLE: Phase4BundleConfig = {
  bank: bankJson as BankConfigDoc,
  business: businessJson as BusinessConfigDoc,
  products: productsJson as ProductsConfigDoc,
  tax: taxJson as TaxConfigDoc,
};

let cachedPhase4: Phase4BundleConfig | null = null;
let loadPhase4Promise: Promise<Phase4BundleConfig> | null = null;

/**
 * Cache config Fase 4 (bank, business, products, tax) per sesi browser
 * untuk menghemat read Firestore dan menjaga keakuratan UI offline/online.
 */
export async function loadPhase4ConfigCached(): Promise<Phase4BundleConfig> {
  if (cachedPhase4) return cachedPhase4;
  if (loadPhase4Promise) return loadPhase4Promise;

  loadPhase4Promise = (async () => {
    try {
      const [bankSnap, bizSnap, prodSnap, taxSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'bank')).catch(() => null),
        getDoc(doc(db, 'config', 'business')).catch(() => null),
        getDoc(doc(db, 'config', 'products')).catch(() => null),
        getDoc(doc(db, 'config', 'tax')).catch(() => null),
      ]);

      cachedPhase4 = {
        bank:
          bankSnap?.exists() && typeof bankSnap.data()?.openAccountFee === 'number'
            ? (bankSnap.data() as BankConfigDoc)
            : DEFAULT_PHASE4_BUNDLE.bank,
        business:
          bizSnap?.exists() && bizSnap.data()?.businessTypes
            ? (bizSnap.data() as BusinessConfigDoc)
            : DEFAULT_PHASE4_BUNDLE.business,
        products:
          prodSnap?.exists() && Array.isArray(prodSnap.data()?.products)
            ? (prodSnap.data() as ProductsConfigDoc)
            : DEFAULT_PHASE4_BUNDLE.products,
        tax:
          taxSnap?.exists() && typeof taxSnap.data()?.incomeTaxRate === 'number'
            ? (taxSnap.data() as TaxConfigDoc)
            : DEFAULT_PHASE4_BUNDLE.tax,
      };
      return cachedPhase4;
    } catch {
      cachedPhase4 = DEFAULT_PHASE4_BUNDLE;
      return cachedPhase4;
    } finally {
      loadPhase4Promise = null;
    }
  })();

  return loadPhase4Promise;
}

export function getDefaultPhase4Config(): Phase4BundleConfig {
  return cachedPhase4 || DEFAULT_PHASE4_BUNDLE;
}

export function getDefaultMarketStats(): MarketStatDoc[] {
  const now = Date.now();
  return DEFAULT_PHASE4_BUNDLE.products.products.map((p) => ({
    itemId: p.id,
    name: p.name,
    category: p.category,
    basePrice: p.basePrice,
    currentPrice: p.suggestedRetail,
    wholesalePrice: p.wholesalePrice,
    supply: 100,
    demand: 100,
    pendingSupplyDelta: 0,
    pendingDemandDelta: 0,
    eventMultiplier: 1.0,
    updatedAtMs: now,
  }));
}

export function getDefaultTreasuryState(): TreasuryStateDoc {
  const now = Date.now();
  return {
    balance: 2_500_000,
    totalTaxCollected: 0,
    incomeTaxTotal: 0,
    businessTaxTotal: 0,
    propertyTaxTotal: 0,
    marketFeeTotal: 0,
    auctionFeeTotal: 0,
    inflationIndex: 1.0,
    activeEventId: 'normal',
    activeEventLabel: 'Ekonomi Cicalengka Stabil',
    activeEventUntilMs: now + 7_200_000,
    estimatedMoneySupply: 0,
    avgMarketPriceIndex: 1.0,
    updatedAtMs: now,
  };
}
