# Audit Interaksi Lokasi & Modal — Cicalengka Life 3D

Dokumen ini merupakan hasil audit **Langkah 1** terhadap seluruh tombol menu HUD (`client/src/ui/GameHUD.tsx`), pemicu `ActionButton` berbasis kedekatan (`client/src/world3d/LocalPlayer.tsx`, `client/src/App.tsx`), banner/cross-modal trigger (`client/src/App.tsx`, modal terkait), serta validasi jarak pada server (`functions/src/handlers/*.ts`, `functions/src/helpers/*.ts`).

> **Status:** Tahap Audit (belum ada perubahan kode). Menunggu konfirmasi keputusan Golongan A / B / C sebelum masuk ke Langkah 2.

---

## Ringkasan Temuan Utama

1. **Menu HUD golongan lokasi langsung membuka modal dari mana saja (`client/src/App.tsx:2171–2206`)**
   - Tombol `Kerja`, `Klinik`, `Kursus`, `Kereta`, `Bank`, `Bisnis`, `Lelang`, `Pasar P2P`, `Polsek / Hukum`, `Agen / Dev`, `Lahan / Bangun`, `KPR / Asuransi`, `Misi`, dan `Peta` (Properti) langsung memanggil `set*Open(true)` tanpa memeriksa apakah pemain berada di lokasi yang benar.
   - Akibatnya, pemain baru tahu aksinya ditolak server setelah membuka modal dan menekan tombol aksi (misal di `JobsModal`, `ClinicModal`, `CourseModal`, `BusinessModal`, `LandConstructionModal`, `MortgageSecurityModal`, `AgentDeveloperModal`).

2. **Inkonsistensi radius klien vs server**
   - Konstanta dasar `INTERACT_RADIUS_METERS = 9.5` m (`client/src/world3d/worldConstants.ts` & `functions/src/helpers/validation.ts`), tetapi:
     - Di klien (`LocalPlayer.tsx`), radius bervariasi secara ad-hoc: ATM `4.2 m`, NPC `3.8 m`, Bank `10.0 m`, Balai Lelang `9.0 m`, Penampungan `10.5 m`, Emperan `8.0 m`, Stasiun `11.0 m`, Pasar `11.5 m`, Properti `max(w,d)/2 + 4.8 m`, Lahan `max(w,d)/2 + 4.5 m`.
     - Di `App.tsx`, `nearBank`/`nearAtm` dan `nearKantorDesa` memakai `INTERACT_RADIUS_METERS + 1.5 = 11.0 m`, sedangkan `AgentDeveloperModal` mengecek `tokoMebel` `<= 13 m`.
     - Di server, toleransi juga berbeda-beda: `9.5 m` (warung/rest/bath), `10.5 m` (ATM), `11.5 m` (klinik/shelter/emperan), `12.0 m` (bank/NPC), `12.5 m` (kursus/toko mebel), `13.0 m` (bisnis/grosir/kantor desa/survei properti), `13.5 m` (mulai shift/masuk properti/set mebel), `14.0–16.0 m` (stasiun/KPR/lahan/IMB/kantor agen).
   - Selain itu, banyak koordinat pemeriksaan jarak memakai **pusat bangunan (`position`)**, bukan **titik pintu (`door`)** yang tercatat di `client/src/world3d/layout/cicalengka.layout.json`.

3. **Handler server dengan `0` validasi jarak atau memakai posisi stale**
   - Beberapa handler yang seharusnya berbasis lokasi fisik justru belum memvalidasi jarak di server (antara lain `auctions.ts`, `jobs.ts:applyJob`, `marketplace.ts`, `security.ts`, sebagian besar aksi manajemen di `business.ts`, `landConstruction.ts`, `agentRenovation.ts`, dan `law.ts`).
   - Handler `npcDialog.ts`, `quests.ts`, dan `law.ts` membaca `charData.lastPosition` di Firestore alih-alih posisi RTDB terbaru via `getPlayerWorldPos(rtdb, uid, charData)` sehingga rawan tidak sinkron dengan posisi 3D pemain saat ini.

---

## Referensi Koordinat Lokasi Utama (`worldConstants.ts` & `cicalengka.layout.json`)

> Pada implementasi Langkah 2, semua koordinat wajib dibaca langsung dari `worldConstants.ts` / `cicalengka.layout.json` (bukan disalin manual), dengan **titik tiba (`arrival point`) di koordinat `door`** bila tersedia.

