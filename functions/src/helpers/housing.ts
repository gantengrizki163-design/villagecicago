import type { Database } from 'firebase-admin/database';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import furnitureConfig from '../config/furniture.json';
import housingConfig from '../config/housing.json';
import { GAME_DAY_DURATION_MS, GAME_EPOCH_MS, appendTransaction } from './phase2';

export interface PlacedFurnitureItem {
  instanceId: string;
  furnitureId: string;
  gx: number;
  gz: number;
  rot: number;
  ownerUid?: string;
}

export interface PropertyFacilities {
  electricity: boolean;
  water: boolean;
  internet: boolean;
  ac: boolean;
}

export function isValidSimpleId(val: unknown): val is string {
  return typeof val === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(val.trim());
}

export async function getPlayerWorldPos(
  rtdb: Database,
  uid: string,
  charData: DocumentData
): Promise<{ x: number; z: number }> {
  const snap = await rtdb.ref(`players/${uid}`).get();
  const val = snap.exists() ? (snap.val() as { x?: number; z?: number }) : null;
  const x = typeof val?.x === 'number' ? val.x : Number(charData.lastPosition?.x ?? 999);
  const z = typeof val?.z === 'number' ? val.z : Number(charData.lastPosition?.z ?? 999);
  return { x, z };
}

export function getFurnitureCatalogItem(furnitureId: string) {
  return furnitureConfig.items.find((i) => i.id === furnitureId) ?? null;
}

export function computeLazyPropertyCondition(
  baseCondition: number,
  lastDecayAtMs: number,
  nowMs: number
): number {
  const elapsedDays = Math.max(0, nowMs - lastDecayAtMs) / GAME_DAY_DURATION_MS;
  const drop = elapsedDays * housingConfig.valuationFormula.conditionDecayPerGameDay;
  return Math.max(15, Math.min(100, Math.round((baseCondition - drop) * 10) / 10));
}

export function computeDynamicPropertyValue(
  prop: {
    baseValue: number;
    areaTag: string;
    stationDistanceTier: string;
    condition: number;
    furniture?: PlacedFurnitureItem[];
  },
  activeAreaListingsCount = 0
): number {
  const vf = housingConfig.valuationFormula;
  const areaMult =
    (vf.areaMultipliers as Record<string, number>)[prop.areaTag] ?? 1.0;
  const stationBonus =
    (vf.stationTierBonus as Record<string, number>)[prop.stationDistanceTier] ?? 0;
  const condFactor =
    vf.conditionMinFactor + (Math.max(0, Math.min(100, prop.condition)) / 100) * vf.conditionWeight;

  const furnitureValue = (prop.furniture ?? []).reduce((sum, pf) => {
    const item = getFurnitureCatalogItem(pf.furnitureId);
    return sum + (item ? item.price * vf.furnitureValueShare : 0);
  }, 0);

  const supplyPenalty = Math.min(
    vf.maxSupplyPenalty,
    Math.max(0, activeAreaListingsCount) * vf.listingSupplyPenaltyPerListing
  );

  const raw = prop.baseValue * areaMult * (1 + stationBonus - supplyPenalty) * condFactor + furnitureValue;
  return Math.max(150_000, Math.round(raw / 1000) * 1000);
}

export function computeHomeRecoveryProfile(prop: {
  type: string;
  condition: number;
  furniture?: PlacedFurnitureItem[];
}) {
  const living = housingConfig.livingAndSleep;
  const typeMeta =
    (housingConfig.propertyTypes as Record<string, { recoveryBonus?: number }>)[prop.type];
  const typeBonus = Number(typeMeta?.recoveryBonus ?? 0.1);
  const conditionBonus = (Math.max(0, Math.min(100, prop.condition)) / 100) * living.homeConditionBonusMax;

  let bedSleepBonus = 0;
  let furnitureMoodBonus = 0;
  let foodBonus = 0;

  for (const pf of prop.furniture ?? []) {
    const cat = getFurnitureCatalogItem(pf.furnitureId);
    if (!cat) continue;
    if (cat.sleepBonus && cat.sleepBonus > bedSleepBonus) {
      bedSleepBonus = cat.sleepBonus;
    }
    furnitureMoodBonus += Number(cat.moodBonus ?? 0);
    if (cat.foodBonus) {
      foodBonus = Math.min(0.3, foodBonus + Number(cat.foodBonus));
    }
  }

  return {
    energyMultiplier:
      living.homeRecoveryMultiplierBase + typeBonus + conditionBonus + bedSleepBonus,
    moodBonus: Math.min(25, Math.round(furnitureMoodBonus * 0.5)),
    foodBonus,
  };
}

