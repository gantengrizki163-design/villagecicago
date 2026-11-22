import { describe, expect, it } from 'vitest';
import type { CharacterDoc, VehicleDoc } from '../../types/game';
import { localSimulation, type LocalSimulationState } from '../localSimulation';
import { computeBestVehicleCargoBonus } from '../vehicleConfigCache';

function seedSimCitizen(
  uid: string,
  name: string,
  money = 25_000_000,
  reset = true
): {
  character: CharacterDoc;
  getState: () => LocalSimulationState;
} {
  if (reset) {
    localSimulation.reset();
  }
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
    skills: { komunikasi: 20, fisik: 20, hitung: 20, teknis: 20 },
    currentJob: null,
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
  if (reset) {
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
  } else {
    localSimulation.switchSimulatedCitizen(character);
  }
  return { character, getState: () => snapshot };
}

describe('Langkah 10 — Ekonomi Kendaraan, Bengkel, Dealer Pemain & Kapasitas Grosir', () => {
  it('menghitung kapasitas bagasi kendaraan + aksesori dan menerapkannya pada batas kulakan grosir', () => {
    const baseCargo = computeBestVehicleCargoBonus([]);
    expect(baseCargo.trunkCapacity).toBe(0);
    expect(baseCargo.maxWholesaleQty).toBe(50);

    const pickup: Pick<VehicleDoc, 'id' | 'modelId' | 'name' | 'status' | 'accessories'> = {
      id: 'v_pickup',
      modelId: 'mobil_pickup',
      name: 'Galuh Niaga Bak',
      status: 'parked',
      accessories: [],
    };
    expect(computeBestVehicleCargoBonus([pickup])).toMatchObject({
      trunkCapacity: 60,
      maxWholesaleQty: 110,
    });

    const trukWithRack: Pick<VehicleDoc, 'id' | 'modelId' | 'name' | 'status' | 'accessories'> = {
      id: 'v_truk',
      modelId: 'mobil_truk_kecil',
      name: 'Priangan Logistik Box',
      status: 'parked',
      accessories: ['rak_atap'],
    };
    expect(computeBestVehicleCargoBonus([pickup, trukWithRack])).toMatchObject({
      trunkCapacity: 100,
      maxWholesaleQty: 150,
    });

    const listedOnly: Pick<VehicleDoc, 'id' | 'modelId' | 'name' | 'status' | 'accessories'> = {
      ...trukWithRack,
      status: 'listed',
    };
    expect(computeBestVehicleCargoBonus([listedOnly]).maxWholesaleQty).toBe(50);
  });

  it('memvalidasi kulakan grosir dinamis berdasarkan kepemilikan pickup/truk kecil', () => {
    const { getState } = seedSimCitizen('cargo_owner', 'Kang Dedi', 30_000_000);
    localSimulation.buyProperty('prop_ruko_pasar_2');
    const biz = localSimulation.createBusiness('kelontong', 'Toko Dedi Jaya', 'prop_ruko_pasar_2', 2_000_000);

    // Tanpa kendaraan: max 50 unit per transaksi
    expect(() => localSimulation.buyStock(biz.business.id, 'beras_5kg', 60, 'business')).toThrow(
      /Kapasitas angkut grosir maksimal 50/
    );

    // Beli pickup (bagasi 60 -> max 110 unit/beli)
    localSimulation.buyVehicle('showroom_mobil_baru', 'mobil_pickup');
    const bulkRes = localSimulation.buyStock(biz.business.id, 'beras_5kg', 95, 'business');
    expect(bulkRes.ok).toBe(true);
    expect(bulkRes.qty).toBe(95);
    const stocked = getState().businessStock[biz.business.id]?.find((s) => s.itemId === 'beras_5kg');
    expect(stocked?.qty).toBe(95);
  });

  it('menyalurkan omzet servis bengkel pemain ke kas bisnis dan menyetor pajak 5% ke kas desa', () => {
    const { getState } = seedSimCitizen('bengkel_owner', 'Mang Ujang', 30_000_000);
    localSimulation.buyProperty('prop_ruko_pasar_2');
    const bizRes = localSimulation.createBusiness('bengkel', 'Bengkel Ujang Motor', 'prop_ruko_pasar_2', 500_000);
    const kasAwal = bizRes.business.cash;

    const veh = localSimulation.buyVehicle('dealer_motor_baru', 'motor_matic');
    const srv = localSimulation.serviceVehicle({
      vehicleId: veh.vehicle.id,
      serviceType: 'paint',
      color: '#16A34A',
      businessId: bizRes.business.id,
    });
    expect(srv.ok).toBe(true);

    const expectedTax = Math.round(srv.cost * 0.05);
    const expectedNet = srv.cost - expectedTax;
    const updatedBiz = getState().businesses.find((b) => b.id === bizRes.business.id)!;
    expect(updatedBiz.cash).toBe(kasAwal + expectedNet);
    expect(updatedBiz.totalRevenue).toBe(expectedNet);
    expect(getState().vehicleServiceLogs[0]?.providerType).toBe('player_business');
    expect(getState().vehicleServiceLogs[0]?.businessId).toBe(bizRes.business.id);
  });

  it('menghubungkan penjualan showroom dealer pemain ke Bursa P2P, kas bisnis & pajak balik nama 3%', () => {
    const { getState } = seedSimCitizen('dealer_seller', 'Pak H. Asep', 40_000_000);
    localSimulation.buyProperty('prop_ruko_pasar_2');
    const dealerBiz = localSimulation.createBusiness(
      'dealer',
      'Showroom Asep Priangan',
      'prop_ruko_pasar_2',
      1_000_000
    );
    const kasDealerAwal = dealerBiz.business.cash;

    const unit = localSimulation.buyVehicle('dealer_motor_baru', 'motor_bebek');
    const listed = localSimulation.listVehicleForSale({
      action: 'create',
      vehicleId: unit.vehicle.id,
      price: 110_000,
      businessId: dealerBiz.business.id,
    });
    expect(listed.listing?.sellerBusinessId).toBe(dealerBiz.business.id);

    // Simulasikan pembeli lain (ganti karakter aktif di localSimulation tanpa reset daftar kendaraan/bisnis)
    seedSimCitizen('buyer_warga', 'Teh Sari', 5_000_000, false);
    const transfer = localSimulation.transferVehicle(listed.listing!.id);
    expect(transfer.ok).toBe(true);
    expect(transfer.transferTax).toBe(Math.round(110_000 * 0.03));

    const dealerAfter = getState().businesses.find((b) => b.id === dealerBiz.business.id)!;
    expect(dealerAfter.cash).toBe(kasDealerAwal + (transfer.sellerNet ?? 0));
    expect(getState().vehicles.some((v) => v.id === unit.vehicle.id && v.ownerId === 'buyer_warga')).toBe(
      true
    );
  });
});
