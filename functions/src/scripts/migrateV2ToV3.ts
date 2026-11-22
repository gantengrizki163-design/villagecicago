/**
 * Skrip Migrasi Data Fase 2 -> Fase 3 (Idempoten & Non-Destruktif).
 * Menambahkan field currentHomeId, homeless, reputation, lastSleepLocation,
 * serta memberi akses hunian sementara bagi karakter lama agar tidak langsung tunawisma.
 *
 * Jalankan:
 *   npx tsx functions/src/scripts/migrateV2ToV3.ts
 */
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../helpers/firebase';
import { seedInitialProperties } from './seedProperties';

const STARTER_TEMP_HOME_ID = 'prop_kos_kampung_5';

export async function migratePhase2ToPhase3() {
  console.log('Memulai seed properti & migrasi karakter Fase 2 -> Fase 3...');
  await seedInitialProperties();

  const nowMs = Date.now();
  const charsSnap = await db.collection('characters').get();
  let migrated = 0;

  for (const charDoc of charsSnap.docs) {
    const data = charDoc.data();
    const uid = charDoc.id;
    const updates: Record<string, unknown> = {};

    const hasHomeField = typeof data.homeless === 'boolean' || data.currentHomeId !== undefined;
    if (!hasHomeField) {
      // Berikan hunian sementara gratis periode awal bagi pemain lama
      updates.currentHomeId = STARTER_TEMP_HOME_ID;
      updates.activeLeaseId = null;
      updates.homeless = false;
      updates.starterHousingClaimed = true;
      updates.lastSleepLocation = { zone: 'cicalengka', propertyId: STARTER_TEMP_HOME_ID, x: -70, y: 0, z: 56 };

      await db
        .collection('property_access')
        .doc(STARTER_TEMP_HOME_ID)
        .collection('members')
        .doc(uid)
        .set(
          {
            uid,
            propertyId: STARTER_TEMP_HOME_ID,
            role: 'guest',
            grantedAtMs: nowMs,
            expiresAtMs: nowMs + 7 * 3_600_000,
          },
          { merge: true }
        );
    }

    if (typeof data.reputation !== 'number') {
      updates.reputation = 60;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.fromMillis(nowMs);
      await charDoc.ref.update(updates);
      migrated += 1;
    }
  }

  console.log(`Migrasi Fase 3 selesai: ${migrated} karakter diperbarui dengan aman.`);
}

if (require.main === module) {
  migratePhase2ToPhase3()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migrasi Fase 3 gagal:', err);
      process.exit(1);
    });
}
