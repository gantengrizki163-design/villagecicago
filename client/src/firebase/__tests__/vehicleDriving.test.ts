import { describe, expect, it } from 'vitest';
import { getDefaultVehicleConfig, getVehicleModelById } from '../vehicleConfigCache';
import { localSimulation, type LocalSimulationState } from '../localSimulation';
import {
  classifyTerrainAt,
  stepArcadeVehiclePhysics,
  type VehiclePhysicsState,
} from '../../world3d/vehicles/vehiclePhysics';

function makeBasePhysics(overrides: Partial<VehiclePhysicsState> = {}): VehiclePhysicsState {
  return {
    speedMps: 0,
    headingRad: 0,
    steerAngle: 0,
    wheelSpinRad: 0,
    motorLeanRad: 0,
    distanceKmAccum: 0,
    offroadKmAccum: 0,
    fuelRemaining: 10,
    condition: 90,
    crashDamageAccum: 0,
    stalledUntilMs: 0,
    nextSputterAtMs: 0,
    pushHoldSec: 0,
    ...overrides,
  };
}

function seedDrivingSimUser(uid = 'test_driver_1', money = 50_000_000): {
  getState: () => LocalSimulationState;
  unsub: () => void;
} {
  localSimulation.reset();
  let snapshot!: LocalSimulationState;
  const unsub = localSimulation.subscribe((s) => {
    snapshot = s;
  });
  const now = Date.now();
  localSimulation.seedFromFirestore(
    {
      uid,
      name: 'Kang Supir',
      nameLower: 'kang supir',
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
      skills: { komunikasi: 10, fisik: 10, hitung: 10, teknis: 10 },
      currentJob: null,
      activeShift: null,
      activeTrip: null,
      activeClinic: null,
      activeCourse: null,
      faintedCount: 0,
      lastPosition: { x: 0, y: 0, z: 0, rotY: 0 },
      reputation: 70,
      homeless: false,
      currentHomeId: null,
      wantedLevel: 0,
      wantedUpdatedAtMs: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      uid,
      hunger: 100,
      thirst: 100,
      energy: 100,
      health: 100,
      hygiene: 100,
      mood: 90,
      lastCalculatedAt: now,
    }
  );
  return { getState: () => snapshot, unsub };
}

