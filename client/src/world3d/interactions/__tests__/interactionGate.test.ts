import { describe, expect, it } from 'vitest';
import interactionLocationsJson from '../../../../../functions/src/config/interactionLocations.json';
import type { BusinessDoc, CharacterDoc, PropertyDoc } from '../../../types/game';
import { findLotPlacement, LAYOUT_DATA } from '../../layout/layoutHelpers';
import {
  expandBox,
  getLotBox,
  getRailBoxes,
  pointInBox,
} from '../../layout/rules';
import {
  ATM_LOCATIONS,
  BANK_POS,
  FACTORY_RANCAEKEK_POS,
  INTERACT_HYSTERESIS_METERS,
  INTERACT_RADIUS_METERS,
  KLINIK_SWASTA_POS,
  MINIMARKET_POS,
  NPC_INTERACT_RADIUS_METERS,
  PUSKESMAS_POS,
  STATION_SPAWN,
  WARUNG_POS,
} from '../../worldConstants';
import {
  computePathLengthMeters,
  estimateWalkTimeSeconds,
  findNavigationPath,
} from '../pathfinder';
import {
  getDestinationsForMenu,
  getNearestValidDestination,
  isInRange,
  isWithinDestination,
  type InteractionContext,
  type InteractionDestination,
} from '../registry';

