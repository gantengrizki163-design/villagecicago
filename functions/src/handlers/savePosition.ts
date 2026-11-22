import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION } from '../helpers/firebase';
import { clampWorldPos } from '../helpers/validation';
import { getVehicleModel } from '../helpers/vehicles';

export const savePosition = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as { x?: number; y?: number; z?: number; rotY?: number };

    const safePos = clampWorldPos({
      x: Number(data?.x ?? 0),
      y: Number(data?.y ?? 1),
      z: Number(data?.z ?? -42),
      rotY: Number(data?.rotY ?? 0),
    });

    const charRef = db.collection('characters').doc(uid);
    const charSnap = await charRef.get();
    if (!charSnap.exists) {
      throw new HttpsError('not-found', 'Karakter belum ada.');
    }

    const charData = charSnap.data()!;
    const nowMs = Date.now();
    if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
      return { ok: true, skippedDuringTrip: true };
    }

    // Validasi kecepatan perpindahan di server terhadap status jalan kaki vs kendaraan aktif
    const prev = charData.lastPosition as { x?: number; y?: number; z?: number } | undefined;
    const prevUpdatedMs =
      charData.updatedAt instanceof Timestamp ? charData.updatedAt.toMillis() : nowMs - 5000;
    const elapsedSec = Math.max(1, (nowMs - prevUpdatedMs) / 1000);

    let maxAllowedSpeedMps = 11.5; // Jalan kaki + lari + toleransi
    const activeVehId =
      typeof charData.drivingVehicleId === 'string' && charData.drivingVehicleId
        ? charData.drivingVehicleId
        : null;
    if (activeVehId && !activeVehId.startsWith('td_')) {
      const vehSnap = await db.collection('vehicles').doc(activeVehId).get();
      if (vehSnap.exists) {
        const model = getVehicleModel(String(vehSnap.data()!.modelId));
        if (model) {
          maxAllowedSpeedMps = model.maxSpeedMps * 1.35;
        }
      }
    } else if (activeVehId && activeVehId.startsWith('td_')) {
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
      updatedAt: Timestamp.fromMillis(nowMs),
    });

    return { ok: true, lastPosition: safePos };
  }
);
