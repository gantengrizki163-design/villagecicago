export type Gender = 'laki-laki' | 'perempuan';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type PlayerAnimState = 'idle' | 'walk' | 'driving' | 'passenger';

export type ZoneId = 'cicalengka' | 'rancaekek' | 'bandung' | 'nagreg';

export type SkillKey = 'komunikasi' | 'fisik' | 'hitung' | 'teknis';

export interface SkillsMap {
  komunikasi: number;
  fisik: number;
  hitung: number;
  teknis: number;
}

export interface WorldPosition {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface CurrentJobInfo {
  employmentId?: string;
  jobId: string;
  businessId?: string;
  title: string;
  employer: string;
  rankIndex: number;
  rankTitle: string;
  totalWorkSeconds: number;
  shiftsCompleted: number;
  hiredAtMs: number;
  lastShiftAtMs: number;
}

export interface ActiveShiftInfo {
  shiftId: string;
  jobId: string;
  miniGameType?: string;
  jobTitle: string;
  startedAtMs: number;
  minDurationMs: number;
  taskPrompt: Record<string, unknown>;
}

export interface ActiveTripInfo {
  ticketId: string;
  fromZone: ZoneId;
  toZone: ZoneId;
  toLabel: string;
  departedAtMs: number;
  arrivesAtMs: number;
}

export interface ActiveClinicInfo {
  visitId: string;
  clinicId: string;
  clinicName: string;
  packageId: string;
  packageName: string;
  startedAtMs: number;
  completesAtMs: number;
  healthRestore: number;
  moodRestore: number;
}

export interface ActiveCourseInfo {
  enrollmentId: string;
  courseId: string;
  title: string;
  skillKey: SkillKey;
  skillGain: number;
  startedAtMs: number;
  completesAtMs: number;
}

export interface SentenceInfo {
  active: boolean;
  sentenceId?: string;
  recordId?: string;
  offenseId?: string;
  offenseTitle?: string;
  reason?: string;
  startedAtMs?: number;
  startAtMs?: number;
  endsAtMs?: number;
  endAtMs?: number;
  fineAmount?: number;
  finePaid?: boolean;
  bailAmount?: number;
  appealUsed?: boolean;
  lastWorkAtMs?: number;
  workReductionSec?: number;
  arrestedByUid?: string | null;
}

export interface CharacterDoc {
  uid: string;
  name: string;
  nameLower: string;
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  money: number;
  health?: number;
  hygiene?: number;
  mood?: number;
  statsUpdatedAt?: unknown;
  currentZone?: ZoneId;
  skills?: SkillsMap;
  currentJob?: CurrentJobInfo | null;
  activeShift?: ActiveShiftInfo | null;
  activeTrip?: ActiveTripInfo | null;
  activeClinic?: ActiveClinicInfo | null;
  activeCourse?: ActiveCourseInfo | null;
  faintedCount?: number;
  lastBillPeriod?: number;
  completedShifts?: number;
  // Fase 3 fields
  currentHomeId?: string | null;
  activeLeaseId?: string | null;
  homeless?: boolean;
  reputation?: number;
  starterHousingClaimed?: boolean;
  starterHousingUsed?: boolean;
  respawnAtHome?: boolean;
  lastSleepLocation?:
    | {
        zone: string;
        propertyId?: string | null;
        x: number;
        y: number;
        z: number;
      }
    | string
    | null;
  activeSleep?: {
    locationType: 'home' | 'emperan' | 'shelter';
    propertyId?: string | null;
    label: string;
    startedAtMs: number;
    completesAtMs: number;
  } | null;
  // Fase 4 fields
  bankAccount?: {
    accountNumber: string;
    openedAtMs: number;
  } | null;
  creditScore?: number;
  businesses?: string[];
  // Fase 6 fields (Hukum, Polisi, Agen Properti, KPR, Quest)
  wantedLevel?: number;
  wantedUpdatedAtMs?: number;
  lastCrimeAtMs?: number;
  sentence?: SentenceInfo | null;
  crimeCount?: number;
  criminalRecordCount?: number;
  isPropertyAgent?: boolean;
  agentLicenseAtMs?: number;
  agentStats?: {
    licensedAtMs?: number;
    dealsClosed: number;
    totalCommission: number;
    projectsCreated?: number;
  };
  policeOfficerStats?: {
    arrestsCount: number;
    finesIssued: number;
    totalCommission: number;
    abuseStrikes?: number;
    suspendedUntilMs?: number;
  };
  policeStats?: {
    arrestsCount: number;
    finesIssued: number;
    abuseStrikes: number;
    suspendedUntilMs: number;
  };
  questLog?: {
    activeCount: number;
    activeIds: string[];
    completedToday: number;
    dailyMoneyEarned: number;
    dayKey: string;
  };
  // Sistem Kendaraan
  ownedVehicleCount?: number;
  drivingVehicleId?: string | null;
  passengerVehicleId?: string | null;
  simA?: { active: boolean; issuedAtMs?: number; expiresAtMs?: number } | null;
  simC?: { active: boolean; issuedAtMs?: number; expiresAtMs?: number } | null;
  lastPosition: WorldPosition;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CharacterStatsDoc {
  uid: string;
  hunger: number;
  thirst: number;
  energy: number;
  health?: number;
  hygiene?: number;
  mood?: number;
  lastCalculatedAt: unknown;
  lastRestAt?: unknown;
  lastBathAt?: unknown;
  lastPurchaseAt?: unknown;
}

export interface ComputedStats {
  hunger: number;
  thirst: number;
  energy: number;
  health: number;
  hygiene: number;
  mood: number;
  isCritical: boolean;
  didFaint: boolean;
}

export interface ShopMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  hungerRestore: number;
  thirstRestore: number;
  energyRestore: number;
  available: boolean;
}

export interface ChatLogDoc {
  id?: string;
  senderUid: string;
  senderName: string;
  message: string;
  channel: 'global';
  createdAt: unknown;
}

export interface GameConfigDoc {
  dayDurationMs: number;
  epochMs: number;
  hungerDecayPerHour: number;
  thirstDecayPerHour: number;
  energyDecayPerHour: number;
  startingMoney: number;
}

export interface JobVehicleRequirement {
  requiredSim: 'A' | 'C';
  categories: Array<'motor' | 'mobil'>;
  allowedModelIds?: string[];
  preferredModelIds?: string[];
  preferredAccessories?: string[];
  bonusLabel?: string;
}

export interface JobConfigItem {
  id: string;
  title: string;
  employer: string;
  zone: ZoneId;
  location: { x: number; z: number; label: string };
  basePay: number;
  minDurationSec: number;
  energyCost: number;
  hygieneCost: number;
  skillGain: Partial<SkillsMap>;
  requiredSkills: SkillsMap;
  miniGameType:
    | 'kasir'
    | 'pedagang'
    | 'kurir'
    | 'pabrik'
    | 'guru'
    | 'polisi'
    | 'agen_properti'
    | 'ojek_online'
    | 'sopir_angkot'
    | 'sopir_logistik';
  vehicleReq?: JobVehicleRequirement;
  vehicleBonusHint?: string;
  requiresCleanRecord?: boolean;
  minReputation?: number;
  ranks: Array<{ title: string; minTotalWorkSec: number; payMultiplier: number }>;
}

export interface ClinicPackage {
  id: string;
  name: string;
  cost: number;
  healthRestore: number;
  moodRestore: number;
  waitSec: number;
}

export interface ClinicConfigItem {
  id: string;
  name: string;
  tier: string;
  zone: ZoneId;
  location: { x: number; z: number };
  description: string;
  packages: ClinicPackage[];
}

export interface CourseConfigItem {
  id: string;
  title: string;
  skillKey: SkillKey;
  skillGain: number;
  cost: number;
  durationSec: number;
  description: string;
}

export interface TrainDestination {
  id: ZoneId;
  label: string;
  subtitle: string;
  ticketPrice: number;
  travelDurationSec: number;
}

export interface TrainScheduleConfig {
  cycleRealMs: number;
  arriveEndMs: number;
  boardingEndMs: number;
  departEndMs: number;
  stations: Record<
    ZoneId,
    {
      id: ZoneId;
      name: string;
      platformPos: WorldPosition;
      ticketBooth: { x: number; z: number };
      accentColor: string;
    }
  >;
  destinations: TrainDestination[];
}

export interface EconomyConfig {
  hygieneDecayPerHour: number;
  moodDecayPerHour: number;
  moodFastDecayPerHour: number;
  healthDecayCriticalPerHour: number;
  healthDecayDirtyPerHour: number;
  bathLocation: { x: number; z: number; label: string };
  bathCooldownSec: number;
  bathHygieneRestore: number;
  bathMoodRestore: number;
  billCycleMs: number;
  billGraceMs: number;
  rentBillAmount: number;
  rentLatePenalty: number;
  electricityBillAmount: number;
  electricityLatePenalty: number;
  maxMissedShiftsBeforeFiring: number;
  expectedShiftIntervalMs: number;
  homelessEnergyDecayMultiplier?: number;
  homelessHygieneDecayMultiplier?: number;
  homelessMoodDecayMultiplier?: number;
  homelessHealthDecayMultiplier?: number;
  homeRestRecoveryMultiplier?: number;
  rentalTaxRate?: number;
  propertyTaxRatePerCycle?: number;
  saleTransferTaxRate?: number;
  roommateMaxCount?: number;
  tokoMebelLocation?: { x: number; z: number; label: string };
  penampunganLocation?: { x: number; z: number; label: string };
  inflationRatePerGameDay?: number;
  minInflationIndex?: number;
  maxInflationIndex?: number;
  supplyDemandSensitivity?: number;
  minSupplyDemandFactor?: number;
  maxSupplyDemandFactor?: number;
  marketStatsCooldownMs?: number;
  minPriceRatioVsMarket?: number;
  maxPriceRatioVsMarket?: number;
  maxMarketListingsPerPlayer?: number;
  maxAuctionsPerPlayer?: number;
  auctionMinDurationMs?: number;
  auctionMaxDurationMs?: number;
  auctionAntiSnipeWindowMs?: number;
  auctionAntiSnipeExtendMs?: number;
  auctionMaxExtensions?: number;
  events?: Array<{
    id: string;
    label: string;
    durationMs: number;
    categoryMultipliers: Record<string, number>;
  }>;
}

export interface TransactionDoc {
  id: string;
  uid: string;
  type: 'income' | 'expense' | 'penalty';
  category: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAtMs: number;
}

export interface BillDoc {
  id: string;
  uid: string;
  billType:
    | 'rent'
    | 'electricity'
    | 'water'
    | 'internet'
    | 'property_tax'
    | 'loan_installment'
    | 'mortgage_installment'
    | 'security_fee'
    | 'insurance_premium'
    | 'vehicle_tax'
    | 'vehicle_lease_installment'
    | 'vehicle_ticket_fine';
  title: string;
  periodIndex: number;
  baseAmount: number;
  lateFee: number;
  totalDue: number;
  status: 'unpaid' | 'paid' | 'defaulted';
  dueAtMs: number;
  paidAtMs?: number;
  leaseId?: string;
  propertyId?: string;
  loanId?: string;
  mortgageId?: string;
  securityInstallId?: string;
  insurancePolicyId?: string;
  vehicleId?: string;
  vehicleLeaseId?: string;
}

export interface RTDBPlayer {
  uid: string;
  name: string;
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  anim: PlayerAnimState;
  zone: string;
  currentZone?: ZoneId;
  vehicleId?: string;
  seatIndex?: number;
  updatedAt: number;
}

export interface RTDBPresence {
  online: boolean;
  lastSeen: number;
  inTrain?: boolean;
  currentZone?: ZoneId;
  inHomeId?: string | null;
  inBusinessId?: string | null;
  isHomeless?: boolean;
  wantedLevel?: number;
  isJailed?: boolean;
  onPatrol?: boolean;
  isAgent?: boolean;
  drivingVehicleId?: string | null;
  passengerVehicleId?: string | null;
  sessionId?: string;
}

export interface RTDBVehiclePassenger {
  uid: string;
  name: string;
  seatIndex: number;
  joinedAt: number;
}

export interface RTDBVehicle {
  vehicleId: string;
  ownerId: string;
  driverId: string | null;
  driverName?: string;
  modelId: string;
  category: 'motor' | 'mobil';
  color: string;
  plateNumber: string;
  zone: ZoneId;
  x: number;
  y: number;
  z: number;
  rotY: number;
  vx: number;
  vz: number;
  speed: number;
  steerAngle: number;
  headlights: boolean;
  turnSignal?: 'off' | 'left' | 'right' | 'hazard';
  hornAtMs: number;
  maxSpeed: number;
  seatCapacity: number;
  isTestDrive?: boolean;
  sessionId?: string;
  passengers?: Record<string, RTDBVehiclePassenger>;
  updatedAt: number;
}

export interface RTDBLocalChat {
  id?: string;
  senderUid: string;
  senderName: string;
  message: string;
  x: number;
  z: number;
  createdAt: number;
}

// --- FASE 3 HOUSING TYPES ---

export type PropertyType = 'kos' | 'kontrakan' | 'rumah' | 'apartemen' | 'ruko' | 'lapak_pasar';
export type AreaTag = 'kampung' | 'stasiun' | 'pasar' | 'perumahan' | 'alun_alun';
export type ListingKind = 'rent' | 'sale';

export interface FurniturePlacement {
  instanceId: string;
  furnitureId: string;
  gx: number;
  gz: number;
  rot: 0 | 90 | 180 | 270;
  ownerUid?: string;
}

export interface PropertyFacilities {
  electricity: boolean;
  water: boolean;
  internet: boolean;
  ac: boolean;
}

export interface PropertyLayout {
  gridCols: number;
  gridRows: number;
  wallColor: string;
  floorColor: string;
}

export interface PropertyDoc {
  id: string;
  name: string;
  type: PropertyType;
  zone: ZoneId;
  areaTag: AreaTag;
  ownerId: string;
  ownerType: 'player' | 'npc';
  ownerName: string;
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number };
  rooms: number;
  condition: number;
  conditionUpdatedAtMs?: number;
  lastConditionDecayAtMs?: number;
  stationDistanceTier?: 'dekat' | 'sedang' | 'jauh';
  facilities: PropertyFacilities;
  layout: PropertyLayout;
  furniture: FurniturePlacement[];
  baseValue: number;
  estimatedValue?: number;
  baseRent: number;
  baseDeposit: number;
  activeListingId?: string | null;
  activeLeaseId?: string | null;
  activeBusinessId?: string | null;
  activeAuctionId?: string | null;
  currentResidentIds?: string[];
  viewingSchedule?: { startHour: number; endHour: number; open24h?: boolean; allowAllHours?: boolean };
  mortgageInfo?: {
    mortgageId: string;
    status: 'active' | 'paid' | 'foreclosed';
    remainingPrincipal?: number;
  } | null;
  activeRenovationId?: string | null;
  renovationLevel?: number;
  renovationsApplied?: string[];
  securityBonus?: number;
  moodBonus?: number;
  builtFromPlotId?: string | null;
  landValue?: number;
  certificateId?: string | null;
  certificateNo?: string | null;
  hasGarage?: boolean;
  garageCapacity?: number;
  lastPropertyTaxPeriod?: number;
  lastTaxAtMs?: number;
  updatedAtMs?: number;
}