| ID Lokasi | Label | Pusat Bangunan `(x, z)` | Titik Pintu / Tiba `(x, z)` | Sumber Konstanta |
| :--- | :--- | :---: | :---: | :--- |
| `warung` | Warung Nasi Teh Nining | `(-30, -22)` | `(-30, -18.0)` | `WARUNG_POS` / `lots.warung` |
| `puskesmas` | Puskesmas Cicalengka | `(-48, -22)` | `(-48, -17.0)` | `PUSKESMAS_POS` / `lots.puskesmas` |
| `klinik_swasta` | Klinik Sehat Pratama | `(-46, 26)` | `(-46, 21.5)` | `KLINIK_SWASTA_POS` / `lots.klinik_swasta` |
| `sekolah` | Balai Latihan & Sekolah | `(-48, 38)` | `(-48, 43.2)` | `SCHOOL_POS` / `lots.sekolah` |
| `stasiun` | Stasiun Cicalengka | `(0, -56)` | `(0, -49.5)` | `STATIONS.cicalengka` / `lots.stasiun` |
| `loket_tiket` | Loket Stasiun Cicalengka | `(8, -48)` | `(8, -46.0)` | `TICKET_BOOTH_POS.cicalengka` / `props` |
| `bank` | Bank Priangan Cicalengka | `(-46, 2)` | `(-46, -3.2)` | `BANK_POS` / `lots.bank` |
| `atm_stasiun` | ATM Stasiun | `(-8, -48)` | `(-8, -46.4)` | `ATM_POSITIONS[0]` / `props` |
| `atm_alun` | ATM Alun-Alun | `(26, 10)` | `(24.2, 10.0)` | `ATM_POSITIONS[1]` / `props` |
| `atm_pasar` | ATM Pasar Baru | `(50, 12)` | `(50, 13.6)` | `ATM_POSITIONS[2]` / `props` |
| `kantor_desa` | Kantor Desa & Koperasi | `(-30, 4)` | `(-24.5, 4.0)` | `KANTOR_DESA_POS` / `lots.kantor_desa` |
| `pasar_grosir` | Pasar Grosir Induk | `(46, -22)` | `(46, -16.8)` | `PASAR_GROSIR_POS` / `lots.pasar_grosir` |
| `balai_lelang` | Balai Lelang Kota | `(6, -22)` | `(6, -17.8)` | `BALAI_LELANG_POS` / `lots.balai_lelang` |
| `toko_mebel` | Toko Mebel Jaya | `(-6, -22)` | `(-6, -18.0)` | `TOKO_MEBEL_POS` / `lots.toko_mebel` |
| `polsek` | Polsek Cicalengka | `(-6, 26)` | `(-6, 22.0)` | `POLSEK_POS` / `lots.polsek` |
| `kantor_agen` | Kantor Agen Properti | `(6, 26)` | `(6, 22.0)` | `AGENT_OFFICE_POS` / `lots.kantor_agen` |
| `penampungan` | Balai Penampungan Warga | `(-70, -2)` | `(-65.5, -2.0)` | `PENAMPUNGAN_POS` / `lots.penampungan` |
| `emperan_stasiun` | Bangku Emperan Stasiun | `(-18, -48)` | `(-18, -45.8)` | `EMPERAN_SPOTS[0]` / `props` |
| `emperan_pasar` | Teras Emperan Pasar | `(40, 14)` | `(40, 15.8)` | `EMPERAN_SPOTS[1]` / `props` |
| `bath_mck` | MCK / Pemandian Umum | `(32, 10)` | `(32, 13.0)` | `BATH_POS` / `lots.bath_mck` |
| `minimarket` | Minimarket Cicalengka (`kasir_minimarket`) | `(30, -22)` | `(30, -17.2)` | `JOB_LOCATIONS` / `lots.minimarket` |
| `pasar` | Pasar Baru Cicalengka (`pedagang_pasar`) | `(46, 4)` | `(46, -3.2)` | `JOB_LOCATIONS` / `lots.pasar` |
| `pos_kurir` | Pos Kurir (`kurir`) | `(0, -30)` | `(0, -33.8)` | `JOB_LOCATIONS` / `lots.pos_kurir` |
| `stasiun_*` (Rancaekek/Bandung/Nagreg) | Loket & Peron Tujuan | `(0, -42)` / `(0, -36)` | `(0, -42)` | `TICKET_BOOTH_POS` / `STATIONS` |
| `kontrakan_1..5` | Kontrakan Warga (istirahat/MCK NPC) | `KONTRAKAN_POSITIONS` | sama | `worldConstants.ts` / `lots` |
| `landPlots` (8 bidang) | 8 Lahan Konstruksi (`plot_*`) | `LAND_PLOTS` | `position` | `worldConstants.ts` / `lots` |
| `properties` (18 unit) | 18 Properti Hunian & Komersial | `PROPERTIES` | `door` / `position` | `cicalengka.layout.json` |

---

## Golongan A — WAJIB di Lokasi

Seluruh menu, `ActionButton`, banner, dan modal di golongan ini mengubah status fisik, pekerjaan, inventori, layanan tatap muka, atau transaksi uang langsung di lokasi. **Tidak boleh dibuka dari jauh.**

