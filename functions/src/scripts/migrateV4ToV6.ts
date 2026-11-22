/**
 * Skrip Migrasi Data Fase 4/5 -> Fase 6 (Idempoten & Non-Destruktif).
 * Menambahkan field wantedLevel, criminalRecordCount, sentence, mortgages, lands,
 * questLog, npcAffinity, agentLicense, policeStats ke karakter lama
 * serta field securityLevel, hasInsurance, renovationTier, extensions, landPlotId
 * ke properti lama tanpa menghapus data pemain sebelumnya.
 *
 * Jalankan:
 *   npx tsx functions/src/scripts/migrateV4ToV6.ts
 */
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../helpers/firebase';

export async function migratePhase4ToPhase6() {
  console.log('Memulai migrasi non-destruktif karakter & properti -> Fase 6...');
  const nowMs = Date.now();

  // 1. Migrasi karakter lama
  const charsSnap = await db.collection('characters').get();
  let migratedChars = 0;

  for (const charDoc of charsSnap.docs) {
    const data = charDoc.data();
    const updates: Record<string, unknown> = {};

    if (typeof data.wantedLevel !== 'number') {
      updates.wantedLevel = 0;
    }
    if (typeof data.wantedUpdatedAtMs !== 'number') {
      updates.wantedUpdatedAtMs = nowMs;
    }
    if (typeof data.lastCrimeAtMs !== 'number') {
      updates.lastCrimeAtMs = 0;
    }
    if (typeof data.criminalRecordCount !== 'number') {
      updates.criminalRecordCount = 0;
    }
    if (data.sentence === undefined) {
      updates.sentence = null;
    }
    if (!Array.isArray(data.mortgages)) {
      updates.mortgages = [];
    }
    if (!Array.isArray(data.lands)) {
      updates.lands = [];
    }
    if (!data.questLog || typeof data.questLog !== 'object') {
      updates.questLog = {
        activeCount: 0,
        completedToday: 0,
        dailyResetKey: '',
      };
    }
    if (!data.npcAffinity || typeof data.npcAffinity !== 'object') {
      updates.npcAffinity = {};
    }
    if (data.agentLicense === undefined) {
      updates.agentLicense = null;
    }
    if (data.policeStats === undefined) {
      updates.policeStats = null;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.fromMillis(nowMs);
      await charDoc.ref.update(updates);
      migratedChars += 1;
    }

    // Pastikan seluruh item inventori lama memiliki uid & field quantity baku
    const invSnap = await charDoc.ref.collection('inventory').get();
    for (const invDoc of invSnap.docs) {
      const iData = invDoc.data();
      const invPatch: Record<string, unknown> = {};
      if (!iData.uid) invPatch.uid = charDoc.id;
      if (typeof iData.quantity !== 'number') {
        invPatch.quantity = Number(iData.qty || 0);
      }
      if (Object.keys(invPatch).length > 0) {
        invPatch.updatedAtMs = nowMs;
        await invDoc.ref.update(invPatch);
      }
    }
  }

  // 2. Migrasi properti lama (nilai default keamanan, asuransi, & renovasi)
  const propsSnap = await db.collection('properties').get();
  let migratedProps = 0;

  for (const propDoc of propsSnap.docs) {
    const data = propDoc.data();
    const updates: Record<string, unknown> = {};

    if (typeof data.securityLevel !== 'number') {
      updates.securityLevel = 0;
    }
    if (typeof data.hasInsurance !== 'boolean') {
      updates.hasInsurance = false;
    }
    if (typeof data.renovationTier !== 'number') {
      updates.renovationTier = 0;
    }
    if (!Array.isArray(data.extensions)) {
      updates.extensions = [];
    }
    if (data.landPlotId === undefined) {
      updates.landPlotId = null;
    }
    if (!Array.isArray(data.furnitureSetBonus)) {
      updates.furnitureSetBonus = [];
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAtMs = nowMs;
      await propDoc.ref.update(updates);
      migratedProps += 1;
    }
  }

  // 3. Sinkronisasi basePrice pada kavling tanah yang belum memilikinya
  const plotsSnap = await db.collection('land_plots').get();
  let migratedPlots = 0;
  for (const plotDoc of plotsSnap.docs) {
    const pData = plotDoc.data();
    if (typeof pData.basePrice !== 'number' && typeof pData.price === 'number') {
      await plotDoc.ref.update({ basePrice: pData.price, updatedAtMs: nowMs });
      migratedPlots += 1;
    }
  }

  console.log(
    `Migrasi Fase 6 selesai: ${migratedChars} karakter, ${migratedProps} properti, ${migratedPlots} kavling diperbarui dengan aman.`
  );
}

if (require.main === module) {
  migratePhase4ToPhase6()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migrasi Fase 6 gagal:', err);
      process.exit(1);
    });
}
