import { describe, expect, it } from 'vitest';
import { SIM_A_QUESTIONS, SIM_C_QUESTIONS } from '../../ui/SamsatSimModal';
import type { CharacterDoc } from '../../types/game';
import {
  getDestinationsForMenu,
  getMenuLocationMeta,
} from '../../world3d/interactions/registry';
import { localSimulation, type LocalSimulationState } from '../localSimulation';
import {
  computeVehicleNotifications,
  formatRemainingCompact,
  formatVehicleParkedLabel,
  formatVehicleStatusLabel,
} from '../vehicleNotifications';
import { getDefaultVehicleConfig } from '../vehicleConfigCache';

function seedSimCitizen(uid = 'veh_ui_user_1', money = 5_000_000): {
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
    name: 'Teh Rini',
    nameLower: 'teh rini',
    gender: 'perempuan',
    skinColor: '#e0ac69',
    hairColor: '#1e1b18',
    shirtColor: '#e11d48',
    pantsColor: '#1e293b',
    money,
    health: 100,
    hygiene: 100,
    mood: 90,
    currentZone: 'cicalengka',
    skills: { komunikasi: 20, fisik: 20, hitung: 20, teknis: 20 },
    currentJob: {
      jobId: 'kurir',
      title: 'Kurir Cicalengka',
      employer: 'Ekspedisi Priangan',
      rankIndex: 0,
      rankTitle: 'Kurir Pemula',
      totalWorkSeconds: 1800,
      shiftsCompleted: 5,
      hiredAtMs: now,
      lastShiftAtMs: now,
    },
    activeShift: null,
    activeTrip: null,
    activeClinic: null,
    activeCourse: null,
    faintedCount: 0,
    lastPosition: { x: 0, y: 0, z: 0, rotY: 0 },
    reputation: 85,
    creditScore: 80,
    completedShifts: 5,
    homeless: false,
    currentHomeId: null,
    wantedLevel: 0,
    wantedUpdatedAtMs: now,
    createdAt: now,
    updatedAt: now,
  };
  localSimulation.seedFromFirestore(character, {
    uid,
    hunger: 100,
    thirst: 100,
    energy: 100,
    health: 100,
    hygiene: 100,
    mood: 90,
    lastCalculatedAt: now,
  });
  return { character, getState: () => snapshot };
}

