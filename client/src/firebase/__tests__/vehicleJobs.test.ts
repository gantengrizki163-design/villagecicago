import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trafficJson from '../../../../functions/src/config/traffic.json';
import type { CharacterDoc, CharacterStatsDoc } from '../../types/game';
import { getDestinationsForMenu } from '../../world3d/interactions/registry';
import { localSimulation, type LocalSimulationState } from '../localSimulation';

function seedWorker(
  uid: string,
  name: string,
  money = 5_000_000,
  skills = { komunikasi: 10, fisik: 10, hitung: 10, teknis: 10 }
): {
  character: CharacterDoc;
  getState: () => LocalSimulationState;
} {
  localSimulation.reset();
  let snapshot!: LocalSimulationState;
  localSimulation.subscribe((s) => {
    snapshot = s;
  });
  const now = Date.now();
  const character: CharacterDoc = {
    uid,
    name,
    nameLower: name.toLowerCase(),
    gender: 'laki-laki',
    skinColor: '#e0ac69',
    hairColor: '#1e1b18',
    shirtColor: '#2563eb',
    pantsColor: '#1e293b',
    money,
    health: 100,
    hygiene: 100,
    mood: 90,
    currentZone: 'cicalengka',
    skills,
    currentJob: null,
    activeShift: null,
    activeTrip: null,
    activeClinic: null,
    activeCourse: null,
    faintedCount: 0,
    lastPosition: { x: 0, y: 0, z: 0, rotY: 0 },
    reputation: 85,
    creditScore: 80,
    completedShifts: 2,
    homeless: false,
    currentHomeId: null,
    wantedLevel: 0,
    wantedUpdatedAtMs: now,
    createdAt: now,
    updatedAt: now,
  };
  const stats: CharacterStatsDoc = {
    uid,
    hunger: 100,
    thirst: 100,
    energy: 100,
    health: 100,
    hygiene: 100,
    mood: 90,
    lastCalculatedAt: now,
  };
  localSimulation.seedFromFirestore(character, stats);
  return { character, getState: () => snapshot };
}

