import economyConfig from '../../../functions/src/config/economy.json';
import type { ComputedStats, GameConfigDoc } from '../types/game';
import { DEFAULT_GAME_CONFIG } from '../world3d/worldConstants';

export interface GameClockInfo {
  dayNumber: number;
  hour: number;
  minute: number;
  formattedTime: string;
  phaseLabel: string;
  dayProgress: number;
  isNight: boolean;
}

export function getGameClockInfo(
  serverNowMs: number,
  config: GameConfigDoc = DEFAULT_GAME_CONFIG
): GameClockInfo {
  const dayMs = Math.max(60_000, config.dayDurationMs || DEFAULT_GAME_CONFIG.dayDurationMs);
  const elapsed = Math.max(0, serverNowMs - (config.epochMs || DEFAULT_GAME_CONFIG.epochMs));
  const dayNumber = Math.floor(elapsed / dayMs) + 1;
  const dayProgress = (elapsed % dayMs) / dayMs;

  const totalMinutes = Math.floor(dayProgress * 24 * 60);
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;

  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  let phaseLabel = 'Beurang';
  if (hour >= 4 && hour < 6) phaseLabel = 'Subuh';
  else if (hour >= 6 && hour < 10) phaseLabel = 'Enjing';
  else if (hour >= 10 && hour < 15) phaseLabel = 'Beurang';
  else if (hour >= 15 && hour < 18) phaseLabel = 'Sore';
  else if (hour >= 18 && hour < 20) phaseLabel = 'Maghrib';
  else phaseLabel = 'Peuting';

  const isNight = hour < 6 || hour >= 18;

  return {
    dayNumber,
    hour,
    minute,
    formattedTime,
    phaseLabel,
    dayProgress,
    isNight,
  };
}

export function computeClientLazyStats(
  baseHunger: number,
  baseThirst: number,
  baseEnergy: number,
  lastCalculatedAtMs: number,
  serverNowMs: number,
  config: GameConfigDoc = DEFAULT_GAME_CONFIG,
  baseHealth = 100,
  baseHygiene = 100,
  baseMood = 80,
  isHomeless = false
): ComputedStats {
  const elapsedHours = Math.max(0, serverNowMs - lastCalculatedAtMs) / 3_600_000;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const energyMult = isHomeless ? Number(economyConfig.homelessEnergyDecayMultiplier ?? 1.35) : 1;
  const hygieneMult = isHomeless ? Number(economyConfig.homelessHygieneDecayMultiplier ?? 1.45) : 1;
  const moodMult = isHomeless ? Number(economyConfig.homelessMoodDecayMultiplier ?? 1.4) : 1;
  const healthMult = isHomeless ? Number(economyConfig.homelessHealthDecayMultiplier ?? 1.35) : 1;

  const hunger = clamp(baseHunger - elapsedHours * config.hungerDecayPerHour);
  const thirst = clamp(baseThirst - elapsedHours * config.thirstDecayPerHour);
  const energy = clamp(baseEnergy - elapsedHours * config.energyDecayPerHour * energyMult);
  const hygiene = clamp(baseHygiene - elapsedHours * economyConfig.hygieneDecayPerHour * hygieneMult);

  const uncomfortable = hunger < 30 || thirst < 30 || energy < 25 || hygiene < 30 || isHomeless;
  const moodRate =
    (uncomfortable ? economyConfig.moodFastDecayPerHour : economyConfig.moodDecayPerHour) *
    moodMult;
  const mood = clamp(baseMood - elapsedHours * moodRate);

  let healthDropRate = 0;
  if (hunger <= 0 || thirst <= 0 || energy <= 0) {
    healthDropRate += economyConfig.healthDecayCriticalPerHour;
  }
  if (hygiene < 15) {
    healthDropRate += economyConfig.healthDecayDirtyPerHour;
  }
  const health = clamp(baseHealth - elapsedHours * healthDropRate * healthMult);

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

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
