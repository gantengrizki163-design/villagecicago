export { createCharacter } from './handlers/createCharacter';
export { buyFood } from './handlers/buyFood';
export { rest } from './handlers/rest';
export { savePosition } from './handlers/savePosition';
export { sendChat } from './handlers/sendChat';

// Fase 2 Cloud Functions
export { takeBath, visitClinic, claimClinic } from './handlers/wellness';
export { applyJob, resignJob, startShift, endShift } from './handlers/jobs';
export { enrollCourse, claimCourse } from './handlers/courses';
export { getBills, payBill } from './handlers/bills';
export { buyTicket, completeTrip } from './handlers/train';
export { syncPlayerState, dailyJobAttendanceCheck } from './handlers/syncState';

// Fase 3 Cloud Functions (Hunian, Pasar Properti, Sewa, Beli, Roommate & Dekorasi)
export {
  createListing,
  cancelListing,
  requestViewing,
  enterProperty,
  leaveProperty,
  repairProperty,
  grantGuestAccess,
  setViewingSchedule,
} from './handlers/properties';
export { makeOffer, respondOffer } from './handlers/offers';
export {
  createLease,
  terminateLease,
  inviteRoommate,
  acceptRoommate,
  leaveRoommate,
} from './handlers/leases';
export {
  buyProperty,
  sleepAtHome,
  batheAtHome,
  eatFromInventory,
  setHomePreferences,
} from './handlers/ownership';
export { buyFurniture, placeFurniture } from './handlers/furniture';

// Fase 4 Cloud Functions: Perbankan
export {
  openAccount,
  deposit,
  withdraw,
  transfer,
  applyLoan,
  repayLoan,
  getAccountSummary,
} from './handlers/bank';

// Fase 4 Cloud Functions: Bisnis, Stok, Produksi, Karyawan & Penjualan
export {
  createBusiness,
  setBusinessSettings,
  withdrawBusinessProfit,
  closeBusiness,
  sellBusiness,
  buyStock,
  produceItem,
  setPrice,
  discardStock,
  buyFromBusiness,
  runPromotion,
  settleNpcSales,
  postBusinessJob,
  hireEmployee,
  fireEmployee,
  payWages,
} from './handlers/business';

// Fase 4 Cloud Functions: Marketplace P2P & Lelang Escrow
export {
  createMarketListing,
  buyMarketListing,
  cancelMarketListing,
} from './handlers/marketplace';
export {
  createAuction,
  placeBid,
  settleAuction,
} from './handlers/auctions';

// Fase 4 Cloud Functions: Harga Dinamis, Event Ekonomi & Scheduler Ringan
export {
  updateMarketStats,
  triggerEconomicEvent,
  scheduledMarketTick,
} from './handlers/economy';

// Fase 6 Cloud Functions: Hukum, Kriminalitas, Polisi & Penjara
export {
  attemptCrime,
  reportCrime,
  payFine,
  arrestPlayer,
  issueFine,
  releasePlayer,
  reviewPoliceAction,
  serveSentence,
  payBail,
  fileAppeal,
  getCriminalRecord,
} from './handlers/law';

// Fase 6 Cloud Functions: Keamanan Properti & Asuransi
export {
  installSecurity,
  hireGuard,
  buyInsurance,
  fileClaim,
} from './handlers/security';

// Fase 6 Cloud Functions: Dialog AI & Aksi NPC Terstruktur
export {
  talkToNpc,
  getNpcOptions,
  executeNpcAction,
} from './handlers/npcDialog';

// Fase 6 Cloud Functions: Quest & Misi Warga
export {
  acceptQuest,
  completeQuest,
  abandonQuest,
} from './handlers/quests';

// Fase 6 Cloud Functions: KPR Bank Priangan
export {
  applyMortgage,
  payMortgage,
  earlyRepay,
  foreclose,
} from './handlers/mortgage';

// Fase 6 Cloud Functions: Tanah Kavling, IMB & Konstruksi Multi-Fase
export {
  buyLand,
  applyPermit,
  startConstruction,
  advanceConstruction,
  completeConstruction,
} from './handlers/landConstruction';

// Fase 6 Cloud Functions: Agen Properti, Developer, Renovasi Besar & Paket Mebel
export {
  becomeAgent,
  createClientRequest,
  closeDeal,
  createDevelopmentProject,
  startRenovation,
  completeRenovation,
  buyFurnitureSet,
} from './handlers/agentRenovation';

// Fase 6 Cloud Scheduler: Rekap Kriminalitas Harian & Pembaruan Harga Tanah Dinamis
export {
  scheduledPhase6DailyMaintenance,
  triggerPhase6DailyMaintenance,
} from './handlers/phase6Scheduler';

// Sistem Kendaraan: Dealer, Leasing, Marketplace, Test Drive, SIM, STNK, SPBU, Bengkel & Berkendara
export {
  buyVehicle,
  buyVehicleOnCredit,
  sellVehicle,
  tradeInVehicle,
  listVehicleForSale,
  transferVehicle,
  testDriveStart,
  registerVehicle,
  renewRegistration,
  takeLicenseExam,
  mountVehicle,
  parkVehicle,
  dismountVehicle,
  retrieveVehicle,
  refuelVehicle,
  serviceVehicle,
  reportPedestrianCollision,
} from './handlers/vehicles';
