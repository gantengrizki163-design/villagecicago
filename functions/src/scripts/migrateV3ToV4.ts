/**
 * Skrip Migrasi Data Fase 3 -> Fase 4 (Idempoten & Non-Destruktif).
 * Menambahkan field bankAccount, creditScore, businesses ke karakter lama
 * tanpa menghapus data pemain sebelumnya, sekaligus menjalankan seedPhase4Data().
 *
 * Jalankan:
 *   npx tsx functions/src/scripts/migrateV3ToV4.ts
 */
import { Timestamp } from 'firebase-admin/firestore';
import bankConfig from '../config/bank.json';
import { db } from '../helpers/firebase';
import { seedPhase4Data } from './seedPhase4';

export async function migratePhase3ToPhase4() {
  console.log('Memulai seed Fase 4 & migrasi karakter Fase 3 -> Fase 4...');
  await seedPhase4Data();

  const nowMs = Date.now();
  const charsSnap = await db.collection('characters').get();
  let migrated = 0;

  for (const charDoc of charsSnap.docs) {
    const data = charDoc.data();
    const updates: Record<string, unknown> = {};

    if (data.bankAccount === undefined) {
      updates.bankAccount = {
        hasAccount: false,
        accountNumber: '',
        openedAtMs: 0,
      };
    }

    if (typeof data.creditScore !== 'number') {
      updates.creditScore = bankConfig.creditScore.defaultScore;
    }

    if (!Array.isArray(data.businesses)) {
      updates.businesses = [];
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.fromMillis(nowMs);
      await charDoc.ref.update(updates);
      migrated += 1;
    }
  }

  console.log(`Migrasi Fase 4 selesai: ${migrated} karakter diperbarui dengan aman.`);
}

if (require.main === module) {
  migratePhase3ToPhase4()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migrasi Fase 4 gagal:', err);
      process.exit(1);
    });
}
