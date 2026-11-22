# Panduan Deployment, Emulator & QA Sistem Kendaraan — Cicalengka Life 3D (Langkah 13)

Dokumen ini merangkum konfigurasi operasional, pengujian **Firebase Emulator Suite**, skrip **seeding & migrasi non-destruktif**, serta checklist **deployment** dan **QA** untuk Sistem Kendaraan di atas Fase 1–6.

---

## 1. Ringkasan Arsitektur & Hemat Biaya Firebase

- **Zero Server Game Loop**:
  - Keausan mesin/ban, penyusutan nilai jual kendaraan, masa berlaku STNK, pajak tahunan, dan cicilan leasing dihitung *lazy* dari timestamp + odometer saat aksi dilakukan di Cloud Functions (`functions/src/helpers/vehicles.ts`).
- **Lalu Lintas NPC Deterministik (0 Database Writes)**:
  - Posisi seluruh kendaraan NPC dan jadwal lampu lalu lintas dihitung murni di sisi klien dari `(routeId + serverNowMs + daySeed)` (`client/src/firebase/trafficDeterminism.ts`), sehingga identik di semua klien tanpa menulis ke Firestore maupun RTDB.
  - Kapasitas render dibatasi adaptif (`<= 14` kendaraan NPC aktif di mobile, `<= 24` di desktop, culling radius `88 m`, LOD sederhana `> 46 m`).
- **RTDB Telemetry Adaptif**:
  - Node `/vehicles/{vehicleId}` di Realtime Database hanya ditulis oleh pengemudi (`driverId == auth.uid`) ketika bergerak/berubah signifikan (~10–15 Hz saat melaju, ~1–2 Hz saat lambat/berhenti) dengan validasi kecepatan & anti-teleport di `database.rules.json`.
  - Posisi parkir final disimpan 1 kali ke Firestore saat `parkVehicle` / `dismountVehicle` dipanggil.
- **Konfigurasi Ter-cache di Klien**:
  - `config/vehicles`, `config/traffic`, dan `config/dealer` di-cache lokal oleh `client/src/firebase/vehicleConfigCache.ts`.

---

## 2. Pengujian Lokal di Firebase Emulator Suite

### A. Persiapan Lingkungan
1. Install dependensi root dan Cloud Functions:
   ```bash
   npm install
   npm --prefix functions install
   ```
2. Salin `.env.example` ke `.env` bila ingin menjalankan frontend terhadap emulator lokal:
   ```env
   VITE_USE_EMULATOR="true"
   VITE_FIREBASE_PROJECT_ID="gen-lang-client-0155960882"
   VITE_FIREBASE_DATABASE_URL="http://127.0.0.1:9000/?ns=gen-lang-client-0155960882"
   ```
   > Saat `VITE_USE_EMULATOR="true"`, `client/src/firebase/config.ts` otomatis menghubungkan Auth (`9099`), Firestore (`8080`), RTDB (`9000`), dan Functions (`5001`).

### B. Build Cloud Functions & Jalankan Emulator
```bash
npm --prefix functions run build
firebase emulators:start --only auth,firestore,database,functions
```
Pada terminal terpisah:
- Jalankan seeding & migrasi ke emulator Firestore:
  ```bash
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx functions/src/scripts/seedVehicles.ts
  ```
- Jalankan aplikasi klien:
  ```bash
  npm run dev
  ```

### C. Pengujian Otomatis (Unit Test, Layout, Security Rules)
1. **Unit & Integrasi Sistem Kendaraan + Tata Letak**:
   ```bash
   npm test
   npm run layout:validate
   npm run layout:audit
   ```
2. **Lint Security Rules & TypeScript**:
   ```bash
   npx eslint firestore.rules
   npm run lint
   npm --prefix functions run lint
   ```
3. **Suite Keamanan Firestore & RTDB (Emulator)**:
   ```bash
   firebase emulators:exec --only firestore,database "npx tsx firestore.rules.test.ts"
   ```
   Suite `firestore.rules.test.ts` memverifikasi:
   - Kepemilikan `vehicles/{vehicleId}`, `service_logs`, `driver_licenses`, `vehicle_leases`, `vehicle_listings`, dan `vehicle_test_drives`.
   - Penolakan mutasi langsung dari klien ke seluruh koleksi keuangan/kendaraan (`allow write: if false;`).
   - Validasi RTDB `/vehicles/{vehicleId}` (hanya `driverId` yang boleh menulis, menolak `speed > maxSpeed + 1.5`, menolak perubahan `maxSpeed`, dan menolak teleport `> 32 m`).

---

