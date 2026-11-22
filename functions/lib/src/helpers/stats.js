"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DECAY_RATES = void 0;
exports.calculateLazyStats = calculateLazyStats;
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
 * Menghitung penurunan seluruh status (Fase 1 + Fase 2) secara lazy
 * berdasarkan selisih waktu server tanpa memerlukan game loop server.
 */
function calculateLazyStats(snapshot, nowMs, rates = exports.DEFAULT_DECAY_RATES) {
    const elapsedMs = Math.max(0, nowMs - snapshot.lastCalculatedAtMs);
    const elapsedHours = elapsedMs / 3_600_000;
    const hunger = clampStat(snapshot.hunger - elapsedHours * rates.hungerDecayPerHour);
    const thirst = clampStat(snapshot.thirst - elapsedHours * rates.thirstDecayPerHour);
    const energy = clampStat(snapshot.energy - elapsedHours * rates.energyDecayPerHour);
    const baseHygiene = typeof snapshot.hygiene === 'number' ? snapshot.hygiene : 100;
    const hygiene = clampStat(baseHygiene - elapsedHours * economy_json_1.default.hygieneDecayPerHour);
    const baseMood = typeof snapshot.mood === 'number' ? snapshot.mood : 80;
    const isUncomfortable = hunger < 30 || thirst < 30 || energy < 25 || hygiene < 30;
    const moodRate = isUncomfortable
        ? economy_json_1.default.moodFastDecayPerHour
        : economy_json_1.default.moodDecayPerHour;
    const mood = clampStat(baseMood - elapsedHours * moodRate);
    const baseHealth = typeof snapshot.health === 'number' ? snapshot.health : 100;
    let healthDropRate = 0;
    if (hunger <= 0 || thirst <= 0 || energy <= 0) {
        healthDropRate += economy_json_1.default.healthDecayCriticalPerHour;
    }
    if (hygiene < 15) {
        healthDropRate += economy_json_1.default.healthDecayDirtyPerHour;
    }
    const health = clampStat(baseHealth - elapsedHours * healthDropRate);
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
//# sourceMappingURL=stats.js.map