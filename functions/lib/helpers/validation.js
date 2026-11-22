"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERACT_RADIUS_METERS = exports.KONTRAKAN_POSITIONS = exports.WARUNG_POS = exports.STATION_SPAWN = exports.WORLD_BOUNDS = void 0;
exports.distance2D = distance2D;
exports.isValidHexColor = isValidHexColor;
exports.isValidCharacterName = isValidCharacterName;
exports.clampWorldPos = clampWorldPos;
const interactionLocations_json_1 = __importDefault(require("../config/interactionLocations.json"));
exports.WORLD_BOUNDS = {
    minX: -80,
    maxX: 80,
    minY: -2,
    maxY: 25,
    minZ: -80,
    maxZ: 80,
};
// Lokasi stasiun (area spawn awal)
exports.STATION_SPAWN = {
    x: 0,
    y: 1.0,
    z: -46,
    rotY: 0,
};
// Lokasi Warung Teh Neng (Cicalengka)
exports.WARUNG_POS = { x: -30, z: -22 };
// Lokasi 5 Kontrakan Cicalengka
exports.KONTRAKAN_POSITIONS = [
    { id: 'kontrakan_1', x: -36, z: 40 },
    { id: 'kontrakan_2', x: -28, z: 40 },
    { id: 'kontrakan_3', x: -8, z: 40 },
    { id: 'kontrakan_4', x: 0, z: 40 },
    { id: 'kontrakan_5', x: 8, z: 40 },
];
exports.INTERACT_RADIUS_METERS = interactionLocations_json_1.default.interactRadiusMeters;
function distance2D(ax, az, bx, bz) {
    const dx = ax - bx;
    const dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
}
function isValidHexColor(color) {
    return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}
function isValidCharacterName(name) {
    return typeof name === 'string' && /^[a-zA-Z0-9 _.-]{3,20}$/.test(name.trim());
}
function clampWorldPos(pos) {
    return {
        x: Math.max(exports.WORLD_BOUNDS.minX, Math.min(exports.WORLD_BOUNDS.maxX, Number(pos.x) || 0)),
        y: Math.max(exports.WORLD_BOUNDS.minY, Math.min(exports.WORLD_BOUNDS.maxY, Number(pos.y) || 1)),
        z: Math.max(exports.WORLD_BOUNDS.minZ, Math.min(exports.WORLD_BOUNDS.maxZ, Number(pos.z) || 0)),
        rotY: Math.max(-Math.PI * 2, Math.min(Math.PI * 2, Number(pos.rotY) || 0)),
    };
}
//# sourceMappingURL=validation.js.map