| menu / pemicu | modal | apakah butuh lokasi? | lokasi yang benar (id + posisi) | radius server | validasi server (`file:fungsi`) | bisa dibuka dari mana saja? |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| `ActionButton` (`warung`) | `WarungModal` | Ya | `warung` `(-30, -22)`, pintu `(-30, -18.0)` | `9.5 m` (`INTERACT_RADIUS_METERS`) | `buyFood.ts:buyFood` | Tidak |
| HUD `Klinik` (`onOpenClinic`) + Banner `Klinik` + `ActionButton` (`clinic`) | `ClinicModal` | Ya (untuk daftar berobat; **kecuali** tombol *Klaim Hasil* / status perawatan aktif di banner) | `puskesmas` `(-48, -22)` pintu `(-48, -17.0)` **ATAU** `klinik_swasta` `(-46, 26)` pintu `(-46, 21.5)` | `11.5 m` (`9.5 + 2`) | `wellness.ts:visitClinic` *(cek jarak)*; `wellness.ts:claimClinic` *(tanpa cek jarak — klaim saat selesai)* | Tidak *(saat daftar)* / Banner klaim aktif boleh selesai |
| HUD `Kursus` (`onOpenCourses`) + Banner `Kursus` + `ActionButton` (`school`) | `CourseModal` | Ya (untuk daftar kursus; **kecuali** *Klaim Sertifikat* saat durasi belajar selesai) | `sekolah` `(-48, 38)`, pintu `(-48, 43.2)` | `12.5 m` (`9.5 + 3`) | `courses.ts:enrollCourse` *(cek jarak)*; `courses.ts:claimCourse` *(tanpa cek jarak)* | Tidak *(saat daftar)* / Banner klaim aktif boleh selesai |
| HUD `Kereta` (`onOpenTrain`) + `ActionButton` (`station`) + `TrainModal` trip overlay | `TrainModal` | Ya (untuk beli tiket; overlay perjalanan aktif otomatis tampil selama `activeTrip`) | Stasiun zona aktif: `cicalengka` (`loket_tiket` `(8, -48)` / peron `(0, -46)` / `stasiun` `(0, -56)` pintu `(0, -49.5)`) atau `loket` zona `rancaekek`/`bandung`/`nagreg` `(0, -42)` | `14.5 m` (`9.5 + 5`) | `train.ts:buyTicket` *(cek jarak loket/peron zona)*; `train.ts:completeTrip` *(tanpa cek jarak)* | Tidak *(untuk beli tiket)*; overlay perjalanan aktif otomatis |
| HUD `Bank` (`onOpenBank`) + `ActionButton` (`bank` / `atm`) | `BankModal` | Ya | Mode Bank lengkap (buka rekening/pinjaman): `bank` `(-46, 2)` pintu `(-46, -3.2)`. Mode ATM (setor/tarik): `bank` **ATAU** `atm_stasiun` `(-8, -48)`, `atm_alun` `(26, 10)`, `atm_pasar` `(50, 12)` | Bank: `12 m`; ATM: `10.5 m` | `bank.ts` + `helpers/bank.ts:assertNearBankOrAtm` (`openAccount`, `applyLoan`, `deposit`, `withdraw`). **Catatan:** `transfer`, `repayLoan`, `getAccountSummary` = **0 cek jarak** | Tidak |
| `ActionButton` (`pasar_grosir`) + cross-link di `BusinessModal` | `WholesaleMarketModal` | Ya | `pasar_grosir` `(46, -22)`, pintu `(46, -16.8)` **ATAU** posisi bisnis milik pemain *(diizinkan server)* | `13 m` (`9.5 + 3.5`) | `business.ts:buyStock` | Tidak |
| HUD `Lelang` (`onOpenAuction`) + `ActionButton` (`balai_lelang`) | `AuctionModal` | Ya | `balai_lelang` `(6, -22)`, pintu `(6, -17.8)` | **Saat ini 0 cek** *(rekomendasi samakan `9.5 m` / `12 m`)* | `auctions.ts:createAuction`, `placeBid`, `settleAuction` *(semua **0 cek jarak**!)* | Tidak *(wajib gerbang lokasi di klien + tambah cek di server)* |
| HUD `Bisnis` saat belum punya bisnis / `ActionButton` (`kantor_desa`) | `BusinessModal` (`view: 'create'`) | Ya | `kantor_desa` `(-30, 4)`, pintu `(-24.5, 4.0)` **ATAU** lokasi properti komersial milik pemain | `13 m` (`9.5 + 3.5`) | `business.ts:createBusiness` | Tidak |
| HUD `Bisnis` saat sudah punya bisnis / `ActionButton` (`biz_manage`, `biz_craft`) / Banner Toko (`Kelola`) | `BusinessModal` (`view: 'manage'` / `'craft'`) | Ya | Lokasi bisnis aktif pemain `businesses[id].position` (di properti / tempat usaha terkait) | **Saat ini 0 cek** *(kecuali `buyStock` `13 m`)* | `business.ts`: `setBusinessSettings`, `withdrawBusinessProfit`, `closeBusiness`, `sellBusiness`, `produceItem`, `setPrice`, `discardStock`, `runPromotion`, `settleNpcSales`, `postBusinessJob`, `hireEmployee`, `fireEmployee`, `payWages` *(semua **0 cek**!)* | Tidak *(wajib di lokasi bisnisnya; cross-link ke `WholesaleMarketModal` arahkan ke `pasar_grosir` jika belum di lokasi)* |
| `ActionButton` (`business` / `biz_cashier`) / Banner Toko (`Kasir`) | `BusinessShopModal` | Ya | Lokasi bisnis yang dikunjungi `businesses[id].position` | `13 m` (`9.5 + 3.5`) | `business.ts:buyFromBusiness` | Tidak |
| HUD `Kerja` (`onOpenJobs`) — melamar / info lowongan & mulai kerja | `JobsModal` | Ya | Jika menganggur: daftar pilihan tempat kerja (`minimarket`, `pasar`, `pos_kurir`, `polsek`, `kantor_agen`, atau stasiun/zona tujuan untuk `buruh_pabrik` / `guru_honorer` / `biz_*`). Jika ingin melamar spesifik: lokasi kerja target. | **Saat ini `applyJob` & `resignJob` = 0 cek** *(rekomendasi samakan `startShift` atau `9.5 m`)* | `jobs.ts:applyJob` & `resignJob` *(0 cek!)*; `jobs.ts:startShift` *(cek `13.5 m`)* | Tidak *(saat menganggur arahkan ke tempat kerja pilihan; jika punya kerja aktif, arahkan ke lokasi kerjanya)* |
| `ActionButton` (`job_site`) / tombol `Mulai Shift` di `JobsModal` + `JobMiniGameModal` | `callStartShift` → `JobMiniGameModal` | Ya (untuk `Mulai Shift`; setelah shift dimulai, mini-game mengikuti `activeShift`) | Lokasi kerja pemain saat ini (`JOB_LOCATIONS[jobId]` atau `businesses[bizId].position`, zona `rancaekek` untuk `buruh_pabrik`, zona `bandung` untuk `guru_honorer`) | `13.5 m` (`9.5 + 4`) | `jobs.ts:startShift` *(cek jarak)*; `jobs.ts:endShift` *(tanpa cek jarak, validasi `activeShift`)* | Tidak *(untuk mulai shift)* |
| HUD `Polsek` / `Hukum` (`onOpenLaw`, `onOpenPolice`) + Banner `Sidang/Denda/Buron/Penjara` + `ActionButton` (`polsek`) | `LawJusticeModal` / `PoliceModal` | Ya *(Golongan A sesuai spesifikasi `Polsek`)* | `polsek` `(-6, 26)`, pintu `(-6, 22.0)` *(kecuali aksi penangkapan polisi `arrestPlayer` di dekat tersangka `<= 8 m`)* | `arrestPlayer` `8 m`; `attemptCrime` `16 m`; `issueFine` `12 m`; fungsi lain **0 cek** | `law.ts`: `attemptCrime`, `arrestPlayer`, `issueFine` *(pakai `charData.lastPosition`, bukan RTDB!)*. `reportCrime`, `payFine`, `releasePlayer`, `serveSentence`, `payBail`, `fileAppeal`, `getCriminalRecord`, `reviewPoliceAction` = **0 cek jarak** | Tidak *(lihat catatan khusus Golongan C mengenai akses jarak jauh saat pemain dipenjara / buron / polisi patroli)* |
| HUD `Agen / Dev` (`onOpenAgentDeveloper`) + `ActionButton` (`agent_office`) | `AgentDeveloperModal` | Ya *(kecuali tab khusus yang punya tempat berbeda, mis. beli set mebel di `toko_mebel`)* | `kantor_agen` `(6, 26)`, pintu `(6, 22.0)` *(atau `kantor_desa` untuk izin jadi agen; `toko_mebel` untuk tab beli set mebel)* | `becomeAgent`: `15 m` (`kantor_agen`/`kantor_desa`); `buyFurnitureSet`: `13.5 m` (`toko_mebel`); aksi lain **0 cek** | `agentRenovation.ts:becomeAgent`, `buyFurnitureSet`; `createClientRequest`, `closeDeal`, `createDevelopmentProject`, `startRenovation`, `completeRenovation` = **0 cek** | Tidak *(buka di `kantor_agen`; tombol beli paket mebel di dalam modal cek jarak ke `toko_mebel`)* |
| `ActionButton` (`toko_mebel`) + cross-link dari `MyPropertyModal` / `AgentDeveloperModal` | `FurnitureShopModal` (`tab: 'shop'` vs `'inventory'`) | Ya untuk tab `shop` (beli mebel); `inventory` boleh dari dalam rumah | `toko_mebel` `(-6, -22)`, pintu `(-6, -18.0)` *(untuk `tab === 'shop'`)* | `12.5 m` (`9.5 + 3`) | `furniture.ts:buyFurniture` *(cek jarak)*; `furniture.ts:placeFurniture` *(tanpa cek jarak, harus di properti yang ditempati)* | Tidak *(untuk beli mebel)*; `tab: 'inventory'` boleh saat di properti |
| `ActionButton` (`penampungan`, `emperan`) | `HomelessSleepModal` | Ya | `penampungan` `(-70, -2)` pintu `(-65.5, -2.0)`; `emperan_stasiun` `(-18, -48)`; `emperan_pasar` `(40, 14)` | `11.5 m` (`9.5 + 2`) | `ownership.ts:sleepAtHome('start', 'shelter' | 'emperan')` | Tidak |
| `ActionButton` (`kontrakan`, `bath`, `interior_bath`, `interior_sleep`) | Aksi langsung (`callRest`, `handleBathAction`, `callBatheAtHome`, `callSleepAtHome`) | Ya | `kontrakan_1..5` (`KONTRAKAN_POSITIONS`), `bath_mck` `(32, 10)` pintu `(32, 13.0)`, atau di dalam interior properti | `9.5 m` (rest/bath), `14.5 m` (home sleep) | `rest.ts:rest`, `wellness.ts:takeBath`, `ownership.ts:batheAtHome`, `sleepAtHome('start')` | Tidak *(khusus `ActionButton` terdekat)* |
| `ActionButton` (`npc`) | `NpcDialogModal` | Ya | Posisi NPC saat ini (`npcPoses[npcId]`) | `12 m` (dialog), `14 m` (accept quest), `15–18 m` (complete quest) | `npcDialog.ts:talkToNpc`, `executeNpcAction`; `quests.ts:acceptQuest`, `completeQuest` *(memakai `lastPosition` Firestore!)* | Tidak *(selalu lewat `ActionButton` saat dekat NPC)* |