describe('Langkah 8 — Fisika Mengemudi, Bensin Habis, Mogok & Tabrakan', () => {
  const bundle = getDefaultVehicleConfig();
  const motorBebek = getVehicleModelById('motor_bebek', bundle.vehicles)!;
  const motorTrail = getVehicleModelById('motor_trail', bundle.vehicles)!;
  const mobilSedan = getVehicleModelById('mobil_sedan', bundle.vehicles)!;

  it('menghentikan kendaraan saat bensin habis lalu mengizinkan dorong pelan setelah tahan gas', () => {
    let state = makeBasePhysics({ speedMps: 6, fuelRemaining: 0 });
    // Fase 1: kendaraan masih meluncur saat bensin habis -> melambat tanpa tenaga mesin
    const coastStep = stepArcadeVehiclePhysics({
      state,
      model: motorBebek,
      throttle: 1,
      brakeReverse: 0,
      steerInput: 0,
      handbrake: false,
      weather: 'cerah',
      surface: 'asphalt',
      wheelRadius: 0.25,
      dt: 0.05,
      nowMs: 10_000,
    });
    expect(coastStep.isOutOfFuel).toBe(true);
    expect(coastStep.isPushing).toBe(false);
    expect(coastStep.speedMps).toBeLessThan(6);

    // Fase 2: setelah berhenti dan menahan gas > 0.35s -> mode dorong pelan aktif (maks ~1.35 m/s)
    state = makeBasePhysics({ speedMps: 0, fuelRemaining: 0, pushHoldSec: 0.4 });
    let pushRes = stepArcadeVehiclePhysics({
      state,
      model: motorBebek,
      throttle: 1,
      brakeReverse: 0,
      steerInput: 0,
      handbrake: false,
      weather: 'cerah',
      surface: 'asphalt',
      wheelRadius: 0.25,
      dt: 0.05,
      nowMs: 11_000,
    });
    expect(pushRes.isPushing).toBe(true);
    for (let i = 0; i < 40; i++) {
      state = {
        ...state,
        speedMps: pushRes.speedMps,
        pushHoldSec: pushRes.pushHoldSec,
      };
      pushRes = stepArcadeVehiclePhysics({
        state,
        model: motorBebek,
        throttle: 1,
        brakeReverse: 0,
        steerInput: 0,
        handbrake: false,
        weather: 'cerah',
        surface: 'asphalt',
        wheelRadius: 0.25,
        dt: 0.05,
        nowMs: 11_050 + i * 50,
      });
    }
    expect(pushRes.speedMps).toBeGreaterThan(0.5);
    expect(pushRes.speedMps).toBeLessThanOrEqual(1.4);
  });

  it('memicu gejala mogok (sputter/stall) saat kondisi mesin rendah <= 22%', () => {
    const state = makeBasePhysics({
      speedMps: 7,
      fuelRemaining: 4,
      condition: 18,
      nextSputterAtMs: 5000,
    });
    const res = stepArcadeVehiclePhysics({
      state,
      model: mobilSedan,
      throttle: 1,
      brakeReverse: 0,
      steerInput: 0,
      handbrake: false,
      weather: 'cerah',
      surface: 'asphalt',
      wheelRadius: 0.31,
      dt: 0.05,
      nowMs: 5200,
    });
    expect(res.justStalled).toBe(true);
    expect(res.isStalled).toBe(true);
    expect(res.rpmRatio).toBe(0);
    expect(res.speedMps).toBeLessThan(7);
  });

  it('motor trail lebih unggul di sawah & klasifikasi terrain jalan raya berjalan akurat', () => {
    const sawahCheck = classifyTerrainAt(70, 0, 'cicalengka');
    expect(sawahCheck.surface).toBe('sawah');

    const roadCheck = classifyTerrainAt(0, -10, 'cicalengka');
    expect(roadCheck.surface).toBe('asphalt');
    expect(roadCheck.speedLimitMps).not.toBeNull();

    const trailSawah = stepArcadeVehiclePhysics({
      state: makeBasePhysics({ speedMps: motorTrail.maxSpeedMps }),
      model: motorTrail,
      throttle: 1,
      brakeReverse: 0,
      steerInput: 0,
      handbrake: false,
      weather: 'cerah',
      surface: 'sawah',
      wheelRadius: 0.31,
      dt: 0.05,
      nowMs: 1000,
    });
    const sedanSawah = stepArcadeVehiclePhysics({
      state: makeBasePhysics({ speedMps: mobilSedan.maxSpeedMps }),
      model: mobilSedan,
      throttle: 1,
      brakeReverse: 0,
      steerInput: 0,
      handbrake: false,
      weather: 'cerah',
      surface: 'sawah',
      wheelRadius: 0.31,
      dt: 0.05,
      nowMs: 1000,
    });
    // Trail mempertahankan proporsi kecepatan lebih tinggi di sawah dibanding sedan
    expect(trailSawah.speedMps / motorTrail.maxSpeedMps).toBeGreaterThan(
      sedanSawah.speedMps / mobilSedan.maxSpeedMps
    );
  });

  it('localSimulation menyimpan crashDamage ter-clamp saat parkir dan memproses denda tabrak pejalan kaki', async () => {
    const { getState, unsub } = seedDrivingSimUser();
    try {
      const dealerMotor = bundle.dealer.dealers.find((d) => d.modelIds.includes('motor_bebek'))!;
      const buy = localSimulation.buyVehicle(dealerMotor.id, 'motor_bebek', motorBebek.colors[0]);
      localSimulation.mountVehicle(buy.vehicle.id);
      localSimulation.parkVehicle({
        vehicleId: buy.vehicle.id,
        x: 6,
        y: 0,
        z: -24,
        rotY: 1.5,
        distanceKm: 1.2,
        terrainType: 'road',
        crashDamage: 999, // Harus di-clamp maksimal 35
      });

      const parked = getState().vehicles.find((v) => v.id === buy.vehicle.id)!;
      expect(parked.status).toBe('parked');
      expect(parked.condition).toBeGreaterThanOrEqual(60);

      const crashRes = await localSimulation.reportPedestrianCollision({
        targetName: 'Mang Dadang',
        targetType: 'npc',
        x: 4,
        z: -24,
        zone: 'cicalengka',
      });
      expect(crashRes.skipped).toBe(false);
      expect(crashRes.fineAmount).toBeGreaterThan(0);
      expect(getState().crimeRecords.some((c) => c.offenseId === 'tabrak_pejalan')).toBe(true);
    } finally {
      unsub();
    }
  });
});
