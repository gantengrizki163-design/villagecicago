import aiJson from '../../../functions/src/config/ai.json';
import bankJson from '../../../functions/src/config/bank.json';
import businessJson from '../../../functions/src/config/business.json';
import clinicJson from '../../../functions/src/config/clinic.json';
import constructionJson from '../../../functions/src/config/construction.json';
import coursesJson from '../../../functions/src/config/courses.json';
import dealerJson from '../../../functions/src/config/dealer.json';
import economyJson from '../../../functions/src/config/economy.json';
import furnitureJson from '../../../functions/src/config/furniture.json';
import housingJson from '../../../functions/src/config/housing.json';
import jobsJson from '../../../functions/src/config/jobs.json';
import landJson from '../../../functions/src/config/land.json';
import lawJson from '../../../functions/src/config/law.json';
import mortgageJson from '../../../functions/src/config/mortgage.json';
import productsJson from '../../../functions/src/config/products.json';
import questsJson from '../../../functions/src/config/quests.json';
import taxJson from '../../../functions/src/config/tax.json';
import trafficJson from '../../../functions/src/config/traffic.json';
import trainScheduleJson from '../../../functions/src/config/trainSchedule.json';
import vehiclesJson from '../../../functions/src/config/vehicles.json';
import type {
  AgentClientRequestDoc,
  AreaTag,
  AuctionBidDoc,
  AuctionDoc,
  AuctionSubjectType,
  BankAccountDoc,
  BillDoc,
  BusinessDailyReportDoc,
  BusinessDoc,
  BusinessEmployeeDoc,
  BusinessJobPostDoc,
  BusinessStockDoc,
  BusinessType,
  CharacterDoc,
  CharacterStatsDoc,
  ConstructionDoc,
  CrimeRecordDoc,
  DevelopmentProjectDoc,
  DriverLicenseDoc,
  FurniturePlacement,
  InsuranceClaimDoc,
  InsurancePolicyDoc,
  InventoryItemDoc,
  JobConfigItem,
  LandPlotDoc,
  LeaseDoc,
  LedgerEntryDoc,
  LoanDoc,
  MarketListingDoc,
  MarketStatDoc,
  MortgageDoc,
  NpcMemoryDoc,
  OfferDoc,
  PlayerQuestLogDoc,
  PoliceActionDoc,
  PropertyDoc,
  PropertyListingDoc,
  PropertyType,
  QuestTemplateDoc,
  RenovationDoc,
  SecurityInstallDoc,
  SecurityModuleId,
  SentenceDoc,
  ShopMenuItem,
  SkillKey,
  SkillsMap,
  TransactionDoc,
  TreasuryStateDoc,
  VehicleDoc,
  VehicleLeaseDoc,
  VehicleListingDoc,
  VehicleModelConfig,
  VehicleParkedType,
  VehicleServiceLogDoc,
  VehicleTestDriveDoc,
  WorldPosition,
  ZoneId,
} from '../types/game';
import {
  DEFAULT_GAME_CONFIG,
  distance2D,
  INITIAL_LISTINGS_DATA,
  INITIAL_PROPERTIES_DATA,
  STATION_SPAWN,
} from '../world3d/worldConstants';
import { computeClientLazyStats, getGameClockInfo } from './gameTime';
import { DEFAULT_NPCS_CONFIG } from './npcDeterminism';
import { getDeterministicTrainState } from './phase2ConfigCache';
import { getDefaultMarketStats, getDefaultTreasuryState } from './phase4ConfigCache';
import {
  computeLandPlotPriceClient,
  computeLazyWantedClient,
  computeMortgageQuoteClient,
  getDefaultLandPlots,
} from './phase6ConfigCache';
import {
  computeBestVehicleCargoBonus,
  computeLazyStnkStatusClient,
  computeVehicleLeaseQuoteClient,
  computeVehicleMarketValueClient,
  evaluateVehicleJobEligibilityClient,
  getVehicleModelById,
} from './vehicleConfigCache';

export const PREVIEW_SHOP_MENU: ShopMenuItem[] = [
  {
    id: 'nasi_telur',
    name: 'Nasi + Telur',
    description: 'Sangu haneut jeung endog dadar ala Warung Teh Neng.',
    price: 12000,
    hungerRestore: 45,
    thirstRestore: 0,
    energyRestore: 10,
    available: true,
  },
  {
    id: 'mie_rebus',
    name: 'Mie Rebus',
    description: 'Mie kuah haneut maké sawi jeung bawang goreng.',
    price: 10000,
    hungerRestore: 35,
    thirstRestore: 10,
    energyRestore: 8,
    available: true,
  },
  {
    id: 'es_teh',
    name: 'Es Teh Manis',
    description: 'Teh amis tiis nyegerkeun tikoro tengah poé.',
    price: 5000,
    hungerRestore: 0,
    thirstRestore: 35,
    energyRestore: 5,
    available: true,
  },
  {
    id: 'air_mineral',
    name: 'Air Mineral',
    description: 'Cai herang seger pangilang hanaang.',
    price: 4000,
    hungerRestore: 0,
    thirstRestore: 45,
    energyRestore: 5,
    available: true,
  },
];

const GURU_QUESTIONS = [
  { q: 'Ibu kota Kabupaten Bandung adalah...', options: ['Soreang', 'Cimahi', 'Garut'], ans: 0 },
  { q: 'Kecamatan Cicalengka berada di ketinggian sekitar...', options: ['689 mdpl', '50 mdpl', '2500 mdpl'], ans: 0 },
  { q: 'Hasil dari 14 x 5 - 12 adalah...', options: ['58', '62', '48'], ans: 0 },
  { q: 'Kata "Nuhun" dalam Bahasa Sunda berarti...', options: ['Permisi', 'Terima kasih', 'Selamat pagi'], ans: 1 },
];

const KURIR_TARGETS = [
  { id: 'alun', label: 'Pendopo Alun-Alun', x: -6, z: 5.5 },
  { id: 'warung', label: 'Warung Teh Neng', x: -30, z: -17 },
  { id: 'kontrakan', label: 'Kontrakan 3 Selatan', x: -8, z: 45 },
  { id: 'pasar', label: 'Gerbang Pasar Cicalengka', x: 46, z: -4 },
  { id: 'puskesmas', label: 'Halaman Puskesmas', x: -48, z: -16 },
];

const OJEK_ORDER_PAIRS = [
  {
    pickup: { id: 'ojek_pick_stasiun', label: 'Jemput Penumpang: Stasiun', x: 4, z: -40 },
    dropoff: { id: 'ojek_drop_pasar', label: 'Antar ke Pasar Sehat', x: 44, z: -10 },
  },
  {
    pickup: { id: 'ojek_pick_alun', label: 'Jemput Penumpang: Alun-Alun', x: 0, z: -10 },
    dropoff: { id: 'ojek_drop_sekolah', label: 'Antar ke Balai Kursus', x: -48, z: 43 },
  },
  {
    pickup: { id: 'ojek_pick_bank', label: 'Jemput Penumpang: Bank Priangan', x: -44, z: -4 },
    dropoff: { id: 'ojek_drop_kontrakan', label: 'Antar ke Kontrakan Selatan', x: -8, z: 45 },
  },
];

const LOGISTIK_DELIVERY_SPOTS = [
  { id: 'log_minimarket', label: 'Bongkar Muatan: Minimarket Cicalengka', x: 30, z: -16 },
  { id: 'log_warung', label: 'Bongkar Muatan: Warung Teh Neng', x: -30, z: -16 },
  { id: 'log_pasar', label: 'Bongkar Muatan: Pasar Sehat', x: 44, z: -10 },
  { id: 'log_mebel', label: 'Bongkar Muatan: Toko Mebel Jaya', x: -6, z: -16 },
];

export interface LocalSimulationState {
  active: boolean;
  character: CharacterDoc | null;
  stats: CharacterStatsDoc | null;
  transactions: TransactionDoc[];
  bills: BillDoc[];
  properties: PropertyDoc[];
  listings: PropertyListingDoc[];
  offers: OfferDoc[];
  leases: LeaseDoc[];
  inventory: InventoryItemDoc[];
  bankAccount: BankAccountDoc | null;
  loans: LoanDoc[];
  ledger: LedgerEntryDoc[];
  businesses: BusinessDoc[];
  businessStock: Record<string, BusinessStockDoc[]>;
  businessEmployees: Record<string, BusinessEmployeeDoc[]>;
  businessReports: Record<string, BusinessDailyReportDoc[]>;
  businessJobPosts: BusinessJobPostDoc[];
  marketListings: MarketListingDoc[];
  auctions: AuctionDoc[];
  auctionBids: Record<string, AuctionBidDoc[]>;
  marketStats: MarketStatDoc[];
  treasury: TreasuryStateDoc;
  // Fase 6 state
  crimeRecords: CrimeRecordDoc[];
  policeActions: PoliceActionDoc[];
  sentence: SentenceDoc | null;
  securityInstalls: SecurityInstallDoc[];
  insurancePolicies: InsurancePolicyDoc[];
  insuranceClaims: InsuranceClaimDoc[];
  npcMemories: NpcMemoryDoc[];
  questLogs: PlayerQuestLogDoc[];
  mortgages: MortgageDoc[];
  landPlots: LandPlotDoc[];
  constructions: ConstructionDoc[];
  renovations: RenovationDoc[];
  agentClients: AgentClientRequestDoc[];
  devProjects: DevelopmentProjectDoc[];
  // Sistem Kendaraan state
  vehicles: VehicleDoc[];
  driverLicense: DriverLicenseDoc | null;
  vehicleLeases: VehicleLeaseDoc[];
  vehicleListings: VehicleListingDoc[];
  vehicleTestDrive: VehicleTestDriveDoc | null;
  vehicleServiceLogs: VehicleServiceLogDoc[];
}

type Listener = (state: LocalSimulationState) => void;

function createInitialProperties(): PropertyDoc[] {
  return INITIAL_PROPERTIES_DATA.map((p) => ({
    ...p,
    stationDistanceTier:
      distance2D(p.position.x, p.position.z, STATION_SPAWN.x, STATION_SPAWN.z) <= 38
        ? 'dekat'
        : distance2D(p.position.x, p.position.z, STATION_SPAWN.x, STATION_SPAWN.z) <= 75
          ? 'sedang'
          : 'jauh',
    activeListingId: `lst_${p.id}`,
    activeLeaseId: null,
    viewingSchedule: { open24h: true, startHour: 7, endHour: 21 },
    furniture: [...p.furniture],
  }));
}

function createInitialListings(): PropertyListingDoc[] {
  return INITIAL_LISTINGS_DATA.map((l) => ({
    ...l,
    stationDistanceTier:
      (l.stationDistanceMeters ?? 60) <= 38
        ? 'dekat'
        : (l.stationDistanceMeters ?? 60) <= 75
          ? 'sedang'
          : 'jauh',
  }));
}

class LocalSimulationEngine {
  private state: LocalSimulationState = {
    active: false,
    character: null,
    stats: null,
    transactions: [],
    bills: [],
    properties: createInitialProperties(),
    listings: createInitialListings(),
    offers: [],
    leases: [],
    inventory: [],
    bankAccount: null,
    loans: [],
    ledger: [],
    businesses: [],
    businessStock: {},
    businessEmployees: {},
    businessReports: {},
    businessJobPosts: [],
    marketListings: [],
    auctions: [],
    auctionBids: {},
    marketStats: getDefaultMarketStats(),
    treasury: getDefaultTreasuryState(),
    crimeRecords: [],
    policeActions: [],
    sentence: null,
    securityInstalls: [],
    insurancePolicies: [],
    insuranceClaims: [],
    npcMemories: [],
    questLogs: [],
    mortgages: [],
    landPlots: getDefaultLandPlots(),
    constructions: [],
    renovations: [],
    agentClients: [],
    devProjects: [],
    vehicles: [],
    driverLicense: null,
    vehicleLeases: [],
    vehicleListings: [],
    vehicleTestDrive: null,
    vehicleServiceLogs: [],
  };
  private shiftSecrets: Record<string, Record<string, unknown>> = {};
  private guestAccessMap: Record<string, Record<string, number>> = {};
  private listeners = new Set<Listener>();
  private fallbackContext: { char: CharacterDoc | null; stats: CharacterStatsDoc | null } = {
    char: null,
    stats: null,
  };

  private getStorageKey(uid: string) {
    return `cicalengka_local_sim_v1_${uid}`;
  }

  private persistToStorage() {
    if (typeof window === 'undefined') return;
    if (!this.state.active || !this.state.character?.uid) return;
    try {
      const payload = {
        version: 1,
        savedAtMs: Date.now(),
        state: this.state,
        shiftSecrets: this.shiftSecrets,
        guestAccessMap: this.guestAccessMap,
      };
      window.localStorage.setItem(
        this.getStorageKey(this.state.character.uid),
        JSON.stringify(payload)
      );
    } catch {
      // Abaikan error quota atau mode privat browser
    }
  }

