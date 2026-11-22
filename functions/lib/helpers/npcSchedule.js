"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashNpcSeed = hashNpcSeed;
exports.getNpcClockState = getNpcClockState;
exports.computeDeterministicNpcPose = computeDeterministicNpcPose;
exports.getAllDeterministicNpcPoses = getAllDeterministicNpcPoses;
exports.getDeterministicNpcById = getDeterministicNpcById;
exports.countDeterministicNpcWitnesses = countDeterministicNpcWitnesses;
const npcs_json_1 = __importDefault(require("../config/npcs.json"));
const phase2_1 = require("./phase2");
const validation_1 = require("./validation");
const ZONE_TAG_ANCHORS = {
    stasiun: { x: 0, z: -42 },
    pasar: { x: 46, z: -8 },
    pasar_grosir: { x: 46, z: -15 },
    alun_alun: { x: 0, z: 6 },
    polsek: { x: -6, z: 20 },
    warung: { x: -30, z: -15 },
    kantor_agen: { x: 6, z: 20 },
    perumahan: { x: 34, z: 48 },
    kantor_desa: { x: -22, z: 4 },
    kampung: { x: -18, z: 48 },
    sekolah: { x: -48, z: 46 },
    bank: { x: -46, z: -6 },
    toko_mebel: { x: -6, z: -15 },
};
const WALKING_ACTIVITIES = new Set([
    'patroli_pagi',
    'patroli_sore',
    'patroli_malam',
    'jalan_pagi',
    'survei_lokasi',
    'sambang_warga',
    'belanja_pasar',
    'pulang_tidur',
]);
function hashNpcSeed(npcId, daySeed) {
    const input = `${npcId}:${daySeed}`;
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function getNpcClockState(nowMs, dayDurationMs = phase2_1.GAME_DAY_DURATION_MS, epochMs = phase2_1.GAME_EPOCH_MS) {
    const safeDayMs = Math.max(60_000, dayDurationMs);
    const elapsed = Math.max(0, nowMs - epochMs);
    const dayIndex = Math.floor(elapsed / safeDayMs);
    const frac = (elapsed % safeDayMs) / safeDayMs;
    const gameHourFloat = frac * 24;
    const gameHour = Math.floor(gameHourFloat) % 24;
    const daySeed = (dayIndex * 9301 + 49297) % 233280;
    return { dayIndex, daySeed, gameHourFloat, gameHour };
}
function getSlotAnchor(npc, slot, daySeed) {
    if (slot.zoneTag === 'rumah' || slot.activity === 'tidur' || slot.activity === 'pulang_tidur') {
        return npc.homePos;
    }
    if (slot.activity === 'kerja' || slot.activity === 'jaga_tahanan') {
        return npc.workPos;
    }
    const base = ZONE_TAG_ANCHORS[slot.zoneTag] || npc.workPos;
    const h = hashNpcSeed(npc.id + ':' + slot.zoneTag, daySeed);
    const offsetX = ((h % 9) - 4) * 0.45;
    const offsetZ = (((h >> 4) % 9) - 4) * 0.45;
    return { x: base.x + offsetX, z: base.z + offsetZ };
}
function interpolateWaypoints(pts, speed, nowMs, phaseOffsetSec) {
    if (pts.length === 0)
        return { x: 0, z: 0, rotY: 0 };
    if (pts.length === 1)
        return { x: pts[0][0], z: pts[0][1], rotY: 0 };
    const segLengths = [];
    let totalLen = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        segLengths.push(len);
        totalLen += len;
    }
    if (totalLen <= 0.01) {
        return { x: pts[0][0], z: pts[0][1], rotY: 0 };
    }
    const sec = Math.max(0, nowMs / 1000 + phaseOffsetSec);
    let dist = (sec * Math.max(0.8, speed)) % totalLen;
    for (let i = 0; i < pts.length; i++) {
        const segLen = segLengths[i];
        if (dist <= segLen || i === pts.length - 1) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const t = segLen > 0 ? dist / segLen : 0;
            const x = a[0] + (b[0] - a[0]) * t;
            const z = a[1] + (b[1] - a[1]) * t;
            const rotY = Math.atan2(b[0] - a[0], b[1] - a[1]);
            return { x, z, rotY };
        }
        dist -= segLen;
    }
    return { x: pts[0][0], z: pts[0][1], rotY: 0 };
}
function computeDeterministicNpcPose(npc, nowMs, options) {
    const { daySeed, gameHourFloat, gameHour } = getNpcClockState(nowMs, options?.dayDurationMs ?? phase2_1.GAME_DAY_DURATION_MS, options?.epochMs ?? phase2_1.GAME_EPOCH_MS);
    const schedule = npc.schedule;
    let slotIdx = schedule.findIndex((s) => gameHour >= s.startHour && gameHour < s.endHour);
    if (slotIdx < 0)
        slotIdx = 0;
    const currentSlot = schedule[slotIdx];
    const prevSlot = schedule[(slotIdx - 1 + schedule.length) % schedule.length];
    const seedHash = hashNpcSeed(npc.id, daySeed);
    const phaseOffsetSec = (seedHash % 360) * 0.5;
    const isSleeping = currentSlot.activity === 'tidur';
    const isPatrolOfficer = npc.role === 'polisi_patroli';
    // Cek respon polisi terhadap alert RTDB aktif (lazy diversion tanpa server loop)
    let respondingAlert = null;
    if (isPatrolOfficer && !isSleeping && options?.activeAlerts && options.activeAlerts.length > 0) {
        let bestDist = 65;
        for (const al of options.activeAlerts) {
            if (al.expiresAt > nowMs) {
                const d = (0, validation_1.distance2D)(npc.workPos.x, npc.workPos.z, al.x, al.z);
                if (d < bestDist) {
                    bestDist = d;
                    respondingAlert = al;
                }
            }
        }
    }
    const slotElapsedHours = Math.max(0, gameHourFloat - currentSlot.startHour);
    const currentAnchor = getSlotAnchor(npc, currentSlot, daySeed);
    const prevAnchor = getSlotAnchor(npc, prevSlot, daySeed);
    let x = currentAnchor.x;
    let z = currentAnchor.z;
    let rotY = ((seedHash % 628) / 100) - Math.PI;
    let anim = 'idle';
    let isPatrolling = false;
    if (respondingAlert) {
        // Polisi bergerak cepat antara work/patrol dan titik laporan aktif
        const patrolMid = npc.patrolRoute[0] || [npc.workPos.x, npc.workPos.z];
        const p = interpolateWaypoints([
            [patrolMid[0], patrolMid[1]],
            [respondingAlert.x, respondingAlert.z],
        ], npc.speed * 1.25, nowMs, phaseOffsetSec);
        x = p.x;
        z = p.z;
        rotY = p.rotY;
        anim = 'walk';
        isPatrolling = true;
    }
    else if (!isSleeping &&
        npc.patrolRoute.length >= 2 &&
        (WALKING_ACTIVITIES.has(currentSlot.activity) ||
            (currentSlot.activity === 'mangkal' && seedHash % 3 === 0))) {
        const p = interpolateWaypoints(npc.patrolRoute, npc.speed, nowMs, phaseOffsetSec);
        x = p.x;
        z = p.z;
        rotY = p.rotY;
        anim = 'walk';
        isPatrolling = currentSlot.activity.startsWith('patroli');
    }
    else if (slotElapsedHours < 0.25 && (0, validation_1.distance2D)(prevAnchor.x, prevAnchor.z, currentAnchor.x, currentAnchor.z) > 2) {
        // Transisi berjalan halus selama 15 menit game awal pergantian jadwal
        const t = Math.min(1, slotElapsedHours / 0.25);
        x = prevAnchor.x + (currentAnchor.x - prevAnchor.x) * t;
        z = prevAnchor.z + (currentAnchor.z - prevAnchor.z) * t;
        rotY = Math.atan2(currentAnchor.x - prevAnchor.x, currentAnchor.z - prevAnchor.z);
        anim = 'walk';
    }
    return {
        npcId: npc.id,
        name: npc.name,
        role: npc.role,
        personality: npc.personality,
        gender: npc.gender,
        appearance: npc.appearance,
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
        rotY,
        anim,
        activity: respondingAlert ? 'respons_laporan' : currentSlot.activity,
        zoneTag: currentSlot.zoneTag,
        isSleeping,
        isPatrolling,
        respondingAlertId: respondingAlert ? respondingAlert.id : null,
        daySeed,
        gameHour,
    };
}
function getAllDeterministicNpcPoses(nowMs, activeAlerts) {
    const list = npcs_json_1.default.npcs;
    return list.map((npc) => computeDeterministicNpcPose(npc, nowMs, { activeAlerts }));
}
function getDeterministicNpcById(npcId, nowMs, activeAlerts) {
    const list = npcs_json_1.default.npcs;
    const def = list.find((n) => n.id === npcId);
    if (!def)
        return null;
    return {
        def,
        pose: computeDeterministicNpcPose(def, nowMs, { activeAlerts }),
    };
}
function countDeterministicNpcWitnesses(posX, posZ, nowMs, radiusMeters = 18) {
    const poses = getAllDeterministicNpcPoses(nowMs);
    let count = 0;
    let policeNearby = false;
    const witnessNames = [];
    for (const p of poses) {
        if (p.isSleeping)
            continue;
        if ((0, validation_1.distance2D)(posX, posZ, p.x, p.z) <= radiusMeters) {
            count += 1;
            witnessNames.push(p.name);
            if (p.role.startsWith('polisi')) {
                policeNearby = true;
            }
        }
    }
    return { count, policeNearby, witnessNames };
}
//# sourceMappingURL=npcSchedule.js.map