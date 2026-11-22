import { describe, expect, it } from 'vitest';
import bankConfig from '../../../../../functions/src/config/bank.json';
import businessConfig from '../../../../../functions/src/config/business.json';
import clinicConfig from '../../../../../functions/src/config/clinic.json';
import constructionConfig from '../../../../../functions/src/config/construction.json';
import coursesConfig from '../../../../../functions/src/config/courses.json';
import economyConfig from '../../../../../functions/src/config/economy.json';
import furnitureConfig from '../../../../../functions/src/config/furniture.json';
import housingConfig from '../../../../../functions/src/config/housing.json';
import initialPropertiesConfig from '../../../../../functions/src/config/initialProperties.json';
import jobsConfig from '../../../../../functions/src/config/jobs.json';
import landConfig from '../../../../../functions/src/config/land.json';
import lawConfig from '../../../../../functions/src/config/law.json';
import npcsConfig from '../../../../../functions/src/config/npcs.json';
import questsConfig from '../../../../../functions/src/config/quests.json';
import trainScheduleConfig from '../../../../../functions/src/config/trainSchedule.json';
import { STREET_LAMP_POSITIONS } from '../../DayNightCycle';
import rawLayout from '../cicalengka.layout.json';
import {
  checkBuildingOverlap,
  checkBuildingSpacing,
  checkFacingAndDoorAccess,
  checkGridAndRotation,
  checkGridConnectivityAStar,
  checkIndustrialBuffer,
  checkPlazaSolidFree,
  checkRailSafety,
  checkRoadOverlap,
  checkRoadProximity,
  checkRoadSetback,
  checkTreeClearance,
  generateDeterministicPlants,
  generateDeterministicProps,
  getLotBox,
  getRailBoxes,
  getRoadBoxes,
  pointInBox,
} from '../rules';
import type { CicalengkaLayout, GeneratedPlant } from '../types';
import { validateLayout } from '../validate';

function cloneLayout(): CicalengkaLayout {
  return JSON.parse(JSON.stringify(rawLayout)) as CicalengkaLayout;
}