  hasSavedState(uid: string): { savedAtMs: number; charUpdatedAtMs: number } | null {
    if (typeof window === 'undefined' || !uid) return null;
    try {
      const raw = window.localStorage.getItem(this.getStorageKey(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        savedAtMs?: number;
        state?: LocalSimulationState;
      };
      if (!parsed?.state?.active || parsed?.state?.character?.uid !== uid) return null;
      return {
        savedAtMs: Number(parsed.savedAtMs || 0),
        charUpdatedAtMs: Number(parsed.state.character.updatedAt || 0),
      };
    } catch {
      return null;
    }
  }

  restoreFromStorage(uid: string): boolean {
    if (typeof window === 'undefined' || !uid) return false;
    try {
      const raw = window.localStorage.getItem(this.getStorageKey(uid));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        version?: number;
        state?: LocalSimulationState;
        shiftSecrets?: Record<string, Record<string, unknown>>;
        guestAccessMap?: Record<string, Record<string, number>>;
      };
      const savedState = parsed?.state;
      if (!savedState?.active || !savedState.character || savedState.character.uid !== uid) {
        return false;
      }
      this.state = {
        active: true,
        character: savedState.character,
        stats: savedState.stats ?? {
          uid,
          hunger: 100,
          thirst: 100,
          energy: 100,
          health: savedState.character.health ?? 100,
          hygiene: savedState.character.hygiene ?? 100,
          mood: savedState.character.mood ?? 80,
          lastCalculatedAt: Date.now(),
        },
        transactions: Array.isArray(savedState.transactions) ? savedState.transactions : [],
        bills: Array.isArray(savedState.bills) ? savedState.bills : [],
        properties:
          Array.isArray(savedState.properties) && savedState.properties.length > 0
            ? savedState.properties
            : createInitialProperties(),
        listings:
          Array.isArray(savedState.listings) && savedState.listings.length > 0
            ? savedState.listings
            : createInitialListings(),
        offers: Array.isArray(savedState.offers) ? savedState.offers : [],
        leases: Array.isArray(savedState.leases) ? savedState.leases : [],
        inventory: Array.isArray(savedState.inventory) ? savedState.inventory : [],
        bankAccount: savedState.bankAccount ?? null,
        loans: Array.isArray(savedState.loans) ? savedState.loans : [],
        ledger: Array.isArray(savedState.ledger) ? savedState.ledger : [],
        businesses: Array.isArray(savedState.businesses) ? savedState.businesses : [],
        businessStock: savedState.businessStock ?? {},
        businessEmployees: savedState.businessEmployees ?? {},
        businessReports: savedState.businessReports ?? {},
        businessJobPosts: Array.isArray(savedState.businessJobPosts) ? savedState.businessJobPosts : [],
        marketListings: Array.isArray(savedState.marketListings) ? savedState.marketListings : [],
        auctions: Array.isArray(savedState.auctions) ? savedState.auctions : [],
        auctionBids: savedState.auctionBids ?? {},
        marketStats:
          Array.isArray(savedState.marketStats) && savedState.marketStats.length > 0
            ? savedState.marketStats
            : getDefaultMarketStats(),
        treasury: savedState.treasury ?? getDefaultTreasuryState(),
        crimeRecords: Array.isArray(savedState.crimeRecords) ? savedState.crimeRecords : [],
        policeActions: Array.isArray(savedState.policeActions) ? savedState.policeActions : [],
        sentence: savedState.sentence ?? null,
        securityInstalls: Array.isArray(savedState.securityInstalls) ? savedState.securityInstalls : [],
        insurancePolicies: Array.isArray(savedState.insurancePolicies) ? savedState.insurancePolicies : [],
        insuranceClaims: Array.isArray(savedState.insuranceClaims) ? savedState.insuranceClaims : [],
        npcMemories: Array.isArray(savedState.npcMemories) ? savedState.npcMemories : [],
        questLogs: Array.isArray(savedState.questLogs) ? savedState.questLogs : [],
        mortgages: Array.isArray(savedState.mortgages) ? savedState.mortgages : [],
        landPlots:
          Array.isArray(savedState.landPlots) && savedState.landPlots.length > 0
            ? savedState.landPlots
            : getDefaultLandPlots(),
        constructions: Array.isArray(savedState.constructions) ? savedState.constructions : [],
        renovations: Array.isArray(savedState.renovations) ? savedState.renovations : [],
        agentClients: Array.isArray(savedState.agentClients) ? savedState.agentClients : [],
        devProjects: Array.isArray(savedState.devProjects) ? savedState.devProjects : [],
        vehicles: Array.isArray(savedState.vehicles) ? savedState.vehicles : [],
        driverLicense: savedState.driverLicense ?? null,
        vehicleLeases: Array.isArray(savedState.vehicleLeases) ? savedState.vehicleLeases : [],
        vehicleListings: Array.isArray(savedState.vehicleListings) ? savedState.vehicleListings : [],
        vehicleTestDrive: savedState.vehicleTestDrive ?? null,
        vehicleServiceLogs: Array.isArray(savedState.vehicleServiceLogs) ? savedState.vehicleServiceLogs : [],
      };
      this.shiftSecrets = parsed.shiftSecrets ?? {};
      this.guestAccessMap = parsed.guestAccessMap ?? {};
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.persistToStorage();
    for (const l of this.listeners) l({ ...this.state });
  }

  isActive() {
    return this.state.active;
  }

  setFallbackContext(char: CharacterDoc | null, stats: CharacterStatsDoc | null) {
    this.fallbackContext = { char, stats };
  }

  activateFromContextIfNeeded() {
    if (!this.state.active && this.fallbackContext.char) {
      const c = this.fallbackContext.char;
      const stats: CharacterStatsDoc = this.fallbackContext.stats ?? {
        uid: c.uid,
        hunger: 100,
        thirst: 100,
        energy: 100,
        health: c.health ?? 100,
        hygiene: c.hygiene ?? 100,
        mood: c.mood ?? 80,
        lastCalculatedAt: Date.now(),
      };
      this.seedFromFirestore(c, stats);
    }
  }

  seedFromFirestore(char: CharacterDoc | null, stats: CharacterStatsDoc | null) {
    if (!this.state.active && char) {
      const resolvedStats: CharacterStatsDoc = stats ?? {
        uid: char.uid,
        hunger: 100,
        thirst: 100,
        energy: 100,
        health: char.health ?? 100,
        hygiene: char.hygiene ?? 100,
        mood: char.mood ?? 80,
        lastCalculatedAt: Date.now(),
      };
      this.state = {
        ...this.state,
        active: true,
        character: {
          ...char,
          health: char.health ?? resolvedStats.health ?? 100,
          hygiene: char.hygiene ?? resolvedStats.hygiene ?? 100,
          mood: char.mood ?? resolvedStats.mood ?? 80,
          currentZone: char.currentZone ?? 'cicalengka',
          skills: char.skills ?? { komunikasi: 0, fisik: 0, hitung: 0, teknis: 0 },
          homeless: typeof char.homeless === 'boolean' ? char.homeless : !char.currentHomeId,
          reputation: char.reputation ?? 60,
        },
        stats: resolvedStats,
      };
      this.ensureInitialDemoBill();
      this.emit();
    }
  }

  switchSimulatedCitizen(char: CharacterDoc, stats?: CharacterStatsDoc | null) {
    const resolvedStats: CharacterStatsDoc = stats ?? {
      uid: char.uid,
      hunger: 100,
      thirst: 100,
      energy: 100,
      health: char.health ?? 100,
      hygiene: char.hygiene ?? 100,
      mood: char.mood ?? 80,
      lastCalculatedAt: Date.now(),
    };
    this.state = {
      ...this.state,
      active: true,
      character: { ...char },
      stats: resolvedStats,
    };
    this.emit();
  }

  activateNewCharacter(
    uid: string,
    payload: {
      name: string;
      gender: 'laki-laki' | 'perempuan';
      skinColor: string;
      hairColor: string;
      shirtColor: string;
      pantsColor: string;
    }
  ) {
    const now = Date.now();
    this.state = {
      active: true,
      character: {
        uid,
        name: payload.name,
        nameLower: payload.name.toLowerCase(),
        gender: payload.gender,
        skinColor: payload.skinColor,
        hairColor: payload.hairColor,
        shirtColor: payload.shirtColor,
        pantsColor: payload.pantsColor,
        money: 100_000,
        health: 100,
        hygiene: 100,
        mood: 80,
        statsUpdatedAt: now,
        currentZone: 'cicalengka',
        skills: { komunikasi: 0, fisik: 0, hitung: 0, teknis: 0 },
        currentJob: null,
        activeShift: null,
        activeTrip: null,
        activeClinic: null,
        activeCourse: null,
        faintedCount: 0,
        lastBillPeriod: 0,
        currentHomeId: null,
        activeLeaseId: null,
        homeless: true,
        reputation: 60,
        starterHousingClaimed: false,
        respawnAtHome: true,
        lastPosition: STATION_SPAWN,
        createdAt: now,
        updatedAt: now,
      },
      stats: {
        uid,
        hunger: 100,
        thirst: 100,
        energy: 100,
        health: 100,
        hygiene: 100,
        mood: 80,
        lastCalculatedAt: now,
      },
      transactions: [
        {
          id: `tx_${now}`,
          uid,
          type: 'income',
          category: 'awal',
          amount: 100_000,
          balanceAfter: 100_000,
          description: 'Modal awal warga baru Cicalengka',
          createdAtMs: now,
        },
      ],
      bills: [],
      properties: createInitialProperties(),
      listings: createInitialListings(),
      offers: [],
      leases: [],
      inventory: [
        {
          id: 'nasi_telur',
          uid,
          itemId: 'nasi_telur',
          category: 'food',
          name: 'Nasi + Telur (Bekal Awal)',
          quantity: 1,
          hungerRestore: 45,
          thirstRestore: 0,
          energyRestore: 10,
          updatedAtMs: now,
        },
      ],
      bankAccount: null,
      loans: [],
      ledger: [],
      businesses: [],
      businessStock: {},
      businessEmployees: {},
      businessReports: {},
      businessJobPosts: [],
      marketListings: [],
      auctions: [],
      auctionBids: {},
      marketStats: getDefaultMarketStats(),
      treasury: getDefaultTreasuryState(),
      crimeRecords: [],
      policeActions: [],
      sentence: null,
      securityInstalls: [],
      insurancePolicies: [],
      insuranceClaims: [],
      npcMemories: [],
      questLogs: [],
      mortgages: [],
      landPlots: getDefaultLandPlots(),
      constructions: [],
      renovations: [],
      agentClients: [],
      devProjects: [],
      vehicles: [],
      driverLicense: null,
      vehicleLeases: [],
      vehicleListings: [],
      vehicleTestDrive: null,
      vehicleServiceLogs: [],
    };
    this.ensureInitialDemoBill();
    this.emit();
  }

  private ensureInitialDemoBill() {
    if (!this.state.character || this.state.bills.length > 0) return;
    const now = Date.now();
    const uid = this.state.character.uid;
    this.state.bills = [
      {
        id: 'elec_p1',
        uid,
        billType: 'electricity',
        title: 'Tagihan Listrik Dasar Minggu ke-1',
        periodIndex: 1,
        baseAmount: economyJson.electricityBillAmount,
        lateFee: 0,
        totalDue: economyJson.electricityBillAmount,
        status: 'unpaid',
        dueAtMs: now + economyJson.billCycleMs,
      },
    ];
  }

  reset() {
    this.state = {
      active: false,
      character: null,
      stats: null,
      transactions: [],
      bills: [],
      properties: createInitialProperties(),
      listings: createInitialListings(),
      offers: [],
      leases: [],
      inventory: [],
      bankAccount: null,
      loans: [],
      ledger: [],
      businesses: [],
      businessStock: {},
      businessEmployees: {},
      businessReports: {},
      businessJobPosts: [],
      marketListings: [],
      auctions: [],
      auctionBids: {},
      marketStats: getDefaultMarketStats(),
      treasury: getDefaultTreasuryState(),
      crimeRecords: [],
      policeActions: [],
      sentence: null,
      securityInstalls: [],
      insurancePolicies: [],
      insuranceClaims: [],
      npcMemories: [],
      questLogs: [],
      mortgages: [],
      landPlots: getDefaultLandPlots(),
      constructions: [],
      renovations: [],
      agentClients: [],
      devProjects: [],
      vehicles: [],
      driverLicense: null,
      vehicleLeases: [],
      vehicleListings: [],
      vehicleTestDrive: null,
      vehicleServiceLogs: [],
    };
    this.shiftSecrets = {};
    this.guestAccessMap = {};
    this.emit();
  }

  private addTx(
    type: 'income' | 'expense' | 'penalty',
    category: string,
    amount: number,
    balanceAfter: number,
    description: string
  ) {
    if (!this.state.character) return;
    const now = Date.now();
    this.state.transactions = [
      {
        id: `tx_${now}_${Math.random().toString(36).slice(2, 6)}`,
        uid: this.state.character.uid,
        type,
        category,
        amount,
        balanceAfter,
        description,
        createdAtMs: now,
      },
      ...this.state.transactions,
    ].slice(0, 40);
  }

  private getCurrentComputed() {
    const s = this.state.stats!;
    const c = this.state.character!;
    const lastMs = typeof s.lastCalculatedAt === 'number' ? s.lastCalculatedAt : Date.now();
    return computeClientLazyStats(
      s.hunger,
      s.thirst,
      s.energy,
      lastMs,
      Date.now(),
      DEFAULT_GAME_CONFIG,
      s.health ?? c.health ?? 100,
      s.hygiene ?? c.hygiene ?? 100,
      s.mood ?? c.mood ?? 80,
      Boolean(c.homeless)
    );
  }

  buyFood(itemId: string) {
    const item = PREVIEW_SHOP_MENU.find((m) => m.id === itemId);
    if (!item || !this.state.character || !this.state.stats) throw new Error('Menu tidak tersedia.');
    if (this.state.character.money < item.price) throw new Error('Saldo Rupiah tidak mencukupi.');

    const cur = this.getCurrentComputed();
    const money = this.state.character.money - item.price;
    const now = Date.now();

    const hunger = Math.min(100, cur.hunger + item.hungerRestore);
    const thirst = Math.min(100, cur.thirst + item.thirstRestore);
    const energy = Math.min(100, cur.energy + item.energyRestore);
    const mood = Math.min(100, cur.mood + 8);

    // Simpan juga ke stok bekal inventori agar bisa dimakan di rumah (eatFromInventory)
    const invIdx = this.state.inventory.findIndex((i) => i.itemId === item.id);
    const nextInv = [...this.state.inventory];
    if (invIdx >= 0) {
      nextInv[invIdx] = {
        ...nextInv[invIdx],
        quantity: nextInv[invIdx].quantity + 1,
        updatedAtMs: now,
      };
    } else {
      nextInv.push({
        id: item.id,
        uid: this.state.character.uid,
        itemId: item.id,
        category: 'food',
        name: item.name,
        quantity: 1,
        hungerRestore: item.hungerRestore,
        thirstRestore: item.thirstRestore,
        energyRestore: item.energyRestore,
        updatedAtMs: now,
      });
    }

    this.state.character = { ...this.state.character, money, mood, updatedAt: now };
    this.state.stats = {
      ...this.state.stats,
      hunger,
      thirst,
      energy,
      health: cur.health,
      hygiene: cur.hygiene,
      mood,
      lastCalculatedAt: now,
    };
    this.state.inventory = nextInv;
    this.addTx('expense', 'warung', item.price, money, `Beli ${item.name} di Warung Teh Neng`);
    this.emit();
    return { ok: true, money, itemName: item.name };
  }

  rest() {
    if (!this.state.character || !this.state.stats) throw new Error('Karakter belum ada.');
    const cur = this.getCurrentComputed();
    const now = Date.now();
    const energy = Math.min(100, cur.energy + 40);
    const mood = Math.min(100, cur.mood + 10);

    this.state.character = { ...this.state.character, mood, updatedAt: now };
    this.state.stats = {
      ...this.state.stats,
      ...cur,
      energy,
      mood,
      lastCalculatedAt: now,
      lastRestAt: now,
    };
    this.emit();
    return { ok: true };
  }

  takeBath() {
    if (!this.state.character || !this.state.stats) throw new Error('Karakter belum ada.');
    const cur = this.getCurrentComputed();
    const now = Date.now();
    const hygiene = Math.min(100, cur.hygiene + economyJson.bathHygieneRestore);
    const mood = Math.min(100, cur.mood + economyJson.bathMoodRestore);

    this.state.character = { ...this.state.character, hygiene, mood, updatedAt: now };
    this.state.stats = {
      ...this.state.stats,
      ...cur,
      hygiene,
      mood,
      lastCalculatedAt: now,
      lastBathAt: now,
    };
    this.emit();
    return { ok: true, hygiene, mood };
  }

  visitClinic(clinicId: string, packageId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const clinic = clinicJson.clinics.find((c) => c.id === clinicId);
    const pkg = clinic?.packages.find((p) => p.id === packageId);
    if (!clinic || !pkg) throw new Error('Paket klinik tidak valid.');
    if (this.state.character.money < pkg.cost) throw new Error('Saldo tidak cukup.');

    const now = Date.now();
    const money = this.state.character.money - pkg.cost;
    const activeClinic = {
      visitId: `clinic_${now}`,
      clinicId: clinic.id,
      clinicName: clinic.name,
      packageId: pkg.id,
      packageName: pkg.name,
      startedAtMs: now,
      completesAtMs: now + pkg.waitSec * 1000,
      healthRestore: pkg.healthRestore,
      moodRestore: pkg.moodRestore,
    };
    this.state.character = { ...this.state.character, money, activeClinic, updatedAt: now };
    this.addTx('expense', 'klinik', pkg.cost, money, `${pkg.name} di ${clinic.name}`);
    this.emit();
    return { ok: true, money, activeClinic };
  }

  claimClinic() {
    if (!this.state.character?.activeClinic || !this.state.stats) {
      throw new Error('Tidak ada antrean klinik.');
    }
    const ac = this.state.character.activeClinic;
    const now = Date.now();
    if (now < ac.completesAtMs) {
      throw new Error(`Tunggu ${Math.ceil((ac.completesAtMs - now) / 1000)} detik lagi.`);
    }
    const cur = this.getCurrentComputed();
    const health = Math.min(100, cur.health + ac.healthRestore);
    const mood = Math.min(100, cur.mood + ac.moodRestore);
    this.state.character = { ...this.state.character, health, mood, activeClinic: null, updatedAt: now };
    this.state.stats = { ...this.state.stats, ...cur, health, mood, lastCalculatedAt: now };
    this.emit();
    return { ok: true, health, mood };
  }

  applyJob(jobId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    if (this.state.character.currentJob) throw new Error('Resign dulu sebelum melamar pekerjaan lain.');
    const job = jobsJson.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Pekerjaan tidak ditemukan.');

    const skills: SkillsMap = this.state.character.skills || { komunikasi: 0, fisik: 0, hitung: 0, teknis: 0 };
    for (const [k, v] of Object.entries(job.requiredSkills)) {
      if ((skills[k as SkillKey] || 0) < v) {
        throw new Error(`Skill ${k} minimal ${v} (saat ini ${skills[k as SkillKey] || 0}). Ikuti kursus dulu.`);
      }
    }

    const now = Date.now();
    const elig = evaluateVehicleJobEligibilityClient(
      job as unknown as JobConfigItem,
      this.state.vehicles,
      this.state.character,
      now
    );
    if (elig.requiresVehicle && elig.errorReason) {
      throw new Error(elig.errorReason);
    }

    const currentJob = {
      employmentId: `emp_${now}`,
      jobId: job.id,
      title: job.title,
      employer: job.employer,
      rankIndex: 0,
      rankTitle: job.ranks[0].title,
      totalWorkSeconds: 0,
      shiftsCompleted: 0,
      hiredAtMs: now,
      lastShiftAtMs: now,
    };
    this.state.character = { ...this.state.character, currentJob, updatedAt: now };
    this.emit();
    return { ok: true, currentJob };
  }

  resignJob() {
    if (!this.state.character?.currentJob) throw new Error('Tidak sedang bekerja.');
    const curJobId = String(this.state.character.currentJob.jobId || '');
    if (curJobId.startsWith('biz_')) {
      const bizId = curJobId.slice(4);
      const emps = this.state.businessEmployees[bizId] || [];
      this.state.businessEmployees[bizId] = emps.map((e) =>
        e.uid === this.state.character?.uid ? { ...e, status: 'resigned' as const } : e
      );
    }
    this.state.character = { ...this.state.character, currentJob: null, updatedAt: Date.now() };
    this.emit();
    return { ok: true };
  }

  startShift() {
    if (!this.state.character || !this.state.stats) throw new Error('Karakter belum ada.');
    const cj = this.state.character.currentJob;
    if (!cj) throw new Error('Lamar pekerjaan dulu.');

    const isBizJob = cj.jobId.startsWith('biz_');
    const bizId = isBizJob ? cj.jobId.slice(4) : '';
    const biz = isBizJob ? this.state.businesses.find((b) => b.id === bizId && b.status === 'active') : null;
    const job = !isBizJob ? jobsJson.jobs.find((j) => j.id === cj.jobId) : null;

    if (!isBizJob && !job) throw new Error('Pekerjaan invalid.');
    if (isBizJob && !biz) throw new Error('Bisnis tempat bekerja sedang tidak aktif.');

    const targetZone = job?.zone ?? 'cicalengka';
    if ((this.state.character.currentZone || 'cicalengka') !== targetZone) {
      throw new Error(`Pekerjaan ini ada di zona ${targetZone.toUpperCase()}. Naik kereta dulu.`);
    }

    const energyCost = job?.energyCost ?? 12;
    const minDurationSec = job?.minDurationSec ?? 20;
    const taskType = isBizJob
      ? biz?.type === 'bengkel' || biz?.type === 'jasa'
        ? 'pedagang_pasar'
        : 'kasir_minimarket'
      : cj.jobId;

    const cur = this.getCurrentComputed();
    if (cur.energy < energyCost) {
      throw new Error(`Energi kurang (butuh ${energyCost}%).`);
    }

    const now = Date.now();
    const vehElig = !isBizJob && job
      ? evaluateVehicleJobEligibilityClient(
          job as unknown as JobConfigItem,
          this.state.vehicles,
          this.state.character,
          now
        )
      : null;
    if (vehElig?.requiresVehicle && vehElig.errorReason) {
      throw new Error(vehElig.errorReason);
    }

    const shiftId = `shift_${now}`;
    let prompt: Record<string, unknown> = {};
    let secret: Record<string, unknown> = {};

    if (taskType === 'kasir_minimarket') {
      const items = Array.from({ length: 3 }, (_, idx) => {
        const total = (Math.floor(Math.random() * 6) + 2) * 5000 + 2500;
        const paid = total <= 20000 ? 20000 : total <= 50000 ? 50000 : 100000;
        return { id: idx, total, paid, change: paid - total };
      });
      prompt = {
        type: 'kasir',
        title: isBizJob ? `Kasir ${biz?.name || 'Bisnis'}` : 'Kasir Cicalengka Mart',
        instructions: 'Hitung uang kembalian pelanggan.',
        rounds: items.map(({ id, total, paid }) => ({ id, total, paid })),
      };
      secret = { answers: items.map((i) => i.change) };
    } else if (taskType === 'pedagang_pasar') {
      const goods = [
        { name: 'Beras Pandan Wangi', unit: 'kg', price: 14000 },
        { name: 'Bawang Merah', unit: 'kg', price: 32000 },
        { name: 'Tahu Sumedang', unit: 'bungkus', price: 6000 },
      ];
      const orders = goods.map((g, id) => {
        const qty = Math.floor(Math.random() * 3) + 1;
        return { id, itemName: g.name, unit: g.unit, unitPrice: g.price, qty, total: g.price * qty };
      });
      prompt = {
        type: 'pedagang',
        title: isBizJob ? `Layanan ${biz?.name || 'Bisnis'}` : 'Lapak Pasar Cicalengka',
        instructions: 'Hitung total harga pesanan pembeli NPC.',
        rounds: orders.map(({ id, itemName, unit, unitPrice, qty }) => ({ id, itemName, unit, unitPrice, qty })),
      };
      secret = { answers: orders.map((o) => o.total) };
    } else if (taskType === 'kurir') {
      const targets = [...KURIR_TARGETS].sort(() => Math.random() - 0.5).slice(0, 2);
      prompt = {
        type: 'kurir',
        title: 'Antar Paket Cicalengka',
        instructions: 'Ikuti panah 3D menuju 2 titik penerima paket (boleh naik motor untuk bonus!).',
        targets,
        sequential: false,
        requiresVehicle: false,
        assignedVehicleId: vehElig?.preferredVehicle?.id ?? null,
        assignedVehicleName: vehElig?.preferredVehicle?.name ?? null,
        vehicleBonusLabel: vehElig?.bonusLabel ?? null,
      };
      secret = { targets };
    } else if (taskType === 'ojek_online') {
      const pair = OJEK_ORDER_PAIRS[Math.floor(Math.random() * OJEK_ORDER_PAIRS.length)];
      const bonusPair = OJEK_ORDER_PAIRS.find((p) => p.pickup.id !== pair.pickup.id) || pair;
      const targets = [
        { ...pair.pickup, role: 'pickup' },
        { ...pair.dropoff, role: 'dropoff' },
        {
          ...bonusPair.dropoff,
          id: `ojek_order2_${bonusPair.dropoff.id}`,
          label: `Order #2: ${bonusPair.dropoff.label}`,
          role: 'dropoff',
        },
      ];
      prompt = {
        type: 'ojek_online',
        title: 'Order CikOjek Cicalengka',
        instructions: 'Kendarai motormu mengikuti panah 3D untuk jemput & antar penumpang.',
        targets,
        sequential: true,
        requiresVehicle: true,
        requiredCategories: ['motor'],
        assignedVehicleId: vehElig?.preferredVehicle?.id ?? null,
        assignedVehicleName: vehElig?.preferredVehicle?.name ?? null,
        vehicleBonusLabel: vehElig?.bonusLabel ?? null,
      };
      secret = { targets };
    } else if (taskType === 'sopir_angkot') {
      const deltas = [
        { boarded: 3, alighted: 0 },
        { boarded: 2, alighted: 1 },
        { boarded: 3, alighted: 2 },
        { boarded: 1, alighted: 4 },
      ];
      const targets = trafficJson.halteSpots.map((h, idx) => ({
        id: h.id,
        label: h.label,
        x: h.x,
        z: h.z,
        boarded: deltas[idx]?.boarded ?? 2,
        alighted: deltas[idx]?.alighted ?? 1,
      }));
      prompt = {
        type: 'sopir_angkot',
        title: 'Trayek Angkot Cicalengka',
        instructions: 'Kendarai Angkot melewati 4 halte resmi secara berurutan.',
        targets,
        sequential: true,
        requiresVehicle: true,
        requiredCategories: ['mobil'],
        allowedModelIds: ['mobil_angkot'],
        assignedVehicleId: vehElig?.preferredVehicle?.id ?? null,
        assignedVehicleName: vehElig?.preferredVehicle?.name ?? null,
        vehicleBonusLabel: vehElig?.bonusLabel ?? null,
      };
      secret = { targets };
    } else if (taskType === 'sopir_logistik') {
      const drops = [...LOGISTIK_DELIVERY_SPOTS].sort(() => Math.random() - 0.5).slice(0, 2);
      const targets = [
        { id: 'log_muat_grosir', label: 'Muat Barang: Pasar Grosir Induk', x: 46, z: -15 },
        ...drops,
      ];
      prompt = {
        type: 'sopir_logistik',
        title: 'Ekspedisi Niaga Priangan',
        instructions: 'Kendarai Pickup/Truk Kecil dari Pasar Grosir ke 2 toko tujuan.',
        targets,
        sequential: true,
        requiresVehicle: true,
        requiredCategories: ['mobil'],
        allowedModelIds: ['mobil_pickup', 'mobil_truk_kecil'],
        assignedVehicleId: vehElig?.preferredVehicle?.id ?? null,
        assignedVehicleName: vehElig?.preferredVehicle?.name ?? null,
        vehicleBonusLabel: vehElig?.bonusLabel ?? null,
      };
      secret = { targets };
    } else if (taskType === 'buruh_pabrik') {
      prompt = {
        type: 'pabrik',
        title: 'Operasi Mesin Tekstil Rancaekek',
        instructions: 'Tekan tombol jahit saat jarum berada di zona hijau (10x).',
        requiredSteps: 10,
      };
      secret = { requiredSteps: 10 };
    } else {
      const picked = [...GURU_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
      prompt = {
        type: 'guru',
        title: 'Kelas SDN Harapan Bandung',
        instructions: 'Jawab 3 pertanyaan murid dengan benar.',
        questions: picked.map((p, id) => ({ id, q: p.q, options: p.options })),
      };
      secret = { answers: picked.map((p) => p.ans) };
    }

    this.shiftSecrets[shiftId] = secret;
    const activeShift = {
      shiftId,
      jobId: cj.jobId,
      miniGameType: taskType,
      jobTitle: cj.title || job?.title || 'Staf Bisnis',
      startedAtMs: now,
      minDurationMs: minDurationSec * 1000,
      taskPrompt: prompt,
    };

    this.state.character = { ...this.state.character, activeShift, updatedAt: now };
    this.emit();
    return { ok: true, fired: false, fainted: false, activeShift };
  }

  endShift(submission: Record<string, unknown>) {
    if (!this.state.character?.activeShift || !this.state.stats) throw new Error('Tidak ada shift aktif.');
    const active = this.state.character.activeShift;
    const now = Date.now();
    if (now - active.startedAtMs < active.minDurationMs) {
      throw new Error(`Tunggu ${Math.ceil((active.minDurationMs - (now - active.startedAtMs)) / 1000)} detik lagi.`);
    }

    const isBizJob = active.jobId.startsWith('biz_');
    const bizId = isBizJob ? active.jobId.slice(4) : '';
    const job = !isBizJob ? jobsJson.jobs.find((j) => j.id === active.jobId) : null;
    if (!isBizJob && !job) throw new Error('Konfigurasi pekerjaan tidak valid.');

    const taskType = String(active.miniGameType || (isBizJob ? 'kasir_minimarket' : active.jobId));
    const secret = this.shiftSecrets[active.shiftId] || {};
    let score = 80;

    if (taskType === 'kasir_minimarket' || taskType === 'pedagang_pasar' || taskType === 'guru_honorer') {
      const exp = (secret.answers as number[]) || [];
      const sub = (submission.answers as number[]) || [];
      const ok = exp.filter((v, i) => Number(sub[i]) === Number(v)).length;
      score = exp.length ? Math.round((ok / exp.length) * 100) : 70;
    } else if (
      taskType === 'kurir' ||
      taskType === 'ojek_online' ||
      taskType === 'sopir_angkot' ||
      taskType === 'sopir_logistik'
    ) {
      const exp = (secret.targets as Array<{ id: string }>) || [];
      const visited = new Set(((submission.visitedIds as string[]) || []).map(String));
      const ok = exp.filter((t) => visited.has(t.id)).length;
      score = exp.length ? Math.round((ok / exp.length) * 100) : 70;
    } else if (taskType === 'buruh_pabrik') {
      const hits = Math.min(10, Math.max(0, Number(submission.hits || 0)));
      score = Math.round((hits / 10) * 100);
    }

    const cj = this.state.character.currentJob!;
    const worked = Math.round((now - active.startedAtMs) / 1000);
    const totalWorkSeconds = cj.totalWorkSeconds + worked;
    const perfFactor = 0.5 + 0.5 * (score / 100);

    let rankIndex = cj.rankIndex || 0;
    let rankTitle = cj.rankTitle || 'Staf Bisnis';
    let grossPay = 25000;
    let vehicleBonusRate = 0;
    let vehicleBonusPay = 0;

    if (isBizJob) {
      const emp = (this.state.businessEmployees[bizId] || []).find(
        (e) => e.uid === this.state.character?.uid && e.status === 'active'
      );
      grossPay = Math.round((emp?.wagePerCycle || 25000) * perfFactor);
    } else if (job) {
      rankIndex = 0;
      for (let i = 0; i < job.ranks.length; i++) {
        if (totalWorkSeconds >= job.ranks[i].minTotalWorkSec) rankIndex = i;
      }
      const rank = job.ranks[rankIndex];
      rankTitle = rank.title;
      const submittedVehId =
        typeof submission.vehicleId === 'string' && submission.vehicleId.trim()
          ? submission.vehicleId.trim()
          : this.state.character.drivingVehicleId ||
            (typeof active.taskPrompt?.assignedVehicleId === 'string'
              ? active.taskPrompt.assignedVehicleId
              : null);
      const vehEval = evaluateVehicleJobEligibilityClient(
        job as unknown as JobConfigItem,
        this.state.vehicles,
        { ...this.state.character, drivingVehicleId: submittedVehId },
        now
      );
      if (vehEval.requiresVehicle && vehEval.qualifyingVehicles.length === 0) {
        throw new Error(vehEval.errorReason || 'Kendaraan kerja tidak valid.');
      }
      if (job.id === 'kurir') {
        const usedMotor =
          typeof submission.vehicleId === 'string' &&
          vehEval.qualifyingVehicles.some((v) => v.id === submission.vehicleId);
        if (usedMotor && vehEval.preferredVehicle) {
          const hasOjolOrBox =
            vehEval.preferredVehicle.modelId === 'motor_ojek' ||
            (vehEval.preferredVehicle.accessories || []).includes('box_kurir');
          vehicleBonusRate = hasOjolOrBox ? 0.3 : 0.15;
        }
      } else {
        vehicleBonusRate = vehEval.bonusRate;
      }
      const baseGross = Math.round(job.basePay * rank.payMultiplier * perfFactor);
      vehicleBonusPay = Math.round(baseGross * vehicleBonusRate);
      grossPay = baseGross + vehicleBonusPay;
    }

    let paidFromSource = grossPay;
    if (isBizJob) {
      const bizIdx = this.state.businesses.findIndex((b) => b.id === bizId);
      if (bizIdx >= 0) {
        const biz = this.state.businesses[bizIdx];
        paidFromSource = Math.min(biz.cash, grossPay);
        const unpaidShortfall = grossPay - paidFromSource;
        this.state.businesses[bizIdx] = {
          ...biz,
          cash: biz.cash - paidFromSource,
          popularity: Math.min(100, biz.popularity + (score >= 70 ? 2 : 1)),
          updatedAtMs: now,
        };
        this.state.businessEmployees[bizId] = (this.state.businessEmployees[bizId] || []).map((e) =>
          e.uid === this.state.character?.uid
            ? { ...e, lastPaidAtMs: now, unpaidWage: (e.unpaidWage || 0) + unpaidShortfall }
            : e
        );
      }
    }

    const incomeTax = Math.round(paidFromSource * taxJson.incomeTaxRate);
    const netPay = Math.max(0, paidFromSource - incomeTax);
    if (incomeTax > 0) this.addTreasuryTax(incomeTax, 'income');

    const energyCost = job?.energyCost ?? 12;
    const hygieneCost = job?.hygieneCost ?? 6;
    const skillGainMap: Record<string, number> = job
      ? (job.skillGain as unknown as Record<string, number>)
      : { komunikasi: 1, hitung: 1 };

    const cur = this.getCurrentComputed();
    const energy = Math.max(0, cur.energy - energyCost);
    const hygiene = Math.max(0, cur.hygiene - hygieneCost);
    const mood = Math.max(0, Math.min(100, cur.mood + (score >= 70 ? 4 : -6)));
    const money = this.state.character.money + netPay;

    const skills: SkillsMap = { ...(this.state.character.skills || { komunikasi: 0, fisik: 0, hitung: 0, teknis: 0 }) };
    for (const [k, gain] of Object.entries(skillGainMap)) {
      skills[k as SkillKey] += Number(gain || 0);
    }

    this.state.character = {
      ...this.state.character,
      money,
      skills,
      hygiene,
      mood,
      activeShift: null,
      currentJob: {
        ...cj,
        rankIndex,
        rankTitle,
        totalWorkSeconds,
        shiftsCompleted: cj.shiftsCompleted + 1,
        lastShiftAtMs: now,
      },
      updatedAt: now,
    };
    this.state.stats = {
      ...this.state.stats,
      ...cur,
      energy,
      hygiene,
      mood,
      lastCalculatedAt: now,
    };
    const jobLabel = job?.title ?? cj.title ?? 'Staf Bisnis';
    this.addTx(
      'income',
      'gaji',
      netPay,
      money,
      `Gaji shift ${jobLabel} (Skor ${score}%, PPh Rp ${incomeTax.toLocaleString('id-ID')})`
    );
    this.emit();
    return {
      ok: true,
      money,
      payEarned: netPay,
      incomeTax,
      score,
      rankTitle,
      vehicleBonusRate,
      vehicleBonusPay,
    };
  }

  enrollCourse(courseId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const course = coursesJson.courses.find((c) => c.id === courseId);
    if (!course) throw new Error('Kursus tidak ditemukan.');
    if (this.state.character.activeCourse) throw new Error('Sudah ada kursus aktif.');
    if (this.state.character.money < course.cost) throw new Error('Saldo tidak mencukupi.');

    const now = Date.now();
    const money = this.state.character.money - course.cost;
    const activeCourse = {
      enrollmentId: `course_${now}`,
      courseId: course.id,
      title: course.title,
      skillKey: course.skillKey as SkillKey,
      skillGain: course.skillGain,
      startedAtMs: now,
      completesAtMs: now + course.durationSec * 1000,
    };
    this.state.character = { ...this.state.character, money, activeCourse, updatedAt: now };
    this.addTx('expense', 'kursus', course.cost, money, `Daftar ${course.title}`);
    this.emit();
    return { ok: true, money, activeCourse };
  }

  claimCourse() {
    if (!this.state.character?.activeCourse) throw new Error('Tidak ada kursus aktif.');
    const ac = this.state.character.activeCourse;
    const now = Date.now();
    if (now < ac.completesAtMs) {
      throw new Error(`Kursus selesai dalam ${Math.ceil((ac.completesAtMs - now) / 1000)} detik.`);
    }
    const skills: SkillsMap = { ...(this.state.character.skills || { komunikasi: 0, fisik: 0, hitung: 0, teknis: 0 }) };
    skills[ac.skillKey] += ac.skillGain;
    this.state.character = { ...this.state.character, skills, activeCourse: null, updatedAt: now };
    this.emit();
    return { ok: true, skills };
  }

  getBills() {
    this.ensureInitialDemoBill();
    this.syncLazyVehicleStateLocal();
    return { ok: true, bills: this.state.bills };
  }

  payBill(billId: string) {
    if (!this.state.character || !this.state.stats) throw new Error('Karakter belum ada.');
    const idx = this.state.bills.findIndex((b) => b.id === billId);
    if (idx < 0) throw new Error('Tagihan tidak ditemukan.');
    const bill = this.state.bills[idx];
    if (bill.status === 'paid') throw new Error('Tagihan sudah lunas.');
    if (this.state.character.money < bill.totalDue) throw new Error('Saldo kurang untuk membayar tagihan.');

    const now = Date.now();
    const money = this.state.character.money - bill.totalDue;
    const mood = Math.min(100, (this.state.stats.mood ?? 80) + 5);
    this.state.bills[idx] = { ...bill, status: 'paid', paidAtMs: now };
    this.state.character = { ...this.state.character, money, mood, updatedAt: now };
    this.state.stats = { ...this.state.stats, mood };

    if (bill.billType === 'vehicle_lease_installment' && bill.vehicleLeaseId) {
      const lIdx = this.state.vehicleLeases.findIndex((l) => l.id === bill.vehicleLeaseId);
      if (lIdx >= 0) {
        const ls = this.state.vehicleLeases[lIdx];
        const nextRem = Math.max(0, ls.remaining - bill.baseAmount);
        this.state.vehicleLeases[lIdx] = {
          ...ls,
          remaining: nextRem,
          paidCycles: ls.paidCycles + 1,
          nextDueAtMs: ls.nextDueAtMs + dealerJson.leasing.cycleMs,
          missedCount: 0,
          status: nextRem <= 0 ? 'paid' : 'active',
          updatedAtMs: now,
        };
        if (nextRem <= 0) {
          this.state.vehicles = this.state.vehicles.map((v) =>
            v.id === ls.vehicleId ? { ...v, leaseId: null, updatedAtMs: now } : v
          );
        }
      }
    } else if (bill.billType === 'vehicle_tax' && bill.vehicleId) {
      this.state.vehicles = this.state.vehicles.map((v) =>
        v.id === bill.vehicleId
          ? {
              ...v,
              stnkExpiresAtMs: Math.max(now, v.stnkExpiresAtMs) + vehiclesJson.stnkPeriodMs,
              taxLastPaidAtMs: now,
              updatedAtMs: now,
            }
          : v
      );
      this.addTreasuryTax(bill.totalDue, 'vehicle');
    } else if (bill.billType === 'vehicle_ticket_fine') {
      this.addTreasuryTax(bill.totalDue, 'vehicle');
    }

    this.addTx('expense', 'tagihan', bill.totalDue, money, `Bayar ${bill.title}`);
    this.emit();
    return { ok: true, money, totalDue: bill.totalDue, title: bill.title };
  }

  syncPlayerState() {
    if (!this.state.character) return { ok: true, fainted: false, fired: false, evicted: false };
    this.syncLazyVehicleStateLocal();
    this.emit();
    return { ok: true, fainted: false, fired: false, evicted: false };
  }

  buyTicket(destination: ZoneId, serverOffsetMs = 0) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    if ((this.state.character.currentZone || 'cicalengka') === destination) {
      throw new Error('Kamu sudah di stasiun tujuan ini.');
    }
    if (this.state.character.activeShift) throw new Error('Selesaikan shift kerja dulu.');

    const trainState = getDeterministicTrainState(Date.now() + serverOffsetMs);
    if (!trainState.boardingOpen) {
      throw new Error(`Kereta belum di peron! Tiba dalam ${trainState.nextArrivalSec} detik.`);
    }

    const dest = trainScheduleJson.destinations.find((d) => d.id === destination);
    if (!dest) throw new Error('Tujuan tidak valid.');
    if (this.state.character.money < dest.ticketPrice) throw new Error('Saldo tidak cukup membeli tiket.');

    const now = Date.now();
    const money = this.state.character.money - dest.ticketPrice;
    const activeTrip = {
      ticketId: `ticket_${now}`,
      fromZone: (this.state.character.currentZone || 'cicalengka') as ZoneId,
      toZone: destination,
      toLabel: dest.label,
      departedAtMs: now,
      arrivesAtMs: now + dest.travelDurationSec * 1000,
    };

    this.state.character = { ...this.state.character, money, activeTrip, updatedAt: now };
    this.addTx('expense', 'kereta', dest.ticketPrice, money, `Tiket Kereta -> ${dest.label}`);
    this.emit();
    return { ok: true, money, activeTrip };
  }

  completeTrip() {
    if (!this.state.character?.activeTrip) throw new Error('Tidak ada perjalanan aktif.');
    const trip = this.state.character.activeTrip;
    const now = Date.now();
    if (now < trip.arrivesAtMs) {
      throw new Error(`Masih di perjalanan (${Math.ceil((trip.arrivesAtMs - now) / 1000)} detik lagi).`);
    }
    const station = trainScheduleJson.stations[trip.toZone];
    const arrivalPos = station.platformPos as WorldPosition;
    this.state.character = {
      ...this.state.character,
      currentZone: trip.toZone,
      lastPosition: arrivalPos,
      activeTrip: null,
      updatedAt: now,
    };
    this.emit();
    return { ok: true, currentZone: trip.toZone, lastPosition: arrivalPos };
  }

  savePosition(pos: WorldPosition) {
    if (!this.state.character) return { ok: false };
    this.state.character = { ...this.state.character, lastPosition: pos };
    this.persistToStorage();
    return { ok: true };
  }

  // --- FASE 3 HOUSING METHODS ---

  private getPropOrThrow(propertyId: string): PropertyDoc {
    const p = this.state.properties.find((item) => item.id === propertyId);
    if (!p) throw new Error('Properti tidak ditemukan.');
    return p;
  }

  private computeDynamicValueLocal(prop: PropertyDoc): number {
    const vf = housingJson.valuationFormula;
    const areaMult = (vf.areaMultipliers as Record<string, number>)[prop.areaTag] ?? 1.0;
    const tier = prop.stationDistanceTier ?? 'sedang';
    const stationBonus = (vf.stationTierBonus as Record<string, number>)[tier] ?? 0;
    const condFactor = vf.conditionMinFactor + (prop.condition / 100) * vf.conditionWeight;
    const furnitureVal = (prop.furniture ?? []).reduce((sum, pf) => {
      const cat = furnitureJson.items.find((i) => i.id === pf.furnitureId);
      return sum + (cat ? cat.price * vf.furnitureValueShare : 0);
    }, 0);
    const activeAreaCount = this.state.listings.filter(
      (l) => l.status === 'active' && l.areaTag === prop.areaTag
    ).length;
    const supplyPenalty = Math.min(
      vf.maxSupplyPenalty,
      activeAreaCount * vf.listingSupplyPenaltyPerListing
    );
    const raw = prop.baseValue * areaMult * (1 + stationBonus - supplyPenalty) * condFactor + furnitureVal;
    return Math.max(150_000, Math.round(raw / 1000) * 1000);
  }

  requestViewing(propertyId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const prop = this.getPropOrThrow(propertyId);
    const uid = this.state.character.uid;
    const pos = this.state.character.lastPosition;
    if (distance2D(pos.x, pos.z, prop.position.x, prop.position.z) > 15) {
      throw new Error(`Mendekatlah ke ${prop.name} untuk survei lokasi.`);
    }

    const sched = prop.viewingSchedule;
    if (sched && !sched.open24h && !sched.allowAllHours && prop.ownerId !== uid) {
      const clock = getGameClockInfo(Date.now(), DEFAULT_GAME_CONFIG);
      const start = sched.startHour ?? 7;
      const end = sched.endHour ?? 21;
      const allowed = start <= end ? clock.hour >= start && clock.hour <= end : clock.hour >= start || clock.hour <= end;
      if (!allowed) {
        throw new Error(`Pemilik membuka survei pukul ${String(start).padStart(2, '0')}:00-${String(end).padStart(2, '0')}:00.`);
      }
    }

    const estimatedValue = this.computeDynamicValueLocal(prop);
    const propOut: PropertyDoc = { ...prop, estimatedValue };
    return {
      ok: true,
      property: propOut,
      role: prop.ownerId === uid ? 'owner' : 'viewer',
      viewingOnly: prop.ownerId !== uid && this.state.character.currentHomeId !== propertyId,
    };
  }

  enterProperty(propertyId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const prop = this.getPropOrThrow(propertyId);
    const uid = this.state.character.uid;
    const isOwner = prop.ownerId === uid;
    const activeLease = this.state.leases.find(
      (l) => l.id === prop.activeLeaseId && l.status === 'active'
    );
    const isTenant = activeLease?.tenantId === uid;
    const isRoommate = Boolean(activeLease?.roommateIds.includes(uid));
    const guestExp = this.guestAccessMap[propertyId]?.[uid] ?? 0;
    const isGuest = guestExp > Date.now();

    if (!isOwner && !isTenant && !isRoommate && !isGuest) {
      throw new Error('Pintu terkunci! Kamu belum memiliki akses/kunci ke hunian ini.');
    }

    const pos = this.state.character.lastPosition;
    if (distance2D(pos.x, pos.z, prop.position.x, prop.position.z) > 15) {
      throw new Error(`Mendekatlah ke pintu ${prop.name}.`);
    }

    return {
      ok: true,
      property: { ...prop, estimatedValue: this.computeDynamicValueLocal(prop) },
      role: isOwner ? 'owner' : isTenant ? 'tenant' : isRoommate ? 'roommate' : 'guest',
    };
  }

  leaveProperty() {
    return { ok: true };
  }

  createListing(propertyId: string, kind: 'rent' | 'sale', price: number, deposit?: number) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const uid = this.state.character.uid;
    const propIdx = this.state.properties.findIndex((p) => p.id === propertyId);
    if (propIdx < 0) throw new Error('Properti tidak ditemukan.');
    const prop = this.state.properties[propIdx];
    if (prop.ownerId !== uid) throw new Error('Bukan pemilik properti.');
    if (kind === 'rent' && prop.activeLeaseId) throw new Error('Properti sedang disewa orang lain.');
    if (prop.activeListingId) throw new Error('Masih ada listing aktif pada properti ini.');

    const now = Date.now();
    const listingId = `list_${propertyId}_${now}`;
    const finalDeposit = kind === 'rent' ? Math.max(0, Math.round(deposit ?? price)) : 0;
    const newListing: PropertyListingDoc = {
      id: listingId,
      propertyId,
      propertyName: prop.name,
      propertyType: prop.type,
      areaTag: prop.areaTag,
      zone: prop.zone,
      position: { x: prop.position.x, z: prop.position.z },
      rooms: prop.rooms,
      condition: Math.round(prop.condition),
      stationDistanceTier: prop.stationDistanceTier ?? 'sedang',
      stationDistanceMeters: Math.round(distance2D(prop.position.x, prop.position.z, STATION_SPAWN.x, STATION_SPAWN.z)),
      ownerId: uid,
      ownerType: 'player',
      ownerName: this.state.character.name,
      kind,
      price: Math.round(price),
      deposit: finalDeposit,
      status: 'active',
      createdAtMs: now,
      expiresAtMs: now + 30 * 24 * 3_600_000,
    };

    this.state.properties[propIdx] = { ...prop, activeListingId: listingId };
    this.state.listings = [newListing, ...this.state.listings];
    this.emit();
    return { ok: true, listingId, price: newListing.price, deposit: finalDeposit, kind };
  }

