# MASTER PLAN TATA LETAK KOTA CICALENGKA (LANGKAH 1)

Dokumen ini adalah rencana induk penataan ulang tata letak kota **Cicalengka Life 3D** (`160 m × 160 m`, koordinat `X ∈ [-80, +80]`, `Z ∈ [-80, +80]`, utara = `-Z`, selatan = `+Z`, barat = `-X`, timur = `+X`) untuk menghilangkan **58 pelanggaran** hasil audit (`LAYOUT_AUDIT.md`) sekaligus menata kota agar teratur seperti kota nyata dan mengacu pada `public/assets/aistudio/Peta_Kota_Tropis_dengan_Masjid_dan_Stasiun_863fc6e5.png`.

> **Catatan Status:** Dokumen ini adalah tahap **Langkah 1 (Perencanaan)**. Belum ada perubahan kode maupun database sampai Master Plan ini disetujui.

---

## 1. Hierarki Jalan yang Bersih

Semua ruas jalan dibuat **lurus sejajar sumbu X atau Z**, membentuk **blok persegi** dengan **persimpangan T atau perempatan yang jelas**, bebas jalan buntu di dalam bangunan, dan tanpa ruas jalan yang menembus Alun-Alun atau pasar.

| ID Jalan | Fungsi / Hierarki | Arah | As Koordinat | Rentang | Lebar Aspal | Trotoar (Kiri-Kanan) | Lebar Koridor Total | Keterangan Perubahan |
|---|---|---|---|---|---|---|---|---|
| `jalan_raya` | Arteri Utama | Barat–Timur | `Z = -10` | `X ∈ [-63.5, +63.5]` | `10 m` (`Z: -15..-5`) | `1.5 m` + `1.5 m` | `13 m` (`Z: -16.5..-3.5`) | Digeser dari `Z = -18` ke `-10` agar Blok Utara lebih lega (`21.5 m`) untuk 2 deret bangunan + setback `2 m`. |
| `jalan_stasiun` | Kolektor Utara | Barat–Timur | `Z = -40` | `X ∈ [-63.5, +63.5]` | `7 m` (`Z: -43.5..-36.5`) | `1.5 m` + `1.5 m` | `10 m` (`Z: -45..-35`) | Digeser dari `Z = -30` ke `-40`, lebar dinaikkan ke `7 m`, langsung melayani pelataran Stasiun, Loket, Kos Stasiun, dan Apartemen. |
| `jalan_barat` | Kolektor Barat | Utara–Selatan | `X = -60` | `Z ∈ [-43.5, +67.5]` | `7 m` (`X: -63.5..-56.5`) | `1.5 m` + `1.5 m` | `10 m` (`X: -65..-55`) | Digeser dari `X = -36` ke `-60` menjadi poros zona Kesehatan, Pendidikan & Penampungan Barat. |
| `jalan_alun_barat` | Kolektor Pusat Barat | Utara–Selatan | `X = -18` | `Z ∈ [-43.5, +67.5]` | `7 m` (`X: -21.5..-14.5`) | `1.5 m` + `1.5 m` | `10 m` (`X: -23..-13`) | Menggantikan poros tengah `X = 0` (`jalan_alun_utara_selatan`) agar mengapit Alun-Alun dari barat tanpa membelahnya. |
| `jalan_alun_timur` | Kolektor Pusat Timur | Utara–Selatan | `X = +18` | `Z ∈ [-43.5, +67.5]` | `7 m` (`X: +14.5..+21.5`) | `1.5 m` + `1.5 m` | `10 m` (`X: +13..+23`) | Pasangan simetris pengapit timur Alun-Alun; menghubungkan Stasiun ke Masjid, Ruko & Perumahan. |
| `jalan_perumahan_timur` | Kolektor Timur | Utara–Selatan | `X = +60` | `Z ∈ [-74.0, +67.5]` | `7 m` (`X: +56.5..+63.5`) | `1.5 m` + `1.5 m` | `10 m` (`X: +55..+65`) | **Digeser dari `X = 44..50` ke `X = 60`** sehingga tidak lagi menembus Pasar & Ruko Pasar, lurus melewati perlintasan sebidang rel (`X = 60`) ke zona industri utara rel. |
| `jalan_alun_selatan` | Jalan Lingkungan | Barat–Timur | `Z = +18` | `X ∈ [-63.5, +63.5]` | `5 m` (`Z: +15.5..+20.5`) | `1.5 m` + `1.5 m` | `8 m` (`Z: +14..+22`) | Batas selatan pulau Alun-Alun sekaligus akses depan Polsek, Kantor Agen, Klinik Swasta, Apartemen Timur, Ruko Pasar. |
| `jalan_kampung_selatan` | Jalan Lingkungan | Barat–Timur | `Z = +48` | `X ∈ [-63.5, +63.5]` | `5 m` (`Z: +45.5..+50.5`) | `1.5 m` + `1.5 m` | `8 m` (`Z: +44..+52`) | Digeser dari `Z = +35` ke `+48` agar mengapit rapi deretan Kontrakan 1–5 (utara jalan) & Kontrakan Kampung 1–5 + Griya (selatan jalan). |
| `gang_hunian_selatan` | Gang Kampung | Barat–Timur | `Z = +66` | `X ∈ [-63.5, +63.5]` | `3 m` (`Z: +64.5..+67.5`) | `1 m` bahu jalan | `5 m` (`Z: +63.5..+68.5`) | Akses langsung untuk 5 kavling selatan (`plot_kampung_2..3`, `plot_perumahan_1..3`) agar semua kavling punya akses jalan langsung `< 5 m`. |

