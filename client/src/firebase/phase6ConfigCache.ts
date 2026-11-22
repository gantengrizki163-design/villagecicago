import { doc, getDoc } from 'firebase/firestore';
import aiJson from '../../../functions/src/config/ai.json';
import constructionJson from '../../../functions/src/config/construction.json';
import landJson from '../../../functions/src/config/land.json';
import lawJson from '../../../functions/src/config/law.json';
import mortgageJson from '../../../functions/src/config/mortgage.json';
import npcsJson from '../../../functions/src/config/npcs.json';
import questsJson from '../../../functions/src/config/quests.json';
import type {
  ConstructionConfigDoc,
  LandConfigDoc,
  LandPlotDoc,
  LawConfigDoc,
  MortgageConfigDoc,
  Phase6AiConfigDoc,
  QuestsConfigDoc,
} from '../types/game';
import { DEFAULT_GAME_CONFIG } from '../world3d/worldConstants';
import { db } from './config';
import type { NpcsConfigBundle } from './npcDeterminism';

export interface Phase6BundleConfig {
  law: LawConfigDoc;
  npcs: NpcsConfigBundle;
  quests: QuestsConfigDoc;
  mortgage: MortgageConfigDoc;
  land: LandConfigDoc;
  construction: ConstructionConfigDoc;
  ai: Phase6AiConfigDoc;
}

const DEFAULT_PHASE6_BUNDLE: Phase6BundleConfig = {
  law: lawJson as LawConfigDoc,
  npcs: npcsJson as NpcsConfigBundle,
  quests: questsJson as QuestsConfigDoc,
  mortgage: mortgageJson as MortgageConfigDoc,
  land: landJson as LandConfigDoc,
  construction: constructionJson as ConstructionConfigDoc,
  ai: aiJson as Phase6AiConfigDoc,
};

let cachedPhase6: Phase6BundleConfig | null = null;
let loadPhase6Promise: Promise<Phase6BundleConfig> | null = null;

/**
 * Cache config Fase 6 (law, npcs, quests, mortgage, land, construction, ai) per sesi browser
 * untuk menghemat read Firestore dan menjaga keakuratan UI offline/online.
 */
export async function loadPhase6ConfigCached(): Promise<Phase6BundleConfig> {
  if (cachedPhase6) return cachedPhase6;
  if (loadPhase6Promise) return loadPhase6Promise;

  loadPhase6Promise = (async () => {
    try {
      const [lawSnap, npcsSnap, questsSnap, mortSnap, landSnap, conSnap, aiSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'law')).catch(() => null),
        getDoc(doc(db, 'config', 'npcs')).catch(() => null),
        getDoc(doc(db, 'config', 'quests')).catch(() => null),
        getDoc(doc(db, 'config', 'mortgage')).catch(() => null),
        getDoc(doc(db, 'config', 'land')).catch(() => null),
        getDoc(doc(db, 'config', 'construction')).catch(() => null),
        getDoc(doc(db, 'config', 'ai')).catch(() => null),
      ]);

      cachedPhase6 = {
        law:
          lawSnap?.exists() && Array.isArray(lawSnap.data()?.offenses)
            ? (lawSnap.data() as LawConfigDoc)
            : DEFAULT_PHASE6_BUNDLE.law,
        npcs:
          npcsSnap?.exists() && Array.isArray(npcsSnap.data()?.npcs)
            ? (npcsSnap.data() as NpcsConfigBundle)
            : DEFAULT_PHASE6_BUNDLE.npcs,
        quests:
          questsSnap?.exists() && Array.isArray(questsSnap.data()?.quests)
            ? (questsSnap.data() as QuestsConfigDoc)
            : DEFAULT_PHASE6_BUNDLE.quests,
        mortgage:
          mortSnap?.exists() && Array.isArray(mortSnap.data()?.tenors)
            ? (mortSnap.data() as MortgageConfigDoc)
            : DEFAULT_PHASE6_BUNDLE.mortgage,
        land:
          landSnap?.exists() && Array.isArray(landSnap.data()?.plots)
            ? (landSnap.data() as LandConfigDoc)
            : DEFAULT_PHASE6_BUNDLE.land,
        construction:
          conSnap?.exists() && conSnap.data()?.blueprints
            ? (conSnap.data() as ConstructionConfigDoc)
            : DEFAULT_PHASE6_BUNDLE.construction,
        ai:
          aiSnap?.exists() && typeof aiSnap.data()?.dailyCallsLimit === 'number'
            ? (aiSnap.data() as Phase6AiConfigDoc)
            : DEFAULT_PHASE6_BUNDLE.ai,
      };
      return cachedPhase6;
    } catch {
      cachedPhase6 = DEFAULT_PHASE6_BUNDLE;
      return cachedPhase6;
    } finally {
      loadPhase6Promise = null;
    }
  })();

  return loadPhase6Promise;
}

