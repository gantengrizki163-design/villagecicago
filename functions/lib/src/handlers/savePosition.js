"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePosition = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const validation_1 = require("../helpers/validation");
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
    if (charData.activeTrip && Date.now() < Number(charData.activeTrip.arrivesAtMs || 0)) {
        return { ok: true, skippedDuringTrip: true };
    }
    await charRef.update({
        lastPosition: safePos,
        updatedAt: firestore_1.Timestamp.now(),
    });
    return { ok: true, lastPosition: safePos };
});
//# sourceMappingURL=savePosition.js.map