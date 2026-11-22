"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPC_INTERACT_RADIUS_METERS = exports.SHARED_INTERACT_RADIUS_METERS = exports.INTERACTION_RADII_CONFIG = void 0;
exports.getStaticLocation = getStaticLocation;
exports.buildDynamicPropertyTarget = buildDynamicPropertyTarget;
exports.buildDynamicLandPlotTarget = buildDynamicLandPlotTarget;
exports.assertNearLocation = assertNearLocation;
const https_1 = require("firebase-functions/v2/https");
const interactionLocations_json_1 = __importDefault(require("../config/interactionLocations.json"));
const housing_1 = require("./housing");
const validation_1 = require("./validation");
exports.INTERACTION_RADII_CONFIG = interactionLocations_json_1.default;
exports.SHARED_INTERACT_RADIUS_METERS = exports.INTERACTION_RADII_CONFIG.interactRadiusMeters;
exports.NPC_INTERACT_RADIUS_METERS = exports.INTERACTION_RADII_CONFIG.npcInteractRadiusMeters;
function getStaticLocation(locationId) {
    return exports.INTERACTION_RADII_CONFIG.locations[locationId] ?? null;
}
function buildDynamicPropertyTarget(id, propData, labelOverride, radiusPadding = 4.8) {
    const staticLot = getStaticLocation(id);
    const pos = (propData.position || {});
    const size = (propData.size || {});
    const x = Number(pos.x ?? staticLot?.x ?? 0);
    const z = Number(pos.z ?? staticLot?.z ?? 0);
    const w = Number(size.width ?? 6);
    const d = Number(size.depth ?? 6);
    const radius = Math.max(exports.SHARED_INTERACT_RADIUS_METERS, Math.max(w, d) / 2 + radiusPadding);
    return {
        id,
        label: labelOverride || String(propData.name || staticLot?.label || id),
        zone: String(propData.zone || staticLot?.zone || 'cicalengka'),
        x,
        z,
        doorX: staticLot?.doorX ?? x,
        doorZ: staticLot?.doorZ ?? z + Math.max(2.5, d / 2 + 1.2),
        radius,
    };
}
function buildDynamicLandPlotTarget(id, plotData) {
    const staticLot = getStaticLocation(id);
    const pos = (plotData.position || {});
    const size = (plotData.size || {});
    const x = Number(pos.x ?? staticLot?.x ?? 0);
    const z = Number(pos.z ?? staticLot?.z ?? 0);
    const w = Number(size.width ?? 8);
    const d = Number(size.depth ?? 8);
    const radius = Math.max(exports.SHARED_INTERACT_RADIUS_METERS, Math.max(w, d) / 2 + 4.5);
    return {
        id,
        label: String(plotData.name || staticLot?.label || id),
        zone: String(plotData.zone || staticLot?.zone || 'cicalengka'),
        x,
        z,
        doorX: staticLot?.doorX ?? x,
        doorZ: staticLot?.doorZ ?? z,
        radius,
    };
}
/**
 * Helper terpadu sisi server untuk memverifikasi jarak real-time pemain (RTDB dengan fallback Firestore)
 * terhadap daftar lokasi statis (door/center) atau target dinamis (properti/bisnis/kavling).
 */
async function assertNearLocation(rtdb, uid, charData, locationIds, toleransi = 0, dynamicTargets = [], customErrorMessage) {
    const pos = await (0, housing_1.getPlayerWorldPos)(rtdb, uid, charData);
    const playerZone = String(charData.currentZone || 'cicalengka');
    const radiusBase = exports.SHARED_INTERACT_RADIUS_METERS;
    const candidates = [];
    for (const id of locationIds) {
        const entry = getStaticLocation(id);
        if (entry) {
            candidates.push({
                id,
                label: entry.label,
                zone: entry.zone,
                x: entry.x,
                z: entry.z,
                doorX: entry.doorX,
                doorZ: entry.doorZ,
                radius: radiusBase,
            });
        }
    }
    for (const dyn of dynamicTargets) {
        candidates.push({
            id: dyn.id,
            label: dyn.label,
            zone: dyn.zone || 'cicalengka',
            x: dyn.x,
            z: dyn.z,
            doorX: dyn.doorX ?? dyn.x,
            doorZ: dyn.doorZ ?? dyn.z,
            radius: dyn.radius ?? radiusBase,
        });
    }
    let bestMatch = null;
    const targetLabels = [];
    for (const c of candidates) {
        if (!targetLabels.includes(c.label))
            targetLabels.push(c.label);
        if (c.zone !== playerZone)
            continue;
        const distDoor = (0, validation_1.distance2D)(pos.x, pos.z, c.doorX, c.doorZ);
        const distCenter = (0, validation_1.distance2D)(pos.x, pos.z, c.x, c.z);
        const effectiveDist = Math.min(distDoor, distCenter);
        const allowedRadius = c.radius + toleransi;
        if (effectiveDist <= allowedRadius) {
            if (!bestMatch || effectiveDist < bestMatch.distanceMeters) {
                bestMatch = {
                    locationId: c.id,
                    label: c.label,
                    distanceMeters: effectiveDist,
                    pos,
                };
            }
        }
    }
    if (!bestMatch) {
        const labelText = targetLabels.length > 0 ? targetLabels.join(' / ') : 'lokasi yang ditentukan';
        throw new https_1.HttpsError('failed-precondition', customErrorMessage || `Harap datang dan dekati ${labelText} terlebih dahulu.`);
    }
    return bestMatch;
}
//# sourceMappingURL=location.js.map