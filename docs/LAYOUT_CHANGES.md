# CATATAN PERUBAHAN TATA LETAK KOTA CICALENGKA (LANGKAH 4)

Dokumen ini mencatat seluruh perubahan posisi, rotasi, jaringan jalan, vegetasi, serta anchor dari skema lama menuju satu sumber data tunggal di `client/src/world3d/layout/cicalengka.layout.json`.

---

## 1. Ringkasan Perubahan Jaringan Jalan & Rel

| ID | Perubahan | Keterangan |
|---|---|---|
| `jalan_raya` | `(Z = -18, 156×10)` → `Z = -10` (`X ∈ [-63.5, +63.5]`, aspal `10 m`, trotoar `1.5 m`) | Memberi ruang blok perdagangan utara seluas `21.5 m` (2 baris bangunan + setback). |
| `jalan_stasiun` | Menggantikan `jalan_stasiun_kos` (`Z = -30, 102×5.5`) → `Z = -40` (`X ∈ [-63.5, +63.5]`, aspal `7 m`) | Menghubungkan langsung pelataran Stasiun, Loket, ATM, Kos Stasiun, dan Apartemen. |
| `jalan_barat` | Digeser dari `X = -36` (`52 m`) → `X = -60` (`Z ∈ [-43.5, +67.5]`, aspal `7 m`) | Poros utama zona Kesehatan & Pendidikan barat. |
| `jalan_alun_barat` | Menggantikan ruas tengah `jalan_alun_utara_selatan` (`X = 0`) → `X = -18` (`7 m`) | Mengapit Alun-Alun dari sisi barat tanpa membelah pulau taman. |
| `jalan_alun_timur` | Ruas baru simetris → `X = +18` (`Z ∈ [-43.5, +67.5]`, aspal `7 m`) | Mengapit Alun-Alun dari sisi timur dan menghubungkan Stasiun ke Masjid & Griya. |
| `jalan_perumahan_timur` | Digeser dari `X = 47` (`44..50`) → `X = +60` (`Z ∈ [-76, +67.5]`, aspal `7 m`) | Tidak lagi memotong bangunan Pasar & Ruko Pasar; lurus ke utara melintasi rel di `X = 60`. |
| `jalan_alun_selatan` | Ruas lingkungan baru → `Z = +18` (`X ∈ [-63.5, +63.5]`, aspal `5 m`) | Memisahkan Alun-Alun dari Polsek, Kantor Agen, Klinik Swasta, dan Ruko Pasar. |
| `jalan_kampung_selatan` | Digeser dari `Z = +35` (`96×5`) → `Z = +48` (`X ∈ [-63.5, +63.5]`, aspal `5 m`) | Mengapit rapi barisan Kontrakan 1–5 (`Z = 40`) dan Kampung/Griya (`Z = 56..58`). |
| `gang_hunian_selatan` | Gang baru → `Z = +66` (`X ∈ [-63.5, +63.5]`, aspal `3 m`, bahu `1 m`) | Memberi akses jalan langsung bagi seluruh 5 kavling selatan (`Z = 74`). |
| `rel_ganda` | Perlintasan sebidang `crossingX`: `22` → **`60`** (`Z = -62`, panjang `152 m`) | Sejajar tepat dengan kolektor `jalan_perumahan_timur`; tidak lagi menumpuk dengan JPO. |

---

## 2. Tabel Perubahan Posisi Bangunan, Properti, Kavling & Utilitas (65 Lot)

> **Konvensi Rotasi (kelipatan 90°):** `0°` = Selatan (`+Z`), `90°` = Timur (`+X`), `180°` = Utara (`-Z`), `270°` = Barat (`-X`).  
> Semua koordinat pusat bangunan & kavling di-snap ke **grid 2 m**.