---

## Golongan B — BOLEH Dibuka di Mana Saja (Aksi Tertentu Butuh Lokasi)

Modal golongan ini bersifat **informasi pribadi, riwayat, portofolio, peta, inventori, atau pengaturan**, sehingga aman dan wajar dibuka langsung dari HUD di mana saja. Aksi fisik tertentu tetap diarahkan atau divalidasi ke lokasi.

| menu / pemicu | modal | apakah butuh lokasi? | lokasi yang benar (id + posisi) | radius server | validasi server (`file:fungsi`) | bisa dibuka dari mana saja? |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| HUD Klik Avatar / Profil (`onOpenProfileFinance('profile')`), Keuangan/Tagihan (`'finance'`), Keterampilan (`'skills'`), Karir/Status | `ProfileFinanceModal` | Tidak (lihat profil, riwayat karir, tagihan listrik/air/cicilan, bayar tagihan, makan dari inventori/kasur). | — *(catatan: tombol makan dari inventori memakai `eatFromInventory`, bayar tagihan memakai `payBill`)* | — | `bills.ts:getBills`, `payBill`; `ownership.ts:eatFromInventory` *(0 cek jarak)* | **Ya** |
| HUD `Properti` / `Rumahku` (`onOpenMyProperty`) | `MyPropertyModal` | Tidak untuk melihat daftar properti milik/sewa, kontrak, kamar/roommate, akses tamu, tagihan sewa. *(Tombol lintas modal ke "Toko Mebel" jika buka tab `shop` harus lewat gerbang `toko_mebel`; tombol "Lihat Detail" buka `PropertyDetailModal`)* | — *(jika masuk/dekorasi harus di pintu properti terkait)* | — | `properties.ts:createListing`, `cancelListing`, `repairProperty`, `grantGuestAccess`, `setViewingSchedule`; `leases.ts:*` *(0 cek jarak)*; `properties.ts:enterProperty` *(cek `13.5 m`)* | **Ya** |
| HUD `Tawaran` (`onOpenOffers`) | `OffersModal` | Tidak (melihat tawaran masuk/keluar & terima/tolak negosiasi). | — *(atau lihat catatan apakah transaksi/akad perlu di kantor agen)* | — | `offers.ts:makeOffer`, `respondOffer` *(0 cek jarak)* | **Ya** |
| HUD `Pengaturan` (`onOpenSettings`) | `SettingsModal` | Tidak (tombol *Reset Karakter ke Spawn* & audio/grafis lokal). | — | — | Klien lokal / spawn | **Ya** |
| HUD `Peta` / Navigasi Minimap | `Peta / HouseSearch / Minimap` | Tidak (lihat peta kota). | — | — | Hanya baca klien | **Ya** |
| HUD / Interior `Inventori` (`FurnitureShopModal` `tab: 'inventory'`) | `FurnitureShopModal` (tab Inventori / Gudang) | Tidak untuk melihat gudang; menempatkan mebel butuh sedang berada di interior rumah (`interiorState`). | Di dalam interior properti (`interiorState?.mode === 'resident'`) | — | `furniture.ts:placeFurniture` *(0 cek jarak server, cek kepemilikan/sewa)* | **Ya** *(untuk cek gudang; penempatan butuh di interior)* |
| HUD `Misi` (`onOpenQuests`) | `QuestsModal` | Tidak untuk melihat daftar misi aktif/selesai/hadiah; ambil/serahkan misi hanya dari NPC (`NpcDialogModal`). | NPC pemberi misi (`npcPoses`) | `14–18 m` *(Firestore `lastPosition`)* | `quests.ts:acceptQuest`, `completeQuest` *(0 cek RTDB; memakai `lastPosition`)* | **Ya** *(hanya melihat status misi)* |

