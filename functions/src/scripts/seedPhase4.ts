/**
 * Skrip Seed Fase 4 (Idempoten): config, state/treasury, suppliers, market_stats,
 * serta 3 Lapak Pasar awal agar pemain bisa langsung memulai usaha di Pasar Cicalengka.
 * Jalankan:
 *   npx tsx functions/src/scripts/seedPhase4.ts
 */
import bankConfig from '../config/bank.json';
import businessConfig from '../config/business.json';
import economyConfig from '../config/economy.json';
import productsConfig from '../config/products.json';
import taxConfig from '../config/tax.json';
import { db } from '../helpers/firebase';

const INITIAL_LAPAK_STALLS = [
  {
    id: 'prop_lapak_pasar_1',
    name: 'Lapak Pasar Sayur Blok A1',
    type: 'lapak_pasar',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_pasar_pengurus',
    ownerType: 'npc',
    ownerName: 'Pengurus Pasar Sehat Cicalengka',
    position: { x: 26, y: 0, z: -32 },
    size: { width: 4, depth: 4 },
    rooms: 1,
    condition: 86,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    baseRent: 22000,
    baseDeposit: 15000,
    baseValue: 260000,
    layout: { gridCols: 4, gridRows: 4, wallColor: '#fef9c3', floorColor: '#cbd5e1' },
    furniture: [],
  },
  {
    id: 'prop_lapak_pasar_2',
    name: 'Lapak Pasar Kuliner Blok B2',
    type: 'lapak_pasar',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_pasar_pengurus',
    ownerType: 'npc',
    ownerName: 'Pengurus Pasar Sehat Cicalengka',
    position: { x: 32, y: 0, z: -32 },
    size: { width: 4, depth: 4 },
    rooms: 1,
    condition: 88,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    baseRent: 26000,
    baseDeposit: 18000,
    baseValue: 295000,
    layout: { gridCols: 4, gridRows: 4, wallColor: '#ffedd5', floorColor: '#cbd5e1' },
    furniture: [],
  },
  {
    id: 'prop_lapak_pasar_3',
    name: 'Lapak Pasar Sembako Blok C1',
    type: 'lapak_pasar',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_pasar_pengurus',
    ownerType: 'npc',
    ownerName: 'Pengurus Pasar Sehat Cicalengka',
    position: { x: 38, y: 0, z: -32 },
    size: { width: 4, depth: 4 },
    rooms: 1,
    condition: 82,
    facilities: { electricity: true, water: false, internet: false, ac: false },
    baseRent: 19000,
    baseDeposit: 15000,
    baseValue: 230000,
    layout: { gridCols: 4, gridRows: 4, wallColor: '#dcfce7', floorColor: '#d6d3d1' },
    furniture: [],
  },
];

export async function seedPhase4Data() {
  const nowMs = Date.now();

  // 1. Seed & sinkron config Fase 4
  const configEntries: Array<[string, Record<string, unknown>]> = [
    ['bank', bankConfig as unknown as Record<string, unknown>],
    ['business', businessConfig as unknown as Record<string, unknown>],
    ['products', productsConfig as unknown as Record<string, unknown>],
    ['tax', taxConfig as unknown as Record<string, unknown>],
    ['economy', economyConfig as unknown as Record<string, unknown>],
  ];

  for (const [id, payload] of configEntries) {
    await db.collection('config').doc(id).set(payload, { merge: true });
  }

  // 2. Seed state/treasury jika belum ada
  const treasuryRef = db.collection('state').doc('treasury');
  const treasurySnap = await treasuryRef.get();
  if (!treasurySnap.exists) {
    await treasuryRef.set({
      balance: 0,
      totalTaxCollected: 0,
      incomeTaxTotal: 0,
      businessTaxTotal: 0,
      propertyTaxTotal: 0,
      marketFeeTotal: 0,
      auctionFeeTotal: 0,
      inflationIndex: 1.0,
      activeEventId: 'normal',
      activeEventUntilMs: nowMs + 7_200_000,
      estimatedMoneySupply: 0,
      updatedAtMs: nowMs,
    });
  }

  // 3. Seed suppliers grosir
  for (const sup of productsConfig.suppliers) {
    const ref = db.collection('suppliers').doc(sup.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(sup);
    }
  }

  // 4. Seed market_stats untuk seluruh katalog produk
  let seededStats = 0;
  for (const prod of productsConfig.products) {
    const ref = db.collection('market_stats').doc(prod.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        itemId: prod.id,
        name: prod.name,
        category: prod.category,
        basePrice: prod.basePrice,
        currentPrice: prod.basePrice,
        wholesalePrice: prod.wholesalePrice,
        supply: 100,
        demand: 100,
        pendingSupplyDelta: 0,
        pendingDemandDelta: 0,
        updatedAtMs: nowMs,
      });
      seededStats += 1;
    }
  }

  // 5. Seed 3 Lapak Pasar awal + listing sewa agar pemain bisa langsung buka usaha
  let seededStalls = 0;
  for (const stall of INITIAL_LAPAK_STALLS) {
    const propRef = db.collection('properties').doc(stall.id);
    const snap = await propRef.get();
    if (snap.exists) continue;

    const meters = Math.round(Math.hypot(stall.position.x - 0, stall.position.z - -46));
    const tier = meters <= 32 ? 'dekat' : meters <= 70 ? 'sedang' : 'jauh';
    const listingId = `list_${stall.id}`;

    await propRef.set({
      ...stall,
      stationDistanceMeters: meters,
      stationDistanceTier: tier,
      activeListingId: listingId,
      activeLeaseId: null,
      activeBusinessId: null,
      viewingSchedule: { open24h: true, startHour: 6, endHour: 22 },
      mortgageInfo: null,
      lastConditionDecayAtMs: nowMs,
      lastTaxAtMs: nowMs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await db.collection('property_listings').doc(listingId).set({
      id: listingId,
      propertyId: stall.id,
      propertyName: stall.name,
      propertyType: 'lapak_pasar',
      areaTag: 'pasar',
      rooms: 1,
      condition: stall.condition,
      stationDistanceTier: tier,
      ownerId: stall.ownerId,
      ownerType: 'npc',
      ownerName: stall.ownerName,
      kind: 'rent',
      price: stall.baseRent,
      deposit: stall.baseDeposit,
      status: 'active',
      createdAtMs: nowMs,
      expiresAtMs: nowMs + 30 * 24 * 3_600_000,
    });

    seededStalls += 1;
  }

  console.log(
    `Seed Fase 4 selesai: ${seededStats} market_stats & ${seededStalls} lapak pasar dibuat.`
  );
}

if (require.main === module) {
  seedPhase4Data()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed Fase 4 gagal:', err);
      process.exit(1);
    });
}
