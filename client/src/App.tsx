import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import * as THREE from 'three';
import { MobileControls, type PlayerInputState } from './components/MobileControls';
import {
  callBatheAtHome,
  callDismountVehicle,
  callGetBills,
  callLeaveProperty,
  callMountVehicle,
  callParkVehicle,
  callPlaceFurniture,
  callReportPedestrianCollision,
  callRest,
  callSleepAtHome,
  callStartShift,
  callSyncPlayerState,
  callTakeBath,
  callTestDriveStart,
  syncUserProfile,
} from './firebase/api';
import { auth, db, handleFirestoreError, OperationType } from './firebase/config';
import { computeClientLazyStats, getGameClockInfo } from './firebase/gameTime';
import { localSimulation, type LocalSimulationState } from './firebase/localSimulation';
import {
  getDefaultPhase2Config,
  loadPhase2ConfigCached,
  type Phase2BundleConfig,
} from './firebase/phase2ConfigCache';
import {
  getDefaultMarketStats,
  getDefaultPhase4Config,
  getDefaultTreasuryState,
  loadPhase4ConfigCached,
  type Phase4BundleConfig,
} from './firebase/phase4ConfigCache';
import {
  computeLazyWantedClient,
  getDefaultLandPlots,
  getDefaultPhase6Config,
  loadPhase6ConfigCached,
  type Phase6BundleConfig,
} from './firebase/phase6ConfigCache';
import {
  getDefaultVehicleConfig,
  getVehicleModelById,
  loadVehicleConfigCached,
} from './firebase/vehicleConfigCache';
import { computeVehicleNotifications } from './firebase/vehicleNotifications';
import type {
  AgentClientRequestDoc,
  AuctionDoc,
  BankAccountDoc,
  BillDoc,
  BusinessDailyReportDoc,
  BusinessDoc,
  BusinessEmployeeDoc,
  BusinessJobPostDoc,
  BusinessStockDoc,
  CharacterDoc,
  CharacterStatsDoc,
  ConstructionDoc,
  CrimeRecordDoc,
  DevelopmentProjectDoc,
  DriverLicenseDoc,
  FurniturePlacement,
  GameConfigDoc,
  GraphicsQuality,
  InsuranceClaimDoc,
  InsurancePolicyDoc,
  InventoryItemDoc,
  LandPlotDoc,
  LeaseDoc,
  LoanDoc,
  MarketStatDoc,
  MortgageDoc,
  OfferDoc,
  PlayerQuestLogDoc,
  PoliceActionDoc,
  PropertyDoc,
  PropertyListingDoc,
  QuestTemplateDoc,
  RenovationDoc,
  RTDBVehicle,
  SecurityInstallDoc,
  SentenceDoc,
  TransactionDoc,
  TreasuryStateDoc,
  VehicleDoc,
  VehicleLeaseDoc,
  VehicleListingDoc,
  VehicleTestDriveDoc,
  ZoneId,
} from './types/game';
import { ActionButton } from './ui/ActionButton';
import { AgentDeveloperModal } from './ui/AgentDeveloperModal';
import { AuctionModal } from './ui/AuctionModal';
import { AuthScreen } from './ui/AuthScreen';
import { BankModal } from './ui/BankModal';
import { BusinessModal } from './ui/BusinessModal';
import { BusinessShopModal } from './ui/BusinessShopModal';
import { CharacterCreator } from './ui/CharacterCreator';
import { ChatBox } from './ui/ChatBox';
import { ClinicModal } from './ui/ClinicModal';
import { CourseModal } from './ui/CourseModal';
import { DecorationDockHUD } from './ui/DecorationDockHUD';
import { DestinationGuideCard } from './ui/DestinationGuideCard';
import { DrivingMiniHud } from './ui/DrivingMiniHud';
import { DroneHUD, type DronePreset } from './ui/DroneHUD';
import { EconomyMonitorModal } from './ui/EconomyMonitorModal';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { FurnitureShopModal } from './ui/FurnitureShopModal';
import { GameHUD } from './ui/GameHUD';
import { HomelessSleepModal } from './ui/HomelessSleepModal';
import { HouseSearchModal } from './ui/HouseSearchModal';
import { JobMiniGameModal } from './ui/JobMiniGameModal';
import { JobsModal } from './ui/JobsModal';
import { LandConstructionModal } from './ui/LandConstructionModal';
import { LawJusticeModal } from './ui/LawJusticeModal';
import { LoadingScreen } from './ui/LoadingScreen';
import { MarketplaceModal } from './ui/MarketplaceModal';
import { MortgageSecurityModal } from './ui/MortgageSecurityModal';
import { MyPropertyModal } from './ui/MyPropertyModal';
import { NavigationMinimap } from './ui/NavigationMinimap';
import { NpcDialogModal } from './ui/NpcDialogModal';
import { OffersModal } from './ui/OffersModal';
import { PoliceModal } from './ui/PoliceModal';
import { ProfileFinanceModal } from './ui/ProfileFinanceModal';
import { PropertyDetailModal } from './ui/PropertyDetailModal';
import { QuestsModal } from './ui/QuestsModal';
import { SamsatSimModal } from './ui/SamsatSimModal';
import { SettingsModal, type WeatherSetting } from './ui/SettingsModal';
import { SpbuModal } from './ui/SpbuModal';
import { TrainModal } from './ui/TrainModal';
import { useViewportMode } from './ui/useViewportMode';
import { VehicleDealerModal } from './ui/VehicleDealerModal';
import { VehicleGarageModal } from './ui/VehicleGarageModal';
import { WarungModal } from './ui/WarungModal';
import { WholesaleMarketModal } from './ui/WholesaleMarketModal';
import { WorkshopModal } from './ui/WorkshopModal';
import type { WeatherKind } from './world3d/assets/WeatherEffects3D';
import type { CourierTarget } from './world3d/CourierMarkers3D';
import { canPlaceFurnitureAt } from './world3d/DecorationGrid3D';
import type { OffscreenTargetIndicator } from './world3d/DestinationGuide3D';
import {
  getNearestValidDestination,
  type InteractionDestination,
} from './world3d/interactions/registry';
import { useLocationGate } from './world3d/interactions/useLocationGate';
import type { NearbyInteractTarget } from './world3d/LocalPlayer';
import { findLotPlacement } from './world3d/layout/layoutHelpers';
import type {
  CameraOrbitState,
  DroneCameraState,
  DroneTelemetry,
} from './world3d/ThirdPersonCamera';
import { useMultiplayerSync } from './world3d/useMultiplayerSync';
import type { NearbyVehicleTarget } from './world3d/vehicles/ParkedVehicles3D';
import type { NearbyPassengerVehicleTarget } from './world3d/vehicles/RemoteVehicles3D';
import {
  clearLocalLastDrivePos,
  loadLocalLastDrivePos,
} from './world3d/vehicles/vehicleMultiplayer';
import type {
  ActiveDriveVehicle,
  ExitVehiclePayload,
  PedestrianCollisionInfo,
} from './world3d/vehicles/PlayerVehicleController';
import type { DrivingTelemetrySnapshot, TurnSignalMode } from './world3d/vehicles/vehiclePhysics';
import {
  ATM_LOCATIONS,
  BANK_POS,
  DEFAULT_GAME_CONFIG,
  distance2D,
  FURNITURE_CATALOG,
  INITIAL_LISTINGS_DATA,
  INITIAL_PROPERTIES_DATA,
  INTERACT_RADIUS_METERS,
  KANTOR_DESA_POS,
  PENAMPUNGAN_POS,
} from './world3d/worldConstants';

const GameCanvas = lazy(() => import('./world3d/GameCanvas'));

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return typeof val === 'number' ? val : Date.now();
}