### Rel Kereta Api & Penyeberangan
- `rel_ganda`: `Z = -62` (rel selatan `Z = -62`, rel utara `Z = -65.2`, balas `Z ∈ [-67.2, -60.0]`, `X ∈ [-76, +76]`).
- **Zona aman rel (`4 m`)**: `Z ∈ [-71.2, -56.0]` bebas bangunan non-stasiun.
- **Perlintasan Sebidang (`crossingX`)**: dipindah dari `X = 22` ke **`X = +60`** agar tepat segaris dengan kolektor `jalan_perumahan_timur` (tidak lagi bertumpuk dengan JPO).
- **JPO (`prop_jpo_bridge`)**: dipindah dari `X = 22` ke **`X = -24, Z = -60`** (sisi barat Stasiun, sesuai referensi `Peta_Kota_Tropis...`) sehingga tidak menabrak peron Stasiun maupun perlintasan sebidang.

---

## 2. Pembagian Blok dan Zona (Kavling Teratur)

Kota dibagi menjadi **6 zona fungsi** di dalam blok-blok persegi di antara jaringan jalan:

1. **Zona Stasiun (`stasiun`, Utara `Z < -43.5`)**: antara rel (`Z = -62`) dan `jalan_stasiun` (`Z = -40`). Berisi `stasiun`, `loket_tiket`, `emperan_stasiun`, `atm_stasiun`, `prop_apt_raya_1`, `prop_kos_stasiun_1..3`, `plot_stasiun_1`, serta `menara_air` di utara rel.
2. **Zona Perdagangan (`pasar` / sepanjang `jalan_raya`)**: blok utara `jalan_raya` (`Z ∈ [-36.5, -15.0]`) dan sisi timur-tengah `jalan_raya` (`Z ∈ [-5.0, +15.5]`). Berisi `warung`, `toko_mebel`, `balai_lelang`, `pos_kurir`, `minimarket`, `pasar_grosir`, `prop_lapak_pasar_1..3`, `prop_kos_pasar_1`, `pasar`, `atm_pasar`, `emperan_pasar`, `bank`, `prop_ruko_pasar_1..2`, dan `plot_pasar_1`.
3. **Zona Pemerintahan & Layanan (`alun_alun`, pusat simetris)**:
   - **Pulau Alun-Alun** (`X ∈ [-10, +10], Z ∈ [-2, +14]`, pusat `(0, +6)`): **100% bebas bangunan solid**; hanya berisi `beringin_alun`, `pendopo`, 6 payung PKL di tepi plaza, dan lampu taman.
   - **Lingkar Luar Alun-Alun**: `kantor_desa` (barat), `masjid_reserved` & `atm_alun` & `bath_mck` (timur), `polsek` (+ sel tahanan) & `kantor_agen` (selatan), `prop_apt_timur_2` (tenggara seberang jalan), dan `balai_kota_reserved` (barat daya).
4. **Zona Kesehatan & Pendidikan (Barat, sepanjang `jalan_barat` `X = -60`)**: `puskesmas`, `klinik_swasta`, `sekolah`, `penampungan`, dan `plot_kampung_1`.
5. **Zona Hunian (Selatan & Tenggara)**:
   - Kampung & Kontrakan Tengah/Barat: `kontrakan_1..5` berderet pada building line seragam `Z = +40`; `prop_kontrakan_kampung_1..5` di `Z = +56`; `prop_kos_kampung_5` di sisi barat `(-70, +56)`; kavling `plot_kampung_2..3` di `Z = +74`.
   - Perumahan Griya Tenggara: `prop_rumah_griya_1..2` di `Z = +38`; `prop_rumah_griya_3..4` di `Z = +58`; kavling `plot_perumahan_1..3` di `Z = +74`.
