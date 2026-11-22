# Cicalengka Life 3D — Visual Style Guide

Dokumen ini adalah sumber kebenaran tunggal untuk seluruh lapisan visual, warna, bentuk, skala, pencahayaan, tata letak dunia, dan antarmuka **Cicalengka Life 3D**, disusun langsung dari 31 gambar referensi unik di `/public/assets/aistudio/`.

---

## 1. Palet Warna Dominan (Hex Codes)

Seluruh material 3D dan UI menggunakan warna di bawah ini (satu material bersama per warna palet untuk performa seluler optimal).

### A. Alam, Tanah & Infrastruktur
| Kategori | Token | Hex | Catatan Pengamatan Referensi |
| :--- | :--- | :--- | :--- |
| Tanah / Lumpur Sawah | `earth_clay` | `#8E613E` | Lapisan tanah penampang diorama & pematang sawah |
| Tanah Halaman Kampung | `earth_yard` | `#C79C63` | Tanah berpasir hangat di pekarangan rumah kampung |
| Rumput Utama | `grass_main` | `#7DB844` | Rumput hijau tropis cerah pada diorama kota |
| Rumput Gelap / Bukit | `grass_hill` | `#528D49` | Lereng bukit dan kanopi pohon lapisan belakang |
| Sawah Muda / Padi | `paddy_lime` | `#A7D842` | Petak sawah hijau kekuningan terang |
| Daun Pohon / Semak | `foliage_bright` | `#69AD3B` | Kanopi pohon low-poly bundar & semak |
| Daun Pisang / Palem | `foliage_palm` | `#80BE43` | Daun palem & pisang memanjang |
| Aspal Jalan Utama | `road_asphalt` | `#686E78` | Abu-abu kebiruan medium (bukan hitam pekat) |
| Trotoar & Paving Blok | `paving_stone` | `#D4C3AD` | Batu trotoar, peron, dan halaman hangat |
| Batu Kerikil Balas Rel | `rail_ballast` | `#8A8177` | Dasar kerikil rel kereta api |
| Bantalan & Baja Rel | `rail_steel` | `#636973` | Rel logam & baja jembatan JPO |
| Marka Jalan & Zebra Cross | `road_marking` | `#F4F2EC` | Garis putus-putus dan zebra cross putih hangat |
| Air Sungai / Empang / Wudhu | `water_clear` | `#5EB3D6` | Biru cerah jernih pada kolam, selokan, tempat wudhu |
| Air Genangan / Banjir | `water_rain` | `#6486A6` | Biru-abu reflektif saat hujan/genangan |