export interface PropertyListingDoc {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyType: PropertyType;
  areaTag: AreaTag;
  zone?: ZoneId;
  position?: { x: number; z: number };
  rooms: number;
  condition: number;
  stationDistanceTier?: 'dekat' | 'sedang' | 'jauh';
  stationDistanceMeters?: number;
  ownerId: string;
  ownerType: 'player' | 'npc';
  ownerName: string;
  kind: ListingKind;
  price: number;
  deposit: number;
  status: 'active' | 'closed' | 'cancelled' | 'expired';
  createdAtMs: number;
  expiresAtMs: number;
}

export interface OfferDoc {
  id: string;
  listingId: string;
  propertyId: string;
  propertyName: string;
  kind: ListingKind;
  buyerId: string;
  buyerName: string;
  ownerId: string;
  ownerType: 'player' | 'npc';
  sellerId?: string;
  sellerType?: 'player' | 'npc';
  askingPrice: number;
  amount: number;
  counterAmount?: number | null;
  status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'expired' | 'completed';
  note?: string;
  message?: string;
  createdAtMs: number;
  expiresAtMs: number;
}

export interface LeaseRoommateShare {
  uid: string;
  name: string;
  sharePercent: number;
  joinedAtMs?: number;
}

export interface LeaseDoc {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantId: string;
  tenantName?: string;
  ownerId: string;
  ownerType: 'player' | 'npc';
  ownerName?: string;
  rent: number;
  deposit: number;
  depositRefunded?: boolean;
  conditionAtLeaseStart?: number;
  startCondition?: number;
  period: 'weekly' | 'monthly';
  periodMs: number;
  startAtMs: number;
  lastBilledPeriod?: number;
  nextDueAtMs: number;
  status: 'active' | 'ended' | 'evicted';
  endedAtMs?: number;
  missedPeriods?: number;
  missedPeriodsCount?: number;
  evictionWarningAtMs?: number | null;
  roommates: LeaseRoommateShare[];
  roommateIds: string[];
  pendingInvites?: Array<{ uid: string; name: string; sharePercent: number; invitedAtMs: number }>;
  pendingInviteUids?: string[];
  rules?: string;
}