---

## Golongan C — Perlu Keputusan & Rekomendasi

Bagian ini menandai menu/modal yang memiliki dua interpretasi desain (online/remote vs wajib datang ke lokasi fisik) atau memiliki ketidaksesuaian antara UI saat ini dan validasi server.

| menu / pemicu | modal | apakah butuh lokasi? | lokasi yang benar (id + posisi) | radius server | validasi server (`file:fungsi`) | bisa dibuka dari mana saja? (kondisi sekarang) |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| HUD `Pasar P2P` (`onOpenMarketplace`) | `MarketplaceModal` | **Perlu Keputusan** | Jika dibuat fisik: `balai_lelang` `(6, -22)` **atau** `pasar_grosir` `(46, -22)` | **0 cek jarak** | `marketplace.ts:createMarketListing`, `buyMarketListing`, `cancelMarketListing` (**0 cek jarak**) | Ya *(sekarang)* |
| HUD `Cari Rumah` (`onOpenHouseSearch`) + klik daftar properti | `HouseSearchModal` → `PropertyDetailModal` | **Sebagian (Lihat boleh; Survei/Masuk wajib lokasi)** | Properti terkait `properties[id].position` / `door` (`18 unit`), plus opsi `kantor_agen` `(6, 26)` bila beli via agen | `requestViewing`: `13 m`; `enterProperty`: `13.5 m`; `buyProperty` / `makeOffer` / `createLease`: **0 cek jarak** | `properties.ts:requestViewing`, `enterProperty` *(cek RTDB)*; `ownership.ts:buyProperty`, `offers.ts:makeOffer`, `leases.ts:createLease` *(0 cek)* | Ya *(sekarang)* |
| HUD `Ekonomi` (`onOpenEconomy`) | `EconomyMonitorModal` | **Tidak (direkomendasikan Golongan B)** | — *(atau `kantor_desa` `(-30, 4)` jika ingin dijadikan papan informasi fisik)* | **0 cek jarak** | `economy.ts:getEconomyStats`, `updateMarketStats` (**0 cek jarak**, pakai cooldown global) | Ya *(sekarang)* |
| HUD `Lahan & Bangun` (`onOpenLandConstruction`) + `ActionButton` (`land_plot`, `construction`) | `LandConstructionModal` | **Perlu Keputusan** | `LAND_PLOTS` (8 kavling), `kantor_desa` `(-30, 4)`, `kantor_agen` `(6, 26)` | `buyLand`: `15 m` (kavling / desa / agen); `applyPermit`: `16 m` (desa) / `14 m` (kavling); `start/advance/completeConstruction`: **0 cek** | `landConstruction.ts:buyLand`, `applyPermit` *(cek RTDB)*; `startConstruction`, `advanceConstruction`, `completeConstruction` *(0 cek)* | Ya *(sekarang via HUD)* |
| HUD `KPR & Asuransi` (`onOpenMortgageSecurity`) | `MortgageSecurityModal` | **Perlu Keputusan (Campuran A & B)** | `bank` `(-46, 2)` / `kantor_agen` `(6, 26)` untuk `applyMortgage`; `polsek` / `bank` atau properti untuk keamanan & asuransi | `applyMortgage`: `14 m` (`bank` atau `kantor_agen`); `payMortgage`, `earlyRepay`, `foreclose`, `installSecurity`, `hireGuard`, `buyInsurance`, `fileClaim`: **0 cek** | `mortgage.ts:applyMortgage` *(cek RTDB)*; sisanya & `security.ts:*` (**0 cek jarak**) | Ya *(sekarang)* |
| HUD `Hukum / Polsek` (`onOpenLaw`) & `Tugas Polisi` (`onOpenPolice`) | `LawJusticeModal`, `PoliceModal` | **Perlu Keputusan Khusus** | `polsek` `(-6, 26)` pintu `(-6, 22.0)` *(untuk `LawJusticeModal`)*; Patroli lapangan untuk `PoliceModal` | `arrestPlayer` (`8 m`), `issueFine` (`12 m`), `attemptCrime` (`16 m`); fungsi lain **0 cek** | `law.ts:*` | Ya *(sekarang)* |

