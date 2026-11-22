import { describe, expect, it } from 'vitest';
import { getDefaultVehicleConfig } from '../vehicleConfigCache';
import { localSimulation, type LocalSimulationState } from '../localSimulation';
import type { RTDBVehicle } from '../../types/game';
import {
  VEHICLE_CULL_RADIUS_METERS,
  VEHICLE_HEARTBEAT_MS,
  VEHICLE_LOD_SIMPLE_RADIUS_METERS,
  VEHICLE_STALE_MS,
  allocateNextPassengerSeat,
  computeAdaptiveVehicleSyncIntervalMs,
  computeWorldSeatPosition,
  cullRemoteVehicles,
  getAvailablePassengerSeats,
  lerpAngleRad,
  normalizeAngleRad,
  shouldSendVehicleSyncUpdate,
  stepInterpolatedVehiclePose,
  type VehicleSyncRecord,
  type VehicleSyncSample,
} from '../../world3d/vehicles/vehicleMultiplayer';

function makeBaseSample(overrides: Partial<VehicleSyncSample> = {}): VehicleSyncSample {
  return {
    vehicleId: 'veh_1',
    x: 10,
    y: 0,
    z: -20,
    rotY: 0,
    vx: 0,
    vz: 0,
    speed: 0,
    steerAngle: 0,
    headlights: false,
    turnSignal: 'off',
    hornAtMs: 0,
    ...overrides,
  };
}

function makeRTDBVehicle(overrides: Partial<RTDBVehicle> = {}): RTDBVehicle {
  return {
    vehicleId: 'veh_remote_1',
    ownerId: 'driver_uid',
    modelId: 'mobil_mpv',
    category: 'mobil',
    color: '#2563eb',
    plateNumber: 'D 1234 AB',
    zone: 'cicalengka',
    driverId: 'driver_uid',
    driverName: 'Kang Budi',
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    vx: 0,
    vz: 0,
    speed: 0,
    steerAngle: 0,
    headlights: false,
    turnSignal: 'off',
    hornAtMs: 0,
    maxSpeed: 24,
    seatCapacity: 7,
    updatedAt: 100_000,
    ...overrides,
  };
}