const GameApp: React.FC = () => {
  const { isCompactHud, isMobileLandscape } = useViewportMode();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [charLoading, setCharLoading] = useState(true);
  const [fsCharacter, setFsCharacter] = useState<CharacterDoc | null>(null);
  const [fsStats, setFsStats] = useState<CharacterStatsDoc | null>(null);
  const [simState, setSimState] = useState<LocalSimulationState>(() => ({
    active: false,
    character: null,
    stats: null,
    transactions: [],
    bills: [],
    properties: [],
    listings: [],
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
  }));
  const [fsTransactions, setFsTransactions] = useState<TransactionDoc[]>([]);
  const [fsBills, setFsBills] = useState<BillDoc[]>([]);

  // Data Firestore Fase 3
  const [fsOwnedProps, setFsOwnedProps] = useState<PropertyDoc[]>([]);
  const [fsHomeProp, setFsHomeProp] = useState<PropertyDoc | null>(null);
  const [fsListings, setFsListings] = useState<PropertyListingDoc[]>([]);
  const [fsBuyerOffers, setFsBuyerOffers] = useState<OfferDoc[]>([]);
  const [fsOwnerOffers, setFsOwnerOffers] = useState<OfferDoc[]>([]);
  const [fsTenantLeases, setFsTenantLeases] = useState<LeaseDoc[]>([]);
  const [fsOwnerLeases, setFsOwnerLeases] = useState<LeaseDoc[]>([]);
  const [fsRoommateLeases, setFsRoommateLeases] = useState<LeaseDoc[]>([]);
  const [fsInviteLeases, setFsInviteLeases] = useState<LeaseDoc[]>([]);
  const [fsInventory, setFsInventory] = useState<InventoryItemDoc[]>([]);
  const [fsFoodItems, setFsFoodItems] = useState<InventoryItemDoc[]>([]);

  // Data Firestore Fase 4
  const [fsBankAccount, setFsBankAccount] = useState<BankAccountDoc | null>(null);
  const [fsLoans, setFsLoans] = useState<LoanDoc[]>([]);
  const [fsBusinesses, setFsBusinesses] = useState<BusinessDoc[]>([]);
  const [fsStockByBiz, setFsStockByBiz] = useState<Record<string, BusinessStockDoc[]>>({});
  const [fsEmployeesByBiz, setFsEmployeesByBiz] = useState<Record<string, BusinessEmployeeDoc[]>>({});
  const [fsReportsByBiz, setFsReportsByBiz] = useState<Record<string, BusinessDailyReportDoc[]>>({});
  const [fsBusinessJobPosts, setFsBusinessJobPosts] = useState<BusinessJobPostDoc[]>([]);
  const [fsAuctions, setFsAuctions] = useState<AuctionDoc[]>([]);
  const [fsMarketStats, setFsMarketStats] = useState<MarketStatDoc[]>(getDefaultMarketStats);
  const [fsTreasury, setFsTreasury] = useState<TreasuryStateDoc>(getDefaultTreasuryState);

  // Data Firestore Fase 6
  const [fsCrimeRecords, setFsCrimeRecords] = useState<CrimeRecordDoc[]>([]);
  const [fsPoliceCrimeRecords, setFsPoliceCrimeRecords] = useState<CrimeRecordDoc[]>([]);
  const [fsPoliceActions, setFsPoliceActions] = useState<PoliceActionDoc[]>([]);
  const [fsSentence, setFsSentence] = useState<SentenceDoc | null>(null);
  const [fsActiveSentences, setFsActiveSentences] = useState<SentenceDoc[]>([]);
  const [fsSecurityInstalls, setFsSecurityInstalls] = useState<SecurityInstallDoc[]>([]);
  const [fsInsurancePolicies, setFsInsurancePolicies] = useState<InsurancePolicyDoc[]>([]);
  const [fsInsuranceClaims, setFsInsuranceClaims] = useState<InsuranceClaimDoc[]>([]);
  const [fsQuestTemplates, setFsQuestTemplates] = useState<QuestTemplateDoc[]>([]);
  const [fsQuestLogs, setFsQuestLogs] = useState<PlayerQuestLogDoc[]>([]);
  const [fsMortgages, setFsMortgages] = useState<MortgageDoc[]>([]);
  const [fsLandPlots, setFsLandPlots] = useState<LandPlotDoc[]>([]);
  const [fsPublicConstructions, setFsPublicConstructions] = useState<ConstructionDoc[]>([]);
  const [fsOwnedConstructions, setFsOwnedConstructions] = useState<ConstructionDoc[]>([]);
  const [fsRenovations, setFsRenovations] = useState<RenovationDoc[]>([]);
  const [fsAgentClients, setFsAgentClients] = useState<AgentClientRequestDoc[]>([]);
  const [fsDevProjects, setFsDevProjects] = useState<DevelopmentProjectDoc[]>([]);
  const [fsVehicles, setFsVehicles] = useState<VehicleDoc[]>([]);
  const [fsVehicleTestDrive, setFsVehicleTestDrive] = useState<VehicleTestDriveDoc | null>(null);
  const [fsDriverLicense, setFsDriverLicense] = useState<DriverLicenseDoc | null>(null);
  const [fsVehicleLeases, setFsVehicleLeases] = useState<VehicleLeaseDoc[]>([]);
  const [fsVehicleListings, setFsVehicleListings] = useState<VehicleListingDoc[]>([]);

  const [gameConfig, setGameConfig] = useState<GameConfigDoc>(DEFAULT_GAME_CONFIG);
  const [phase2Config, setPhase2Config] = useState<Phase2BundleConfig>(getDefaultPhase2Config);
  const [phase4Config, setPhase4Config] = useState<Phase4BundleConfig>(getDefaultPhase4Config);
  const [phase6Config, setPhase6Config] = useState<Phase6BundleConfig>(getDefaultPhase6Config);
  const [localBubble, setLocalBubble] = useState<string | null>(null);

  const [worldReady, setWorldReady] = useState(false);
  const [quality, setQuality] = useState<GraphicsQuality>('medium');
  const [weatherMode, setWeatherMode] = useState<WeatherSetting>(() => {
    try {
      const saved = window.localStorage.getItem('cicalengka_weather_mode');
      if (saved === 'auto' || saved === 'cerah' || saved === 'gerimis' || saved === 'hujan_deras') {
        return saved;
      }
    } catch {
      // Abaikan kegagalan storage
    }
    return 'auto';
  });
  const handleChangeWeatherMode = useCallback((next: WeatherSetting) => {
    setWeatherMode(next);
    try {
      window.localStorage.setItem('cicalengka_weather_mode', next);
    } catch {
      // Abaikan kegagalan storage
    }
  }, []);
  const [nearbyTarget, setNearbyTarget] = useState<NearbyInteractTarget>(null);

  // Modals Fase 1 & 2
  const [warungOpen, setWarungOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [highlightJobId, setHighlightJobId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'bills' | 'tx'>('profile');
  const [clinicOpen, setClinicOpen] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainPreselectZone, setTrainPreselectZone] = useState<ZoneId | null>(null);
  const [offscreenIndicator, setOffscreenIndicator] = useState<OffscreenTargetIndicator | null>(null);

  // Modals Fase 3
  const [houseSearchOpen, setHouseSearchOpen] = useState(false);
  const [myPropertyOpen, setMyPropertyOpen] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);
  const [furnitureModal, setFurnitureModal] = useState<{ open: boolean; tab: 'shop' | 'inventory' }>({
    open: false,
    tab: 'shop',
  });
  const [detailPropertyId, setDetailPropertyId] = useState<string | null>(null);
  const [homelessSleepTarget, setHomelessSleepTarget] = useState<{
    mode: 'shelter' | 'emperan';
    spotId?: string;
    label: string;
  } | null>(null);

  // Modals & Session Fase 4
  const [bankModal, setBankModal] = useState<{ open: boolean; mode: 'bank' | 'atm' }>({
    open: false,
    mode: 'bank',
  });
  const [businessModal, setBusinessModal] = useState<{
    open: boolean;
    view: 'manage' | 'create' | 'craft';
    businessId: string | null;
  }>({ open: false, view: 'manage', businessId: null });
  const [shopBusinessId, setShopBusinessId] = useState<string | null>(null);
  const [wholesaleModal, setWholesaleModal] = useState<{ open: boolean; businessId: string | null }>({
    open: false,
    businessId: null,
  });
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [businessSession, setBusinessSession] = useState<BusinessDoc | null>(null);

  // Modals Fase 6
  const [lawOpen, setLawOpen] = useState(false);
  const [policeOpen, setPoliceOpen] = useState(false);
  const [npcDialogId, setNpcDialogId] = useState<string | null>(null);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [mortgageSecurityModal, setMortgageSecurityModal] = useState<{
    open: boolean;
    tab: 'mortgage' | 'security' | 'insurance';
  }>({ open: false, tab: 'mortgage' });
  const [landConstructionModal, setLandConstructionModal] = useState<{
    open: boolean;
    tab: 'land' | 'build' | 'active';
    plotId: string | null;
  }>({ open: false, tab: 'land', plotId: null });
  const [agentDeveloperModal, setAgentDeveloperModal] = useState<{
    open: boolean;
    tab: 'agent' | 'developer' | 'furniture_sets';
  }>({ open: false, tab: 'agent' });

  // Modals Sistem Kendaraan
  const [dealerModal, setDealerModal] = useState<{ open: boolean; dealerId: string | null }>({
    open: false,
    dealerId: null,
  });
  const [spbuOpen, setSpbuOpen] = useState(false);
  const [workshopModal, setWorkshopModal] = useState<{ open: boolean; businessId: string | null }>({
    open: false,
    businessId: null,
  });
  const [samsatSimOpen, setSamsatSimOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);

  const [visitedCourierIds, setVisitedCourierIds] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // State Interior & Mode Dekorasi (Bagian 7)
  const [interiorState, setInteriorState] = useState<{
    property: PropertyDoc;
    mode: 'resident' | 'preview';
  } | null>(null);
  const [decorationMode, setDecorationMode] = useState(false);
  const [draftFurniture, setDraftFurniture] = useState<FurniturePlacement[]>([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [pendingFurnitureId, setPendingFurnitureId] = useState<string | null>(null);
  const [pendingRotation, setPendingRotation] = useState<0 | 90 | 180 | 270>(0);
  const [hoverCell, setHoverCell] = useState<{ gx: number; gz: number } | null>(null);
  const [savingDecoration, setSavingDecoration] = useState(false);

  const inputRef = useRef<PlayerInputState>({
    moveX: 0,
    moveY: 0,
    camDeltaYaw: 0,
    camDeltaPitch: 0,
  });
  const cameraOrbitRef = useRef<CameraOrbitState>({
    yaw: 0,
    pitch: 0.42,
    distance: 8.5,
  });
  const droneControlRef = useRef<DroneCameraState>({
    targetX: 0,
    targetZ: 0,
    altitude: 38,
    yaw: 0.45,
    pitch: 0.72,
    autoOrbit: false,
    goalX: null,
    goalZ: null,
    goalAltitude: null,
    goalPitch: null,
    goalYaw: null,
  });
  const [droneMode, setDroneMode] = useState(false);
  const [droneAutoOrbit, setDroneAutoOrbit] = useState(false);
  const [dronePresetId, setDronePresetId] = useState<string | null>('overview');
  const [droneTelemetry, setDroneTelemetry] = useState<DroneTelemetry>({
    altitude: 38,
    x: 0,
    z: 0,
    pitchDeg: 41,
  });
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, -42));
  const vehicleHeadingRef = useRef<number>(0);
  const vehicleSpeedRef = useRef<number>(0);
  const [nearbyVehicle, setNearbyVehicle] = useState<NearbyVehicleTarget | null>(null);
  const [nearbyPassengerVehicle, setNearbyPassengerVehicle] =
    useState<NearbyPassengerVehicleTarget | null>(null);
  const [drivingTelemetry, setDrivingTelemetry] = useState<DrivingTelemetrySnapshot | null>(null);
  const [vehicleHornNonce, setVehicleHornNonce] = useState(0);
  const [vehicleDismountNonce, setVehicleDismountNonce] = useState(0);
  const [vehicleHeadlightsManual, setVehicleHeadlightsManual] = useState<boolean | null>(null);
  const [vehicleTurnSignal, setVehicleTurnSignal] = useState<TurnSignalMode>('off');
  const lastShiftIdRef = useRef<string | null>(null);
  const syncedUidRef = useRef<string | null>(null);
  const autoWokeSleepRef = useRef<number | null>(null);
  const lastFaintedCountRef = useRef<number | null>(null);
  const lastZoneRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!localBubble) return;
    const t = window.setTimeout(() => setLocalBubble(null), 6000);
    return () => window.clearTimeout(t);
  }, [localBubble]);

  // Subscribe ke engine simulasi lokal (jika Cloud Functions tidak terjangkau di preview)
  useEffect(() => {
    return localSimulation.subscribe(setSimState);
  }, []);

  // Pantau status autentikasi Firebase
  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 4000);

    const unsub = onAuthStateChanged(auth, (u) => {
      window.clearTimeout(fallbackTimer);
      setUser(u);
      setAuthReady(true);
      if (u) {
        void syncUserProfile(u).catch(() => {});
        void loadPhase2ConfigCached().then(setPhase2Config);
        void loadPhase4ConfigCached().then(setPhase4Config);
        void loadPhase6ConfigCached().then(setPhase6Config);
        void loadVehicleConfigCached();
      } else {
        localSimulation.reset();
        syncedUidRef.current = null;
        setFsCharacter(null);
        setFsStats(null);
        setFsTransactions([]);
        setFsBills([]);
        setFsOwnedProps([]);
        setFsHomeProp(null);
        setFsListings([]);
        setFsBuyerOffers([]);
        setFsOwnerOffers([]);
        setFsTenantLeases([]);
        setFsOwnerLeases([]);
        setFsRoommateLeases([]);
        setFsInviteLeases([]);
        setFsInventory([]);
        setFsFoodItems([]);
        setFsBankAccount(null);
        setFsLoans([]);
        setFsBusinesses([]);
        setFsStockByBiz({});
        setFsEmployeesByBiz({});
        setFsReportsByBiz({});
        setFsBusinessJobPosts([]);
        setFsAuctions([]);
        setFsMarketStats(getDefaultMarketStats());
        setFsTreasury(getDefaultTreasuryState());
        setFsCrimeRecords([]);
        setFsPoliceCrimeRecords([]);
        setFsPoliceActions([]);
        setFsSentence(null);
        setFsActiveSentences([]);
        setFsSecurityInstalls([]);
        setFsInsurancePolicies([]);
        setFsInsuranceClaims([]);
        setFsQuestTemplates([]);
        setFsQuestLogs([]);
        setFsMortgages([]);
        setFsLandPlots([]);
        setFsPublicConstructions([]);
        setFsOwnedConstructions([]);
        setFsRenovations([]);
        setFsAgentClients([]);
        setFsDevProjects([]);
        setFsVehicles([]);
        setFsVehicleTestDrive(null);
        setFsDriverLicense(null);
        setFsVehicleLeases([]);
        setFsVehicleListings([]);
        setBusinessSession(null);
        setCharLoading(false);
        setWorldReady(false);
      }
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  // Subscribe dokumen karakter, stats, bills, transactions, config/game, & koleksi Fase 3
  useEffect(() => {
    if (!user) return;
    setCharLoading(true);

    const safeReport = (err: unknown, path: string, op: OperationType = OperationType.GET) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        showToast((wrapped as Error).message.slice(0, 140));
      }
    };

    const unsubChar = onSnapshot(
      doc(db, 'characters', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CharacterDoc;
          const fsUpdatedMs = toMillis(data.updatedAt);
          const localSaved = localSimulation.hasSavedState(user.uid);
          if (localSaved && localSaved.charUpdatedAtMs > fsUpdatedMs + 5000) {
            localSimulation.restoreFromStorage(user.uid);
          } else {
            setFsCharacter(data);
            if (data.lastPosition) {
              playerPosRef.current.set(
                data.lastPosition.x,
                data.lastPosition.y,
                data.lastPosition.z
              );
            }
          }
        } else {
          setFsCharacter(null);
          localSimulation.restoreFromStorage(user.uid);
        }
        setCharLoading(false);
      },
      (err) => {
        const restored = localSimulation.restoreFromStorage(user.uid);
        setCharLoading(false);
        if (!restored) {
          safeReport(err, `characters/${user.uid}`, OperationType.GET);
        }
      }
    );

    const unsubStats = onSnapshot(
      doc(db, 'character_stats', user.uid),
      (snap) => {
        setFsStats(snap.exists() ? (snap.data() as CharacterStatsDoc) : null);
      },
      (err) => safeReport(err, `character_stats/${user.uid}`, OperationType.GET)
    );

    const unsubConfig = onSnapshot(
      doc(db, 'config', 'game'),
      (snap) => {
        if (snap.exists()) {
          setGameConfig(snap.data() as GameConfigDoc);
        }
      },
      () => {}
    );

    const unsubTx = onSnapshot(
      query(
        collection(db, 'characters', user.uid, 'transactions'),
        where('uid', '==', user.uid),
        limit(50)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TransactionDoc, 'id'>) }))
          .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
          .slice(0, 30);
        setFsTransactions(list);
      },
      (err) => safeReport(err, `characters/${user.uid}/transactions`, OperationType.LIST)
    );

    const unsubBills = onSnapshot(
      query(
        collection(db, 'characters', user.uid, 'bills'),
        where('uid', '==', user.uid),
        limit(30)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<BillDoc, 'id'>) }))
          .sort((a, b) => (b.periodIndex || 0) - (a.periodIndex || 0))
          .slice(0, 20);
        setFsBills(list);
      },
      (err) => safeReport(err, `characters/${user.uid}/bills`, OperationType.LIST)
    );

    const unsubOwnedProps = onSnapshot(
      query(collection(db, 'properties'), where('ownerId', '==', user.uid), limit(20)),
      (snap) => {
        setFsOwnedProps(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PropertyDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubListings = onSnapshot(
      query(collection(db, 'property_listings'), where('status', '==', 'active'), limit(40)),
      (snap) => {
        setFsListings(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PropertyListingDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubBuyerOffers = onSnapshot(
      query(collection(db, 'offers'), where('buyerId', '==', user.uid), limit(30)),
      (snap) => {
        setFsBuyerOffers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OfferDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubOwnerOffers = onSnapshot(
      query(collection(db, 'offers'), where('ownerId', '==', user.uid), limit(30)),
      (snap) => {
        setFsOwnerOffers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OfferDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubTenantLeases = onSnapshot(
      query(collection(db, 'leases'), where('tenantId', '==', user.uid), limit(10)),
      (snap) => {
        setFsTenantLeases(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaseDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubOwnerLeases = onSnapshot(
      query(collection(db, 'leases'), where('ownerId', '==', user.uid), limit(20)),
      (snap) => {
        setFsOwnerLeases(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaseDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubRoommateLeases = onSnapshot(
      query(collection(db, 'leases'), where('roommateIds', 'array-contains', user.uid), limit(10)),
      (snap) => {
        setFsRoommateLeases(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaseDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubInviteLeases = onSnapshot(
      query(collection(db, 'leases'), where('pendingInviteUids', 'array-contains', user.uid), limit(10)),
      (snap) => {
        setFsInviteLeases(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaseDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubInv = onSnapshot(
      query(
        collection(db, 'characters', user.uid, 'inventory'),
        where('uid', '==', user.uid),
        limit(50)
      ),
      (snap) => {
        setFsInventory(
          snap.docs.map((d) => {
            const raw = d.data() as Omit<InventoryItemDoc, 'id'> & { qty?: number };
            return {
              id: d.id,
              ...raw,
              quantity: Number(raw.quantity ?? raw.qty ?? 0),
            };
          })
        );
      },
      () => {}
    );

    const unsubLegacyFood = onSnapshot(
      query(collection(db, 'items'), where('uid', '==', user.uid), limit(20)),
      (snap) => {
        setFsFoodItems(
          snap.docs.map((d) => {
            const raw = d.data() as { itemId?: string; name?: string; quantity?: number; updatedAt?: unknown };
            return {
              id: d.id,
              uid: user.uid,
              itemId: String(raw.itemId || d.id),
              category: 'food' as const,
              name: String(raw.name || raw.itemId || 'Makanan'),
              quantity: Number(raw.quantity || 0),
              updatedAtMs: toMillis(raw.updatedAt),
            };
          })
        );
      },
      () => {}
    );

    // Listener koleksi Fase 4 (Bank, Pinjaman, Bisnis, Lelang, Market Stats, Treasury)
    const unsubBank = onSnapshot(
      doc(db, 'accounts', user.uid),
      (snap) => {
        setFsBankAccount(snap.exists() ? (snap.data() as BankAccountDoc) : null);
      },
      () => {}
    );

    const unsubLoans = onSnapshot(
      query(collection(db, 'loans'), where('borrowerId', '==', user.uid), limit(15)),
      (snap) => {
        setFsLoans(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LoanDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubBusinesses = onSnapshot(
      query(collection(db, 'businesses'), where('status', '==', 'active'), limit(40)),
      (snap) => {
        setFsBusinesses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BusinessDoc, 'id'>) })));
      },
      () => {}
    );

    const unsubAuctions = onSnapshot(
      query(collection(db, 'auctions'), where('status', 'in', ['active', 'settled']), limit(30)),
      (snap) => {
        setFsAuctions(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<AuctionDoc, 'id'>) }))
            .sort((a, b) => a.endsAtMs - b.endsAtMs)
        );
      },
      () => {}
    );

    const unsubJobPosts = onSnapshot(
      query(collection(db, 'business_job_posts'), where('status', '==', 'open'), limit(20)),
      (snap) => {
        setFsBusinessJobPosts(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<BusinessJobPostDoc, 'id'>) }))
            .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
        );
      },
      () => {}
    );

    const unsubMarketStats = onSnapshot(
      query(collection(db, 'market_stats'), limit(40)),
      (snap) => {
        if (snap.docs.length > 0) {
          setFsMarketStats(snap.docs.map((d) => d.data() as MarketStatDoc));
        }
      },
      () => {}
    );

    const unsubTreasury = onSnapshot(
      doc(db, 'state', 'treasury'),
      (snap) => {
        if (snap.exists()) {
          setFsTreasury(snap.data() as TreasuryStateDoc);
        }
      },
      () => {}
    );

    // Listener koleksi Fase 6 (Hukum, Tahanan, Keamanan, Asuransi, Quest, KPR, Tanah, Konstruksi, Agen)
    const unsubMyCrimes = onSnapshot(
      query(collection(db, 'crime_records'), where('characterId', '==', user.uid), limit(25)),
      (snap) => {
        setFsCrimeRecords(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<CrimeRecordDoc, 'id'>) }))
            .sort((a, b) => (b.atMs || b.createdAtMs || 0) - (a.atMs || a.createdAtMs || 0))
        );
      },
      () => {}
    );

    const unsubMySentence = onSnapshot(
      doc(db, 'sentences', user.uid),
      (snap) => {
        setFsSentence(snap.exists() ? (snap.data() as SentenceDoc) : null);
      },
      () => {}
    );

    const unsubMyPoliceActions = onSnapshot(
      query(collection(db, 'police_actions'), where('targetId', '==', user.uid), limit(20)),
      (snap) => {
        setFsPoliceActions(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceActionDoc, 'id'>) }))
            .sort((a, b) => (b.atMs || 0) - (a.atMs || 0))
        );
      },
      () => {}
    );

    const unsubSecurity = onSnapshot(
      query(collection(db, 'security_installs'), where('ownerId', '==', user.uid), limit(20)),
      (snap) => {
        setFsSecurityInstalls(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SecurityInstallDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubInsurance = onSnapshot(
      query(collection(db, 'insurance'), where('ownerId', '==', user.uid), limit(20)),
      (snap) => {
        setFsInsurancePolicies(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InsurancePolicyDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubClaims = onSnapshot(
      query(collection(db, 'insurance_claims'), where('ownerId', '==', user.uid), limit(20)),
      (snap) => {
        setFsInsuranceClaims(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InsuranceClaimDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubQuests = onSnapshot(
      query(collection(db, 'quests'), where('active', '==', true), limit(25)),
      (snap) => {
        setFsQuestTemplates(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuestTemplateDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubQuestLogs = onSnapshot(
      query(
        collection(db, 'characters', user.uid, 'quest_log'),
        where('uid', '==', user.uid),
        limit(30)
      ),
      (snap) => {
        setFsQuestLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlayerQuestLogDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubMortgages = onSnapshot(
      query(collection(db, 'mortgages'), where('borrowerId', '==', user.uid), limit(15)),
      (snap) => {
        setFsMortgages(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MortgageDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubLandPlots = onSnapshot(
      query(collection(db, 'land_plots'), limit(30)),
      (snap) => {
        setFsLandPlots(
          snap.docs.map((d) => {
            const raw = d.data() as Omit<LandPlotDoc, 'id'>;
            return {
              id: d.id,
              ...raw,
              imbStatus: raw.imbStatus ?? raw.permitStatus ?? 'none',
              permitStatus: raw.permitStatus ?? raw.imbStatus ?? 'none',
              imbReadyAtMs: raw.imbReadyAtMs ?? raw.permitReadyAtMs ?? null,
              permitReadyAtMs: raw.permitReadyAtMs ?? raw.imbReadyAtMs ?? null,
              builtPropertyId: raw.builtPropertyId ?? raw.propertyId ?? null,
              propertyId: raw.propertyId ?? raw.builtPropertyId ?? null,
            };
          })
        );
      },
      () => {}
    );

    const unsubPublicConstructions = onSnapshot(
      query(collection(db, 'constructions'), where('status', '==', 'active'), limit(25)),
      (snap) => {
        setFsPublicConstructions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConstructionDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubOwnedConstructions = onSnapshot(
      query(collection(db, 'constructions'), where('ownerId', '==', user.uid), limit(25)),
      (snap) => {
        setFsOwnedConstructions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConstructionDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubRenovations = onSnapshot(
      query(collection(db, 'renovations'), where('ownerId', '==', user.uid), limit(20)),
      (snap) => {
        setFsRenovations(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RenovationDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubAgentClients = onSnapshot(
      query(collection(db, 'agent_clients'), where('agentId', '==', user.uid), limit(20)),
      (snap) => {
        setFsAgentClients(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgentClientRequestDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubDevProjects = onSnapshot(
      query(collection(db, 'dev_projects'), where('developerId', '==', user.uid), limit(15)),
      (snap) => {
        setFsDevProjects(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DevelopmentProjectDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubMyVehicles = onSnapshot(
      query(collection(db, 'vehicles'), where('ownerId', '==', user.uid), limit(12)),
      (snap) => {
        setFsVehicles(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubMyTestDrive = onSnapshot(
      doc(db, 'vehicle_test_drives', user.uid),
      (snap) => {
        setFsVehicleTestDrive(snap.exists() ? (snap.data() as VehicleTestDriveDoc) : null);
      },
      () => {}
    );

    const unsubMyLicense = onSnapshot(
      doc(db, 'driver_licenses', user.uid),
      (snap) => {
        setFsDriverLicense(snap.exists() ? (snap.data() as DriverLicenseDoc) : null);
      },
      () => {}
    );

    const unsubMyVehicleLeases = onSnapshot(
      query(collection(db, 'vehicle_leases'), where('borrowerId', '==', user.uid), limit(10)),
      (snap) => {
        setFsVehicleLeases(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleLeaseDoc, 'id'>) }))
        );
      },
      () => {}
    );

    const unsubVehicleListings = onSnapshot(
      query(collection(db, 'vehicle_listings'), where('status', '==', 'active'), limit(30)),
      (snap) => {
        setFsVehicleListings(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleListingDoc, 'id'>) }))
        );
      },
      () => {}
    );

    return () => {
      unsubChar();
      unsubStats();
      unsubConfig();
      unsubTx();
      unsubBills();
      unsubOwnedProps();
      unsubListings();
      unsubBuyerOffers();
      unsubOwnerOffers();
      unsubTenantLeases();
      unsubOwnerLeases();
      unsubRoommateLeases();
      unsubInviteLeases();
      unsubInv();
      unsubLegacyFood();
      unsubBank();
      unsubLoans();
      unsubBusinesses();
      unsubAuctions();
      unsubJobPosts();
      unsubMarketStats();
      unsubTreasury();
      unsubMyCrimes();
      unsubMySentence();
      unsubMyPoliceActions();
      unsubSecurity();
      unsubInsurance();
      unsubClaims();
      unsubQuests();
      unsubQuestLogs();
      unsubMortgages();
      unsubLandPlots();
      unsubPublicConstructions();
      unsubOwnedConstructions();
      unsubRenovations();
      unsubAgentClients();
      unsubDevProjects();
      unsubMyVehicles();
      unsubMyTestDrive();
      unsubMyLicense();
      unsubMyVehicleLeases();
      unsubVehicleListings();
    };
  }, [user, showToast]);

  // Listener khusus Polisi aktif (patroli bukti kriminal, sel tahanan & audit Propam)
  const isPoliceJob = fsCharacter?.currentJob?.jobId === 'polisi';
  useEffect(() => {
    if (!user || !isPoliceJob || simState.active) {
      setFsPoliceCrimeRecords([]);
      setFsActiveSentences([]);
      return;
    }

    const uCrimes = onSnapshot(
      query(collection(db, 'crime_records'), limit(30)),
      (snap) => {
        setFsPoliceCrimeRecords(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<CrimeRecordDoc, 'id'>) }))
            .sort((a, b) => (b.atMs || b.createdAtMs || 0) - (a.atMs || a.createdAtMs || 0))
        );
      },
      () => {}
    );

    const uSentences = onSnapshot(
      query(collection(db, 'sentences'), where('status', '==', 'serving'), limit(20)),
      (snap) => {
        setFsActiveSentences(
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<SentenceDoc, 'uid'>) }))
        );
      },
      () => {}
    );

    const uActions = onSnapshot(
      query(collection(db, 'police_actions'), limit(25)),
      (snap) => {
        setFsPoliceActions(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceActionDoc, 'id'>) }))
            .sort((a, b) => (b.atMs || 0) - (a.atMs || 0))
        );
      },
      () => {}
    );

    return () => {
      uCrimes();
      uSentences();
      uActions();
    };
  }, [user, isPoliceJob, simState.active]);

  // Listen properti rumah aktif milik/sewaan user jika tidak dimiliki langsung (untuk sync furnitur/kondisi live)
  useEffect(() => {
    if (!user || !fsCharacter?.currentHomeId || simState.active) {
      setFsHomeProp(null);
      return;
    }
    const propId = fsCharacter.currentHomeId;
    return onSnapshot(
      doc(db, 'properties', propId),
      (snap) => {
        setFsHomeProp(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<PropertyDoc, 'id'>) }) : null);
      },
      () => setFsHomeProp(null)
    );
  }, [user, fsCharacter?.currentHomeId, simState.active]);

  // Listen subkoleksi bisnis hanya untuk bisnis milik pemain + toko yang sedang dikunjungi (hemat biaya Firestore)
  const ownedActiveBizIds = useMemo(
    () =>
      fsBusinesses
        .filter((b) => b.ownerId === user?.uid && b.status === 'active')
        .map((b) => b.id),
    [fsBusinesses, user?.uid]
  );

  const watchedBizIdsKey = useMemo(() => {
    const ids = new Set<string>(ownedActiveBizIds);
    if (shopBusinessId) ids.add(shopBusinessId);
    if (businessSession?.id) ids.add(businessSession.id);
    return Array.from(ids).sort().join(',');
  }, [ownedActiveBizIds, shopBusinessId, businessSession?.id]);

  useEffect(() => {
    if (!user || simState.active || !watchedBizIdsKey) return;
    const targetIds = watchedBizIdsKey.split(',').filter(Boolean);
    const unsubs: Array<() => void> = [];

    for (const bizId of targetIds) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'businesses', bizId, 'stock'), limit(40)),
          (snap) => {
            setFsStockByBiz((prev) => ({
              ...prev,
              [bizId]: snap.docs.map((d) => d.data() as BusinessStockDoc),
            }));
          },
          () => {}
        )
      );

      if (ownedActiveBizIds.includes(bizId)) {
        unsubs.push(
          onSnapshot(
            query(
              collection(db, 'businesses', bizId, 'employees'),
              where('ownerId', '==', user.uid),
              limit(20)
            ),
            (snap) => {
              setFsEmployeesByBiz((prev) => ({
                ...prev,
                [bizId]: snap.docs.map((d) => d.data() as BusinessEmployeeDoc),
              }));
            },
            () => {}
          )
        );
        unsubs.push(
          onSnapshot(
            query(
              collection(db, 'businesses', bizId, 'daily_reports'),
              where('ownerId', '==', user.uid),
              limit(14)
            ),
            (snap) => {
              setFsReportsByBiz((prev) => ({
                ...prev,
                [bizId]: snap.docs
                  .map((d) => d.data() as BusinessDailyReportDoc)
                  .sort((a, b) => b.dayKey.localeCompare(a.dayKey)),
              }));
            },
            () => {}
          )
        );
      }
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [user, simState.active, watchedBizIdsKey, ownedActiveBizIds]);

  // Sinkronkan konteks fallback agar data Firestore terhidrasi mulus jika CF tidak aktif
  useEffect(() => {
    localSimulation.setFallbackContext(fsCharacter, fsStats);
  }, [fsCharacter, fsStats]);

  const character = simState.active ? simState.character : fsCharacter;
  const rawStats = simState.active ? simState.stats : fsStats;
  const transactions = simState.active ? simState.transactions : fsTransactions;
  const bills = simState.active ? simState.bills : fsBills;

  const properties = useMemo<PropertyDoc[]>(() => {
    if (simState.active) return simState.properties;
    const map = new Map<string, PropertyDoc>();
    for (const p of INITIAL_PROPERTIES_DATA) map.set(p.id, p);
    for (const p of fsOwnedProps) map.set(p.id, p);
    if (fsHomeProp) map.set(fsHomeProp.id, fsHomeProp);
    return Array.from(map.values());
  }, [simState.active, simState.properties, fsOwnedProps, fsHomeProp]);

  const listings = useMemo<PropertyListingDoc[]>(() => {
    if (simState.active) return simState.listings;
    return fsListings.length > 0 ? fsListings : INITIAL_LISTINGS_DATA;
  }, [simState.active, simState.listings, fsListings]);

  const offers = useMemo<OfferDoc[]>(() => {
    if (simState.active) return simState.offers;
    const map = new Map<string, OfferDoc>();
    for (const o of [...fsBuyerOffers, ...fsOwnerOffers]) map.set(o.id, o);
    return Array.from(map.values());
  }, [simState.active, simState.offers, fsBuyerOffers, fsOwnerOffers]);

  const leases = useMemo<LeaseDoc[]>(() => {
    if (simState.active) return simState.leases;
    const map = new Map<string, LeaseDoc>();
    for (const l of [...fsTenantLeases, ...fsOwnerLeases, ...fsRoommateLeases, ...fsInviteLeases]) {
      map.set(l.id, l);
    }
    return Array.from(map.values());
  }, [simState.active, simState.leases, fsTenantLeases, fsOwnerLeases, fsRoommateLeases, fsInviteLeases]);

  const inventory = useMemo<InventoryItemDoc[]>(() => {
    if (simState.active) return simState.inventory;
    const map = new Map<string, InventoryItemDoc>();
    for (const item of fsFoodItems) {
      if (item.quantity > 0) map.set(`food_${item.itemId}`, item);
    }
    for (const item of fsInventory) {
      if (item.quantity > 0) map.set(`${item.category}_${item.itemId}`, item);
    }
    return Array.from(map.values());
  }, [simState.active, simState.inventory, fsInventory, fsFoodItems]);

  const bankAccount = simState.active ? simState.bankAccount : fsBankAccount;
  const loans = simState.active ? simState.loans : fsLoans;
  const businesses = simState.active ? simState.businesses : fsBusinesses;
  const stockByBiz = simState.active ? simState.businessStock : fsStockByBiz;
  const employeesByBiz = simState.active ? simState.businessEmployees : fsEmployeesByBiz;
  const reportsByBiz = simState.active ? simState.businessReports : fsReportsByBiz;
  const auctions = simState.active ? simState.auctions : fsAuctions;
  const marketStats = simState.active ? simState.marketStats : fsMarketStats;
  const treasury = simState.active ? simState.treasury : fsTreasury;

  // Data gabungan Fase 6 (Server Firestore atau Local Simulation)
  const crimeRecords = useMemo<CrimeRecordDoc[]>(() => {
    if (simState.active) return simState.crimeRecords;
    const map = new Map<string, CrimeRecordDoc>();
    for (const r of [...fsCrimeRecords, ...fsPoliceCrimeRecords]) map.set(r.id, r);
    return Array.from(map.values()).sort(
      (a, b) => (b.atMs || b.createdAtMs || 0) - (a.atMs || a.createdAtMs || 0)
    );
  }, [simState.active, simState.crimeRecords, fsCrimeRecords, fsPoliceCrimeRecords]);

  const policeActions = simState.active ? simState.policeActions : fsPoliceActions;
  const sentence = simState.active ? simState.sentence : fsSentence;
  const activeSentences = useMemo<SentenceDoc[]>(() => {
    if (simState.active) {
      return simState.sentence && simState.sentence.status === 'serving' ? [simState.sentence] : [];
    }
    return fsActiveSentences;
  }, [simState.active, simState.sentence, fsActiveSentences]);
  const securityInstalls = simState.active ? simState.securityInstalls : fsSecurityInstalls;
  const insurancePolicies = simState.active ? simState.insurancePolicies : fsInsurancePolicies;
  const insuranceClaims = simState.active ? simState.insuranceClaims : fsInsuranceClaims;
  const questLogs = simState.active ? simState.questLogs : fsQuestLogs;
  const mortgages = simState.active ? simState.mortgages : fsMortgages;

  const landPlots = useMemo<LandPlotDoc[]>(() => {
    if (simState.active) return simState.landPlots;
    const base = getDefaultLandPlots(phase6Config.land);
    if (fsLandPlots.length === 0) return base;
    const map = new Map<string, LandPlotDoc>();
    for (const p of base) map.set(p.id, p);
    for (const p of fsLandPlots) map.set(p.id, p);
    return Array.from(map.values());
  }, [simState.active, simState.landPlots, phase6Config.land, fsLandPlots]);

  const constructions = useMemo<ConstructionDoc[]>(() => {
    const rawList = simState.active
      ? simState.constructions
      : (() => {
          const map = new Map<string, ConstructionDoc>();
          for (const c of [...fsPublicConstructions, ...fsOwnedConstructions]) map.set(c.id, c);
          return Array.from(map.values());
        })();
    return rawList.map((c) => ({
      ...c,
      blueprintName:
        c.blueprintName || phase6Config.construction.blueprints[c.blueprintId]?.name || c.blueprintId,
    }));
  }, [
    simState.active,
    simState.constructions,
    fsPublicConstructions,
    fsOwnedConstructions,
    phase6Config.construction.blueprints,
  ]);

  const renovations = simState.active ? simState.renovations : fsRenovations;
  const agentClients = simState.active ? simState.agentClients : fsAgentClients;
  const devProjects = simState.active ? simState.devProjects : fsDevProjects;
  const vehicles = simState.active ? simState.vehicles : fsVehicles;
  const vehicleTestDrive = simState.active ? simState.vehicleTestDrive : fsVehicleTestDrive;
  const driverLicense = simState.active ? simState.driverLicense : fsDriverLicense;
  const vehicleLeases = simState.active ? simState.vehicleLeases : fsVehicleLeases;
  const vehicleListings = simState.active ? simState.vehicleListings : fsVehicleListings;

  // Sinkronisasi lazy status (pingsan / pemecatan / pengusiran / tagihan baru) saat login
  useEffect(() => {
    if (!character || !rawStats || syncedUidRef.current === character.uid) return;
    syncedUidRef.current = character.uid;
    void callSyncPlayerState()
      .then((res) => {
        if (res.evicted) {
          showToast('Kamu diusir dari kontrak sewa karena menunggak! Furniturmu dipindah ke gudang.');
        } else if (res.fainted) {
          showToast('Kamu sempat pingsan! Karakter dipulihkan di lokasi respawn.');
        } else if (res.fired) {
          showToast('Pekerjaanmu diberhentikan karena terlalu sering bolos shift.');
        }
      })
      .catch(() => {});
    void callGetBills()
      .then((res) => {
        if (Array.isArray(res.bills) && !simState.active) {
          setFsBills(res.bills as BillDoc[]);
        }
      })
      .catch(() => {});
  }, [character, rawStats, showToast, simState.active]);

  useEffect(() => {
    const sid = character?.activeShift?.shiftId ?? null;
    if (sid !== lastShiftIdRef.current) {
      lastShiftIdRef.current = sid;
      setVisitedCourierIds([]);
    }
  }, [character?.activeShift?.shiftId]);

  useEffect(() => {
    if (!character?.lastPosition) {
      if (!character) {
        lastFaintedCountRef.current = null;
        lastZoneRef.current = null;
      }
      return;
    }
    const faintCount = character.faintedCount ?? 0;
    const zone = character.currentZone || 'cicalengka';
    if (lastFaintedCountRef.current === null || lastZoneRef.current !== zone) {
      lastFaintedCountRef.current = faintCount;
      lastZoneRef.current = zone;
      playerPosRef.current.set(
        character.lastPosition.x,
        character.lastPosition.y,
        character.lastPosition.z
      );
      return;
    }
    if (faintCount > lastFaintedCountRef.current) {
      lastFaintedCountRef.current = faintCount;
      playerPosRef.current.set(
        character.lastPosition.x,
        character.lastPosition.y,
        character.lastPosition.z
      );
    }
  }, [character, character?.currentZone, character?.faintedCount, character?.lastPosition]);

  const syncDrivingVehicleId = useMemo(() => {
    if (!character || interiorState || businessSession || character.activeTrip || character.activeSleep) {
      return null;
    }
    const zoneId = (character.currentZone || 'cicalengka') as ZoneId;
    if (
      vehicleTestDrive &&
      vehicleTestDrive.status === 'active' &&
      Date.now() < vehicleTestDrive.expiresAtMs &&
      (vehicleTestDrive.zone || 'cicalengka') === zoneId
    ) {
      return `td_${character.uid}`;
    }
    const owned = vehicles.find(
      (v) =>
        v.status === 'driving' &&
        v.driverId === character.uid &&
        (v.parkedPos?.zone || 'cicalengka') === zoneId
    );
    return owned?.id ?? null;
  }, [businessSession, character, interiorState, vehicleTestDrive, vehicles]);

  const syncPassengerVehicleId = useMemo(() => {
    if (
      !character ||
      syncDrivingVehicleId ||
      interiorState ||
      businessSession ||
      character.activeTrip ||
      character.activeSleep
    ) {
      return null;
    }
    return character.passengerVehicleId ?? null;
  }, [businessSession, character, interiorState, syncDrivingVehicleId]);

  const {
    tabSessionId,
    serverOffsetMs,
    remotePlayers,
    remoteVehicles,
    rtdbVehiclesMap,
    rtdbVehiclesReady,
    playerAppearances,
    localBubbles,
    onlineCount,
    syncTransform,
    syncVehicleTransform,
  } = useMultiplayerSync(character, playerPosRef, interiorState?.property.id ?? null, {
    drivingVehicleId: syncDrivingVehicleId,
    passengerVehicleId: syncPassengerVehicleId,
  });

  const staleDriveCheckedRef = useRef<string | null>(null);
  const stalePassCleanupRef = useRef<string | null>(null);
  const seenOwnRtdbVehicleRef = useRef<Set<string>>(new Set());

  // Catat kendaraan aktif yang sudah benar-benar hadir di RTDB pada sesi tab ini
  useEffect(() => {
    if (!character) {
      staleDriveCheckedRef.current = null;
      stalePassCleanupRef.current = null;
      seenOwnRtdbVehicleRef.current.clear();
      return;
    }
    for (const [vid, rv] of Object.entries(rtdbVehiclesMap)) {
      if (rv.driverId === character.uid) {
        seenOwnRtdbVehicleRef.current.add(vid);
      }
    }
  }, [character, rtdbVehiclesMap]);

  // Pulihkan otomatis sesi mengemudi yang terputus mendadak (onDisconnect sudah menghapus node RTDB)
  useEffect(() => {
    if (!character || !rtdbVehiclesReady || simState.active) return;
    const ownedDriving = vehicles.find(
      (v) => v.status === 'driving' && v.driverId === character.uid
    );
    if (!ownedDriving) return;
    if (staleDriveCheckedRef.current === ownedDriving.id) return;
    if (seenOwnRtdbVehicleRef.current.has(ownedDriving.id)) return;
    if (rtdbVehiclesMap[ownedDriving.id]) return;

    const timer = window.setTimeout(() => {
      if (staleDriveCheckedRef.current === ownedDriving.id) return;
      if (seenOwnRtdbVehicleRef.current.has(ownedDriving.id)) return;
      if (rtdbVehiclesMap[ownedDriving.id]) return;
      const ageMs = Date.now() + serverOffsetMs - (ownedDriving.updatedAtMs || 0);
      if (ageMs < 4000) return;

      staleDriveCheckedRef.current = ownedDriving.id;
      const saved = loadLocalLastDrivePos(character.uid);
      const useSaved = saved && saved.vehicleId === ownedDriving.id;
      void callParkVehicle({
        vehicleId: ownedDriving.id,
        x: useSaved ? saved.x : ownedDriving.parkedPos?.x ?? 0,
        y: 0,
        z: useSaved ? saved.z : ownedDriving.parkedPos?.z ?? -20,
        rotY: useSaved ? saved.rotY : ownedDriving.parkedPos?.rotY ?? 0,
        distanceKm: useSaved ? saved.distanceKm : 0,
      })
        .then(() => {
          clearLocalLastDrivePos(character.uid);
          showToast('Sesi berkendara sebelumnya terputus — kendaraan diparkir otomatis.');
        })
        .catch(() => {});
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [character, rtdbVehiclesMap, rtdbVehiclesReady, serverOffsetMs, showToast, simState.active, vehicles]);

  // Turunkan penumpang otomatis jika pengemudi sudah memarkir / disconnect dari RTDB
  useEffect(() => {
    if (!character || !rtdbVehiclesReady || simState.active) {
      stalePassCleanupRef.current = null;
      return;
    }
    const pVid = character.passengerVehicleId;
    if (!pVid) {
      stalePassCleanupRef.current = null;
      return;
    }
    const rv = rtdbVehiclesMap[pVid];
    const stillSeated = Boolean(rv && rv.passengers && rv.passengers[character.uid]);
    if (stillSeated) {
      stalePassCleanupRef.current = null;
      return;
    }
    if (stalePassCleanupRef.current === pVid) return;

    const timer = window.setTimeout(() => {
      const latestRv = rtdbVehiclesMap[pVid];
      if (latestRv && latestRv.passengers && latestRv.passengers[character.uid]) return;
      stalePassCleanupRef.current = pVid;
      void callDismountVehicle({ vehicleId: pVid })
        .then(() => {
          showToast('Perjalanan penumpang selesai — kendaraan telah berhenti / diparkir.');
        })
        .catch(() => {});
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [character, rtdbVehiclesMap, rtdbVehiclesReady, showToast, simState.active]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const serverNow = nowTick + serverOffsetMs;
  const clock = getGameClockInfo(serverNow, gameConfig);
  const weatherSlot = (clock.dayNumber * 7 + clock.hour) % 13;
  const effectiveWeather: WeatherKind =
    weatherMode !== 'auto'
      ? weatherMode
      : weatherSlot === 0
      ? 'hujan_deras'
      : weatherSlot === 1
      ? 'gerimis'
      : 'cerah';

  const shiftPromptType = String(character?.activeShift?.taskPrompt?.type || '');
  const isKurirShift =
    shiftPromptType === 'kurir' ||
    shiftPromptType === 'ojek_online' ||
    shiftPromptType === 'sopir_angkot' ||
    shiftPromptType === 'sopir_logistik';
  const activeSentenceEndsMs =
    sentence?.status === 'serving'
      ? sentence.endAtMs
      : character?.sentence?.active
        ? character.sentence.endAtMs ?? character.sentence.endsAtMs ?? 0
        : 0;
  const isJailed =
    Boolean(sentence?.status === 'serving' || character?.sentence?.active) &&
    activeSentenceEndsMs > 0;
  const businessJobPostsList = simState.active ? simState.businessJobPosts : fsBusinessJobPosts;
  const myBusinesses = businesses.filter(
    (b) => b.ownerId === character?.uid && b.status !== 'closed'
  );

  const {
    pendingPrompt,
    activeNav,
    activeNavDistanceMeters,
    activeNavEtaSeconds,
    menuDistances,
    openGatedMenu,
    selectPromptDestination,
    startGuidance,
    cancelPrompt,
    cancelNavigation,
    stopAutoWalk,
    toggleAutoWalk,
    guideToWorldPoint,
    registerOpenGatedModal,
    clearOpenGatedModal,
  } = useLocationGate({
    character,
    playerPosRef,
    hasBankAccount: Boolean(bankAccount || character?.bankAccount?.accountNumber),
    isJailed,
    insideInterior: Boolean(interiorState),
    insideBusinessId: businessSession?.id ?? null,
    activeShiftLocked: Boolean(character?.activeShift && !isKurirShift),
    jobs: phase2Config.jobs,
    businessJobPosts: businessJobPostsList,
    businesses,
    properties,
    landPlots,
    npcsConfig: phase6Config.npcs,
    serverNowMs: serverNow,
    gameHour: clock.hour,
    onNotify: showToast,
    onOpenTrainForZone: (targetZone) => {
      setTrainPreselectZone(targetZone);
      setTrainOpen(true);
      if (character) {
        const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
        const trainLookup = getNearestValidDestination('train', pos, {
          character,
          businesses,
          properties,
        });
        registerOpenGatedModal('train', trainLookup.nearest, () => setTrainOpen(false));
      }
    },
  });

  useEffect(() => {
    if (!activeNav) setOffscreenIndicator(null);
  }, [activeNav]);

  const openJobsGated = useCallback(
    (targetJobId?: string | null) => {
      openGatedMenu('jobs', {
        targetJobId: targetJobId ?? null,
        onOpen: ({ destination }) => {
          const payloadJobId =
            typeof destination?.payload?.jobId === 'string' ? destination.payload.jobId : null;
          setHighlightJobId(targetJobId ?? payloadJobId ?? null);
          setJobsOpen(true);
          registerOpenGatedModal('jobs', destination, () => setJobsOpen(false));
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openTrainGated = useCallback(
    (preselectZone?: ZoneId | null) => {
      openGatedMenu('train', {
        onOpen: ({ destination }) => {
          setTrainPreselectZone(preselectZone ?? null);
          setTrainOpen(true);
          registerOpenGatedModal('train', destination, () => setTrainOpen(false));
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openCoursesGated = useCallback(() => {
    const claimReady = Boolean(
      character?.activeCourse && character.activeCourse.completesAtMs <= serverNow
    );
    openGatedMenu('courses', {
      allowDirectIfClaimReady: claimReady,
      onOpen: ({ destination }) => {
        setCourseOpen(true);
        registerOpenGatedModal('courses', destination, () => setCourseOpen(false));
      },
    });
  }, [character?.activeCourse, openGatedMenu, registerOpenGatedModal, serverNow]);

  const openClinicGated = useCallback(
    (targetClinicId?: string | null) => {
      const claimReady = Boolean(
        character?.activeClinic && character.activeClinic.completesAtMs <= serverNow
      );
      openGatedMenu('clinic', {
        targetClinicId: targetClinicId ?? null,
        allowDirectIfClaimReady: claimReady,
        onOpen: ({ destination }) => {
          const resolvedId =
            targetClinicId ??
            (typeof destination?.payload?.clinicId === 'string'
              ? destination.payload.clinicId
              : null);
          setSelectedClinicId(resolvedId);
          setClinicOpen(true);
          registerOpenGatedModal('clinic', destination, () => setClinicOpen(false));
        },
      });
    },
    [character?.activeClinic, openGatedMenu, registerOpenGatedModal, serverNow]
  );

  const openBankGated = useCallback(
    (requiresBankBranch = false) => {
      openGatedMenu('bank', {
        requiresBankBranch,
        onOpen: ({ destination }) => {
          const mode: 'bank' | 'atm' =
            destination?.id && destination.id !== 'bank' ? 'atm' : 'bank';
          setBankModal({ open: true, mode });
          registerOpenGatedModal('bank', destination, () =>
            setBankModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openBusinessGated = useCallback(
    (opts?: { view?: 'manage' | 'create' | 'craft'; businessId?: string | null; forceKantorDesa?: boolean }) => {
      const useKantorDesa = Boolean(opts?.forceKantorDesa || myBusinesses.length === 0 || opts?.view === 'create');
      const menuId = useKantorDesa ? 'business_create' : 'business';
      const resolvedView = opts?.view ?? (myBusinesses.length > 0 ? 'manage' : 'create');
      const resolvedBizId =
        opts?.businessId !== undefined ? opts.businessId : myBusinesses[0]?.id ?? null;

      openGatedMenu(menuId, {
        targetBusinessId: resolvedBizId,
        onOpen: ({ destination }) => {
          const destBizId =
            typeof destination?.payload?.businessId === 'string'
              ? destination.payload.businessId
              : resolvedBizId;
          setBusinessModal({
            open: true,
            view: resolvedView,
            businessId: destBizId,
          });
          registerOpenGatedModal('business', destination, () =>
            setBusinessModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [myBusinesses, openGatedMenu, registerOpenGatedModal]
  );

  const openWholesaleGated = useCallback(
    (businessId?: string | null) => {
      openGatedMenu('wholesale', {
        onOpen: ({ destination }) => {
          setWholesaleModal({
            open: true,
            businessId: businessId ?? myBusinesses[0]?.id ?? null,
          });
          registerOpenGatedModal('wholesale', destination, () =>
            setWholesaleModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [myBusinesses, openGatedMenu, registerOpenGatedModal]
  );

  const openAuctionGated = useCallback(() => {
    openGatedMenu('auction', {
      onOpen: ({ destination }) => {
        setAuctionOpen(true);
        registerOpenGatedModal('auction', destination, () => setAuctionOpen(false));
      },
    });
  }, [openGatedMenu, registerOpenGatedModal]);

  const openLawGated = useCallback(() => {
    openGatedMenu('law', {
      onOpen: ({ destination }) => {
        setLawOpen(true);
        registerOpenGatedModal('law', destination, () => setLawOpen(false));
      },
    });
  }, [openGatedMenu, registerOpenGatedModal]);

  const openAgentGated = useCallback(
    (tab: 'agent' | 'developer' | 'furniture_sets' = 'agent') => {
      const menuId = tab === 'furniture_sets' ? 'furniture_shop' : 'agent_developer';
      openGatedMenu(menuId, {
        onOpen: ({ destination }) => {
          setAgentDeveloperModal({ open: true, tab });
          registerOpenGatedModal('agent', destination, () =>
            setAgentDeveloperModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openTokoMebelGated = useCallback(
    (tab: 'shop' | 'inventory' = 'shop') => {
      if (tab === 'inventory') {
        setFurnitureModal({ open: true, tab: 'inventory' });
        return;
      }
      openGatedMenu('furniture_shop', {
        onOpen: ({ destination }) => {
          setFurnitureModal({ open: true, tab: 'shop' });
          registerOpenGatedModal('furniture_shop', destination, () =>
            setFurnitureModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openPropertyGate = useCallback(
    (prop: PropertyDoc, action: 'property_enter' | 'property_survey') => {
      openGatedMenu(action, {
        targetPropertyId: prop.id,
        onOpen: ({ destination }) => {
          setDetailPropertyId(prop.id);
          registerOpenGatedModal('property_detail', destination, () => setDetailPropertyId(null));
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openNpcGated = useCallback(
    (npcId: string) => {
      openGatedMenu('npc', {
        targetNpcId: npcId,
        onOpen: ({ destination }) => {
          setNpcDialogId(npcId);
          registerOpenGatedModal('npc', destination, () => setNpcDialogId(null));
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openLandBuyGated = useCallback(
    (plot: LandPlotDoc) => {
      openGatedMenu('buy_land', {
        targetPlotId: plot.id,
        onOpen: ({ destination }) => {
          setLandConstructionModal({ open: true, tab: 'land', plotId: plot.id });
          registerOpenGatedModal('land_buy', destination, () =>
            setLandConstructionModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openImbGated = useCallback(
    (plot: LandPlotDoc) => {
      openGatedMenu('apply_imb', {
        targetPlotId: plot.id,
        onOpen: ({ destination }) => {
          setLandConstructionModal({ open: true, tab: 'land', plotId: plot.id });
          registerOpenGatedModal('apply_imb', destination, () =>
            setLandConstructionModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openMortgageDeskGated = useCallback(() => {
    openGatedMenu('apply_mortgage', {
      onOpen: ({ destination }) => {
        setMortgageSecurityModal({ open: true, tab: 'mortgage' });
        registerOpenGatedModal('apply_mortgage', destination, () =>
          setMortgageSecurityModal((prev) => ({ ...prev, open: false }))
        );
      },
    });
  }, [openGatedMenu, registerOpenGatedModal]);

  const openDealerGated = useCallback(
    (targetDealerId?: string | null) => {
      openGatedMenu('dealer', {
        targetDealerId: targetDealerId ?? null,
        onOpen: ({ destination }) => {
          const destDealerId =
            targetDealerId ??
            (typeof destination?.payload?.dealerId === 'string'
              ? destination.payload.dealerId
              : null);
          setDealerModal({ open: true, dealerId: destDealerId });
          registerOpenGatedModal('dealer', destination, () =>
            setDealerModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openSpbuGated = useCallback(() => {
    openGatedMenu('spbu', {
      onOpen: ({ destination }) => {
        setSpbuOpen(true);
        registerOpenGatedModal('spbu', destination, () => setSpbuOpen(false));
      },
    });
  }, [openGatedMenu, registerOpenGatedModal]);

  const openWorkshopGated = useCallback(
    (businessId?: string | null) => {
      openGatedMenu('workshop', {
        targetBusinessId: businessId ?? null,
        onOpen: ({ destination }) => {
          const destBizId =
            businessId ??
            (typeof destination?.payload?.businessId === 'string'
              ? destination.payload.businessId
              : null);
          setWorkshopModal({ open: true, businessId: destBizId });
          registerOpenGatedModal('workshop', destination, () =>
            setWorkshopModal((prev) => ({ ...prev, open: false }))
          );
        },
      });
    },
    [openGatedMenu, registerOpenGatedModal]
  );

  const openSamsatSimGated = useCallback(() => {
    openGatedMenu('samsat_sim', {
      onOpen: ({ destination }) => {
        setSamsatSimOpen(true);
        registerOpenGatedModal('samsat_sim', destination, () => setSamsatSimOpen(false));
      },
    });
  }, [openGatedMenu, registerOpenGatedModal]);

  const computedStats = rawStats
    ? computeClientLazyStats(
        rawStats.hunger,
        rawStats.thirst,
        rawStats.energy,
        toMillis(rawStats.lastCalculatedAt),
        serverNow,
        gameConfig,
        rawStats.health ?? character?.health ?? 100,
        rawStats.hygiene ?? character?.hygiene ?? 100,
        rawStats.mood ?? character?.mood ?? 80,
        Boolean(character?.homeless)
      )
    : {
        hunger: 100,
        thirst: 100,
        energy: 100,
        health: 100,
        hygiene: 100,
        mood: 80,
        isCritical: false,
        didFaint: false,
      };

  const handleBathAction = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await callTakeBath();
      showToast('Segar! Kebersihan dan mood meningkat setelah mandi.');
    } catch (err) {
      showToast((err as Error)?.message || 'Gagal mandi saat ini.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleWakeSleep = useCallback(async () => {
    if (actionBusy || !character?.activeSleep) return;
    setActionBusy(true);
    try {
      const res = await callSleepAtHome('wake');
      if (res.fainted) {
        showToast('Kamu sempat kelelahan kritis saat tidur!');
      } else {
        showToast('Bangun tidur! Stamina dan suasana hatimu diperbarui.');
      }
    } catch (err) {
      showToast((err as Error)?.message || 'Gagal bangun tidur.');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, character?.activeSleep, showToast]);

  // Bangun otomatis saat durasi tidur selesai
  useEffect(() => {
    const activeSleep = character?.activeSleep;
    if (!activeSleep) {
      autoWokeSleepRef.current = null;
      return;
    }
    if (
      serverNow >= activeSleep.completesAtMs &&
      !actionBusy &&
      autoWokeSleepRef.current !== activeSleep.startedAtMs
    ) {
      autoWokeSleepRef.current = activeSleep.startedAtMs;
      void handleWakeSleep();
    }
  }, [actionBusy, character?.activeSleep, handleWakeSleep, serverNow]);

  const handleExitInterior = async () => {
    setDecorationMode(false);
    setInteriorState(null);
    setNearbyTarget(null);
    try {
      await callLeaveProperty();
    } catch {
      // Abaikan error non-kritis saat keluar interior
    }
  };

  const handleToggleTurnSignal = useCallback((mode: 'left' | 'right' | 'hazard') => {
    setVehicleTurnSignal((prev) => (prev === mode ? 'off' : mode));
  }, []);

  const handlePedestrianCollision = useCallback(
    async (info: PedestrianCollisionInfo) => {
      try {
        const res = await callReportPedestrianCollision({
          targetName: info.targetName,
          targetType: info.targetType,
          x: info.x,
          z: info.z,
          zone: info.zone,
        });
        if (!res.skipped) {
          showToast(
            `Menabrak pejalan kaki (${info.targetName})! Denda Rp${(res.fineAmount ?? 0).toLocaleString('id-ID')} & catatan lalu lintas.`
          );
        }
      } catch {
        showToast(`Hati-hati! Kamu hampir menabrak ${info.targetName}.`);
      }
    },
    [showToast]
  );

  const handleExitVehicle = useCallback(
    async (payload: ExitVehiclePayload) => {
      setDrivingTelemetry(null);
      setVehicleHeadlightsManual(null);
      setVehicleTurnSignal('off');
      vehicleSpeedRef.current = 0;

      // Geser posisi pejalan kaki ke samping kendaraan agar tidak tersangkut collider
      const exitOffsetX = Math.cos(payload.rotY) * 1.4;
      const exitOffsetZ = -Math.sin(payload.rotY) * 1.4;
      playerPosRef.current.set(
        payload.x + exitOffsetX,
        Math.max(0.5, payload.y + 0.5),
        payload.z + exitOffsetZ
      );

      if (character?.uid) {
        clearLocalLastDrivePos(character.uid);
      }

      if (payload.mode === 'test_drive') {
        try {
          await callTestDriveStart({ action: 'end' });
        } catch {
          // Abaikan
        }
        if (payload.reason === 'test_drive_expired') {
          showToast('Waktu uji coba (test drive) selesai!');
        } else if (payload.reason === 'test_drive_out_of_bounds') {
          showToast('Melewati batas area uji coba — kendaraan dikembalikan ke dealer.');
        } else {
          showToast('Uji coba kendaraan selesai.');
        }
        return;
      }

      const terrainType =
        payload.offroadKm > payload.distanceKm * 0.45 ? ('offroad' as const) : ('road' as const);
      try {
        await callParkVehicle({
          vehicleId: payload.vehicleId,
          x: Number(payload.x.toFixed(2)),
          y: 0,
          z: Number(payload.z.toFixed(2)),
          rotY: Number(payload.rotY.toFixed(3)),
          distanceKm: payload.distanceKm,
          terrainType,
          crashDamage: payload.crashDamage,
        });
        showToast('Kendaraan diparkir & tersimpan.');
      } catch {
        try {
          await callDismountVehicle({
            vehicleId: payload.vehicleId,
            x: Number(payload.x.toFixed(2)),
            y: 0,
            z: Number(payload.z.toFixed(2)),
            rotY: Number(payload.rotY.toFixed(3)),
            distanceKm: payload.distanceKm,
            terrainType,
            crashDamage: payload.crashDamage,
          });
          showToast('Turun dari kendaraan.');
        } catch (err) {
          showToast((err as Error)?.message || 'Gagal memarkir kendaraan.');
        }
      }
    },
    [character?.uid, showToast]
  );

  const handleDismountPassenger = useCallback(async () => {
    const pVid = character?.passengerVehicleId;
    if (!pVid || actionBusy) return;
    setActionBusy(true);
    try {
      await callDismountVehicle({ vehicleId: pVid });
      showToast('Turun dari kendaraan.');
    } catch (err) {
      showToast((err as Error)?.message || 'Gagal turun dari kendaraan.');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, character?.passengerVehicleId, showToast]);

  const handleActionTrigger = async () => {
    const activeTarget: NearbyInteractTarget =
      !activeDriveVehicle && !activePassengerVehicle
        ? nearbyVehicle
          ? {
              type: 'vehicle_board',
              vehicleId: nearbyVehicle.vehicleId,
              label: nearbyVehicle.label,
              asPassenger: false,
            }
          : nearbyPassengerVehicle
            ? {
                type: 'vehicle_board',
                vehicleId: nearbyPassengerVehicle.vehicleId,
                label: nearbyPassengerVehicle.label,
                asPassenger: true,
              }
            : nearbyTarget
        : nearbyTarget;
    if (!activeTarget || actionBusy || !character) return;
    switch (activeTarget.type) {
      case 'vehicle_board':
        setActionBusy(true);
        try {
          const asPassenger = Boolean(activeTarget.asPassenger);
          await callMountVehicle(activeTarget.vehicleId, asPassenger, tabSessionId);
          showToast(
            asPassenger
              ? `Menumpang ${activeTarget.label.replace(/^Numpang /, '')}`
              : `Mengendarai ${activeTarget.label.replace(/^Naik /, '')}`
          );
        } catch (err) {
          showToast((err as Error)?.message || 'Gagal menaiki kendaraan.');
        } finally {
          setActionBusy(false);
        }
        return;
      case 'warung':
        openGatedMenu('warung', {
          onOpen: ({ destination }) => {
            setWarungOpen(true);
            registerOpenGatedModal('warung', destination, () => setWarungOpen(false));
          },
        });
        return;
      case 'kontrakan':
        setActionBusy(true);
        try {
          await callRest();
          showToast('Istirahat selesai! Energi +40% & Mood +10%.');
        } catch (err) {
          showToast((err as Error)?.message || 'Gagal beristirahat.');
        } finally {
          setActionBusy(false);
        }
        return;
      case 'bath':
        await handleBathAction();
        return;
      case 'clinic':
        openClinicGated(activeTarget.clinicId);
        return;
      case 'school':
        openCoursesGated();
        return;
      case 'station':
        openTrainGated(null);
        return;
      case 'property':
        setDetailPropertyId(activeTarget.propertyId);
        return;
      case 'toko_mebel':
        openTokoMebelGated('shop');
        return;
      case 'penampungan':
        openGatedMenu('penampungan', {
          onOpen: ({ destination }) => {
            setHomelessSleepTarget({ mode: 'shelter', label: PENAMPUNGAN_POS.label });
            registerOpenGatedModal('homeless_sleep', destination, () =>
              setHomelessSleepTarget(null)
            );
          },
        });
        return;
      case 'emperan':
        openGatedMenu('emperan', {
          targetSpotId: activeTarget.spotId,
          onOpen: ({ destination }) => {
            setHomelessSleepTarget({
              mode: 'emperan',
              spotId: activeTarget.spotId,
              label: activeTarget.label,
            });
            registerOpenGatedModal('homeless_sleep', destination, () =>
              setHomelessSleepTarget(null)
            );
          },
        });
        return;
      case 'interior_exit':
        if (businessSession) {
          setBusinessSession(null);
          setNearbyTarget(null);
          return;
        }
        await handleExitInterior();
        return;
      case 'interior_bath':
        if (interiorState?.mode === 'preview') {
          showToast('Mode Survei hanya pratinjau. Sewa atau beli untuk menggunakan kamar mandi.');
          return;
        }
        setActionBusy(true);
        try {
          await callBatheAtHome(interiorState?.property.id);
          showToast('Mandi nyaman di rumah! Kebersihan +70% & Mood +18%.');
        } catch (err) {
          showToast((err as Error)?.message || 'Gagal mandi di rumah.');
        } finally {
          setActionBusy(false);
        }
        return;
      case 'interior_sleep':
        if (interiorState?.mode === 'preview') {
          showToast('Mode Survei hanya pratinjau. Sewa atau beli untuk tidur di sini.');
          return;
        }
        setActionBusy(true);
        try {
          await callSleepAtHome('start', 'home', interiorState?.property.id);
          showToast(`Mulai tidur di ${interiorState?.property.name}...`);
        } catch (err) {
          showToast((err as Error)?.message || 'Gagal mulai tidur di rumah.');
        } finally {
          setActionBusy(false);
        }
        return;
      case 'interior_eat':
        setFurnitureModal({ open: true, tab: 'inventory' });
        return;
      case 'job_site':
        if (character.currentJob?.jobId === activeTarget.jobId && !character.activeShift) {
          setActionBusy(true);
          try {
            const res = await callStartShift();
            if (res.fired) {
              showToast('Kamu dipecat karena bolos terlalu lama! Lamar pekerjaan baru.');
              openJobsGated(activeTarget.jobId);
            } else {
              showToast('Shift dimulai! Kerjakan tugasmu dengan baik.');
            }
          } catch (err) {
            showToast((err as Error)?.message || 'Gagal memulai shift.');
          } finally {
            setActionBusy(false);
          }
        } else {
          openJobsGated(activeTarget.jobId);
        }
        return;
      case 'bank':
        openBankGated(true);
        return;
      case 'atm':
        openBankGated(false);
        return;
      case 'kantor_desa':
        openBusinessGated({ view: 'create', businessId: null, forceKantorDesa: true });
        return;
      case 'pasar_grosir':
        openWholesaleGated(
          businesses.find((b) => b.ownerId === character.uid && b.status === 'active')?.id ?? null
        );
        return;
      case 'balai_lelang':
        openAuctionGated();
        return;
      case 'business':
        openGatedMenu('business_shop', {
          targetBusinessId: activeTarget.businessId,
          onOpen: ({ destination }) => {
            setShopBusinessId(activeTarget.businessId);
            registerOpenGatedModal('business_shop', destination, () => setShopBusinessId(null));
          },
        });
        return;
      case 'biz_cashier':
        setShopBusinessId(activeTarget.businessId);
        return;
      case 'biz_craft':
        openBusinessGated({ view: 'craft', businessId: activeTarget.businessId });
        return;
      case 'biz_manage':
        openBusinessGated({ view: 'manage', businessId: activeTarget.businessId });
        return;
      case 'polsek':
        if (character.currentJob?.jobId === 'polisi' && !isJailed) {
          setPoliceOpen(true);
        } else {
          openLawGated();
        }
        return;
      case 'agent_office':
        openAgentGated('agent');
        return;
      case 'land_plot':
        setLandConstructionModal({
          open: true,
          tab: 'land',
          plotId: activeTarget.plotId,
        });
        return;
      case 'construction':
        setLandConstructionModal({
          open: true,
          tab: 'active',
          plotId: activeTarget.plotId,
        });
        return;
      case 'npc':
        openNpcGated(activeTarget.npcId);
        return;
      case 'dealer':
        openDealerGated(activeTarget.dealerId);
        return;
      case 'spbu':
        openSpbuGated();
        return;
      case 'workshop':
        openWorkshopGated(null);
        return;
      case 'samsat_sim':
        openSamsatSimGated();
        return;
    }
  };

  const handleOpenDecorationMode = useCallback(() => {
    if (!interiorState || interiorState.mode !== 'resident') return;
    setDraftFurniture([...(interiorState.property.furniture || [])]);
    setSelectedFurnitureId(null);
    setPendingFurnitureId(null);
    setPendingRotation(0);
    setHoverCell(null);
    setDecorationMode(true);
  }, [interiorState]);

  const handleRotateDeco = useCallback(() => {
    const nextRot = (r: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 =>
      ((r + 90) % 360) as 0 | 90 | 180 | 270;

    if (pendingFurnitureId) {
      setPendingRotation((prev) => nextRot(prev));
      return;
    }
    if (!selectedFurnitureId || !interiorState) return;
    const cols = interiorState.property.layout?.gridCols ?? 6;
    const rows = interiorState.property.layout?.gridRows ?? 6;
    const current = draftFurniture.find((f) => f.instanceId === selectedFurnitureId);
    if (!current) return;
    const candidateRot = nextRot(current.rot);
    if (
      canPlaceFurnitureAt(
        current.furnitureId,
        current.gx,
        current.gz,
        candidateRot,
        cols,
        rows,
        draftFurniture,
        current.instanceId
      )
    ) {
      setDraftFurniture((prev) =>
        prev.map((f) => (f.instanceId === current.instanceId ? { ...f, rot: candidateRot } : f))
      );
    } else {
      showToast('Tidak cukup ruang untuk memutar furnitur di posisi ini.');
    }
  }, [pendingFurnitureId, selectedFurnitureId, interiorState, draftFurniture, showToast]);

  const handleNudgeSelected = useCallback(
    (dx: number, dz: number) => {
      if (!selectedFurnitureId || !interiorState) return;
      const cols = interiorState.property.layout?.gridCols ?? 6;
      const rows = interiorState.property.layout?.gridRows ?? 6;
      const current = draftFurniture.find((f) => f.instanceId === selectedFurnitureId);
      if (!current) return;
      const ngx = current.gx + dx;
      const ngz = current.gz + dz;
      if (
        canPlaceFurnitureAt(
          current.furnitureId,
          ngx,
          ngz,
          current.rot,
          cols,
          rows,
          draftFurniture,
          current.instanceId
        )
      ) {
        setDraftFurniture((prev) =>
          prev.map((f) => (f.instanceId === current.instanceId ? { ...f, gx: ngx, gz: ngz } : f))
        );
      }
    },
    [selectedFurnitureId, interiorState, draftFurniture]
  );

  const handleRemoveSelected = useCallback(() => {
    if (!selectedFurnitureId) return;
    setDraftFurniture((prev) => prev.filter((f) => f.instanceId !== selectedFurnitureId));
    setSelectedFurnitureId(null);
  }, [selectedFurnitureId]);

  const handleTapGridCell = useCallback(
    (gx: number, gz: number) => {
      if (!interiorState || !character) return;
      const cols = interiorState.property.layout?.gridCols ?? 6;
      const rows = interiorState.property.layout?.gridRows ?? 6;

      if (pendingFurnitureId) {
        // Hitung stok total yang dimiliki (gudang + yang sudah terpasang milik saya)
        const placedBefore = (interiorState.property.furniture || []).filter(
          (f) => f.furnitureId === pendingFurnitureId && (f.ownerUid === character.uid || !f.ownerUid)
        ).length;
        const warehouseQty =
          inventory.find((i) => i.category === 'furniture' && i.itemId === pendingFurnitureId)
            ?.quantity ?? 0;
        const usedInDraft = draftFurniture.filter((f) => f.furnitureId === pendingFurnitureId).length;
        if (usedInDraft >= warehouseQty + placedBefore) {
          showToast('Stok furnitur ini di gudang sudah habis terpasang.');
          return;
        }
        if (
          !canPlaceFurnitureAt(
            pendingFurnitureId,
            gx,
            gz,
            pendingRotation,
            cols,
            rows,
            draftFurniture
          )
        ) {
          showToast('Posisi bertabrakan atau melewati batas lantai.');
          return;
        }
        const meta = FURNITURE_CATALOG.find((c) => c.id === pendingFurnitureId);
        const newId = `furn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setDraftFurniture((prev) => [
          ...prev,
          {
            instanceId: newId,
            furnitureId: pendingFurnitureId,
            gx,
            gz,
            rot: pendingRotation,
            ownerUid: character.uid,
          },
        ]);
        setSelectedFurnitureId(newId);
        setPendingFurnitureId(null);
        showToast(`${meta?.name || 'Furnitur'} diletakkan.`);
        return;
      }

      if (selectedFurnitureId) {
        const current = draftFurniture.find((f) => f.instanceId === selectedFurnitureId);
        if (!current) return;
        if (
          canPlaceFurnitureAt(
            current.furnitureId,
            gx,
            gz,
            current.rot,
            cols,
            rows,
            draftFurniture,
            current.instanceId
          )
        ) {
          setDraftFurniture((prev) =>
            prev.map((f) => (f.instanceId === current.instanceId ? { ...f, gx, gz } : f))
          );
        } else {
          showToast('Tidak bisa memindah ke ubin tersebut.');
        }
      }
    },
    [
      interiorState,
      character,
      pendingFurnitureId,
      pendingRotation,
      selectedFurnitureId,
      draftFurniture,
      inventory,
      showToast,
    ]
  );

  const handleSaveDecoration = async () => {
    if (!interiorState || !character) return;
    setSavingDecoration(true);
    try {
      const isOwner = interiorState.property.ownerId === character.uid;
      const mineToSave = draftFurniture.filter(
        (f) => f.ownerUid === character.uid || (!f.ownerUid && isOwner)
      );
      const res = await callPlaceFurniture(interiorState.property.id, mineToSave);
      setInteriorState((prev) =>
        prev ? { ...prev, property: { ...prev.property, furniture: res.furniture } } : null
      );
      setDecorationMode(false);
      showToast('Tata letak dekorasi berhasil disimpan ke server!');
    } catch (err) {
      showToast((err as Error)?.message || 'Gagal menyimpan dekorasi.');
    } finally {
      setSavingDecoration(false);
    }
  };

  // Pintasan keyboard Mode Dekorasi (R putar, Delete hapus, Escape batal)
  useEffect(() => {
    if (!decorationMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') handleRotateDeco();
      else if (e.code === 'Delete' || e.code === 'Backspace') handleRemoveSelected();
      else if (e.code === 'Escape') setDecorationMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decorationMode, handleRotateDeco, handleRemoveSelected]);

  const handleVisitCourierTarget = useCallback(
    (target: CourierTarget) => {
      const sType = String(character?.activeShift?.taskPrompt?.type || '');
      setVisitedCourierIds((prev) => {
        if (prev.includes(target.id)) return prev;
        if (sType === 'ojek_online') {
          showToast(
            target.role === 'pickup'
              ? `Penumpang naik di ${target.label}! Antar ke tujuan.`
              : `Order CikOjek selesai di ${target.label}!`
          );
        } else if (sType === 'sopir_angkot') {
          showToast(
            `Singgah ${target.label}: +${target.boarded ?? 2} naik, ${target.alighted ?? 1} turun.`
          );
        } else if (sType === 'sopir_logistik') {
          showToast(`Selesai titik ekspedisi: ${target.label}!`);
        } else {
          showToast(`Paket berhasil diantar ke ${target.label}!`);
        }
        return [...prev, target.id];
      });
    },
    [character?.activeShift?.taskPrompt?.type, showToast]
  );

  const handleZoomStep = useCallback(
    (delta: number) => {
      if (droneMode) {
        const d = droneControlRef.current;
        const nextAlt = THREE.MathUtils.clamp((d.goalAltitude ?? d.altitude) + delta * 5, 10, 95);
        d.goalAltitude = nextAlt;
        setDroneTelemetry((prev) => ({ ...prev, altitude: Math.round(nextAlt) }));
        return;
      }
      cameraOrbitRef.current.distance = THREE.MathUtils.clamp(
        cameraOrbitRef.current.distance + delta,
        4.2,
        16
      );
    },
    [droneMode]
  );

  const handleToggleDroneMode = useCallback(() => {
    setDroneMode((prev) => {
      if (prev) return false;
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      const zone = character?.currentZone || 'cicalengka';
      const overviewZ = zone === 'cicalengka' ? 0 : -16;
      const overviewAlt = zone === 'cicalengka' ? 68 : 44;
      droneControlRef.current = {
        targetX: px,
        targetZ: pz,
        altitude: 22,
        yaw: cameraOrbitRef.current.yaw,
        pitch: 0.58,
        autoOrbit: droneAutoOrbit,
        goalX: 0,
        goalZ: overviewZ,
        goalAltitude: overviewAlt,
        goalPitch: zone === 'cicalengka' ? 0.85 : 0.74,
        goalYaw: 0.42,
      };
      setDronePresetId('overview');
      setDroneTelemetry({
        altitude: overviewAlt,
        x: Math.round(px),
        z: Math.round(pz),
        pitchDeg: zone === 'cicalengka' ? 49 : 42,
      });
      return true;
    });
  }, [character?.currentZone, droneAutoOrbit]);

  const handleSelectDronePreset = useCallback((preset: DronePreset) => {
    const d = droneControlRef.current;
    d.goalX = preset.x;
    d.goalZ = preset.z;
    d.goalAltitude = preset.altitude;
    d.goalPitch = preset.pitch;
    if (typeof preset.yaw === 'number') {
      d.goalYaw = preset.yaw;
    }
    setDronePresetId(preset.id);
    setDroneTelemetry((prev) => ({
      ...prev,
      altitude: Math.round(preset.altitude),
      pitchDeg: Math.round(THREE.MathUtils.radToDeg(preset.pitch)),
    }));
  }, []);

  const handleChangeDroneAltitude = useCallback((alt: number) => {
    const clamped = THREE.MathUtils.clamp(alt, 10, 95);
    droneControlRef.current.goalAltitude = clamped;
    setDroneTelemetry((prev) => ({ ...prev, altitude: Math.round(clamped) }));
  }, []);

  const handleSetDronePitch = useCallback((pitch: number) => {
    const clamped = THREE.MathUtils.clamp(pitch, 0.2, 1.46);
    droneControlRef.current.goalPitch = clamped;
    setDroneTelemetry((prev) => ({
      ...prev,
      pitchDeg: Math.round(THREE.MathUtils.radToDeg(clamped)),
    }));
  }, []);

  const handleToggleDroneAutoOrbit = useCallback(() => {
    setDroneAutoOrbit((prev) => {
      const next = !prev;
      droneControlRef.current.autoOrbit = next;
      return next;
    });
  }, []);

  const handleWorldReady = useCallback(() => {
    setWorldReady(true);
  }, []);

  const anyModalOpen =
    decorationMode ||
    warungOpen ||
    jobsOpen ||
    profileOpen ||
    clinicOpen ||
    courseOpen ||
    trainOpen ||
    houseSearchOpen ||
    myPropertyOpen ||
    offersOpen ||
    furnitureModal.open ||
    Boolean(detailPropertyId) ||
    Boolean(homelessSleepTarget) ||
    bankModal.open ||
    businessModal.open ||
    Boolean(shopBusinessId) ||
    wholesaleModal.open ||
    marketplaceOpen ||
    auctionOpen ||
    economyOpen ||
    lawOpen ||
    policeOpen ||
    Boolean(npcDialogId) ||
    questsOpen ||
    mortgageSecurityModal.open ||
    landConstructionModal.open ||
    agentDeveloperModal.open ||
    dealerModal.open ||
    spbuOpen ||
    workshopModal.open ||
    samsatSimOpen ||
    garageOpen ||
    settingsOpen;

  const canUseDrone =
    Boolean(character) &&
    !interiorState &&
    !businessSession &&
    !character?.activeTrip &&
    !character?.activeSleep;

  useEffect(() => {
    if (droneMode && !canUseDrone) {
      setDroneMode(false);
    }
  }, [droneMode, canUseDrone]);

  useEffect(() => {
    if (!character || anyModalOpen || !canUseDrone) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyV') {
        handleToggleDroneMode();
      } else if (e.code === 'Escape' && droneMode) {
        setDroneMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [character, anyModalOpen, canUseDrone, droneMode, handleToggleDroneMode]);

  const currentPlayerPos = {
    x: playerPosRef.current.x,
    z: playerPosRef.current.z,
  };
  const currentZoneId = (character?.currentZone || 'cicalengka') as ZoneId;
  const activeDriveVehicle = useMemo<ActiveDriveVehicle | null>(() => {
    if (
      !character ||
      interiorState ||
      businessSession ||
      character.activeTrip ||
      character.activeSleep
    ) {
      return null;
    }
    const vehCfg = getDefaultVehicleConfig();
    if (
      vehicleTestDrive &&
      vehicleTestDrive.status === 'active' &&
      serverNow < vehicleTestDrive.expiresAtMs &&
      (vehicleTestDrive.zone || 'cicalengka') === currentZoneId
    ) {
      const model = getVehicleModelById(vehicleTestDrive.modelId, vehCfg.vehicles);
      const dealerDef = vehCfg.dealer.dealers.find((d) => d.id === vehicleTestDrive.dealerId);
      const dealerLotId = dealerDef?.lotId || 'dealer_motor_baru';
      const anchor = findLotPlacement(dealerLotId)?.door ?? { x: -32, z: -20 };
      if (model) {
        return {
          mode: 'test_drive',
          vehicleId: `td_${character.uid}`,
          modelId: model.id,
          name: `${model.name} (Uji Coba)`,
          plateNumber: 'D TEST XX',
          category: model.category,
          color: vehicleTestDrive.color || model.colors[0] || '#1E293B',
          isElectric: Boolean(model.isElectric),
          fuel: model.tankCapacity,
          fuelCapacity: model.tankCapacity,
          condition: 100,
          odometerKm: 0,
          accessories: [],
          spawnPos: { x: anchor.x, y: 0.1, z: anchor.z, rotY: 0 },
          testDriveAnchor: {
            x: anchor.x,
            z: anchor.z,
            expiresAtMs: vehicleTestDrive.expiresAtMs,
            maxRadiusMeters: vehCfg.dealer.testDrive.maxRadiusMeters,
          },
        };
      }
    }

    const ownedDriving = vehicles.find(
      (v) =>
        v.status === 'driving' &&
        v.driverId === character.uid &&
        (v.parkedPos?.zone || 'cicalengka') === currentZoneId
    );
    if (!ownedDriving) return null;

    // Anti-duplikasi single-client: jangan kendalikan jika tab/sesi lain sedang aktif mengemudikannya di RTDB
    const liveRtdb = rtdbVehiclesMap[ownedDriving.id];
    if (
      liveRtdb &&
      liveRtdb.driverId === character.uid &&
      liveRtdb.sessionId &&
      liveRtdb.sessionId !== tabSessionId &&
      serverNow - (liveRtdb.updatedAt || 0) < 15_000
    ) {
      return null;
    }

    const model = getVehicleModelById(ownedDriving.modelId, vehCfg.vehicles);
    return {
      mode: 'owned',
      vehicleId: ownedDriving.id,
      modelId: ownedDriving.modelId,
      name: ownedDriving.name,
      plateNumber: ownedDriving.plateNumber,
      category: ownedDriving.category,
      color: ownedDriving.color,
      isElectric: Boolean(ownedDriving.isElectric ?? model?.isElectric),
      fuel: ownedDriving.fuel,
      fuelCapacity: ownedDriving.fuelCapacity,
      condition: ownedDriving.condition,
      odometerKm: ownedDriving.odometerKm,
      accessories: ownedDriving.accessories ?? [],
      spawnPos: {
        x: ownedDriving.parkedPos?.x ?? currentPlayerPos.x,
        y: Math.max(0.1, ownedDriving.parkedPos?.y ?? 0.1),
        z: ownedDriving.parkedPos?.z ?? currentPlayerPos.z,
        rotY: ownedDriving.parkedPos?.rotY ?? 0,
      },
    };
  }, [
    businessSession,
    character,
    currentPlayerPos.x,
    currentPlayerPos.z,
    currentZoneId,
    interiorState,
    rtdbVehiclesMap,
    serverNow,
    tabSessionId,
    vehicleTestDrive,
    vehicles,
  ]);

  const activePassengerVehicle = useMemo<RTDBVehicle | null>(() => {
    if (
      !character ||
      activeDriveVehicle ||
      interiorState ||
      businessSession ||
      character.activeTrip ||
      character.activeSleep
    ) {
      return null;
    }
    const targetId = character.passengerVehicleId;
    if (!targetId) return null;
    const rv = rtdbVehiclesMap[targetId];
    if (!rv || !rv.passengers || !rv.passengers[character.uid]) {
      return null;
    }
    return rv;
  }, [activeDriveVehicle, businessSession, character, interiorState, rtdbVehiclesMap]);

  const vehicleNotifications = useMemo(() => {
    if (!character) return [];
    const liveVehicles =
      activeDriveVehicle && drivingTelemetry && activeDriveVehicle.mode === 'owned'
        ? vehicles.map((v) =>
            v.id === activeDriveVehicle.vehicleId
              ? { ...v, fuel: drivingTelemetry.fuel, condition: drivingTelemetry.condition }
              : v
          )
        : vehicles;
    return computeVehicleNotifications({
      vehicles: liveVehicles,
      vehicleLeases,
      bills,
      nowMs: serverNow,
      cfg: getDefaultVehicleConfig().vehicles,
    });
  }, [activeDriveVehicle, bills, character, drivingTelemetry, serverNow, vehicleLeases, vehicles]);

  const seenVehicleNotifIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!character) {
      seenVehicleNotifIdsRef.current.clear();
      return;
    }
    const activeIds = new Set(vehicleNotifications.map((n) => n.id));
    for (const prevId of Array.from(seenVehicleNotifIdsRef.current)) {
      if (!activeIds.has(prevId)) {
        seenVehicleNotifIdsRef.current.delete(prevId);
      }
    }
    for (const notif of vehicleNotifications) {
      if (!seenVehicleNotifIdsRef.current.has(notif.id)) {
        seenVehicleNotifIdsRef.current.add(notif.id);
        showToast(`${notif.title} — ${notif.detail}`);
        break;
      }
    }
  }, [character, showToast, vehicleNotifications]);

  if (!authReady) {
    return <LoadingScreen progress={30} label="Memeriksa sesi akun..." />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (charLoading) {
    return <LoadingScreen progress={60} label="Memuat data karakter..." />;
  }

  if (!character) {
    return <CharacterCreator />;
  }

  const mergedBubbles = localBubble
    ? { ...localBubbles, [character.uid]: localBubble }
    : localBubbles;
  const unpaidBillsCount = bills.filter((b) => b.status !== 'paid').length;
  const housingNotifCount =
    offers.filter(
      (o) =>
        serverNow <= o.expiresAtMs &&
        ((o.ownerId === character.uid && o.status === 'pending') ||
          (o.buyerId === character.uid && o.status === 'countered'))
    ).length +
    leases.filter(
      (l) =>
        l.status === 'active' &&
        (l.pendingInviteUids?.includes(character.uid) ||
          l.pendingInvites?.some((p) => p.uid === character.uid))
    ).length;

  const homeProperty = character.currentHomeId
    ? properties.find((p) => p.id === character.currentHomeId) ?? null
    : null;
  const activeLease = character.activeLeaseId
    ? leases.find((l) => l.id === character.activeLeaseId && l.status === 'active') ?? null
    : null;
  const detailProperty = detailPropertyId
    ? properties.find((p) => p.id === detailPropertyId) ?? null
    : null;
  const detailListing = detailProperty
    ? listings.find((l) => l.propertyId === detailProperty.id && l.status === 'active') ?? null
    : null;
  const detailAcceptedOffer = detailProperty
    ? offers.find(
        (o) =>
          o.propertyId === detailProperty.id &&
          o.buyerId === character.uid &&
          o.status === 'accepted' &&
          serverNow <= o.expiresAtMs
      ) ?? null
    : null;

  const activeShopBusiness = shopBusinessId
    ? businesses.find((b) => b.id === shopBusinessId) ?? null
    : null;
  const activeBusinessSessionDoc = businessSession
    ? businesses.find((b) => b.id === businessSession.id) ?? businessSession
    : null;

  const businessNotifCount = myBusinesses.reduce((acc, b) => {
    const lowStock = (stockByBiz[b.id] || []).some((s) => s.qty > 0 && s.qty <= 3);
    const unpaidEmp = (employeesByBiz[b.id] || []).some((e) => e.unpaidWage > 0);
    return acc + (lowStock ? 1 : 0) + (unpaidEmp ? 1 : 0);
  }, 0);

  const auctionNotifCount = auctions.filter(
    (a) =>
      a.status === 'active' &&
      (a.currentBidderId === character.uid || a.sellerId === character.uid || serverNow >= a.endsAtMs)
  ).length;

  const wantedLevel = computeLazyWantedClient(
    character.wantedLevel,
    character.wantedUpdatedAtMs,
    serverNow,
    phase6Config.law,
    gameConfig.dayDurationMs
  );
  const sentenceRemainingSec = Math.max(0, Math.ceil((activeSentenceEndsMs - serverNow) / 1000));
  const activeQuestsCount = questLogs.filter((q) => q.status === 'active').length;

  const movementLocked =
    droneMode ||
    Boolean(character.activeTrip) ||
    Boolean(character.activeSleep) ||
    Boolean(character.activeShift && !isKurirShift) ||
    anyModalOpen;

  const nearBank =
    nearbyTarget?.type === 'bank' ||
    distance2D(currentPlayerPos.x, currentPlayerPos.z, BANK_POS.x, BANK_POS.z) <=
      INTERACT_RADIUS_METERS;
  const nearAtm =
    nearBank ||
    nearbyTarget?.type === 'atm' ||
    ATM_LOCATIONS.some(
      (a) => distance2D(currentPlayerPos.x, currentPlayerPos.z, a.x, a.z) <= INTERACT_RADIUS_METERS
    );
  const nearKantorDesa =
    nearbyTarget?.type === 'kantor_desa' ||
    distance2D(currentPlayerPos.x, currentPlayerPos.z, KANTOR_DESA_POS.x, KANTOR_DESA_POS.z) <=
      INTERACT_RADIUS_METERS;
  const nearMortgageDesk = getNearestValidDestination('apply_mortgage', currentPlayerPos, {
    character,
  }).inRange;

  const displayedNearbyTarget: NearbyInteractTarget =
    !activeDriveVehicle && !activePassengerVehicle
      ? nearbyVehicle
        ? {
            type: 'vehicle_board',
            vehicleId: nearbyVehicle.vehicleId,
            label: nearbyVehicle.label,
            asPassenger: false,
          }
        : nearbyPassengerVehicle
          ? {
              type: 'vehicle_board',
              vehicleId: nearbyPassengerVehicle.vehicleId,
              label: nearbyPassengerVehicle.label,
              asPassenger: true,
            }
          : nearbyTarget
      : nearbyTarget;

  return (
    <div className="relative h-full w-full overflow-hidden touch-none select-none bg-slate-950">
      {!worldReady && <LoadingScreen progress={90} label="Membangun Kecamatan Cicalengka 3D..." />}

      <Suspense fallback={<LoadingScreen progress={85} label="Memuat mesin 3D Cicalengka..." />}>
        <GameCanvas
          character={character}
          gameConfig={gameConfig}
          trainSchedule={phase2Config.trainSchedule}
          properties={properties}
          listings={listings}
          businesses={businesses}
          landPlots={landPlots}
          constructions={constructions}
          securityInstalls={securityInstalls}
          businessSession={
            activeBusinessSessionDoc
              ? {
                  business: activeBusinessSessionDoc,
                  stock: stockByBiz[activeBusinessSessionDoc.id] || [],
                }
              : null
          }
          interiorSession={
            interiorState
              ? {
                  property: interiorState.property,
                  mode: interiorState.mode,
                  decorationMode,
                  draftFurniture,
                  selectedInstanceId: selectedFurnitureId,
                  pendingFurnitureId,
                  pendingRotation,
                  hoverCell,
                  onHoverCell: setHoverCell,
                  onSelectPlaced: (id) => {
                    setPendingFurnitureId(null);
                    setSelectedFurnitureId(id);
                  },
                  onTapGridCell: handleTapGridCell,
                }
              : null
          }
          serverOffsetMs={serverOffsetMs}
          isNight={clock.isNight}
          gameHour={clock.hour}
          weather={effectiveWeather}
          isCriticalStats={computedStats.isCritical}
          movementLocked={movementLocked}
          quality={quality}
          remotePlayers={remotePlayers}
          remoteVehicles={remoteVehicles}
          rtdbVehiclesMap={rtdbVehiclesMap}
          playerAppearances={playerAppearances}
          localBubbles={mergedBubbles}
          visitedCourierIds={visitedCourierIds}
          inputRef={inputRef}
          cameraOrbitRef={cameraOrbitRef}
          playerPosRef={playerPosRef}
          droneMode={droneMode}
          droneControlRef={droneControlRef}
          onDroneTelemetry={setDroneTelemetry}
          onVisitCourierTarget={handleVisitCourierTarget}
          onNearbyTargetChange={setNearbyTarget}
          onSyncTransform={syncTransform}
          onSyncVehicleTransform={syncVehicleTransform}
          onWorldReady={handleWorldReady}
          activeNav={activeNav}
          onAutoWalkCancel={stopAutoWalk}
          onScreenIndicatorUpdate={setOffscreenIndicator}
          vehicles={vehicles}
          activeDriveVehicle={activeDriveVehicle}
          activePassengerVehicle={activePassengerVehicle}
          vehicleHeadingRef={vehicleHeadingRef}
          vehicleSpeedRef={vehicleSpeedRef}
          vehicleHornNonce={vehicleHornNonce}
          vehicleDismountNonce={vehicleDismountNonce}
          vehicleHeadlightsManual={vehicleHeadlightsManual}
          vehicleTurnSignal={vehicleTurnSignal}
          onToggleTurnSignal={handleToggleTurnSignal}
          onPedestrianCollision={(info) => void handlePedestrianCollision(info)}
          onNearbyVehicleChange={setNearbyVehicle}
          onNearbyPassengerTargetChange={setNearbyPassengerVehicle}
          onDismountPassenger={() => void handleDismountPassenger()}
          onDrivingTelemetry={setDrivingTelemetry}
          onExitVehicle={handleExitVehicle}
          onNotify={showToast}
        />
      </Suspense>

      {droneMode ? (
        <DroneHUD
          zone={character.currentZone || 'cicalengka'}
          clock={clock}
          telemetry={droneTelemetry}
          autoOrbit={droneAutoOrbit}
          activePresetId={dronePresetId}
          playerPos={currentPlayerPos}
          onSelectPreset={handleSelectDronePreset}
          onChangeAltitude={handleChangeDroneAltitude}
          onSetPitch={handleSetDronePitch}
          onToggleAutoOrbit={handleToggleDroneAutoOrbit}
          onExit={() => setDroneMode(false)}
        />
      ) : (
        <GameHUD
          character={character}
          stats={computedStats}
          clock={clock}
          serverNowMs={serverNow}
          onlineCount={onlineCount}
          unpaidBillsCount={unpaidBillsCount}
          housingNotifCount={housingNotifCount}
          businessNotifCount={businessNotifCount}
          auctionNotifCount={auctionNotifCount}
          wantedLevel={wantedLevel}
          isJailed={isJailed}
          sentenceRemainingSec={sentenceRemainingSec}
          activeQuestsCount={activeQuestsCount}
          menuDistances={menuDistances}
          canUseDrone={canUseDrone}
          anyModalOpen={anyModalOpen}
          onToggleDrone={handleToggleDroneMode}
          onOpenJobs={() => openJobsGated(null)}
          onOpenProfileFinance={(tab = 'profile') => {
            setProfileTab(tab);
            setProfileOpen(true);
          }}
          onOpenTrain={() => openTrainGated(null)}
          onOpenCourses={openCoursesGated}
          onOpenClinic={() => openClinicGated(null)}
          onOpenHouseSearch={() => setHouseSearchOpen(true)}
          onOpenMyProperty={() => setMyPropertyOpen(true)}
          onOpenOffers={() => setOffersOpen(true)}
          onOpenBank={() => openBankGated(false)}
          onOpenBusiness={() => openBusinessGated()}
          onOpenMarketplace={() => setMarketplaceOpen(true)}
          onOpenAuction={openAuctionGated}
          onOpenEconomy={() => setEconomyOpen(true)}
          onOpenLaw={openLawGated}
          onOpenPolice={() => setPoliceOpen(true)}
          onOpenQuests={() => setQuestsOpen(true)}
          onOpenMortgageSecurity={() => setMortgageSecurityModal({ open: true, tab: 'mortgage' })}
          onOpenLandConstruction={() =>
            setLandConstructionModal({ open: true, tab: 'land', plotId: null })
          }
          onOpenAgentDeveloper={() => openAgentGated('agent')}
          ownedVehiclesCount={vehicles.length}
          vehicleNotifCount={vehicleNotifications.length}
          onOpenVehiclesGarage={() => setGarageOpen(true)}
          onOpenDealer={() => openDealerGated(null)}
          onOpenSpbu={openSpbuGated}
          onOpenWorkshop={() => openWorkshopGated(null)}
          onOpenSamsatSim={openSamsatSimGated}
          onWakeSleep={() => void handleWakeSleep()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {!droneMode &&
        !interiorState &&
        !businessSession &&
        !character.activeTrip &&
        !character.activeSleep &&
        !decorationMode && (
          <>
            <NavigationMinimap
              currentZone={(character.currentZone || 'cicalengka') as ZoneId}
              playerPos={currentPlayerPos}
              activeNav={activeNav}
              offscreenIndicator={offscreenIndicator}
              drivingMode={Boolean(activeDriveVehicle)}
              vehicles={vehicles}
            />
            {!anyModalOpen && (
              <DestinationGuideCard
                pendingPrompt={pendingPrompt}
                activeNav={activeNav}
                activeDistanceMeters={activeNavDistanceMeters}
                activeEtaSeconds={activeNavEtaSeconds}
                onSelectDestination={selectPromptDestination}
                onShowDirection={() => startGuidance(false)}
                onStartAutoWalk={() => startGuidance(true)}
                onToggleAutoWalk={toggleAutoWalk}
                onCancelPrompt={cancelPrompt}
                onCancelNav={cancelNavigation}
              />
            )}
          </>
        )}

      {/* Banner Interior Saat di Dalam Rumah / Survei */}
      {interiorState && !decorationMode && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-100 shadow-xl ${
            isMobileLandscape
              ? 'top-[56px] max-w-[calc(100vw-13rem)]'
              : isCompactHud
                ? 'top-[68px] max-w-[calc(100vw-7.5rem)]'
                : 'top-[102px] xl:top-3 gap-2 max-w-[calc(100vw-2rem)]'
          }`}
        >
          <span className="font-bold text-emerald-300">
            {interiorState.mode === 'preview' ? 'Mode Survei:' : 'Di Dalam:'}
          </span>
          <span className={`font-semibold truncate ${isCompactHud ? 'max-w-[140px]' : ''}`}>
            {interiorState.property.name}
          </span>
          {interiorState.mode === 'resident' && (
            <button
              type="button"
              onClick={handleOpenDecorationMode}
              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
            >
              Dekorasi
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleExitInterior()}
            className="rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-700"
          >
            Keluar
          </button>
        </div>
      )}

      {/* Banner Saat di Dalam Interior Bisnis 3D */}
      {activeBusinessSessionDoc && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-amber-500/50 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-100 shadow-xl ${
            isMobileLandscape
              ? 'top-[56px] max-w-[calc(100vw-13rem)]'
              : isCompactHud
                ? 'top-[68px] max-w-[calc(100vw-7.5rem)]'
                : 'top-[102px] xl:top-3 gap-2 max-w-[calc(100vw-2rem)]'
          }`}
        >
          <span className="font-bold text-amber-300">Toko:</span>
          <span className="font-semibold truncate max-w-[140px]">{activeBusinessSessionDoc.name}</span>
          <button
            type="button"
            onClick={() => setShopBusinessId(activeBusinessSessionDoc.id)}
            className="rounded-lg bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-sky-400"
          >
            Kasir
          </button>
          {activeBusinessSessionDoc.ownerId === character.uid && (
            <button
              type="button"
              onClick={() =>
                setBusinessModal({
                  open: true,
                  view: 'manage',
                  businessId: activeBusinessSessionDoc.id,
                })
              }
              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
            >
              Kelola
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setBusinessSession(null);
              setNearbyTarget(null);
            }}
            className="rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-700"
          >
            Keluar
          </button>
        </div>
      )}

      {interiorState && decorationMode && (
        <DecorationDockHUD
          propertyName={interiorState.property.name}
          draftFurniture={draftFurniture}
          inventory={inventory}
          selectedInstanceId={selectedFurnitureId}
          pendingFurnitureId={pendingFurnitureId}
          pendingRotation={pendingRotation}
          saving={savingDecoration}
          onSelectPendingFurniture={(fid) => {
            setSelectedFurnitureId(null);
            setPendingFurnitureId(fid);
          }}
          onRotate={handleRotateDeco}
          onNudgeSelected={handleNudgeSelected}
          onRemoveSelected={handleRemoveSelected}
          onCancel={() => {
            setDecorationMode(false);
            setSelectedFurnitureId(null);
            setPendingFurnitureId(null);
          }}
          onSave={() => void handleSaveDecoration()}
        />
      )}

      {!character.activeTrip && !character.activeSleep && !decorationMode && (
        <>
          <MobileControls
            inputRef={inputRef}
            onZoomStep={handleZoomStep}
            hideZoom={droneMode}
            drivingMode={Boolean(activeDriveVehicle) && !droneMode && !anyModalOpen}
            isHeadlightsOn={
              vehicleHeadlightsManual !== null ? vehicleHeadlightsManual : clock.isNight
            }
            turnSignal={vehicleTurnSignal}
            onToggleTurnSignal={handleToggleTurnSignal}
            onHorn={() => setVehicleHornNonce((n) => n + 1)}
            onToggleHeadlights={() =>
              setVehicleHeadlightsManual((prev) => !(prev !== null ? prev : clock.isNight))
            }
            onDismount={() => {
              if (!activeDriveVehicle) return;
              setVehicleDismountNonce((n) => n + 1);
            }}
          />
          {!droneMode && !activeDriveVehicle && !activePassengerVehicle && (
            <ActionButton
              target={displayedNearbyTarget}
              busy={actionBusy}
              onTrigger={() => void handleActionTrigger()}
              onBathAtKontrakan={() => void handleBathAction()}
            />
          )}
          {!droneMode && !anyModalOpen && activePassengerVehicle && (
            <div
              className={`fixed z-20 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-sky-400/50 bg-[#161E38]/90 px-4 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur-md ${
                isMobileLandscape ? 'bottom-3' : isCompactHud ? 'bottom-[104px]' : 'bottom-5'
              }`}
            >
              <div>
                <div className="font-bold text-sky-300">
                  Menumpang · {activePassengerVehicle.plateNumber}
                </div>
                <div className="text-[11px] text-slate-300">
                  Pengemudi:{' '}
                  {activePassengerVehicle.driverName ||
                    (activePassengerVehicle.driverId
                      ? playerAppearances[activePassengerVehicle.driverId]?.name
                      : undefined) ||
                    'Warga'}
                </div>
              </div>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleDismountPassenger()}
                className="rounded-lg bg-[#EC7C70] px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-[#F28C80] disabled:opacity-60"
              >
                {actionBusy ? 'Proses...' : 'Turun (F)'}
              </button>
            </div>
          )}
          {!droneMode && !anyModalOpen && activeDriveVehicle && drivingTelemetry && (
            <DrivingMiniHud
              telemetry={drivingTelemetry}
              isHeadlightsOn={
                vehicleHeadlightsManual !== null ? vehicleHeadlightsManual : clock.isNight
              }
              onHorn={() => setVehicleHornNonce((n) => n + 1)}
              onToggleHeadlights={() =>
                setVehicleHeadlightsManual((prev) => !(prev !== null ? prev : clock.isNight))
              }
              onToggleTurnSignal={handleToggleTurnSignal}
              onBrakeChange={(held) => {
                inputRef.current.driveBrake = held ? 1 : 0;
              }}
              onDismount={() => {
                setVehicleDismountNonce((n) => n + 1);
              }}
            />
          )}
        </>
      )}

      {!droneMode && (
        <ChatBox
          isAuthenticated={Boolean(user)}
          characterName={character.name}
          drivingMode={Boolean(activeDriveVehicle)}
          onLocalBubble={setLocalBubble}
          onNotify={showToast}
        />
      )}

      <WarungModal
        open={warungOpen}
        money={character.money}
        onClose={() => {
          setWarungOpen(false);
          clearOpenGatedModal('warung');
        }}
        onNotify={showToast}
      />

      <JobsModal
        open={jobsOpen}
        character={character}
        jobs={phase2Config.jobs}
        vehicles={vehicles}
        serverNowMs={serverNow}
        businessJobPosts={businessJobPostsList}
        businesses={businesses}
        properties={properties}
        playerPos={currentPlayerPos}
        highlightJobId={highlightJobId}
        onGuideToJob={(jobId) => {
          clearOpenGatedModal('jobs');
          openJobsGated(jobId);
        }}
        onClose={() => {
          setJobsOpen(false);
          clearOpenGatedModal('jobs');
        }}
        onNotify={showToast}
      />

      <JobMiniGameModal
        activeShift={character.activeShift}
        serverNowMs={serverNow}
        visitedCourierIds={visitedCourierIds}
        activeDriveVehicle={activeDriveVehicle}
        onShiftFinished={() => setVisitedCourierIds([])}
        onNotify={showToast}
      />

      <ProfileFinanceModal
        open={profileOpen}
        initialTab={profileTab}
        character={character}
        bills={bills}
        transactions={transactions}
        homeProperty={homeProperty}
        activeLease={activeLease}
        serverNowMs={serverNow}
        onBillsUpdated={(nextBills) => {
          if (!simState.active) setFsBills(nextBills);
        }}
        onClose={() => setProfileOpen(false)}
        onNotify={showToast}
      />

      <ClinicModal
        open={clinicOpen}
        character={character}
        clinics={phase2Config.clinics}
        initialClinicId={selectedClinicId}
        playerPos={currentPlayerPos}
        serverNowMs={serverNow}
        onGuideToClinic={(clinicId) => {
          clearOpenGatedModal('clinic');
          openClinicGated(clinicId);
        }}
        onClose={() => {
          setClinicOpen(false);
          clearOpenGatedModal('clinic');
        }}
        onNotify={showToast}
      />

      <CourseModal
        open={courseOpen}
        character={character}
        courses={phase2Config.courses}
        serverNowMs={serverNow}
        onClose={() => {
          setCourseOpen(false);
          clearOpenGatedModal('courses');
        }}
        onNotify={showToast}
      />

      <TrainModal
        open={trainOpen}
        character={character}
        schedule={phase2Config.trainSchedule}
        epochMs={gameConfig.epochMs}
        serverNowMs={serverNow}
        serverOffsetMs={serverOffsetMs}
        nearStation={nearbyTarget?.type === 'station'}
        initialDestination={trainPreselectZone}
        onClose={() => {
          setTrainOpen(false);
          setTrainPreselectZone(null);
          clearOpenGatedModal('train');
        }}
        onNotify={showToast}
      />

      {/* Modals Fase 3 */}
      <HouseSearchModal
        open={houseSearchOpen}
        playerPos={currentPlayerPos}
        properties={properties}
        localListings={listings}
        onSelectProperty={(prop) => {
          setHouseSearchOpen(false);
          setDetailPropertyId(prop.id);
        }}
        onClose={() => setHouseSearchOpen(false)}
        onNotify={showToast}
      />

      <PropertyDetailModal
        open={Boolean(detailProperty)}
        property={detailProperty}
        listing={detailListing}
        character={character}
        housingConfig={phase2Config.housing}
        playerPos={currentPlayerPos}
        acceptedOffer={detailAcceptedOffer}
        onEnterInterior={(prop, mode) => {
          setInteriorState({ property: prop, mode });
          setDecorationMode(false);
          setNearbyTarget(null);
          clearOpenGatedModal('property_detail');
        }}
        onGuideToProperty={(prop, action) => {
          clearOpenGatedModal('property_detail');
          openPropertyGate(prop, action);
        }}
        onClose={() => {
          setDetailPropertyId(null);
          clearOpenGatedModal('property_detail');
        }}
        onNotify={showToast}
      />

      <MyPropertyModal
        open={myPropertyOpen}
        character={character}
        properties={properties}
        listings={listings}
        leases={leases}
        transactions={transactions}
        housingConfig={phase2Config.housing}
        serverNowMs={serverNow}
        onInspectProperty={(prop) => setDetailPropertyId(prop.id)}
        onOpenSearch={() => setHouseSearchOpen(true)}
        onClose={() => setMyPropertyOpen(false)}
        onNotify={showToast}
      />

      <OffersModal
        open={offersOpen}
        character={character}
        offers={offers}
        leases={leases}
        properties={properties}
        serverNowMs={serverNow}
        onProceedToProperty={(prop) => setDetailPropertyId(prop.id)}
        onClose={() => setOffersOpen(false)}
        onNotify={showToast}
      />

      <FurnitureShopModal
        open={furnitureModal.open}
        initialTab={furnitureModal.tab}
        character={character}
        inventory={inventory}
        playerPos={currentPlayerPos}
        insidePropertyId={interiorState?.property.id ?? null}
        onOpenFurnitureSets={() =>
          setAgentDeveloperModal({ open: true, tab: 'furniture_sets' })
        }
        onClose={() => {
          setFurnitureModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('furniture_shop');
        }}
        onNotify={showToast}
      />

      <HomelessSleepModal
        open={Boolean(homelessSleepTarget)}
        mode={homelessSleepTarget?.mode ?? 'emperan'}
        spotId={homelessSleepTarget?.spotId}
        spotLabel={homelessSleepTarget?.label ?? 'Emperan'}
        character={character}
        clock={clock}
        housingConfig={phase2Config.housing}
        onOpenSearch={() => setHouseSearchOpen(true)}
        onClose={() => {
          setHomelessSleepTarget(null);
          clearOpenGatedModal('homeless_sleep');
        }}
        onNotify={showToast}
      />

      {/* Modals Fase 4: Bank, Bisnis, Etalase Kasir, Pasar Grosir, Marketplace, Lelang, Ekonomi */}
      <BankModal
        open={bankModal.open}
        initialMode={bankModal.mode}
        character={character}
        bankAccount={bankAccount}
        loans={loans}
        bankConfig={phase4Config.bank}
        nearBank={nearBank}
        nearAtm={nearAtm}
        onOpenMortgage={() => {
          clearOpenGatedModal('bank');
          setMortgageSecurityModal({ open: true, tab: 'mortgage' });
        }}
        onClose={() => {
          setBankModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('bank');
        }}
        onNotify={showToast}
      />

      <BusinessModal
        open={businessModal.open}
        initialView={businessModal.view}
        initialBusinessId={businessModal.businessId}
        character={character}
        myBusinesses={myBusinesses}
        properties={properties}
        stockByBiz={stockByBiz}
        employeesByBiz={employeesByBiz}
        reportsByBiz={reportsByBiz}
        businessConfig={phase4Config.business}
        productsConfig={phase4Config.products}
        taxConfig={phase4Config.tax}
        vehicles={vehicles}
        vehicleListings={vehicleListings}
        nearKantorDesa={nearKantorDesa}
        serverNowMs={serverNow}
        onGuideToKantorDesa={() => {
          clearOpenGatedModal('business');
          openBusinessGated({ view: 'create', forceKantorDesa: true });
        }}
        onOpenWholesale={(bizId) => {
          setBusinessModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('business');
          openWholesaleGated(bizId);
        }}
        onOpenWorkshop={(bizId) => {
          setBusinessModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('business');
          openWorkshopGated(bizId);
        }}
        onOpenDealerBursa={() => {
          setBusinessModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('business');
          setDealerModal({ open: true, dealerId: 'bursa_p2p' });
        }}
        onEnterBusiness3D={(biz) => {
          setBusinessModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('business');
          setInteriorState(null);
          setBusinessSession(biz);
          setNearbyTarget(null);
        }}
        onClose={() => {
          setBusinessModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('business');
        }}
        onNotify={showToast}
      />

      <BusinessShopModal
        open={Boolean(activeShopBusiness)}
        business={activeShopBusiness}
        stock={activeShopBusiness ? stockByBiz[activeShopBusiness.id] || [] : []}
        character={character}
        productsConfig={phase4Config.products}
        inside3D={Boolean(activeBusinessSessionDoc && activeShopBusiness && activeBusinessSessionDoc.id === activeShopBusiness.id)}
        onEnter3D={(biz) => {
          setShopBusinessId(null);
          clearOpenGatedModal('business_shop');
          setInteriorState(null);
          setBusinessSession(biz);
          setNearbyTarget(null);
        }}
        onOpenManage={(biz) => {
          setShopBusinessId(null);
          clearOpenGatedModal('business_shop');
          openBusinessGated({ view: 'manage', businessId: biz.id });
        }}
        onOpenWorkshop={(bizId) => {
          setShopBusinessId(null);
          clearOpenGatedModal('business_shop');
          setWorkshopModal({ open: true, businessId: bizId });
        }}
        onOpenDealerBursa={() => {
          setShopBusinessId(null);
          clearOpenGatedModal('business_shop');
          setDealerModal({ open: true, dealerId: 'bursa_p2p' });
        }}
        onClose={() => {
          setShopBusinessId(null);
          clearOpenGatedModal('business_shop');
        }}
        onNotify={showToast}
      />

      <WholesaleMarketModal
        open={wholesaleModal.open}
        initialBusinessId={wholesaleModal.businessId}
        character={character}
        myBusinesses={myBusinesses}
        marketStats={marketStats}
        productsConfig={phase4Config.products}
        vehicles={vehicles}
        onOpenCreateBusiness={() => {
          setWholesaleModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('wholesale');
          openBusinessGated({ view: 'create', forceKantorDesa: true });
        }}
        onClose={() => {
          setWholesaleModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('wholesale');
        }}
        onNotify={showToast}
      />

      <MarketplaceModal
        open={marketplaceOpen}
        character={character}
        inventory={inventory}
        localListings={simState.marketListings}
        marketStats={marketStats}
        taxConfig={phase4Config.tax}
        vehicles={vehicles}
        vehicleListings={vehicleListings}
        businesses={businesses}
        serverNowMs={serverNow}
        onClose={() => setMarketplaceOpen(false)}
        onNotify={showToast}
      />

      <AuctionModal
        open={auctionOpen}
        character={character}
        bankAccount={bankAccount}
        auctions={auctions}
        inventory={inventory}
        properties={properties}
        myBusinesses={myBusinesses}
        taxConfig={phase4Config.tax}
        serverNowMs={serverNow}
        onClose={() => {
          setAuctionOpen(false);
          clearOpenGatedModal('auction');
        }}
        onNotify={showToast}
      />

      <EconomyMonitorModal
        open={economyOpen}
        marketStats={marketStats}
        treasury={treasury}
        taxConfig={phase4Config.tax}
        serverNowMs={serverNow}
        onClose={() => setEconomyOpen(false)}
        onNotify={showToast}
      />

      {/* Modals Fase 6: Hukum, Polisi, Dialog NPC AI, Quest, KPR & Keamanan, Tanah & Pembangunan, Agen & Developer */}
      <LawJusticeModal
        open={lawOpen}
        character={character}
        bankAccount={bankAccount}
        crimeRecords={crimeRecords}
        sentence={sentence}
        lawConfig={phase6Config.law}
        dayDurationMs={gameConfig.dayDurationMs}
        serverNowMs={serverNow}
        playerPos={currentPlayerPos}
        properties={properties}
        businesses={businesses}
        remotePlayers={remotePlayers}
        isNight={clock.isNight}
        onOpenPoliceHub={() => setPoliceOpen(true)}
        onClose={() => {
          setLawOpen(false);
          clearOpenGatedModal('law');
        }}
        onNotify={showToast}
      />

      <PoliceModal
        open={policeOpen}
        character={character}
        lawConfig={phase6Config.law}
        remotePlayers={remotePlayers}
        crimeRecords={crimeRecords}
        activeSentences={activeSentences}
        policeActions={policeActions}
        playerPos={currentPlayerPos}
        serverNowMs={serverNow}
        onOpenJobsModal={() => openJobsGated('polisi')}
        onClose={() => setPoliceOpen(false)}
        onNotify={showToast}
      />

      <NpcDialogModal
        open={Boolean(npcDialogId)}
        npcId={npcDialogId}
        character={character}
        npcsConfig={phase6Config.npcs}
        aiConfig={phase6Config.ai}
        questLogs={questLogs}
        playerPos={currentPlayerPos}
        serverNowMs={serverNow}
        onNavigateHint={(uiHint) => {
          if (uiHint === 'law_panel') openLawGated();
          else if (uiHint === 'agent_panel') openAgentGated('agent');
          else if (uiHint === 'mortgage_panel')
            setMortgageSecurityModal({ open: true, tab: 'mortgage' });
          else if (uiHint === 'land_panel')
            setLandConstructionModal({ open: true, tab: 'land', plotId: null });
          else if (uiHint === 'construction_panel')
            setLandConstructionModal({ open: true, tab: 'build', plotId: null });
        }}
        onClose={() => {
          setNpcDialogId(null);
          clearOpenGatedModal('npc');
        }}
        onNotify={showToast}
      />

      <QuestsModal
        open={questsOpen}
        character={character}
        questsConfig={phase6Config.quests}
        questTemplates={fsQuestTemplates}
        questLogs={questLogs}
        npcsConfig={phase6Config.npcs}
        playerPos={currentPlayerPos}
        serverNowMs={serverNow}
        onTalkToNpc={(nid) => openNpcGated(nid)}
        onClose={() => setQuestsOpen(false)}
        onNotify={showToast}
      />

      <MortgageSecurityModal
        open={mortgageSecurityModal.open}
        initialTab={mortgageSecurityModal.tab}
        character={character}
        bankAccount={bankAccount}
        mortgages={mortgages}
        mortgageConfig={phase6Config.mortgage}
        lawConfig={phase6Config.law}
        dayDurationMs={gameConfig.dayDurationMs}
        properties={properties}
        listings={listings}
        offers={offers}
        businesses={businesses}
        securityInstalls={securityInstalls}
        insurancePolicies={insurancePolicies}
        insuranceClaims={insuranceClaims}
        crimeRecords={crimeRecords}
        serverNowMs={serverNow}
        nearMortgageDesk={nearMortgageDesk}
        onGuideToMortgageDesk={openMortgageDeskGated}
        onOpenBank={() => openBankGated(true)}
        onClose={() => {
          setMortgageSecurityModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('apply_mortgage');
        }}
        onNotify={showToast}
      />

      <LandConstructionModal
        open={landConstructionModal.open}
        initialTab={landConstructionModal.tab}
        initialPlotId={landConstructionModal.plotId}
        character={character}
        bankAccount={bankAccount}
        landPlots={landPlots}
        constructions={constructions}
        devProjects={devProjects}
        inventory={inventory}
        landConfig={phase6Config.land}
        constructionConfig={phase6Config.construction}
        playerPos={currentPlayerPos}
        serverNowMs={serverNow}
        nearKantorDesa={nearKantorDesa}
        onGuideToPlot={(plot) => openLandBuyGated(plot)}
        onGuideToImbDesk={(plot) => openImbGated(plot)}
        onClose={() => {
          setLandConstructionModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('land_buy');
          clearOpenGatedModal('apply_imb');
        }}
        onNotify={showToast}
      />

      <AgentDeveloperModal
        open={agentDeveloperModal.open}
        initialTab={agentDeveloperModal.tab}
        character={character}
        bankAccount={bankAccount}
        constructionConfig={phase6Config.construction}
        lawConfig={phase6Config.law}
        dayDurationMs={gameConfig.dayDurationMs}
        listings={listings}
        properties={properties}
        landPlots={landPlots}
        agentClients={agentClients}
        devProjects={devProjects}
        renovations={renovations}
        inventory={inventory}
        playerPos={currentPlayerPos}
        serverNowMs={serverNow}
        onGuideToTokoMebel={() => openTokoMebelGated('shop')}
        onClose={() => {
          setAgentDeveloperModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('agent');
        }}
        onNotify={showToast}
      />

      {/* Modals Sistem Kendaraan */}
      <VehicleDealerModal
        open={dealerModal.open}
        initialDealerId={dealerModal.dealerId}
        character={character}
        bankAccount={bankAccount}
        vehicles={vehicles}
        vehicleListings={vehicleListings}
        businesses={businesses}
        playerPos={currentPlayerPos}
        serverNowMs={serverNow}
        onGuideToDealer={(dealerId) => {
          clearOpenGatedModal('dealer');
          openDealerGated(dealerId);
        }}
        onClose={() => {
          setDealerModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('dealer');
        }}
        onNotify={showToast}
      />

      <SpbuModal
        open={spbuOpen}
        character={character}
        vehicles={vehicles}
        onClose={() => {
          setSpbuOpen(false);
          clearOpenGatedModal('spbu');
        }}
        onNotify={showToast}
      />

      <WorkshopModal
        open={workshopModal.open}
        initialBusinessId={workshopModal.businessId}
        character={character}
        vehicles={vehicles}
        businesses={businesses}
        onClose={() => {
          setWorkshopModal((prev) => ({ ...prev, open: false }));
          clearOpenGatedModal('workshop');
        }}
        onNotify={showToast}
      />

      <SamsatSimModal
        open={samsatSimOpen}
        character={character}
        vehicles={vehicles}
        driverLicense={driverLicense}
        serverNowMs={serverNow}
        onClose={() => {
          setSamsatSimOpen(false);
          clearOpenGatedModal('samsat_sim');
        }}
        onNotify={showToast}
      />

      <VehicleGarageModal
        open={garageOpen}
        character={character}
        vehicles={vehicles}
        vehicleLeases={vehicleLeases}
        vehicleListings={vehicleListings}
        properties={properties}
        businesses={businesses}
        driverLicense={driverLicense}
        serverNowMs={serverNow}
        notifications={vehicleNotifications}
        onGuideToFacility={(menu) => {
          if (menu === 'dealer') openDealerGated(null);
          else if (menu === 'spbu') openSpbuGated();
          else if (menu === 'workshop') openWorkshopGated(null);
          else openSamsatSimGated();
        }}
        onGuideToVehicle={(v) => {
          guideToWorldPoint({
            id: `veh_${v.id}`,
            label: `${v.name} (${v.plateNumber})`,
            subtitle: 'Lokasi Kendaraan Terparkir',
            x: v.parkedPos.x,
            z: v.parkedPos.z,
            zone: v.parkedPos.zone || 'cicalengka',
          });
        }}
        onOpenBills={() => {
          setProfileTab('bills');
          setProfileOpen(true);
        }}
        onClose={() => setGarageOpen(false)}
        onNotify={showToast}
      />

      <SettingsModal
        open={settingsOpen}
        quality={quality}
        weatherMode={weatherMode}
        onChangeQuality={setQuality}
        onChangeWeatherMode={handleChangeWeatherMode}
        onLogout={() => {
          setSettingsOpen(false);
          void signOut(auth);
        }}
        onClose={() => setSettingsOpen(false)}
      />

      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 max-w-[90vw] rounded-xl border border-emerald-500/50 bg-slate-900 px-4 py-2 text-center text-xs font-semibold text-emerald-200 shadow-2xl ${
            isMobileLandscape ? 'top-14' : isCompactHud ? 'top-20' : 'top-[106px] xl:top-16'
          }`}
        >
          {toast}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}