### Rekomendasi & Poin Keputusan untuk Golongan C

1. **`MarketplaceModal` (Pasar P2P) — Rekomendasi: Tetap Golongan B (atau pisah transaksi vs lihat)**
   - **Fakta kode:** `functions/src/handlers/marketplace.ts` sengaja memiliki **0 validasi jarak** (berfungsi seperti *marketplace online / e-commerce* antarpemain dengan sistem escrow `createMarketListing`, `buyMarketListing`, `cancelMarketListing`), berbeda dari `Balai Lelang` (`balai_lelang`) dan `Pasar Grosir` (`pasar_grosir`) yang punya gedung fisik di peta.
   - **Opsi 1 (Rekomendasi — Golongan B penuh):** Biarkan dibuka dari mana saja sebagai aplikasi *Pasar Online Warga*, jadi perbedaan jelas dengan **Balai Lelang** (wajib ke `balai_lelang`) dan **Pasar Grosir** (wajib ke `pasar_grosir`).
   - **Opsi 2 (Golongan A fisik):** Jika ingin lebih realistis/ketat, gerbangkan `MarketplaceModal` ke **`pasar_grosir`** atau **`balai_lelang`** (atau izinkan lihat dari jauh, tetapi `Pasang Listing` / `Beli Barang` mengarahkan ke titik drop-off/ambil di Pasar/Balai Lelang + tambah cek jarak di `marketplace.ts`).

2. **`HouseSearchModal` + `PropertyDetailModal` (Cari Rumah) — Rekomendasi: Golongan B (Lihat & Bandingkan dari Jauh, Survei/Masuk Wajib di Lokasi)**
   - **Rekomendasi:** Buka `HouseSearchModal` (katalog & filter rumah/sewa/beli) boleh dari mana saja agar pemain bisa mencari rumah dan menandai tujuan di peta.
   - Pada `PropertyDetailModal`:
     - **Melihat info, harga, dan rute menuju rumah** boleh dari mana saja (+ tombol *"Arahkan ke Properti"*).
     - **Aksi `Survei Rumah` (`requestViewing`) & `Masuk Rumah` (`enterProperty`)** **WAJIB di lokasi properti** (sesuai validasi server `13 m` / `13.5 m` — jika diklik dari jauh, `useLocationGate` menuntun pemain ke pintu properti tersebut, lalu otomatis survei/masuk saat tiba!).
     - *Keputusan tambahan:* Apakah tombol **`Beli Cash` (`buyProperty`)** dan **`Ajukan Sewa` (`createLease`)** tetap boleh dari jauh (setelah lihat detail) atau wajib di properti / `kantor_agen`? *(Saat ini server `buyProperty` dan `createLease` punya 0 cek jarak; rekomendasi: boleh di properti ATAU `kantor_agen` agar realistis, atau biarkan jarak jauh untuk kenyamanan setelah survei).*

3. **`EconomyMonitorModal` (Monitor Ekonomi) — Rekomendasi: Golongan B**
   - Bersifat *read-only dashboard* (inflasi, PDB, indeks harga, daftar lowongan) dan `updateMarketStats` hanya sinkronisasi agregat dengan cooldown server. Tidak perlu mengunci pemain untuk jalan ke Kantor Desa hanya untuk melihat statistik kota.

