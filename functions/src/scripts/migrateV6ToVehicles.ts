/**
 * Skrip Migrasi Data Fase 6 -> Sistem Kendaraan (Idempoten & Non-Destruktif).
 * Menambahkan field kendaraan & SIM ke karakter lama (ownedVehicleCount, drivingVehicleId,
 * passengerVehicleId, simA, simC), kapasitas garasi pada properti lama (hasGarage, garageCapacity),
 * serta counter pajak kendaraan pada state/treasury tanpa menghapus data pemain sebelumnya.
 *
 * Jalankan:
 *   npx tsx functions/src/scripts/migrateV6ToVehicles.ts
 */
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../helpers/firebase';

function resolveDefaultGarageCapacity(propData: Record<string, unknown>): {
  hasGarage: boolean;
  garageCapacity: number;
} {
  const propType = String(propData.type || '');
  const applied = Array.isArray(propData.renovationsApplied)
    ? (propData.renovationsApplied as string[])
    : [];
  const extensions = Array.isArray(propData.extensions)
    ? (propData.extensions as string[])
    : [];
  const hasGarageRenovation = applied.includes('garage') || extensions.includes('garage');

  let baseCapacity = 0;
  if (propType === 'rumah') {
    baseCapacity = 2;
  } else if (propType === 'ruko' || propType === 'apartemen') {
    baseCapacity = 1;
  } else if (propType === 'kontrakan') {
    baseCapacity = 1;
  }

  const totalCapacity = baseCapacity + (hasGarageRenovation ? 1 : 0);
  return {
    hasGarage: totalCapacity > 0,
    garageCapacity: totalCapacity,
  };
}

export async function migratePhase6ToVehicles() {
  console.log('Memulai migrasi non-destruktif Fase 6 -> Sistem Kendaraan...');
  const nowMs = Date.now();

  // Hitung jumlah kendaraan eksisting per owner (agar migrasi ulang tetap akurat & idempoten)
  const vehiclesSnap = await db.collection('vehicles').get();
  const vehicleCountByOwner: Record<string, number> = {};
  for (const vDoc of vehiclesSnap.docs) {
    const vData = vDoc.data();
    const ownerId = String(vData.ownerId || '');
    if (ownerId && vData.status !== 'repossessed') {
      vehicleCountByOwner[ownerId] = (vehicleCountByOwner[ownerId] || 0) + 1;
    }
  }

  // 1. Migrasi karakter lama
  const charsSnap = await db.collection('characters').get();
  let migratedChars = 0;

  for (const charDoc of charsSnap.docs) {
    const data = charDoc.data();
    const updates: Record<string, unknown> = {};
    const expectedCount = vehicleCountByOwner[charDoc.id] ?? 0;

    if (typeof data.ownedVehicleCount !== 'number') {
      updates.ownedVehicleCount = expectedCount;
    }
    if (data.drivingVehicleId === undefined) {
      updates.drivingVehicleId = null;
    }
    if (data.passengerVehicleId === undefined) {
      updates.passengerVehicleId = null;
    }
    if (data.simA === undefined) {
      updates.simA = null;
    }
    if (data.simC === undefined) {
      updates.simC = null;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.fromMillis(nowMs);
      await charDoc.ref.update(updates);
      migratedChars += 1;
    }
  }

  // 2. Migrasi kapasitas garasi pada properti lama
  const propsSnap = await db.collection('properties').get();
  let migratedProps = 0;

  for (const propDoc of propsSnap.docs) {
    const data = propDoc.data();
    const updates: Record<string, unknown> = {};
    const defaults = resolveDefaultGarageCapacity(data);

    if (typeof data.hasGarage !== 'boolean') {
      updates.hasGarage = defaults.hasGarage;
    }
    if (typeof data.garageCapacity !== 'number') {
      updates.garageCapacity = defaults.garageCapacity;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAtMs = nowMs;
      await propDoc.ref.update(updates);
      migratedProps += 1;
    }
  }

  // 3. Migrasi counter pajak kendaraan pada state/treasury
  const treasuryRef = db.collection('state').doc('treasury');
  const treasurySnap = await treasuryRef.get();
  let migratedTreasury = 0;
  if (treasurySnap.exists) {
    const tData = treasurySnap.data()!;
    if (typeof tData.vehicleTaxTotal !== 'number') {
      await treasuryRef.update({
        vehicleTaxTotal: 0,
        updatedAtMs: nowMs,
      });
      migratedTreasury = 1;
    }
  }

  console.log(
    `Migrasi Sistem Kendaraan selesai: ${migratedChars} karakter, ${migratedProps} properti, ${migratedTreasury} kas negara diperbarui dengan aman.`
  );
}

if (require.main === module) {
  migratePhase6ToVehicles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migrasi Sistem Kendaraan gagal:', err);
      process.exit(1);
    });
}