export interface InventoryItemDoc {
  id: string;
  uid?: string;
  itemId: string;
  category: 'furniture' | 'food' | 'raw' | 'product' | 'material' | 'misc';
  name: string;
  quantity: number;
  placedCount?: number;
  hungerRestore?: number;
  thirstRestore?: number;
  energyRestore?: number;
  updatedAtMs: number;
}

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: 'bed' | 'living' | 'kitchen' | 'electronics';
  price: number;
  size: { w: number; d: number };
  recoveryBonus: number;
  moodBonus: number;
  valueBonus: number;
  description: string;
}

export interface HousingConfigDoc {
  propertyTypes: Record<
    PropertyType,
    {
      label: string;
      defaultGrid: { cols: number; rows: number };
      recoveryBonus: number;
      maxRoommates: number;
    }
  >;
  valuationFormula: {
    areaMultipliers: Record<AreaTag, number>;
    stationTierBonus: Record<'dekat' | 'sedang' | 'jauh', number>;
    conditionMinFactor: number;
    conditionWeight: number;
    furnitureValueShare: number;
    listingSupplyPenaltyPerListing: number;
    maxSupplyPenalty: number;
    conditionDecayPerGameDay: number;
    repairCostPerPoint: number;
  };
  leaseSettings: {
    weeklyPeriodMs: number;
    monthlyPeriodMs: number;
    monthlyRentDiscount: number;
    gracePeriodMs: number;
    lateFeeRate: number;
    maxMissedPeriodsBeforeEviction: number;
    rentalIncomeTaxRate: number;
    saleTransferTaxRate: number;
    propertyTaxRatePerCycle: number;
    depositDamageDeductionPerPoint: number;
  };
  negotiationSettings: {
    offerExpiryMs: number;
    npcMaxDiscountBase: number;
    npcMaxDiscountHighRep: number;
    npcHighRepThreshold: number;
    npcAutoCounterRatio: number;
    npcCounterMidpointShare: number;
  };
  livingAndSleep: {
    homeRecoveryMultiplierBase: number;
    homeConditionBonusMax: number;
    sleepDurationSec: number;
    homeSleepEnergyRestore: number;
    homeSleepHealthRestore: number;
    homeSleepMoodRestore: number;
    homeBathHygieneRestore: number;
    homeBathMoodRestore: number;
    homeBathCooldownSec: number;
    utilityCostsPerCycle: {
      electricityBase: number;
      acSurcharge: number;
      waterBase: number;
      internetBase: number;
    };
    starterOption: {
      propertyId: string;
      firstCycleRent: number;
      deposit: number;
      label: string;
    };
  };
  homelessSettings: {
    energyDecayMultiplier: number;
    hygieneDecayMultiplier: number;
    moodDecayMultiplier: number;
    healthRiskMultiplier: number;
    emperanSpots: Array<{ id: string; label: string; x: number; z: number }>;
    emperanSleepDurationSec: number;
    emperanSleepEnergyRestore: number;
    emperanSleepMoodDelta: number;
    emperanSleepHygieneDelta: number;
    shelter: {
      id: string;
      label: string;
      x: number;
      z: number;
      openStartHour: number;
      openEndHour: number;
      fee: number;
      sleepDurationSec: number;
      sleepEnergyRestore: number;
      sleepMoodDelta: number;
      sleepHygieneDelta: number;
    };
  };
}