  cancelListing(listingId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const uid = this.state.character.uid;
    const idx = this.state.listings.findIndex((l) => l.id === listingId);
    if (idx < 0) throw new Error('Listing tidak ditemukan.');
    if (this.state.listings[idx].ownerId !== uid) throw new Error('Bukan pemilik listing.');

    const propId = this.state.listings[idx].propertyId;
    this.state.listings[idx] = { ...this.state.listings[idx], status: 'cancelled' };
    this.state.properties = this.state.properties.map((p) =>
      p.id === propId && p.activeListingId === listingId ? { ...p, activeListingId: null } : p
    );
    this.emit();
    return { ok: true, listingId };
  }

  repairProperty(propertyId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const uid = this.state.character.uid;
    const propIdx = this.state.properties.findIndex((p) => p.id === propertyId);
    if (propIdx < 0) throw new Error('Properti tidak ditemukan.');
    const prop = this.state.properties[propIdx];
    const isTenant = this.state.character.currentHomeId === propertyId;
    if (prop.ownerId !== uid && !isTenant) throw new Error('Tidak berhak merawat properti ini.');

    const missing = Math.max(0, Math.round(100 - prop.condition));
    if (missing <= 0) throw new Error('Kondisi properti sudah 100% prima.');
    const cost = missing * housingJson.valuationFormula.repairCostPerPoint;
    if (this.state.character.money < cost) {
      throw new Error(`Biaya renovasi Rp ${cost.toLocaleString('id-ID')} tidak cukup.`);
    }

    const now = Date.now();
    const money = this.state.character.money - cost;
    this.state.character = { ...this.state.character, money, updatedAt: now };
    this.state.properties[propIdx] = { ...prop, condition: 100, lastConditionDecayAtMs: now };
    this.state.listings = this.state.listings.map((l) =>
      l.propertyId === propertyId && l.status === 'active' ? { ...l, condition: 100 } : l
    );
    this.addTx('expense', 'properti', cost, money, `Renovasi ${prop.name} ke kondisi 100%`);
    this.emit();
    return { ok: true, money, condition: 100, cost };
  }

  grantGuestAccess(propertyId: string, targetName: string, durationHours = 4) {
    const uid = this.state.character?.uid;
    const prop = this.getPropOrThrow(propertyId);
    if (prop.ownerId !== uid && this.state.character?.currentHomeId !== propertyId) {
      throw new Error('Tidak berhak mengundang tamu.');
    }
    const clean = targetName.trim();
    if (clean.length < 3) throw new Error('Nama tamu minimal 3 huruf.');
    if (!this.guestAccessMap[propertyId]) this.guestAccessMap[propertyId] = {};
    this.guestAccessMap[propertyId][clean.toLowerCase()] = Date.now() + durationHours * 3_600_000;
    return { ok: true, targetUid: clean.toLowerCase(), guestName: clean, hours: durationHours };
  }

  setViewingSchedule(propertyId: string, open24h: boolean, startHour: number, endHour: number) {
    const uid = this.state.character?.uid;
    const idx = this.state.properties.findIndex((p) => p.id === propertyId);
    if (idx < 0) throw new Error('Properti tidak ditemukan.');
    if (this.state.properties[idx].ownerId !== uid) throw new Error('Hanya pemilik properti.');
    this.state.properties[idx] = {
      ...this.state.properties[idx],
      viewingSchedule: { open24h, startHour, endHour },
    };
    this.emit();
    return { ok: true, viewingSchedule: { open24h, startHour, endHour } };
  }

  makeOffer(listingId: string, amount: number, note = '') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const listing = this.state.listings.find((l) => l.id === listingId);
    if (!listing || listing.status !== 'active') throw new Error('Listing sudah tidak aktif.');
    if (listing.ownerId === this.state.character.uid) throw new Error('Tidak bisa menawar properti sendiri.');

    const now = Date.now();
    const ns = housingJson.negotiationSettings;
    const rep = this.state.character.reputation ?? 60;
    const askingPrice = listing.price;
    const cleanAmount = Math.round(amount);

    let status: OfferDoc['status'] = 'pending';
    let counterAmount: number | null = null;
    let responseNote = note;

    if (listing.ownerType === 'npc') {
      const maxDiscount = rep >= ns.npcHighRepThreshold ? ns.npcMaxDiscountHighRep : ns.npcMaxDiscountBase;
      const minAcceptable = Math.round((askingPrice * (1 - maxDiscount)) / 1000) * 1000;
      if (cleanAmount >= minAcceptable) {
        status = 'accepted';
        responseNote = `Agen menyetujui tawaran Rp ${cleanAmount.toLocaleString('id-ID')}!`;
      } else if (cleanAmount >= askingPrice * ns.npcAutoCounterRatio) {
        status = 'countered';
        counterAmount = Math.round(((cleanAmount + minAcceptable) * ns.npcCounterMidpointShare) / 1000) * 1000;
        responseNote = `Agen memberi counter-offer Rp ${counterAmount.toLocaleString('id-ID')}.`;
      } else {
        status = 'rejected';
        responseNote = `Tawaran terlalu rendah. Maksimal diskon agen ${(maxDiscount * 100).toFixed(0)}%.`;
      }
    }

    const offer: OfferDoc = {
      id: `offer_${listingId}_${now}`,
      listingId,
      propertyId: listing.propertyId,
      propertyName: listing.propertyName,
      kind: listing.kind,
      buyerId: this.state.character.uid,
      buyerName: this.state.character.name,
      ownerId: listing.ownerId,
      ownerType: listing.ownerType,
      askingPrice,
      amount: cleanAmount,
      counterAmount,
      status,
      note: responseNote,
      createdAtMs: now,
      expiresAtMs: now + ns.offerExpiryMs,
    };