describe('Langkah 11 — Pekerjaan Berbasis Kendaraan (Ojek Online, Kurir Motor, Sopir Angkot, Logistik)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mengharuskan SIM C + motor untuk Ojek Online dan memberi bonus +20% untuk motor_ojek / box_kurir', () => {
    const { getState } = seedWorker('ojol_1', 'Kang Asep Ojol');

    // Gagal tanpa SIM C
    expect(() => localSimulation.applyJob('ojek_online')).toThrow(/SIM C/i);

    // Lulus ujian SIM C, masih gagal jika belum punya motor
    const simRes = localSimulation.takeLicenseExam('C', [1, 0, 2, 1, 0]);
    expect(simRes.passed).toBe(true);
    expect(() => localSimulation.applyJob('ojek_online')).toThrow(/sepeda motor/i);

    // Beli motor_bebek (tanpa bonus)
    const bebek = localSimulation.buyVehicle('dealer_motor_baru', 'motor_bebek');
    localSimulation.applyJob('ojek_online');
    const shift1 = localSimulation.startShift();
    const prompt1 = shift1.activeShift.taskPrompt as {
      sequential?: boolean;
      requiresVehicle?: boolean;
      targets: Array<{ id: string }>;
    };
    expect(prompt1.sequential).toBe(true);
    expect(prompt1.requiresVehicle).toBe(true);
    expect(prompt1.targets).toHaveLength(3);

    vi.advanceTimersByTime(30_000);
    const endBebek = localSimulation.endShift({
      visitedIds: prompt1.targets.map((t) => t.id),
      vehicleId: bebek.vehicle.id,
    });
    expect(endBebek.vehicleBonusRate).toBe(0);
    expect(endBebek.vehicleBonusPay).toBe(0);

    // Pasang box_kurir di bengkel -> bonus +20% aktif
    localSimulation.serviceVehicle({
      vehicleId: bebek.vehicle.id,
      serviceType: 'accessory',
      accessoryId: 'box_kurir',
    });
    const shift2 = localSimulation.startShift();
    const prompt2 = shift2.activeShift.taskPrompt as { targets: Array<{ id: string }> };
    vi.advanceTimersByTime(30_000);
    const endBox = localSimulation.endShift({
      visitedIds: prompt2.targets.map((t) => t.id),
      vehicleId: bebek.vehicle.id,
    });
    expect(endBox.vehicleBonusRate).toBe(0.2);
    expect(endBox.vehicleBonusPay).toBeGreaterThan(0);
    expect(getState().character?.currentJob?.shiftsCompleted).toBe(2);
  });

  it('mengharuskan SIM A + mobil_angkot untuk Sopir Angkot, melewati 4 halte resmi berurutan, dan memberi bonus +15% kondisi prima', () => {
    seedWorker('angkot_1', 'Mang Dadang Angkot');

    // Gagal tanpa SIM A
    expect(() => localSimulation.applyJob('sopir_angkot')).toThrow(/SIM A/i);
    expect(localSimulation.takeLicenseExam('A', [2, 1, 0, 2, 1]).passed).toBe(true);

    // Beli sedan (bukan angkot) -> tetap ditolak
    localSimulation.buyVehicle('showroom_mobil_baru', 'mobil_sedan');
    expect(() => localSimulation.applyJob('sopir_angkot')).toThrow(/Angkot/i);

    // Beli mobil_angkot (kondisi awal 100 >= 75)
    const angkot = localSimulation.buyVehicle('showroom_mobil_baru', 'mobil_angkot');
    localSimulation.applyJob('sopir_angkot');
    const shift = localSimulation.startShift();
    const prompt = shift.activeShift.taskPrompt as {
      sequential?: boolean;
      allowedModelIds?: string[];
      targets: Array<{ id: string; boarded?: number; alighted?: number }>;
    };

    expect(prompt.sequential).toBe(true);
    expect(prompt.allowedModelIds).toEqual(['mobil_angkot']);
    expect(prompt.targets.map((t) => t.id)).toEqual(trafficJson.halteSpots.map((h) => h.id));
    expect(prompt.targets).toHaveLength(4);

    vi.advanceTimersByTime(35_000);
    const done = localSimulation.endShift({
      visitedIds: prompt.targets.map((t) => t.id),
      vehicleId: angkot.vehicle.id,
    });
    expect(done.score).toBe(100);
    expect(done.vehicleBonusRate).toBe(0.15);
    expect(done.vehicleBonusPay).toBeGreaterThan(0);
  });

  it('menghitung rute Pasar Grosir + 2 tujuan dan skala bonus kapasitas bagasi untuk Sopir Logistik', () => {
    seedWorker('logistik_1', 'Kang Ujang Niaga');
    expect(localSimulation.takeLicenseExam('A', [2, 1, 0, 2, 1]).passed).toBe(true);

    // Beli mobil_pickup (trunkCapacity = 60 -> (60-50)/150 = 0.07)
    const pickup = localSimulation.buyVehicle('showroom_mobil_baru', 'mobil_pickup');
    localSimulation.applyJob('sopir_logistik');
    const sPickup = localSimulation.startShift();
    const pPickup = sPickup.activeShift.taskPrompt as {
      targets: Array<{ id: string }>;
    };
    expect(pPickup.targets).toHaveLength(3);
    expect(pPickup.targets[0].id).toBe('log_muat_grosir');

    vi.advanceTimersByTime(35_000);
    const endPickup = localSimulation.endShift({
      visitedIds: pPickup.targets.map((t) => t.id),
      vehicleId: pickup.vehicle.id,
    });
    expect(endPickup.vehicleBonusRate).toBe(0.07);

    // Tambah mobil_truk_kecil + pasang rak_atap (trunkCapacity 90 + 10 = 100 -> (100-50)/150 = 0.33)
    const truk = localSimulation.buyVehicle('showroom_mobil_baru', 'mobil_truk_kecil');
    localSimulation.serviceVehicle({
      vehicleId: truk.vehicle.id,
      serviceType: 'accessory',
      accessoryId: 'rak_atap',
    });
    localSimulation.mountVehicle(truk.vehicle.id);

    const sTruk = localSimulation.startShift();
    const pTruk = sTruk.activeShift.taskPrompt as {
      assignedVehicleId?: string;
      targets: Array<{ id: string }>;
    };
    expect(pTruk.assignedVehicleId).toBe(truk.vehicle.id);

    vi.advanceTimersByTime(35_000);
    const endTruk = localSimulation.endShift({
      visitedIds: pTruk.targets.map((t) => t.id),
      vehicleId: truk.vehicle.id,
    });
    expect(endTruk.vehicleBonusRate).toBe(0.33);
    expect(endTruk.vehicleBonusPay).toBeGreaterThan(endPickup.vehicleBonusPay ?? 0);
  });

  it('menjaga Kurir tetap bisa jalan kaki (bonus 0%) sekaligus memberi +15% motor biasa dan +30% motor_ojek/box_kurir', () => {
    seedWorker('kurir_1', 'Teh Rani Kurir');
    localSimulation.applyJob('kurir');

    // 1. Jalan kaki (tanpa kendaraan / vehicleId)
    const sFoot = localSimulation.startShift();
    const pFoot = sFoot.activeShift.taskPrompt as { targets: Array<{ id: string }> };
    vi.advanceTimersByTime(30_000);
    const endFoot = localSimulation.endShift({
      visitedIds: pFoot.targets.map((t) => t.id),
    });
    expect(endFoot.vehicleBonusRate).toBe(0);
    expect(endFoot.vehicleBonusPay).toBe(0);

    // 2. Naik motor matic biasa (+15%)
    const matic = localSimulation.buyVehicle('dealer_motor_baru', 'motor_matic');
    const sMatic = localSimulation.startShift();
    const pMatic = sMatic.activeShift.taskPrompt as { targets: Array<{ id: string }> };
    vi.advanceTimersByTime(30_000);
    const endMatic = localSimulation.endShift({
      visitedIds: pMatic.targets.map((t) => t.id),
      vehicleId: matic.vehicle.id,
    });
    expect(endMatic.vehicleBonusRate).toBe(0.15);

    // 3. Naik motor_ojek (+30%)
    const ojol = localSimulation.buyVehicle('dealer_motor_baru', 'motor_ojek');
    const sOjol = localSimulation.startShift();
    const pOjol = sOjol.activeShift.taskPrompt as { targets: Array<{ id: string }> };
    vi.advanceTimersByTime(30_000);
    const endOjol = localSimulation.endShift({
      visitedIds: pOjol.targets.map((t) => t.id),
      vehicleId: ojol.vehicle.id,
    });
    expect(endOjol.vehicleBonusRate).toBe(0.3);
    expect(endOjol.vehicleBonusPay).toBeGreaterThan(endMatic.vehicleBonusPay ?? 0);
  });

  it('menyelesaikan tujuan navigasi untuk ojek_online, sopir_angkot, dan sopir_logistik', () => {
    const { character } = seedWorker('nav_worker', 'Warga Navigasi');
    for (const [jobId, expectedLabelPart] of [
      ['ojek_online', 'CikOjek'],
      ['sopir_angkot', 'Terminal'],
      ['sopir_logistik', 'Pasar Grosir'],
    ] as const) {
      const dests = getDestinationsForMenu('jobs', {
        character,
        targetJobId: jobId,
      });
      expect(dests).toHaveLength(1);
      expect(dests[0].id).toBe(jobId);
      expect(dests[0].zone).toBe('cicalengka');
      expect(dests[0].label).toContain(expectedLabelPart);
    }
  });
});