function seedPassengerSimUser(uid = 'test_passenger_1', money = 80_000_000): {
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
      name: 'Neng Penumpang',
      nameLower: 'neng penumpang',
      gender: 'perempuan',
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

describe('Langkah 9 — Multiplayer Kendaraan RTDB (Sync, Interpolasi, Culling, Penumpang)', () => {
  it('menormalisasi sudut rotY ke (-PI, PI] dan melakukan interpolasi terpendek melewati batas PI/-PI', () => {
    const a = normalizeAngleRad(Math.PI * 3.5);
    expect(a).toBeGreaterThan(-Math.PI);
    expect(a).toBeLessThanOrEqual(Math.PI);
    expect(Math.abs(a + Math.PI / 2)).toBeLessThan(1e-6);

    // Dari +170 derajat menuju -170 derajat harus melewati +PI, bukan memutar balik lewat 0
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const mid = lerpAngleRad(from, to, 0.5);
    expect(Math.abs(Math.abs(mid) - Math.PI)).toBeLessThan(0.05);
  });

  it('menghitung interval adaptif dan menghemat tulis RTDB saat diam kecuali perubahan diskret/heartbeat', () => {
    expect(computeAdaptiveVehicleSyncIntervalMs(12, 0)).toBe(100);
    expect(computeAdaptiveVehicleSyncIntervalMs(2, 0.25)).toBe(100);
    expect(computeAdaptiveVehicleSyncIntervalMs(4, 0.02)).toBe(150);
    expect(computeAdaptiveVehicleSyncIntervalMs(0.8, 0)).toBe(260);

    const prev: VehicleSyncRecord = {
      ...makeBaseSample(),
      sentAtMs: 10_000,
    };

    // Diam sempurna sebelum heartbeat 8 detik -> SKIP
    expect(shouldSendVehicleSyncUpdate(prev, makeBaseSample(), 12_000)).toBe(false);

    // Perubahan diskret (klakson/lampu/sein) langsung terkirim meski < 60ms
    expect(
      shouldSendVehicleSyncUpdate(prev, makeBaseSample({ hornAtMs: 10_020 }), 10_020)
    ).toBe(true);
    expect(
      shouldSendVehicleSyncUpdate(prev, makeBaseSample({ headlights: true }), 10_030)
    ).toBe(true);
    expect(
      shouldSendVehicleSyncUpdate(prev, makeBaseSample({ turnSignal: 'left' }), 10_040)
    ).toBe(true);

    // Bergerak cepat -> patuhi interval 100ms
    expect(
      shouldSendVehicleSyncUpdate(
        prev,
        makeBaseSample({ x: 11, speed: 10, vx: 10 }),
        10_070
      )
    ).toBe(false);
    expect(
      shouldSendVehicleSyncUpdate(
        prev,
        makeBaseSample({ x: 12, speed: 10, vx: 10 }),
        10_110
      )
    ).toBe(true);

    // Paket berhenti wajib dikirim segera saat kendaraan baru saja melambat ke 0
    const movingPrev: VehicleSyncRecord = {
      ...makeBaseSample({ speed: 8, vx: 8 }),
      sentAtMs: 20_000,
    };
    expect(
      shouldSendVehicleSyncUpdate(movingPrev, makeBaseSample({ speed: 0, vx: 0 }), 20_070)
    ).toBe(true);

    // Heartbeat 8 detik saat parkir/diam
    expect(
      shouldSendVehicleSyncUpdate(prev, makeBaseSample(), 10_000 + VEHICLE_HEARTBEAT_MS)
    ).toBe(true);
  });

  it('melakukan culling zona, kadaluwarsa 90s, jarak 78m, LOD 42m, dan melindungi kendaraan yang ditumpangi', () => {
    const nowMs = 500_000;
    const vehicles: Record<string, RTDBVehicle> = {
      near_full: makeRTDBVehicle({ vehicleId: 'near_full', x: 20, z: 0, updatedAt: nowMs - 500 }),
      mid_simple: makeRTDBVehicle({
        vehicleId: 'mid_simple',
        x: VEHICLE_LOD_SIMPLE_RADIUS_METERS + 10,
        z: 0,
        updatedAt: nowMs - 500,
      }),
      far_culled: makeRTDBVehicle({
        vehicleId: 'far_culled',
        x: VEHICLE_CULL_RADIUS_METERS + 15,
        z: 0,
        updatedAt: nowMs - 500,
      }),
      passenger_far_kept: makeRTDBVehicle({
        vehicleId: 'passenger_far_kept',
        x: VEHICLE_CULL_RADIUS_METERS + 40,
        z: 0,
        updatedAt: nowMs - 500,
        passengers: {
          me_uid: {
            uid: 'me_uid',
            name: 'Saya',
            seatIndex: 1,
            joinedAt: nowMs - 5000,
          },
        },
      }),
      other_zone: makeRTDBVehicle({
        vehicleId: 'other_zone',
        zone: 'bandung',
        x: 5,
        z: 0,
        updatedAt: nowMs - 500,
      }),
      stale: makeRTDBVehicle({
        vehicleId: 'stale',
        x: 5,
        z: 0,
        updatedAt: nowMs - VEHICLE_STALE_MS - 1000,
      }),
      own_driving: makeRTDBVehicle({
        vehicleId: 'own_driving',
        driverId: 'me_uid',
        x: 3,
        z: 0,
        updatedAt: nowMs - 100,
      }),
    };

    const culled = cullRemoteVehicles(vehicles, {
      myUid: 'me_uid',
      myZone: 'cicalengka',
      myX: 0,
      myZ: 0,
      activeDriveVehicleId: 'own_driving',
      nowMs,
    });

    const ids = culled.map((c) => c.vehicle.vehicleId);
    expect(ids).toEqual(['near_full', 'mid_simple', 'passenger_far_kept']);
    expect(culled[0].lod).toBe('full');
    expect(culled[1].lod).toBe('simple');
    expect(culled[2].lod).toBe('full');
    expect(culled[2].isLocalPassenger).toBe(true);
  });

  it('menginterpolasi posisi dead-reckoning dengan cap 0.25s dan melakukan snap saat teleport > 18m', () => {
    const smooth = stepInterpolatedVehiclePose(
      { x: 0, y: 0, z: 0, rotY: 0 },
      { x: 2, y: 0, z: 0, rotY: 0.4, vx: 10, vz: 0, updatedAt: 10_000 },
      { nowServerMs: 10_100, dt: 0.05 }
    );
    expect(smooth.x).toBeGreaterThan(0.5);
    expect(smooth.x).toBeLessThan(3.1);
    expect(smooth.rotY).toBeGreaterThan(0);

    // Dead-reckoning dibatasi maksimal 0.25s meski paket berusia 2 detik
    const capped = stepInterpolatedVehiclePose(
      { x: 4, y: 0, z: 0, rotY: 0 },
      { x: 4, y: 0, z: 0, rotY: 0, vx: 10, vz: 0, updatedAt: 10_000 },
      { nowServerMs: 12_000, dt: 0.1 }
    );
    // Target prediksi max = 4 + 10 * 0.25 = 6.5 -> hasil selalu <= 6.5
    expect(capped.x).toBeLessThanOrEqual(6.5);

    // Jarak > 18m -> snap langsung
    const snapped = stepInterpolatedVehiclePose(
      { x: 0, y: 0, z: 0, rotY: 0 },
      { x: 40, y: 0, z: -20, rotY: 1.2, vx: 0, vz: 0, updatedAt: 10_000 },
      { nowServerMs: 10_050, dt: 0.016 }
    );
    expect(snapped.x).toBe(40);
    expect(snapped.z).toBe(-20);
  });

  it('mengalokasikan kursi penumpang kosong terendah dan menghitung koordinat kursi dunia', () => {
    expect(allocateNextPassengerSeat(undefined, 1)).toBeNull();
    expect(allocateNextPassengerSeat(undefined, 2)).toBe(1);
    expect(
      allocateNextPassengerSeat(
        {
          u1: { uid: 'u1', name: 'A', seatIndex: 1, joinedAt: 1 },
        },
        2
      )
    ).toBeNull();
    expect(
      allocateNextPassengerSeat(
        {
          u1: { uid: 'u1', name: 'A', seatIndex: 2, joinedAt: 1 },
        },
        4
      )
    ).toBe(1);

    const veh = makeRTDBVehicle({
      seatCapacity: 4,
      passengers: { u1: { uid: 'u1', name: 'A', seatIndex: 1, joinedAt: 1 } },
    });
    expect(getAvailablePassengerSeats(veh)).toBe(2);

    // Rotasi 0: lokal (ox, oy, oz) -> dunia langsung
    const pos0 = computeWorldSeatPosition(10, 0, 20, 0, [0.5, 1, -0.5]);
    expect(pos0[0]).toBeCloseTo(10.5, 5);
    expect(pos0[1]).toBeCloseTo(1, 5);
    expect(pos0[2]).toBeCloseTo(19.5, 5);

    // Rotasi +90deg (+PI/2): depan (+Z) menghadap +X, offset lokal +Z menjadi +X dunia
    const pos90 = computeWorldSeatPosition(0, 0, 0, Math.PI / 2, [0, 0.5, 2]);
    expect(pos90[0]).toBeCloseTo(2, 5);
    expect(pos90[2]).toBeCloseTo(0, 5);
  });

  it('localSimulation menampung penumpang sesuai kapasitas kursi dan membersihkan penumpang saat parkir', () => {
    const bundle = getDefaultVehicleConfig();
    const { getState, unsub } = seedPassengerSimUser();
    try {
      const dealerMobil = bundle.dealer.dealers.find((d) => d.modelIds.includes('mobil_sedan'))!;
      const buySedan = localSimulation.buyVehicle(dealerMobil.id, 'mobil_sedan', '#ef4444');
      localSimulation.mountVehicle(buySedan.vehicle.id, false);

      // Penumpang naik ke kendaraan 4 kursi -> dapat seatIndex 1
      const passRes = localSimulation.mountVehicle(buySedan.vehicle.id, true);
      expect(passRes.asPassenger).toBe(true);
      expect(passRes.seatIndex).toBeGreaterThanOrEqual(1);
      expect(getState().character?.passengerVehicleId).toBe(buySedan.vehicle.id);

      // Parkir / dismount sebagai driver membersihkan semua penumpang
      localSimulation.parkVehicle({
        vehicleId: buySedan.vehicle.id,
        x: 5,
        y: 0,
        z: -10,
        rotY: 0,
      });
      const parked = getState().vehicles.find((v) => v.id === buySedan.vehicle.id)!;
      expect(parked.status).toBe('parked');
      expect(parked.passengerIds).toEqual([]);
      expect(getState().character?.passengerVehicleId).toBeNull();
    } finally {
      unsub();
    }
  });
});