function makeTestCharacter(overrides: Partial<CharacterDoc> = {}): CharacterDoc {
  const now = Date.now();
  return {
    uid: 'test_nav_user',
    name: 'Kang Navigasi',
    nameLower: 'kang navigasi',
    gender: 'laki-laki',
    skinColor: '#e0ac69',
    hairColor: '#1e1b18',
    shirtColor: '#2563eb',
    pantsColor: '#1e293b',
    money: 500_000,
    health: 100,
    hygiene: 100,
    mood: 85,
    currentZone: 'cicalengka',
    skills: { komunikasi: 5, fisik: 5, hitung: 5, teknis: 5 },
    currentJob: null,
    activeShift: null,
    activeTrip: null,
    activeClinic: null,
    activeCourse: null,
    faintedCount: 0,
    lastPosition: { x: 0, y: 0, z: 0, rotY: 0 },
    reputation: 60,
    homeless: false,
    currentHomeId: 'prop_kos_1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeTestContext(
  charOverrides: Partial<CharacterDoc> = {},
  ctxOverrides: Partial<InteractionContext> = {}
): InteractionContext {
  return {
    character: makeTestCharacter(charOverrides),
    hasBankAccount: false,
    requiresBankBranch: false,
    isJailed: false,
    ...ctxOverrides,
  };
}

describe('Interaction Location Registry, Shared Radii & A* Navigation', () => {
  it('menjaga paritas konstanta radius bersama antara klien dan server', () => {
    expect(INTERACT_RADIUS_METERS).toBe(interactionLocationsJson.interactRadiusMeters);
    expect(INTERACT_RADIUS_METERS).toBe(9.5);
    expect(INTERACT_HYSTERESIS_METERS).toBe(interactionLocationsJson.hysteresisMeters);
    expect(INTERACT_HYSTERESIS_METERS).toBe(2.0);
    expect(NPC_INTERACT_RADIUS_METERS).toBe(interactionLocationsJson.npcInteractRadiusMeters);
    expect(NPC_INTERACT_RADIUS_METERS).toBe(4.5);
  });

  it('menjaga paritas koordinat dan pintu antara interactionLocations.json dan cicalengka.layout.json', () => {
    const locations = interactionLocationsJson.locations as Record<
      string,
      { zone: string; label: string; x: number; z: number; doorX: number; doorZ: number }
    >;

    for (const [id, loc] of Object.entries(locations)) {
      if (loc.zone !== 'cicalengka') continue;
      const placement = findLotPlacement(id);
      if (placement) {
        expect(loc.x).toBe(placement.x);
        expect(loc.z).toBe(placement.z);
        expect(loc.doorX).toBe(placement.door.x);
        expect(loc.doorZ).toBe(placement.door.z);
      } else {
        const atm = ATM_LOCATIONS.find((a) => a.id === id);
        if (atm) {
          expect(loc.x).toBe(atm.x);
          expect(loc.z).toBe(atm.z);
        }
      }
    }
  });

  it('menguji batas radius dan histeresis isWithinDestination secara presisi', () => {
    const dest: InteractionDestination = {
      id: 'warung',
      label: 'Warung Nasi Teh Neng',
      iconKind: 'warung',
      zone: 'cicalengka',
      arrivalPoint: { x: -30, z: -18 },
      centerPoint: { x: -30, z: -22 },
      radius: INTERACT_RADIUS_METERS,
    };

    // Tepat di batas radius 9.5m dari arrivalPoint (-30, -18) dan lebih jauh dari center (-30, -22)
    expect(isWithinDestination({ x: -30 + 9.5, z: -18 }, dest, 0)).toBe(true);
    // 9.6m -> di luar radius tanpa histeresis, masih di dalam dengan histeresis 2.0m
    expect(isWithinDestination({ x: -30 + 9.6, z: -18 }, dest, 0)).toBe(false);
    expect(isWithinDestination({ x: -30 + 9.6, z: -18 }, dest, INTERACT_HYSTERESIS_METERS)).toBe(true);
    // Tepat di batas histeresis 11.5m (9.5 + 2.0)
    expect(isWithinDestination({ x: -30 + 11.5, z: -18 }, dest, INTERACT_HYSTERESIS_METERS)).toBe(true);
    // Melebihi histeresis (11.6m)
    expect(isWithinDestination({ x: -30 + 11.6, z: -18 }, dest, INTERACT_HYSTERESIS_METERS)).toBe(false);
  });

  it('Golongan A Bank: mengarahkan ke cabang Bank jika belum punya rekening, atau ATM terdekat jika sudah punya', () => {
    const nearStationAtmPos = { x: -8, z: -46 };

    const noAcc = getNearestValidDestination(
      'bank',
      nearStationAtmPos,
      makeTestContext({}, { hasBankAccount: false })
    );
    expect(noAcc.destinations).toHaveLength(1);
    expect(noAcc.nearest?.id).toBe('bank');
    expect(noAcc.inRange).toBe(false);

    const withAcc = getNearestValidDestination(
      'bank',
      nearStationAtmPos,
      makeTestContext({}, { hasBankAccount: true })
    );
    expect(withAcc.destinations.length).toBeGreaterThanOrEqual(4);
    expect(withAcc.nearest?.id).toBe('atm_stasiun');
    expect(withAcc.inRange).toBe(true);

    const forceBranch = getNearestValidDestination(
      'bank',
      nearStationAtmPos,
      makeTestContext({}, { hasBankAccount: true, requiresBankBranch: true })
    );
    expect(forceBranch.destinations).toHaveLength(1);
    expect(forceBranch.nearest?.id).toBe('bank');
    expect(forceBranch.inRange).toBe(false);
  });

  it('Golongan A Klinik: memilih Puskesmas atau Klinik Swasta terdekat dan mendukung filter targetClinicId', () => {
    const nearKlinik = getNearestValidDestination(
      'clinic',
      { x: KLINIK_SWASTA_POS.x, z: KLINIK_SWASTA_POS.z - 4 },
      makeTestContext()
    );
    expect(nearKlinik.nearest?.id).toBe('klinik_swasta');
    expect(nearKlinik.inRange).toBe(true);

    const forcePuskesmas = getNearestValidDestination(
      'clinic',
      { x: KLINIK_SWASTA_POS.x, z: KLINIK_SWASTA_POS.z - 4 },
      makeTestContext({}, { targetClinicId: 'puskesmas' })
    );
    expect(forcePuskesmas.nearest?.id).toBe('puskesmas');
    expect(forcePuskesmas.inRange).toBe(false);
    expect(
      isInRange('clinic', { x: PUSKESMAS_POS.x, z: PUSKESMAS_POS.z }, makeTestContext())
    ).toBe(true);
  });

  it('Golongan A Kerja & Shift: membedakan pengangguran, kerja lokal, kerja lintas zona (kereta), dan kerja di bisnis pemain', () => {
    const unemployed = getDestinationsForMenu('jobs', makeTestContext());
    expect(unemployed.length).toBeGreaterThanOrEqual(7);

    const localWorker = getNearestValidDestination(
      'start_shift',
      { x: MINIMARKET_POS.x, z: MINIMARKET_POS.z },
      makeTestContext({
        currentJob: {
          employmentId: 'emp1',
          jobId: 'kasir_minimarket',
          title: 'Kasir Minimarket',
          employer: 'Alfamart Cicalengka',
          rankIndex: 0,
          rankTitle: 'Kasir Magang',
          totalWorkSeconds: 0,
          shiftsCompleted: 0,
          hiredAtMs: 1,
          lastShiftAtMs: 1,
        },
      })
    );
    expect(localWorker.nearest?.id).toBe('kasir_minimarket');
    expect(localWorker.requiresTrain).toBe(false);
    expect(localWorker.inRange).toBe(true);

    const factoryWorkerInTown = getNearestValidDestination(
      'start_shift',
      { x: 0, z: 0 },
      makeTestContext({
        currentZone: 'cicalengka',
        currentJob: {
          employmentId: 'emp2',
          jobId: 'buruh_pabrik',
          title: 'Buruh Pabrik',
          employer: 'PT Tekstil Rancaekek',
          rankIndex: 0,
          rankTitle: 'Operator',
          totalWorkSeconds: 0,
          shiftsCompleted: 0,
          hiredAtMs: 1,
          lastShiftAtMs: 1,
        },
      })
    );
    expect(factoryWorkerInTown.requiresTrain).toBe(true);
    expect(factoryWorkerInTown.targetZone).toBe('rancaekek');
    expect(factoryWorkerInTown.inRange).toBe(false);

    const factoryWorkerOnSite = getNearestValidDestination(
      'start_shift',
      { x: FACTORY_RANCAEKEK_POS.x, z: FACTORY_RANCAEKEK_POS.z },
      makeTestContext({
        currentZone: 'rancaekek',
        currentJob: {
          employmentId: 'emp2',
          jobId: 'buruh_pabrik',
          title: 'Buruh Pabrik',
          employer: 'PT Tekstil Rancaekek',
          rankIndex: 0,
          rankTitle: 'Operator',
          totalWorkSeconds: 0,
          shiftsCompleted: 0,
          hiredAtMs: 1,
          lastShiftAtMs: 1,
        },
      })
    );
    expect(factoryWorkerOnSite.requiresTrain).toBe(false);
    expect(factoryWorkerOnSite.inRange).toBe(true);

    const mockProp: PropertyDoc = {
      id: 'prop_ruko_test',
      name: 'Ruko Melati',
      type: 'ruko',
      zone: 'cicalengka',
      areaTag: 'pasar',
      stationDistanceTier: 'sedang',
      position: { x: 22, y: 0, z: -8 },
      size: { width: 8, depth: 8 },
      rooms: 1,
      baseValue: 1_000_000,
      baseRent: 50_000,
      baseDeposit: 50_000,
      condition: 100,
      lastConditionDecayAtMs: 1,
      ownerId: 'owner_1',
      ownerType: 'player',
      ownerName: 'Juragan',
      certificateId: 'SHM_TEST',
      activeListingId: null,
      activeLeaseId: null,
      layout: { gridCols: 4, gridRows: 4, wallColor: '#fff', floorColor: '#ccc' },
      facilities: { electricity: true, water: true, internet: false, ac: false },
      furniture: [],
    };
    const mockBiz: BusinessDoc = {
      id: 'biz_kopi_1',
      ownerId: 'owner_1',
      ownerName: 'Juragan',
      type: 'warung',
      name: 'Kedai Kopi Cicalengka',
      propertyId: mockProp.id,
      areaTag: 'pasar',
      position: mockProp.position,
      capital: 500_000,
      cash: 500_000,
      popularity: 50,
      level: 1,
      isOpen: true,
      hours: { openHour: 7, closeHour: 22 },
      lastSettledAtMs: 1,
      lastWageAtMs: 1,
      permits: { permitId: 'SIUP-1', issuedAtMs: 1, feePaid: 50_000 },
      status: 'active',
      createdAtMs: 1,
      updatedAtMs: 1,
    };

    const bizWorker = getNearestValidDestination(
      'start_shift',
      { x: mockProp.position.x, z: mockProp.position.z + 5 },
      makeTestContext(
        {
          currentJob: {
            employmentId: 'emp_biz',
            jobId: `biz_${mockBiz.id}`,
            businessId: mockBiz.id,
            title: 'Barista',
            employer: mockBiz.name,
            rankIndex: 0,
            rankTitle: 'Barista',
            totalWorkSeconds: 0,
            shiftsCompleted: 0,
            hiredAtMs: 1,
            lastShiftAtMs: 1,
          },
        },
        { businesses: [mockBiz], properties: [mockProp] }
      )
    );
    expect(bizWorker.nearest?.label).toBe('Kedai Kopi Cicalengka');
    expect(bizWorker.inRange).toBe(true);
  });

  it('Golongan B dapat dibuka dari mana saja, sementara sub-aksi sensitif tetap mewajibkan lokasi', () => {
    const farPos = { x: 65, z: 65 };
    const ctx = makeTestContext();

    for (const remoteMenu of [
      'marketplace',
      'house_search',
      'economy',
      'land_construction',
      'mortgage_security',
      'police',
      'profile',
      'my_property',
      'offers',
      'quests',
      'settings',
      'furniture_inventory',
    ] as const) {
      expect(isInRange(remoteMenu, farPos, ctx)).toBe(true);
      const lookup = getNearestValidDestination(remoteMenu, farPos, ctx);
      expect(lookup.policy.allowRemote).toBe(true);
    }

    for (const gatedAction of ['buy_land', 'apply_imb', 'apply_mortgage', 'warung', 'auction'] as const) {
      expect(isInRange(gatedAction, farPos, ctx)).toBe(false);
    }

    expect(isInRange('warung', WARUNG_POS, ctx)).toBe(true);
    expect(isInRange('apply_mortgage', BANK_POS, ctx)).toBe(true);
  });

  it('Kereta: mengarahkan ke Stasiun/Loket di Cicalengka dan ke stasiun zona asal saat di luar kota', () => {
    const inTown = getNearestValidDestination('train', STATION_SPAWN, makeTestContext({ currentZone: 'cicalengka' }));
    expect(inTown.inRange).toBe(true);
    expect(inTown.destinations.some((d) => d.id === 'stasiun')).toBe(true);

    const inBandung = getNearestValidDestination('train', { x: 0, z: 0 }, makeTestContext({ currentZone: 'bandung' }));
    expect(inBandung.nearest?.id).toBe('station_bandung');
    expect(inBandung.nearest?.zone).toBe('bandung');
    expect(inBandung.requiresTrain).toBe(false);
    expect(inBandung.inRange).toBe(false);
  });

  it('A* pathfinder menghasilkan rute bebas tabrakan bangunan di Cicalengka dan fallback garis lurus di zona luar', () => {
    const start = { x: 0, z: -45 };
    const goal = { x: -6, z: 22 }; // depan Polsek Cicalengka, melewati jalur alun-alun / sekitar bangunan
    const path = findNavigationPath(start, goal, 'cicalengka');

    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);

    const totalDist = computePathLengthMeters(path);
    const straightDist = Math.hypot(goal.x - start.x, goal.z - start.z);
    expect(totalDist).toBeGreaterThanOrEqual(straightDist - 0.01);
    expect(estimateWalkTimeSeconds(path)).toBeGreaterThan(0);

    // Pastikan waypoint perantara (sel grid A*) tidak menembus lot bangunan solid atau rel non-crossing
    const solidBoxes = LAYOUT_DATA.lots
      .filter((l) => l.type !== 'rail_crossing' && l.solid !== false)
      .map((l) => expandBox(getLotBox(l, false), 0.2));
    const rails = getRailBoxes(LAYOUT_DATA.rails, LAYOUT_DATA.rules.railSafeMeters, LAYOUT_DATA.lots);

    for (let i = 1; i < path.length - 1; i++) {
      const pt = path[i];
      for (const sb of solidBoxes) {
        expect(pointInBox(pt.x, pt.z, sb, 0)).toBe(false);
      }
      for (const rail of rails) {
        const onCrossing = pointInBox(pt.x, pt.z, rail.crossing, 0.6);
        const onJpo = rail.jpoZone ? pointInBox(pt.x, pt.z, rail.jpoZone, 0.6) : false;
        if (!onCrossing && !onJpo) {
          expect(pointInBox(pt.x, pt.z, rail.ballast, 0.5)).toBe(false);
        }
      }
    }

    const outerPath = findNavigationPath({ x: 0, z: -42 }, FACTORY_RANCAEKEK_POS, 'rancaekek');
    expect(outerPath).toEqual([{ x: 0, z: -42 }, { ...FACTORY_RANCAEKEK_POS }]);
  });
});