| ID | Posisi Lama `(x, z)` | Posisi Baru `(x, z)` | Rotasi Baru | Alasan |
|---|---|---|---|---|
| `stasiun` | `(0, -56)` | `(0, -56)` | `0°` (Selatan) | Dipertahankan di utara `jalan_stasiun`; peron utara berbatasan dengan rel (pengecualian resmi). |
| `loket_tiket` | `(0, -50)` (+offset X `6.5`) | `(8, -48)` | `0°` (Selatan) | Menghilangkan offset lokal `+6.5`, dipusatkan di pelataran timur pintu Stasiun. |
| `atm_stasiun` | `(-12, -42)` | `(-8, -48)` | `0°` (Selatan) | Dikeluarkan dari badan `jalan_stasiun` ke pelataran barat pintu Stasiun. |
| `emperan_stasiun` | `(-16, -48)` | `(-18, -48)` | `0°` (Selatan) | Digeser `2 m` ke barat agar berjarak rapi dari tepi peron Stasiun & `jalan_stasiun`. |
| `prop_jpo_bridge` | `(22, -59)` | `(-24, -60)` | `0°` (Lintas rel) | Dipindah ke sisi barat Stasiun agar bebas perlintasan sebidang `X = 60` dan peron. |
| `plot_stasiun_1` | `(-46, -42)` | `(-46, -50)` | `0°` (Selatan) | Dikeluarkan dari `jalan_stasiun` (`Z = -40`) ke blok stasiun barat (`setback ≥ 4 m` dari rel). |
| `prop_apt_raya_1` | `(-30, -36)` | `(26, -50)` | `0°` (Selatan) | Dikeluarkan dari `jalan_stasiun` & dipindah ke deretan transit utara timur Stasiun. |
| `prop_kos_stasiun_1` | `(-18, -36)` | `(34, -50)` | `0°` (Selatan) | Dikeluarkan dari `jalan_stasiun`; berderet rapi di building line `Z = -50`. |
| `prop_kos_stasiun_2` | `(18, -36)` | `(40, -50)` | `0°` (Selatan) | Berderet sejajar di `Z = -50` dengan jarak antar bangunan `1.0 m`. |
| `prop_kos_stasiun_3` | `(32, -34)` | `(46, -50)` | `0°` (Selatan) | Dikeluarkan dari `jalan_stasiun` & overlap `toko_mebel`/`lapak_3`, sejajar di `Z = -50`. |
| `puskesmas` | `(-44, -28)` | `(-48, -22)` | `0°` (Selatan) | Dikeluarkan dari `jalan_barat` & `jalan_stasiun`, menghadap arteri `jalan_raya`. |
| `warung` | `(-22, -12)` | `(-30, -22)` | `0°` (Selatan) | Dikeluarkan dari aspal `jalan_raya` ke sisi utara arteri `jalan_raya`. |
| `pos_kurir` | `(-10, -28)` | `(0, -30)` | `180°` (Utara) | Dikeluarkan dari aspal `jalan_stasiun_kos`, menghadap `jalan_stasiun` di poros tengah. |
| `toko_mebel` | `(24, -28)` | `(-6, -22)` | `0°` (Selatan) | Dikeluarkan dari jalan & overlap `balai_lelang`/`prop_kos_stasiun_3`, menghadap `jalan_raya`. |
| `balai_lelang` | `(16, -22)` | `(6, -22)` | `0°` (Selatan) | Dikeluarkan dari `jalan_raya`, sejajar rapi di building line `Z = -22` sebelah `toko_mebel`. |
| `prop_lapak_pasar_1` | `(38, -20)` | `(26, -32)` | `180°` (Utara) | Dikeluarkan dari `jalan_raya` & overlap `pasar`, berderet rapi menghadap `jalan_stasiun`. |
| `prop_lapak_pasar_2` | `(46, -20)` | `(32, -32)` | `180°` (Utara) | Dikeluarkan dari `jalan_raya`, `pasar`, & `pasar_grosir`, berderet di `Z = -32`. |
| `prop_lapak_pasar_3` | `(38, -28)` | `(38, -32)` | `180°` (Utara) | Dikeluarkan dari jalan & `prop_kos_stasiun_3`, melengkapi deret lapak di `Z = -32`. |
| `prop_kos_pasar_1` | `(58, -28)` | `(48, -32)` | `180°` (Utara) | Dikeluarkan dari `jalan_stasiun_kos` & `pasar_grosir`, di sisi utara blok pasar. |
| `minimarket` | `(22, -10)` | `(30, -22)` | `0°` (Selatan) | Dikeluarkan dari aspal `jalan_raya` ke koridor perdagangan utara `Z = -22`. |
| `pasar_grosir` | `(52, -20)` | `(46, -22)` | `0°` (Selatan) | Dikeluarkan dari `jalan_raya` & overlap `pasar`/`lapak`/`kos`, sejajar `minimarket`. |
| `penampungan` | `(-56, -6)` | `(-70, -2)` | `90°` (Timur) | Digeser ke sisi barat `jalan_barat` (`X = -60`) dan menghadap langsung ke timur ke jalan. |
| `bank` | `(-24, 4)` | `(-46, 2)` | `180°` (Utara) | Dipindah ke blok komersial barat menghadap langsung ke arteri `jalan_raya`. |
| `balai_kota_reserved` | *(Baru - slot)* | `(-46, 10)` | `0°` (Selatan) | Slot baru di blok layanan barat, menghadap `jalan_alun_selatan`. |
| `kantor_desa` | `(-28, -24)` | `(-30, 4)` | `90°` (Timur) | Dikeluarkan dari persimpangan 3 jalan ke sisi barat Alun-Alun menghadap `jalan_alun_barat`. |
| `masjid_reserved` | *(Baru - slot)* | `(30, 2)` | `270°` (Barat) | Slot baru di timur Alun-Alun menghadap ke barat ke arah Alun-Alun. |
| `atm_alun` | `(10, -2)` | `(26, 10)` | `270°` (Barat) | Dikeluarkan dari pulau Alun-Alun ke luar `jalan_alun_timur`. |
| `bath_mck` | `(14, 6)` | `(32, 10)` | `0°` (Selatan) | Digeser ke timur luar lingkar Alun-Alun agar jalan bebas hambatan, menghadap `jalan_alun_selatan`. |
| `pasar` | `(42, -10)` | `(46, 4)` | `180°` (Utara) | Dikeluarkan dari tengah `jalan_raya` & jalan `X=47`; kini berdiri utuh di blok pasar menghadap `jalan_raya`. |
| `emperan_pasar` | `(34, 2)` | `(40, 14)` | `0°` (Selatan) | Ditempatkan rapi di tepi trotoar selatan Pasar menghadap `jalan_alun_selatan`. |
| `atm_pasar` | `(46, -16)` | `(50, 12)` | `0°` (Selatan) | Dikeluarkan dari `jalan_raya` & overlap `pasar`/`pasar_grosir` ke selatan Pasar. |
| `plot_kampung_1` | `(-60, 22)` | `(-70, 26)` | `90°` (Timur) | Digeser ke barat `jalan_barat` agar tidak menimpa badan jalan, menghadap ke timur. |
| `klinik_swasta` | `(-44, 4)` | `(-46, 26)` | `180°` (Utara) | Dikeluarkan dari tepi `jalan_barat` lama, sejajar poros Kesehatan barat menghadap `jalan_alun_selatan`. |
| `polsek` | `(-10, 10)` | `(-6, 26)` | `0°` (Utara, lokal `-Z`) | **Dikeluarkan dari Alun-Alun** & poros tengah, dipindah ke selatan `jalan_alun_selatan` menghadap Alun-Alun. |
| `kantor_agen` | `(10, 12)` | `(6, 26)` | `180°` (Utara) | **Dikeluarkan dari Alun-Alun**, menghilangkan offset `[0, 0, 3.2]`, bersebelahan rapi dengan Polsek. |
| `prop_apt_timur_2` | `(24, 6)` | `(28, 26)` | `180°` (Utara) | Mengatasi status bangunan terisolasi (`>10 m`); kini di sudut `jalan_alun_timur` & `jalan_alun_selatan`. |
| `prop_ruko_pasar_1` | `(38, 10)` | `(38, 28)` | `180°` (Utara) | Digeser ke deretan ruko selatan `jalan_alun_selatan` di seberang Pasar. |
| `prop_ruko_pasar_2` | `(54, 10)` | `(46, 28)` | `180°` (Utara) | Dikeluarkan dari `jalan_perumahan_timur`, berderet rapi di `Z = 28` menghadap `jalan_alun_selatan`. |
| `sekolah` | `(-46, 22)` | `(-48, 38)` | `180°` (Selatan, lokal `-Z`) | Dipindah ke blok selatan zona Pendidikan menghadap `jalan_kampung_selatan`, bebas tabrakan `kontrakan_1`. |
| `kontrakan_1` | `(-36, 24)` | `(-36, 40)` | `0°` (Selatan) | Dikeluarkan dari `jalan_barat` & overlap `sekolah`, berderet pada building line `Z = 40`. |
| `kontrakan_2` | `(-22, 24)` | `(-28, 40)` | `0°` (Selatan) | Diselaraskan pada building line `Z = 40` (`jarak seragam 2 m` / `1.4 m` paving). |
| `kontrakan_3` | `(-8, 24)` | `(-8, 40)` | `0°` (Selatan) | Diselaraskan pada building line `Z = 40` di selatan blok tengah. |
| `kontrakan_4` | `(6, 24)` | `(0, 40)` | `0°` (Selatan) | Berderet rapi di `Z = 40` menghadap `jalan_kampung_selatan`. |
| `kontrakan_5` | `(20, 24)` | `(8, 40)` | `0°` (Selatan) | Melengkapi deret 5 kontrakan pada `Z = 40`. |
| `prop_rumah_griya_1` | `(38, 34)` | `(28, 38)` | `0°` (Selatan) | Masuk ke blok Griya utara `jalan_kampung_selatan` (`Z = 38`), menghadap jalan. |
| `prop_rumah_griya_2` | `(56, 34)` | `(40, 38)` | `0°` (Selatan) | Dikeluarkan dari tepi `jalan_perumahan_timur`, jarak seragam `4 m` dari Griya 1. |
| `plot_pasar_1` | `(58, -4)` | `(50, 38)` | `90°` (Timur) | Dikeluarkan dari area pohon `pohon_18` & koridor sawah, menghadap `jalan_perumahan_timur`. |
| `prop_kos_kampung_5` | `(-60, 42)` | `(-70, 56)` | `90°` (Timur) | Digeser ke sisi barat `jalan_barat`, menghadap jalan di zona hunian barat. |
| `prop_kontrakan_kampung_1` | `(-46, 42)` | `(-48, 56)` | `180°` (Utara) | Ditempatkan pada building line `Z = 56` selatan `jalan_kampung_selatan`, menghadap jalan. |
| `prop_kontrakan_kampung_2` | `(-30, 42)` | `(-40, 56)` | `180°` (Utara) | Berderet seragam (`jarak badan 2 m`) di `Z = 56`. |
| `prop_kontrakan_kampung_3` | `(-14, 42)` | `(-32, 56)` | `180°` (Utara) | Berderet seragam (`jarak badan 2 m`) di `Z = 56`. |
| `prop_kontrakan_kampung_4` | `(4, 42)` | `(-4, 56)` | `180°` (Utara) | Sejajar simetris di blok tengah selatan `Z = 56`. |
| `prop_kontrakan_kampung_5` | `(20, 42)` | `(4, 56)` | `180°` (Utara) | Pasangan simetris di `Z = 56` menghadap `jalan_kampung_selatan`. |
| `prop_rumah_griya_3` | `(38, 52)` | `(30, 58)` | `180°` (Utara) | Sejajar deret perumahan Griya selatan `jalan_kampung_selatan`. |
| `prop_rumah_griya_4` | `(56, 52)` | `(42, 58)` | `180°` (Utara) | Dikeluarkan dari `jalan_perumahan_timur`, berjarak seragam dari `griya_3`. |
| `plot_kampung_2` | `(-46, 58)` | `(-46, 74)` | `180°` (Utara) | Dipindah ke selatan `gang_hunian_selatan` agar bebas pohon & terhubung gang langsung. |
| `plot_kampung_3` | `(-28, 58)` | `(-32, 74)` | `180°` (Utara) | Sejajar di baris kavling `Z = 74`, bebas pohon palem. |
| `plot_perumahan_1` | `(16, 58)` | `(0, 74)` | `180°` (Utara) | Simetris di blok tengah `Z = 74`, bebas pohon palem. |
| `plot_perumahan_2` | `(34, 66)` | `(30, 74)` | `180°` (Utara) | Sejajar rapi di baris kavling `Z = 74` menghadap `gang_hunian_selatan`. |
| `plot_perumahan_3` | `(54, 66)` | `(44, 74)` | `180°` (Utara) | Digeser ke `X = 44` agar bebas persimpangan `jalan_perumahan_timur`. |
| `menara_bts` | `(67, -48)` | `(72, -50)` | `0°` (Barat) | Digeser ke zona hijau timur `X = 72` jauh dari trotoar jalan. |
| `sawah_timur` | `(72, -10)` | `(72, -10)` | `0°` (Barat) | Tetap di tepi timur kota, bebas dari trotoar timur `X = 65`. |
| `empang` | `(70, 48)` | `(72, 48)` | `0°` (Barat) | Digeser `2 m` ke timur agar kolam & tanggul bersih dari trotoar `jalan_perumahan_timur`. |
| `menara_air` | `(-34, -68)` | `(-34, -74)` | `0°` (Selatan) | Digeser `6 m` ke utara agar di luar zona aman balas rel (`>= 4 m`). |
| `pabrik_reserved` | *(Baru - slot)* | `(46, -76)` | `0°` (Timur) | Slot industri utara rel; jarak `> 4 m` dari rel & buffer `> 14 m` dari hunian terdekat. |