export function getDefaultPhase6Config(): Phase6BundleConfig {
  return cachedPhase6 || DEFAULT_PHASE6_BUNDLE;
}

export function getDefaultLandPlots(cfg: LandConfigDoc = DEFAULT_PHASE6_BUNDLE.land): LandPlotDoc[] {
  return cfg.plots.map((p) => ({
    id: p.id,
    name: p.name,
    areaTag: p.areaTag,
    zone: 'cicalengka',
    position: { ...p.position },
    size: { ...p.size },
    roadAccess: p.roadAccess,
    zoning: p.zoning,
    price: p.price,
    ownerId: '',
    ownerType: 'npc',
    ownerName: 'Pemerintah Desa Cicalengka',
    imbStatus: 'none',
    permitStatus: 'none',
    constructionId: null,
    builtPropertyId: null,
    propertyId: null,
    status: 'available',
    updatedAtMs: 0,
  }));
}

export function computeLandPlotPriceClient(
  plot: Pick<LandPlotDoc, 'areaTag' | 'roadAccess' | 'size' | 'price'>,
  cfg: LandConfigDoc = getDefaultPhase6Config().land
): number {
  const explicitPrice = Number(plot.price || 0);
  if (explicitPrice > 0) return Math.round(explicitPrice / 1000) * 1000;
  const width = Math.max(4, Number(plot.size?.width || 6));
  const depth = Math.max(4, Number(plot.size?.depth || 6));
  const baseSqm = cfg.areaBasePricePerSqm[plot.areaTag] ?? 6500;
  const roadMult = cfg.roadAccessMultiplier[plot.roadAccess] ?? 1.0;
  return Math.max(200_000, Math.round((width * depth * baseSqm * roadMult) / 1000) * 1000);
}

export interface ClientMortgageQuote {
  price: number;
  downPaymentRate: number;
  downPayment: number;
  transferTax: number;
  upfrontTotal: number;
  principal: number;
  interestRatePerTerm: number;
  totalInterest: number;
  totalRepayment: number;
  termCycles: number;
  installment: number;
}

export function computeMortgageQuoteClient(
  price: number,
  downPaymentRate: number,
  termCycles: number,
  cfg: MortgageConfigDoc = getDefaultPhase6Config().mortgage
): ClientMortgageQuote | null {
  const cleanPrice = Math.max(0, Math.round(price));
  if (cleanPrice <= 0) return null;
  if (
    !Number.isFinite(downPaymentRate) ||
    downPaymentRate < cfg.minDownPaymentRate - 1e-6 ||
    downPaymentRate > cfg.maxDownPaymentRate + 1e-6
  ) {
    return null;
  }
  const tenor = cfg.tenors.find((t) => t.termCycles === termCycles);
  if (!tenor) return null;

  const normalizedRate = Math.max(
    cfg.minDownPaymentRate,
    Math.min(cfg.maxDownPaymentRate, Math.round(downPaymentRate * 100) / 100)
  );
  const downPayment = Math.round((cleanPrice * normalizedRate) / 500) * 500;
  const transferTax = Math.round(cleanPrice * 0.025);
  const upfrontTotal = downPayment + transferTax;
  const principal = Math.max(0, cleanPrice - downPayment);
  const totalInterest = Math.round(principal * tenor.interestRatePerTerm);
  const totalRepayment = principal + totalInterest;
  const installment = Math.max(1000, Math.ceil(totalRepayment / tenor.termCycles));

  return {
    price: cleanPrice,
    downPaymentRate: normalizedRate,
    downPayment,
    transferTax,
    upfrontTotal,
    principal,
    interestRatePerTerm: tenor.interestRatePerTerm,
    totalInterest,
    totalRepayment,
    termCycles: tenor.termCycles,
    installment,
  };
}

export function computeLazyWantedClient(
  wantedLevel: number | undefined,
  wantedUpdatedAtMs: number | undefined,
  nowMs: number,
  cfg: LawConfigDoc = getDefaultPhase6Config().law,
  dayDurationMs: number = DEFAULT_GAME_CONFIG.dayDurationMs
): number {
  const base = Math.max(0, Number(wantedLevel || 0));
  if (base <= 0) return 0;
  const lastMs = Number(wantedUpdatedAtMs || nowMs);
  if (nowMs <= lastMs) return base;
  const gameHourMs = Math.max(10_000, dayDurationMs / 24);
  const elapsedHours = (nowMs - lastMs) / gameHourMs;
  const decayed = base - elapsedHours * (cfg.wantedDecayPerGameHour || 2.5);
  return Math.max(0, Math.round(decayed * 10) / 10);
}