// --- FASE 4 BANK, BUSINESS, MARKETPLACE, AUCTION & MACRO ECONOMY TYPES ---

export interface BankAccountDoc {
  uid: string;
  accountNumber: string;
  balance: number;
  savings: number;
  lastInterestAtMs: number;
  creditScore: number;
  totalInterestEarned?: number;
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface LoanDoc {
  id: string;
  borrowerId: string;
  borrowerName?: string;
  principal: number;
  rate: number;
  installment: number;
  termCycles?: number;
  paidCycles?: number;
  nextDueAtMs: number;
  remaining: number;
  missedCount?: number;
  status: 'active' | 'paid' | 'defaulted';
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface LedgerEntryDoc {
  id: string;
  from: string;
  to: string;
  amount: number;
  taxAmount?: number;
  reason: string;
  refId: string;
  atMs: number;
}

export type BusinessType = 'warung' | 'kelontong' | 'bengkel' | 'dealer' | 'jasa' | 'lapak_pasar';

export interface BusinessDoc {
  id: string;
  ownerId: string;
  ownerName?: string;
  type: BusinessType;
  name: string;
  propertyId: string;
  areaTag?: AreaTag;
  position?: { x: number; y?: number; z: number };
  capital?: number;
  cash: number;
  totalRevenue?: number;
  popularity: number;
  level: number;
  isOpen: boolean;
  hours?: { openHour: number; closeHour: number };
  lastSettledAtMs: number;
  lastWageAtMs?: number;
  permits?: { permitId: string; issuedAtMs: number; feePaid: number };
  promoBoostUntilMs?: number;
  promoBoostValue?: number;
  activeAuctionId?: string | null;
  status: 'active' | 'closed' | 'auctioning';
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface BusinessStockDoc {
  businessId: string;
  ownerId: string;
  itemId: string;
  name: string;
  category: string;
  qty: number;
  avgCost: number;
  sellPrice: number;
  expiresAtMs: number;
  updatedAtMs: number;
}

export interface BusinessEmployeeDoc {
  id: string;
  businessId: string;
  ownerId: string;
  uid: string;
  name: string;
  isNpc: boolean;
  roleTitle: string;
  wagePerCycle: number;
  productivity: number;
  status: 'active' | 'resigned' | 'fired';
  hiredAtMs: number;
  lastPaidAtMs: number;
  unpaidWage: number;
}

export interface BusinessDailyReportDoc {
  dayKey: string;
  businessId: string;
  ownerId?: string;
  revenue: number;
  npcSales: number;
  playerSales: number;
  stockCost: number;
  wageCost: number;
  taxPaid: number;
  promoCost: number;
  netProfit: number;
  updatedAtMs: number;
}

export interface BusinessJobPostDoc {
  id: string;
  businessId: string;
  businessName: string;
  businessType: BusinessType;
  ownerId: string;
  roleTitle: string;
  wagePerShift: number;
  slotsOpen: number;
  status: 'open' | 'closed';
  createdAtMs: number;
}

export interface MarketListingDoc {
  id: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  itemName: string;
  category: string;
  qty: number;
  price: number;
  unitPrice: number;
  areaTag: string;
  status: 'active' | 'sold' | 'cancelled';
  createdAtMs: number;
  updatedAtMs?: number;
}

export type AuctionSubjectType = 'item' | 'property' | 'business' | 'vehicle';

export interface AuctionDoc {
  id: string;
  sellerId: string;
  sellerName: string;
  subject: Record<string, unknown>;
  subjectType: AuctionSubjectType;
  subjectId: string;
  startPrice: number;
  minIncrement: number;
  currentBid: number;
  currentBidderId?: string | null;
  currentBidderName?: string | null;
  currentBidderSource?: 'wallet' | 'bank' | null;
  bidCount: number;
  extensionsUsed?: number;
  endsAtMs: number;
  status: 'active' | 'settled' | 'cancelled';
  winnerId?: string | null;
  winnerName?: string | null;
  finalPrice?: number;
  fee?: number;
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface AuctionBidDoc {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  createdAtMs: number;
}

export interface MarketStatDoc {
  itemId: string;
  name: string;
  category: string;
  basePrice: number;
  currentPrice: number;
  wholesalePrice?: number;
  supply: number;
  demand: number;
  pendingSupplyDelta?: number;
  pendingDemandDelta?: number;
  eventMultiplier?: number;
  updatedAtMs: number;
}

export interface SupplierDoc {
  id: string;
  name: string;
  areaTag: string;
  specialty: string;
  discountRate: number;
}

export interface TreasuryStateDoc {
  balance: number;
  totalTaxCollected: number;
  incomeTaxTotal?: number;
  businessTaxTotal?: number;
  propertyTaxTotal?: number;
  marketFeeTotal?: number;
  auctionFeeTotal?: number;
  vehicleTaxTotal?: number;
  inflationIndex: number;
  activeEventId: string;
  activeEventLabel?: string;
  activeEventUntilMs: number;
  estimatedMoneySupply?: number;
  avgMarketPriceIndex?: number;
  updatedAtMs: number;
}

export interface BankConfigDoc {
  bankLocation: { x: number; z: number; label: string };
  atmLocations: Array<{ id: string; x: number; z: number; label: string }>;
  openAccountFee: number;
  savingsDailyInterestRate: number;
  maxInterestDaysPerClaim: number;
  transferAdminFeeFlat: number;
  transferAdminFeeRate: number;
  transferAdminFeeMax: number;
  minTransferAmount: number;
  maxDepositPerTx: number;
  creditScore: {
    defaultScore: number;
    min: number;
    max: number;
    onTimePaymentDelta: number;
    latePaymentDelta: number;
    loanRepaidBonus: number;
    defaultPenalty: number;
  };
  loan: {
    minCreditScore: number;
    minCompletedShifts: number;
    maxActiveLoans: number;
    cycleMs: number;
    gracePeriodMs: number;
    lateFeeRate: number;
    tiers: Array<{
      minScore: number;
      maxScore: number;
      maxPrincipal: number;
      flatInterestRate: number;
      termCycles: number;
    }>;
  };
}

export interface BusinessConfigDoc {
  kantorDesaLocation: { x: number; z: number; label: string };
  pasarGrosirLocation: { x: number; z: number; label: string };
  balaiLelangLocation: { x: number; z: number; label: string };
  maxBusinessesPerPlayer: number;
  businessTypes: Record<
    BusinessType,
    {
      label: string;
      allowedPropertyTypes: string[];
      permitFee: number;
      minCapital: number;
      basePopularity: number;
      npcMaxCustomersPerGameDay: number;
      maxStockSlots: number;
      maxEmployees: number;
    }
  >;
  npcEmployee: {
    wagePerGameDay: number;
    productivityBonus: number;
    maxUnpaidCyclesBeforeResign: number;
  };
  playerEmployee: {
    minWagePerShift: number;
    maxWagePerShift: number;
    productivityBonus: number;
  };
  promotions: Array<{
    id: string;
    label: string;
    cost: number;
    popularityBoost: number;
    durationMs: number;
  }>;
  withdrawal: {
    minWithdrawAmount: number;
    maxWithdrawPerTx: number;
    minReserveCash: number;
  };
  sellBusinessCapitalRefundRatio: number;
  maxNpcSettleGameDaysPerCall: number;
}

export interface ProductsConfigDoc {
  suppliers: SupplierDoc[];
  products: Array<{
    id: string;
    name: string;
    category: string;
    supplierId: string | null;
    wholesalePrice: number;
    basePrice: number;
    suggestedRetail: number;
    shelfLifeGameDays: number;
    hungerRestore?: number;
    thirstRestore?: number;
    energyRestore?: number;
    businessTypes: BusinessType[];
  }>;
  recipes: Array<{
    id: string;
    name: string;
    outputItemId: string;
    outputQty: number;
    businessTypes: BusinessType[];
    inputs: Array<{ itemId: string; qty: number }>;
    energyCost: number;
  }>;
}

export interface TaxConfigDoc {
  incomeTaxRate: number;
  businessSalesVatRate: number;
  businessProfitTaxRate: number;
  propertySaleTaxRate: number;
  propertyRentalTaxRate: number;
  marketplaceFeeRate: number;
  auctionFeeRate: number;
  minTaxableAmount: number;
}

// --- FASE 6: LAW, POLICE, SECURITY, INSURANCE, NPC AI, QUESTS, KPR, LAND & CONSTRUCTION ---

export interface CrimeRecordDoc {
  id: string;
  characterId: string;
  characterName?: string;
  uid?: string;
  playerName?: string;
  offenseId: string;
  offenseTitle: string;
  severity: 1 | 2 | 3;
  atMs: number;
  createdAtMs?: number;
  location: { x: number; z: number; zone?: ZoneId };
  targetType?: 'npc' | 'player' | 'property' | 'business' | 'public' | 'vehicle';
  targetId?: string | null;
  witnesses?: string[];
  status: 'wanted' | 'reported' | 'fined' | 'arrested' | 'paid' | 'active_evidence' | 'caught' | 'resolved' | 'expired';
  fine: number;
  fineAmount?: number;
  sentenceSec: number;
  evidenceScore?: number;
  cctvLabel?: string | null;
  reportedBy?: string;
  reportedAtMs?: number;
  paidAtMs?: number;
  insuranceClaimed?: boolean;
  insuranceClaimId?: string;
}

export interface PoliceActionDoc {
  id: string;
  officerId: string;
  officerName?: string;
  targetId: string;
  targetName?: string;
  action: 'arrest' | 'fine' | 'release' | 'warn';
  evidence?: string;
  recordId?: string;
  amount?: number;
  atMs: number;
  reviewed?: boolean;
  reviewStatus?: 'valid' | 'warning' | 'abuse' | 'pending';
  reviewedAtMs?: number;
}

export interface SentenceDoc {
  uid: string;
  recordId?: string;
  startAtMs: number;
  endAtMs: number;
  originalEndAtMs?: number;
  reason?: string;
  fineAmount?: number;
  bailAmount?: number;
  bailPaid?: boolean;
  bailPaidBy?: string;
  workReductionSec?: number;
  lastPrisonWorkAtMs?: number;
  appealFiled?: boolean;
  appealOutcome?: 'accepted' | 'rejected';
  status: 'serving' | 'released';
  releasedAtMs?: number;
}

export type SecurityModuleId = 'lock' | 'alarm' | 'cctv' | 'guard';

export interface SecurityInstallDoc {
  id: string;
  propertyId: string;
  propertyName?: string;
  ownerId: string;
  businessId?: string;
  modules: Partial<Record<SecurityModuleId, boolean>>;
  guardName?: string;
  totalProtection: number;
  protectionScore?: number;
  monthlyFee: number;
  monthlyCost?: number;
  lastBilledAtMs?: number;
  lastIncidentAtMs?: number;
  active: boolean;
  updatedAtMs: number;
}

export interface InsurancePolicyDoc {
  id: string;
  ownerId: string;
  subjectType?: 'property' | 'business' | 'vehicle';
  subjectId: string;
  subjectName?: string;
  propertyId?: string;
  propertyName?: string;
  planId: 'basic' | 'premium';
  planLabel?: string;
  coverageAmount: number;
  premiumPerCycle: number;
  deductibleRate: number;
  maxClaimsPerCycle: number;
  claimsUsed: number;
  claimsThisCycle?: number;
  lastPremiumAtMs?: number;
  status: 'active' | 'cancelled' | 'lapsed';
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface InsuranceClaimDoc {
  id: string;
  insuranceId: string;
  ownerId: string;
  subjectId: string;
  crimeRecordId: string;
  lossAmount: number;
  payoutAmount: number;
  status: 'approved' | 'paid' | 'rejected';
  filedAtMs: number;
}

export interface NpcStateDoc {
  id: string;
  name: string;
  role: string;
  currentZone: ZoneId;
  activity: string;
  mood?: string;
  homePos: { x: number; z: number };
  workPos: { x: number; z: number };
  inventory?: string[];
  trustDefault?: number;
  updatedAtMs: number;
}

export interface NpcMemoryDoc {
  id: string;
  uid: string;
  npcId: string;
  affinity: number;
  trustScore?: number;
  moodTowardsPlayer?: 'ramah' | 'netral' | 'curiga' | 'kesal';
  interactionCount: number;
  summary: string;
  lastActivity?: string;
  lastMessageAtMs?: number;
  expiresAtMs?: number;
}

export interface QuestTemplateDoc {
  id: string;
  npcId: string;
  npcName: string;
  title: string;
  description: string;
  type: 'deliver' | 'find' | 'help_business' | 'report_crime' | 'gotong_royong';
  objective: {
    targetNpcId?: string;
    targetPos?: { x: number; z: number };
    searchPos?: { x: number; z: number };
    checkpointPos?: { x: number; z: number };
    returnPos?: { x: number; z: number };
    targetLabel?: string;
    energyCost?: number;
    requiredCount?: number;
  };
  rewardMoney: number;
  rewardRep: number;
  rewardItemId?: string | null;
  rewardItemQty?: number;
  dailyLimit: number;
  active: boolean;
}

export interface PlayerQuestLogDoc {
  id: string;
  uid: string;
  questId: string;
  npcId: string;
  npcName: string;
  title: string;
  description: string;
  type: QuestTemplateDoc['type'];
  status: 'active' | 'completed' | 'abandoned';
  progress: number;
  targetCount: number;
  rewardMoney?: number;
  rewardRep?: number;
  rewardItemId?: string | null;
  rewardItemQty?: number;
  dayKey?: string;
  acceptedAtMs: number;
  completedAtMs?: number;
  abandonedAtMs?: number;
}

export interface MortgageDoc {
  id: string;
  borrowerId: string;
  borrowerName?: string;
  propertyId: string;
  propertyName: string;
  propertyPrice: number;
  downPayment: number;
  principal: number;
  rate: number;
  interestRate?: number;
  termCycles: number;
  paidCycles: number;
  installment: number;
  installmentAmount?: number;
  remaining: number;
  remainingPrincipal?: number;
  nextDueAtMs: number;
  missedCount: number;
  status: 'active' | 'paid' | 'foreclosed';
  createdAtMs: number;
  updatedAtMs: number;
}

export interface LandPlotDoc {
  id: string;
  name: string;
  areaTag: AreaTag;
  zone?: ZoneId;
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number };
  roadAccess: 'gang' | 'utama';
  zoning: 'residensial' | 'komersial' | 'campuran';
  price: number;
  ownerId: string;
  ownerType: 'player' | 'npc';
  ownerName: string;
  certificateId?: string;
  imbStatus: 'none' | 'pending' | 'approved';
  permitStatus?: 'none' | 'pending' | 'approved';
  imbSubmittedAtMs?: number | null;
  imbReadyAtMs?: number | null;
  permitReadyAtMs?: number | null;
  imbFeePaid?: number;
  constructionId?: string | null;
  builtPropertyId?: string | null;
  propertyId?: string | null;
  status: 'available' | 'owned' | 'building' | 'built';
  updatedAtMs?: number;
}

export type ConstructionPhase = 'pondasi' | 'dinding' | 'atap' | 'finishing' | 'selesai';

export interface ConstructionDoc {
  id: string;
  plotId: string;
  plotName?: string;
  ownerId: string;
  ownerName: string;
  blueprintId: 'kecil' | 'sedang' | 'besar';
  blueprintName: string;
  propertyType?: PropertyType;
  contractorType: 'npc' | 'player';
  contractorFee?: number;
  totalCost?: number;
  phase: ConstructionPhase;
  phaseIndex: number;
  phaseDurationMs: number;
  phaseStartedAtMs: number;
  phaseEndsAtMs?: number;
  startedAtMs: number;
  completedAtMs?: number | null;
  estimatedMarketValue?: number;
  baseRent?: number;
  status: 'in_progress' | 'completed_unclaimed' | 'claimed' | 'active' | 'completed';
  builtPropertyId?: string | null;
  propertyId?: string | null;
  devProjectId?: string | null;
  updatedAtMs?: number;
}

export interface RenovationDoc {
  id: string;
  propertyId: string;
  propertyName?: string;
  ownerId: string;
  renovationType: 'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage';
  label: string;
  cost: number;
  valueBoost: number;
  startedAtMs: number;
  completesAtMs: number;
  status: 'active' | 'in_progress' | 'completed';
  completedAtMs?: number;
}

export interface AgentClientRequestDoc {
  id: string;
  agentId: string;
  clientName: string;
  isNpc?: boolean;
  desiredArea: AreaTag | 'any';
  desiredType: PropertyType | 'any';
  desiredKind: 'sale' | 'rent';
  maxBudget: number;
  commissionRate?: number;
  matchedListingId?: string | null;
  matchedPropertyName?: string | null;
  commissionEarned?: number;
  status: 'open' | 'closed' | 'cancelled';
  createdAtMs: number;
  closedAtMs?: number;
}

export interface DevelopmentProjectDoc {
  id: string;
  developerId: string;
  developerName: string;
  name: string;
  plotIds: string[];
  constructionIds: string[];
  propertyIds: string[];
  totalCapitalSpent: number;
  totalRevenue: number;
  status: 'planning' | 'building' | 'selling' | 'completed';
  createdAtMs: number;
}

export interface LawConfigDoc {
  policeStation: {
    x: number;
    z: number;
    label: string;
    jailCenter: { x: number; y: number; z: number };
    jailRadius: number;
    releaseSpawn: { x: number; y: number; z: number };
  };
  crimeCooldownSec: number;
  wantedMax: number;
  wantedDecayPerGameHour: number;
  witnessRadiusMeters: number;
  cctvZones: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    radius: number;
    catchBonus: number;
  }>;
  nightHours: { start: number; end: number; catchRiskDelta: number };
  bailMultiplierOfFine: number;
  appealFee: number;
  appealSuccessChance: number;
  appealSentenceReductionRatio: number;
  prisonWorkCooldownSec: number;
  prisonWorkSentenceCutSec: number;
  prisonWorkPay: number;
  policeEnforcement?: {
    arrestRadiusMeters: number;
    arrestCooldownPerTargetSec: number;
    evidenceMaxAgeMs: number;
    arrestReward: number;
    fineCommissionRate: number;
    abuseMaxStrikes: number;
    abusePenaltyFine: number;
    abuseSuspensionMs: number;
  };
  securityModules: Record<
    SecurityModuleId,
    { id: SecurityModuleId; label: string; installCost: number; monthlyCost: number; protection: number }
  >;
  insurancePlans: Record<
    'basic' | 'premium',
    {
      id: 'basic' | 'premium';
      label: string;
      coverageAmount: number;
      premiumPerCycle: number;
      deductibleRate: number;
      maxClaimsPerCycle: number;
    }
  >;
  offenses: Array<{
    id: string;
    title: string;
    severity: 1 | 2 | 3;
    targetTypes: string[];
    baseCatchChance: number;
    rewardMin: number;
    rewardMax: number;
    fine: number;
    sentenceSec: number;
    wantedDelta: number;
    reputationDelta: number;
    creditScoreDelta: number;
  }>;
}

export interface LandConfigDoc {
  maxLandsPerPlayer: number;
  imbFeeBase: number;
  imbDurationMs: number;
  areaBasePricePerSqm: Record<AreaTag, number>;
  roadAccessMultiplier: Record<'gang' | 'utama', number>;
  plots: Array<{
    id: string;
    name: string;
    areaTag: AreaTag;
    position: { x: number; y: number; z: number };
    size: { width: number; depth: number };
    roadAccess: 'gang' | 'utama';
    zoning: 'residensial' | 'komersial' | 'campuran';
    price: number;
  }>;
}

export interface ConstructionBlueprintConfig {
  id: 'kecil' | 'sedang' | 'besar';
  name: string;
  propertyType: PropertyType;
  rooms: number;
  size: { width: number; depth: number };
  layout: PropertyLayout;
  laborCost: number;
  phaseDurationSec: number;
  materials: Record<string, number>;
  estimatedMarketValue: number;
  baseRent: number;
}

export interface RenovationConfigItem {
  id: 'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage';
  label: string;
  cost: number;
  durationSec: number;
  materials: Record<string, number>;
  valueBoost: number;
  roomsDelta?: number;
  gridDelta?: number;
  moodBonus?: number;
  securityBonus?: number;
}

export interface FurnitureSetConfigItem {
  id: string;
  name: string;
  theme: string;
  itemIds: string[];
  bundlePrice: number;
  normalPrice: number;
  bonusMood: number;
  bonusValue: number;
}

export interface ConstructionConfigDoc {
  phasesOrder: ConstructionPhase[];
  contractorFeeRate: { npc: number; player: number };
  blueprints: Record<'kecil' | 'sedang' | 'besar', ConstructionBlueprintConfig>;
  renovations: Record<'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage', RenovationConfigItem>;
  furnitureSets: FurnitureSetConfigItem[];
  agentSettings: {
    officePos: { x: number; z: number; label: string };
    licenseFee: number;
    minKomunikasi: number;
    minHitung: number;
    minReputation: number;
    baseCommissionRate: number;
    premiumListingFee: number;
    developerMinCapital: number;
  };
}

export interface MortgageConfigDoc {
  minCreditScore: number;
  minReputation: number;
  maxWantedLevelAllowed: number;
  minCompletedShifts: number;
  maxActiveMortgages: number;
  minDownPaymentRate: number;
  maxDownPaymentRate: number;
  cycleMs: number;
  gracePeriodMs: number;
  lateFeeRate: number;
  maxMissedBeforeForeclosure: number;
  earlyRepayPenaltyRate: number;
  foreclosureAuctionDurationMs: number;
  foreclosureStartPriceRatio: number;
  tenors: Array<{ termCycles: number; label: string; interestRatePerTerm: number }>;
}

export interface QuestsConfigDoc {
  maxActiveQuestsPerPlayer: number;
  maxCompletedQuestsPerDay: number;
  maxDailyQuestMoneyCap: number;
  quests: QuestTemplateDoc[];
}

export interface Phase6AiConfigDoc {
  provider: string;
  model: string;
  dailyCallsLimit: number;
  dailyTokenLimit: number;
  maxInputChars: number;
  maxOutputTokens: number;
}

// --- SISTEM KENDARAAN (MOTOR, MOBIL, DEALER, SPBU, BENGKEL, SAMSAT, TRAFFIC) ---

export type VehicleCategory = 'motor' | 'mobil';
export type VehicleStatus =
  | 'parked'
  | 'driving'
  | 'impounded'
  | 'in_workshop'
  | 'listed'
  | 'auctioning'
  | 'stolen';
export type VehicleParkedType =
  | 'garage'
  | 'parking_lot'
  | 'roadside'
  | 'dealer'
  | 'workshop'
  | 'impound';

export interface VehicleModelConfig {
  id: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  subType: string;
  sellable: boolean;
  isElectric?: boolean;
  requiredSim?: 'C' | 'A';
  maxSpeedMps: number;
  acceleration: number;
  handling: number;
  tankCapacity: number;
  consumptionPerKm: number;
  seats: number;
  trunkCapacity: number;
  newPrice: number;
  usedPriceMin: number;
  usedPriceMax: number;
  serviceCostBase: number;
  annualTax: number;
  wearRatePerKm: number;
  colors: string[];
  dimensions: { width: number; height: number; length: number };
}

export interface VehicleDoc {
  id: string;
  ownerId: string;
  ownerName?: string;
  modelId: string;
  category: VehicleCategory;
  name: string;
  plateNumber: string;
  color: string;
  condition: number;
  odometerKm: number;
  fuel: number;
  fuelCapacity: number;
  isElectric?: boolean;
  registeredAtMs: number;
  stnkExpiresAtMs: number;
  taxLastPaidAtMs: number;
  lastMaintenanceAtMs?: number;
  lastWearAtMs?: number;
  insuranceId?: string | null;
  hasInsurance?: boolean;
  leaseId?: string | null;
  garagePropertyId?: string | null;
  parkedPos: WorldPosition & { zone: ZoneId };
  parkedType: VehicleParkedType;
  status: VehicleStatus;
  impoundReason?: string | null;
  impoundedAtMs?: number | null;
  impoundFine?: number;
  driverId?: string | null;
  passengerIds?: string[];
  isPublicActive?: boolean;
  activeListingId?: string | null;
  activeAuctionId?: string | null;
  accessories?: string[];
  purchasePrice?: number;
  isUsed?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DriverLicenseEntry {
  active: boolean;
  licenseNumber: string;
  issuedAtMs: number;
  expiresAtMs: number;
  lastExamScore: number;
  attempts: number;
}

export interface DriverLicenseDoc {
  uid: string;
  simA: DriverLicenseEntry | null;
  simC: DriverLicenseEntry | null;
  updatedAtMs: number;
}

export interface VehicleLeaseDoc {
  id: string;
  borrowerId: string;
  borrowerName?: string;
  vehicleId: string;
  modelId: string;
  vehicleName: string;
  vehiclePrice: number;
  downPayment: number;
  principal: number;
  rate: number;
  termCycles: number;
  paidCycles: number;
  installment: number;
  remaining: number;
  nextDueAtMs: number;
  missedCount: number;
  status: 'active' | 'paid' | 'repossessed';
  createdAtMs: number;
  updatedAtMs: number;
}

export interface VehicleServiceLogDoc {
  id: string;
  vehicleId: string;
  ownerId: string;
  serviceType:
    | 'refuel'
    | 'charge'
    | 'oil_change'
    | 'repair'
    | 'paint'
    | 'accessory'
    | 'registration'
    | 'tow_recovery';
  providerType: 'npc' | 'player_business' | 'spbu' | 'samsat';
  businessId?: string | null;
  cost: number;
  conditionBefore?: number;
  conditionAfter?: number;
  details: string;
  createdAtMs: number;
}

export interface VehicleListingDoc {
  id: string;
  vehicleId: string;
  ownerId: string;
  ownerName: string;
  sellerBusinessId?: string | null;
  modelId: string;
  vehicleName: string;
  category: VehicleCategory;
  plateNumber: string;
  color: string;
  condition: number;
  odometerKm: number;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface VehicleTestDriveDoc {
  uid: string;
  dealerId: string;
  modelId: string;
  color: string;
  startedAtMs: number;
  expiresAtMs: number;
  zone: ZoneId;
  status: 'active' | 'ended' | 'expired';
}

export interface VehicleAccessoryConfigItem {
  id: string;
  label: string;
  category: 'motor' | 'mobil' | 'all';
  cost: number;
  trunkBonus: number;
}

export interface VehiclesConfigDoc {
  maxOwnedVehiclesPerPlayer: number;
  platePrefix: string;
  stnkPeriodMs: number;
  stnkGracePeriodMs: number;
  stnkLatePenaltyRate: number;
  stnkAdminFee: number;
  transferTitleFeeRate: number;
  roadsideImpoundAfterMs: number;
  roadsideTheftRiskPerHour: number;
  impoundRecoveryBaseFee: number;
  impoundDailyStorageFee: number;
  fuelPrices: {
    bensinPerUnit: number;
    electricPerPercent: number;
  };
  licenseSettings: {
    simC: { label: string; fee: number; passScore: number; validMs: number; fineWithoutSim: number };
    simA: { label: string; fee: number; passScore: number; validMs: number; fineWithoutSim: number };
  };
  maintenanceSettings: {
    oilChangeCostBase: number;
    oilIntervalKm: number;
    repairPerConditionPoint: number;
    repaintCost: number;
    accessoryBaseCost: number;
    playerWorkshopMarginRate: number;
  };
  depreciation: {
    perGameDayRate: number;
    minValueRatio: number;
    odometerFactorPer100Km: number;
    conditionMinFactor: number;
  };
  accessories: VehicleAccessoryConfigItem[];
  models: VehicleModelConfig[];
}

export interface TrafficConfigDoc {
  enabled: boolean;
  laneOffsetRatio: number;
  speedLimitsMps: Record<'arteri' | 'kolektor' | 'lingkungan' | 'gang', number>;
  speedingToleranceMps: number;
  maxActiveNpcVehiclesMobile: number;
  maxActiveNpcVehiclesDesktop: number;
  cullRadiusMeters: number;
  lodSimpleRadiusMeters: number;
  trafficLightCycleMs: number;
  trafficLightGreenMs: number;
  trafficLightYellowMs: number;
  trafficLights: Array<{
    id: string;
    label: string;
    x: number;
    z: number;
    ewRoadId: string;
    nsRoadId: string;
    phaseOffsetMs: number;
  }>;
  densityByHour: Array<{ startHour: number; endHour: number; density: number }>;
  halteSpots: Array<{ id: string; label: string; x: number; z: number; roadId: string }>;
  npcPoolWeights: Array<{ modelId: string; weight: number }>;
  trafficOffenseFines: {
    noSimC: number;
    noSimA: number;
    expiredStnk: number;
    speeding: number;
    redLight: number;
    illegalParking: number;
    railwayGateViolation: number;
    pedestrianCollision?: number;
  };
  pedestrianFaintSec?: number;
}

export interface DealerConfigDoc {
  leasing: {
    minCreditScore: number;
    minCompletedShifts: number;
    maxActiveLeases: number;
    maxWantedLevelAllowed: number;
    minDownPaymentRate: number;
    maxDownPaymentRate: number;
    cycleMs: number;
    gracePeriodMs: number;
    lateFeeRate: number;
    maxMissedBeforeRepossess: number;
    tenors: Array<{ termCycles: number; label: string; interestRatePerTerm: number }>;
  };
  tradeIn: {
    valuationRatio: number;
    minConditionAccepted: number;
    maxOdometerKmAccepted: number;
  };
  testDrive: {
    durationSec: number;
    maxRadiusMeters: number;
    fee: number;
    cooldownSec: number;
  };
  marketplace: {
    listingFee: number;
    escrowFeeRate: number;
    titleTransferTaxRate: number;
    minPriceRatio: number;
    maxPriceRatio: number;
  };
  dealers: Array<{
    id: string;
    name: string;
    kind: 'motor_new' | 'motor_used' | 'mobil_new' | 'mobil_used';
    isUsed: boolean;
    category: VehicleCategory;
    lotId: string;
    modelIds: string[];
  }>;
  services: {
    spbu: { id: string; name: string; lotId: string };
    bengkel: { id: string; name: string; lotId: string };
    samsat: { id: string; name: string; lotId: string };
  };
}

