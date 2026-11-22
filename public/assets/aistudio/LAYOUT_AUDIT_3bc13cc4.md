# LAYOUT AUDIT (Langkah 1, hanya membaca)

Total: **58 ERROR**, 5 WARN dari 46 bangunan/properti, 48 pohon+pagar.

## Ringkasan per jenis

| Pelanggaran | Jumlah |
|---|---|
| Bangunan menimpa jalan | 26 |
| Bangunan tumpang tindih | 11 |
| Pohon di atas jalan | 10 |
| Pohon di dalam bangunan/kavling | 4 |
| Pohon di dalam kavling tanah | 4 |
| Pohon di trotoar | 3 |
| Bangunan di dalam alun-alun (harus bebas objek solid) | 2 |
| Bangunan jauh dari jalan (>10 m, akses jalan tidak jelas) | 2 |
| Bangunan menimpa rel | 1 |

## Detail

### Bangunan menimpa jalan

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| warung | jalan_raya | (-22, -12) | 18.5 | CicalengkaWorld |
| minimarket | jalan_raya | (22, -11) | 11.3 | CicalengkaWorld |
| pasar | jalan_raya | (42, -10) | 88.3 | CicalengkaWorld |
| pasar | jalan_perumahan_timur | (42, -10) | 69.6 | CicalengkaWorld |
| pos_kurir | jalan_stasiun_kos | (-10, -28) | 20.8 | CicalengkaWorld |
| puskesmas | jalan_barat | (-44, -28) | 8.4 | CicalengkaWorld |
| puskesmas | jalan_stasiun_kos | (-44, -28) | 7.2 | CicalengkaWorld |
| klinik_swasta | jalan_barat | (-44, 4) | 7 | CicalengkaWorld |
| kontrakan_1 | jalan_barat | (-36, 24) | 26.3 | CicalengkaWorld |
| kantor_desa | jalan_raya | (-28, -24) | 39.4 | Phase4Buildings3D |
| kantor_desa | jalan_barat | (-28, -24) | 10.9 | Phase4Buildings3D |
| kantor_desa | jalan_stasiun_kos | (-28, -24) | 13.3 | Phase4Buildings3D |
| pasar_grosir | jalan_raya | (52, -20) | 91.2 | Phase4Buildings3D |
| balai_lelang | jalan_raya | (16, -22) | 51 | Phase4Buildings3D |
| toko_mebel | jalan_stasiun_kos | (24, -28) | 39 | PropertyBuildings3D |
| polsek | jalan_alun_utara_selatan | (-10, 11.8) | 3.9 | Phase6Buildings3D |
| atm_pasar | jalan_raya | (46, -16) | 2.9 | Phase4Buildings3D |
| prop_kos_stasiun_1 | jalan_stasiun_kos | (-18, -36) | 1.8 | worldConstants(properti) |
| prop_kos_stasiun_2 | jalan_stasiun_kos | (18, -36) | 1.8 | worldConstants(properti) |
| prop_kos_stasiun_3 | jalan_stasiun_kos | (32, -34) | 15.8 | worldConstants(properti) |
| prop_kos_pasar_1 | jalan_stasiun_kos | (58, -28) | 29.8 | worldConstants(properti) |
| prop_apt_raya_1 | jalan_stasiun_kos | (-30, -36) | 6 | worldConstants(properti) |
| prop_ruko_pasar_2 | jalan_perumahan_timur | (54, 10) | 4.5 | worldConstants(properti) |
| prop_lapak_pasar_1 | jalan_raya | (38, -20) | 36 | worldConstants(properti) |
| prop_lapak_pasar_2 | jalan_raya | (46, -20) | 36 | worldConstants(properti) |
| prop_lapak_pasar_3 | jalan_stasiun_kos | (38, -28) | 22.5 | worldConstants(properti) |

### Bangunan di dalam alun-alun (harus bebas objek solid)

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| polsek | alun_alun | (-10, 11.8) | 32 | Phase6Buildings3D |
| kantor_agen | alun_alun | (10, 12) | 7.3 | Phase6Buildings3D |

### Bangunan menimpa rel

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| stasiun | rel_ganda | (0, -54.6) | 14 | CicalengkaWorld |