### B. Arsitektur, Atap, Dinding & Kayu
| Kategori | Token | Hex | Catatan Pengamatan Referensi |
| :--- | :--- | :--- | :--- |
| Genteng Terakota Utama | `roof_terracotta` | `#E06B3B` | Warna atap paling dominan di hampir semua bangunan |
| Genteng Terakota Gelap | `roof_terracotta_dark` | `#BD532D` | Lisplang, nok atap, & variasi rumah kampung |
| Atap Seng / Kanopi Peron | `roof_metal_grey` | `#9198A2` | Kanopi stasiun, warung depan, & pos |
| Atap Pabrik Biru | `roof_industrial_blue` | `#4A76B5` | Seng gelombang biru gudang pabrik |
| Atap Kubah Masjid | `roof_mosque_green` | `#45AA50` | Kubah & lis atap masjid hijau cerah |
| Dinding Krem Utama | `wall_cream` | `#F5EBD8` | Dinding plester standar stasiun, kantor desa, masjid, klinik, pabrik |
| Dinding Alas Batu/Semen | `wall_plinth_grey` | `#9A9590` | Pondasi & plint abu-abu bawah dinding |
| Dinding Merah SD | `wall_school_red` | `#D64937` | Bagian bawah dinding sekolah & pagar SD |
| Dinding Pastel Kos Mint | `wall_pastel_mint` | `#7ECBA1` | Unit kos/kontrakan 1 |
| Dinding Pastel Kos Pink | `wall_pastel_pink` | `#F0958D` | Unit kos/kontrakan 2 |
| Dinding Pastel Kos Kuning | `wall_pastel_yellow` | `#F2CB6E` | Unit kos/kontrakan 3 |
| Dinding Bata Ekspos | `brick_orange` | `#DC663C` | Tahap konstruksi dinding bata |
| Beton Konstruksi | `concrete_grey` | `#A9ADB4` | Sloof, kolom cor, anak tangga |
| Kayu Hangat (Teras/Warung) | `wood_warm` | `#B87842` | Tiang warung, meja makan, kusen rumah kampung |
| Kayu Tua / Kusen | `wood_dark` | `#744A2D` | Pintu panel, lemari, rangka ranjang |
| Bambu Pagar | `bamboo_light` | `#CFA261` | Pagar bambu halaman & kandang ayam |
| Kusen Hijau Kolonial | `trim_colonial_green` | `#28644B` | Daun jendela & pintu krepyak Stasiun Cicalengka |
| Aksen Hijau Klinik | `trim_clinic_green` | `#47B85C` | Lis atap, pilar teras, & tiang pagar Puskesmas/Klinik |
| Aksen Merah & Biru Minimarket | `trim_mart_red` / `trim_mart_blue` | `#EA3F33` / `#1F75DB` | Pita fasad dan papan nama minimarket |
| Tenda Pasar Warna-warni | `tarp_blue` / `tarp_red` / `tarp_yellow` | `#3A7FE5` / `#E34C3E` / `#F2B52C` | Tenda lapak pasar & PKL alun-alun |
| Kaca Jendela Siang | `glass_day` | `#4E6E82` | Kaca reflektif biru-abu gelap |
| Kaca / Lampu Menyala Malam | `emissive_warm` | `#FFBE55` | Jendela hangat, lampion, & lampu jalan malam |

### C. Langit & Atmosfer (4 Waktu + Hujan)
| Waktu / Kondisi | Sky Zenith | Sky Horizon / Fog | Cahaya Utama (Directional) | Ambient / Hemisphere |
| :--- | :--- | :--- | :--- | :--- |
| **Pagi (Dawn)** | `#B5D2E8` | `#EFE2DB` | `#F7CCA4` (hangat lembut) | Sky `#DCE8F5` / Ground `#8E8078` |
| **Siang (Noon)** | `#4AB8F2` | `#C9E8FA` | `#FFF5DC` (putih-kuning cerah) | Sky `#B5E2FA` / Ground `#7D9B5E` |
| **Sore (Sunset)** | `#8F73AD` | `#F7A664` | `#FF9C52` (oranye keemasan) | Sky `#C58FA6` / Ground `#6F5347` |
| **Malam (Night)** | `#161E38` | `#222C4D` | `#6078A8` (cahaya bulan tipis) | Sky `#243054` / Ground `#181A26` |
| **Hujan / Mendung** | `#6F859E` | `#9BB0C4` | `#B8C7D6` (redup merata) | Sky `#8AA0B8` / Ground `#566370` |

### D. Aksen UI & HUD
- **Health / Bar Sekunder**: Biru `#4B96E8` (track `#2E4D6B`), Hijau Stamina `#56C25E` (track `#2E5D38`).
- **Tombol Aksi Utama**: Koral Merah `#EC7C70` dengan cincin tepi putih tebal `#FFFFFF`.
- **Panel & Chat Transparan**: Latar kaca lembut `rgba(255, 255, 255, 0.42)` atau gelap-lembut kontras tinggi dengan teks putih/gelap tegas; ikon status berbingkai krem `#F5EFE0` dan latar pastel (`#F39A68`, `#7BC4EB`, `#F7D166`, `#86C76D`).

---

## 2. Bahasa Bentuk (Shape Language)

- **Gaya Utama**: *Stylized Low-Poly Diorama* dengan proporsi **chunky (kokoh & membulat halus)** — bukan blok kotak tipis yang kaku, namun tidak terlalu detail realistis.
- **Ketebalan & Pinggiran (Bevel / Trim)**:
  - Dinding bangunan selalu memiliki **ketebalan terukur** (`0.25–0.35 m`), disertai **plint dasar (`0.3–0.5 m`)** dan **list atap / lisplang** menonjol keluar (`0.3–0.5 m` *overhang*).
  - Teras, tangga depan (`2–3 anak tangga`), pilar berpondasi batu, dan bingkai jendela menonjol keluar (`extruded`) dari bidang dinding agar muncul siluet dan bayangan mikro yang jelas.
