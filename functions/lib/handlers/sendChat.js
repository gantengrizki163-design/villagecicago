"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChat = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../helpers/firebase");
const profanity_1 = require("../helpers/profanity");
const CHAT_RATE_LIMIT_MS = 1500;
exports.sendChat = (0, https_1.onCall)({ region: firebase_1.FUNCTIONS_REGION, enforceAppCheck: firebase_1.ENFORCE_APP_CHECK }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Login diperlukan untuk mengirim chat.');
    }
    const uid = request.auth.uid;
    const data = request.data;
    const channel = data?.channel === 'local' ? 'local' : 'global';
    let cleanMessage;
    try {
        cleanMessage = (0, profanity_1.sanitizeAndFilterMessage)(data?.message);
    }
    catch (err) {
        throw new https_1.HttpsError('invalid-argument', err.message);
    }
    // Rate limit per user melalui RTDB rateLimits/{uid}
    const nowMs = Date.now();
    const rateRef = firebase_1.rtdb.ref(`rateLimits/${uid}/lastChatAt`);
    const lastSnap = await rateRef.get();
    if (lastSnap.exists() && nowMs - Number(lastSnap.val()) < CHAT_RATE_LIMIT_MS) {
        throw new https_1.HttpsError('resource-exhausted', 'Chat terlalu cepat, tunggu sebentar.');
    }
    const charDoc = await firebase_1.db.collection('characters').doc(uid).get();
    if (!charDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Buat karakter terlebih dahulu sebelum chat.');
    }
    const charData = charDoc.data();
    const senderName = String(charData.name);
    await rateRef.set(nowMs);
    if (channel === 'global') {
        await firebase_1.db.collection('chat_logs').add({
            senderUid: uid,
            senderName,
            message: cleanMessage,
            channel: 'global',
            createdAt: firestore_1.Timestamp.now(),
        });
    }
    else {
        const rtdbPlayerSnap = await firebase_1.rtdb.ref(`players/${uid}`).get();
        const playerPos = rtdbPlayerSnap.exists()
            ? rtdbPlayerSnap.val()
            : charData.lastPosition;
        await firebase_1.rtdb.ref('localChat').push({
            senderUid: uid,
            senderName,
            message: cleanMessage,
            x: Number(playerPos?.x ?? 0),
            z: Number(playerPos?.z ?? -42),
            createdAt: nowMs,
        });
    }
    return { ok: true, channel, message: cleanMessage };
});
//# sourceMappingURL=sendChat.js.map