describe('Langkah 9 — Modal UI, Location Gate, Dealer, SPBU, Bengkel & Samsat/SIM', () => {
  it('menyelaraskan soal ujian SIM C [1,0,2,1,0] dan SIM A [2,1,0,2,1] dengan grading engine', async () => {
    expect(SIM_C_QUESTIONS).toHaveLength(5);
    expect(SIM_A_QUESTIONS).toHaveLength(5);

    const { getState } = seedSimCitizen('sim_tester', 500_000);
    const wrongC = await localSimulation.takeLicenseExam('C', [0, 1, 0, 0, 1]);
    expect(wrongC.passed).toBe(false);
    expect(wrongC.score).toBe(0);

    const passC = await localSimulation.takeLicenseExam('C', [1, 0, 2, 1, 0]);
    expect(passC.passed).toBe(true);
    expect(passC.score).toBe(100);
    expect(getState().driverLicense?.simC?.active).toBe(true);

    const passA = await localSimulation.takeLicenseExam('A', [2, 1, 0, 2, 1]);
    expect(passA.passed).toBe(true);
    expect(passA.score).toBe(100);
    expect(getState().driverLicense?.simA?.active).toBe(true);
  });

  it('mendukung alur beli tunai, kredit leasing, tukar tambah, SPBU, bengkel, dan STNK', async () => {
    const { getState } = seedSimCitizen('dealer_flow_user', 6_000_000);
    const buyCash = await localSimulation.buyVehicle(
      'dealer_motor_baru',
      'motor_listrik',
      undefined,
      false,
      false
    );
    expect(buyCash.vehicle.isElectric).toBe(true);
    expect(getState().vehicles).toHaveLength(1);

    // Beli kredit mobil
    const buyLease = await localSimulation.buyVehicleOnCredit(
      'showroom_mobil_baru',
      'mobil_city',
      undefined,
      0.3,
      6
    );
    expect(buyLease.lease.termCycles).toBe(6);
    expect(getState().vehicleLeases).toHaveLength(1);
    expect(getState().vehicles).toHaveLength(2);

    // Tukar tambah motor listrik ke motor sport
    const tradeIn = await localSimulation.tradeInVehicle(
      buyCash.vehicle.id,
      'dealer_motor_baru',
      'motor_sport'
    );
    expect(tradeIn.newVehicle.modelId).toBe('motor_sport');
    expect(getState().vehicles).toHaveLength(2);

    // Bengkel: ganti oli, cat ulang, & pasang aksesori
    const paintRes = await localSimulation.serviceVehicle({
      vehicleId: tradeIn.newVehicle.id,
      serviceType: 'paint',
      color: '#16A34A',
    });
    expect(paintRes.ok).toBe(true);
    const accRes = await localSimulation.serviceVehicle({
      vehicleId: tradeIn.newVehicle.id,
      serviceType: 'accessory',
      accessoryId: 'box_kurir',
    });
    expect(accRes.ok).toBe(true);
    const updatedMotor = getState().vehicles.find((v) => v.id === tradeIn.newVehicle.id)!;
    expect(updatedMotor.color).toBe('#16A34A');
    expect(updatedMotor.accessories).toContain('box_kurir');

    // Samsat: perpanjang STNK & terbitkan plat baru
    const renew = await localSimulation.renewRegistration(updatedMotor.id);
    expect(renew.totalDue).toBeGreaterThan(0);
    const reg = await localSimulation.registerVehicle(updatedMotor.id);
    expect(reg.plateNumber).toMatch(/^D \d{4} [A-Z]{2}$/);

    // SPBU: kendarai & parkir untuk mengurangi bensin lalu isi ulang
    await localSimulation.mountVehicle(updatedMotor.id, false);
    await localSimulation.parkVehicle({
      vehicleId: updatedMotor.id,
      x: 0,
      y: 0.35,
      z: -20,
      distanceKm: 50,
    });
    const afterDrive = getState().vehicles.find((v) => v.id === updatedMotor.id)!;
    expect(afterDrive.fuel).toBeLessThan(updatedMotor.fuelCapacity);
    const refuel = await localSimulation.refuelVehicle(updatedMotor.id, 1);
    expect(refuel.cost).toBeGreaterThan(0);
  });

  it('mengelola iklan P2P kendaraan dan lookup destinasi location gating', async () => {
    const { character, getState } = seedSimCitizen('p2p_seller', 3_000_000);
    const bought = await localSimulation.buyVehicle('dealer_motor_baru', 'motor_bebek');
    const listRes = await localSimulation.listVehicleForSale({
      action: 'create',
      vehicleId: bought.vehicle.id,
      price: 110_000,
    });
    const listing = listRes.listing!;
    expect(listing).toBeDefined();
    expect(listing.status).toBe('active');
    expect(getState().vehicles[0].status).toBe('listed');

    const cancelRes = await localSimulation.listVehicleForSale({
      action: 'cancel',
      listingId: listing.id,
    });
    expect(cancelRes.ok).toBe(true);
    expect(getState().vehicles[0].status).toBe('parked');

    // Verifikasi Location Gating registry untuk menu kendaraan
    const bundle = getDefaultVehicleConfig();
    expect(getMenuLocationMeta('vehicles_garage').allowRemote).toBe(true);
    expect(getMenuLocationMeta('dealer').allowRemote).toBe(false);
    expect(getMenuLocationMeta('spbu').allowRemote).toBe(false);
    expect(getMenuLocationMeta('workshop').allowRemote).toBe(false);
    expect(getMenuLocationMeta('samsat_sim').allowRemote).toBe(false);

    const dealerDests = getDestinationsForMenu('dealer', { character });
    expect(dealerDests).toHaveLength(bundle.dealer.dealers.length);
    const spbuDests = getDestinationsForMenu('spbu', { character });
    expect(spbuDests[0]?.id).toBe('spbu_cicalengka');
    const samsatDests = getDestinationsForMenu('samsat_sim', { character });
    expect(samsatDests[0]?.id).toBe('samsat_sim');
  });

  it('menghitung notifikasi kendaraan lengkap (STNK, bensin/baterai, cicilan, derek/curian) & label parkir', async () => {
    const bundle = getDefaultVehicleConfig();
    const { getState } = seedSimCitizen('notif_tester', 6_000_000);
    const motorRes = await localSimulation.buyVehicle('dealer_motor_baru', 'motor_listrik');
    const carRes = await localSimulation.buyVehicleOnCredit(
      'showroom_mobil_baru',
      'mobil_city',
      undefined,
      0.3,
      6
    );
    const nowMs = Date.now();
    const snap = getState();

    // Kondisi normal: belum ada notifikasi krisis
    const cleanAlerts = computeVehicleNotifications({
      vehicles: snap.vehicles,
      vehicleLeases: snap.vehicleLeases,
      bills: snap.bills,
      nowMs,
      cfg: bundle.vehicles,
    });
    expect(cleanAlerts).toHaveLength(0);

    // Simulasikan 4 kondisi peringatan sekaligus
    const expiredCar = {
      ...carRes.vehicle,
      stnkExpiresAtMs: nowMs - bundle.vehicles.stnkGracePeriodMs - 60_000,
      fuel: carRes.vehicle.fuelCapacity * 0.12,
      status: 'impounded' as const,
      impoundReason: 'Parkir liar di jalan raya',
      impoundFine: 45_000,
    };
    const soonMotor = {
      ...motorRes.vehicle,
      stnkExpiresAtMs: nowMs + 5 * 60_000,
      fuel: motorRes.vehicle.fuelCapacity * 0.15,
    };
    const dueLease = {
      ...carRes.lease,
      nextDueAtMs: nowMs - 10_000,
      missedCount: 1,
    };

    const alerts = computeVehicleNotifications({
      vehicles: [expiredCar, soonMotor],
      vehicleLeases: [dueLease],
      bills: [],
      nowMs,
      cfg: bundle.vehicles,
    });

    const categories = new Set(alerts.map((a) => a.category));
    expect(categories.has('impound')).toBe(true);
    expect(categories.has('stnk')).toBe(true);
    expect(categories.has('fuel')).toBe(true);
    expect(categories.has('lease')).toBe(true);

    expect(formatVehicleParkedLabel('roadside')).toBe('Pinggir Jalan (Rawan Derek)');
    expect(formatVehicleStatusLabel('impounded')).toBe('Diderek / Disita');
    expect(formatRemainingCompact(90_000)).toBe('2m');
  });
});