- **Bentuk & Kemiringan Atap**:
  - Mayoritas bangunan memakai **atap pelana (gable)** atau **atap limasan/perisai (hipped)** dengan kemiringan sedang **25°–35°**, serta tekstur undakan/garis genteng vertikal-horizontal sederhana (prosedural via blok/strip bertingkat tanpa tekstur berat).
  - Bangunan komersial modern (Minimarket, Klinik) memakai **atap datar berparapet tebal** (`parapet 0.4–0.6 m`) dengan kanopi depan menjorok.
  - Kantor Desa memakai **atap Joglo/Limasan bertingkat dua**.
- **Vegetasi & Batuan**:
  - Pohon rimbun disusun dari **2–4 gumpalan polyhedron (`icosahedron` / `dodecahedron` detail 0–1)** bertumpuk di atas batang silinder bercabang Y/miring.
  - Pohon palem/pisang menggunakan batang bersegmen melengkung dan 5–7 bilah daun melengkung ke bawah.

---

## 3. Pencahayaan & Bayangan

- **Arah Cahaya Utama**: Sudut isometrik 3/4 dari **depan-kiri-atas** (sekitar azimuth `-40°` hingga `-55°`, elevasi `45°–55°` saat siang; `20°–28°` saat pagi/sore) sehingga sisi depan bangunan terang hangat dan sisi kanan memiliki kontras bayangan lembut.
- **Gaya Shading**: **Soft Faceted Low-Poly** (`flatShading: true` pada kanopi pohon/batu/bukit, dan *smooth/beveled* dengan `roughness` tinggi `0.78–0.92` pada plester dinding & tanah agar cahaya menyebar halus seperti tanah liat/miniatur, tanpa kilap plastik berlebihan kecuali kaca/logam/air).
- **Kekuatan Ambient**: `HemisphereLight` intensitas sedang-tinggi (`0.65–0.85` siang; `0.35` malam) agar bayangan **tidak pernah hitam pekat**.
- **Warna Bayangan**: Bayangan berwarna **dingin keunguan/biru-abu lembut** (`#4E5B75` di siang/hujan, `#3F324D` di sore, `#141A2E` di malam), bukan hitam murni.
- **Titik Cahaya Malam (`isNight` & Hujan)**: Lampu jalan, lampion warung, jendela stasiun, lampu teras kos, dan lampu pilar gerbang memancarkan **cahaya kuning-amber hangat** (`#FFAE34`).

---

## 4. Karakter & Proporsi

- **Proporsi Kepala-Badan**: Gaya *stylized chibi-semi-proporsional* sekitar **4,5 hingga 5 kepala tinggi total** (kepala agak besar untuk keterbacaan kamera isometrik/third-person, namun tubuh tetap berproporsi manusiawi, bukan bulat seperti kacang).
- **Tangan & Kaki**: Tangan proporsional dengan siluet telapak & jari sederhana menyatu (atau 4–5 jari chunky pada tampilan dekat); kaki lurus bersepatu sneaker chunky atau sandal bertali.
- **Gaya Wajah**: Wajah ramah bersih dengan mata besar berpupil cokelat/hitam + pantulan putih kecil (`catchlight`), alis tegas melengkung, hidung kecil menonjol halus, dan senyum tipis (beberapa variasi kustomisasi tanpa fitur wajah rumit agar tetap ringan).
- **Tinggi Relatif**:
  - Karakter dewasa: **~1.70 m** (karakter anak SD: **~1.30 m**).
  - Tinggi pintu bangunan: **2.10 – 2.20 m** (karakter terlihat proporsional masuk melalui pintu, dengan ruang ±0.4–0.5 m di atas kepala).
  - Bagian yang dapat diwarnai terpisah untuk kustomisasi Fase 1: **Kulit (6 nada), Rambut / Hijab (8 gaya), Baju / Atasan, Celana / Rok / Sarung, Sepatu**.

