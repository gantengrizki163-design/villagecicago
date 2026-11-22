"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DECAY_RATES = void 0;
exports.calculateLazyStats = calculateLazyStats;
exports.computeSurvivalStats = computeSurvivalStats;
const economy_json_1 = __importDefault(require("../config/economy.json"));
exports.DEFAULT_DECAY_RATES = {
    hungerDecayPerHour: 12,
    thirstDecayPerHour: 18,
    energyDecayPerHour: 10,
};
function clampStat(val) {
    return Math.max(0, Math.min(100, Math.round(val * 100) / 100));
}
/**
 * Menghitung penurunan seluruh status (Fase 1 + Fase 2 + pengali tunawisma Fase 3)
 * secara lazy berdasarkan selisih waktu server tanpa game loop server.
 */
function calculateLazyStats(snapshot, nowMs, rates = exports.DEFAULT_DECAY_RATES, options = {}) {
    const elapsedMs = Math.max(0, nowMs - snapshot.lastCalculatedAtMs);
    const elapsedHours = elapsedMs / 3_600_000;
    const homeless = Boolean(options.isHomeless);
    const energyMult = homeless ? Number(economy_json_1.default.homelessEnergyDecayMultiplier ?? 1.35) : 1;
    const hygieneMult = homeless ? Number(economy_json_1.default.homelessHygieneDecayMultiplier ?? 1.45) : 1;
    const moodMult = homeless ? Number(economy_json_1.default.homelessMoodDecayMultiplier ?? 1.4) : 1;
    const healthMult = homeless ? Number(economy_json_1.default.homelessHealthDecayMultiplier ?? 1.35) : 1;
    const hunger = clampStat(snapshot.hunger - elapsedHours * rates.hungerDecayPerHour);
    const thirst = clampStat(snapshot.thirst - elapsedHours * rates.thirstDecayPerHour);
    const energy = clampStat(snapshot.energy - elapsedHours * rates.energyDecayPerHour * energyMult);
    const baseHygiene = typeof snapshot.hygiene === 'number' ? snapshot.hygiene : 100;
    const hygiene = clampStat(baseHygiene - elapsedHours * economy_json_1.default.hygieneDecayPerHour * hygieneMult);
    const baseMood = typeof snapshot.mood === 'number' ? snapshot.mood : 80;
    const isUncomfortable = hunger < 30 || thirst < 30 || energy < 25 || hygiene < 30 || homeless;
    const moodRate = (isUncomfortable ? economy_json_1.default.moodFastDecayPerHour : economy_json_1.default.moodDecayPerHour) *
        moodMult;
    const mood = clampStat(baseMood - elapsedHours * moodRate);
    const baseHealth = typeof snapshot.health === 'number' ? snapshot.health : 100;
    let healthDropRate = 0;
    if (hunger <= 0 || thirst <= 0 || energy <= 0) {
        healthDropRate += economy_json_1.default.healthDecayCriticalPerHour;
    }
    if (hygiene < 15) {
        healthDropRate += economy_json_1.default.healthDecayDirtyPerHour;
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
function computeSurvivalStats(rawData, nowMs, options = {}) {
    const lastCalcRaw = rawData.lastCalculatedAt;
    const lastCalculatedAtMs = typeof lastCalcRaw === 'object' && lastCalcRaw !== null && typeof lastCalcRaw.toMillis === 'function'
        ? lastCalcRaw.toMillis()
        : typeof rawData.lastCalculatedAtMs === 'number'
            ? rawData.lastCalculatedAtMs
            : nowMs;
    return calculateLazyStats({
        hunger: Number(rawData.hunger ?? 100),
        thirst: Number(rawData.thirst ?? 100),
        energy: Number(rawData.energy ?? 100),
        health: typeof rawData.health === 'number' ? rawData.health : 100,
        hygiene: typeof rawData.hygiene === 'number' ? rawData.hygiene : 100,
        mood: typeof rawData.mood === 'number' ? rawData.mood : 80,
        lastCalculatedAtMs,
    }, nowMs, exports.DEFAULT_DECAY_RATES, { isHomeless: Boolean(options.isHomeless ?? options.homeless) });
}
//# sourceMappingURL=stats.js.map