export function getGameHourFromNow(nowMs: number): number {
  const elapsed = Math.max(0, nowMs - GAME_EPOCH_MS);
  const progress = (elapsed % GAME_DAY_DURATION_MS) / GAME_DAY_DURATION_MS;
  return Math.floor(progress * 24) % 24;
}

export function isShelterOpenAtHour(hour: number): boolean {
  const { openStartHour, openEndHour } = housingConfig.homelessSettings.shelter;
  if (openStartHour > openEndHour) {
    return hour >= openStartHour || hour < openEndHour;
  }
  return hour >= openStartHour && hour < openEndHour;
}

export function computeUtilityCostForProperty(facilities: PropertyFacilities): {
  electricity: number;
  water: number;
  internet: number;
} {
  const u = housingConfig.livingAndSleep.utilityCostsPerCycle;
  return {
    electricity: facilities.electricity ? u.electricityBase + (facilities.ac ? u.acSurcharge : 0) : 0,
    water: facilities.water ? u.waterBase : 0,
    internet: facilities.internet ? u.internetBase : 0,
  };
}

export interface LazyHousingSyncResult {
  evicted: boolean;
  newHousingBills: number;
}

/**
 * Evaluasi lazy saat login/syncPlayerState atau buka tagihan:
 * - Hitung tagihan sewa & utilitas yang terlewat dari kontrak sewa aktif
 * - Cek batas tunggakan untuk pengusiran lazy + pindahkan furnitur penyewa ke inventory
 * - Hitung tagihan PBB untuk properti milik pemain
 */