---

## 5. Skala Relatif Dunia (1 Unit = 1 Meter)

| Objek | Dimensi Acuan (L × P × T dalam meter) | Keterangan Skala |
| :--- | :--- | :--- |
| Karakter Dewasa | `0.6 × 0.4 × 1.7` | Basis acuan seluruh proporsi |
| Anak Sekolah (NPC) | `0.5 × 0.35 × 1.3` | ~76% tinggi dewasa |
| Pintu Standar | `1.0 × 0.15 × 2.15` | 1.25× tinggi karakter |
| Sepeda Motor / Ojol | `0.8 × 1.9 × 1.15` | Setinggi pinggang–dada karakter |
| Becak | `1.1 × 2.1 × 1.6` | Kanopi sejajar bahu–kepala |
| Angkot / Mobil / Ambulans | `1.8–2.0 × 4.0–4.6 × 1.9–2.2` | Sedikit lebih tinggi dari karakter |
| Truk Box / Bak | `2.1 × 4.8 × 2.6` | Tinggi kabin/box ~1.5× karakter |
| Gerbong Kereta (per unit) | `2.8 × 13.5 × 3.7` | 3 rangkaian total ~41 m |
| Rumah Kampung / 1 Unit Kos | `5–6 × 5–6 × 4.2` | Puncak atap ~2.5× karakter |
| Rumah 2 Lantai Modern | `8 × 9 × 6.8` | 2 lantai + carport |
| Warung / Minimarket / Klinik | `7–11 × 6–8 × 4.0–4.8` | Bangunan komersial 1 lantai |
| Stasiun Cicalengka | `22 × 9 × 7.5` | Bangunan kolonial tinggi + peron 28 m |
| Masjid Agung | `16 × 16 × 12.5` (menara `16 m`) | Landmark vertikal kedua setelah gunung |
| Pabrik Industri | `24 × 18 × 8.5` (cerobong `15 m`) | Kompleks industri terbesar |
| Pohon Kampung / Rimbun | Tinggi `4.5 – 7.5 m` | Pohon Beringin Alun-Alun `11–13 m` |
| Lebar Jalan Utama | `9 – 10 m` (2 lajur + bahu/trotoar) | Jalan sekunder `5.5 – 7 m` |

---

## 6. Tata Letak Kota (`kota_overview` & `peta_jalan`)

Berdasarkan `Peta_Kota_Tropis_dengan_Masjid_dan_Stasiun` dan `Diorama_Kota_Indonesia`:

1. **Sisi Utara (`z ≈ -55` s/d `-70`)**:
   - **Perbukitan Hijau & Hutan Utara** sebagai latar belakang alami (menghindari *void*) dengan menara air di barat-laut stasiun.
   - **Rel Kereta Ganda** membentang lurus **Barat–Timur** sepanjang peta.
   - **Stasiun Cicalengka** berada di sisi utara rel (menghadap selatan ke arah rel & kota), dengan **JPO (Jembatan Penyeberangan Orang)** dan **Perlintasan Sebidang berpalang pintu** di sisi kanan/timur stasiun (atau jembatan kiri sesuai `peta_jalan`, kita sinkronkan dengan jalan akses utama tanpa mengganggu lintasan kereta).
   - **Kompleks Pabrik** di sudut **Timur Laut** (utara rel/timur stasiun) dengan 2 cerobong merah-putih.
2. **Poros Tengah (`z ≈ -35` s/d `+10`)**:
   - **Jalan Raya Utama Barat–Timur** sejajar di selatan rel kereta, lengkap dengan zebra cross dan trotoar.
   - **Alun-Alun Cicalengka** tepat di pusat (`0, 0`), ditandai **Pohon Beringin raksasa** di bundaran tengah, pendopo/gazebo, dan lapak tenda PKL di tepi jalan.
   - **Masjid Agung** tepat di sebelah **Timur Alun-Alun**, menghadap ke barat/alun-alun.
   - **Pasar Tradisional** di blok **Barat** sejajar dengan Alun-Alun (atau terhubung langsung di poros komersial agar jarak interaksi Fase 1–6 tetap nyaman).
   - **Sawah Terasering & Saung** di sisi **Timur** (serta tepi barat luar perumahan), lengkap dengan saluran irigasi biru.
   - **Kantor Desa, Puskesmas/Klinik, Bank, Polsek, Balai Lelang, Minimarket, Warung** berada sepanjang koridor jalan utama barat–tengah–timur sehingga tetap sinkron dengan titik interaksi & database Fase 1–6.
