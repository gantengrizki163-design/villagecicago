import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { sanitizeAndFilterMessage } from '../helpers/profanity';

const CHAT_RATE_LIMIT_MS = 1500;

export const sendChat = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan untuk mengirim chat.');
    }

    const uid = request.auth.uid;
    const data = request.data as { channel?: unknown; message?: unknown };
    const channel = data?.channel === 'local' ? 'local' : 'global';

    let cleanMessage: string;
    try {
      cleanMessage = sanitizeAndFilterMessage(data?.message);
    } catch (err) {
      throw new HttpsError('invalid-argument', (err as Error).message);
    }

    // Rate limit per user melalui RTDB rateLimits/{uid}
    const nowMs = Date.now();
    const rateRef = rtdb.ref(`rateLimits/${uid}/lastChatAt`);
    const lastSnap = await rateRef.get();
    if (lastSnap.exists() && nowMs - Number(lastSnap.val()) < CHAT_RATE_LIMIT_MS) {
      throw new HttpsError('resource-exhausted', 'Chat terlalu cepat, tunggu sebentar.');
    }

    const charDoc = await db.collection('characters').doc(uid).get();
    if (!charDoc.exists) {
      throw new HttpsError('not-found', 'Buat karakter terlebih dahulu sebelum chat.');
    }
    const charData = charDoc.data()!;
    const senderName = String(charData.name);

    await rateRef.set(nowMs);

    if (channel === 'global') {
      await db.collection('chat_logs').add({
        senderUid: uid,
        senderName,
        message: cleanMessage,
        channel: 'global',
        createdAt: Timestamp.now(),
      });
    } else {
      const rtdbPlayerSnap = await rtdb.ref(`players/${uid}`).get();
      const playerPos = rtdbPlayerSnap.exists()
        ? (rtdbPlayerSnap.val() as { x?: number; z?: number })
        : charData.lastPosition;

      await rtdb.ref('localChat').push({
        senderUid: uid,
        senderName,
        message: cleanMessage,
        x: Number(playerPos?.x ?? 0),
        z: Number(playerPos?.z ?? -42),
        createdAt: nowMs,
      });
    }

    return { ok: true, channel, message: cleanMessage };
  }
);