---

## 3. Perubahan Alun-Alun, Vegetasi, Properti Instanced & Anchor

1. **Alun-Alun Cicalengka (`(0, 0)` → `(0, +6)`)**:
   - Seluruh bangunan solid (`polsek`, `kantor_agen`, `atm_alun`) dipindahkan ke luar jalan lingkar Alun-Alun.
   - Di dalam plaza hanya terdapat `beringin_alun (0, +6)`, `pendopo_alun (-6, +10)`, 6 lapak payung PKL di tepi utara & tenggara plaza, 4 bangku taman, dan 6 pohon peneduh luar di `X = ±12`.
2. **Vegetasi & Properti Deterministik (Seeded)**:
   - Koordinat manual di `InstancedProps.tsx` dihapus seluruhnya dan digantikan oleh generator deterministik (`seed: 20250501` untuk tanaman, `seed: 20250502` untuk prop) dari `cicalengka.layout.json`:
   - Menghasilkan **29 pohon kampung + 7 palem (36 tanaman)**, **4 segmen pagar**, **6 bangku taman**, serta **lampu PJU instanced** di sepanjang koridor jalan — semuanya lolos cek kebersihan dari aspal jalan, trotoar, rel, kavling, bangunan, dan jalur akses pintu.
3. **Anchor & Titik Spawn (Siap Sinkronisasi Penuh Langkah 5)**:
   - `STATION_SPAWN`: `(0, -42)` → `(0, -46)`
   - `TICKET_BOOTH_POS.cicalengka`: `(0, -50)` → `(8, -48)`
   - `POLSEK_POS` / `jailCenter` / `releaseSpawn`: `(-10, 10)` / `(-10, 14)` / `(-10, 3)` → `(-6, 26)` / `(-6, 30)` / `(-6, 21)`
   - `AGENT_OFFICE_POS`: `(10, 12)` → `(6, 26)`
   - `CCTV_ZONES`: `cctv_stasiun (-14, -44)`, `cctv_bank (-40, -6)`, `cctv_alun (-13, -6)`, `cctv_pasar (36, -6)` (tiang CCTV berdiri tepat di koordinatnya tanpa hack visual offset).