export async function syncLazyHousingState(
  firestore: Firestore,
  uid: string,
  nowMs: number
): Promise<LazyHousingSyncResult> {
  const charRef = firestore.collection('characters').doc(uid);
  const charSnapPre = await charRef.get();
  if (!charSnapPre.exists) return { evicted: false, newHousingBills: 0 };

  const preData = charSnapPre.data()!;
  const activeLeaseId = typeof preData.activeLeaseId === 'string' ? preData.activeLeaseId : null;

  const [ownedPropsSnap, unpaidRentSnap] = await Promise.all([
    firestore.collection('properties').where('ownerId', '==', uid).limit(10).get(),
    activeLeaseId
      ? charRef
          .collection('bills')
          .where('uid', '==', uid)
          .where('status', '==', 'unpaid')
          .limit(30)
          .get()
      : Promise.resolve(null),
  ]);

  const ownedPropIds = ownedPropsSnap.docs.map((d) => d.id);
  const existingLeaseBills = unpaidRentSnap ? unpaidRentSnap.docs : [];

  return await firestore.runTransaction(async (tx) => {
    const charDoc = await tx.get(charRef);
    if (!charDoc.exists) return { evicted: false, newHousingBills: 0 };
    const charData = charDoc.data()!;
    const leaseId = typeof charData.activeLeaseId === 'string' ? charData.activeLeaseId : null;

    const leaseRef = leaseId ? firestore.collection('leases').doc(leaseId) : null;
    const leaseDoc = leaseRef ? await tx.get(leaseRef) : null;
    const leaseData = leaseDoc?.exists ? leaseDoc.data()! : null;

    const leasePropRef =
      leaseData && typeof leaseData.propertyId === 'string'
        ? firestore.collection('properties').doc(leaseData.propertyId)
        : null;
    const leasePropDoc = leasePropRef ? await tx.get(leasePropRef) : null;

    const ownedPropDocs = await Promise.all(
      ownedPropIds.map((id) => tx.get(firestore.collection('properties').doc(id)))
    );

    const ls = housingConfig.leaseSettings;
    let newHousingBills = 0;
    let evicted = false;

    // 1. Proses kontrak sewa aktif (sewa + utilitas + cek tunggakan pengusiran lazy)
    if (leaseDoc?.exists && leaseData && leaseData.status === 'active' && leasePropDoc?.exists) {
      const propData = leasePropDoc.data()!;
      const propId = propData.id as string;
      const startAtMs = Number(leaseData.startAtMs || nowMs);
      const periodMs = Number(leaseData.periodMs || ls.weeklyPeriodMs);
      const elapsed = Math.max(0, nowMs - startAtMs);
      const totalPeriodsPassed = Math.floor(elapsed / periodMs);
      const lastBilledPeriod = Number(leaseData.lastBilledPeriod || 0);

      // Hitung porsi tenant vs roommates
      const roommates = Array.isArray(leaseData.roommates)
        ? (leaseData.roommates as Array<{ uid: string; sharePercent: number }>)
        : [];
      const totalRoommateShare = roommates.reduce((s, r) => s + Number(r.sharePercent || 0), 0);
      const mySharePercent =
        leaseData.tenantId === uid
          ? Math.max(10, 100 - totalRoommateShare)
          : Number(roommates.find((r) => r.uid === uid)?.sharePercent ?? 0);

      if (totalPeriodsPassed > lastBilledPeriod && mySharePercent > 0) {
        const startP = Math.max(lastBilledPeriod + 1, totalPeriodsPassed - 2);
        const facilities: PropertyFacilities = {
          electricity: Boolean(propData.facilities?.electricity ?? true),
          water: Boolean(propData.facilities?.water ?? true),
          internet: Boolean(propData.facilities?.internet ?? false),
          ac: Boolean(propData.facilities?.ac ?? false),
        };
        const utilCosts = computeUtilityCostForProperty(facilities);

        for (let p = startP; p <= totalPeriodsPassed; p++) {
          const dueAtMs = startAtMs + p * periodMs;
          const myRent = Math.round((Number(leaseData.rent || 0) * mySharePercent) / 100);
          if (myRent > 0) {
            const rentBillRef = charRef.collection('bills').doc(`lease_${leaseId}_rent_p${p}`);
            tx.set(rentBillRef, {
              uid,
              billType: 'rent',
              title: `Sewa ${String(propData.name)} (Periode ${p})`,
              periodIndex: p,
              baseAmount: myRent,
              lateFee: 0,
              status: 'unpaid',
              propertyId: propId,
              leaseId,
              dueAtMs,
            });
            newHousingBills += 1;
          }

          if (utilCosts.electricity > 0) {
            const myElec = Math.round((utilCosts.electricity * mySharePercent) / 100);
            tx.set(charRef.collection('bills').doc(`lease_${leaseId}_elec_p${p}`), {
              uid,
              billType: 'electricity',
              title: `Listrik ${String(propData.name)} (P${p})`,
              periodIndex: p,
              baseAmount: myElec,
              lateFee: 0,
              status: 'unpaid',
              propertyId: propId,
              leaseId,
              dueAtMs,
            });
            newHousingBills += 1;
          }
          if (utilCosts.water > 0) {
            const myWater = Math.round((utilCosts.water * mySharePercent) / 100);
            tx.set(charRef.collection('bills').doc(`lease_${leaseId}_water_p${p}`), {
              uid,
              billType: 'water',
              title: `Air PDAM ${String(propData.name)} (P${p})`,
              periodIndex: p,
              baseAmount: myWater,
              lateFee: 0,
              status: 'unpaid',
              propertyId: propId,
              leaseId,
              dueAtMs,
            });
            newHousingBills += 1;
          }
          if (utilCosts.internet > 0) {
            const myNet = Math.round((utilCosts.internet * mySharePercent) / 100);
            tx.set(charRef.collection('bills').doc(`lease_${leaseId}_net_p${p}`), {
              uid,
              billType: 'internet',
              title: `Internet Wi-Fi ${String(propData.name)} (P${p})`,
              periodIndex: p,
              baseAmount: myNet,
              lateFee: 0,
              status: 'unpaid',
              propertyId: propId,
              leaseId,
              dueAtMs,
            });
            newHousingBills += 1;
          }
        }

        tx.update(leaseRef!, {
          lastBilledPeriod: totalPeriodsPassed,
          nextDueAtMs: startAtMs + (totalPeriodsPassed + 1) * periodMs,
        });
      }

      // Hitung tunggakan sewa yang sudah melewati grace period
      const overdueLeaseBills = existingLeaseBills.filter((b) => {
        const bd = b.data();
        return (
          bd.leaseId === leaseId &&
          bd.billType === 'rent' &&
          nowMs > Number(bd.dueAtMs) + ls.gracePeriodMs
        );
      });

      if (
        leaseData.tenantId === uid &&
        overdueLeaseBills.length >= ls.maxMissedPeriodsBeforeEviction
      ) {
        evicted = true;

        // Pindahkan furnitur milik penyewa ke inventory
        const currentFurniture = Array.isArray(propData.furniture)
          ? (propData.furniture as PlacedFurnitureItem[])
          : [];
        const remainingFurniture: PlacedFurnitureItem[] = [];
        const returnedCounts: Record<string, number> = {};

        for (const pf of currentFurniture) {
          if (pf.ownerUid === uid) {
            returnedCounts[pf.furnitureId] = (returnedCounts[pf.furnitureId] || 0) + 1;
          } else {
            remainingFurniture.push(pf);
          }
        }

        for (const [fId, qty] of Object.entries(returnedCounts)) {
          const cat = getFurnitureCatalogItem(fId);
          tx.set(
            charRef.collection('inventory').doc(fId),
            {
              uid,
              itemId: fId,
              category: 'furniture',
              name: cat?.name ?? fId,
              quantity: qty,
              updatedAtMs: nowMs,
            },
            { merge: true }
          );
        }

        tx.update(leaseRef!, {
          status: 'evicted',
          missedPeriods: overdueLeaseBills.length,
          endedAtMs: nowMs,
        });

        tx.update(leasePropRef!, {
          activeLeaseId: null,
          furniture: remainingFurniture,
          updatedAtMs: nowMs,
        });

        // Cabut akses tenant & roommates
        const accessUids = new Set<string>([
          String(leaseData.tenantId),
          ...roommates.map((r) => r.uid),
        ]);
        for (const mUid of accessUids) {
          tx.delete(
            firestore.collection('property_access').doc(propId).collection('members').doc(mUid)
          );
        }

        for (const b of overdueLeaseBills) {
          tx.update(b.ref, { status: 'defaulted' });
        }

        const stillOwnsHome = ownedPropDocs.some((d) => d.exists);
        const fallbackOwnedId = stillOwnsHome ? ownedPropDocs.find((d) => d.exists)!.id : null;

        tx.update(charRef, {
          currentHomeId: fallbackOwnedId,
          activeLeaseId: null,
          homeless: !fallbackOwnedId,
          reputation: Math.max(0, Number(charData.reputation ?? 60) - 12),
          updatedAtMs: nowMs,
        });

        appendTransaction(tx, firestore, uid, {
          type: 'penalty',
          category: 'pengusiran',
          amount: 0,
          balanceAfter: Number(charData.money || 0),
          description: `Pengusiran dari ${String(propData.name)} karena menunggak sewa`,
          nowMs,
        });
      }
    }

    // 2. PBB periodik lazy untuk properti milik pemain sendiri
    const cycleMs = ls.weeklyPeriodMs;
    for (const pDoc of ownedPropDocs) {
      if (!pDoc.exists) continue;
      const pd = pDoc.data()!;
      const lastTaxAtMs = Number(pd.lastTaxAtMs || pd.createdAtMs || nowMs);
      if (nowMs - lastTaxAtMs >= cycleMs) {
        const periods = Math.min(2, Math.floor((nowMs - lastTaxAtMs) / cycleMs));
        const pbbAmount = Math.max(
          5000,
          Math.round((Number(pd.baseValue || 500_000) * ls.propertyTaxRatePerCycle) / 500) * 500
        );
        const periodTag = Math.floor(nowMs / cycleMs);
        tx.set(charRef.collection('bills').doc(`pbb_${pDoc.id}_${periodTag}`), {
          uid,
          billType: 'property_tax',
          title: `PBB ${String(pd.name)}`,
          periodIndex: periodTag,
          baseAmount: pbbAmount * periods,
          lateFee: 0,
          status: 'unpaid',
          propertyId: pDoc.id,
          dueAtMs: nowMs + ls.gracePeriodMs,
        });
        tx.update(pDoc.ref, { lastTaxAtMs: nowMs });
        newHousingBills += 1;
      }
    }

    return { evicted, newHousingBills };
  });
}

export function buildMemberAccessRef(firestore: Firestore, propertyId: string, uid: string) {
  return firestore.collection('property_access').doc(propertyId).collection('members').doc(uid);
}
