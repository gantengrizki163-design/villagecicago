import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { NpcsConfigBundle } from '../../firebase/npcDeterminism';
import type {
  BusinessDoc,
  BusinessJobPostDoc,
  CharacterDoc,
  JobConfigItem,
  LandPlotDoc,
  PropertyDoc,
  ZoneId,
} from '../../types/game';
import { NAVIGATION_FEATURE_FLAGS, NAVIGATION_TUNING } from './navigationConfig';
import {
  computePathLengthMeters,
  estimateWalkTimeSeconds,
  findNavigationPath,
} from './pathfinder';
import {
  getDestinationsForMenu,
  getDistanceToDestination,
  getMenuLocationMeta,
  getNearestValidDestination,
  INTERACT_HYSTERESIS_METERS,
  isWithinDestination,
  type InteractionContext,
  type InteractionDestination,
  type InteractionMenuId,
  type WorldPoint2D,
} from './registry';

const ZONE_DISPLAY_NAMES: Record<ZoneId, string> = {
  cicalengka: 'Cicalengka',
  rancaekek: 'Rancaekek',
  bandung: 'Bandung',
  nagreg: 'Nagreg',
};

export interface PendingGatePrompt {
  menuId: InteractionMenuId;
  destinations: InteractionDestination[];
  selectedDestination: InteractionDestination;
  waypoints: WorldPoint2D[];
  distanceMeters: number;
  etaSeconds: number;
  routeNote?: string;
  crossZoneTarget?: ZoneId;
  onArrive: (dest: InteractionDestination) => void;
}

export interface ActiveNavigationState {
  menuId: InteractionMenuId;
  destination: InteractionDestination;
  waypoints: WorldPoint2D[];
  autoWalk: boolean;
  openOnArrival: boolean;
  crossZoneTarget?: ZoneId;
  routeNote?: string;
  onArrive: (dest: InteractionDestination) => void;
}

export interface OpenGatedSession {
  key: string;
  destination: InteractionDestination;
  onAutoClose: () => void;
}

export interface UseLocationGateParams {
  character: CharacterDoc | null;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  hasBankAccount: boolean;
  isJailed: boolean;
  isFaintedOrCritical?: boolean;
  insideInterior?: boolean;
  insideBusinessId?: string | null;
  activeShiftLocked?: boolean;
  jobs: JobConfigItem[];
  businessJobPosts: BusinessJobPostDoc[];
  businesses: BusinessDoc[];
  properties: PropertyDoc[];
  landPlots: LandPlotDoc[];
  npcsConfig?: NpcsConfigBundle;
  serverNowMs: number;
  gameHour: number;
  onNotify: (msg: string) => void;
  onOpenTrainForZone?: (targetZone: ZoneId) => void;
}

export interface OpenGatedMenuOptions {
  targetPropertyId?: string | null;
  targetBusinessId?: string | null;
  targetPlotId?: string | null;
  targetNpcId?: string | null;
  targetClinicId?: string | null;
  targetJobId?: string | null;
  targetSpotId?: string | null;
  targetDealerId?: string | null;
  requiresBankBranch?: boolean;
  /** Bypass gate (misal untuk klaim antrean klinik/kursus yang sudah selesai dari banner) */
  allowDirectIfClaimReady?: boolean;
  /** Paksa hanya mengarahkan jalan tanpa langsung membuka modal saat tiba */
  guideOnly?: boolean;
  /** Catatan khusus yang ditampilkan di kartu tujuan */
  routeNoteOverride?: string;
  onOpen: (ctx: { destination: InteractionDestination | null }) => void;
}