---

## 4. Refaktor Komponen Sumber Data Tunggal

Seluruh komponen berikut kini membaca posisi & rotasi langsung dari `cicalengka.layout.json` / `layoutHelpers.ts` (semua export lama dipertahankan):
- `client/src/world3d/worldConstants.ts`
- `client/src/world3d/CicalengkaWorld.tsx`
- `client/src/world3d/InstancedProps.tsx`
- `client/src/world3d/assets/PropEnvironment.tsx`
- `client/src/world3d/Phase4Buildings3D.tsx`
- `client/src/world3d/Phase6Buildings3D.tsx`
- `client/src/world3d/PropertyBuildings3D.tsx`
- `client/src/world3d/LandPlotsAndConstruction3D.tsx`

---

## 5. Sinkronisasi Penuh Sistem, Backend, Simulasi & UI (Langkah 5)

Seluruh konfigurasi backend, helper validasi/NPC/kurir, skrip seed/migrasi, pencahayaan 3D, simulasi lokal, dan modal UI kini diselaraskan dengan `client/src/world3d/layout/cicalengka.layout.json`:

1. **15 File Konfigurasi Backend (`functions/src/config/*.json`)**:
   - `law.json`, `land.json`, `clinic.json`, `construction.json`, `jobs.json`, `business.json`, `bank.json`, `courses.json`, `economy.json`, `furniture.json`, `housing.json`, `trainSchedule.json`, `quests.json`, `initialProperties.json`, dan `npcs.json` disinkronkan ke posisi lot, anchor, dan rute jalan baru (tanpa menabrak bangunan solid atau rel di luar perlintasan `X = 60`).