6. **Zona Hijau, Sawah & Industri (Pinggir, buffer `≥ 6 m` dari hunian)**:
   - Timur `jalan_perumahan_timur` (`X ≥ 66`): `menara_bts` `(72, -50)`, `sawah_timur` `(72, -10)` beserta saluran irigasi & saung, dan `empang` `(72, +48)`.
   - Utara rel (`Z ≤ -67`): hutan utara dan zona cadangan industri `pabrik_reserved` `(46, -72)` (berjarak `> 14 m` dari hunian terdekat & bebas `2.5 m` dari `jalan_perumahan_timur`, terhubung jalan via perlintasan `X = 60`).
   - Luar pagar dunia: `sawah_barat_luar (-92, -14)` dan perbukitan perimeter.

### Tabel Pemetaan Lengkap Objek (Lama → Baru)

> **Konvensi Rotasi (kelipatan 90°):** `0°` = tampak depan menghadap Selatan (`+Z`), `90°` = menghadap Timur (`+X`), `180°` = menghadap Utara (`-Z`), `270°` = menghadap Barat (`-X`).  
> Semua koordinat pusat bangunan & kavling di-snap ke **grid 2 m** (`X` & `Z` bilangan genap).

| ID Objek | Zona Lama | Posisi Lama `(x, z)` | Zona Baru | Posisi Baru `(x, z)` | Ukuran Visual `(L × P)` | Rotasi & Arah Hadap | Alasan Penataan |
|---|---|---|---|---|---|---|---|
| `stasiun` | Stasiun | `(0, -56)` | Stasiun | `(0, -56)` | `28 × 7.6` | `0°` (Selatan `+Z`) | Dipertahankan di sisi selatan rel (peron menempel rel dikecualikan secara sengaja) & langsung tersambung ke `jalan_stasiun` (`Z = -40`). |
| `loket_tiket` | Stasiun | `(0, -50)` (offset `+6.5`) | Stasiun | `(8, -48)` | `3.2 × 2.4` | `0°` (Selatan `+Z`) | Dipusatkan tepat di anchornya pada pelataran timur pintu stasiun, berjarak `3.3 m` dari aspal `jalan_stasiun`. |
| `atm_stasiun` | Stasiun | `(-12, -42)` | Stasiun | `(-8, -48)` | `1.8 × 1.6` | `0°` (Selatan `+Z`) | Digeser dari aspal `jalan_stasiun` (`Z = -42`) ke pelataran barat pintu stasiun. |
| `emperan_stasiun` | Stasiun | `(-16, -48)` | Stasiun | `(-18, -48)` | `4.4 × 2.8` | `0°` (Selatan `+Z`) | Digeser `2 m` ke barat agar tidak mepet tepi peron stasiun (`X = -14`) & berjarak aman dari jalan. |
| `prop_jpo_bridge` | Stasiun | `(22, -59)` | Stasiun | `(-24, -60)` | `4 × 13` | `0°` (lintas rel) | Dipindah ke sisi barat stasiun (sesuai peta referensi) agar tidak bertumpuk di atas perlintasan sebidang. |
| `plot_stasiun_1` | Stasiun | `(-46, -42)` | Stasiun | `(-46, -50)` | `8 × 8` | `0°` (Selatan `+Z`) | Digeser ke utara `jalan_stasiun` agar berada di zona stasiun, bebas jalan & berjarak `6 m` dari balas rel. |
| `prop_apt_raya_1` | Stasiun | `(-30, -36)` | Stasiun | `(26, -50)` | `6 × 6` | `0°` (Selatan `+Z`) | Dipindah ke utara `jalan_stasiun` sebelah timur stasiun agar keluar dari jalan & menghadap `jalan_stasiun`. |
| `prop_kos_stasiun_1` | Stasiun | `(-18, -36)` | Stasiun | `(34, -50)` | `5 × 5` | `0°` (Selatan `+Z`) | Berderet rapi di sisi utara `jalan_stasiun` dengan jarak seragam & setback `3.5 m`. |
| `prop_kos_stasiun_2` | Stasiun | `(18, -36)` | Stasiun | `(40, -50)` | `5 × 5` | `0°` (Selatan `+Z`) | Berderet di building line `Z = -50` dengan jarak seragam `1.0 m` dari `prop_kos_stasiun_1`. |
| `prop_kos_stasiun_3` | Stasiun | `(32, -34)` | Stasiun | `(46, -50)` | `5 × 5` | `0°` (Selatan `+Z`) | Berderet seragam di `Z = -50`, jarak `1.0 m` dari `prop_kos_stasiun_2`, keluar dari jalan & jauh dari `toko_mebel`. |
| `puskesmas` | Kesehatan (Barat) | `(-44, -28)` | Kesehatan (Barat) | `(-48, -22)` | `12.8 × 8.8` | `0°` (Selatan `+Z`) | Ditarik ke blok utara-barat agar bebas dari `jalan_barat` & `jalan_stasiun`, setback `≥ 2 m` dari `jalan_raya` & `jalan_barat`. |
| `warung` | Perdagangan | `(-22, -12)` | Perdagangan | `(-30, -22)` | `8.4 × 6.8` | `0°` (Selatan `+Z`) | Dikeluarkan dari aspal `jalan_raya`, ditaruh di utara `jalan_raya` menghadap langsung ke jalan arteri. |
| `pos_kurir` | Perdagangan | `(-10, -28)` | Perdagangan | `(0, -30)` | `6.6 × 6.2` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_stasiun`, menghadap utara ke `jalan_stasiun` pada poros stasiun–alun. |
| `toko_mebel` | Perdagangan | `(24, -28)` | Perdagangan | `(-6, -22)` | `8.4 × 7.0` | `0°` (Selatan `+Z`) | Dipindah dari aspal `jalan_stasiun` & overlap `balai_lelang` ke sisi utara `jalan_raya` blok tengah. |
| `balai_lelang` | Perdagangan | `(16, -22)` | Perdagangan | `(6, -22)` | `8.8 × 7.8` | `0°` (Selatan `+Z`) | Dikeluarkan dari `jalan_raya`, sejajar di building line `Z = -22` bersama `toko_mebel` (`jarak 3.4 m`). |
| `minimarket` | Perdagangan | `(22, -10)` | Perdagangan | `(30, -22)` | `10.4 × 8.4` | `0°` (Selatan `+Z`) | Dikeluarkan dari aspal `jalan_raya` ke sisi utara koridor perdagangan timur. |
| `pasar_grosir` | Perdagangan | `(52, -20)` | Perdagangan | `(46, -22)` | `11.4 × 9.4` | `0°` (Selatan `+Z`) | Dipindah dari tengah `jalan_raya` & tumpang tindih pasar/lapak/kos ke sebelah `minimarket`, menghadap `jalan_raya`. |
| `prop_lapak_pasar_1` | Perdagangan | `(38, -20)` | Perdagangan | `(26, -32)` | `4.6 × 4.6` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_raya` & `pasar`, berderet rapi di deret lapak utara `Z = -32` menghadap `jalan_stasiun`. |
| `prop_lapak_pasar_2` | Perdagangan | `(46, -20)` | Perdagangan | `(32, -32)` | `4.6 × 4.6` | `180°` (Utara `-Z`) | Dikeluarkan dari `pasar_grosir` & `jalan_raya`, berderet seragam (`gap 1.4 m` paving / `2 m` badan) di `Z = -32`. |
| `prop_lapak_pasar_3` | Perdagangan | `(38, -28)` | Perdagangan | `(38, -32)` | `4.6 × 4.6` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_stasiun` & overlap `prop_kos_stasiun_3`, melengkapi deret lapak di `Z = -32`. |
| `prop_kos_pasar_1` | Perdagangan | `(58, -28)` | Perdagangan | `(48, -32)` | `5.6 × 5.4` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_stasiun` & `pasar_grosir`, ditempatkan di blok perdagangan utara dekat Pasar Grosir. |
| `alun_alun` | Pemerintahan (Pusat) | `(0, 0)` (`22 × 20`) | Pemerintahan (Pusat) | `(0, +6)` (`20 × 16`) | `20 × 16` | Simetris | Digeser ke `Z = +6` di pulau pusat yang dibingkai 4 ruas jalan (`X=±18, Z=-10/+18`), bebas objek solid & bebas jalan membelah. |
| `bank` | Perdagangan | `(-24, 4)` | Perdagangan | `(-46, +2)` | `12.4 × 9.6` | `180°` (Utara `-Z`) | Dipindah agar menghadap langsung ke arteri `jalan_raya` (`setback 2.2 m`) di zona komersial barat. |
| `kantor_desa` | Pemerintahan | `(-28, -24)` | Pemerintahan | `(-30, +4)` | `11.6 × 8.8` | `90°` (Timur `+X`) | Dikeluarkan dari persimpangan 3 jalan (`jalan_raya`/`barat`/`stasiun`), dipindah mengapit sisi barat Alun-Alun. |
| `balai_kota_reserved` | *(Baru - Batch 3)* | `—` | Pemerintahan | `(-46, +12)` | `8 × 6` | `0°` (Selatan `+Z`) | Lot tercadang untuk Balai Kota di zona pemerintahan/layanan selatan `bank`, menghadap `jalan_alun_selatan`. |
| `masjid_reserved` | *(Baru - Batch 3)* | `—` | Pemerintahan | `(30, +2)` | `9 × 9` | `270°` (Barat `-X`) | Lot tercadang Masjid Agung di seberang timur Alun-Alun menghadap Alun-Alun (sesuai peta referensi). |
| `atm_alun` | Pemerintahan | `(10, -2)` | Pemerintahan | `(26, +12)` | `1.8 × 1.6` | `270°` (Barat `-X`) | Dikeluarkan dari dalam Alun-Alun ke sudut luar timur-selatan Alun-Alun (`setback 3.6 m` dari jalan). |
| `bath_mck` | Layanan | `(14, 6)` | Pemerintahan & Layanan | `(32, +12)` | `5.8 × 4.8` | `0°` (Selatan `+Z`) | Digeser ke timur luar jalan Alun-Alun agar tidak menghalangi `jalan_alun_timur`, menghadap `jalan_alun_selatan`. |
| `pasar` | Perdagangan | `(42, -10)` | Perdagangan | `(46, +4)` | `15.8 × 13.8` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_raya` & tidak lagi terpotong `jalan_perumahan_timur`; menghadap `jalan_raya` di blok pasar. |
| `emperan_pasar` | Perdagangan | `(34, 2)` | Perdagangan | `(40, +14)` | `4.4 × 2.8` | `0°` (Selatan `+Z`) | Ditempatkan rapi di sisi selatan pelataran Pasar menghadap `jalan_alun_selatan`. |
| `atm_pasar` | Perdagangan | `(46, -16)` | Perdagangan | `(50, +14)` | `1.8 × 1.6` | `0°` (Selatan `+Z`) | Dikeluarkan dari `jalan_raya` & overlap `pasar`, ditaruh di trotoar luar sisi selatan Pasar menghadap `jalan_alun_selatan`. |
| `penampungan` | Kesehatan/Layanan (Barat) | `(-56, -6)` | Kesehatan & Pendidikan | `(-70, -2)` | `8 × 8` | `90°` (Timur `+X`) | Digeser ke sisi barat `jalan_barat` (`X = -60`) agar tidak terlalu dekat dengan Bank dan tetap menghadap `jalan_barat`. |
| `plot_kampung_1` | Hunian (Barat) | `(-60, 22)` | Kesehatan / Hunian Barat | `(-70, +26)` | `7 × 7` | `90°` (Timur `+X`) | Digeser ke barat `jalan_barat` sejajar `penampungan`, menghadap `jalan_barat` (`setback 3 m`). |
| `prop_kos_kampung_5` | Hunian (Kampung) | `(-60, 42)` | Hunian | `(-70, +56)` | `5 × 5` | `90°` (Timur `+X`) | Sejajar di koridor barat `jalan_barat` (`setback 4 m`), bebas dari persimpangan `jalan_kampung_selatan`. |
| `klinik_swasta` | Kesehatan (Barat) | `(-44, 4)` | Kesehatan & Pendidikan | `(-46, +26)` | `10.8 × 7.8` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_barat` lama, ditaruh di antara `puskesmas` & `sekolah` menghadap `jalan_alun_selatan`. |
| `sekolah` | Pendidikan (Barat) | `(-46, 22)` | Kesehatan & Pendidikan | `(-48, +38)` | `13 × 9` | `0°` (Selatan `+Z`) | Ditarik ke `(-48, +38)` menghadap `jalan_kampung_selatan`, bebas tabrakan dengan `kontrakan_1` (`jarak 2.2 m`). |
| `kontrakan_1` | Hunian | `(-36, 24)` | Hunian | `(-36, +40)` | `6.6 × 6.4` | `0°` (Selatan `+Z`) | Dikeluarkan dari `jalan_barat` & overlap `sekolah`, sejajar pada garis depan hunian `Z = +40` menghadap `jalan_kampung_selatan`. |
| `kontrakan_2` | Hunian | `(-22, 24)` | Hunian | `(-28, +40)` | `6.6 × 6.4` | `0°` (Selatan `+Z`) | Berderet rapi di `Z = +40` (`gap 1.4 m` paving / `2 m` badan dari `kontrakan_1`). |
| `kontrakan_3` | Hunian | `(-8, 24)` | Hunian | `(-8, +40)` | `6.6 × 6.4` | `0°` (Selatan `+Z`) | Pada building line `Z = +40` blok tengah, tepat di selatan `polsek` (`jarak belakang 3.4 m`). |
| `kontrakan_4` | Hunian | `(6, 24)` | Hunian | `(0, +40)` | `6.6 × 6.4` | `0°` (Selatan `+Z`) | Berderet simetris di `Z = +40` (`gap 1.4 m` paving / `2 m` badan dari `kontrakan_3`). |
| `kontrakan_5` | Hunian | `(20, 24)` | Hunian | `(+8, +40)` | `6.6 × 6.4` | `0°` (Selatan `+Z`) | Melengkapi deret 5 kontrakan di building line `Z = +40` menghadap `jalan_kampung_selatan`. |
| `polsek` | Pemerintahan | `(-10, 10)` | Pemerintahan | `(-6, +26)` | `11.8 × 10.5` | `0°` (Utara `-Z`, model lokal) | **Dikeluarkan dari Alun-Alun & `jalan_alun_utara_selatan`**, ditaruh di luar sisi selatan `jalan_alun_selatan` menghadap Alun-Alun. |
| `kantor_agen` | Pemerintahan | `(10, 12)` | Pemerintahan | `(+6, +26)` | `8.0 × 6.2` | `180°` (Utara `-Z`) | **Dikeluarkan dari Alun-Alun**, bersebelahan rapi dengan Polsek (`gap 2.1 m`), menghadap Alun-Alun di selatan `jalan_alun_selatan`. |
| `prop_apt_timur_2` | Alun-Alun (Timur) | `(24, 6)` | Pemerintahan / Sekitar Alun | `(28, +26)` | `7.1 × 7.1` | `180°` (Utara `-Z`) | Mengatasi status **terisolasi (`>10 m` dari jalan)**; kini tepat di sudut `jalan_alun_timur` & `jalan_alun_selatan`. |
| `prop_ruko_pasar_1` | Perdagangan | `(38, 10)` | Perdagangan | `(38, +28)` | `7.8 × 8.4` | `180°` (Utara `-Z`) | Digeser menghadap `jalan_alun_selatan` tepat di seberang selatan Pasar, keluar dari blok pasar utama. |
| `prop_ruko_pasar_2` | Perdagangan | `(54, 10)` | Perdagangan | `(46, +28)` | `7.8 × 8.4` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_perumahan_timur`, berderet rapi sebelah `prop_ruko_pasar_1` (`jarak badan 1.0 m`, paving `0.2 m` / `1 m`). |
| `prop_rumah_griya_1` | Hunian (Perumahan) | `(38, 34)` | Hunian | `(28, +38)` | `9.1 × 9.1` | `0°` (Selatan `+Z`) | Digeser ke deret selatan blok tenggara menghadap `jalan_kampung_selatan` (`setback 2.95 m`). |
| `prop_rumah_griya_2` | Hunian (Perumahan) | `(56, 34)` | Hunian | `(40, +38)` | `9.1 × 9.1` | `0°` (Selatan `+Z`) | Berderet rapi di `Z = +38` (`jarak dinding 4 m` / paving `2.9 m` dari `rumah_griya_1`). |
| `plot_pasar_1` | Perdagangan | `(58, -4)` | Perdagangan | `(50, +38)` | `7 × 7` | `90°` (Timur `+X`) | Dikeluarkan dari area pohon `pohon_18`, ditempatkan di tepi `jalan_perumahan_timur` dekat blok ruko/niaga timur. |
| `prop_kontrakan_kampung_1` | Hunian (Kampung) | `(-46, 42)` | Hunian | `(-48, +56)` | `6.6 × 6.4` | `180°` (Utara `-Z`) | Digeser ke selatan `jalan_kampung_selatan` pada building line `Z = +56` menghadap ke utara ke arah jalan. |
| `prop_kontrakan_kampung_2` | Hunian (Kampung) | `(-30, 42)` | Hunian | `(-40, +56)` | `6.6 × 6.4` | `180°` (Utara `-Z`) | Berderet seragam pada `Z = +56` (`jarak badan 2 m`, paving `1.4 m` dari unit 1). |
| `prop_kontrakan_kampung_3` | Hunian (Kampung) | `(-14, 42)` | Hunian | `(-32, +56)` | `6.6 × 6.4` | `180°` (Utara `-Z`) | Berderet seragam pada `Z = +56` (`jarak badan 2 m`, paving `1.4 m` dari unit 2). |
| `prop_kontrakan_kampung_4` | Hunian (Kampung) | `(4, 42)` | Hunian | `(-4, +56)` | `6.6 × 6.4` | `180°` (Utara `-Z`) | Simetris di blok tengah selatan menghadap `jalan_kampung_selatan`. |
| `prop_kontrakan_kampung_5` | Hunian (Kampung) | `(20, 42)` | Hunian | `(+4, +56)` | `6.6 × 6.4` | `180°` (Utara `-Z`) | Pasangan simetris di `Z = +56` (`jarak badan 2 m` dari unit 4). |
| `prop_rumah_griya_3` | Hunian (Perumahan) | `(38, 52)` | Hunian | `(30, +58)` | `9.1 × 9.1` | `180°` (Utara `-Z`) | Digeser sedikit ke selatan `jalan_kampung_selatan` pada deret rumah tengah `Z = +58` menghadap jalan. |
| `prop_rumah_griya_4` | Hunian (Perumahan) | `(56, 52)` | Hunian | `(42, +58)` | `10.1 × 10.1` | `180°` (Utara `-Z`) | Dikeluarkan dari `jalan_perumahan_timur` & berderet seragam dengan `rumah_griya_3` (`jarak 3.5 m`). |
| `plot_kampung_2` | Hunian (Kampung) | `(-46, 58)` | Hunian | `(-46, +74)` | `7 × 7` | `180°` (Utara `-Z`) | Digeser ke selatan `gang_hunian_selatan` agar punya akses gang langsung & bebas pohon. |
| `plot_kampung_3` | Hunian (Kampung) | `(-28, 58)` | Hunian | `(-32, +74)` | `8 × 8` | `180°` (Utara `-Z`) | Berderet rapi di `Z = +74` menghadap `gang_hunian_selatan`, bebas pohon palem. |
| `plot_perumahan_1` | Hunian (Perumahan) | `(16, 58)` | Hunian | `(0, +74)` | `8 × 8` | `180°` (Utara `-Z`) | Ditempatkan simetris di blok tengah selatan menghadap `gang_hunian_selatan`, bebas pohon palem. |
| `plot_perumahan_2` | Hunian (Perumahan) | `(34, 66)` | Hunian | `(30, +74)` | `9 × 9` | `180°` (Utara `-Z`) | Sejajar pada baris kavling selatan `Z = +74` menghadap `gang_hunian_selatan`. |
| `plot_perumahan_3` | Hunian (Perumahan) | `(54, 66)` | Hunian | `(44, +74)` | `8 × 8` | `180°` (Utara `-Z`) | Ditempatkan rapi di sebelah timur `plot_perumahan_2` (`jarak 5.5 m`), bebas dari jalan & pagar dunia. |
| `menara_bts` | Pinggir Timur | `(67, -48)` | Hijau / Utilitas | `(72, -50)` | `2.8 × 2.8` | `0°` | Digeser ke tepi timur `X = 72` (`7.1 m` di timur `jalan_perumahan_timur`), bebas trotoar. |
| `sawah_timur` | Pinggir Timur | `(72, -10)` | Hijau & Sawah | `(72, -10)` | `12 × 48` | `0°` | Dipertahankan di sisi timur `jalan_perumahan_timur` (irigasi di `X = 66` tepat di luar trotoar timur `X = 65`). |
| `empang` | Pinggir Tenggara | `(70, 48)` | Hijau & Sawah | `(72, +48)` | `Ø 12` | `0°` | Digeser `2 m` ke timur (`X = 72`) agar berjarak aman `2.5 m` dari trotoar `jalan_perumahan_timur`. |
| `menara_air` | Utara Rel | `(-34, -68)` | Utilitas Utara | `(-34, -72)` | `3.2 × 3.2` | `0°` | Digeser `4 m` ke utara agar di luar zona aman balas rel (`Z ≤ -71.2` / jarak `> 4 m` dari rel). |
| `pabrik_reserved` | *(Baru - Batch 3)* | `—` | Industri (Utara Rel) | `(46, -72)` | `16 × 10` | `0°` (Selatan `+Z`) | Lot industri tercadang di timur laut utara rel (sesuai peta referensi), berjarak `14.5 m` (`> 6 m` buffer) dari hunian terdekat, setback `2.5 m` dari `jalan_perumahan_timur`, & diakses lewat perlintasan `X = 60`. |

### Anchor Sistem, Spawn & Patroli (Disinkronkan pada Langkah 5)
- `STATION_SPAWN`: `(0, -42)` → **`(0, -46)`** (di pelataran depan pintu stasiun, berjarak `2.5 m` di utara jalan stasiun).
- `jailCenter` (`law.json`): `(-10, 14)` → **`(-6, +30)`** (tepat di dalam ruang tahanan hollow Polsek).
- `releaseSpawn` (`law.json`): `(-10, 3)` → **`(-6, +21)`** (di trotoar depan Polsek menghadap `jalan_alun_selatan`).
- `hospitalPos` (`clinic.json`): `(-42, -26)` → **`(-48, -16)`** (di trotoar depan Puskesmas sisi `jalan_raya`).
- `cctv_stasiun`: `(0, -44)` → **`(-14, -44)`**; `cctv_bank`: `(-24, 4)` → **`(-40, -6)`**; `cctv_alun`: `(0, 0)` → **`(-13, -6)`**; `cctv_pasar`: `(42, -10)` → **`(36, -6)`** (semua tiang CCTV di sudut tepi luar trotoar, bebas bangunan & aspal jalan).

---

## 3. Prinsip Keteraturan Visual & Aturan Tata Letak

1. **Building Line & Arah Hadap Jalan**:
   - Seluruh bangunan pada blok yang sama berbagi *building line* yang lurus (`Z = -50`, `-32`, `-22`, `+26/+28`, `+38/+40`, `+56/+58`, `+74`), pintu utama dan papan nama menghadap jalan terdekat.
   - Setback bangunan dari tepi aspal jalan minimal **`2.0 m`** (di luar trotoar `1.5 m`).
   - Jarak bangunan non-stasiun dari tepi rel ganda minimal **`4.0 m`**.
2. **Jarak Antar Bangunan Seragam (dengan Snap Grid 2 m)**:
   - Rumah Kos (`5×5`): jarak pusat `6 m` → celah `1.0 m` (kampung `1–1.5 m`).
   - Ruko (`7×7`): jarak pusat `8 m` → celah badan `1.0 m` (ruko `0.5–1 m`).
   - Kontrakan (`6×6`): jarak pusat `8 m` → celah badan `2.0 m` (`1.4 m` antar paving teras).
   - Perumahan Griya (`8×8` / `9×9`): jarak pusat `12 m` → celah badan `3.0–4.0 m`.
3. **Alun-Alun Pusat Simetris**:
   - Pusat kota di `(0, +6)` (`20 × 16 m`) bebas dari semua bangunan solid (`polsek`, `kantor_agen`, `atm_alun`, `bath_mck` dipindah ke luar lingkar jalan).
   - Hanya berisi **Pohon Beringin `(0, +6)`**, **Pendopo `(-6, +10)`**, **6 lapak payung PKL** di tepi plaza, dan **lampu taman**.
4. **Penempatan Pohon & Vegetasi (Deterministik + Seed Tetap)**:
   - **Baris Pohon Jalan / Tepi Trotoar**: interval teratur `8–10 m` hanya di jalur hijau tepi luar trotoar (`≥ 1.5 m` dari tepi aspal jalan), misalnya keliling luar Alun-Alun (`X = ±12, Z = -2/+6/+14`), tepi `jalan_raya` di celah antar bangunan, serta median tepi barat/timur.
   - **Kelompok Zona Hijau**: hutan utara (`Z = -74..-72`), sabuk hijau barat (`X = -70`) dan timur (`X = +68..+72` di sekitar sawah & empang), serta kantong hijau selatan.
   - **Aturan Larangan**: dilarang keras menempatkan pohon di aspal jalan, rel kereta, trotoar pejalan kaki `1.5 m`, akses pintu (`1.5 m`), maupun di dalam kavling bangunan/tanah.

---

## 4. Asumsi Sederhana yang Dipakai

1. **Entitas Masa Depan (Batch 3)**: `balai_kota`, `masjid`, dan `pabrik` belum memiliki mesh bangunan terpasang di Cicalengka saat ini (baru terdaftar di `assets/manifest.json` / desain prompt), sehingga disediakan slot tercadang (`balai_kota_reserved`, `masjid_reserved`, `pabrik_reserved`) pada peta rencana agar tidak perlu membongkar tata letak lagi saat Batch 3 dipasang.
2. **Pengecualian Peron Stasiun**: `stasiun` tetap berbatasan langsung dengan `rel_ganda` di sisi rel karena secara fungsional merupakan peron naik-turun penumpang (sesuai kriteria audit akhir).
3. **Kompromi Grid 2 m vs Celah Bangunan**: Karena semua posisi di-snap ke kelipatan `2 m` sedangkan dimensi beberapa aset bernilai genap (`6 m`, `8 m`), celah antar-dinding `kontrakan` menjadi `2.0 m` (`1.4 m` antar paving teras) agar grid `2 m` tidak dilanggar.
4. **Penyesuaian Jarak Interaksi**: Karena posisi bangunan dan landmark berubah (mis. `warung`, `kantor_desa`, `polsek`, `kontrakan`), seluruh posisi di `functions/src/config/*.json`, `worldConstants.ts`, `npcDeterminism.ts`, dan minimap `HouseSearchModal.tsx` akan ikut disinkronkan pada Langkah 5 agar gameplay tetap mulus.

---

## Gambar Tampak Atas Rencana

Lihat **`docs/master_plan_topdown.svg`** untuk denah tampak atas berskala penuh (`160 m × 160 m`).
