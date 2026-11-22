/**
 * Skrip Migrasi Data Fase 1 -> Fase 2 (Aman & Idempoten, tanpa menghapus data pemain lama).
 * Jalankan secara lokal atau terhadap Emulator:
 *   npx tsx functions/src/scripts/migrateV1ToV2.ts
 */
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../helpers/firebase';
import { DEFAULT_SKILLS, ensurePhase2Configs } from '../helpers/phase2';

export async function migratePhase1ToPhase2() {
  console.log('Memulai migrasi konfigurasi & karakter Fase 1 -> Fase 2...');
  await ensurePhase2Configs();

  const charsSnap = await db.collection('characters').get();
  let migratedChars = 0;

  for (const charDoc of charsSnap.docs) {
    const data = charDoc.data();
    const updates: Record<string, unknown> = {};

    if (typeof data.health !== 'number') updates.health = 100;
    if (typeof data.hygiene !== 'number') updates.hygiene = 100;
    if (typeof data.mood !== 'number') updates.mood = 80;
    if (!data.statsUpdatedAt) updates.statsUpdatedAt = Timestamp.now();
    if (!data.currentZone) updates.currentZone = 'cicalengka';
    if (!data.skills) updates.skills = DEFAULT_SKILLS;
    if (data.currentJob === undefined) updates.currentJob = null;
    if (data.activeShift === undefined) updates.activeShift = null;
    if (data.activeTrip === undefined) updates.activeTrip = null;
    if (data.activeClinic === undefined) updates.activeClinic = null;
    if (data.activeCourse === undefined) updates.activeCourse = null;
    if (typeof data.faintedCount !== 'number') updates.faintedCount = 0;
    if (typeof data.lastBillPeriod !== 'number') updates.lastBillPeriod = 0;

    if (Object.keys(updates).length > 0) {
      await charDoc.ref.update(updates);
      migratedChars += 1;
    }

    const statsRef = db.collection('character_stats').doc(charDoc.id);
    const statsSnap = await statsRef.get();
    if (statsSnap.exists) {
      const s = statsSnap.data()!;
      const sUpdates: Record<string, unknown> = {};
      if (typeof s.health !== 'number') sUpdates.health = 100;
      if (typeof s.hygiene !== 'number') sUpdates.hygiene = 100;
      if (typeof s.mood !== 'number') sUpdates.mood = 80;
      if (Object.keys(sUpdates).length > 0) {
        await statsRef.update(sUpdates);
      }
    }
  }

  console.log(`Migrasi selesai! ${migratedChars} karakter diperbarui tanpa menghapus data Fase 1.`);
}

if (require.main === module) {
  migratePhase1ToPhase2()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migrasi gagal:', err);
      process.exit(1);
    });
}