describe('Cicalengka City Layout & Rules', () => {
  it('validates the production cicalengka.layout.json with 0 violations and 100% A* reachability', () => {
    const report = validateLayout();
    expect(report.violations).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.connectivity.unreachableIds).toEqual([]);
    expect(report.connectivity.reachableIds.length).toBeGreaterThanOrEqual(45);
  });

  it('generates deterministic trees, palms, street lamps, and fences from fixed seed', () => {
    const layoutA = cloneLayout();
    const layoutB = cloneLayout();
    const plantsA = generateDeterministicPlants(layoutA);
    const plantsB = generateDeterministicPlants(layoutB);
    expect(plantsA).toEqual(plantsB);
    expect(plantsA.trees.length).toBeGreaterThanOrEqual(18);
    expect(plantsA.palms.length).toBeGreaterThanOrEqual(6);

    const propsA = generateDeterministicProps(layoutA);
    const propsB = generateDeterministicProps(layoutB);
    expect(propsA).toEqual(propsB);
    expect(propsA.lamps.length).toBeGreaterThan(10);
  });

  it('ruleRoadOverlap: detects building placed directly on a road', () => {
    const layout = cloneLayout();
    const warung = layout.lots.find((l) => l.id === 'warung')!;
    warung.position = { x: -30, z: -10 }; // tepat di tengah jalan_raya
    const violations = checkRoadOverlap(layout);
    expect(violations.some((v) => v.id === 'warung' && v.rule === 'ruleRoadOverlap')).toBe(true);
  });

  it('ruleRoadSetback: detects building violating minimum 2m road setback', () => {
    const layout = cloneLayout();
    const warung = layout.lots.find((l) => l.id === 'warung')!;
    // jalan_raya north edge = -15.0; warung depth 5.4 => z = -18.5 puts front face at -15.8 (0.8m setback < 2m)
    warung.position = { x: -30, z: -18 };
    const violations = checkRoadSetback(layout);
    expect(violations.some((v) => v.id === 'warung' && v.rule === 'ruleRoadSetback')).toBe(true);
  });

  it('ruleBuildingOverlap: detects two overlapping buildings', () => {
    const layout = cloneLayout();
    const warung = layout.lots.find((l) => l.id === 'warung')!;
    const tokoMebel = layout.lots.find((l) => l.id === 'toko_mebel')!;
    warung.position = { ...tokoMebel.position };
    const violations = checkBuildingOverlap(layout);
    expect(violations.some((v) => v.rule === 'ruleBuildingOverlap' && (v.id === 'warung' || v.targetId === 'warung'))).toBe(true);
  });

  it('ruleBuildingSpacing: enforces minimum gap for same-zone neighbor groups (kampung/perumahan)', () => {
    const layout = cloneLayout();
    const k1 = layout.lots.find((l) => l.id === 'kontrakan_1')!;
    // kontrakan_2 berada di (-28, 40) lebar 6m (minX = -31). Geser kontrakan_1 ke -34.5 (maxX = -31.5) -> gap 0.5m < 1.0m kampung
    k1.position = { x: -34.5, z: 40 };
    const violations = checkBuildingSpacing(layout);
    expect(violations.some((v) => v.rule === 'ruleBuildingSpacing' && (v.id === 'kontrakan_1' || v.targetId === 'kontrakan_1'))).toBe(true);
  });

  it('ruleRailSafety: blocks non-exempt building inside 4m rail buffer while exempting stasiun', () => {
    const layout = cloneLayout();
    expect(checkRailSafety(layout)).toEqual([]);

    const apt = layout.lots.find((l) => l.id === 'prop_apt_raya_1')!;
    apt.position = { x: 26, z: -56 }; // z_min = -59, hanya 1m dari balas rel (-60)
    const violations = checkRailSafety(layout);
    expect(violations.some((v) => v.id === 'prop_apt_raya_1' && v.rule === 'ruleRailSafety')).toBe(true);
  });

  it('rulePlazaSolidFree: forbids solid buildings inside Alun-Alun center', () => {
    const layout = cloneLayout();
    const polsek = layout.lots.find((l) => l.id === 'polsek')!;
    polsek.position = { x: 0, z: 6 };
    const violations = checkPlazaSolidFree(layout);
    expect(violations.some((v) => v.id === 'polsek' && v.rule === 'rulePlazaSolidFree')).toBe(true);
  });

  it('ruleRoadProximity: flags isolated buildings more than 10m from any road', () => {
    const layout = cloneLayout();
    const griya = layout.lots.find((l) => l.id === 'prop_rumah_griya_1')!;
    // Taruh jauh di kuadran tengah-tenggara tanpa jalan (< -80..80)
    layout.lots.push({
      ...griya,
      id: 'isolated_test_house',
      position: { x: 0, z: 30 },
    });
    // Di (0, 30), jalan terdekat alun_selatan Z=20.5 jarak 5.5m; uji posisi lebih jauh di luar kota jika perlu
    const iso = layout.lots.find((l) => l.id === 'isolated_test_house')!;
    iso.position = { x: 0, z: -60 }; // tanpa exemption: jalan terdekat jalan_stasiun (-43.5) -> jarak ~12.5m
    const violations = checkRoadProximity(layout);
    expect(violations.some((v) => v.id === 'isolated_test_house' && v.rule === 'ruleRoadProximity')).toBe(true);
  });

  it('ruleGridAndRotation: enforces 2m grid snap and 90-degree rotation increments', () => {
    const layout = cloneLayout();
    const bank = layout.lots.find((l) => l.id === 'bank')!;
    bank.position = { x: -45, z: 2 }; // X ganjil (bukan kelipatan 2m)
    bank.rotDeg = 45 as unknown as 0; // bukan kelipatan 90°
    const violations = checkGridAndRotation(layout);
    expect(violations.filter((v) => v.id === 'bank' && v.rule === 'ruleGridAndRotation').length).toBe(2);
  });

  it('ruleFacingAndDoorAccess: detects blocked door access path to road', () => {
    const layout = cloneLayout();
    const bank = layout.lots.find((l) => l.id === 'bank')!;
    // Taruh kios solid tepat di depan pintu bank (-46, -3.2) menghalangi jalan_raya
    layout.lots.push({
      id: 'blocker_kiosk',
      label: 'Blocker Kiosk',
      type: 'stall',
      category: 'perdagangan',
      spacingGroup: 'default',
      zoneId: 'zona_perdagangan',
      footprint: { width: 3, depth: 2 },
      position: { x: -46, z: -4 },
      rotDeg: 0,
      facing: 'north',
      roadId: 'jalan_raya',
      door: { x: bank.door.x, z: -5.2 },
      solid: true,
    });
    const violations = checkFacingAndDoorAccess(layout);
    expect(violations.some((v) => v.id === 'bank' && v.rule === 'ruleFacingAndDoorAccess')).toBe(true);
  });

  it('ruleIndustrialBuffer: enforces minimum 6m industrial buffer from residential lots', () => {
    const layout = cloneLayout();
    const pabrik = layout.lots.find((l) => l.id === 'pabrik_reserved')!;
    // Pindahkan dekat prop_rumah_griya_1 (28, 38)
    pabrik.position = { x: 28, z: 30 };
    const violations = checkIndustrialBuffer(layout);
    expect(violations.some((v) => v.id === 'pabrik_reserved' && v.rule === 'ruleIndustrialBuffer')).toBe(true);
  });

  it('ruleTreeClearance: rejects trees placed on road asphalt, sidewalks, buildings, or plots', () => {
    const layout = cloneLayout();
    const fakePlants: { trees: GeneratedPlant[]; palms: GeneratedPlant[] } = {
      trees: [
        { id: 'bad_tree_road', kind: 'tree', zoneRuleId: 'test', x: 0, y: 0, z: -10, scale: 1, rotY: 0 }, // di tengah jalan_raya
        { id: 'bad_tree_sidewalk', kind: 'tree', zoneRuleId: 'test', x: -30, y: 0, z: -16, scale: 1, rotY: 0 }, // di trotoar jalan_raya
        { id: 'bad_tree_building', kind: 'tree', zoneRuleId: 'test', x: 46, y: 0, z: 4, scale: 1, rotY: 0 }, // di dalam pasar
        { id: 'bad_tree_plot', kind: 'tree', zoneRuleId: 'test', x: -46, y: 0, z: -50, scale: 1, rotY: 0 }, // di dalam plot_stasiun_1
      ],
      palms: [],
    };
    const violations = checkTreeClearance(layout, fakePlants);
    expect(violations.some((v) => v.id === 'bad_tree_road' && v.rule === 'ruleTreeClearance')).toBe(true);
    expect(violations.some((v) => v.id === 'bad_tree_sidewalk' && v.rule === 'ruleTreeClearance')).toBe(true);
    expect(violations.some((v) => v.id === 'bad_tree_building' && v.rule === 'ruleTreeClearance')).toBe(true);
    expect(violations.some((v) => v.id === 'bad_tree_plot' && v.rule === 'ruleTreeClearance')).toBe(true);
  });

  it('ruleGridConnectivityAStar: detects unreachable targets when a road connection is broken', () => {
    const layout = cloneLayout();
    // Hapus jalan_perumahan_timur sehingga pabrik_reserved di utara rel dan sawah/plot timur terputus
    layout.roads = layout.roads.filter((r) => r.id !== 'jalan_perumahan_timur');
    const conn = checkGridConnectivityAStar(layout);
    expect(conn.result.unreachableIds.some((u) => u.id === 'pabrik_reserved')).toBe(true);
    expect(conn.violations.some((v) => v.rule === 'ruleGridConnectivityAStar')).toBe(true);
  });

  it('keeps all functions/src/config JSONs synchronized with cicalengka.layout.json', () => {
    const layout = cloneLayout();
    const lotPos = (id: string) => {
      const lot = layout.lots.find((l) => l.id === id);
      expect(lot, `Missing lot ${id}`).toBeDefined();
      return lot!.position;
    };

    // law.json
    expect(lawConfig.policeStation.x).toBe(layout.anchors.policeStation.x);
    expect(lawConfig.policeStation.z).toBe(layout.anchors.policeStation.z);
    expect(lawConfig.policeStation.jailCenter).toEqual(layout.anchors.policeStation.jailCenter);
    expect(lawConfig.policeStation.releaseSpawn).toEqual(layout.anchors.policeStation.releaseSpawn);
    for (const cctv of layout.anchors.cctvs) {
      const cfgCctv = lawConfig.cctvZones.find((c) => c.id === cctv.id);
      expect(cfgCctv?.x).toBe(cctv.x);
      expect(cfgCctv?.z).toBe(cctv.z);
    }

    // land.json
    for (const plot of landConfig.plots) {
      const expected = lotPos(plot.id);
      expect(plot.position.x).toBe(expected.x);
      expect(plot.position.z).toBe(expected.z);
    }

    // clinic.json
    expect(clinicConfig.clinics.find((c) => c.id === 'puskesmas')?.location).toEqual(lotPos('puskesmas'));
    expect(clinicConfig.clinics.find((c) => c.id === 'klinik_swasta')?.location).toEqual(lotPos('klinik_swasta'));
    expect(clinicConfig.faintPenalty.hospitalPos.x).toBe(layout.anchors.hospitalPos.x);
    expect(clinicConfig.faintPenalty.hospitalPos.z).toBe(layout.anchors.hospitalPos.z);

    // construction.json & furniture.json
    expect(constructionConfig.agentSettings.officePos.x).toBe(layout.anchors.agentOffice.x);
    expect(constructionConfig.agentSettings.officePos.z).toBe(layout.anchors.agentOffice.z);
    expect(furnitureConfig.shopLocation.x).toBe(lotPos('toko_mebel').x);
    expect(furnitureConfig.shopLocation.z).toBe(lotPos('toko_mebel').z);

    // jobs.json (Cicalengka jobs)
    const jobLotMap: Record<string, string> = {
      kasir_minimarket: 'minimarket',
      pedagang_pasar: 'pasar',
      kurir: 'pos_kurir',
      polisi: 'polsek',
      agen_properti: 'kantor_agen',
    };
    for (const [jobId, lotId] of Object.entries(jobLotMap)) {
      const job = jobsConfig.jobs.find((j) => j.id === jobId)!;
      expect(job.location.x).toBe(lotPos(lotId).x);
      expect(job.location.z).toBe(lotPos(lotId).z);
    }

    // business.json
    expect(businessConfig.kantorDesaLocation.x).toBe(lotPos('kantor_desa').x);
    expect(businessConfig.kantorDesaLocation.z).toBe(lotPos('kantor_desa').z);
    expect(businessConfig.pasarGrosirLocation.x).toBe(lotPos('pasar_grosir').x);
    expect(businessConfig.pasarGrosirLocation.z).toBe(lotPos('pasar_grosir').z);
    expect(businessConfig.balaiLelangLocation.x).toBe(lotPos('balai_lelang').x);
    expect(businessConfig.balaiLelangLocation.z).toBe(lotPos('balai_lelang').z);

    // bank.json
    expect(bankConfig.bankLocation.x).toBe(lotPos('bank').x);
    expect(bankConfig.bankLocation.z).toBe(lotPos('bank').z);
    for (const atm of layout.anchors.atms) {
      const cfgAtm = bankConfig.atmLocations.find((a) => a.id === atm.id);
      expect(cfgAtm?.x).toBe(atm.x);
      expect(cfgAtm?.z).toBe(atm.z);
    }

    // courses.json & economy.json
    expect(coursesConfig.schoolLocation.x).toBe(lotPos('sekolah').x);
    expect(coursesConfig.schoolLocation.z).toBe(lotPos('sekolah').z);
    expect(economyConfig.bathLocation.x).toBe(lotPos('bath_mck').x);
    expect(economyConfig.bathLocation.z).toBe(lotPos('bath_mck').z);
    expect(economyConfig.tokoMebelLocation.x).toBe(lotPos('toko_mebel').x);
    expect(economyConfig.tokoMebelLocation.z).toBe(lotPos('toko_mebel').z);
    expect(economyConfig.penampunganLocation.x).toBe(lotPos('penampungan').x);
    expect(economyConfig.penampunganLocation.z).toBe(lotPos('penampungan').z);

    // housing.json
    for (const spot of housingConfig.homelessSettings.emperanSpots) {
      expect(spot.x).toBe(lotPos(spot.id).x);
      expect(spot.z).toBe(lotPos(spot.id).z);
    }
    expect(housingConfig.homelessSettings.shelter.x).toBe(lotPos('penampungan').x);
    expect(housingConfig.homelessSettings.shelter.z).toBe(lotPos('penampungan').z);

    // trainSchedule.json
    expect(trainScheduleConfig.stations.cicalengka.platformPos).toEqual(layout.anchors.stationSpawn);
    expect(trainScheduleConfig.stations.cicalengka.ticketBooth).toEqual(layout.anchors.ticketBooth.cicalengka);

    // initialProperties.json
    for (const prop of initialPropertiesConfig.properties) {
      const expected = lotPos(prop.id);
      expect(prop.position.x, prop.id).toBe(expected.x);
      expect(prop.position.z, prop.id).toBe(expected.z);
    }

    // quests.json
    const qPolsek = questsConfig.quests.find((q) => q.id === 'q_antar_kopi_polsek')!;
    expect(qPolsek.objective.targetPos).toEqual(lotPos('polsek'));
    const qDesa = questsConfig.quests.find((q) => q.id === 'q_cari_berkas_desa')!;
    expect(qDesa.objective.returnPos).toEqual(lotPos('kantor_desa'));
    const qGrosir = questsConfig.quests.find((q) => q.id === 'q_bantu_stok_grosir')!;
    expect(qGrosir.objective.targetPos).toEqual(lotPos('pasar_grosir'));
    const qLapor = questsConfig.quests.find((q) => q.id === 'q_lapor_keamanan')!;
    expect(qLapor.objective.checkpointPos).toEqual({
      x: layout.anchors.stationSpawn.x,
      z: layout.anchors.stationSpawn.z,
    });
    expect(qLapor.objective.returnPos).toEqual(lotPos('polsek'));
    const qGotong = questsConfig.quests.find((q) => q.id === 'q_gotong_royong_kampung')!;
    expect(qGotong.objective.targetPos).toEqual(layout.anchors.alunAlunCenter);
    const qSurvei = questsConfig.quests.find((q) => q.id === 'q_survei_kavling')!;
    expect(qSurvei.objective.searchPos).toEqual(lotPos('plot_perumahan_2'));
    expect(qSurvei.objective.returnPos).toEqual(lotPos('kantor_agen'));
  });

  it('keeps NPC home/work/patrol waypoints and colonial plaza lamps clear of solid colliders & non-crossing rails', () => {
    const layout = cloneLayout();
    const solidBoxes = layout.lots
      .filter((l) => l.solid !== false)
      .map((l) => ({ id: l.id, box: getLotBox(l) }));
    const railBoxes = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);
    const roadBoxes = getRoadBoxes(layout.roads);
    const plants = generateDeterministicPlants(layout);

    for (const npc of npcsConfig.npcs) {
      const points: Array<{ label: string; x: number; z: number }> = [
        { label: `${npc.id}.homePos`, x: npc.homePos.x, z: npc.homePos.z },
        { label: `${npc.id}.workPos`, x: npc.workPos.x, z: npc.workPos.z },
        ...npc.patrolRoute.map(([x, z], idx) => ({
          label: `${npc.id}.patrol[${idx}]`,
          x,
          z,
        })),
      ];
      for (const pt of points) {
        const blockingLot = solidBoxes.find((b) => pointInBox(pt.x, pt.z, b.box, -0.15));
        expect(blockingLot, `${pt.label} overlaps solid lot ${blockingLot?.id}`).toBeUndefined();
        const onUnsafeRail = railBoxes.some(
          (r) => pointInBox(pt.x, pt.z, r.ballast, 0.2) && !pointInBox(pt.x, pt.z, r.crossing, 0)
        );
        expect(onUnsafeRail, `${pt.label} is inside rail ballast outside crossing`).toBe(false);
      }
    }

    for (const [lx, , lz] of STREET_LAMP_POSITIONS) {
      const onAsphalt = roadBoxes.some((r) => pointInBox(lx, lz, r.asphalt, 0.35));
      expect(onAsphalt, `Colonial lamp (${lx}, ${lz}) overlaps road asphalt`).toBe(false);

      const onSolid = solidBoxes.find((b) => pointInBox(lx, lz, b.box, 0.35));
      expect(onSolid, `Colonial lamp (${lx}, ${lz}) overlaps building ${onSolid?.id}`).toBeUndefined();

      const onTree = [...plants.trees, ...plants.palms].find(
        (t) => Math.hypot(lx - t.x, lz - t.z) < 1.8
      );
      expect(onTree, `Colonial lamp (${lx}, ${lz}) too close to tree ${onTree?.id}`).toBeUndefined();

      const onBench = layout.props.benchPositions.find(
        (b) => Math.hypot(lx - b.x, lz - b.z) < 1.6
      );
      expect(onBench, `Colonial lamp (${lx}, ${lz}) too close to bench ${onBench?.id}`).toBeUndefined();
    }
  });
});