export function useLocationGate({
  character,
  playerPosRef,
  hasBankAccount,
  isJailed,
  insideInterior = false,
  insideBusinessId = null,
  activeShiftLocked = false,
  jobs,
  businessJobPosts,
  businesses,
  properties,
  landPlots,
  npcsConfig,
  serverNowMs,
  gameHour,
  onNotify,
  onOpenTrainForZone,
}: UseLocationGateParams) {
  const [pendingPrompt, setPendingPrompt] = useState<PendingGatePrompt | null>(null);
  const [activeNav, setActiveNav] = useState<ActiveNavigationState | null>(null);
  const [openGatedSession, setOpenGatedSession] = useState<OpenGatedSession | null>(null);
  const [livePosTick, setLivePosTick] = useState<WorldPoint2D>({ x: 0, z: 0 });
  const arrivalHandledRef = useRef<string | null>(null);

  const buildContext = useCallback(
    (opts?: OpenGatedMenuOptions): InteractionContext | null => {
      if (!character) return null;
      return {
        character,
        hasBankAccount,
        requiresBankBranch: opts?.requiresBankBranch,
        isJailed,
        jobs,
        businessJobPosts,
        businesses,
        properties,
        landPlots,
        npcsConfig,
        serverNowMs,
        targetPropertyId: opts?.targetPropertyId,
        targetBusinessId: opts?.targetBusinessId,
        targetPlotId: opts?.targetPlotId,
        targetNpcId: opts?.targetNpcId,
        targetClinicId: opts?.targetClinicId,
        targetJobId: opts?.targetJobId,
        targetSpotId: opts?.targetSpotId,
        targetDealerId: opts?.targetDealerId,
      };
    },
    [
      character,
      hasBankAccount,
      isJailed,
      jobs,
      businessJobPosts,
      businesses,
      properties,
      landPlots,
      npcsConfig,
      serverNowMs,
    ]
  );

  // Perbarui jarak minimap/kartu/navigasi setiap 250ms & pantau kedatangan / histeresis
  useEffect(() => {
    if (!character) return;
    const timer = window.setInterval(() => {
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      setLivePosTick((prev) =>
        Math.abs(prev.x - px) > 0.25 || Math.abs(prev.z - pz) > 0.25 ? { x: px, z: pz } : prev
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [character, playerPosRef]);

  // Pantau kedatangan tujuan navigasi aktif
  useEffect(() => {
    if (!character || !activeNav) {
      arrivalHandledRef.current = null;
      return;
    }

    const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
    const currentZone = (character.currentZone || 'cicalengka') as ZoneId;
    if (currentZone !== activeNav.destination.zone) return;

    if (isWithinDestination(pos, activeNav.destination, 0)) {
      const arrivalSignature = `${activeNav.menuId}:${activeNav.destination.id}`;
      if (arrivalHandledRef.current === arrivalSignature) return;
      arrivalHandledRef.current = arrivalSignature;

      const arrivedNav = activeNav;
      setActiveNav(null);
      onNotify(`Sudah sampai di ${arrivedNav.destination.label}!`);
      if (arrivedNav.openOnArrival) {
        arrivedNav.onArrive(arrivedNav.destination);
      }
    }
  }, [activeNav, character, livePosTick, onNotify, playerPosRef]);

  // Histeresis: tutup otomatis modal golongan A jika pemain menjauh (> radius + 2m)
  useEffect(() => {
    if (!character || !openGatedSession) return;
    if (openGatedSession.key === 'law' && isJailed) return;
    if (insideBusinessId && openGatedSession.key === 'business') return;

    const currentZone = (character.currentZone || 'cicalengka') as ZoneId;
    const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };

    const leftZone = currentZone !== openGatedSession.destination.zone;
    const walkedAway = !isWithinDestination(
      pos,
      openGatedSession.destination,
      INTERACT_HYSTERESIS_METERS
    );

    if (leftZone || walkedAway) {
      const label = openGatedSession.destination.label;
      const closeFn = openGatedSession.onAutoClose;
      setOpenGatedSession(null);
      closeFn();
      onNotify(`Kamu menjauh dari ${label}.`);
    }
  }, [character, insideBusinessId, isJailed, livePosTick, onNotify, openGatedSession, playerPosRef]);

  // Batalkan navigasi/prompt otomatis jika pemain tertahan, tidur, atau naik kereta
  useEffect(() => {
    if (!character) return;
    if (character.activeTrip || character.activeSleep || isJailed) {
      setPendingPrompt(null);
      setActiveNav(null);
    }
  }, [character, isJailed]);

  const registerOpenGatedModal = useCallback(
    (key: string, destination: InteractionDestination | null, onAutoClose: () => void) => {
      if (!destination) {
        setOpenGatedSession(null);
        return;
      }
      setOpenGatedSession({ key, destination, onAutoClose });
    },
    []
  );

  const clearOpenGatedModal = useCallback((key?: string) => {
    setOpenGatedSession((prev) => {
      if (!prev) return null;
      if (key && prev.key !== key) return prev;
      return null;
    });
  }, []);

  const openGatedMenu = useCallback(
    (menuId: InteractionMenuId, opts: OpenGatedMenuOptions) => {
      if (!character) return;

      const policy = getMenuLocationMeta(menuId);

      // 1. Cek kondisi blokir status pemain (Langkah 3 poin 5)
      if (character.activeTrip) {
        onNotify('Kamu sedang di dalam kereta api. Tunggu hingga tiba di stasiun tujuan.');
        return;
      }
      if (character.activeSleep) {
        onNotify(
          `Kamu sedang tidur di ${character.activeSleep.label}. Bangun dulu sebelum melakukan aktivitas lain.`
        );
        return;
      }
      if (isJailed && menuId !== 'law' && menuId !== 'settings' && menuId !== 'profile') {
        onNotify(
          'Kamu sedang menjalani hukuman di sel Polsek. Gunakan panel Tahanan untuk kerja sosial atau jaminan.'
        );
        return;
      }
      if (activeShiftLocked && !policy.allowRemote) {
        onNotify('Selesaikan shift kerja yang sedang berjalan terlebih dahulu.');
        return;
      }
      if (opts.allowDirectIfClaimReady) {
        opts.onOpen({ destination: null });
        return;
      }

      // Pengecualian saat berada di dalam interior rumah atau interior toko 3D
      if (insideInterior && !policy.allowRemote && menuId !== 'furniture_inventory') {
        onNotify('Keluar dari interior rumah terlebih dahulu sebelum menuju lokasi lain.');
        return;
      }
      if (
        insideBusinessId &&
        !policy.allowRemote &&
        !(
          (menuId === 'business' || menuId === 'business_shop') &&
          (!opts.targetBusinessId || opts.targetBusinessId === insideBusinessId)
        )
      ) {
        onNotify('Keluar dari interior toko terlebih dahulu untuk menuju lokasi lain.');
        return;
      }

      // Golongan B (atau tahanan membuka panel Polsek langsung)
      if (policy.allowRemote || (isJailed && menuId === 'law')) {
        opts.onOpen({ destination: null });
        return;
      }

      const ctx = buildContext(opts);
      if (!ctx) return;

      const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
      const currentZone = (character.currentZone || 'cicalengka') as ZoneId;
      const lookup = getNearestValidDestination(menuId, pos, ctx);

      // Jika sudah berada di dalam radius tujuan valid
      if (lookup.inRange && lookup.nearest && !opts.guideOnly) {
        setPendingPrompt(null);
        setActiveNav(null);
        opts.onOpen({ destination: lookup.nearest });
        return;
      }

      // Jika tujuan berada di zona lain (misal kerja pabrik Rancaekek / sekolah Bandung),
      // arahkan pemain ke Stasiun zona saat ini sebagai langkah 1 (Langkah 7)
      let targetDestinations = lookup.destinations;
      let selectedDest = lookup.nearest;
      let crossZoneTarget: ZoneId | undefined;
      let routeNote = opts.routeNoteOverride;
      let onArriveHandler = (dest: InteractionDestination) => opts.onOpen({ destination: dest });

      if (lookup.requiresTrain && lookup.nearest) {
        crossZoneTarget = lookup.targetZone;
        const trainLookup = getNearestValidDestination('train', pos, ctx);
        if (trainLookup.inRange && trainLookup.nearest && onOpenTrainForZone) {
          onNotify(
            `${lookup.nearest.label} berada di ${ZONE_DISPLAY_NAMES[crossZoneTarget]}. Naik kereta dari ${trainLookup.nearest.label}!`
          );
          onOpenTrainForZone(crossZoneTarget);
          return;
        }
        if (trainLookup.nearest) {
          targetDestinations = trainLookup.destinations;
          selectedDest = trainLookup.nearest;
          routeNote =
            routeNote ||
            `Tujuanmu (${lookup.nearest.label}) berada di ${ZONE_DISPLAY_NAMES[crossZoneTarget]}. Pergi ke ${trainLookup.nearest.label} terlebih dahulu untuk naik kereta.`;
          if (onOpenTrainForZone) {
            onArriveHandler = () => onOpenTrainForZone(crossZoneTarget!);
          }
        }
      }

      if (!selectedDest) {
        opts.onOpen({ destination: null });
        return;
      }

      // Catatan jam operasional Penampungan (20:00 - 06:00)
      if (menuId === 'penampungan' && gameHour >= 6 && gameHour < 20 && !routeNote) {
        routeNote = 'Catatan: Penampungan sosial hanya menerima tidur malam pukul 20:00 – 06:00.';
      }

      const waypoints = findNavigationPath(pos, selectedDest.arrivalPoint, currentZone);
      const pathDist = Math.round(computePathLengthMeters(waypoints));
      const etaSec = estimateWalkTimeSeconds(waypoints);

      setPendingPrompt({
        menuId,
        destinations: targetDestinations,
        selectedDestination: selectedDest,
        waypoints,
        distanceMeters: Math.max(1, pathDist),
        etaSeconds: etaSec,
        routeNote,
        crossZoneTarget,
        onArrive: onArriveHandler,
      });
    },
    [
      activeShiftLocked,
      buildContext,
      character,
      gameHour,
      insideBusinessId,
      insideInterior,
      isJailed,
      onNotify,
      onOpenTrainForZone,
      playerPosRef,
    ]
  );

  const selectPromptDestination = useCallback(
    (destId: string) => {
      if (!pendingPrompt || !character) return;
      const found = pendingPrompt.destinations.find((d) => d.id === destId);
      if (!found) return;

      const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
      const currentZone = (character.currentZone || 'cicalengka') as ZoneId;

      if (found.zone === currentZone && isWithinDestination(pos, found, 0)) {
        const cb = pendingPrompt.onArrive;
        setPendingPrompt(null);
        setActiveNav(null);
        cb(found);
        return;
      }

      const waypoints = findNavigationPath(pos, found.arrivalPoint, currentZone);
      const pathDist = Math.round(computePathLengthMeters(waypoints));
      const etaSec = estimateWalkTimeSeconds(waypoints);

      setPendingPrompt({
        ...pendingPrompt,
        selectedDestination: found,
        waypoints,
        distanceMeters: Math.max(1, pathDist),
        etaSeconds: etaSec,
      });
    },
    [character, pendingPrompt, playerPosRef]
  );

  const startGuidance = useCallback(
    (autoWalk: boolean) => {
      if (!pendingPrompt || !character) return;
      if (autoWalk && !NAVIGATION_FEATURE_FLAGS.AUTO_WALK_ENABLED) {
        onNotify('Fitur jalan otomatis sedang dinonaktifkan; ikuti penunjuk arah di layar.');
        autoWalk = false;
      }
      const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
      const currentZone = (character.currentZone || 'cicalengka') as ZoneId;
      const waypoints = findNavigationPath(
        pos,
        pendingPrompt.selectedDestination.arrivalPoint,
        currentZone
      );

      arrivalHandledRef.current = null;
      setActiveNav({
        menuId: pendingPrompt.menuId,
        destination: pendingPrompt.selectedDestination,
        waypoints,
        autoWalk,
        openOnArrival: true,
        crossZoneTarget: pendingPrompt.crossZoneTarget,
        routeNote: pendingPrompt.routeNote,
        onArrive: pendingPrompt.onArrive,
      });
      setPendingPrompt(null);
      onNotify(
        autoWalk
          ? `Berjalan otomatis menuju ${pendingPrompt.selectedDestination.label}...`
          : `Ikuti penunjuk arah menuju ${pendingPrompt.selectedDestination.label}.`
      );
    },
    [character, onNotify, pendingPrompt, playerPosRef]
  );

  const cancelPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  const cancelNavigation = useCallback(() => {
    setActiveNav(null);
    setPendingPrompt(null);
  }, []);

  const stopAutoWalk = useCallback(
    (reason?: string) => {
      setActiveNav((prev) => {
        if (!prev || !prev.autoWalk) return prev;
        return { ...prev, autoWalk: false };
      });
      if (reason) {
        onNotify(reason);
      }
    },
    [onNotify]
  );

  const toggleAutoWalk = useCallback(() => {
    if (!activeNav) return;
    if (!activeNav.autoWalk && !NAVIGATION_FEATURE_FLAGS.AUTO_WALK_ENABLED) {
      onNotify('Fitur jalan otomatis sedang dinonaktifkan.');
      return;
    }
    setActiveNav((prev) => (prev ? { ...prev, autoWalk: !prev.autoWalk } : null));
  }, [activeNav, onNotify]);

  const guideToWorldPoint = useCallback(
    (opts: { id: string; label: string; subtitle?: string; x: number; z: number; zone: ZoneId }) => {
      if (!character) return;
      const currentZone = (character.currentZone || 'cicalengka') as ZoneId;
      if (currentZone !== opts.zone) {
        onNotify(`Kendaraan ini terparkir di ${ZONE_DISPLAY_NAMES[opts.zone]}. Naik kereta dulu.`);
        return;
      }
      const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
      const targetPoint: WorldPoint2D = { x: opts.x, z: opts.z };
      const dest: InteractionDestination = {
        id: opts.id,
        label: opts.label,
        subtitle: opts.subtitle,
        iconKind: 'vehicle',
        zone: opts.zone,
        arrivalPoint: targetPoint,
        centerPoint: targetPoint,
        radius: 4.5,
      };
      const waypoints = findNavigationPath(pos, targetPoint, currentZone);
      arrivalHandledRef.current = null;
      setPendingPrompt(null);
      setActiveNav({
        menuId: 'vehicles_garage',
        destination: dest,
        waypoints,
        autoWalk: false,
        openOnArrival: false,
        onArrive: () => {},
      });
      onNotify(`Penunjuk arah aktif menuju ${opts.label}.`);
    },
    [character, onNotify, playerPosRef]
  );

  // Hitung badge ringkas untuk tombol menu HUD (Golongan A & B)
  const menuDistances = useMemo(() => {
    if (!character) return {} as Partial<Record<InteractionMenuId, { distanceMeters: number | null; inRange: boolean; requiresTrain: boolean }>>;
    const ctx = buildContext();
    if (!ctx) return {};
    const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
    const ids: InteractionMenuId[] = [
      'jobs',
      'clinic',
      'courses',
      'train',
      'bank',
      'business',
      'auction',
      'law',
      'agent_developer',
      'dealer',
      'spbu',
      'workshop',
      'samsat_sim',
    ];
    const result: Partial<
      Record<InteractionMenuId, { distanceMeters: number | null; inRange: boolean; requiresTrain: boolean }>
    > = {};
    for (const id of ids) {
      const lookup = getNearestValidDestination(id, pos, ctx);
      result[id] = {
        distanceMeters: lookup.distanceMeters,
        inRange: lookup.inRange || (id === 'law' && isJailed),
        requiresTrain: lookup.requiresTrain,
      };
    }
    return result;
  }, [buildContext, character, isJailed, livePosTick, playerPosRef]);

  const activeNavDistanceMeters = useMemo(() => {
    if (!activeNav) return 0;
    const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
    return Math.max(0, Math.round(getDistanceToDestination(pos, activeNav.destination)));
  }, [activeNav, livePosTick, playerPosRef]);

  const activeNavEtaSeconds = Math.max(
    1,
    Math.round(activeNavDistanceMeters / NAVIGATION_TUNING.WALK_SPEED_MPS)
  );

  return {
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
    isLocationWithin: (menuId: InteractionMenuId) => {
      const ctx = buildContext();
      if (!ctx) return false;
      const pos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
      const currentZone = (ctx.character.currentZone || 'cicalengka') as ZoneId;
      return getDestinationsForMenu(menuId, ctx).some(
        (d) => d.zone === currentZone && isWithinDestination(pos, d, 0)
      );
    },
  };
}