4. **`LandConstructionModal` (Lahan & Bangun) — Rekomendasi: Golongan A untuk Beli/IMB/Bangun (atau Golongan B untuk Pantau Progres)**
   - `buyLand` dan `applyPermit` di server sudah mewajibkan kedekatan ke **kavling (`LAND_PLOTS`), `kantor_desa`, atau `kantor_agen` (`14–16 m`)**.
   - Namun jika diklik dari HUD sekarang, modal terbuka dari jauh lalu error saat tekan `Beli Lahan` / `Ajukan IMB`.
   - **Rekomendasi:** Jadikan **Golongan A** (jika pemain belum punya konstruksi aktif, arahkan ke `kantor_desa` / `kantor_agen` / kavling; atau buat Golongan B jika hanya memantau progres proyek aktif sambil menggerbangkan `Beli Lahan`, `Ajukan IMB`, dan `Mulai/Lanjutkan Konstruksi` ke lokasi kavling/`kantor_desa`).

5. **`MortgageSecurityModal` (KPR & Keamanan) — Rekomendasi: Golongan B dengan Gerbang Aksi `Ajukan KPR` (ke Bank / Kantor Agen)**
   - `applyMortgage` di server mewajibkan berada di `bank` atau `kantor_agen` (`<= 14 m`), sedangkan bayar cicilan (`payMortgage`), pasang CCTV/penjaga (`installSecurity`/`hireGuard`), beli asuransi (`buyInsurance`), dan klaim asuransi (`fileClaim`) tidak dicek jaraknya.
   - **Rekomendasi:** Buka modal boleh dari mana saja untuk melihat status KPR/asuransi/keamanan dan bayar cicilan; khusus tombol **`Ajukan KPR`** menggunakan gerbang lokasi menuju **`bank` atau `kantor_agen`** terdekat. *(Keputusan tambahan: apakah pasang keamanan/beli asuransi tetap bebas jarak atau diarahkan ke properti/bank/polsek?)*

6. **`LawJusticeModal` & `PoliceModal` (Polsek / Hukum & Patroli) — Rekomendasi: Pengecualian Kontekstual**
   - Dalam daftar Golongan A, **Polsek** tercantum wajib di lokasi (`polsek` `(-6, 26)`).
   - Namun ada dua kondisi penting di gameplay:
     1. Saat pemain **ditahan/dipenjara** (`sentence.status === 'serving'`) atau **buron/kena denda** (`wantedLevel > 0` / banner status hukum), pemain yang sedang di dalam sel `polsek` sudah dekat `polsek` (`jailCenter (-6, 30)` berjarak `4 m` dari `polsek (-6, 26)`), sedangkan pemain buron di luar perlu bisa melihat status denda/masa hukumannya — atau diarahkan ke `polsek` untuk bayar denda/jaminan.
     2. Saat pemain bekerja sebagai **Polisi** (`PoliceModal`), polisi melakukan **patroli, menilang (`issueFine`), dan menangkap (`arrestPlayer`) di lapangan** di seluruh peta, bukan cuma di dalam kantor Polsek!
   - **Rekomendasi:**
     - Klik menu `Hukum / Polsek` (`LawJusticeModal`) sebagai warga biasa → **Golongan A (`polsek`)** (kecuali saat ditahan/di sel, karena sudah di dalam area Polsek, atau untuk melihat status hukum).
     - `PoliceModal` (dashboard petugas patroli saat job = `polisi`) → **Golongan B** (boleh dibuka saat patroli di mana saja; aksi tangkap/tilang tetap mengecek radius ke tersangka).

7. **Keputusan Tambahan untuk Celah Server (Langkah 6)**
   - **`Balai Lelang` (`auctions.ts`)**: Saat ini **0 cek jarak** di server, padahal masuk Golongan A. Rekomendasi: wajib tambah `assertNearLocation(rtdb, uid, ['balai_lelang'])` di `createAuction`, `placeBid`, dan `settleAuction`.
   - **`Pekerjaan` (`jobs.ts:applyJob`, `resignJob`)**: Saat ini **0 cek jarak** di server, padahal Anda meminta `Pekerjaan (lamar kerja di tempat kerja)` & `Mulai Shift` sebagai Golongan A. Rekomendasi: tambah cek lokasi tempat kerja tujuan di `applyJob` (termasuk dukungan lokasi lintas-zona/loket atau tempat kerja masing-masing) dan `startShift`.
   - **`Bisnis` (`business.ts`)**: Saat ini hanya `createBusiness`, `buyStock`, dan `buyFromBusiness` yang cek jarak, sedangkan `setPrice`, `produceItem`, `withdrawBusinessProfit`, `runPromotion`, `hireEmployee`, `payWages`, dll. punya **0 cek jarak**. Rekomendasi: perketat aksi operasional toko (`produceItem`, `setPrice`, `discardStock`, `withdrawBusinessProfit`, dll.) ke lokasi bisnisnya (`businesses[id].position`) agar konsisten dengan Golongan A.
   - **`Bank` (`bank.ts:transfer`, `repayLoan`)**: Saat ini **0 cek jarak** (ibarat *mobile banking* / pelunasan KPR-pinjaman online). Rekomendasi: putuskan apakah `transfer` & `repayLoan` sengaja tetap online di `BankModal` (atau wajib di Bank/ATM juga).
   - **`npcDialog.ts`, `quests.ts`, `law.ts`**: Ketiganya saat ini membaca `charData.lastPosition` (Firestore) alih-alih posisi real-time dari RTDB (`getPlayerWorldPos`). Rekomendasi pada Langkah 6: migrasikan ke `getPlayerWorldPos(rtdb, uid, charData)` agar akurat 100%.

---

## Ringkasan Daftar Handler Server Tanpa Validasi Jarak (Per File)