3. **Sisi Selatan (`z ≈ +15` s/d `+65`)**:
   - **Deretan Ruko 2 Lantai** menghadap jalan tengah selatan.
   - **Kawasan Perumahan (Kontrakan, Kos Pastel, Rumah Kampung, Rumah 2 Lantai, Kavling Konstruksi)** tersusun dalam blok jalan melingkar dengan pagar kayu/bambu, pepohonan, serta **Kolam / Empang** di sudut tenggara dan **Sekolah** di zona barat daya.
4. **Latar Perimeter Luar**:
   - Perbukitan hijau berlapis di seluruh batas peta serta siluet **Gunung (Kareumbi/Malabar)** di kejauhan untuk menutup horizon.

---

## 7. Daftar Komponen Unik per Bangunan

| ID Aset | Nama Bangunan | Komponen Unik Wajib (dari Referensi) |
| :--- | :--- | :--- |
| `building_station` | Stasiun Cicalengka | Plint batu, dinding krem berpilaster, 2 sayap atap limasan + tengah pelana bertopi jam bulat, kusen & krepyak hijau tua, kanopi peron seng abu bertiang besi hijau-slate, lampu gantung peron, bangku kayu, garis kuning tepi peron, 2 jalur rel berbalas kerikil |
| `building_pasar` | Pasar Tradisional | Lantai paving, los utama atap kayu-terakota + lampu gantung bohlam, jajaran tenda rangka kayu berkanopi biru/merah/kuning/belang, meja peti buah-sayur, keranjang anyaman, karung, gantungan bawang/cabai |
| `building_warung` | Warung Makan | Pondasi ubin teras, rangka kayu terbuka, atap genteng pelana + kanopi seng miring, spanduk kain krem-merah, etalase kaca miring berisi lauk, meja saji (ceret + rice cooker), kulkas minuman biru, meja kayu + bangku plastik merah/biru, tempat sampah hijau |
| `building_minimarket` | Minimarket | Bangunan kotak atap datar, pita fasad & papan kosong 3-warna (merah-putih-biru), tiang pylon sign kosong (teks terpisah), kaca etalase depan penuh menampilkan rak warna-warni, unit AC luar, 3 tong sampah pilah (merah-kuning-biru), parkiran motor bergaris kuning |
| `building_kos` | Deretan Kos / Kontrakan | 3 unit gandeng atap pelana genteng terakota menerus, dinding pastel berbeda tiap pintu (mint/pink/kuning), sekat teras pendek, pintu kayu + jendela 4 kotak, lampu teras, jemuran besi berisikan baju gantung, tong air biru & pagar bambu di samping |
| `building_rumah_kampung` | Rumah Kampung | Atap limasan/joglo terakota, dinding krem dengan plint abu, teras kayu beranak tangga, lampu lampion bulat, jendela krepyak terbuka ke atas, pagar bambu keliling, kandang ayam bambu + ayam, gentong air tanah liat, pohon pisang |
| `building_rumah_modern` | Rumah 2 Lantai | Massa 2 lantai dengan balkon atas berpagar besi gelap, atap limasan terakota, pilar aksen batu abu-abu, unit AC dinding, kanopi carport datar abu gelap, pagar tembok berjeruji horizontal dengan lampu pilar hangat |
| `building_clinic` | Klinik / Puskesmas | Atap datar berlis hijau medis, kanopi masuk bertiang hijau-krem, simbol palang merah tebal di fasad & papan depan, pintu kaca geser, kursi tunggu biru di teras, ramp/tangga berpegangan besi, pagar rendah berkolom hijau |
| `building_kantor_desa` | Kantor Desa | Atap limasan/joglo 2 tingkat terakota, pendopo depan terbuka berkolom krem-batu, papan pengumuman beratap genteng, tiang bendera Merah Putih berundak, meja & bangku kayu teras, pagar tembok pendek |
| `building_masjid` | Masjid Agung | Kubah besar hijau berbulan-sabit emas, menara tinggi di kanan dengan balkon & kubah kecil, serambi berpelengkung lengkung lancip (arch), jendela lancip berbingkai kayu, halaman berpagar dengan gerbang lengkung, gazebo/bale kayu beratap hijau, kolam wudhu segi delapan di tengah |
| `building_sekolah` | Sekolah | Massa bentuk L 1 lantai, dinding krem dengan bagian bawah merah bata SD, teras koridor berkolom, tiang bendera Merah Putih di tengah lapangan bergaris lapangan, pagar tembok merah-krem bergerbang beratap genteng, papan pengumuman, ayunan & perosotan warna-warni |
| `building_pabrik` | Pabrik | Gudang besar + kantor 2 lantai beratap seng gelombang biru, 2 pintu loading dock dengan kanopi biru, cerobong asap tinggi belang merah-putih berawan asap low-poly, tangki air menara, pos satpam, tempat parkir sepeda beratap biru, pagar tembok + gerbang besi geser |
| `building_construction` | Konstruksi 4 Tahap | (1) Pondasi & kolom beton + tumpukan bata/pasir/batako; (2) Dinding bata oranye setengah jadi; (3) Rangka atap kuda-kuda kayu + perancah kayu keliling; (4) Rumah plester selesai |
| `prop_jpo` | Jembatan Penyeberangan | Struktur rangka baja abu-abu bertangga ganda di kedua sisi rel/jalan utama |
| `prop_alun_beringin` | Beringin & Pendopo Alun-Alun | Pohon beringin besar berakar gantung di atas bak tanaman bundar + pendopo kayu terbuka beratap genteng |

