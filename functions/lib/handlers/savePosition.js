"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePosition = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const validation_1 = require("../helpers/validation");
const vehicles_1 = require("../helpers/vehicles");
exports.savePosition = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const safePos = (0, validation_1.clampWorldPos)({
        x: Number(data?.x ?? 0),
        y: Number(data?.y ?? 1),
        z: Number(data?.z ?? -42),
        rotY: Number(data?.rotY ?? 0),
    });
    const charRef = firebase_1.db.collection('characters').doc(uid);
    const charSnap = await charRef.get();
    if (!charSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Karakter belum ada.');
    }
    const charData = charSnap.data();
    const nowMs = Date.now();
    if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
        return { ok: true, skippedDuringTrip: true };
    }
    // Validasi kecepatan perpindahan di server terhadap status jalan kaki vs kendaraan aktif
    const prev = charData.lastPosition;
    const prevUpdatedMs = charData.updatedAt instanceof firestore_1.Timestamp ? charData.updatedAt.toMillis() : nowMs - 5000;
    const elapsedSec = Math.max(1, (nowMs - prevUpdatedMs) / 1000);
    let maxAllowedSpeedMps = 11.5; // Jalan kaki + lari + toleransi
    const activeVehId = typeof charData.drivingVehicleId === 'string' && charData.drivingVehicleId
        ? charData.drivingVehicleId
        : null;
    if (activeVehId && !activeVehId.startsWith('td_')) {
        const vehSnap = await firebase_1.db.collection('vehicles').doc(activeVehId).get();
        if (vehSnap.exists) {
            const model = (0, vehicles_1.getVehicleModel)(String(vehSnap.data().modelId));
            if (model) {
                maxAllowedSpeedMps = model.maxSpeedMps * 1.35;
            }
        }
    }
    else if (activeVehId && activeVehId.startsWith('td_')) {
        maxAllowedSpeedMps = 28;
    }
    if (prev && typeof prev.x === 'number' && typeof prev.z === 'number') {
        const dist = Math.hypot(safePos.x - prev.x, safePos.z - prev.z);
        const maxDist = Math.max(18, maxAllowedSpeedMps * elapsedSec + 10);
        if (dist > maxDist) {
            return { ok: false, rejectedTeleport: true, lastPosition: prev };
        }
    }
    await charRef.update({
        lastPosition: safePos,
        updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
    });
    return { ok: true, lastPosition: safePos };
});
//# sourceMappingURL=savePosition.js.map