| File Handler | Fungsi Tanpa Validasi Jarak | Catatan Status |
| :--- | :--- | :--- |
| `auctions.ts` | `createAuction`, `placeBid`, `settleAuction` | **Perlu ditambah** untuk konsistensi Golongan A (`balai_lelang`) |
| `jobs.ts` | `applyJob`, `resignJob`, `endShift` | `applyJob` **perlu ditambah** (Golongan A); `endShift` sengaja jarak jauh setelah shift dimulai |
| `marketplace.ts` | `createMarketListing`, `buyMarketListing`, `cancelMarketListing` | Sengaja online (Golongan C — tunggu konfirmasi) |
| `bank.ts` | `transfer`, `repayLoan`, `getAccountSummary` | `transfer`/`repayLoan` = mobile banking atau perlu ATM/Bank (tunggu konfirmasi) |
| `business.ts` | `setBusinessSettings`, `withdrawBusinessProfit`, `closeBusiness`, `sellBusiness`, `produceItem`, `setPrice`, `discardStock`, `runPromotion`, `settleNpcSales`, `postBusinessJob`, `hireEmployee`, `fireEmployee`, `payWages` | Sebagian besar manajemen bisnis masih **0 cek jarak**; disarankan wajib di lokasi bisnis untuk aksi di toko |
| `wellness.ts` / `courses.ts` / `train.ts` | `claimClinic`, `claimCourse`, `completeTrip` | Sengaja boleh klaim/selesai setelah timer selesai |
| `ownership.ts` | `sleepAtHome('wake')`, `batheAtHome`, `eatFromInventory`, `buyProperty`, `setHomePreferences` | `batheAtHome` mengecek kepemilikan hunian; `buyProperty` **0 cek jarak** |
| `properties.ts` / `offers.ts` / `leases.ts` / `furniture.ts` | `createListing`, `cancelListing`, `repairProperty`, `grantGuestAccess`, `setViewingSchedule`, `makeOffer`, `respondOffer`, `createLease`, `terminateLease`, `inviteRoommate`, `acceptRoommate`, `leaveRoommate`, `placeFurniture` | Manajemen aset/negosiasi jarak jauh; `placeFurniture` hanya cek properti ditempati |
| `landConstruction.ts` | `startConstruction`, `advanceConstruction`, `completeConstruction` | `buyLand` & `applyPermit` sudah cek jarak; tahap bangun belum |
| `agentRenovation.ts` | `createClientRequest`, `closeDeal`, `createDevelopmentProject`, `startRenovation`, `completeRenovation` | Hanya `becomeAgent` & `buyFurnitureSet` yang cek jarak |
| `mortgage.ts` / `security.ts` | `payMortgage`, `earlyRepay`, `foreclose`, `installSecurity`, `hireGuard`, `buyInsurance`, `fileClaim` | Hanya `applyMortgage` yang cek jarak |
| `law.ts` | `reportCrime`, `payFine`, `releasePlayer`, `reviewPoliceAction`, `serveSentence`, `payBail`, `fileAppeal`, `getCriminalRecord` | `attemptCrime`, `arrestPlayer`, `issueFine` cek jarak tapi pakai `lastPosition` Firestore (bukan RTDB) |
| `bills.ts` / `economy.ts` | `getBills`, `payBill`, `getEconomyStats`, `updateMarketStats` | Layak tetap tanpa jarak (Golongan B) |

---

## Ringkasan Konfirmasi yang Dibutuhkan Sebelum Langkah 2

Mohon konfirmasi keputusan Anda untuk poin-poin Golongan C berikut (dan koreksi jika ada item Golongan A/B yang ingin dipindah):

1. **`MarketplaceModal` (Pasar P2P):** Tetap **Golongan B** (online P2P, dibedakan dari Balai Lelang & Pasar Grosir), ATAU ubah ke **Golongan A** (harus datang ke `pasar_grosir` / `balai_lelang`)?
2. **`HouseSearchModal` & `PropertyDetailModal` (Cari Rumah):** Setuju **Golongan B** untuk telusuri daftar rumah & detail, dengan **`Survei Rumah` dan `Masuk Rumah` lewat gerbang lokasi** ke pintu properti terkait? Bagaimana dengan `Beli Cash` / `Ajukan Sewa` (boleh jarak jauh atau wajib ke properti/`kantor_agen`)?
3. **`EconomyMonitorModal` (Monitor Ekonomi):** Setuju **Golongan B** (boleh dibuka dari mana saja)?
4. **`LandConstructionModal` (Lahan & Bangun):** Dijadikan **Golongan A** (arahkan ke `kantor_desa`/`kantor_agen`/kavling) atau **Golongan B** (pantau progres di mana saja, tetapi tombol `Beli Lahan`/`Ajukan IMB` lewat gerbang lokasi)?
5. **`MortgageSecurityModal` (KPR & Asuransi):** Setuju **Golongan B** dengan **`Ajukan KPR` lewat gerbang lokasi** ke `bank` / `kantor_agen`?
6. **`LawJusticeModal` & `PoliceModal`:** Setuju **`LawJusticeModal` = Golongan A (`polsek`)** (dengan pengecualian jika pemain sedang ditahan di dalam sel Polsek), sedangkan **`PoliceModal` (saat bertugas jadi polisi) = Golongan B** agar polisi bisa patroli/menilang/menangkap di lapangan?
7. **`BankModal` (`transfer` & `repayLoan`):** Tetap boleh lewat ponsel/remote atau wajib di Bank/ATM juga?
