"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.questsConfig = exports.npcsConfig = exports.mortgageConfig = exports.lawConfig = exports.landConfig = exports.constructionConfig = exports.aiConfig = void 0;
exports.ensurePhase6Configs = ensurePhase6Configs;
exports.getGameClockFromMs = getGameClockFromMs;
exports.computeLazyWantedLevel = computeLazyWantedLevel;
exports.computeCatchChance = computeCatchChance;
exports.syncLazySentenceAndWanted = syncLazySentenceAndWanted;
exports.writeCrimeSceneRtdb = writeCrimeSceneRtdb;
exports.writeLawAlertRtdb = writeLawAlertRtdb;
exports.applyReputationAndCredit = applyReputationAndCredit;
const firestore_1 = require("firebase-admin/firestore");
const ai_json_1 = __importDefault(require("../config/ai.json"));
exports.aiConfig = ai_json_1.default;
const construction_json_1 = __importDefault(require("../config/construction.json"));
exports.constructionConfig = construction_json_1.default;
const land_json_1 = __importDefault(require("../config/land.json"));
exports.landConfig = land_json_1.default;
const law_json_1 = __importDefault(require("../config/law.json"));
exports.lawConfig = law_json_1.default;
const mortgage_json_1 = __importDefault(require("../config/mortgage.json"));
exports.mortgageConfig = mortgage_json_1.default;
const npcs_json_1 = __importDefault(require("../config/npcs.json"));
exports.npcsConfig = npcs_json_1.default;
const quests_json_1 = __importDefault(require("../config/quests.json"));
exports.questsConfig = quests_json_1.default;
const firebase_1 = require("./firebase");
const phase2_1 = require("./phase2");
const validation_1 = require("./validation");
let phase6ConfigEnsured = false;
async function ensurePhase6Configs() {
    if (phase6ConfigEnsured)
        return;
    const entries = [
        ['law', law_json_1.default],
        ['npcs', npcs_json_1.default],
        ['quests', quests_json_1.default],
        ['mortgage', mortgage_json_1.default],
        ['land', land_json_1.default],
        ['construction', construction_json_1.default],
        ['ai', ai_json_1.default],
    ];
    for (const [id, payload] of entries) {
        const ref = firebase_1.db.collection('config').doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set(payload);
        }
    }
    phase6ConfigEnsured = true;
}
function getGameClockFromMs(nowMs) {
    const elapsed = Math.max(0, nowMs - phase2_1.GAME_EPOCH_MS);
    const dayIndex = Math.floor(elapsed / phase2_1.GAME_DAY_DURATION_MS);
    const frac = (elapsed % phase2_1.GAME_DAY_DURATION_MS) / phase2_1.GAME_DAY_DURATION_MS;
    const gameHour = Math.floor(frac * 24) % 24;
    return { gameHour, dayIndex, daySeed: (dayIndex * 9301 + 49297) % 233280 };
}
function computeLazyWantedLevel(currentWanted, wantedUpdatedAtMs, nowMs) {
    const cleanWanted = Math.max(0, Math.min(law_json_1.default.wantedMax, Number(currentWanted || 0)));
    if (cleanWanted <= 0)
        return 0;
    const lastMs = Number(wantedUpdatedAtMs || nowMs);
    const elapsedMs = Math.max(0, nowMs - lastMs);
    const elapsedGameHours = (elapsedMs / phase2_1.GAME_DAY_DURATION_MS) * 24;
    const decay = elapsedGameHours * Number(law_json_1.default.wantedDecayPerGameHour || 2.5);
    return Math.max(0, Math.round((cleanWanted - decay) * 10) / 10);
}
function computeCatchChance(params) {
    let chance = Number(params.baseCatchChance || 0.35);
    // Saksi mata di sekitar lokasi (NPC + pemain lain)
    const witnessBonus = Math.min(0.35, Math.max(0, params.witnessCount) * 0.11);
    chance += witnessBonus;
    // Cek zona CCTV publik
    let cctvTriggered = false;
    let cctvLabel = null;
    for (const zone of law_json_1.default.cctvZones) {
        if ((0, validation_1.distance2D)(params.posX, params.posZ, zone.x, zone.z) <= zone.radius) {
            chance += zone.catchBonus;
            cctvTriggered = true;
            cctvLabel = zone.label;
            break;
        }
    }
    // Keamanan properti/bisnis target (alarm, CCTV privat, gembok, satpam)
    const prot = Math.max(0, Math.min(100, Number(params.propertyProtectionScore || 0)));
    chance += (prot / 100) * 0.35;
    // Faktor jam malam vs siang
    const { gameHour } = getGameClockFromMs(params.nowMs);
    const isNight = gameHour >= law_json_1.default.nightHours.start || gameHour < law_json_1.default.nightHours.end;
    if (isNight) {
        chance += law_json_1.default.nightHours.catchRiskDelta;
    }
    else {
        chance += 0.05;
    }
    // Skill teknis & fisik mengurangi sedikit risiko tertangkap (maks -12%)
    const skillSum = Number(params.skills?.teknis || 0) + Number(params.skills?.fisik || 0);
    const skillReduction = Math.min(0.12, skillSum * 0.004);
    chance -= skillReduction;
    // Reputasi buruk membuat warga lebih waspada
    const rep = Number(params.reputation ?? 50);
    if (rep < 35) {
        chance += 0.08;
    }
    return {
        catchChance: Math.max(0.1, Math.min(0.96, chance)),
        cctvTriggered,
        isNight,
        cctvLabel,
    };
}
/**
 * Evaluasi lazy status tahanan & peluruhan wantedLevel saat login / syncPlayerState / aksi hukum.
 */