2. **Helper Backend & Skrip Seed/Migrasi**:
   - `functions/src/helpers/validation.ts` (`STATION_SPAWN`, `WARUNG_POS`, `KONTRAKAN_POSITIONS`)
   - `functions/src/helpers/propertyAdvanced.ts` (`KANTOR_DESA_POS`, `STATION_COORDS`)
   - `functions/src/helpers/phase2.ts` (`KURIR_TARGETS`)
   - `functions/src/helpers/npcSchedule.ts` (`ZONE_TAG_ANCHORS`)
   - `functions/src/scripts/seedPhase4.ts`, `seedProperties.ts`, `migrateV2ToV3.ts`
3. **Adegan 3D, Simulasi Lokal & Modal UI**:
   - `client/src/world3d/DayNightCycle.tsx`: 6 tiang lampu kolonial diposisikan bersih di sudut Alun-Alun (`±9.2, -1.2 / 13.2`) dan pelataran Stasiun (`±12.5, -46.5`); lampu hub malam dipusatkan ke pusat distrik baru.
   - `client/src/world3d/PropertyBuildings3D.tsx` & `LandPlotsAndConstruction3D.tsx`: memprioritaskan koordinat kanonis `findLotPlacement(id)` agar render 3D tetap selaras dengan layout terbaru.
   - `client/src/firebase/localSimulation.ts`: menyinkronkan `KURIR_TARGETS` dan jarak `STATION_SPAWN`.
   - `client/src/ui/BusinessModal.tsx`, `FurnitureShopModal.tsx`, dan `BankModal.tsx`: petunjuk koordinat membaca langsung konstanta dari `worldConstants.ts`.
4. **Pengujian Otomatis (`layout.test.ts`)**:
   - Menambahkan verifikasi keselarasan 15 JSON konfigurasi backend, keamanan titik `homePos`/`workPos`/`patrolRoute` seluruh NPC, serta kebebasan benturan lampu kolonial terhadap aspal jalan, bangunan, pohon, dan bangku.

