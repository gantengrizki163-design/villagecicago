/**
 * Skrip Seed Sistem Kendaraan (Idempoten & Non-Destruktif):
 * Menyinkronkan dokumen konfigurasi kendaraan (`config/vehicles`, `config/traffic`, `config/dealer`),
 * memperbarui `config/jobs` (termasuk Sopir Angkot & Ojek Online) dan `config/business`
 * (termasuk jenis usaha Bengkel & Dealer), serta menjalankan migrasi data Fase 6 -> Sistem Kendaraan.
 *
 * Jalankan:
 *   npx tsx functions/src/scripts/seedVehicles.ts
 */
import businessConfig from '../config/business.json';
import dealerConfig from '../config/dealer.json';
import jobsConfig from '../config/jobs.json';
import lawConfig from '../config/law.json';
import taxConfig from '../config/tax.json';
import trafficConfig from '../config/traffic.json';
import vehiclesConfig from '../config/vehicles.json';
import { db } from '../helpers/firebase';
import { migratePhase6ToVehicles } from './migrateV6ToVehicles';

export async function seedVehicleSystemData() {
  const nowMs = Date.now();

  const configEntries: Array<[string, Record<string, unknown>]> = [
    ['vehicles', vehiclesConfig as unknown as Record<string, unknown>],
    ['traffic', trafficConfig as unknown as Record<string, unknown>],
    ['dealer', dealerConfig as unknown as Record<string, unknown>],
    ['jobs', jobsConfig as unknown as Record<string, unknown>],
    ['business', businessConfig as unknown as Record<string, unknown>],
    ['law', lawConfig as unknown as Record<string, unknown>],
    ['tax', taxConfig as unknown as Record<string, unknown>],
  ];

  for (const [docId, payload] of configEntries) {
    await db
      .collection('config')
      .doc(docId)
      .set({ ...payload, updatedAtMs: nowMs }, { merge: true });
  }

  await migratePhase6ToVehicles();

  console.log(
    `Seed Sistem Kendaraan selesai: ${configEntries.length} dokumen config tersinkron dan migrasi Fase 6 -> Kendaraan tuntas.`
  );
}

if (require.main === module) {
  seedVehicleSystemData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed Sistem Kendaraan gagal:', err);
      process.exit(1);
    });
}