    this.state.offers = [offer, ...this.state.offers];
    this.emit();
    return { ok: true, offerId: offer.id, status, amount: cleanAmount, counterAmount, note: responseNote, expiresAtMs: offer.expiresAtMs };
  }

  respondOffer(
    offerId: string,
    action: 'accept' | 'reject' | 'counter' | 'accept_counter',
    counterAmount?: number
  ) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.offers.findIndex((o) => o.id === offerId);
    if (idx < 0) throw new Error('Tawaran tidak ditemukan.');
    const offer = this.state.offers[idx];
    const now = Date.now();
    if (now > offer.expiresAtMs) {
      this.state.offers[idx] = { ...offer, status: 'expired' };
      this.emit();
      throw new Error('Penawaran sudah kedaluwarsa.');
    }

    if (action === 'accept_counter') {
      if (!offer.counterAmount || offer.status !== 'countered') throw new Error('Tidak ada counter-offer.');
      this.state.offers[idx] = { ...offer, status: 'accepted', amount: offer.counterAmount };
      this.emit();
      return { ok: true, offerId, status: 'accepted', amount: offer.counterAmount };
    }

    if (action === 'accept') {
      this.state.offers[idx] = { ...offer, status: 'accepted' };
    } else if (action === 'reject') {
      this.state.offers[idx] = { ...offer, status: 'rejected' };
    } else {
      const cv = Math.round(Number(counterAmount || 0));
      if (cv < 10_000) throw new Error('Nominal counter-offer tidak valid.');
      this.state.offers[idx] = {
        ...offer,
        status: 'countered',
        counterAmount: cv,
        expiresAtMs: now + housingJson.negotiationSettings.offerExpiryMs,
      };
    }
    this.emit();
    return { ok: true, offerId, status: this.state.offers[idx].status };
  }

  createLease(
    propertyId: string,
    period: 'weekly' | 'monthly' = 'weekly',
    offerId?: string,
    useStarterDiscount = false
  ) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    if (this.state.character.activeLeaseId) {
      throw new Error('Kamu masih punya kontrak sewa aktif. Akhiri dulu sebelum menyewa baru.');
    }

    const propIdx = this.state.properties.findIndex((p) => p.id === propertyId);
    if (propIdx < 0) throw new Error('Properti tidak ditemukan.');
    const prop = this.state.properties[propIdx];
    const uid = this.state.character.uid;
    if (prop.ownerId === uid) throw new Error('Ini properti milikmu sendiri.');
    if (prop.activeLeaseId) throw new Error('Properti sedang disewa orang lain.');

    const ls = housingJson.leaseSettings;
    const starter = housingJson.livingAndSleep.starterOption;
    const listing = this.state.listings.find((l) => l.id === prop.activeListingId && l.status === 'active');
    const offer = offerId ? this.state.offers.find((o) => o.id === offerId) : null;

    let agreedWeeklyRent = prop.baseRent;
    let deposit = prop.baseDeposit;

    if (useStarterDiscount) {
      if (this.state.character.starterHousingClaimed) {
        throw new Error('Bantuan awal kos murah hanya berlaku 1 kali.');
      }
      if (propertyId !== starter.propertyId) {
        throw new Error('Diskon awal hanya berlaku di Kos Murah Babakan Warga.');
      }
      agreedWeeklyRent = starter.firstCycleRent;
      deposit = starter.deposit;
    } else if (offer) {
      if (offer.status !== 'accepted' || offer.propertyId !== propertyId || offer.kind !== 'rent') {
        throw new Error('Penawaran sewa belum disetujui.');
      }
      agreedWeeklyRent = offer.amount;
      deposit = listing?.deposit ?? prop.baseDeposit;
    } else {
      if (!listing || listing.kind !== 'rent') {
        throw new Error('Properti ini sedang tidak dibuka untuk sewa.');
      }
      agreedWeeklyRent = listing.price;
      deposit = listing.deposit ?? agreedWeeklyRent;
    }

    const periodMs = period === 'monthly' ? ls.monthlyPeriodMs : ls.weeklyPeriodMs;
    const periodRent =
      period === 'monthly'
        ? Math.round((agreedWeeklyRent * 4 * ls.monthlyRentDiscount) / 500) * 500
        : agreedWeeklyRent;
    const totalUpfront = periodRent + deposit;

    if (this.state.character.money < totalUpfront) {
      throw new Error(`Saldo kurang! Butuh Rp ${totalUpfront.toLocaleString('id-ID')} (Sewa + Deposit).`);
    }

    const now = Date.now();
    const money = this.state.character.money - totalUpfront;
    const leaseId = `lease_${propertyId}_${now}`;
    const newLease: LeaseDoc = {
      id: leaseId,
      propertyId,
      propertyName: prop.name,
      tenantId: uid,
      tenantName: this.state.character.name,
      ownerId: prop.ownerId,
      ownerType: prop.ownerType,
      ownerName: prop.ownerName,
      rent: periodRent,
      deposit,
      depositRefunded: false,
      conditionAtLeaseStart: prop.condition,
      period,
      periodMs,
      startAtMs: now,
      lastBilledPeriod: 0,
      nextDueAtMs: now + periodMs,
      status: 'active',
      missedPeriods: 0,
      roommates: [],
      roommateIds: [],
      pendingInvites: [],
      pendingInviteUids: [],
      rules: 'Jaga kebersihan, bayar sewa tepat waktu, dilarang merusak fasilitas.',
    };

    this.state.leases = [newLease, ...this.state.leases];
    this.state.properties[propIdx] = {
      ...prop,
      activeLeaseId: leaseId,
      activeListingId: useStarterDiscount ? prop.activeListingId : null,
    };
    if (!useStarterDiscount && listing) {
      this.state.listings = this.state.listings.map((l) =>
        l.id === listing.id ? { ...l, status: 'closed' } : l
      );
    }
    if (offer) {
      this.state.offers = this.state.offers.map((o) =>
        o.id === offer.id ? { ...o, status: 'completed' } : o
      );
    }

    this.state.character = {
      ...this.state.character,
      money,
      currentHomeId: propertyId,
      activeLeaseId: leaseId,
      homeless: false,
      starterHousingClaimed: Boolean(this.state.character.starterHousingClaimed) || useStarterDiscount,
      reputation: Math.min(100, (this.state.character.reputation ?? 60) + 2),
      updatedAt: now,
    };
    this.addTx('expense', 'sewa_rumah', totalUpfront, money, `Mulai sewa ${prop.name} (Sewa + Deposit)`);
    this.emit();
    return { ok: true, leaseId, propertyId, money, totalUpfront, rent: periodRent, deposit };
  }

  terminateLease(leaseId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.leases.findIndex((l) => l.id === leaseId);
    if (idx < 0) throw new Error('Kontrak sewa tidak ditemukan.');
    const lease = this.state.leases[idx];
    if (lease.status !== 'active') throw new Error('Kontrak sudah berakhir.');

    const propIdx = this.state.properties.findIndex((p) => p.id === lease.propertyId);
    const prop = propIdx >= 0 ? this.state.properties[propIdx] : null;
    const startCond = lease.conditionAtLeaseStart ?? prop?.condition ?? 80;
    const damagePoints = Math.max(0, Math.round(startCond - (prop?.condition ?? startCond)));
    const damageDeduction = Math.min(
      lease.deposit,
      damagePoints * housingJson.leaseSettings.depositDamageDeductionPerPoint
    );
    const refund = Math.max(0, lease.deposit - damageDeduction);
    const now = Date.now();
    const uid = this.state.character.uid;

    // Kembalikan furnitur milik penyewa ke gudang inventory
    if (prop && propIdx >= 0) {
      const kept: FurniturePlacement[] = [];
      const nextInv = [...this.state.inventory];
      for (const pf of prop.furniture) {
        if (pf.ownerUid === uid) {
          const cat = furnitureJson.items.find((c) => c.id === pf.furnitureId);
          const invItem = nextInv.find((i) => i.itemId === pf.furnitureId);
          if (invItem) invItem.quantity += 1;
          else {
            nextInv.push({
              id: pf.furnitureId,
              uid,
              itemId: pf.furnitureId,
              category: 'furniture',
              name: cat?.name ?? pf.furnitureId,
              quantity: 1,
              updatedAtMs: now,
            });
          }
        } else {
          kept.push(pf);
        }
      }
      this.state.inventory = nextInv;
      this.state.properties[propIdx] = { ...prop, activeLeaseId: null, furniture: kept };
    }

    this.state.leases[idx] = { ...lease, status: 'ended', depositRefunded: true, endedAtMs: now };
    const ownedFallback = this.state.properties.find((p) => p.ownerId === uid)?.id ?? null;
    const money = this.state.character.money + refund;
    this.state.character = {
      ...this.state.character,
      money,
      currentHomeId: ownedFallback,
      activeLeaseId: null,
      homeless: !ownedFallback,
      updatedAt: now,
    };
    if (refund > 0) {
      this.addTx('income', 'refund_deposit', refund, money, `Pengembalian deposit ${lease.propertyName}`);
    }
    this.emit();
    return { ok: true, refund, damageDeduction };
  }

  inviteRoommate(leaseId: string, targetName: string, sharePercent: number) {
    const idx = this.state.leases.findIndex((l) => l.id === leaseId);
    if (idx < 0) throw new Error('Kontrak sewa tidak ditemukan.');
    const clean = targetName.trim();
    if (clean.length < 3) throw new Error('Nama pemain minimal 3 huruf.');
    const lease = this.state.leases[idx];
    const cleanShare = Math.max(10, Math.min(70, Math.round(sharePercent)));
    const nextPending = (lease.pendingInvites ?? []).filter((p) => p.name.toLowerCase() !== clean.toLowerCase());
    nextPending.push({ uid: `peer_${clean.toLowerCase()}`, name: clean, sharePercent: cleanShare, invitedAtMs: Date.now() });
    this.state.leases[idx] = {
      ...lease,
      pendingInvites: nextPending,
      pendingInviteUids: nextPending.map((p) => p.uid),
    };
    this.emit();
    return { ok: true, targetUid: `peer_${clean.toLowerCase()}`, targetName: clean, sharePercent: cleanShare };
  }

  acceptRoommate(leaseId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.leases.findIndex((l) => l.id === leaseId);
    if (idx < 0) throw new Error('Undangan kontrak tidak ditemukan.');
    const lease = this.state.leases[idx];
    const uid = this.state.character.uid;
    const inv = (lease.pendingInvites ?? []).find((p) => p.uid === uid) ?? { uid, name: this.state.character.name, sharePercent: 50 };
    const nextRoommates = [...lease.roommates.filter((r) => r.uid !== uid), { uid, name: this.state.character.name, sharePercent: inv.sharePercent }];
    this.state.leases[idx] = {
      ...lease,
      roommates: nextRoommates,
      roommateIds: nextRoommates.map((r) => r.uid),
      pendingInvites: (lease.pendingInvites ?? []).filter((p) => p.uid !== uid),
    };
    this.state.character = {
      ...this.state.character,
      currentHomeId: lease.propertyId,
      activeLeaseId: lease.id,
      homeless: false,
      updatedAt: Date.now(),
    };
    this.emit();
    return { ok: true, propertyId: lease.propertyId, leaseId: lease.id, sharePercent: inv.sharePercent };
  }

  leaveRoommate(leaseId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const uid = this.state.character.uid;
    const idx = this.state.leases.findIndex((l) => l.id === leaseId);
    if (idx < 0) throw new Error('Kontrak tidak ditemukan.');
    const lease = this.state.leases[idx];
    const nextRoommates = lease.roommates.filter((r) => r.uid !== uid);
    this.state.leases[idx] = {
      ...lease,
      roommates: nextRoommates,
      roommateIds: nextRoommates.map((r) => r.uid),
    };
    const ownedFallback = this.state.properties.find((p) => p.ownerId === uid)?.id ?? null;
    this.state.character = {
      ...this.state.character,
      currentHomeId: ownedFallback,
      activeLeaseId: null,
      homeless: !ownedFallback,
      updatedAt: Date.now(),
    };
    this.emit();
    return { ok: true, leaseId };
  }

  buyProperty(propertyId: string, offerId?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const uid = this.state.character.uid;
    const propIdx = this.state.properties.findIndex((p) => p.id === propertyId);
    if (propIdx < 0) throw new Error('Properti tidak ditemukan.');
    const prop = this.state.properties[propIdx];
    if (prop.ownerId === uid) throw new Error('Properti ini sudah menjadi milikmu.');
    if (prop.activeLeaseId) throw new Error('Properti sedang terikat kontrak sewa aktif.');

    const listing = this.state.listings.find((l) => l.id === prop.activeListingId && l.status === 'active');
    const offer = offerId ? this.state.offers.find((o) => o.id === offerId) : null;

    let price = 0;
    if (offer) {
      if (offer.status !== 'accepted' || offer.kind !== 'sale' || offer.propertyId !== propertyId) {
        throw new Error('Penawaran beli belum disetujui.');
      }
      price = offer.amount;
    } else {
      if (!listing || listing.kind !== 'sale') throw new Error('Properti ini sedang tidak dijual.');
      price = listing.price;
    }

    const transferTax = Math.round(price * housingJson.leaseSettings.saleTransferTaxRate);
    const totalCost = price + transferTax;
    if (this.state.character.money < totalCost) {
      throw new Error(`Saldo kurang! Butuh Rp ${totalCost.toLocaleString('id-ID')} (termasuk pajak balik nama 2,5%).`);
    }

    const now = Date.now();
    const money = this.state.character.money - totalCost;
    const certificateId = `SHM_${propertyId}_${now}`;

    this.state.properties[propIdx] = {
      ...prop,
      ownerId: uid,
      ownerType: 'player',
      ownerName: this.state.character.name,
      activeListingId: null,
      certificateId,
      lastTaxAtMs: now,
    };
    if (listing) {
      this.state.listings = this.state.listings.map((l) =>
        l.id === listing.id ? { ...l, status: 'closed' } : l
      );
    }
    if (offer) {
      this.state.offers = this.state.offers.map((o) =>
        o.id === offer.id ? { ...o, status: 'completed' } : o
      );
    }

    this.state.character = {
      ...this.state.character,
      money,
      currentHomeId: this.state.character.currentHomeId || propertyId,
      homeless: false,
      reputation: Math.min(100, (this.state.character.reputation ?? 60) + 5),
      updatedAt: now,
    };
    this.addTx('expense', 'beli_properti', totalCost, money, `Beli tunai ${prop.name} (${certificateId})`);
    this.emit();
    return { ok: true, propertyId, certificateId, money, totalCost, transferTax };
  }

  sleepAtHome(
    action: 'start' | 'wake',
    locationType: 'home' | 'emperan' | 'shelter' = 'home',
    propertyId?: string,
    spotId?: string
  ) {
    if (!this.state.character || !this.state.stats) throw new Error('Karakter belum ada.');
    const now = Date.now();
    const hs = housingJson.homelessSettings;
    const living = housingJson.livingAndSleep;

    if (action === 'start') {
      let durationSec = living.sleepDurationSec;
      let label = 'Rumah';
      let sleepPropId: string | null = null;
      let nextMoney = this.state.character.money;
      let sleepCoords = { x: this.state.character.lastPosition.x, y: 1, z: this.state.character.lastPosition.z };

      if (locationType === 'home') {
        const targetId = propertyId || this.state.character.currentHomeId;
        if (!targetId) throw new Error('Kamu belum memiliki hunian.');
        const prop = this.getPropOrThrow(targetId);
        label = prop.name;
        sleepPropId = prop.id;
        sleepCoords = { x: prop.position.x, y: 1, z: prop.position.z };
      } else if (locationType === 'shelter') {
        const clock = getGameClockInfo(now, DEFAULT_GAME_CONFIG);
        const open =
          hs.shelter.openStartHour > hs.shelter.openEndHour
            ? clock.hour >= hs.shelter.openStartHour || clock.hour < hs.shelter.openEndHour
            : clock.hour >= hs.shelter.openStartHour && clock.hour < hs.shelter.openEndHour;
        if (!open) {
          throw new Error(`Penampungan hanya buka malam hari (${hs.shelter.openStartHour}:00–0${hs.shelter.openEndHour}:00).`);
        }
        const fee = nextMoney >= hs.shelter.fee ? hs.shelter.fee : 0;
        if (fee > 0) {
          nextMoney -= fee;
          this.addTx('expense', 'penampungan', fee, nextMoney, 'Menginap di Penampungan Sosial Cicalengka');
        }
        durationSec = hs.shelter.sleepDurationSec;
        label = hs.shelter.label;
        sleepCoords = { x: hs.shelter.x, y: 1, z: hs.shelter.z };
      } else {
        const spot = hs.emperanSpots.find((s) => s.id === spotId) ?? hs.emperanSpots[0];
        durationSec = hs.emperanSleepDurationSec;
        label = spot.label;
        sleepCoords = { x: spot.x, y: 1, z: spot.z };
      }

      const activeSleep = {
        locationType,
        propertyId: sleepPropId,
        label,
        startedAtMs: now,
        completesAtMs: now + durationSec * 1000,
      };
      this.state.character = {
        ...this.state.character,
        money: nextMoney,
        activeSleep,
        lastSleepLocation: { zone: 'cicalengka', propertyId: sleepPropId, ...sleepCoords },
        updatedAt: now,
      };
      this.emit();
      return { ok: true, activeSleep, money: nextMoney };
    }

    // Wake up
    const sleep = this.state.character.activeSleep;
    if (!sleep) throw new Error('Sedang tidak tidur.');
    const cur = this.getCurrentComputed();
    const totalMs = Math.max(1000, sleep.completesAtMs - sleep.startedAtMs);
    const ratio = Math.min(1, Math.max(0.25, (now - sleep.startedAtMs) / totalMs));

    let energyGain = 30;
    let healthGain = 0;
    let moodDelta = 0;
    let hygieneDelta = 0;

    if (sleep.locationType === 'home') {
      const prop = sleep.propertyId ? this.state.properties.find((p) => p.id === sleep.propertyId) : null;
      const typeMeta = prop ? (housingJson.propertyTypes as Record<string, { recoveryBonus?: number }>)[prop.type] : null;
      const typeBonus = typeMeta?.recoveryBonus ?? 0.1;
      const condBonus = prop ? (prop.condition / 100) * living.homeConditionBonusMax : 0.15;
      let bedBonus = 0;
      let furnMood = 0;
      for (const pf of prop?.furniture ?? []) {
        const cat = furnitureJson.items.find((c) => c.id === pf.furnitureId);
        if (!cat) continue;
        if (cat.sleepBonus > bedBonus) bedBonus = cat.sleepBonus;
        furnMood += cat.moodBonus ?? 0;
      }
      const mult = living.homeRecoveryMultiplierBase + typeBonus + condBonus + bedBonus;
      energyGain = Math.round(living.homeSleepEnergyRestore * mult * ratio);
      healthGain = Math.round(living.homeSleepHealthRestore * ratio);
      moodDelta = Math.round((living.homeSleepMoodRestore + Math.min(25, Math.round(furnMood * 0.5))) * ratio);
    } else if (sleep.locationType === 'shelter') {
      energyGain = Math.round(hs.shelter.sleepEnergyRestore * ratio);
      moodDelta = Math.round(hs.shelter.sleepMoodDelta * ratio);
      hygieneDelta = Math.round(hs.shelter.sleepHygieneDelta * ratio);
    } else {
      energyGain = Math.round(hs.emperanSleepEnergyRestore * ratio);
      moodDelta = Math.round(hs.emperanSleepMoodDelta * ratio);
      hygieneDelta = Math.round(hs.emperanSleepHygieneDelta * ratio);
    }

    const nextStats = {
      hunger: cur.hunger,
      thirst: cur.thirst,
      energy: Math.min(100, cur.energy + energyGain),
      health: Math.min(100, cur.health + healthGain),
      hygiene: Math.max(0, Math.min(100, cur.hygiene + hygieneDelta)),
      mood: Math.max(0, Math.min(100, cur.mood + moodDelta)),
    };

    this.state.character = {
      ...this.state.character,
      activeSleep: null,
      health: nextStats.health,
      hygiene: nextStats.hygiene,
      mood: nextStats.mood,
      updatedAt: now,
    };
    this.state.stats = { ...this.state.stats, ...nextStats, lastCalculatedAt: now };
    this.emit();
    return { ok: true, fainted: false, stats: nextStats };
  }

  batheAtHome(propertyId?: string) {
    if (!this.state.character || !this.state.stats) throw new Error('Karakter belum ada.');
    const targetId = propertyId || this.state.character.currentHomeId;
    if (!targetId) throw new Error('Kamu belum punya hunian.');
    const cur = this.getCurrentComputed();
    const living = housingJson.livingAndSleep;
    const now = Date.now();
    const hygiene = Math.min(100, cur.hygiene + living.homeBathHygieneRestore);
    const mood = Math.min(100, cur.mood + living.homeBathMoodRestore);
    this.state.character = { ...this.state.character, hygiene, mood, updatedAt: now };
    this.state.stats = { ...this.state.stats, ...cur, hygiene, mood, lastCalculatedAt: now, lastBathAt: now };
    this.emit();
    return { ok: true, hygiene, mood };
  }

  eatFromInventory(itemId: string, propertyId?: string) {
    if (!this.state.character || !this.state.stats) throw new Error('Karakter belum ada.');
    const invIdx = this.state.inventory.findIndex((i) => i.itemId === itemId && i.quantity > 0);
    if (invIdx < 0) throw new Error('Stok makanan ini habis di penyimpanan.');

    const item = this.state.inventory[invIdx];
    const menuMeta = PREVIEW_SHOP_MENU.find((m) => m.id === itemId);
    const propId = propertyId || this.state.character.currentHomeId;
    const prop = propId ? this.state.properties.find((p) => p.id === propId) : null;
    let foodBonus = 0;
    for (const pf of prop?.furniture ?? []) {
      const cat = furnitureJson.items.find((c) => c.id === pf.furnitureId);
      if (cat && 'foodBonus' in cat && typeof cat.foodBonus === 'number') {
        foodBonus = Math.min(0.3, foodBonus + cat.foodBonus);
      }
    }

    const mult = 1 + foodBonus;
    const cur = this.getCurrentComputed();
    const now = Date.now();
    const nextStats = {
      hunger: Math.min(100, cur.hunger + Math.round((menuMeta?.hungerRestore ?? item.hungerRestore ?? 30) * mult)),
      thirst: Math.min(100, cur.thirst + Math.round((menuMeta?.thirstRestore ?? item.thirstRestore ?? 10) * mult)),
      energy: Math.min(100, cur.energy + Math.round((menuMeta?.energyRestore ?? item.energyRestore ?? 8) * mult)),
      health: cur.health,
      hygiene: cur.hygiene,
      mood: Math.min(100, cur.mood + 10),
    };

    const nextInv = [...this.state.inventory];
    if (item.quantity <= 1) nextInv.splice(invIdx, 1);
    else nextInv[invIdx] = { ...item, quantity: item.quantity - 1, updatedAtMs: now };

    this.state.inventory = nextInv;
    this.state.character = { ...this.state.character, mood: nextStats.mood, updatedAt: now };
    this.state.stats = { ...this.state.stats, ...nextStats, lastCalculatedAt: now };
    this.emit();
    return { ok: true, stats: nextStats };
  }

  setHomePreferences(respawnAtHome: boolean) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    this.state.character = { ...this.state.character, respawnAtHome, updatedAt: Date.now() };
    this.emit();
    return { ok: true, respawnAtHome };
  }

  buyFurniture(furnitureId: string, quantity = 1) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const item = furnitureJson.items.find((f) => f.id === furnitureId);
    if (!item) throw new Error('Jenis furnitur tidak ditemukan.');
    const qty = Math.max(1, Math.min(5, Math.floor(quantity)));
    const totalCost = item.price * qty;
    if (this.state.character.money < totalCost) {
      throw new Error(`Saldo kurang! Butuh Rp ${totalCost.toLocaleString('id-ID')}.`);
    }
    const now = Date.now();
    const money = this.state.character.money - totalCost;
    const nextInv = [...this.state.inventory];
    const idx = nextInv.findIndex((i) => i.itemId === furnitureId);
    let newQuantity = qty;
    if (idx >= 0) {
      newQuantity = nextInv[idx].quantity + qty;
      nextInv[idx] = { ...nextInv[idx], quantity: newQuantity, updatedAtMs: now };
    } else {
      nextInv.push({
        id: furnitureId,
        uid: this.state.character.uid,
        itemId: item.id,
        category: 'furniture',
        name: item.name,
        quantity: qty,
        updatedAtMs: now,
      });
    }

    this.state.character = { ...this.state.character, money, updatedAt: now };
    this.state.inventory = nextInv;
    this.addTx('expense', 'mebel', totalCost, money, `Beli ${qty}x ${item.name} di Toko Mebel`);
    this.emit();
    return { ok: true, money, furnitureId: item.id, newQuantity, totalCost };
  }

  placeFurniture(propertyId: string, placements: FurniturePlacement[]) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const uid = this.state.character.uid;
    const propIdx = this.state.properties.findIndex((p) => p.id === propertyId);
    if (propIdx < 0) throw new Error('Properti tidak ditemukan.');
    const prop = this.state.properties[propIdx];
    const isOwner = prop.ownerId === uid;
    const isResident = this.state.character.currentHomeId === propertyId;
    if (!isOwner && !isResident) throw new Error('Tidak berhak mendekorasi hunian ini.');

    const availablePool: Record<string, number> = {};
    for (const inv of this.state.inventory) {
      if (inv.category === 'furniture') availablePool[inv.itemId] = inv.quantity;
    }

    const fixedOther: FurniturePlacement[] = [];
    for (const pf of prop.furniture) {
      if (pf.ownerUid === uid || (!pf.ownerUid && isOwner)) {
        availablePool[pf.furnitureId] = (availablePool[pf.furnitureId] || 0) + 1;
      } else {
        fixedOther.push(pf);
      }
    }

    const usedCounts: Record<string, number> = {};
    const nextMine: FurniturePlacement[] = placements.map((p, idx) => {
      usedCounts[p.furnitureId] = (usedCounts[p.furnitureId] || 0) + 1;
      if (usedCounts[p.furnitureId] > (availablePool[p.furnitureId] || 0)) {
        throw new Error(`Stok furnitur ${p.furnitureId} tidak mencukupi.`);
      }
      return {
        ...p,
        instanceId: p.instanceId || `furn_${Date.now()}_${idx}`,
        ownerUid: uid,
      };
    });

    const now = Date.now();
    let nextInv = this.state.inventory.filter((i) => i.category !== 'furniture');
    for (const fId of new Set([...Object.keys(availablePool), ...Object.keys(usedCounts)])) {
      const rem = (availablePool[fId] || 0) - (usedCounts[fId] || 0);
      if (rem > 0) {
        const cat = furnitureJson.items.find((c) => c.id === fId);
        nextInv.push({
          id: fId,
          uid,
          itemId: fId,
          category: 'furniture',
          name: cat?.name ?? fId,
          quantity: rem,
          updatedAtMs: now,
        });
      }
    }

    const finalFurniture = [...fixedOther, ...nextMine];
    this.state.properties[propIdx] = { ...prop, furniture: finalFurniture };
    this.state.inventory = nextInv;
    this.emit();
    return { ok: true, furniture: finalFurniture };
  }

  // --- FASE 4: BANKING SIMULATION ---

  private addLedger(from: string, to: string, amount: number, reason: string, refId: string, taxAmount = 0) {
    const now = Date.now();
    this.state.ledger = [
      {
        id: `ldg_${now}_${Math.random().toString(36).slice(2, 5)}`,
        from,
        to,
        amount,
        ...(taxAmount > 0 ? { taxAmount } : {}),
        reason,
        refId,
        atMs: now,
      },
      ...this.state.ledger,
    ].slice(0, 30);
  }

  private addTreasuryTax(
    amount: number,
    bucket: 'income' | 'business' | 'property' | 'market' | 'auction' | 'vehicle'
  ) {
    if (amount <= 0) return;
    const t = this.state.treasury;
    this.state.treasury = {
      ...t,
      balance: t.balance + amount,
      totalTaxCollected: t.totalTaxCollected + amount,
      incomeTaxTotal: (t.incomeTaxTotal || 0) + (bucket === 'income' ? amount : 0),
      businessTaxTotal: (t.businessTaxTotal || 0) + (bucket === 'business' ? amount : 0),
      propertyTaxTotal: (t.propertyTaxTotal || 0) + (bucket === 'property' ? amount : 0),
      marketFeeTotal: (t.marketFeeTotal || 0) + (bucket === 'market' ? amount : 0),
      auctionFeeTotal: (t.auctionFeeTotal || 0) + (bucket === 'auction' ? amount : 0),
      vehicleTaxTotal: (t.vehicleTaxTotal || 0) + (bucket === 'vehicle' ? amount : 0),
      updatedAtMs: Date.now(),
    };
  }

  private getLoanTier(score: number) {
    return bankJson.loan.tiers.find((t) => score >= t.minScore && score <= t.maxScore) ?? null;
  }

  openAccount(initialDeposit = 0) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    if (this.state.bankAccount) throw new Error('Kamu sudah memiliki rekening bank.');
    const dep = Math.max(0, Math.floor(initialDeposit));
    const total = bankJson.openAccountFee + dep;
    if (this.state.character.money < total) {
      throw new Error(`Uang tunai kurang. Butuh Rp ${total.toLocaleString('id-ID')}.`);
    }
    const now = Date.now();
    const uid = this.state.character.uid;
    const accountNumber = `CLG-${Math.floor(1000 + Math.random() * 9000)}-${uid.slice(0, 4).toUpperCase()}`;
    const creditScore = this.state.character.creditScore ?? bankJson.creditScore.defaultScore;
    const nextMoney = this.state.character.money - total;

    this.state.bankAccount = {
      uid,
      accountNumber,
      balance: dep,
      savings: 0,
      lastInterestAtMs: now,
      creditScore,
      totalInterestEarned: 0,
      createdAtMs: now,
      updatedAtMs: now,
    };
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      creditScore,
      bankAccount: { accountNumber, openedAtMs: now },
    };
    this.addTx('expense', 'bank_buka_rekening', total, nextMoney, `Buka Rekening (${accountNumber})`);
    this.addLedger(uid, 'system:bank', bankJson.openAccountFee, 'open_bank_account_fee', accountNumber);
    this.emit();
    return { ok: true, accountNumber, balance: dep, money: nextMoney, creditScore };
  }

  deposit(amount: number, target: 'balance' | 'savings' = 'balance') {
    if (!this.state.character || !this.state.bankAccount) throw new Error('Buka rekening bank dulu.');
    const clean = Math.floor(amount);
    if (clean <= 0 || clean > bankJson.maxDepositPerTx) throw new Error('Nominal setor tidak valid.');
    if (this.state.character.money < clean) throw new Error('Uang tunai dompet tidak cukup.');

    const now = Date.now();
    const nextMoney = this.state.character.money - clean;
    const acc = this.state.bankAccount;
    const nextBalance = acc.balance + (target === 'balance' ? clean : 0);
    const nextSavings = acc.savings + (target === 'savings' ? clean : 0);

    this.state.character = { ...this.state.character, money: nextMoney };
    this.state.bankAccount = { ...acc, balance: nextBalance, savings: nextSavings, updatedAtMs: now };
    this.addTx('expense', target === 'savings' ? 'bank_tabung' : 'bank_setor', clean, nextMoney, `Setor ke ${target === 'savings' ? 'Tabungan' : 'Rekening Giro'}`);
    this.addLedger(this.state.character.uid, `bank:${this.state.character.uid}`, clean, target === 'savings' ? 'bank_deposit_savings' : 'bank_deposit_checking', acc.accountNumber);
    this.emit();
    return { ok: true, money: nextMoney, balance: nextBalance, savings: nextSavings, interestCredited: 0 };
  }

  withdraw(amount: number, source: 'balance' | 'savings' = 'balance') {
    if (!this.state.character || !this.state.bankAccount) throw new Error('Rekening bank belum ada.');
    const clean = Math.floor(amount);
    if (clean <= 0) throw new Error('Nominal tarik harus positif.');
    const acc = this.state.bankAccount;
    if (source === 'savings' && acc.savings < clean) throw new Error('Saldo tabungan tidak cukup.');
    if (source === 'balance' && acc.balance < clean) throw new Error('Saldo rekening giro tidak cukup.');

    const nextBalance = acc.balance - (source === 'balance' ? clean : 0);
    const nextSavings = acc.savings - (source === 'savings' ? clean : 0);
    const nextMoney = this.state.character.money + clean;

    this.state.character = { ...this.state.character, money: nextMoney };
    this.state.bankAccount = { ...acc, balance: nextBalance, savings: nextSavings, updatedAtMs: Date.now() };
    this.addTx('income', 'bank_tarik', clean, nextMoney, `Tarik dari ${source === 'savings' ? 'Tabungan' : 'Giro'}`);
    this.addLedger(`bank:${this.state.character.uid}`, this.state.character.uid, clean, 'bank_withdraw', acc.accountNumber);
    this.emit();
    return { ok: true, money: nextMoney, balance: nextBalance, savings: nextSavings, interestCredited: 0 };
  }

  transfer(targetName: string, amount: number) {
    if (!this.state.character || !this.state.bankAccount) throw new Error('Buka rekening bank dulu.');
    const clean = Math.floor(amount);
    if (clean < bankJson.minTransferAmount) {
      throw new Error(`Minimal transfer Rp ${bankJson.minTransferAmount.toLocaleString('id-ID')}.`);
    }
    const adminFee = Math.min(
      bankJson.transferAdminFeeMax,
      bankJson.transferAdminFeeFlat + Math.round(clean * bankJson.transferAdminFeeRate)
    );
    if (this.state.bankAccount.balance < clean + adminFee) {
      throw new Error('Saldo rekening giro tidak mencukupi (termasuk biaya admin).');
    }
    const nextBalance = this.state.bankAccount.balance - (clean + adminFee);
    this.state.bankAccount = { ...this.state.bankAccount, balance: nextBalance, updatedAtMs: Date.now() };
    this.addLedger(this.state.character.uid, targetName.trim(), clean, 'bank_transfer', `trf_${Date.now()}`, adminFee);
    this.emit();
    return { ok: true, balance: nextBalance, amount: clean, adminFee, targetName: targetName.trim() };
  }

  applyLoan(amount: number) {
    if (!this.state.character || !this.state.bankAccount) throw new Error('Buka rekening bank dulu.');
    const activeLoans = this.state.loans.filter((l) => l.status === 'active');
    if (activeLoans.length >= bankJson.loan.maxActiveLoans) {
      throw new Error('Lunasi pinjaman aktif terlebih dahulu.');
    }
    const score = this.state.bankAccount.creditScore;
    const tier = this.getLoanTier(score);
    if (!tier || amount > tier.maxPrincipal) {
      throw new Error(`Plafon pinjaman untuk skor kredit ${score} maksimal Rp ${(tier?.maxPrincipal || 0).toLocaleString('id-ID')}.`);
    }
    const shifts = this.state.character.currentJob?.shiftsCompleted ?? 0;
    const hasBiz = this.state.businesses.length > 0;
    if (shifts < bankJson.loan.minCompletedShifts && !hasBiz) {
      throw new Error(`Butuh minimal ${bankJson.loan.minCompletedShifts} shift selesai atau memiliki bisnis aktif.`);
    }

    const now = Date.now();
    const totalRepayable = Math.round(amount * (1 + tier.flatInterestRate));
    const installment = Math.ceil(totalRepayable / tier.termCycles / 100) * 100;
    const loanId = `loan_${now}`;
    const loan: LoanDoc = {
      id: loanId,
      borrowerId: this.state.character.uid,
      borrowerName: this.state.character.name,
      principal: amount,
      rate: tier.flatInterestRate,
      installment,
      termCycles: tier.termCycles,
      paidCycles: 0,
      nextDueAtMs: now + bankJson.loan.cycleMs,
      remaining: totalRepayable,
      missedCount: 0,
      status: 'active',
      createdAtMs: now,
    };
    const nextBal = this.state.bankAccount.balance + amount;
    this.state.loans = [loan, ...this.state.loans];
    this.state.bankAccount = { ...this.state.bankAccount, balance: nextBal, updatedAtMs: now };
    this.addLedger('system:bank', this.state.character.uid, amount, 'bank_loan_disbursement', loanId);
    this.emit();
    return { ok: true, loanId, principal: amount, totalRepayable, installment, termCycles: tier.termCycles, nextDueAtMs: loan.nextDueAtMs, balance: nextBal };
  }

  repayLoan(loanId: string, payFull = false, source: 'bank' | 'wallet' = 'bank') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.loans.findIndex((l) => l.id === loanId);
    if (idx < 0) throw new Error('Pinjaman tidak ditemukan.');
    const loan = this.state.loans[idx];
    if (loan.status === 'paid') throw new Error('Pinjaman sudah lunas.');
    const basePay = payFull ? loan.remaining : Math.min(loan.remaining, loan.installment);

    if (source === 'wallet') {
      if (this.state.character.money < basePay) throw new Error('Uang tunai dompet kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - basePay };
      this.addTx('expense', 'cicilan_bank', basePay, this.state.character.money, `Bayar cicilan pinjaman`);
    } else {
      if (!this.state.bankAccount || this.state.bankAccount.balance < basePay) {
        throw new Error('Saldo rekening giro kurang.');
      }
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - basePay };
    }

    const nextRem = Math.max(0, loan.remaining - basePay);
    const nextStatus = nextRem <= 0 ? 'paid' : 'active';
    const nextScore = Math.min(100, (this.state.bankAccount?.creditScore ?? 65) + bankJson.creditScore.onTimePaymentDelta + (nextStatus === 'paid' ? bankJson.creditScore.loanRepaidBonus : 0));

    this.state.loans[idx] = {
      ...loan,
      remaining: nextRem,
      paidCycles: (loan.paidCycles || 0) + 1,
      nextDueAtMs: loan.nextDueAtMs + bankJson.loan.cycleMs,
      status: nextStatus,
    };
    if (this.state.bankAccount) {
      this.state.bankAccount = { ...this.state.bankAccount, creditScore: nextScore };
    }
    this.state.character = { ...this.state.character, creditScore: nextScore };
    this.addLedger(this.state.character.uid, 'system:bank', basePay, nextStatus === 'paid' ? 'bank_loan_paid_off' : 'bank_loan_installment', loanId);
    this.emit();
    return { ok: true, paid: basePay, remaining: nextRem, status: nextStatus, creditScore: nextScore };
  }

  getAccountSummary() {
    const score = this.state.bankAccount?.creditScore ?? this.state.character?.creditScore ?? 65;
    return {
      ok: true,
      hasAccount: Boolean(this.state.bankAccount),
      account: this.state.bankAccount as (BankAccountDoc & { interestJustCredited?: number }) | null,
      creditScore: score,
      eligibleLoanTier: this.getLoanTier(score),
      loans: this.state.loans,
      recentLedger: this.state.ledger.slice(0, 12),
    };
  }

  // --- FASE 4: BUSINESS SIMULATION ---

  createBusiness(type: BusinessType, name: string, propertyId: string, capital: number) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const typeMeta = (
      businessJson.businessTypes as Record<
        string,
        (typeof businessJson.businessTypes)['bengkel'] | undefined
      >
    )[type];
    if (!typeMeta) throw new Error(`Tipe usaha ${type} belum aktif di konfigurasi lokal.`);
    const propIdx = this.state.properties.findIndex((p) => p.id === propertyId);
    if (propIdx < 0) throw new Error('Properti lokasi tidak ditemukan.');
    const prop = this.state.properties[propIdx];
    const isOwner = prop.ownerId === this.state.character.uid;
    const isTenant = Boolean(this.state.leases.find((l) => l.propertyId === propertyId && l.status === 'active' && l.tenantId === this.state.character!.uid));
    if (!isOwner && !isTenant) throw new Error('Kamu harus menyewa atau memiliki ruko/lapak ini.');
    if (!typeMeta.allowedPropertyTypes.includes(prop.type)) {
      throw new Error(`Tipe properti ${prop.type} tidak cocok untuk ${typeMeta.label}.`);
    }
    const cleanCap = Math.max(typeMeta.minCapital, Math.floor(capital));
    const total = typeMeta.permitFee + cleanCap;
    if (this.state.character.money < total) throw new Error(`Modal + Izin Usaha butuh Rp ${total.toLocaleString('id-ID')}.`);

    const now = Date.now();
    const bizId = `biz_${now}`;
    const biz: BusinessDoc = {
      id: bizId,
      ownerId: this.state.character.uid,
      ownerName: this.state.character.name,
      type,
      name: name.trim(),
      propertyId,
      areaTag: prop.areaTag,
      position: prop.position,
      capital: cleanCap,
      cash: cleanCap,
      popularity: typeMeta.basePopularity,
      level: 1,
      isOpen: true,
      hours: { openHour: 7, closeHour: 22 },
      lastSettledAtMs: now,
      lastWageAtMs: now,
      permits: { permitId: `SIUP_${now}`, issuedAtMs: now, feePaid: typeMeta.permitFee },
      status: 'active',
      createdAtMs: now,
    };

    const nextMoney = this.state.character.money - total;
    this.state.businesses = [biz, ...this.state.businesses];
    this.state.businessStock[bizId] = [];
    this.state.businessEmployees[bizId] = [];
    this.state.businessReports[bizId] = [];
    this.state.properties[propIdx] = { ...prop, activeBusinessId: bizId };
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      businesses: [...(this.state.character.businesses || []), bizId],
    };
    this.addTx('expense', 'modal_bisnis', total, nextMoney, `Buka Usaha ${name}`);
    this.addTreasuryTax(typeMeta.permitFee, 'business');
    this.emit();
    return { ok: true, business: biz, money: nextMoney };
  }

  setBusinessSettings(businessId: string, patch: { name?: string; isOpen?: boolean; openHour?: number; closeHour?: number }) {
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    if (idx < 0) throw new Error('Bisnis tidak ditemukan.');
    this.state.businesses[idx] = {
      ...this.state.businesses[idx],
      ...(patch.name ? { name: patch.name } : {}),
      ...(typeof patch.isOpen === 'boolean' ? { isOpen: patch.isOpen } : {}),
      hours: {
        openHour: patch.openHour ?? this.state.businesses[idx].hours?.openHour ?? 7,
        closeHour: patch.closeHour ?? this.state.businesses[idx].hours?.closeHour ?? 22,
      },
    };
    this.emit();
    return { ok: true };
  }

  buyStock(businessId: string, itemId: string, qty: number, payFrom: 'business' | 'wallet' = 'business') {
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    if (idx < 0 || !this.state.character) throw new Error('Bisnis tidak ditemukan.');
    const cargo = computeBestVehicleCargoBonus(this.state.vehicles);
    if (qty < 1 || qty > cargo.maxWholesaleQty) {
      throw new Error(
        `Kapasitas angkut grosir maksimal ${cargo.maxWholesaleQty} unit/transaksi (dasar 50 + bagasi kendaraan ${cargo.trunkCapacity}).`
      );
    }
    const meta = productsJson.products.find((p) => p.id === itemId);
    if (!meta) throw new Error('Produk tidak ditemukan.');
    const stat = this.state.marketStats.find((s) => s.itemId === itemId);
    const unitWholesale = stat?.wholesalePrice ?? meta.wholesalePrice;
    const total = unitWholesale * qty;

    if (payFrom === 'business') {
      if (this.state.businesses[idx].cash < total) throw new Error('Kas bisnis tidak cukup.');
      this.state.businesses[idx] = { ...this.state.businesses[idx], cash: this.state.businesses[idx].cash - total };
    } else {
      if (this.state.character.money < total) throw new Error('Uang dompet tidak cukup.');
      this.state.character = { ...this.state.character, money: this.state.character.money - total };
    }

    const stocks = [...(this.state.businessStock[businessId] || [])];
    const sIdx = stocks.findIndex((s) => s.itemId === itemId);
    const now = Date.now();
    if (sIdx >= 0) {
      stocks[sIdx] = { ...stocks[sIdx], qty: stocks[sIdx].qty + qty, updatedAtMs: now };
    } else {
      stocks.push({
        businessId,
        ownerId: this.state.character.uid,
        itemId,
        name: meta.name,
        category: meta.category,
        qty,
        avgCost: unitWholesale,
        sellPrice: meta.suggestedRetail,
        expiresAtMs: meta.shelfLifeGameDays > 0 ? now + meta.shelfLifeGameDays * 1_440_000 : 0,
        updatedAtMs: now,
      });
    }
    this.state.businessStock[businessId] = stocks;
    this.emit();
    return { ok: true, itemId, qty, totalCost: total };
  }

  produceItem(businessId: string, recipeId: string, batchCount = 1) {
    const recipe = productsJson.recipes.find((r) => r.id === recipeId);
    const outMeta = productsJson.products.find((p) => p.id === recipe?.outputItemId);
    if (!recipe || !outMeta || !this.state.character) throw new Error('Resep tidak valid.');
    const stocks = [...(this.state.businessStock[businessId] || [])];
    for (const inp of recipe.inputs) {
      const found = stocks.find((s) => s.itemId === inp.itemId);
      if (!found || found.qty < inp.qty * batchCount) {
        throw new Error(`Bahan baku ${inp.itemId} kurang untuk produksi.`);
      }
    }
    const now = Date.now();
    for (const inp of recipe.inputs) {
      const fIdx = stocks.findIndex((s) => s.itemId === inp.itemId);
      stocks[fIdx] = { ...stocks[fIdx], qty: stocks[fIdx].qty - inp.qty * batchCount, updatedAtMs: now };
    }
    const outQty = recipe.outputQty * batchCount;
    const oIdx = stocks.findIndex((s) => s.itemId === outMeta.id);
    if (oIdx >= 0) {
      stocks[oIdx] = { ...stocks[oIdx], qty: stocks[oIdx].qty + outQty, updatedAtMs: now };
    } else {
      stocks.push({
        businessId,
        ownerId: this.state.character.uid,
        itemId: outMeta.id,
        name: outMeta.name,
        category: outMeta.category,
        qty: outQty,
        avgCost: outMeta.wholesalePrice,
        sellPrice: outMeta.suggestedRetail,
        expiresAtMs: outMeta.shelfLifeGameDays > 0 ? now + outMeta.shelfLifeGameDays * 1_440_000 : 0,
        updatedAtMs: now,
      });
    }
    this.state.businessStock[businessId] = stocks;
    this.emit();
    return { ok: true, producedQty: outQty, itemName: outMeta.name };
  }

  setPrice(businessId: string, itemId: string, sellPrice: number) {
    const stocks = [...(this.state.businessStock[businessId] || [])];
    const sIdx = stocks.findIndex((s) => s.itemId === itemId);
    if (sIdx < 0) throw new Error('Barang belum ada di stok.');
    stocks[sIdx] = { ...stocks[sIdx], sellPrice: Math.floor(sellPrice), updatedAtMs: Date.now() };
    this.state.businessStock[businessId] = stocks;
    this.emit();
    return { ok: true, sellPrice: stocks[sIdx].sellPrice };
  }

  discardStock(businessId: string, itemId: string) {
    const stocks = (this.state.businessStock[businessId] || []).filter((s) => s.itemId !== itemId);
    this.state.businessStock[businessId] = stocks;
    this.emit();
    return { ok: true };
  }

  settleNpcSales(businessId: string) {
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    if (idx < 0) return { ok: true, salesCount: 0, revenue: 0 };
    const biz = this.state.businesses[idx];
    if (!biz.isOpen) return { ok: true, salesCount: 0, revenue: 0 };
    const stocks = [...(this.state.businessStock[businessId] || [])];
    const sellable = stocks.filter((s) => s.qty > 0 && s.category !== 'raw');
    if (sellable.length === 0) return { ok: true, salesCount: 0, revenue: 0 };

    const target = sellable[0];
    const soldQty = Math.min(target.qty, Math.max(1, Math.round(biz.popularity / 25)));
    const gross = soldQty * target.sellPrice;
    const tax = Math.round(gross * taxJson.businessSalesVatRate);
    const net = gross - tax;

    target.qty -= soldQty;
    this.state.businessStock[businessId] = stocks;
    this.state.businesses[idx] = { ...biz, cash: biz.cash + net, lastSettledAtMs: Date.now() };
    this.addTreasuryTax(tax, 'business');

    const dayKey = `Hari ${getGameClockInfo(Date.now(), DEFAULT_GAME_CONFIG).dayNumber}`;
    const reports = [...(this.state.businessReports[businessId] || [])];
    const rIdx = reports.findIndex((r) => r.dayKey === dayKey);
    if (rIdx >= 0) {
      reports[rIdx] = {
        ...reports[rIdx],
        revenue: reports[rIdx].revenue + gross,
        npcSales: reports[rIdx].npcSales + soldQty,
        taxPaid: reports[rIdx].taxPaid + tax,
        netProfit: reports[rIdx].netProfit + net,
        updatedAtMs: Date.now(),
      };
    } else {
      reports.unshift({
        dayKey,
        businessId,
        revenue: gross,
        npcSales: soldQty,
        playerSales: 0,
        stockCost: soldQty * target.avgCost,
        wageCost: 0,
        taxPaid: tax,
        promoCost: 0,
        netProfit: net - soldQty * target.avgCost,
        updatedAtMs: Date.now(),
      });
    }
    this.state.businessReports[businessId] = reports;
    this.emit();
    return { ok: true, salesCount: soldQty, revenue: gross };
  }

  buyFromBusiness(businessId: string, itemId: string, qty = 1, _consumeNow = false) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const bIdx = this.state.businesses.findIndex((b) => b.id === businessId);
    const stocks = [...(this.state.businessStock[businessId] || [])];
    const sIdx = stocks.findIndex((s) => s.itemId === itemId);
    if (bIdx < 0 || sIdx < 0 || stocks[sIdx].qty < qty) throw new Error('Stok tidak mencukupi.');
    const total = stocks[sIdx].sellPrice * qty;
    if (this.state.character.money < total) throw new Error('Uang tunai kurang.');

    const tax = Math.round(total * taxJson.businessSalesVatRate);
    stocks[sIdx] = { ...stocks[sIdx], qty: stocks[sIdx].qty - qty };
    this.state.businessStock[businessId] = stocks;
    this.state.businesses[bIdx] = { ...this.state.businesses[bIdx], cash: this.state.businesses[bIdx].cash + total - tax };
    const nextMoney = this.state.character.money - total;
    this.state.character = { ...this.state.character, money: nextMoney };
    this.addTx('expense', 'belanja_toko', total, nextMoney, `Beli ${qty}x ${stocks[sIdx].name}`);
    this.emit();
    return { ok: true, money: nextMoney, total };
  }

  runPromotion(businessId: string, tierId: string) {
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    const tier = businessJson.promotions.find((p) => p.id === tierId);
    if (idx < 0 || !tier) throw new Error('Paket promosi tidak valid.');
    if (this.state.businesses[idx].cash < tier.cost) throw new Error('Kas bisnis tidak cukup.');
    const now = Date.now();
    this.state.businesses[idx] = {
      ...this.state.businesses[idx],
      cash: this.state.businesses[idx].cash - tier.cost,
      popularity: Math.min(100, this.state.businesses[idx].popularity + tier.popularityBoost),
      promoBoostUntilMs: now + tier.durationMs,
      promoBoostValue: tier.popularityBoost,
    };
    this.emit();
    return { ok: true };
  }

  withdrawBusinessProfit(businessId: string, amount: number) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    if (idx < 0) throw new Error('Bisnis tidak ditemukan.');
    const biz = this.state.businesses[idx];
    const clean = Math.floor(amount);
    if (biz.cash - clean < businessJson.withdrawal.minReserveCash) {
      throw new Error(`Sisakan kas minimal Rp ${businessJson.withdrawal.minReserveCash.toLocaleString('id-ID')}.`);
    }
    const tax = Math.round(clean * taxJson.businessProfitTaxRate);
    const net = clean - tax;
    const nextMoney = this.state.character.money + net;
    this.state.businesses[idx] = { ...biz, cash: biz.cash - clean };
    this.state.character = { ...this.state.character, money: nextMoney };
    this.addTx('income', 'tarik_laba_bisnis', net, nextMoney, `Tarik laba ${biz.name}`);
    this.addTreasuryTax(tax, 'business');
    this.emit();
    return { ok: true, withdrawn: clean, tax, netReceived: net, money: nextMoney };
  }

  closeBusiness(businessId: string) {
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    if (idx < 0 || !this.state.character) throw new Error('Bisnis tidak ditemukan.');
    const biz = this.state.businesses[idx];
    const refund = biz.cash;
    const nextMoney = this.state.character.money + refund;
    this.state.businesses[idx] = { ...biz, status: 'closed', isOpen: false, cash: 0 };
    this.state.character = { ...this.state.character, money: nextMoney };
    const pIdx = this.state.properties.findIndex((p) => p.id === biz.propertyId);
    if (pIdx >= 0) this.state.properties[pIdx] = { ...this.state.properties[pIdx], activeBusinessId: null };
    this.emit();
    return { ok: true, refund, money: nextMoney };
  }

  sellBusiness(businessId: string) {
    return this.closeBusiness(businessId);
  }

  postBusinessJob(businessId: string, roleTitle: string, wagePerShift: number, slotsOpen = 1) {
    const biz = this.state.businesses.find((b) => b.id === businessId);
    if (!biz) throw new Error('Bisnis tidak ditemukan.');
    const post: BusinessJobPostDoc = {
      id: `jobpost_${Date.now()}`,
      businessId,
      businessName: biz.name,
      businessType: biz.type,
      ownerId: biz.ownerId,
      roleTitle,
      wagePerShift,
      slotsOpen,
      status: 'open',
      createdAtMs: Date.now(),
    };
    this.state.businessJobPosts = [post, ...this.state.businessJobPosts];
    this.emit();
    return { ok: true, postId: post.id };
  }

  hireEmployee(
    businessId: string,
    mode: 'npc' | 'player' = 'npc',
    targetName?: string,
    wagePerShift = 25000,
    opts?: { postId?: string; roleTitle?: string }
  ) {
    const now = Date.now();
    if (opts?.postId) {
      const postIdx = this.state.businessJobPosts.findIndex((p) => p.id === opts.postId && p.status === 'open');
      if (postIdx < 0) throw new Error('Lowongan sudah tutup.');
      const post = this.state.businessJobPosts[postIdx];
      if (!this.state.character) throw new Error('Karakter belum ada.');
      if (post.ownerId === this.state.character.uid) {
        throw new Error('Pemilik tidak melamar ke lowongannya sendiri.');
      }
      const empId = `emp_${this.state.character.uid}`;
      const emps = [...(this.state.businessEmployees[post.businessId] || [])];
      const emp: BusinessEmployeeDoc = {
        id: empId,
        businessId: post.businessId,
        ownerId: post.ownerId,
        uid: this.state.character.uid,
        name: this.state.character.name,
        isNpc: false,
        roleTitle: post.roleTitle,
        wagePerCycle: post.wagePerShift,
        productivity: businessJson.playerEmployee.productivityBonus,
        status: 'active',
        hiredAtMs: now,
        lastPaidAtMs: now,
        unpaidWage: 0,
      };
      this.state.businessEmployees[post.businessId] = [...emps, emp];
      const remSlots = Math.max(0, post.slotsOpen - 1);
      this.state.businessJobPosts[postIdx] = {
        ...post,
        slotsOpen: remSlots,
        status: remSlots <= 0 ? 'closed' : 'open',
      };
      this.state.character = {
        ...this.state.character,
        currentJob: {
          employmentId: empId,
          jobId: `biz_${post.businessId}`,
          title: `${post.roleTitle} (${post.businessName})`,
          employer: post.businessName,
          rankIndex: 0,
          rankTitle: post.roleTitle,
          totalWorkSeconds: 0,
          shiftsCompleted: this.state.character.currentJob?.shiftsCompleted || 0,
          hiredAtMs: now,
          lastShiftAtMs: 0,
        },
        updatedAt: now,
      };
      this.emit();
      return { ok: true, empId, name: this.state.character.name };
    }

    const emps = [...(this.state.businessEmployees[businessId] || [])];
    const empId = `emp_${now}`;
    const emp: BusinessEmployeeDoc = {
      id: empId,
      businessId,
      ownerId: this.state.character?.uid || '',
      uid: `npc_${now}`,
      name: mode === 'npc' ? ['Kang Dede', 'Teh Santi', 'Mang Udin'][emps.length % 3] : targetName || 'Karyawan',
      isNpc: mode === 'npc',
      roleTitle: mode === 'npc' ? 'Asisten Toko (NPC)' : opts?.roleTitle || 'Staf Bisnis',
      wagePerCycle: mode === 'npc' ? businessJson.npcEmployee.wagePerGameDay : wagePerShift,
      productivity: mode === 'npc' ? businessJson.npcEmployee.productivityBonus : businessJson.playerEmployee.productivityBonus,
      status: 'active',
      hiredAtMs: now,
      lastPaidAtMs: now,
      unpaidWage: 0,
    };
    this.state.businessEmployees[businessId] = [...emps, emp];
    this.emit();
    return { ok: true, empId: emp.id, name: emp.name };
  }

  fireEmployee(businessId: string, empId: string) {
    const targetEmp = (this.state.businessEmployees[businessId] || []).find((e) => e.id === empId);
    const emps = (this.state.businessEmployees[businessId] || []).map((e) =>
      e.id === empId ? { ...e, status: 'fired' as const } : e
    );
    this.state.businessEmployees[businessId] = emps;
    if (
      targetEmp &&
      this.state.character &&
      targetEmp.uid === this.state.character.uid &&
      this.state.character.currentJob?.jobId === `biz_${businessId}`
    ) {
      this.state.character = {
        ...this.state.character,
        currentJob: null,
        activeShift: null,
        updatedAt: Date.now(),
      };
    }
    this.emit();
    return { ok: true };
  }

  payWages(businessId: string) {
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    if (idx < 0) throw new Error('Bisnis tidak ditemukan.');
    const emps = this.state.businessEmployees[businessId] || [];
    const activeEmps = emps.filter((e) => e.status === 'active');
    const due = activeEmps.reduce((sum, e) => sum + e.wagePerCycle + e.unpaidWage, 0);
    if (due <= 0) return { ok: true, totalPaid: 0 };
    if (this.state.businesses[idx].cash < due) throw new Error('Kas bisnis tidak cukup untuk bayar gaji.');
    this.state.businesses[idx] = { ...this.state.businesses[idx], cash: this.state.businesses[idx].cash - due };
    this.state.businessEmployees[businessId] = emps.map((e) =>
      e.status === 'active' ? { ...e, unpaidWage: 0, lastPaidAtMs: Date.now() } : e
    );
    this.emit();
    return { ok: true, totalPaid: due };
  }

  // --- FASE 4: MARKETPLACE, AUCTIONS & MACRO ECONOMY ---

  createMarketListing(itemId: string, qty: number, unitPrice: number, areaTag = 'pasar') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const invIdx = this.state.inventory.findIndex((i) => i.itemId === itemId);
    if (invIdx < 0 || this.state.inventory[invIdx].quantity < qty) {
      throw new Error('Stok inventaris tidak mencukupi.');
    }
    const item = this.state.inventory[invIdx];
    if (item.quantity - qty <= 0) {
      this.state.inventory = this.state.inventory.filter((_, i) => i !== invIdx);
    } else {
      this.state.inventory[invIdx] = { ...item, quantity: item.quantity - qty };
    }
    const now = Date.now();
    const listing: MarketListingDoc = {
      id: `mkt_${now}`,
      sellerId: this.state.character.uid,
      sellerName: this.state.character.name,
      itemId,
      itemName: item.name,
      category: item.category,
      qty,
      unitPrice,
      price: qty * unitPrice,
      areaTag,
      status: 'active',
      createdAtMs: now,
    };
    this.state.marketListings = [listing, ...this.state.marketListings];
    this.emit();
    return { ok: true, listingId: listing.id };
  }

  buyMarketListing(listingId: string, buyQty?: number) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.marketListings.findIndex((l) => l.id === listingId);
    if (idx < 0) throw new Error('Listing tidak ditemukan.');
    const listing = this.state.marketListings[idx];
    if (listing.sellerId === this.state.character.uid) throw new Error('Tidak dapat membeli listing sendiri.');
    const q = buyQty ?? listing.qty;
    const gross = q * listing.unitPrice;
    if (this.state.character.money < gross) throw new Error('Uang tunai kurang.');
    const nextMoney = this.state.character.money - gross;
    this.state.character = { ...this.state.character, money: nextMoney };
    const rem = listing.qty - q;
    this.state.marketListings[idx] = { ...listing, qty: rem, status: rem <= 0 ? 'sold' : 'active' };
    this.addTx('expense', 'marketplace_beli', gross, nextMoney, `Beli ${q}x ${listing.itemName}`);
    this.emit();
    return { ok: true, money: nextMoney, buyQty: q, gross };
  }

  cancelMarketListing(listingId: string) {
    const idx = this.state.marketListings.findIndex((l) => l.id === listingId);
    if (idx < 0 || !this.state.character) throw new Error('Listing tidak ditemukan.');
    const l = this.state.marketListings[idx];
    this.state.marketListings[idx] = { ...l, status: 'cancelled' };
    const iIdx = this.state.inventory.findIndex((i) => i.itemId === l.itemId);
    if (iIdx >= 0) {
      this.state.inventory[iIdx] = { ...this.state.inventory[iIdx], quantity: this.state.inventory[iIdx].quantity + l.qty };
    } else {
      this.state.inventory.push({
        id: l.itemId,
        uid: this.state.character.uid,
        itemId: l.itemId,
        category: l.category as InventoryItemDoc['category'],
        name: l.itemName,
        quantity: l.qty,
        updatedAtMs: Date.now(),
      });
    }
    this.emit();
    return { ok: true };
  }

  createAuction(subjectType: AuctionSubjectType, subjectId: string, startPrice: number, minIncrement = 5000, durationMinutes = 60, qty = 1) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    const aucId = `auc_${now}`;
    let subject: Record<string, unknown> = { name: subjectId };
    if (subjectType === 'item') {
      const iIdx = this.state.inventory.findIndex((i) => i.itemId === subjectId);
      if (iIdx < 0 || this.state.inventory[iIdx].quantity < qty) throw new Error('Stok barang kurang.');
      const inv = this.state.inventory[iIdx];
      subject = { itemId: subjectId, itemName: inv.name, category: inv.category, qty };
      if (inv.quantity - qty <= 0) this.state.inventory = this.state.inventory.filter((_, i) => i !== iIdx);
      else this.state.inventory[iIdx] = { ...inv, quantity: inv.quantity - qty };
    } else if (subjectType === 'property') {
      const prop = this.state.properties.find((p) => p.id === subjectId);
      if (!prop || prop.ownerId !== this.state.character.uid) throw new Error('Kamu bukan pemilik properti ini.');
      subject = { propertyId: prop.id, name: prop.name, type: prop.type, areaTag: prop.areaTag };
    } else {
      const biz = this.state.businesses.find((b) => b.id === subjectId);
      if (!biz || biz.ownerId !== this.state.character.uid) throw new Error('Bukan pemilik bisnis.');
      subject = { businessId: biz.id, name: biz.name, type: biz.type, propertyId: biz.propertyId };
    }
    const auc: AuctionDoc = {
      id: aucId,
      sellerId: this.state.character.uid,
      sellerName: this.state.character.name,
      subject,
      subjectType,
      subjectId,
      startPrice,
      minIncrement,
      currentBid: 0,
      bidCount: 0,
      endsAtMs: now + durationMinutes * 60_000,
      status: 'active',
      createdAtMs: now,
    };
    this.state.auctions = [auc, ...this.state.auctions];
    this.emit();
    return { ok: true, auctionId: aucId };
  }

  placeBid(auctionId: string, amount: number, payFrom: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.auctions.findIndex((a) => a.id === auctionId);
    if (idx < 0) throw new Error('Lelang tidak ditemukan.');
    const auc = this.state.auctions[idx];
    const minReq = auc.bidCount === 0 ? auc.startPrice : auc.currentBid + auc.minIncrement;
    if (amount < minReq) throw new Error(`Bid minimal Rp ${minReq.toLocaleString('id-ID')}.`);
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < amount) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - amount };
    } else {
      if (this.state.character.money < amount) throw new Error('Uang dompet kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - amount };
    }
    const now = Date.now();
    const antiSnipeExtended = auc.endsAtMs - now <= 60_000;
    this.state.auctions[idx] = {
      ...auc,
      currentBid: amount,
      currentBidderId: this.state.character.uid,
      currentBidderName: this.state.character.name,
      currentBidderSource: payFrom,
      bidCount: auc.bidCount + 1,
      endsAtMs: antiSnipeExtended ? now + 90_000 : auc.endsAtMs,
    };
    this.state.auctionBids[auctionId] = [
      { id: `bid_${now}`, auctionId, bidderId: this.state.character.uid, bidderName: this.state.character.name, amount, createdAtMs: now },
      ...(this.state.auctionBids[auctionId] || []),
    ];
    this.emit();
    return { ok: true, currentBid: amount, antiSnipeExtended };
  }

  settleAuction(auctionId: string, cancel = false) {
    const idx = this.state.auctions.findIndex((a) => a.id === auctionId);
    if (idx < 0) throw new Error('Lelang tidak ditemukan.');
    this.state.auctions[idx] = {
      ...this.state.auctions[idx],
      status: cancel ? 'cancelled' : 'settled',
    };
    this.emit();
    return { ok: true, status: this.state.auctions[idx].status };
  }

  updateMarketStats() {
    this.state.treasury = { ...this.state.treasury, updatedAtMs: Date.now() };
    this.emit();
    return { ok: true, ...this.state.treasury };
  }

  // --- FASE 6: HUKUM, POLISI, KEAMANAN, ASURANSI, NPC AI, QUEST, KPR, KAVLING, KONSTRUKSI, AGEN ---

  attemptCrime(offenseId: string, targetType = 'public', targetId = 'public', x = 0, z = 0) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    const offense = lawJson.offenses.find((o) => o.id === offenseId);
    if (!offense) throw new Error('Jenis pelanggaran tidak dikenal.');
    if (this.state.character.sentence?.active) throw new Error('Sedang menjalani masa tahanan.');
    if (this.state.character.currentJob?.jobId === 'polisi') {
      throw new Error('Petugas polisi aktif tidak boleh melakukan tindak kriminal.');
    }

    const lastCrime = this.state.character.lastCrimeAtMs || 0;
    const cooldownMs = lawJson.crimeCooldownSec * 1000;
    if (now - lastCrime < cooldownMs) {
      throw new Error(`Tunggu ${Math.ceil((cooldownMs - (now - lastCrime)) / 1000)} detik sebelum aksi berikutnya.`);
    }

    const reward =
      offense.rewardMax > 0
        ? Math.round(offense.rewardMin + Math.random() * (offense.rewardMax - offense.rewardMin))
        : 0;
    const caught = Math.random() < offense.baseCatchChance;
    const prevWanted = computeLazyWantedClient(
      this.state.character.wantedLevel,
      this.state.character.wantedUpdatedAtMs,
      now
    );
    const nextWanted = Math.min(lawJson.wantedMax, prevWanted + offense.wantedDelta);
    const recId = `crime_${now}`;

    const record: CrimeRecordDoc = {
      id: recId,
      characterId: this.state.character.uid,
      characterName: this.state.character.name,
      offenseId: offense.id,
      offenseTitle: offense.title,
      severity: offense.severity as 1 | 2 | 3,
      atMs: now,
      location: { x, z, zone: this.state.character.currentZone || 'cicalengka' },
      targetType: targetType as CrimeRecordDoc['targetType'],
      targetId,
      witnesses: caught ? ['Warga Sekitar'] : [],
      status: caught ? 'wanted' : 'active_evidence',
      fine: offense.fine,
      sentenceSec: offense.sentenceSec,
    };
    this.state.crimeRecords = [record, ...this.state.crimeRecords];

    let money = this.state.character.money;
    if (!caught && reward > 0) {
      money += reward;
      this.addTx('income', 'kriminal', reward, money, `Hasil ${offense.title}`);
    }

    let nextSentence = this.state.character.sentence || null;
    if (caught && offense.severity >= 2) {
      const endAtMs = now + offense.sentenceSec * 1000;
      nextSentence = {
        active: true,
        recordId: recId,
        startAtMs: now,
        endAtMs,
        reason: offense.title,
        bailAmount: Math.round(offense.fine * lawJson.bailMultiplierOfFine),
        workReductionSec: 0,
      };
      this.state.sentence = {
        uid: this.state.character.uid,
        recordId: recId,
        startAtMs: now,
        endAtMs,
        reason: offense.title,
        fineAmount: offense.fine,
        bailAmount: Math.round(offense.fine * lawJson.bailMultiplierOfFine),
        status: 'serving',
      };
    }

    this.state.character = {
      ...this.state.character,
      money,
      wantedLevel: nextWanted,
      wantedUpdatedAtMs: now,
      lastCrimeAtMs: now,
      reputation: Math.max(0, (this.state.character.reputation ?? 60) + offense.reputationDelta),
      sentence: nextSentence,
      updatedAt: now,
    };
    this.emit();
    return {
      ok: true,
      caught,
      reward: caught ? 0 : reward,
      money,
      wantedLevel: nextWanted,
      recordId: recId,
      catchChance: offense.baseCatchChance,
      witnesses: caught ? ['Warga Sekitar'] : [],
      cctvTriggered: false,
      isNight: false,
      targetOwnerId: '',
      targetPropertyId: '',
      posX: x,
      posZ: z,
      offenseTitle: offense.title,
      severity: offense.severity,
    };
  }

  reportCrime(targetUid?: string, recordId?: string, note?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    if (recordId) {
      this.state.crimeRecords = this.state.crimeRecords.map((r) =>
        r.id === recordId ? { ...r, status: 'reported', reportedBy: this.state.character?.name, reportedAtMs: now } : r
      );
    } else {
      this.state.crimeRecords = [
        {
          id: `rep_${now}`,
          characterId: targetUid || 'unknown',
          characterName: targetUid || 'Terlapor Warga',
          offenseId: 'buat_keributan',
          offenseTitle: note?.slice(0, 60) || 'Laporan Gangguan Ketertiban',
          severity: 1,
          atMs: now,
          location: { x: 0, z: 0, zone: 'cicalengka' },
          targetType: 'public',
          status: 'reported',
          fine: 15000,
          sentenceSec: 300,
          reportedBy: this.state.character.name,
          reportedAtMs: now,
        },
        ...this.state.crimeRecords,
      ];
    }
    this.emit();
    return { ok: true, message: 'Laporan keamanan tercatat di Polsek Cicalengka.' };
  }

  payFine(recordId: string, paymentSource: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const rec = this.state.crimeRecords.find((r) => r.id === recordId);
    if (!rec) throw new Error('Catatan pelanggaran tidak ditemukan.');
    const fine = rec.fine || 15000;
    if (paymentSource === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < fine) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - fine };
    } else {
      if (this.state.character.money < fine) throw new Error('Uang dompet kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - fine };
    }
    const now = Date.now();
    this.state.crimeRecords = this.state.crimeRecords.map((r) =>
      r.id === recordId ? { ...r, status: 'paid', paidAtMs: now } : r
    );
    const curW = computeLazyWantedClient(this.state.character.wantedLevel, this.state.character.wantedUpdatedAtMs, now);
    this.state.character = {
      ...this.state.character,
      wantedLevel: Math.max(0, curW - 25),
      wantedUpdatedAtMs: now,
    };
    this.addTx('expense', 'bayar_denda', fine, this.state.character.money, `Bayar denda ${rec.offenseTitle}`);
    this.emit();
    return { ok: true, fine, money: this.state.character.money };
  }

  arrestPlayer(targetUid: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    this.state.policeActions = [
      {
        id: `pa_${now}`,
        officerId: this.state.character.uid,
        officerName: this.state.character.name,
        targetId: targetUid,
        targetName: targetUid,
        action: 'arrest',
        evidence: 'Penindakan patroli lapangan',
        atMs: now,
        reviewStatus: 'pending',
      },
      ...this.state.policeActions,
    ];
    const nextMoney = this.state.character.money + lawJson.policeEnforcement.arrestReward;
    this.state.character = { ...this.state.character, money: nextMoney };
    this.addTx('income', 'polisi_tangkap', lawJson.policeEnforcement.arrestReward, nextMoney, 'Bonus penangkapan tersangka');
    this.emit();
    return { ok: true, reward: lawJson.policeEnforcement.arrestReward };
  }

  issueFine(targetUid: string, recordId?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    this.state.policeActions = [
      {
        id: `pa_${now}`,
        officerId: this.state.character.uid,
        officerName: this.state.character.name,
        targetId: targetUid,
        targetName: targetUid,
        action: 'fine',
        recordId,
        amount: 20000,
        atMs: now,
        reviewStatus: 'pending',
      },
      ...this.state.policeActions,
    ];
    this.emit();
    return { ok: true, fineAmount: 20000 };
  }

  releasePlayer(targetUid: string, reason = 'Masa tahanan selesai / dibebaskan') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    this.state.policeActions = [
      {
        id: `pa_${now}`,
        officerId: this.state.character.uid,
        officerName: this.state.character.name,
        targetId: targetUid,
        action: 'release',
        evidence: reason,
        atMs: now,
        reviewStatus: 'valid',
      },
      ...this.state.policeActions,
    ];
    if (targetUid === this.state.character.uid && this.state.sentence) {
      this.state.sentence = { ...this.state.sentence, status: 'released', releasedAtMs: now };
      this.state.character = { ...this.state.character, sentence: null };
    }
    this.emit();
    return { ok: true };
  }

  reviewPoliceAction(actionId: string) {
    this.state.policeActions = this.state.policeActions.map((a) =>
      a.id === actionId ? { ...a, reviewed: true, reviewStatus: 'valid', reviewedAtMs: Date.now() } : a
    );
    this.emit();
    return { ok: true, status: 'valid' };
  }

  serveSentence(action: 'check' | 'work') {
    if (!this.state.character || !this.state.character.sentence?.active) {
      throw new Error('Tidak sedang menjalani hukuman tahanan.');
    }
    const now = Date.now();
    let endAtMs = Number(
      this.state.character.sentence.endAtMs ?? this.state.character.sentence.endsAtMs ?? now
    );
    let money = this.state.character.money;
    let workRed = this.state.character.sentence.workReductionSec || 0;

    if (action === 'work') {
      const cutMs = lawJson.prisonWorkSentenceCutSec * 1000;
      endAtMs = Math.max(now, endAtMs - cutMs);
      money += lawJson.prisonWorkPay;
      workRed += lawJson.prisonWorkSentenceCutSec;
      this.addTx('income', 'kerja_tahanan', lawJson.prisonWorkPay, money, 'Kerja ringan di tahanan');
    }

    const released = now >= endAtMs;
    if (released) {
      this.state.sentence = this.state.sentence
        ? { ...this.state.sentence, status: 'released', releasedAtMs: now, endAtMs }
        : null;
      this.state.character = { ...this.state.character, money, sentence: null };
    } else {
      this.state.sentence = this.state.sentence
        ? { ...this.state.sentence, endAtMs, workReductionSec: workRed }
        : null;
      this.state.character = {
        ...this.state.character,
        money,
        sentence: { ...this.state.character.sentence, endAtMs, workReductionSec: workRed },
      };
    }
    this.emit();
    return {
      ok: true,
      released,
      remainingSec: Math.max(0, Math.ceil((endAtMs - now) / 1000)),
      money,
    };
  }

  payBail(_targetUid?: string, targetName?: string, paymentSource: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const sent = this.state.character.sentence;
    if (!sent?.active) throw new Error('Tidak ada tahanan aktif yang membutuhkan jaminan.');
    const bailAmount = sent.bailAmount || 25000;
    if (paymentSource === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < bailAmount) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - bailAmount };
    } else {
      if (this.state.character.money < bailAmount) throw new Error('Uang dompet kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - bailAmount };
    }
    this.state.sentence = this.state.sentence ? { ...this.state.sentence, status: 'released', bailPaid: true } : null;
    this.state.character = { ...this.state.character, sentence: null };
    this.addTx('expense', 'jaminan_tahanan', bailAmount, this.state.character.money, 'Bayar jaminan kebebasan');
    this.emit();
    return {
      ok: true,
      bailAmount,
      payerMoney: this.state.character.money,
      releasedName: targetName || this.state.character.name,
    };
  }

  fileAppeal() {
    if (!this.state.character || !this.state.character.sentence?.active) {
      throw new Error('Tidak sedang menjalani tahanan.');
    }
    if (this.state.character.money < lawJson.appealFee) throw new Error('Uang tunai kurang untuk biaya banding.');
    const nextMoney = this.state.character.money - lawJson.appealFee;
    const accepted = Math.random() < lawJson.appealSuccessChance;
    const now = Date.now();
    const curEnd = Number(
      this.state.character.sentence.endAtMs ?? this.state.character.sentence.endsAtMs ?? now
    );
    const remMs = Math.max(0, curEnd - now);
    const cutMs = accepted ? Math.round(remMs * lawJson.appealSentenceReductionRatio) : 0;
    const nextEnd = Math.max(now, curEnd - cutMs);
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      sentence: { ...this.state.character.sentence, endAtMs: nextEnd },
    };
    if (this.state.sentence) {
      this.state.sentence = {
        ...this.state.sentence,
        endAtMs: nextEnd,
        appealFiled: true,
        appealOutcome: accepted ? 'accepted' : 'rejected',
      };
    }
    this.addTx('expense', 'banding_hukum', lawJson.appealFee, nextMoney, 'Pengajuan banding tahanan');
    this.emit();
    return {
      ok: true,
      accepted,
      cutSec: Math.round(cutMs / 1000),
      remainingSec: Math.max(0, Math.ceil((nextEnd - now) / 1000)),
      money: nextMoney,
    };
  }

  getCriminalRecord() {
    const now = Date.now();
    const wantedLevel = computeLazyWantedClient(
      this.state.character?.wantedLevel,
      this.state.character?.wantedUpdatedAtMs,
      now
    );
    return {
      ok: true,
      targetUid: this.state.character?.uid || '',
      wantedLevel,
      sentence: this.state.sentence,
      records: this.state.crimeRecords,
    };
  }

  installSecurity(propertyId: string, moduleId: 'lock' | 'alarm' | 'cctv') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const def = lawJson.securityModules[moduleId];
    if (this.state.character.money < def.installCost) throw new Error('Uang tunai kurang.');
    const existing = this.state.securityInstalls.find((s) => s.propertyId === propertyId);
    if (existing?.modules?.[moduleId]) throw new Error(`${def.label} sudah terpasang.`);
    const modules: Partial<Record<SecurityModuleId, boolean>> = {
      ...(existing?.modules || {}),
      [moduleId]: true,
    };
    const totalProtection = (Object.keys(modules) as SecurityModuleId[]).reduce(
      (sum, k) => sum + (modules[k] ? lawJson.securityModules[k].protection : 0),
      0
    );
    const monthlyFee = (Object.keys(modules) as SecurityModuleId[]).reduce(
      (sum, k) => sum + (modules[k] ? lawJson.securityModules[k].monthlyCost : 0),
      0
    );
    const nextMoney = this.state.character.money - def.installCost;
    this.state.character = { ...this.state.character, money: nextMoney };
    const doc: SecurityInstallDoc = {
      id: propertyId,
      propertyId,
      ownerId: this.state.character.uid,
      modules,
      guardName: existing?.guardName,
      totalProtection: Math.min(100, totalProtection),
      protectionScore: Math.min(100, totalProtection),
      monthlyFee,
      monthlyCost: monthlyFee,
      active: true,
      updatedAtMs: Date.now(),
    };
    this.state.securityInstalls = existing
      ? this.state.securityInstalls.map((s) => (s.propertyId === propertyId ? doc : s))
      : [doc, ...this.state.securityInstalls];
    this.addTx('expense', 'keamanan_properti', def.installCost, nextMoney, `Pasang ${def.label}`);
    this.emit();
    return { ok: true, protectionScore: doc.totalProtection, monthlyCost: doc.monthlyFee, money: nextMoney };
  }

  hireGuard(propertyId: string, guardName = 'Kang Hansip Ujang', action: 'hire' | 'dismiss' = 'hire') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const def = lawJson.securityModules.guard;
    const existing = this.state.securityInstalls.find((s) => s.propertyId === propertyId);
    if (action === 'hire' && this.state.character.money < def.installCost) {
      throw new Error('Uang tunai kurang untuk perekrutan satpam.');
    }
    const nextMoney = action === 'hire' ? this.state.character.money - def.installCost : this.state.character.money;
    this.state.character = { ...this.state.character, money: nextMoney };
    const modules: Partial<Record<SecurityModuleId, boolean>> = {
      ...(existing?.modules || {}),
      guard: action === 'hire',
    };
    const totalProtection = (Object.keys(modules) as SecurityModuleId[]).reduce(
      (sum, k) => sum + (modules[k] ? lawJson.securityModules[k].protection : 0),
      0
    );
    const monthlyFee = (Object.keys(modules) as SecurityModuleId[]).reduce(
      (sum, k) => sum + (modules[k] ? lawJson.securityModules[k].monthlyCost : 0),
      0
    );
    const doc: SecurityInstallDoc = {
      id: propertyId,
      propertyId,
      ownerId: this.state.character.uid,
      modules,
      guardName: action === 'hire' ? guardName : '',
      totalProtection: Math.min(100, totalProtection),
      protectionScore: Math.min(100, totalProtection),
      monthlyFee,
      monthlyCost: monthlyFee,
      active: totalProtection > 0,
      updatedAtMs: Date.now(),
    };
    this.state.securityInstalls = existing
      ? this.state.securityInstalls.map((s) => (s.propertyId === propertyId ? doc : s))
      : [doc, ...this.state.securityInstalls];
    this.emit();
    return { ok: true, protectionScore: doc.totalProtection, monthlyCost: doc.monthlyFee, money: nextMoney };
  }

  buyInsurance(subjectType: 'property' | 'business', subjectId: string, planId: 'basic' | 'premium') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const plan = lawJson.insurancePlans[planId];
    if (this.state.character.money < plan.premiumPerCycle) throw new Error('Uang tunai kurang untuk premi pertama.');
    const nextMoney = this.state.character.money - plan.premiumPerCycle;
    this.state.character = { ...this.state.character, money: nextMoney };
    const now = Date.now();
    const pol: InsurancePolicyDoc = {
      id: `ins_${now}`,
      ownerId: this.state.character.uid,
      subjectType,
      subjectId,
      planId,
      planLabel: plan.label,
      coverageAmount: plan.coverageAmount,
      premiumPerCycle: plan.premiumPerCycle,
      deductibleRate: plan.deductibleRate,
      maxClaimsPerCycle: plan.maxClaimsPerCycle,
      claimsUsed: 0,
      status: 'active',
      createdAtMs: now,
    };
    this.state.insurancePolicies = [pol, ...this.state.insurancePolicies];
    this.addTx('expense', 'asuransi', plan.premiumPerCycle, nextMoney, `Beli ${plan.label}`);
    this.emit();
    return { ok: true, insuranceId: pol.id, money: nextMoney };
  }

  fileClaim(insuranceId: string, crimeRecordId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const pol = this.state.insurancePolicies.find((p) => p.id === insuranceId);
    if (!pol) throw new Error('Polis asuransi tidak ditemukan.');
    const payout = Math.round(50000 * (1 - pol.deductibleRate));
    const nextMoney = this.state.character.money + payout;
    this.state.character = { ...this.state.character, money: nextMoney };
    this.state.insurancePolicies = this.state.insurancePolicies.map((p) =>
      p.id === insuranceId ? { ...p, claimsUsed: p.claimsUsed + 1 } : p
    );
    const claim: InsuranceClaimDoc = {
      id: `clm_${Date.now()}`,
      insuranceId,
      ownerId: this.state.character.uid,
      subjectId: pol.subjectId,
      crimeRecordId,
      lossAmount: 50000,
      payoutAmount: payout,
      status: 'paid',
      filedAtMs: Date.now(),
    };
    this.state.insuranceClaims = [claim, ...this.state.insuranceClaims];
    this.addTx('income', 'klaim_asuransi', payout, nextMoney, 'Pencairan klaim asuransi');
    this.emit();
    return { ok: true, payoutAmount: payout, money: nextMoney };
  }

  talkToNpc(npcId: string, message: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const def = DEFAULT_NPCS_CONFIG.npcs.find((n) => n.id === npcId);
    if (!def) throw new Error('NPC tidak ditemukan.');
    const now = Date.now();
    const lower = message.toLowerCase();
    const faq = aiJson.faqCache.find((f) => f.keywords.some((k) => lower.includes(k)));
    const reply = faq
      ? faq.reply
      : `${def.name}: "Halo ${this.state.character.name}! Ada yang bisa dibantu seputar aktivitas di Cicalengka hari ini?"`;
    const prev = this.state.npcMemories.find((m) => m.npcId === npcId);
    const affinity = Math.min(100, (prev?.affinity ?? 50) + 1);
    const mem: NpcMemoryDoc = {
      id: `${npcId}_${this.state.character.uid}`,
      uid: this.state.character.uid,
      npcId,
      affinity,
      interactionCount: (prev?.interactionCount ?? 0) + 1,
      summary: `${prev?.summary ? prev.summary + ' | ' : ''}Tanya: ${message.slice(0, 60)}`.slice(-240),
      lastMessageAtMs: now,
    };
    this.state.npcMemories = prev
      ? this.state.npcMemories.map((m) => (m.npcId === npcId ? mem : m))
      : [mem, ...this.state.npcMemories];
    this.emit();
    return {
      ok: true,
      npcId,
      npcName: def.name,
      npcRole: def.role,
      reply,
      source: faq ? ('faq_cache' as const) : ('scripted_fallback' as const),
      affinity,
      remainingCalls: aiJson.dailyCallsLimit,
      remainingTokens: aiJson.dailyTokenLimit,
    };
  }

  getNpcOptions(npcId: string) {
    const def = DEFAULT_NPCS_CONFIG.npcs.find((n) => n.id === npcId);
    if (!def) throw new Error('NPC tidak ditemukan.');
    const mem = this.state.npcMemories.find((m) => m.npcId === npcId);
    const options: Array<{
      actionId: string;
      label: string;
      category: 'social' | 'quest' | 'trade' | 'service' | 'moderation';
      uiHint?: string;
      questId?: string;
      itemId?: string;
      price?: number;
    }> = [
      { actionId: 'greet', label: 'Sapa Ramah (+Keakraban)', category: 'social' },
      { actionId: 'ask_rumor', label: 'Tanya Situasi & Kabar Pasar', category: 'social' },
    ];
    for (const q of questsJson.quests as QuestTemplateDoc[]) {
      if (!q.active) continue;
      const active = this.state.questLogs.find((l) => l.questId === q.id && l.status === 'active');
      if (active && (q.npcId === npcId || q.objective?.targetNpcId === npcId)) {
        options.push({ actionId: 'complete_quest', label: `Selesaikan Tugas: ${q.title}`, category: 'quest', questId: q.id });
      } else if (!active && q.npcId === npcId) {
        options.push({
          actionId: 'accept_quest',
          label: `Ambil Tugas: ${q.title} (+Rp ${q.rewardMoney.toLocaleString('id-ID')})`,
          category: 'quest',
          questId: q.id,
        });
      }
    }
    if (['pedagang', 'pedagang_grosir', 'petani'].includes(def.role)) {
      for (const itemId of def.defaultInventory) {
        const meta = productsJson.products.find((p) => p.id === itemId);
        if (meta) {
          options.push({
            actionId: 'buy_npc_item',
            label: `Beli ${meta.name} (Rp ${meta.suggestedRetail.toLocaleString('id-ID')})`,
            category: 'trade',
            itemId,
            price: meta.suggestedRetail,
          });
        }
      }
    }
    if (def.role.startsWith('polisi')) {
      options.push({ actionId: 'open_law_panel', label: 'Buka Panel Hukum & Laporan Polisi', category: 'service', uiHint: 'law_panel' });
    } else if (def.role === 'agen_properti') {
      options.push({ actionId: 'open_agent_panel', label: 'Buka Bursa Kavling & Agen Properti', category: 'service', uiHint: 'agent_panel' });
    } else if (def.role === 'pegawai_bank') {
      options.push({ actionId: 'open_mortgage_panel', label: 'Ajukan / Cek Simulasi KPR Bank', category: 'service', uiHint: 'mortgage_panel' });
    } else if (def.role === 'pejabat_desa') {
      options.push({ actionId: 'open_land_panel', label: 'Urus IMB & Sertifikat Tanah Desa', category: 'service', uiHint: 'land_panel' });
    } else if (def.role === 'kontraktor') {
      options.push({ actionId: 'open_construction_panel', label: 'Konsultasi Bangun Rumah & Renovasi', category: 'service', uiHint: 'construction_panel' });
    }
    return {
      ok: true,
      npcId,
      name: def.name,
      role: def.role,
      personality: def.personality,
      activity: def.schedule[0]?.activity || 'aktivitas',
      zoneTag: def.schedule[0]?.zoneTag || 'cicalengka',
      isSleeping: false,
      affinity: mem?.affinity ?? 50,
      summary: mem?.summary || '',
      mood: 'ramah',
      options,
    };
  }

  executeNpcAction(npcId: string, actionId: string, itemId?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const def = DEFAULT_NPCS_CONFIG.npcs.find((n) => n.id === npcId);
    if (!def) throw new Error('NPC tidak ditemukan.');
    if (actionId === 'report_ai_reply') {
      return { ok: true, actionId, message: 'Laporan kualitas dialog AI telah dicatat.' };
    }
    const uiHints: Record<string, { uiHint: string; message: string }> = {
      open_law_panel: { uiHint: 'law_panel', message: 'Membuka layanan hukum Polsek.' },
      open_agent_panel: { uiHint: 'agent_panel', message: 'Membuka layanan agen properti.' },
      open_mortgage_panel: { uiHint: 'mortgage_panel', message: 'Membuka simulasi KPR Bank.' },
      open_land_panel: { uiHint: 'land_panel', message: 'Membuka layanan kavling & IMB.' },
      open_construction_panel: { uiHint: 'construction_panel', message: 'Membuka proyek bangun & renovasi.' },
    };
    if (uiHints[actionId]) return { ok: true, actionId, ...uiHints[actionId] };
    if (actionId === 'ask_rumor') {
      return {
        ok: true,
        actionId,
        message: `${def.name}: "Info warga hari ini: ${this.state.treasury.activeEventLabel}. Situasi relatif kondusif."`,
      };
    }
    if (actionId === 'greet') {
      const prev = this.state.npcMemories.find((m) => m.npcId === npcId);
      const nextAff = Math.min(100, (prev?.affinity ?? 50) + 2);
      const mem: NpcMemoryDoc = {
        id: `${npcId}_${this.state.character.uid}`,
        uid: this.state.character.uid,
        npcId,
        affinity: nextAff,
        interactionCount: (prev?.interactionCount ?? 0) + 1,
        summary: prev?.summary || 'Berkenalan ramah.',
        lastMessageAtMs: Date.now(),
      };
      this.state.npcMemories = prev
        ? this.state.npcMemories.map((m) => (m.npcId === npcId ? mem : m))
        : [mem, ...this.state.npcMemories];
      this.emit();
      return { ok: true, actionId, affinity: nextAff, message: `Menyapa ${def.name}. Keakraban: ${nextAff}/100.` };
    }
    if (actionId === 'buy_npc_item' && itemId) {
      const meta = productsJson.products.find((p) => p.id === itemId);
      if (!meta) throw new Error('Item tidak ditemukan.');
      if (this.state.character.money < meta.suggestedRetail) throw new Error('Uang tunai kurang.');
      const nextMoney = this.state.character.money - meta.suggestedRetail;
      this.state.character = { ...this.state.character, money: nextMoney };
      const idx = this.state.inventory.findIndex((i) => i.itemId === itemId);
      if (idx >= 0) {
        this.state.inventory[idx] = { ...this.state.inventory[idx], quantity: this.state.inventory[idx].quantity + 1 };
      } else {
        this.state.inventory.push({
          id: itemId,
          uid: this.state.character.uid,
          itemId,
          category: meta.category as InventoryItemDoc['category'],
          name: meta.name,
          quantity: 1,
          updatedAtMs: Date.now(),
        });
      }
      this.addTx('expense', 'belanja_warga', meta.suggestedRetail, nextMoney, `Beli ${meta.name} dari ${def.name}`);
      this.emit();
      return { ok: true, actionId, itemId, itemName: meta.name, pricePaid: meta.suggestedRetail, money: nextMoney, message: `Berhasil membeli 1 ${meta.name}.` };
    }
    throw new Error('Aksi NPC tidak dikenali.');
  }

  acceptQuest(questId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const q = (questsJson.quests as QuestTemplateDoc[]).find((x) => x.id === questId);
    if (!q) throw new Error('Quest tidak ditemukan.');
    if (this.state.questLogs.filter((l) => l.status === 'active').length >= questsJson.maxActiveQuestsPerPlayer) {
      throw new Error(`Maksimal ${questsJson.maxActiveQuestsPerPlayer} quest aktif bersamaan.`);
    }
    const now = Date.now();
    const log: PlayerQuestLogDoc = {
      id: `ql_${now}`,
      uid: this.state.character.uid,
      questId: q.id,
      npcId: q.npcId,
      npcName: q.npcName,
      title: q.title,
      description: q.description,
      type: q.type,
      status: 'active',
      progress: 0,
      targetCount: q.objective.requiredCount || 1,
      rewardMoney: q.rewardMoney,
      rewardRep: q.rewardRep,
      rewardItemId: q.rewardItemId,
      rewardItemQty: q.rewardItemQty,
      acceptedAtMs: now,
    };
    this.state.questLogs = [log, ...this.state.questLogs];
    this.emit();
    return { ok: true, logId: log.id, questId: q.id, title: q.title };
  }

  completeQuest(logId?: string, questId?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const log = this.state.questLogs.find(
      (l) => l.status === 'active' && ((logId && l.id === logId) || (questId && l.questId === questId))
    );
    if (!log) throw new Error('Quest aktif tidak ditemukan.');
    const q = (questsJson.quests as QuestTemplateDoc[]).find((x) => x.id === log.questId);
    const rewardMoney = q?.rewardMoney ?? log.rewardMoney ?? 15000;
    const rewardRep = q?.rewardRep ?? log.rewardRep ?? 3;
    const nextMoney = this.state.character.money + rewardMoney;
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      reputation: Math.min(100, (this.state.character.reputation ?? 60) + rewardRep),
    };
    this.state.questLogs = this.state.questLogs.map((l) =>
      l.id === log.id ? { ...l, status: 'completed', progress: l.targetCount, completedAtMs: Date.now() } : l
    );
    this.addTx('income', 'quest_warga', rewardMoney, nextMoney, `Selesai quest: ${log.title}`);
    this.emit();
    return { ok: true, rewardMoney, rewardRep, money: nextMoney };
  }

  abandonQuest(logId?: string, questId?: string) {
    this.state.questLogs = this.state.questLogs.map((l) =>
      l.status === 'active' && ((logId && l.id === logId) || (questId && l.questId === questId))
        ? { ...l, status: 'abandoned', abandonedAtMs: Date.now() }
        : l
    );
    this.emit();
    return { ok: true };
  }

  applyMortgage(propertyId: string, downPaymentRate: number, termCycles: number, payFrom: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const prop = this.state.properties.find((p) => p.id === propertyId);
    if (!prop) throw new Error('Properti tidak ditemukan.');
    const listing = this.state.listings.find((l) => l.propertyId === propertyId && l.status === 'active' && l.kind === 'sale');
    const price = listing?.price ?? prop.baseValue;
    const quote = computeMortgageQuoteClient(price, downPaymentRate, termCycles);
    if (!quote) throw new Error('Parameter DP atau tenor KPR tidak valid.');
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < quote.upfrontTotal) {
        throw new Error('Saldo bank kurang untuk DP + BPHTB.');
      }
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - quote.upfrontTotal };
    } else {
      if (this.state.character.money < quote.upfrontTotal) throw new Error('Uang dompet kurang untuk DP + BPHTB.');
      this.state.character = { ...this.state.character, money: this.state.character.money - quote.upfrontTotal };
    }
    const now = Date.now();
    const mort: MortgageDoc = {
      id: `kpr_${now}`,
      borrowerId: this.state.character.uid,
      borrowerName: this.state.character.name,
      propertyId: prop.id,
      propertyName: prop.name,
      propertyPrice: quote.price,
      downPayment: quote.downPayment,
      principal: quote.principal,
      rate: quote.interestRatePerTerm,
      termCycles: quote.termCycles,
      paidCycles: 0,
      installment: quote.installment,
      remaining: quote.totalRepayment,
      nextDueAtMs: now + mortgageJson.cycleMs,
      missedCount: 0,
      status: 'active',
      createdAtMs: now,
      updatedAtMs: now,
    };
    this.state.mortgages = [mort, ...this.state.mortgages];
    this.state.properties = this.state.properties.map((p) =>
      p.id === prop.id
        ? { ...p, ownerId: this.state.character!.uid, ownerType: 'player', ownerName: this.state.character!.name, activeListingId: null }
        : p
    );
    this.state.listings = this.state.listings.map((l) => (l.propertyId === prop.id ? { ...l, status: 'closed' } : l));
    this.state.character = { ...this.state.character, currentHomeId: this.state.character.currentHomeId || prop.id, homeless: false };
    this.addTx('expense', 'kpr_dp', quote.upfrontTotal, this.state.character.money, `DP KPR ${prop.name}`);
    this.emit();
    return { ok: true, mortgageId: mort.id, installment: mort.installment };
  }

  payMortgage(mortgageId: string, payFrom: 'wallet' | 'bank' = 'wallet', cycles = 1) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.mortgages.findIndex((m) => m.id === mortgageId);
    if (idx < 0) throw new Error('Kontrak KPR tidak ditemukan.');
    const m = this.state.mortgages[idx];
    const payAmt = Math.min(m.remaining, m.installment * Math.max(1, cycles));
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < payAmt) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - payAmt };
    } else {
      if (this.state.character.money < payAmt) throw new Error('Uang tunai kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - payAmt };
    }
    const rem = Math.max(0, m.remaining - payAmt);
    const paidCycles = m.paidCycles + cycles;
    this.state.mortgages[idx] = {
      ...m,
      remaining: rem,
      paidCycles,
      status: rem <= 0 ? 'paid' : 'active',
      nextDueAtMs: m.nextDueAtMs + mortgageJson.cycleMs * cycles,
      updatedAtMs: Date.now(),
    };
    this.addTx('expense', 'cicilan_kpr', payAmt, this.state.character.money, `Cicilan KPR ${m.propertyName}`);
    this.emit();
    return { ok: true, paid: payAmt, remaining: rem, status: this.state.mortgages[idx].status };
  }

  earlyRepay(mortgageId: string, payFrom: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.mortgages.findIndex((m) => m.id === mortgageId);
    if (idx < 0) throw new Error('Kontrak KPR tidak ditemukan.');
    const m = this.state.mortgages[idx];
    const total = Math.round(m.remaining * (1 + mortgageJson.earlyRepayPenaltyRate));
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < total) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - total };
    } else {
      if (this.state.character.money < total) throw new Error('Uang tunai kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - total };
    }
    this.state.mortgages[idx] = { ...m, remaining: 0, status: 'paid', updatedAtMs: Date.now() };
    this.addTx('expense', 'pelunasan_kpr', total, this.state.character.money, `Pelunasan dipercepat ${m.propertyName}`);
    this.emit();
    return { ok: true, totalPaid: total };
  }

  foreclose(mortgageId: string) {
    const idx = this.state.mortgages.findIndex((m) => m.id === mortgageId);
    if (idx < 0) throw new Error('Kontrak KPR tidak ditemukan.');
    this.state.mortgages[idx] = { ...this.state.mortgages[idx], status: 'foreclosed', updatedAtMs: Date.now() };
    this.emit();
    return { ok: true };
  }

  buyLand(plotId: string, payFrom: 'wallet' | 'bank' = 'wallet', devProjectId?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.landPlots.findIndex((p) => p.id === plotId);
    if (idx < 0) throw new Error('Kavling tidak ditemukan.');
    const plot = this.state.landPlots[idx];
    if (plot.ownerId && plot.ownerId !== 'npc_pemdes_cicalengka' && plot.status !== 'available') {
      throw new Error('Kavling sudah dimiliki warga lain.');
    }
    const price = computeLandPlotPriceClient(plot);
    const totalCost = price + Math.round(price * 0.025);
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < totalCost) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - totalCost };
    } else {
      if (this.state.character.money < totalCost) throw new Error('Uang tunai kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - totalCost };
    }
    const now = Date.now();
    this.state.landPlots[idx] = {
      ...plot,
      ownerId: this.state.character.uid,
      ownerType: 'player',
      ownerName: this.state.character.name,
      certificateId: `SHM_TANAH_${plotId}_${now}`,
      imbStatus: 'none',
      permitStatus: 'none',
      status: 'owned',
      updatedAtMs: now,
    };
    if (devProjectId) {
      this.state.devProjects = this.state.devProjects.map((d) =>
        d.id === devProjectId
          ? { ...d, plotIds: Array.from(new Set([...d.plotIds, plotId])), totalCapitalSpent: d.totalCapitalSpent + totalCost }
          : d
      );
    }
    this.addTx('expense', 'beli_tanah', totalCost, this.state.character.money, `Beli kavling ${plot.name}`);
    this.emit();
    return { ok: true, plotId, totalCost };
  }

  applyPermit(plotId: string, payFrom: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.landPlots.findIndex((p) => p.id === plotId);
    if (idx < 0) throw new Error('Kavling tidak ditemukan.');
    const plot = this.state.landPlots[idx];
    if (plot.ownerId !== this.state.character.uid) throw new Error('Kavling bukan milikmu.');
    const now = Date.now();
    const curPermit = plot.permitStatus || plot.imbStatus || 'none';
    if (curPermit === 'pending' && now >= (plot.permitReadyAtMs || plot.imbReadyAtMs || 0)) {
      this.state.landPlots[idx] = { ...plot, imbStatus: 'approved', permitStatus: 'approved', updatedAtMs: now };
      this.emit();
      return { ok: true, permitStatus: 'approved', plotId };
    }
    if (curPermit === 'approved') return { ok: true, permitStatus: 'approved', plotId };
    const fee = landJson.imbFeeBase;
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < fee) throw new Error('Saldo bank kurang untuk biaya IMB.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - fee };
    } else {
      if (this.state.character.money < fee) throw new Error('Uang dompet kurang untuk biaya IMB.');
      this.state.character = { ...this.state.character, money: this.state.character.money - fee };
    }
    const readyAt = now + landJson.imbDurationMs;
    this.state.landPlots[idx] = {
      ...plot,
      imbStatus: 'pending',
      permitStatus: 'pending',
      imbSubmittedAtMs: now,
      imbReadyAtMs: readyAt,
      permitReadyAtMs: readyAt,
      imbFeePaid: fee,
      updatedAtMs: now,
    };
    this.addTx('expense', 'izin_imb', fee, this.state.character.money, `Pengajuan IMB ${plot.name}`);
    this.emit();
    return { ok: true, permitStatus: 'pending', permitReadyAtMs: readyAt };
  }

  startConstruction(
    plotId: string,
    blueprintId: 'kecil' | 'sedang' | 'besar',
    contractorType: 'npc' | 'player' = 'npc',
    payFrom: 'wallet' | 'bank' = 'wallet',
    devProjectId?: string
  ) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const pIdx = this.state.landPlots.findIndex((p) => p.id === plotId);
    if (pIdx < 0) throw new Error('Kavling tidak ditemukan.');
    const plot = this.state.landPlots[pIdx];
    const bp = constructionJson.blueprints[blueprintId];
    const now = Date.now();
    const permitReady =
      plot.permitStatus === 'approved' ||
      plot.imbStatus === 'approved' ||
      ((plot.permitStatus === 'pending' || plot.imbStatus === 'pending') &&
        now >= (plot.permitReadyAtMs || plot.imbReadyAtMs || 0));
    if (!permitReady) throw new Error('IMB belum terbit.');

    for (const [mId, need] of Object.entries(bp.materials)) {
      const inv = this.state.inventory.find((i) => i.itemId === mId);
      if (!inv || inv.quantity < need) {
        throw new Error(`Material kurang: ${mId} (${inv?.quantity || 0}/${need}).`);
      }
    }

    const rate = constructionJson.contractorFeeRate[contractorType];
    const laborCost = Math.round(bp.laborCost * rate);
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < laborCost) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - laborCost };
    } else {
      if (this.state.character.money < laborCost) throw new Error('Uang tunai kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - laborCost };
    }

    for (const [mId, need] of Object.entries(bp.materials)) {
      this.state.inventory = this.state.inventory
        .map((i) => (i.itemId === mId ? { ...i, quantity: i.quantity - need } : i))
        .filter((i) => i.quantity > 0);
    }

    const conId = `con_${plotId}_${now}`;
    const phaseEndsAtMs = now + bp.phaseDurationSec * 1000;
    const con: ConstructionDoc = {
      id: conId,
      plotId,
      plotName: plot.name,
      ownerId: this.state.character.uid,
      ownerName: this.state.character.name,
      blueprintId,
      blueprintName: bp.name,
      propertyType: bp.propertyType as PropertyType,
      contractorType,
      totalCost: laborCost,
      phase: 'pondasi',
      phaseIndex: 0,
      phaseDurationMs: bp.phaseDurationSec * 1000,
      phaseStartedAtMs: now,
      phaseEndsAtMs,
      startedAtMs: now,
      estimatedMarketValue: bp.estimatedMarketValue,
      baseRent: bp.baseRent,
      status: 'active',
      devProjectId: devProjectId || null,
    };
    this.state.constructions = [con, ...this.state.constructions];
    this.state.landPlots[pIdx] = {
      ...plot,
      imbStatus: 'approved',
      permitStatus: 'approved',
      constructionId: conId,
      status: 'building',
      updatedAtMs: now,
    };
    this.addTx('expense', 'konstruksi', laborCost, this.state.character.money, `Bangun ${bp.name}`);
    this.emit();
    return { ok: true, constructionId: conId, phase: 'pondasi', phaseEndsAtMs, laborCost };
  }

  advanceConstruction(constructionId: string) {
    const idx = this.state.constructions.findIndex((c) => c.id === constructionId);
    if (idx < 0) throw new Error('Proyek konstruksi tidak ditemukan.');
    const c = this.state.constructions[idx];
    const now = Date.now();
    const phases = constructionJson.phasesOrder as Array<'pondasi' | 'dinding' | 'atap' | 'finishing'>;
    const perMs = Math.max(5000, c.phaseDurationMs || 35000);
    let pIdx = Math.max(0, phases.indexOf(c.phase as 'pondasi' | 'dinding' | 'atap' | 'finishing'));
    let curEnd = c.phaseEndsAtMs || c.phaseStartedAtMs + perMs;
    let curStart = c.phaseStartedAtMs;
    let nextPhase = c.phase;
    let advanced = false;

    while (nextPhase !== 'selesai' && now >= curEnd) {
      advanced = true;
      if (pIdx >= phases.length - 1) {
        nextPhase = 'selesai';
        break;
      }
      pIdx += 1;
      curStart = curEnd;
      curEnd = curStart + perMs;
      nextPhase = phases[pIdx];
    }

    this.state.constructions[idx] = {
      ...c,
      phase: nextPhase,
      phaseIndex: pIdx,
      phaseStartedAtMs: curStart,
      phaseEndsAtMs: curEnd,
    };
    this.emit();
    return {
      ok: true,
      constructionId,
      phase: nextPhase,
      phaseEndsAtMs: curEnd,
      status: c.status,
      advanced,
      remainingSec: nextPhase === 'selesai' ? 0 : Math.max(0, Math.ceil((curEnd - now) / 1000)),
    };
  }

  completeConstruction(constructionId: string, propertyName?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const adv = this.advanceConstruction(constructionId);
    if (adv.phase !== 'selesai') {
      throw new Error(`Masih di tahap ${adv.phase} (${adv.remainingSec}d lagi).`);
    }
    const idx = this.state.constructions.findIndex((c) => c.id === constructionId);
    const c = this.state.constructions[idx];
    const plot = this.state.landPlots.find((p) => p.id === c.plotId)!;
    const bp = constructionJson.blueprints[c.blueprintId];
    const now = Date.now();
    const propId = `prop_built_${c.plotId}_${now}`;
    const finalName = propertyName?.trim() || `${bp.name} (${plot.name})`;
    const certId = `SHM_BANGUN_${propId}`;

    const newProp: PropertyDoc = {
      id: propId,
      name: finalName,
      type: bp.propertyType as PropertyType,
      zone: 'cicalengka',
      areaTag: plot.areaTag,
      position: { ...plot.position },
      size: bp.size,
      rooms: bp.rooms,
      condition: 100,
      facilities: { electricity: true, water: true, internet: false, ac: false },
      baseRent: bp.baseRent,
      baseDeposit: bp.baseRent,
      baseValue: bp.estimatedMarketValue + Math.round(plot.price * 0.45),
      ownerId: this.state.character.uid,
      ownerType: 'player',
      ownerName: this.state.character.name,
      certificateId: certId,
      activeListingId: null,
      activeLeaseId: null,
      layout: bp.layout,
      furniture: [],
    };
    this.state.properties = [...this.state.properties, newProp];
    this.state.constructions[idx] = { ...c, status: 'completed', propertyId: propId, builtPropertyId: propId, completedAtMs: now };
    this.state.landPlots = this.state.landPlots.map((p) =>
      p.id === plot.id ? { ...p, status: 'built', propertyId: propId, builtPropertyId: propId } : p
    );
    this.state.character = {
      ...this.state.character,
      currentHomeId: this.state.character.currentHomeId || propId,
      homeless: false,
      reputation: Math.min(100, (this.state.character.reputation ?? 60) + 6),
    };
    this.emit();
    return { ok: true, constructionId, propertyId: propId, propertyName: finalName, certificateId: certId };
  }

  becomeAgent(payFrom: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const fee = constructionJson.agentSettings.licenseFee;
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < fee) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - fee };
    } else {
      if (this.state.character.money < fee) throw new Error('Uang tunai kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - fee };
    }
    this.state.character = {
      ...this.state.character,
      isPropertyAgent: true,
      agentStats: { licensedAtMs: Date.now(), dealsClosed: 0, totalCommission: 0 },
    };
    this.addTx('expense', 'lisensi_agen', fee, this.state.character.money, 'Lisensi Resmi Agen Properti');
    this.emit();
    return { ok: true, isPropertyAgent: true, fee };
  }

  createClientRequest(desiredArea: AreaTag | 'any' = 'any', desiredType: PropertyType | 'any' = 'any', desiredKind: 'sale' | 'rent' = 'sale') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    const req: AgentClientRequestDoc = {
      id: `cli_${now}`,
      agentId: this.state.character.uid,
      clientName: ['Teh Rina (Pegawai Bank)', 'Kang Dedi (Insinyur)', 'Ibu Hj. Siti'][this.state.agentClients.length % 3],
      isNpc: true,
      desiredArea,
      desiredType,
      desiredKind,
      maxBudget: desiredKind === 'sale' ? 3_800_000 : 250_000,
      commissionRate: constructionJson.agentSettings.baseCommissionRate,
      status: 'open',
      createdAtMs: now,
    };
    this.state.agentClients = [req, ...this.state.agentClients];
    this.emit();
    return { ok: true, clientId: req.id, clientName: req.clientName };
  }

  closeDeal(clientId: string, listingId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const listing = this.state.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Listing tidak ditemukan.');
    const comm = Math.round(listing.price * constructionJson.agentSettings.baseCommissionRate);
    const nextMoney = this.state.character.money + comm;
    this.state.character = { ...this.state.character, money: nextMoney };
    this.state.agentClients = this.state.agentClients.map((c) =>
      c.id === clientId
        ? { ...c, status: 'closed', matchedListingId: listingId, matchedPropertyName: listing.propertyName, commissionEarned: comm, closedAtMs: Date.now() }
        : c
    );
    this.addTx('income', 'komisi_agen', comm, nextMoney, `Komisi closing ${listing.propertyName}`);
    this.emit();
    return { ok: true, commissionEarned: comm, money: nextMoney };
  }

  createDevelopmentProject(name: string, plotIds: string[] = []) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const now = Date.now();
    const proj: DevelopmentProjectDoc = {
      id: `dev_${now}`,
      developerId: this.state.character.uid,
      developerName: this.state.character.name,
      name,
      plotIds,
      constructionIds: [],
      propertyIds: [],
      totalCapitalSpent: 0,
      totalRevenue: 0,
      status: 'planning',
      createdAtMs: now,
    };
    this.state.devProjects = [proj, ...this.state.devProjects];
    this.emit();
    return { ok: true, projectId: proj.id };
  }

  startRenovation(
    propertyId: string,
    renovationType: 'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage',
    payFrom: 'wallet' | 'bank' = 'wallet'
  ) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const prop = this.state.properties.find((p) => p.id === propertyId);
    if (!prop) throw new Error('Properti tidak ditemukan.');
    const cfg = constructionJson.renovations[renovationType];
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < cfg.cost) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - cfg.cost };
    } else {
      if (this.state.character.money < cfg.cost) throw new Error('Uang tunai kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - cfg.cost };
    }
    const now = Date.now();
    const ren: RenovationDoc = {
      id: `ren_${now}`,
      propertyId,
      propertyName: prop.name,
      ownerId: this.state.character.uid,
      renovationType,
      label: cfg.label,
      cost: cfg.cost,
      valueBoost: cfg.valueBoost,
      startedAtMs: now,
      completesAtMs: now + cfg.durationSec * 1000,
      status: 'active',
    };
    this.state.renovations = [ren, ...this.state.renovations];
    this.addTx('expense', 'renovasi', cfg.cost, this.state.character.money, `Mulai ${cfg.label} di ${prop.name}`);
    this.emit();
    return { ok: true, renovationId: ren.id, completesAtMs: ren.completesAtMs };
  }

  completeRenovation(renovationId: string) {
    const idx = this.state.renovations.findIndex((r) => r.id === renovationId);
    if (idx < 0) throw new Error('Proyek renovasi tidak ditemukan.');
    const ren = this.state.renovations[idx];
    const now = Date.now();
    if (now < ren.completesAtMs) {
      throw new Error(`Renovasi masih berjalan (${Math.ceil((ren.completesAtMs - now) / 1000)} detik lagi).`);
    }
    this.state.renovations[idx] = { ...ren, status: 'completed', completedAtMs: now };
    this.state.properties = this.state.properties.map((p) =>
      p.id === ren.propertyId ? { ...p, baseValue: p.baseValue + ren.valueBoost, condition: 100 } : p
    );
    this.emit();
    return { ok: true, propertyId: ren.propertyId, valueBoost: ren.valueBoost };
  }

  buyFurnitureSet(setId: string, payFrom: 'wallet' | 'bank' = 'wallet') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const set = constructionJson.furnitureSets.find((s) => s.id === setId);
    if (!set) throw new Error('Paket mebel tidak ditemukan.');
    if (payFrom === 'bank') {
      if (!this.state.bankAccount || this.state.bankAccount.balance < set.bundlePrice) throw new Error('Saldo bank kurang.');
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - set.bundlePrice };
    } else {
      if (this.state.character.money < set.bundlePrice) throw new Error('Uang tunai kurang.');
      this.state.character = { ...this.state.character, money: this.state.character.money - set.bundlePrice };
    }
    const now = Date.now();
    for (const fId of set.itemIds) {
      const fMeta = furnitureJson.items.find((x) => x.id === fId);
      const iIdx = this.state.inventory.findIndex((i) => i.itemId === fId);
      if (iIdx >= 0) {
        this.state.inventory[iIdx] = { ...this.state.inventory[iIdx], quantity: this.state.inventory[iIdx].quantity + 1 };
      } else {
        this.state.inventory.push({
          id: fId,
          uid: this.state.character.uid,
          itemId: fId,
          category: 'furniture',
          name: fMeta?.name || fId,
          quantity: 1,
          updatedAtMs: now,
        });
      }
    }
    this.addTx('expense', 'paket_mebel', set.bundlePrice, this.state.character.money, `Beli ${set.name}`);
    this.emit();
    return { ok: true, setName: set.name, bundlePrice: set.bundlePrice, money: this.state.character.money };
  }

  // --- SISTEM KENDARAAN (MOTOR, MOBIL, DEALER, LEASING, STNK, SIM, SPBU, BENGKEL) ---

  private getDealerParkingSpawn(dealerId: string): WorldPosition {
    const map: Record<string, WorldPosition> = {
      dealer_motor_baru: { x: -32, y: 0.35, z: -34.2, rotY: Math.PI },
      lapak_motor_bekas: { x: -65.2, y: 0.35, z: -30, rotY: Math.PI / 2 },
      showroom_mobil_baru: { x: -30, y: 0.35, z: 21.6, rotY: Math.PI },
      showroom_mobil_bekas: { x: -34, y: 0.35, z: -45.5, rotY: 0 },
      stasiun: { x: 16, y: 0.35, z: -48, rotY: 0 },
      pasar: { x: 36, y: 0.35, z: 12.2, rotY: 0 },
      bank: { x: -37, y: 0.35, z: -1, rotY: Math.PI },
      alun_alun: { x: 12, y: 0.35, z: 2, rotY: 0 },
    };
    return map[dealerId] || map.alun_alun;
  }

  private generateUniquePlateLocal(): string {
    const existing = new Set(this.state.vehicles.map((v) => v.plateNumber.replace(/\s+/g, '').toUpperCase()));
    const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    for (let i = 0; i < 15; i++) {
      const digits = String(Math.floor(1000 + Math.random() * 8999));
      const suf =
        letters[Math.floor(Math.random() * letters.length)] +
        letters[Math.floor(Math.random() * letters.length)];
      const plate = `${vehiclesJson.platePrefix} ${digits} ${suf}`;
      const key = plate.replace(/\s+/g, '').toUpperCase();
      if (!existing.has(key)) return plate;
    }
    return `${vehiclesJson.platePrefix} ${String(Date.now()).slice(-4)} CL`;
  }

  private applyWearLocal(
    model: VehicleModelConfig,
    cur: { fuel: number; condition: number; odometerKm: number },
    distanceKm: number,
    terrainType: 'road' | 'offroad',
    crashDamage = 0
  ) {
    const d = Math.max(0, Math.min(50, distanceKm));
    const cleanCrash = Math.max(0, Math.min(35, crashDamage));
    const isTrail = model.subType === 'trail' || model.subType === 'suv';
    const terrainMult = terrainType === 'offroad' ? (isTrail ? 1.05 : 1.75) : 1.0;
    const nextFuel = Math.max(0, Math.round((cur.fuel - d * model.consumptionPerKm) * 100) / 100);
    const nextCondition = Math.max(
      5,
      Math.round((cur.condition - d * model.wearRatePerKm * terrainMult - cleanCrash) * 10) / 10
    );
    const nextOdometerKm = Math.round((cur.odometerKm + d) * 100) / 100;
    return { nextFuel, nextCondition, nextOdometerKm };
  }

  private syncLazyVehicleStateLocal() {
    if (!this.state.character) return;
    const nowMs = Date.now();
    const uid = this.state.character.uid;

    if (this.state.vehicleTestDrive?.status === 'active' && nowMs >= this.state.vehicleTestDrive.expiresAtMs) {
      this.state.vehicleTestDrive = { ...this.state.vehicleTestDrive, status: 'expired' };
      if (this.state.character.drivingVehicleId === `td_${uid}`) {
        this.state.character = { ...this.state.character, drivingVehicleId: null };
      }
    }

    for (let i = 0; i < this.state.vehicleLeases.length; i++) {
      const lease = this.state.vehicleLeases[i];
      if (lease.status !== 'active' || nowMs < lease.nextDueAtMs) continue;
      const cycleMs = dealerJson.leasing.cycleMs;
      const graceMs = dealerJson.leasing.gracePeriodMs;
      const periodsDue = Math.min(4, Math.floor((nowMs - lease.nextDueAtMs) / cycleMs) + 1);
      const overdue = nowMs - lease.nextDueAtMs;
      const nextMissed = overdue > graceMs ? Math.max(lease.missedCount, Math.floor((overdue - graceMs) / cycleMs) + 1) : lease.missedCount;

      if (nextMissed >= dealerJson.leasing.maxMissedBeforeRepossess) {
        this.state.vehicleLeases[i] = { ...lease, missedCount: nextMissed, status: 'repossessed', updatedAtMs: nowMs };
        this.state.vehicles = this.state.vehicles.filter((v) => v.id !== lease.vehicleId);
        this.state.character = {
          ...this.state.character,
          ownedVehicleCount: this.state.vehicles.length,
        };
      } else {
        this.state.vehicleLeases[i] = { ...lease, missedCount: nextMissed, updatedAtMs: nowMs };
        const pIdx = lease.paidCycles + periodsDue;
        const billId = `vlease_${lease.id}_c${pIdx}`;
        if (!this.state.bills.some((b) => b.id === billId)) {
          this.state.bills.unshift({
            id: billId,
            uid,
            billType: 'vehicle_lease_installment',
            title: `Cicilan Leasing ${lease.vehicleName} ke-${pIdx}`,
            periodIndex: pIdx,
            vehicleLeaseId: lease.id,
            vehicleId: lease.vehicleId,
            baseAmount: Math.min(lease.remaining, lease.installment),
            lateFee: overdue > graceMs ? Math.round(lease.installment * dealerJson.leasing.lateFeeRate) : 0,
            totalDue:
              Math.min(lease.remaining, lease.installment) +
              (overdue > graceMs ? Math.round(lease.installment * dealerJson.leasing.lateFeeRate) : 0),
            status: 'unpaid',
            dueAtMs: lease.nextDueAtMs,
          });
        }
      }
    }

    for (let i = 0; i < this.state.vehicles.length; i++) {
      const v = this.state.vehicles[i];
      if (v.status !== 'parked') continue;
      if (nowMs > v.stnkExpiresAtMs) {
        const model = getVehicleModelById(v.modelId);
        if (model) {
          const stnk = computeLazyStnkStatusClient(v, nowMs);
          const billId = `vstnk_${v.id}_${Math.floor(v.stnkExpiresAtMs / 60000)}`;
          if (!this.state.bills.some((b) => b.id === billId)) {
            this.state.bills.unshift({
              id: billId,
              uid,
              billType: 'vehicle_tax',
              title: `Pajak STNK ${v.name} (${v.plateNumber})`,
              periodIndex: stnk.overduePeriods,
              vehicleId: v.id,
              baseAmount: stnk.baseTax + vehiclesJson.stnkAdminFee,
              lateFee: stnk.latePenalty,
              totalDue: stnk.totalDue,
              status: 'unpaid',
              dueAtMs: v.stnkExpiresAtMs,
            });
          }
        }
      }
      if (v.parkedType === 'roadside' && nowMs - v.updatedAtMs > vehiclesJson.roadsideImpoundAfterMs) {
        this.state.vehicles[i] = {
          ...v,
          status: 'impounded',
          parkedType: 'impound',
          impoundReason: 'Parkir liar di bahu jalan terlalu lama (Dishub Cicalengka)',
          impoundedAtMs: nowMs,
          impoundFine: vehiclesJson.impoundRecoveryBaseFee,
          updatedAtMs: nowMs,
        };
      }
    }
  }

  buyVehicle(dealerId: string, modelId: string, color?: string, isUsed?: boolean, useBank = false) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const dealer = dealerJson.dealers.find((d) => d.id === dealerId);
    const model = getVehicleModelById(modelId);
    if (!dealer || !model || !model.sellable || !dealer.modelIds.includes(model.id)) {
      throw new Error('Dealer atau model kendaraan tidak valid.');
    }
    if (this.state.vehicles.length >= vehiclesJson.maxOwnedVehiclesPerPlayer) {
      throw new Error(`Maksimal kepemilikan ${vehiclesJson.maxOwnedVehiclesPerPlayer} kendaraan.`);
    }
    const chosenColor = color && model.colors.some((c) => c.toUpperCase() === color.toUpperCase())
      ? color.toUpperCase()
      : model.colors[0];
    const usedFlag = dealer.isUsed || Boolean(isUsed);
    const basePrice = usedFlag
      ? Math.round(((model.usedPriceMin + model.usedPriceMax) / 2) / 500) * 500
      : model.newPrice;
    const totalCost = basePrice + vehiclesJson.stnkAdminFee;

    if (useBank) {
      if (!this.state.bankAccount || this.state.bankAccount.balance < totalCost) {
        throw new Error(`Saldo bank kurang (butuh Rp ${totalCost.toLocaleString('id-ID')}).`);
      }
      this.state.bankAccount = { ...this.state.bankAccount, balance: this.state.bankAccount.balance - totalCost };
    } else {
      if (this.state.character.money < totalCost) {
        throw new Error(`Uang tunai kurang (butuh Rp ${totalCost.toLocaleString('id-ID')}).`);
      }
      this.state.character = { ...this.state.character, money: this.state.character.money - totalCost };
    }

    const nowMs = Date.now();
    const vehicleId = `veh_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const plateNumber = this.generateUniquePlateLocal();
    const spawn = this.getDealerParkingSpawn(dealerId);
    const vehicle: VehicleDoc = {
      id: vehicleId,
      ownerId: this.state.character.uid,
      ownerName: this.state.character.name,
      modelId: model.id,
      category: model.category,
      name: model.name,
      plateNumber,
      color: chosenColor,
      condition: usedFlag ? 78 : 100,
      odometerKm: usedFlag ? 140 : 0,
      fuel: model.tankCapacity,
      fuelCapacity: model.tankCapacity,
      isElectric: Boolean(model.isElectric),
      registeredAtMs: nowMs,
      stnkExpiresAtMs: nowMs + vehiclesJson.stnkPeriodMs,
      taxLastPaidAtMs: nowMs,
      lastMaintenanceAtMs: nowMs,
      lastWearAtMs: nowMs,
      insuranceId: null,
      hasInsurance: false,
      leaseId: null,
      garagePropertyId: null,
      parkedPos: { ...spawn, zone: 'cicalengka' },
      parkedType: 'dealer',
      status: 'parked',
      driverId: null,
      passengerIds: [],
      isPublicActive: false,
      accessories: [],
      purchasePrice: basePrice,
      isUsed: usedFlag,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    this.state.vehicles = [vehicle, ...this.state.vehicles];
    this.state.character = {
      ...this.state.character,
      ownedVehicleCount: this.state.vehicles.length,
      updatedAt: nowMs,
    };
    this.addTreasuryTax(vehiclesJson.stnkAdminFee, 'vehicle');
    this.addTx('expense', 'beli_kendaraan', totalCost, this.state.character.money, `Beli ${model.name} (${plateNumber})`);
    this.addLedger(this.state.character.uid, `dealer:${dealerId}`, basePrice, 'buy_vehicle_cash', vehicleId, vehiclesJson.stnkAdminFee);
    this.emit();
    return { ok: true, vehicle, money: this.state.character.money };
  }

  buyVehicleOnCredit(
    dealerId: string,
    modelId: string,
    color?: string,
    downPaymentRate = 0.3,
    termCycles = 6
  ) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const dealer = dealerJson.dealers.find((d) => d.id === dealerId);
    const model = getVehicleModelById(modelId);
    if (!dealer || !model || !model.sellable || !dealer.modelIds.includes(model.id)) {
      throw new Error('Dealer atau model kendaraan tidak valid.');
    }
    const basePrice = dealer.isUsed
      ? Math.round(((model.usedPriceMin + model.usedPriceMax) / 2) / 500) * 500
      : model.newPrice;
    const quote = computeVehicleLeaseQuoteClient(basePrice, downPaymentRate, termCycles);
    if (!quote) throw new Error('Parameter DP atau tenor leasing tidak valid.');
    if (this.state.vehicles.length >= vehiclesJson.maxOwnedVehiclesPerPlayer) {
      throw new Error('Slot garasi penuh.');
    }
    const activeLeases = this.state.vehicleLeases.filter((l) => l.status === 'active');
    if (activeLeases.length >= dealerJson.leasing.maxActiveLeases) {
      throw new Error('Batas maksimum kontrak leasing aktif tercapai.');
    }
    const creditScore = this.state.bankAccount?.creditScore ?? this.state.character.creditScore ?? 70;
    if (creditScore < dealerJson.leasing.minCreditScore) {
      throw new Error(`Skor kredit minimal ${dealerJson.leasing.minCreditScore} diperlukan.`);
    }
    const completedShifts =
      this.state.character.currentJob?.shiftsCompleted ?? this.state.character.completedShifts ?? 0;
    if (completedShifts < dealerJson.leasing.minCompletedShifts) {
      throw new Error(`Minimal ${dealerJson.leasing.minCompletedShifts} shift kerja selesai untuk leasing.`);
    }
    if (this.state.character.money < quote.upfrontTotal) {
      throw new Error(`Uang tunai DP + admin kurang (butuh Rp ${quote.upfrontTotal.toLocaleString('id-ID')}).`);
    }

    const nowMs = Date.now();
    const vehicleId = `veh_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const leaseId = `vlease_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const plateNumber = this.generateUniquePlateLocal();
    const chosenColor = color && model.colors.some((c) => c.toUpperCase() === color.toUpperCase())
      ? color.toUpperCase()
      : model.colors[0];
    const spawn = this.getDealerParkingSpawn(dealerId);

    const vehicle: VehicleDoc = {
      id: vehicleId,
      ownerId: this.state.character.uid,
      ownerName: this.state.character.name,
      modelId: model.id,
      category: model.category,
      name: model.name,
      plateNumber,
      color: chosenColor,
      condition: dealer.isUsed ? 80 : 100,
      odometerKm: dealer.isUsed ? 120 : 0,
      fuel: model.tankCapacity,
      fuelCapacity: model.tankCapacity,
      isElectric: Boolean(model.isElectric),
      registeredAtMs: nowMs,
      stnkExpiresAtMs: nowMs + vehiclesJson.stnkPeriodMs,
      taxLastPaidAtMs: nowMs,
      lastMaintenanceAtMs: nowMs,
      lastWearAtMs: nowMs,
      leaseId,
      garagePropertyId: null,
      parkedPos: { ...spawn, zone: 'cicalengka' },
      parkedType: 'dealer',
      status: 'parked',
      driverId: null,
      passengerIds: [],
      isPublicActive: false,
      accessories: [],
      purchasePrice: basePrice,
      isUsed: dealer.isUsed,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    const lease: VehicleLeaseDoc = {
      id: leaseId,
      borrowerId: this.state.character.uid,
      borrowerName: this.state.character.name,
      vehicleId,
      modelId: model.id,
      vehicleName: model.name,
      vehiclePrice: basePrice,
      downPayment: quote.downPayment,
      principal: quote.principal,
      rate: quote.interestRatePerTerm,
      termCycles: quote.termCycles,
      paidCycles: 0,
      installment: quote.installment,
      remaining: quote.totalRepayment,
      nextDueAtMs: nowMs + dealerJson.leasing.cycleMs,
      missedCount: 0,
      status: 'active',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    const nextMoney = this.state.character.money - quote.upfrontTotal;
    this.state.vehicles = [vehicle, ...this.state.vehicles];
    this.state.vehicleLeases = [lease, ...this.state.vehicleLeases];
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      ownedVehicleCount: this.state.vehicles.length,
      updatedAt: nowMs,
    };
    this.addTreasuryTax(quote.adminAndPlateFee, 'vehicle');
    this.addTx('expense', 'dp_leasing', quote.upfrontTotal, nextMoney, `DP Kredit ${model.name} (${plateNumber})`);
    this.addLedger(this.state.character.uid, 'system:bank', quote.downPayment, 'vehicle_lease_downpayment', leaseId, quote.adminAndPlateFee);
    this.emit();
    return { ok: true, vehicle, lease, money: nextMoney };
  }

  sellVehicle(vehicleId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const vIdx = this.state.vehicles.findIndex((v) => v.id === vehicleId);
    if (vIdx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[vIdx];
    if (v.status === 'driving' || v.status === 'listed' || v.status === 'auctioning') {
      throw new Error('Parkir & batalkan listing sebelum menjual kendaraan.');
    }
    const nowMs = Date.now();
    const marketValue = computeVehicleMarketValueClient(v, nowMs);
    const payout = Math.round((marketValue * 0.68) / 500) * 500;
    const activeLease = v.leaseId ? this.state.vehicleLeases.find((l) => l.id === v.leaseId && l.status === 'active') : null;
    const leaseRemaining = activeLease ? activeLease.remaining : 0;
    if (payout < leaseRemaining) {
      throw new Error(`Nilai jual (Rp ${payout.toLocaleString('id-ID')}) belum menutupi sisa leasing (Rp ${leaseRemaining.toLocaleString('id-ID')}).`);
    }

    const netCash = payout - leaseRemaining;
    const nextMoney = this.state.character.money + netCash;
    this.state.vehicles = this.state.vehicles.filter((x) => x.id !== vehicleId);
    if (activeLease) {
      this.state.vehicleLeases = this.state.vehicleLeases.map((l) =>
        l.id === activeLease.id ? { ...l, remaining: 0, status: 'paid', updatedAtMs: nowMs } : l
      );
    }
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      ownedVehicleCount: this.state.vehicles.length,
      ...(this.state.character.drivingVehicleId === vehicleId ? { drivingVehicleId: null } : {}),
      updatedAt: nowMs,
    };
    this.addTx('income', 'jual_kendaraan', netCash, nextMoney, `Jual ${v.name} (${v.plateNumber}) ke dealer`);
    this.emit();
    return { ok: true, payout, leasePayoff: leaseRemaining, netCash, money: nextMoney };
  }

  tradeInVehicle(tradeInVehicleId: string, dealerId: string, targetModelId: string, color?: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const oldIdx = this.state.vehicles.findIndex((v) => v.id === tradeInVehicleId);
    if (oldIdx < 0) throw new Error('Kendaraan lama tidak ditemukan.');
    const oldV = this.state.vehicles[oldIdx];
    const dealer = dealerJson.dealers.find((d) => d.id === dealerId);
    const targetModel = getVehicleModelById(targetModelId);
    if (!dealer || !targetModel || !targetModel.sellable || !dealer.modelIds.includes(targetModel.id)) {
      throw new Error('Dealer atau model tujuan tidak valid.');
    }
    if (oldV.status === 'driving' || oldV.status === 'listed' || oldV.leaseId) {
      throw new Error('Kendaraan sedang dipakai/listing/leasing tidak dapat tukar tambah.');
    }
    if (oldV.condition < dealerJson.tradeIn.minConditionAccepted) {
      throw new Error('Kondisi kendaraan terlalu rusak untuk tukar tambah.');
    }

    const nowMs = Date.now();
    const oldMarket = computeVehicleMarketValueClient(oldV, nowMs);
    const tradeInCredit = Math.round((oldMarket * dealerJson.tradeIn.valuationRatio) / 500) * 500;
    const targetBasePrice = dealer.isUsed
      ? Math.round(((targetModel.usedPriceMin + targetModel.usedPriceMax) / 2) / 500) * 500
      : targetModel.newPrice;
    const adminFee = vehiclesJson.stnkAdminFee;
    const netCost = Math.max(adminFee, targetBasePrice + adminFee - tradeInCredit);
    if (this.state.character.money < netCost) {
      throw new Error(`Uang tambah kurang (butuh Rp ${netCost.toLocaleString('id-ID')}).`);
    }

    const chosenColor = color && targetModel.colors.some((c) => c.toUpperCase() === color.toUpperCase())
      ? color.toUpperCase()
      : targetModel.colors[0];
    const newId = `veh_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
    const plateNumber = this.generateUniquePlateLocal();
    const spawn = this.getDealerParkingSpawn(dealerId);

    const newVehicle: VehicleDoc = {
      id: newId,
      ownerId: this.state.character.uid,
      ownerName: this.state.character.name,
      modelId: targetModel.id,
      category: targetModel.category,
      name: targetModel.name,
      plateNumber,
      color: chosenColor,
      condition: dealer.isUsed ? 80 : 100,
      odometerKm: dealer.isUsed ? 110 : 0,
      fuel: targetModel.tankCapacity,
      fuelCapacity: targetModel.tankCapacity,
      isElectric: Boolean(targetModel.isElectric),
      registeredAtMs: nowMs,
      stnkExpiresAtMs: nowMs + vehiclesJson.stnkPeriodMs,
      taxLastPaidAtMs: nowMs,
      lastMaintenanceAtMs: nowMs,
      lastWearAtMs: nowMs,
      leaseId: null,
      garagePropertyId: null,
      parkedPos: { ...spawn, zone: 'cicalengka' },
      parkedType: 'dealer',
      status: 'parked',
      driverId: null,
      passengerIds: [],
      isPublicActive: false,
      accessories: [],
      purchasePrice: targetBasePrice,
      isUsed: dealer.isUsed,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    const nextMoney = this.state.character.money - netCost;
    this.state.vehicles = [newVehicle, ...this.state.vehicles.filter((v) => v.id !== tradeInVehicleId)];
    this.state.character = { ...this.state.character, money: nextMoney, updatedAt: nowMs };
    this.addTreasuryTax(adminFee, 'vehicle');
    this.addTx('expense', 'tukar_tambah', netCost, nextMoney, `Tukar tambah ${oldV.name} -> ${targetModel.name}`);
    this.emit();
    return { ok: true, newVehicle, tradeInCredit, netCost, money: nextMoney };
  }

  listVehicleForSale(payload: {
    action?: 'create' | 'cancel';
    vehicleId?: string;
    listingId?: string;
    price?: number;
    businessId?: string;
  }) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const nowMs = Date.now();
    if (payload.action === 'cancel') {
      const idx = this.state.vehicleListings.findIndex((l) => l.id === payload.listingId);
      if (idx < 0) throw new Error('Listing tidak ditemukan.');
      const ld = this.state.vehicleListings[idx];
      this.state.vehicleListings[idx] = { ...ld, status: 'cancelled', updatedAtMs: nowMs };
      this.state.vehicles = this.state.vehicles.map((v) =>
        v.id === ld.vehicleId ? { ...v, status: 'parked', activeListingId: null, updatedAtMs: nowMs } : v
      );
      this.emit();
      return { ok: true, listingId: ld.id };
    }

    const vIdx = this.state.vehicles.findIndex((v) => v.id === payload.vehicleId);
    if (vIdx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[vIdx];
    if (v.status !== 'parked' || v.leaseId) throw new Error('Kendaraan harus terparkir & bebas leasing.');
    const askPrice = Math.round(Number(payload.price || 0));
    const market = computeVehicleMarketValueClient(v, nowMs);
    const minP = Math.round(market * dealerJson.marketplace.minPriceRatio);
    const maxP = Math.round(market * dealerJson.marketplace.maxPriceRatio);
    if (askPrice < minP || askPrice > maxP) {
      throw new Error(`Harga harus di kisaran Rp ${minP.toLocaleString('id-ID')} - Rp ${maxP.toLocaleString('id-ID')}.`);
    }
    const fee = dealerJson.marketplace.listingFee;
    if (this.state.character.money < fee) throw new Error('Saldo tidak cukup untuk biaya pasang iklan.');

    const nextMoney = this.state.character.money - fee;
    const listingId = `vlist_${nowMs}`;
    const listing: VehicleListingDoc = {
      id: listingId,
      vehicleId: v.id,
      ownerId: this.state.character.uid,
      ownerName: this.state.character.name,
      sellerBusinessId: payload.businessId || null,
      modelId: v.modelId,
      vehicleName: v.name,
      category: v.category,
      plateNumber: v.plateNumber,
      color: v.color,
      condition: v.condition,
      odometerKm: v.odometerKm,
      price: askPrice,
      status: 'active',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    this.state.vehicleListings = [listing, ...this.state.vehicleListings];
    this.state.vehicles[vIdx] = { ...v, status: 'listed', activeListingId: listingId, updatedAtMs: nowMs };
    this.state.character = { ...this.state.character, money: nextMoney, updatedAt: nowMs };
    this.addTx('expense', 'listing_kendaraan', fee, nextMoney, `Pasang listing ${v.name}`);
    this.emit();
    return { ok: true, listing, money: nextMoney };
  }

  transferVehicle(listingId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const lIdx = this.state.vehicleListings.findIndex((l) => l.id === listingId && l.status === 'active');
    if (lIdx < 0) throw new Error('Listing kendaraan tidak aktif atau tidak ditemukan.');
    const ld = this.state.vehicleListings[lIdx];
    if (ld.ownerId === this.state.character.uid) throw new Error('Tidak bisa membeli listing milik sendiri.');

    const nowMs = Date.now();
    const transferTax = Math.round(ld.price * dealerJson.marketplace.titleTransferTaxRate);
    const total = ld.price + transferTax;
    if (this.state.character.money < total) {
      throw new Error(`Uang kurang (butuh Rp ${total.toLocaleString('id-ID')}).`);
    }

    const nextMoney = this.state.character.money - total;
    const model = getVehicleModelById(ld.modelId);
    const spawn = this.getDealerParkingSpawn('alun_alun');
    const newVeh: VehicleDoc = {
      id: ld.vehicleId,
      ownerId: this.state.character.uid,
      ownerName: this.state.character.name,
      modelId: ld.modelId,
      category: ld.category,
      name: ld.vehicleName,
      plateNumber: ld.plateNumber,
      color: ld.color,
      condition: ld.condition,
      odometerKm: ld.odometerKm,
      fuel: model?.tankCapacity ?? 5,
      fuelCapacity: model?.tankCapacity ?? 5,
      isElectric: Boolean(model?.isElectric),
      registeredAtMs: nowMs,
      stnkExpiresAtMs: nowMs + vehiclesJson.stnkPeriodMs,
      taxLastPaidAtMs: nowMs,
      parkedPos: { ...spawn, zone: 'cicalengka' },
      parkedType: 'parking_lot',
      status: 'parked',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    this.state.vehicles = [newVeh, ...this.state.vehicles.filter((v) => v.id !== ld.vehicleId)];
    this.state.vehicleListings[lIdx] = { ...ld, status: 'sold', updatedAtMs: nowMs };
    const escrowFee = Math.round(ld.price * dealerJson.marketplace.escrowFeeRate);
    const sellerNet = Math.max(0, ld.price - escrowFee);
    if (ld.sellerBusinessId) {
      const bIdx = this.state.businesses.findIndex((b) => b.id === ld.sellerBusinessId && b.status === 'active');
      if (bIdx >= 0) {
        const curBiz = this.state.businesses[bIdx];
        this.state.businesses[bIdx] = {
          ...curBiz,
          cash: curBiz.cash + sellerNet,
          totalRevenue: (curBiz.totalRevenue || 0) + sellerNet,
          updatedAtMs: nowMs,
        };
      }
    }
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      ownedVehicleCount: this.state.vehicles.length,
      updatedAt: nowMs,
    };
    this.addTreasuryTax(transferTax + escrowFee, 'vehicle');
    this.addTx('expense', 'beli_kendaraan', total, nextMoney, `Beli & balik nama ${ld.vehicleName}`);
    this.emit();
    return { ok: true, vehicleId: ld.vehicleId, price: ld.price, transferTax, sellerNet, money: nextMoney };
  }

  testDriveStart(payload: { action?: 'start' | 'end'; dealerId?: string; modelId?: string; color?: string }) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const nowMs = Date.now();
    const tdVehicleId = `td_${this.state.character.uid}`;
    if (payload.action === 'end') {
      this.state.vehicleTestDrive = this.state.vehicleTestDrive
        ? { ...this.state.vehicleTestDrive, status: 'ended' }
        : null;
      this.state.character = { ...this.state.character, drivingVehicleId: null };
      this.emit();
      return { ok: true, ended: true };
    }
    const dealer = dealerJson.dealers.find((d) => d.id === payload.dealerId);
    const model = payload.modelId ? getVehicleModelById(payload.modelId) : null;
    if (!dealer || !model || !model.sellable || !dealer.modelIds.includes(model.id)) {
      throw new Error('Dealer atau model uji coba tidak valid.');
    }
    const chosenColor = payload.color || model.colors[0];
    const expiresAtMs = nowMs + dealerJson.testDrive.durationSec * 1000;
    const spawn = this.getDealerParkingSpawn(dealer.id);
    this.state.vehicleTestDrive = {
      uid: this.state.character.uid,
      dealerId: dealer.id,
      modelId: model.id,
      color: chosenColor,
      startedAtMs: nowMs,
      expiresAtMs,
      zone: 'cicalengka',
      status: 'active',
    };
    this.state.character = { ...this.state.character, drivingVehicleId: tdVehicleId };
    this.emit();
    return {
      ok: true,
      vehicleId: tdVehicleId,
      modelId: model.id,
      color: chosenColor,
      expiresAtMs,
      spawnPos: spawn,
    };
  }

  registerVehicle(vehicleId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.vehicles.findIndex((v) => v.id === vehicleId);
    if (idx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const fee = vehiclesJson.stnkAdminFee;
    if (this.state.character.money < fee) throw new Error('Uang tidak cukup.');
    const nowMs = Date.now();
    const plateNumber = this.generateUniquePlateLocal();
    const nextMoney = this.state.character.money - fee;

    this.state.vehicles[idx] = {
      ...this.state.vehicles[idx],
      plateNumber,
      registeredAtMs: nowMs,
      stnkExpiresAtMs: nowMs + vehiclesJson.stnkPeriodMs,
      updatedAtMs: nowMs,
    };
    this.state.character = { ...this.state.character, money: nextMoney, updatedAt: nowMs };
    this.addTreasuryTax(fee, 'vehicle');
    this.addTx('expense', 'samsat', fee, nextMoney, `Registrasi ulang plat ${plateNumber}`);
    this.emit();
    return { ok: true, plateNumber, money: nextMoney };
  }

  renewRegistration(vehicleId: string) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.vehicles.findIndex((v) => v.id === vehicleId);
    if (idx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[idx];
    const nowMs = Date.now();
    const stnk = computeLazyStnkStatusClient(v, nowMs);
    if (this.state.character.money < stnk.totalDue) {
      throw new Error(`Uang kurang untuk bayar pajak STNK (Rp ${stnk.totalDue.toLocaleString('id-ID')}).`);
    }
    const nextMoney = this.state.character.money - stnk.totalDue;
    const nextExp = Math.max(nowMs, v.stnkExpiresAtMs) + vehiclesJson.stnkPeriodMs;
    this.state.vehicles[idx] = {
      ...v,
      stnkExpiresAtMs: nextExp,
      taxLastPaidAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    this.state.bills = this.state.bills.map((b) =>
      b.billType === 'vehicle_tax' && b.vehicleId === vehicleId && b.status === 'unpaid'
        ? { ...b, status: 'paid', paidAtMs: nowMs }
        : b
    );
    this.state.character = { ...this.state.character, money: nextMoney, updatedAt: nowMs };
    this.addTreasuryTax(stnk.totalDue, 'vehicle');
    this.addTx('expense', 'pajak_kendaraan', stnk.totalDue, nextMoney, `Perpanjang STNK ${v.plateNumber}`);
    this.emit();
    return { ok: true, stnkExpiresAtMs: nextExp, totalDue: stnk.totalDue, money: nextMoney };
  }

  takeLicenseExam(category: 'C' | 'A', answers: number[]) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const cfg = category === 'A' ? vehiclesJson.licenseSettings.simA : vehiclesJson.licenseSettings.simC;
    if (this.state.character.money < cfg.fee) {
      throw new Error(`Biaya ujian SIM ${category} Rp ${cfg.fee.toLocaleString('id-ID')}.`);
    }
    const keyC = [1, 0, 2, 1, 0];
    const keyA = [2, 1, 0, 2, 1];
    const key = category === 'A' ? keyA : keyC;
    let correct = 0;
    for (let i = 0; i < key.length; i++) {
      if (answers[i] === key[i]) correct++;
    }
    const score = Math.round((correct / key.length) * 100);
    const passed = score >= cfg.passScore;
    const nowMs = Date.now();
    const nextMoney = this.state.character.money - cfg.fee;

    const prevLic: DriverLicenseDoc = this.state.driverLicense || {
      uid: this.state.character.uid,
      simA: null,
      simC: null,
      updatedAtMs: nowMs,
    };
    const slotKey = category === 'A' ? 'simA' : 'simC';
    const prevEntry = prevLic[slotKey];
    const entry = {
      active: passed,
      licenseNumber: passed ? prevEntry?.licenseNumber || `SIM${category}-CLG-${String(nowMs).slice(-6)}` : prevEntry?.licenseNumber || '',
      issuedAtMs: nowMs,
      expiresAtMs: passed ? nowMs + cfg.validMs : 0,
      lastExamScore: score,
      attempts: (prevEntry?.attempts || 0) + 1,
    };
    this.state.driverLicense = {
      ...prevLic,
      [slotKey]: entry,
      updatedAtMs: nowMs,
    };
    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      ...(passed ? { [slotKey]: { active: true, issuedAtMs: nowMs, expiresAtMs: entry.expiresAtMs } } : {}),
      updatedAt: nowMs,
    };
    this.addTreasuryTax(cfg.fee, 'vehicle');
    this.addTx('expense', 'ujian_sim', cfg.fee, nextMoney, `Ujian SIM ${category} (${passed ? 'LULUS' : 'GAGAL'} - ${score}%)`);
    this.emit();
    return { ok: true, passed, score, license: entry, money: nextMoney };
  }

  mountVehicle(vehicleId: string, asPassenger = false) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.vehicles.findIndex((v) => v.id === vehicleId);
    if (idx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[idx];
    const model = getVehicleModelById(v.modelId);
    if (!model) throw new Error('Model kendaraan tidak dikenal.');
    if (v.status === 'impounded' || v.status === 'listed' || v.status === 'auctioning' || v.status === 'stolen') {
      throw new Error(`Kendaraan berstatus ${v.status} tidak bisa dinaiki.`);
    }
    const nowMs = Date.now();
    let seatIndex = 0;
    if (!asPassenger) {
      if (v.fuel <= 0) throw new Error('Bahan bakar / baterai habis!');
      if (v.condition <= 5) throw new Error('Mesin mogok berat! Bawa ke bengkel terlebih dahulu.');
      this.state.vehicles[idx] = {
        ...v,
        status: 'driving',
        driverId: this.state.character.uid,
        passengerIds: [],
        isPublicActive: true,
        updatedAtMs: nowMs,
      };
      this.state.character = { ...this.state.character, drivingVehicleId: vehicleId, passengerVehicleId: null };
    } else {
      if (model.seats <= 1) throw new Error('Kendaraan ini tidak memiliki kursi penumpang.');
      const existingPass = v.passengerIds || [];
      if (!existingPass.includes(this.state.character.uid) && existingPass.length + 1 >= model.seats) {
        throw new Error('Kursi penumpang sudah penuh.');
      }
      const passengers = Array.from(new Set([...existingPass, this.state.character.uid]));
      seatIndex = Math.max(1, passengers.indexOf(this.state.character.uid) + 1);
      this.state.vehicles[idx] = { ...v, passengerIds: passengers, updatedAtMs: nowMs };
      this.state.character = { ...this.state.character, passengerVehicleId: vehicleId };
    }
    this.emit();
    return { ok: true, vehicleId, asPassenger, maxSpeedMps: model.maxSpeedMps, seatIndex };
  }

  parkVehicle(payload: {
    vehicleId: string;
    x: number;
    y: number;
    z: number;
    rotY?: number;
    parkedType?: VehicleParkedType;
    garagePropertyId?: string | null;
    distanceKm?: number;
    terrainType?: 'road' | 'offroad';
    crashDamage?: number;
  }) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.vehicles.findIndex((v) => v.id === payload.vehicleId);
    if (idx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[idx];
    const model = getVehicleModelById(v.modelId);
    const nowMs = Date.now();
    const wear = model
      ? this.applyWearLocal(
          model,
          v,
          payload.distanceKm ?? 0,
          payload.terrainType ?? 'road',
          payload.crashDamage ?? 0
        )
      : {
          nextFuel: v.fuel,
          nextCondition: Math.max(5, v.condition - (payload.crashDamage ?? 0)),
          nextOdometerKm: v.odometerKm,
        };
    const safePos = { x: payload.x, y: payload.y, z: payload.z, rotY: payload.rotY ?? 0, zone: 'cicalengka' as ZoneId };
    const pType: VehicleParkedType = payload.parkedType || 'roadside';

    this.state.vehicles[idx] = {
      ...v,
      status: 'parked',
      driverId: null,
      passengerIds: [],
      isPublicActive: false,
      parkedPos: safePos,
      parkedType: pType,
      garagePropertyId: pType === 'garage' ? payload.garagePropertyId || null : null,
      fuel: wear.nextFuel,
      condition: wear.nextCondition,
      odometerKm: wear.nextOdometerKm,
      lastWearAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    this.state.character = {
      ...this.state.character,
      drivingVehicleId: null,
      passengerVehicleId: null,
      lastPosition: { x: safePos.x, y: safePos.y, z: safePos.z, rotY: safePos.rotY },
    };
    this.emit();
    return { ok: true, ...wear, parkedPos: safePos, parkedType: pType };
  }

  dismountVehicle(payload: {
    vehicleId: string;
    x?: number;
    y?: number;
    z?: number;
    rotY?: number;
    distanceKm?: number;
    terrainType?: 'road' | 'offroad';
    crashDamage?: number;
  }) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    if (payload.vehicleId === `td_${this.state.character.uid}`) {
      this.state.vehicleTestDrive = this.state.vehicleTestDrive
        ? { ...this.state.vehicleTestDrive, status: 'ended' }
        : null;
      this.state.character = { ...this.state.character, drivingVehicleId: null };
      this.emit();
      return { ok: true, isTestDrive: true };
    }
    const v = this.state.vehicles.find((item) => item.id === payload.vehicleId);
    if (v && v.driverId === this.state.character.uid) {
      this.parkVehicle({
        vehicleId: payload.vehicleId,
        x: payload.x ?? v.parkedPos.x,
        y: payload.y ?? v.parkedPos.y,
        z: payload.z ?? v.parkedPos.z,
        rotY: payload.rotY ?? v.parkedPos.rotY,
        parkedType: 'roadside',
        distanceKm: payload.distanceKm ?? 0,
        terrainType: payload.terrainType ?? 'road',
        crashDamage: payload.crashDamage ?? 0,
      });
      return { ok: true, isDriver: true };
    }
    this.state.character = { ...this.state.character, passengerVehicleId: null };
    this.emit();
    return { ok: true, isDriver: false };
  }

  retrieveVehicle(vehicleId: string, spotId = 'alun_alun') {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.vehicles.findIndex((v) => v.id === vehicleId);
    if (idx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[idx];
    const nowMs = Date.now();
    let fee = 5000;
    if (v.status === 'impounded') {
      const days = Math.max(0, Math.floor((nowMs - (v.impoundedAtMs || nowMs)) / 86_400_000));
      fee = (v.impoundFine || vehiclesJson.impoundRecoveryBaseFee) + days * vehiclesJson.impoundDailyStorageFee;
    } else if (v.status === 'stolen') {
      fee = Math.round(vehiclesJson.impoundRecoveryBaseFee * 0.6);
    }
    if (this.state.character.money < fee) {
      throw new Error(`Saldo kurang untuk biaya derek/tebus Rp ${fee.toLocaleString('id-ID')}.`);
    }
    const spot = this.getDealerParkingSpawn(spotId);
    const nextMoney = this.state.character.money - fee;
    this.state.vehicles[idx] = {
      ...v,
      status: 'parked',
      parkedType: 'parking_lot',
      parkedPos: { ...spot, zone: 'cicalengka' },
      impoundReason: null,
      impoundedAtMs: null,
      impoundFine: 0,
      updatedAtMs: nowMs,
    };
    this.state.character = { ...this.state.character, money: nextMoney, updatedAt: nowMs };
    this.addTreasuryTax(fee, 'vehicle');
    this.addTx('expense', 'derek_kendaraan', fee, nextMoney, `Tebus / Derek ${v.name}`);
    this.emit();
    return { ok: true, fee, money: nextMoney, parkedPos: spot };
  }

  refuelVehicle(vehicleId: string, amount?: number) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.vehicles.findIndex((v) => v.id === vehicleId);
    if (idx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[idx];
    const model = getVehicleModelById(v.modelId);
    if (!model) throw new Error('Model kendaraan tidak valid.');

    const needed = Math.max(0, model.tankCapacity - v.fuel);
    if (needed <= 0.05) throw new Error(model.isElectric ? 'Baterai sudah penuh.' : 'Tangki sudah penuh.');
    const reqUnits = amount && amount > 0 ? Math.min(needed, amount) : needed;
    const unitPrice = model.isElectric
      ? vehiclesJson.fuelPrices.electricPerPercent
      : vehiclesJson.fuelPrices.bensinPerUnit;
    const cost = Math.max(500, Math.round((reqUnits * unitPrice) / 100) * 100);
    if (this.state.character.money < cost) {
      throw new Error(`Uang kurang (butuh Rp ${cost.toLocaleString('id-ID')}).`);
    }
    const nowMs = Date.now();
    const nextFuel = Math.min(model.tankCapacity, Math.round((v.fuel + reqUnits) * 100) / 100);
    const nextMoney = this.state.character.money - cost;
    this.state.vehicles[idx] = { ...v, fuel: nextFuel, updatedAtMs: nowMs };
    this.state.character = { ...this.state.character, money: nextMoney, updatedAt: nowMs };
    this.state.vehicleServiceLogs = [
      {
        id: `srv_${nowMs}`,
        vehicleId,
        ownerId: this.state.character.uid,
        serviceType: model.isElectric ? ('charge' as const) : ('refuel' as const),
        providerType: 'spbu' as const,
        cost,
        details: model.isElectric ? `Isi daya +${Math.round(reqUnits)}%` : `Isi BBM +${reqUnits.toFixed(1)}L`,
        createdAtMs: nowMs,
      },
      ...this.state.vehicleServiceLogs,
    ].slice(0, 30);
    this.addTx('expense', 'spbu', cost, nextMoney, `${model.isElectric ? 'Cas EV' : 'Isi Bensin'} ${v.name}`);
    this.emit();
    return { ok: true, fuel: nextFuel, cost, money: nextMoney };
  }

  serviceVehicle(payload: {
    vehicleId: string;
    serviceType: 'repair' | 'oil_change' | 'paint' | 'accessory';
    color?: string;
    accessoryId?: string;
    businessId?: string;
  }) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const idx = this.state.vehicles.findIndex((v) => v.id === payload.vehicleId);
    if (idx < 0) throw new Error('Kendaraan tidak ditemukan.');
    const v = this.state.vehicles[idx];
    const model = getVehicleModelById(v.modelId);
    if (!model) throw new Error('Model tidak valid.');

    const nowMs = Date.now();
    const condBefore = v.condition;
    let condAfter = condBefore;
    let cost = 0;
    let details = '';
    const patch: Partial<VehicleDoc> = { updatedAtMs: nowMs };

    if (payload.serviceType === 'repair') {
      const missing = Math.max(0, 100 - condBefore);
      if (missing <= 1) throw new Error('Kondisi kendaraan sudah prima.');
      cost = Math.max(
        model.serviceCostBase,
        Math.round((missing * vehiclesJson.maintenanceSettings.repairPerConditionPoint) / 500) * 500
      );
      condAfter = 100;
      patch.condition = 100;
      patch.lastMaintenanceAtMs = nowMs;
      details = 'Perbaikan penuh mesin & bodi';
    } else if (payload.serviceType === 'oil_change') {
      cost = Math.max(vehiclesJson.maintenanceSettings.oilChangeCostBase, Math.round(model.serviceCostBase * 0.7));
      condAfter = Math.min(100, condBefore + 18);
      patch.condition = condAfter;
      patch.lastMaintenanceAtMs = nowMs;
      details = 'Ganti oli & tune up ringan';
    } else if (payload.serviceType === 'paint') {
      if (!payload.color) throw new Error('Pilih warna cat.');
      cost = vehiclesJson.maintenanceSettings.repaintCost;
      patch.color = payload.color.toUpperCase();
      details = `Cat ulang ${patch.color}`;
    } else if (payload.serviceType === 'accessory') {
      const acc = vehiclesJson.accessories.find((a) => a.id === payload.accessoryId);
      if (!acc || (acc.category !== 'all' && acc.category !== model.category)) {
        throw new Error('Aksesori tidak cocok untuk kendaraan ini.');
      }
      const existing = [...(v.accessories || [])];
      if (existing.includes(acc.id)) throw new Error(`${acc.label} sudah terpasang.`);
      existing.push(acc.id);
      cost = acc.cost;
      patch.accessories = existing;
      details = `Pasang aksesori ${acc.label}`;
    }

    if (this.state.character.money < cost) {
      throw new Error(`Uang kurang (butuh Rp ${cost.toLocaleString('id-ID')}).`);
    }

    const nextMoney = this.state.character.money - cost;
    this.state.vehicles[idx] = { ...v, ...patch };
    this.state.character = { ...this.state.character, money: nextMoney, updatedAt: nowMs };
    let usingPlayerWorkshop = false;
    if (payload.businessId) {
      const bIdx = this.state.businesses.findIndex(
        (b) => b.id === payload.businessId && b.status === 'active' && b.type === 'bengkel'
      );
      if (bIdx >= 0) {
        usingPlayerWorkshop = true;
        const tax = Math.round(cost * 0.05);
        const net = cost - tax;
        const curBiz = this.state.businesses[bIdx];
        this.state.businesses[bIdx] = {
          ...curBiz,
          cash: curBiz.cash + net,
          totalRevenue: (curBiz.totalRevenue || 0) + net,
          updatedAtMs: nowMs,
        };
        this.addTreasuryTax(tax, 'business');
      }
    }
    this.state.vehicleServiceLogs = [
      {
        id: `srv_${nowMs}`,
        vehicleId: v.id,
        ownerId: this.state.character.uid,
        serviceType: payload.serviceType,
        providerType: usingPlayerWorkshop ? ('player_business' as const) : ('npc' as const),
        businessId: usingPlayerWorkshop ? payload.businessId || null : null,
        cost,
        conditionBefore: condBefore,
        conditionAfter: condAfter,
        details,
        createdAtMs: nowMs,
      },
      ...this.state.vehicleServiceLogs,
    ].slice(0, 30);
    this.addTx('expense', 'bengkel', cost, nextMoney, `${details} (${v.name})`);
    this.emit();
    return { ok: true, cost, condition: condAfter, details, money: nextMoney, updates: patch };
  }

  reportPedestrianCollision(payload: {
    targetName?: string;
    targetType?: 'npc' | 'player';
    x?: number;
    z?: number;
    zone?: string;
  }) {
    if (!this.state.character) throw new Error('Karakter belum ada.');
    const nowMs = Date.now();
    const fineAmount = Number((trafficJson.trafficOffenseFines as Record<string, number>).pedestrianCollision ?? 35000);
    const wallet = this.state.character.money;
    const finePaid = Math.min(wallet, fineAmount);
    const remainingFine = Math.max(0, fineAmount - finePaid);
    const nextMoney = wallet - finePaid;
    const nextWanted = Math.min(100, (this.state.character.wantedLevel || 0) + 10);
    const targetName = payload.targetName || 'Warga';

    const rec: CrimeRecordDoc = {
      id: `crm_traf_${nowMs}`,
      characterId: this.state.character.uid,
      characterName: this.state.character.name,
      offenseId: 'tabrak_pejalan',
      offenseTitle: `Menyenggol Pejalan Kaki (${targetName})`,
      severity: 2,
      atMs: nowMs,
      location: { zone: (payload.zone as ZoneId) || 'cicalengka', x: payload.x ?? 0, z: payload.z ?? -20 },
      targetType: payload.targetType === 'player' ? 'player' : 'npc',
      targetId: targetName,
      witnesses: [targetName],
      status: remainingFine > 0 ? 'wanted' : 'paid',
      fine: fineAmount,
      sentenceSec: 420,
      evidenceScore: 85,
    };

    this.state.crimeRecords = [rec, ...this.state.crimeRecords];
    if (remainingFine > 0) {
      this.state.bills = [
        {
          id: `fine_ped_${nowMs}`,
          uid: this.state.character.uid,
          billType: 'traffic_fine' as BillDoc['billType'],
          title: `Denda Lalu Lintas (${targetName})`,
          periodIndex: 1,
          baseAmount: remainingFine,
          lateFee: 0,
          totalDue: remainingFine,
          status: 'unpaid',
          dueAtMs: nowMs + 72_000_000,
        },
        ...this.state.bills,
      ];
    }

    this.state.character = {
      ...this.state.character,
      money: nextMoney,
      wantedLevel: nextWanted,
      wantedUpdatedAtMs: nowMs,
      criminalRecordCount: (this.state.character.criminalRecordCount || 0) + 1,
      reputation: Math.max(0, (this.state.character.reputation ?? 50) - 6),
      creditScore: Math.max(0, (this.state.character.creditScore ?? 65) - 3),
    };
    if (finePaid > 0) {
      this.addTreasuryTax(finePaid, 'vehicle');
      this.addTx('penalty', 'tilang_lalu_lintas', finePaid, nextMoney, `Denda menyenggol pejalan kaki (${targetName})`);
    }
    this.emit();
    return { ok: true, skipped: false, fineAmount, finePaid, remainingFine, money: nextMoney, wantedLevel: nextWanted };
  }
}

export const localSimulation = new LocalSimulationEngine();
