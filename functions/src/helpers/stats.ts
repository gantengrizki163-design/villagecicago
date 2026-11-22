import economyConfig from '../config/economy.json';

export interface StatsSnapshot {
  hunger: number;
  thirst: number;
  energy: number;
  health?: number;
  hygiene?: number;
  mood?: number;
  lastCalculatedAtMs: number;
}

export interface DecayRates {
  hungerDecayPerHour: number;
  thirstDecayPerHour: number;
  energyDecayPerHour: number;
}

export const DEFAULT_DECAY_RATES: DecayRates = {
  hungerDecayPerHour: 12,
  thirstDecayPerHour: 18,
  energyDecayPerHour: 10,
};

export interface LazyStatsOptions {
  isHomeless?: boolean;
}

export interface ComputedSurvivalStats {
  hunger: number;
  thirst: number;
  energy: number;
  health: number;
  hygiene: number;
  mood: number;
  isCritical: boolean;
  didFaint: boolean;
}

function clampStat(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val * 100) / 100));
}

/**
 * Menghitung penurunan seluruh status (Fase 1 + Fase 2 + pengali tunawisma Fase 3)
 * secara lazy berdasarkan selisih waktu server tanpa game loop server.
 */
export function calculateLazyStats(
  snapshot: StatsSnapshot,
  nowMs: number,
  rates: DecayRates = DEFAULT_DECAY_RATES,
  options: LazyStatsOptions = {}
): ComputedSurvivalStats {
  const elapsedMs = Math.max(0, nowMs - snapshot.lastCalculatedAtMs);
  const elapsedHours = elapsedMs / 3_600_000;
  const homeless = Boolean(options.isHomeless);

  const energyMult = homeless ? Number(economyConfig.homelessEnergyDecayMultiplier ?? 1.35) : 1;
  const hygieneMult = homeless ? Number(economyConfig.homelessHygieneDecayMultiplier ?? 1.45) : 1;
  const moodMult = homeless ? Number(economyConfig.homelessMoodDecayMultiplier ?? 1.4) : 1;
  const healthMult = homeless ? Number(economyConfig.homelessHealthDecayMultiplier ?? 1.35) : 1;

  const hunger = clampStat(snapshot.hunger - elapsedHours * rates.hungerDecayPerHour);
  const thirst = clampStat(snapshot.thirst - elapsedHours * rates.thirstDecayPerHour);
  const energy = clampStat(snapshot.energy - elapsedHours * rates.energyDecayPerHour * energyMult);

  const baseHygiene = typeof snapshot.hygiene === 'number' ? snapshot.hygiene : 100;
  const hygiene = clampStat(
    baseHygiene - elapsedHours * economyConfig.hygieneDecayPerHour * hygieneMult
  );

  const baseMood = typeof snapshot.mood === 'number' ? snapshot.mood : 80;
  const isUncomfortable = hunger < 30 || thirst < 30 || energy < 25 || hygiene < 30 || homeless;
  const moodRate =
    (isUncomfortable ? economyConfig.moodFastDecayPerHour : economyConfig.moodDecayPerHour) *
    moodMult;
  const mood = clampStat(baseMood - elapsedHours * moodRate);

  const baseHealth = typeof snapshot.health === 'number' ? snapshot.health : 100;
  let healthDropRate = 0;
  if (hunger <= 0 || thirst <= 0 || energy <= 0) {
    healthDropRate += economyConfig.healthDecayCriticalPerHour;
  }
  if (hygiene < 15) {
    healthDropRate += economyConfig.healthDecayDirtyPerHour;
  }
  const health = clampStat(baseHealth - elapsedHours * healthDropRate * healthMult);

  return {
    hunger,
    thirst,
    energy,
    health,
    hygiene,
    mood,
    isCritical: hunger <= 0 || thirst <= 0 || energy <= 0 || health <= 20,
    didFaint: health <= 0,
  };
}

export function computeSurvivalStats(
  rawData: Record<string, unknown>,
  nowMs: number,
  options: { homeless?: boolean; isHomeless?: boolean } = {}
): ComputedSurvivalStats {
  const lastCalcRaw = rawData.lastCalculatedAt as { toMillis?: () => number } | number | undefined;
  const lastCalculatedAtMs =
    typeof lastCalcRaw === 'object' && lastCalcRaw !== null && typeof lastCalcRaw.toMillis === 'function'
      ? lastCalcRaw.toMillis()
      : typeof rawData.lastCalculatedAtMs === 'number'
      ? rawData.lastCalculatedAtMs
      : nowMs;

  return calculateLazyStats(
    {
      hunger: Number(rawData.hunger ?? 100),
      thirst: Number(rawData.thirst ?? 100),
      energy: Number(rawData.energy ?? 100),
      health: typeof rawData.health === 'number' ? rawData.health : 100,
      hygiene: typeof rawData.hygiene === 'number' ? rawData.hygiene : 100,
      mood: typeof rawData.mood === 'number' ? rawData.mood : 80,
      lastCalculatedAtMs,
    },
    nowMs,
    DEFAULT_DECAY_RATES,
    { isHomeless: Boolean(options.isHomeless ?? options.homeless) }
  );
}