---

## 8. Catatan Asumsi Visual (Untuk Objek Tanpa Gambar Terpisah)

Sesuai aturan agar tidak mengarang gaya di luar referensi, objek yang tidak memiliki gambar khusus tersendiri menggunakan komponen dan palet dari gambar sejenis yang paling sederhana:

1. **Bank Priangan Cicalengka (`building_bank`)**: Menggunakan bahasa bentuk bangunan layanan modern 1 lantai yang sama dengan `building_clinic` (atap datar berparapet, kanopi masuk berpilar, kaca depan besar, parkiran depan), dengan mengganti warna aksen trim hijau menjadi **biru korporat (`#1F75DB`) & aksen emas tipis (`#F2BC2E`)** sesuai standar bangunan keuangan di dunia low-poly ini, ditambah bilik ATM di sisi teras.
2. **Polsek Cicalengka (`building_polsek`)**: Menggunakan bahasa bentuk bangunan dinas 1 lantai seperti `building_kantor_desa` / `building_clinic` (teras depan berkolom, tiang bendera Merah Putih, papan pengumuman), dengan dinding krem `#F5EBD8` dan aksen **cokelat-khaki kepolisian (`#7A6B5D` / `#4A3C31`)** mengikuti seragam polisi pada gambar `Indonesian_NPC_characters_lineup`.
3. **Kantor Agen Properti & Balai Lelang**: Menggunakan modul ruko 2 lantai / bangunan komersial dari `kota_overview` (dinding krem/pastel, atap genteng terakota `#E06B3B`, kanopi kain depan, etalase kaca).
4. **Pasar Malam (`atmosphere_pasar_malam`)**: Menggabungkan suasana langit malam dari `Low-poly_Indonesian_train_station` (panel Malam `#161E38`, lampu hangat `#FFBE55`) dengan tenda warna-warni dan bohlam gantung dari `Diorama_Pasar_Tradisional`.
5. **Banjir (`atmosphere_flood`)**: Menggunakan material air genangan reflektif dari `People_walking_in_heavy_rain` (`#6486A6`, opacity ~0.72, roughness ~0.12) sebagai bidang air datar yang naik perlahan di zona rendah saat curah hujan tinggi.