## 3. Seeding & Migrasi Data Produksi (Idempoten)

Sebelum atau sesudah deploy Cloud Functions ke proyek Firebase (`firebase-applet-config.json`):

1. **Sinkronisasi Konfigurasi Kendaraan, Lalu Lintas, Dealer, Pekerjaan & Bisnis**:
   ```bash
   npx tsx functions/src/scripts/seedVehicles.ts
   ```
   Skrip ini bersifat idempoten (`{ merge: true }`) dan juga memanggil `migratePhase6ToVehicles()` secara aman:
   - Memastikan dokumen `config/vehicles`, `config/traffic`, `config/dealer`, `config/jobs`, `config/business`, `config/law`, dan `config/tax` terbaru ada di Firestore.
   - Menambahkan field kendaraan default (`ownedVehicleCount`, `drivingVehicleId`, `passengerVehicleId`, `simA`, `simC`) pada karakter eksisting tanpa menghapus data lama.
   - Menambahkan kapasitas garasi default (`hasGarage`, `garageCapacity`) pada properti eksisting (`rumah`, `ruko`, `apartemen`, `kontrakan`).
   - Menambahkan counter `vehicleTaxTotal` pada `state/treasury`.

---

## 4. Langkah Deployment ke Firebase Produksi

Pastikan Firebase CLI login ke project target (`gen-lang-client-0155960882`) dan region Cloud Functions **`asia-southeast1`**.

1. **Verifikasi & Build**:
   ```bash
   npm run lint
   npm test
   npm run build
   npm --prefix functions run build
   ```
2. **Deploy Security Rules & Composite Indexes Terlebih Dahulu**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,database
   ```
   > Catatan: Aplikasi ini memakai named Firestore database sesuai `firebase-applet-config.json` (`firestoreDatabaseId`). Di lingkungan AI Studio, deployment rules dijalankan ke database tersebut lewat `DeployRules`.
3. **Deploy Cloud Functions (`asia-southeast1`)**:
   ```bash
   firebase deploy --only functions
   ```
   Daftar Cloud Functions Sistem Kendaraan yang ter-export di `functions/src/index.ts`:
   - Dealer & Pasar: `buyVehicle`, `buyVehicleOnCredit`, `sellVehicle`, `tradeInVehicle`, `listVehicleForSale`, `transferVehicle`, `testDriveStart`
   - Legalitas & Dokumen: `registerVehicle`, `renewRegistration`, `takeLicenseExam`
   - Berkendara & SPBU/Bengkel: `mountVehicle`, `parkVehicle`, `dismountVehicle`, `retrieveVehicle`, `refuelVehicle`, `serviceVehicle`, `reportPedestrianCollision`
4. **Jalankan Seeding & Migrasi Produksi**:
   ```bash
   npx tsx functions/src/scripts/seedVehicles.ts
   ```
5. **Deploy Frontend (Hosting / Preview)**:
   ```bash
   firebase deploy --only hosting
   ```

---

## 5. Checklist QA End-to-End Sistem Kendaraan

- [ ] **Katalog & Dealer 3D**: Dealer Motor, Lapak Motor Bekas, Showroom Mobil, Showroom Mobil Bekas, SPBU, dan Bengkel tampil di peta tanpa tumpang-tindih collider.
- [ ] **Pembelian & Test Drive**: Uji beli tunai, beli kredit (leasing), tukar tambah, marketplace kendaraan P2P, serta test drive 2 menit di zona aman.
- [ ] **Dokumen & Hukum**: Uji ujian SIM C/A di Polsek/Samsat, penerbitan plat `D xxxx XX`, perpanjangan STNK, tilang polisi bila melaju tanpa SIM/STNK mati/melebihi batas kecepatan/menerobos lampu merah/palang KA.
- [ ] **Mengemudi, SPBU & Bengkel**: Uji fisik berkendara WASD/joystick, lampu depan & sein, klakson, boncengan/penumpang, isi bensin/isi daya listrik di SPBU, serta servis/ganti oli/cat/aksesori di Bengkel (termasuk bengkel milik pemain).
- [ ] **Lalu Lintas NPC Deterministik**: Pastikan kendaraan NPC melaju di lajur kiri Indonesia, berhenti saat lampu merah dan palang rel kereta api tertutup, serta identik lintas dua browser pada waktu yang sama.
- [ ] **Integrasi Kerja & Bisnis**: Pastikan pekerjaan `sopir_angkot` dan `ojek_online`, serta bonus pengiriman/kapasitas bagasi pada kurir/pedagang berfungsi sesuai jenis kendaraan yang dipakai.