async function syncLazySentenceAndWanted(firestore, uid, nowMs) {
    const charRef = firestore.collection('characters').doc(uid);
    const sentRef = firestore.collection('sentences').doc(uid);
    return firestore.runTransaction(async (tx) => {
        const [charSnap, sentSnap] = await Promise.all([tx.get(charRef), tx.get(sentRef)]);
        if (!charSnap.exists) {
            return { autoReleased: false, wantedLevel: 0 };
        }
        const charData = charSnap.data();
        const decayedWanted = computeLazyWantedLevel(Number(charData.wantedLevel || 0), Number(charData.wantedUpdatedAtMs || nowMs), nowMs);
        const updates = {};
        if (decayedWanted !== Number(charData.wantedLevel || 0)) {
            updates.wantedLevel = decayedWanted;
            updates.wantedUpdatedAtMs = nowMs;
        }
        let autoReleased = false;
        if (sentSnap.exists) {
            const sentData = sentSnap.data();
            if (sentData.status === 'serving' && nowMs >= Number(sentData.endAtMs || 0)) {
                tx.update(sentRef, {
                    status: 'released',
                    releasedAtMs: nowMs,
                });
                updates.sentence = null;
                updates.lastPosition = {
                    ...law_json_1.default.policeStation.releaseSpawn,
                    rotY: 0,
                };
                autoReleased = true;
            }
        }
        else if (charData.sentence && charData.sentence.active) {
            updates.sentence = null;
        }
        if (Object.keys(updates).length > 0) {
            updates.updatedAt = firestore_1.Timestamp.fromMillis(nowMs);
            tx.update(charRef, updates);
        }
        return { autoReleased, wantedLevel: decayedWanted };
    });
}
async function writeCrimeSceneRtdb(sceneId, payload) {
    try {
        await firebase_1.rtdb.ref(`crimeScenes/${sceneId}`).set({
            id: sceneId,
            type: payload.type,
            label: payload.label.slice(0, 64),
            zone: payload.zone,
            x: Math.round(payload.x * 10) / 10,
            z: Math.round(payload.z * 10) / 10,
            severity: payload.severity,
            createdAt: payload.nowMs,
            expiresAt: payload.nowMs + 180_000,
        });
    }
    catch {
        // Non-fatal jika RTDB belum tersedia di environment tertentu
    }
}
async function writeLawAlertRtdb(alertId, payload) {
    try {
        await firebase_1.rtdb.ref(`lawAlerts/${alertId}`).set({
            id: alertId,
            kind: payload.kind,
            targetUid: payload.targetUid,
            propertyId: payload.propertyId || '',
            message: payload.message.slice(0, 140),
            x: Math.round(payload.x * 10) / 10,
            z: Math.round(payload.z * 10) / 10,
            createdAt: payload.nowMs,
            expiresAt: payload.nowMs + 120_000,
        });
    }
    catch {
        // Non-fatal
    }
}
function applyReputationAndCredit(tx, firestore, uid, charData, accountSnap, repDelta, creditDelta, nowMs) {
    const nextRep = Math.max(0, Math.min(100, Number(charData.reputation ?? 50) + repDelta));
    const nextCredit = Math.max(0, Math.min(100, Number(charData.creditScore ?? 65) + creditDelta));
    if (accountSnap && accountSnap.exists && creditDelta !== 0) {
        const accCredit = Math.max(0, Math.min(100, Number(accountSnap.data()?.creditScore ?? nextCredit) + creditDelta));
        tx.update(firestore.collection('accounts').doc(uid), {
            creditScore: accCredit,
            updatedAtMs: nowMs,
        });
    }
    return { reputation: nextRep, creditScore: nextCredit };
}
//# sourceMappingURL=law.js.map