### Bangunan tumpang tindih

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| pasar | pasar_grosir | (42, -10) vs (52, -20) | 12.3 | CicalengkaWorld / Phase4Buildings3D |
| pasar | atm_pasar | (42, -10) vs (46, -16) | 2.9 | CicalengkaWorld / Phase4Buildings3D |
| pasar | prop_lapak_pasar_1 | (42, -10) vs (38, -20) | 3.6 | CicalengkaWorld / worldConstants(properti) |
| pasar | prop_lapak_pasar_2 | (42, -10) vs (46, -20) | 3.6 | CicalengkaWorld / worldConstants(properti) |
| sekolah | kontrakan_1 | (-46, 22) vs (-36, 24) | 4.7 | CicalengkaWorld / CicalengkaWorld |
| pasar_grosir | atm_pasar | (52, -20) vs (46, -16) | 1.3 | Phase4Buildings3D / Phase4Buildings3D |
| pasar_grosir | prop_kos_pasar_1 | (52, -20) vs (58, -28) | 0.4 | Phase4Buildings3D / worldConstants(properti) |
| pasar_grosir | prop_lapak_pasar_2 | (52, -20) vs (46, -20) | 18 | Phase4Buildings3D / worldConstants(properti) |
| balai_lelang | toko_mebel | (16, -22) vs (24, -28) | 2.5 | Phase4Buildings3D / PropertyBuildings3D |
| toko_mebel | prop_kos_stasiun_3 | (24, -28) vs (32, -34) | 0.2 | PropertyBuildings3D / worldConstants(properti) |
| prop_kos_stasiun_3 | prop_lapak_pasar_3 | (32, -34) vs (38, -28) | 0.3 | worldConstants(properti) / worldConstants(properti) |

### Pohon di dalam bangunan/kavling

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| pohon_2 | polsek | (-12, 10) | 2.6 | InstancedProps |
| pohon_3 | kantor_agen | (12, 10) | 2.6 | InstancedProps |
| pohon_7 | pasar_grosir | (54, -24) | 2.2 | InstancedProps |
| pohon_7 | prop_kos_pasar_1 | (54, -24) | 0.1 | InstancedProps |

### Pohon di atas jalan

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| pohon_4 | jalan_raya | (-38, -16) | 2.6 | InstancedProps |
| pohon_4 | jalan_barat | (-38, -16) | 2.6 | InstancedProps |
| pohon_5 | jalan_raya | (-45, -16) | 2.6 | InstancedProps |
| pohon_12 | jalan_kampung_selatan | (-46, 33) | 2.1 | InstancedProps |
| pohon_13 | jalan_kampung_selatan | (-28, 33) | 2.1 | InstancedProps |
| pohon_14 | jalan_kampung_selatan | (-10, 33) | 2.1 | InstancedProps |
| pohon_15 | jalan_kampung_selatan | (8, 33) | 2.1 | InstancedProps |
| pohon_16 | jalan_kampung_selatan | (26, 33) | 2.1 | InstancedProps |
| pohon_17 | jalan_perumahan_timur | (44, 24) | 1.3 | InstancedProps |
| pohon_24 | jalan_perumahan_timur | (48, 56) | 2.6 | InstancedProps |

### Pohon di trotoar

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| pohon_6 | trotoar_raya | (30, -24) | 1.9 | InstancedProps |
| pohon_7 | trotoar_raya | (54, -24) | 1.9 | InstancedProps |
| pohon_20 | trotoar_raya | (-62, -24) | 1.9 | InstancedProps |

### Pohon di dalam kavling tanah

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| pohon_18 | plot_pasar_1 | (58, -2) | 2.6 | InstancedProps |
| pohon_22 | plot_kampung_2 | (-50, 54) | 0.1 | InstancedProps |
| palem_7 | plot_kampung_3 | (-24, 62) | 0.5 | InstancedProps |
| palem_8 | plot_perumahan_1 | (18, 62) | 1 | InstancedProps |

### Bangunan jauh dari jalan (>10 m, akses jalan tidak jelas)

| Objek | Bertabrakan dengan | Posisi | Luas (m²) | Sumber kode |
|---|---|---|---|---|
| stasiun | jalan_terdekat | (0, -54.6) jarak 18.0 m | - | CicalengkaWorld |
| prop_apt_timur_2 | jalan_terdekat | (24, 6) jarak 15.0 m | - | worldConstants(properti) |

## Yang BELUM diperiksa
- Collider Rapier vs model visual (collider ditulis manual per komponen)
- Konektivitas A* dari spawn ke semua pintu (butuh data pintu masuk)
- Ukuran kantor_agen adalah perkiraan; JPO, menara air, sawah, dan empang tidak dimasukkan
- Hanya skema peta saat ini; data Firestore asli tidak dibaca
