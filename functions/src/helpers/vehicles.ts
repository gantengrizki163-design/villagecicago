import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import dealerJson from '../config/dealer.json';
import trafficJson from '../config/traffic.json';
import vehiclesJson from '../config/vehicles.json';
import { clampCreditScore } from './bank';
import { appendLedger } from './ledger';
import { appendTransaction, GAME_DAY_DURATION_MS } from './phase2';

export type VehicleCategory = 'motor' | 'mobil';

export interface VehicleModelCfg {
  id: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  subType: string;
  sellable: boolean;
  isElectric?: boolean;
  requiredSim?: 'C' | 'A';
  maxSpeedMps: number;
  acceleration: number;
  handling: number;
  tankCapacity: number;
  consumptionPerKm: number;
  seats: number;
  trunkCapacity: number;
  newPrice: number;
  usedPriceMin: number;
  usedPriceMax: number;
  serviceCostBase: number;
  annualTax: number;
  wearRatePerKm: number;
  colors: string[];
  dimensions: { width: number; height: number; length: number };
}

export interface VehicleAccessoryCfg {
  id: string;
  label: string;
  category: 'motor' | 'mobil' | 'all';
  cost: number;
  trunkBonus: number;
}

export const vehiclesConfig = vehiclesJson as unknown as {
  maxOwnedVehiclesPerPlayer: number;
  platePrefix: string;
  stnkPeriodMs: number;
  stnkGracePeriodMs: number;
  stnkLatePenaltyRate: number;
  stnkAdminFee: number;
  transferTitleFeeRate: number;
  roadsideImpoundAfterMs: number;
  roadsideTheftRiskPerHour: number;
  impoundRecoveryBaseFee: number;
  impoundDailyStorageFee: number;
  fuelPrices: { bensinPerUnit: number; electricPerPercent: number };
  licenseSettings: {
    simC: { label: string; fee: number; passScore: number; validMs: number; fineWithoutSim: number };
    simA: { label: string; fee: number; passScore: number; validMs: number; fineWithoutSim: number };
  };
  maintenanceSettings: {
    oilChangeCostBase: number;
    oilIntervalKm: number;
    repairPerConditionPoint: number;
    repaintCost: number;
    accessoryBaseCost: number;
    playerWorkshopMarginRate: number;
  };
  depreciation: {
    perGameDayRate: number;
    minValueRatio: number;
    odometerFactorPer100Km: number;
    conditionMinFactor: number;
  };
  accessories: VehicleAccessoryCfg[];
  models: VehicleModelCfg[];
};

export const trafficConfig = trafficJson as unknown as {
  enabled: boolean;
  speedLimitsMps: Record<string, number>;
  speedingToleranceMps: number;
  trafficOffenseFines: Record<string, number>;
};

export const dealerConfig = dealerJson as unknown as {
  leasing: {
    minCreditScore: number;
    minCompletedShifts: number;
    maxActiveLeases: number;
    maxWantedLevelAllowed: number;
    minDownPaymentRate: number;
    maxDownPaymentRate: number;
    cycleMs: number;
    gracePeriodMs: number;
    lateFeeRate: number;
    maxMissedBeforeRepossess: number;
    tenors: Array<{ termCycles: number; label: string; interestRatePerTerm: number }>;
  };
  tradeIn: {
    valuationRatio: number;
    minConditionAccepted: number;
    maxOdometerKmAccepted: number;
  };
  testDrive: {
    durationSec: number;
    maxRadiusMeters: number;
    fee: number;
    cooldownSec: number;
  };
  marketplace: {
    listingFee: number;
    escrowFeeRate: number;
    titleTransferTaxRate: number;
    minPriceRatio: number;
    maxPriceRatio: number;
  };
  dealers: Array<{
    id: string;
    name: string;
    kind: string;
    isUsed: boolean;
    category: VehicleCategory;
    lotId: string;
    modelIds: string[];
  }>;
};

let vehicleConfigsSeeded = false;

export async function ensureVehicleConfigs(): Promise<void> {
  if (vehicleConfigsSeeded) return;
  vehicleConfigsSeeded = true;
}

export function getVehicleModel(modelId: string): VehicleModelCfg | null {
  return vehiclesConfig.models.find((m) => m.id === modelId) ?? null;
}

export function getDealerCfg(dealerId: string) {
  return dealerConfig.dealers.find((d) => d.id === dealerId) ?? null;
}

export function getAccessoryCfg(accId: string): VehicleAccessoryCfg | null {
  return vehiclesConfig.accessories.find((a) => a.id === accId) ?? null;
}

export function normalizePlateKey(plateNumber: string): string {
  return plateNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

const PLATE_SUFFIX_CODES = [
  'CL', 'CG', 'BD', 'PR', 'SJ', 'CK', 'RJ', 'NG', 'SM', 'TJ',
  'AB', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AK', 'AL', 'AM',
  'BA', 'BB', 'BC', 'BE', 'BF', 'BG', 'BH', 'BJ', 'BK', 'BL',
];

export async function allocateUniquePlateTx(
  tx: Transaction,
  firestore: Firestore,
  ownerId: string,
  vehicleId: string,
  nowMs: number
): Promise<{ plateNumber: string; plateKey: string }> {
  const prefix = vehiclesConfig.platePrefix || 'D';
  for (let attempt = 0; attempt < 16; attempt++) {
    const digits = 1000 + Math.floor(Math.random() * 8999);
    const suffix = PLATE_SUFFIX_CODES[Math.floor(Math.random() * PLATE_SUFFIX_CODES.length)];
    const plateNumber = `${prefix} ${digits} ${suffix}`;
    const plateKey = normalizePlateKey(plateNumber);
    const lockRef = firestore.collection('vehicle_plates').doc(plateKey);
    const lockDoc = await tx.get(lockRef);
    if (!lockDoc.exists) {
      tx.set(lockRef, {
        plateKey,
        plateNumber,
        vehicleId,
        ownerId,
        createdAtMs: nowMs,
      });
      return { plateNumber, plateKey };
    }
  }
  // Fallback deterministik yang tetap unik per timestamp
  const tail = String(nowMs).slice(-4);
  const plateNumber = `${prefix} ${tail} CL`;
  const plateKey = normalizePlateKey(plateNumber);
  tx.set(firestore.collection('vehicle_plates').doc(plateKey), {
    plateKey,
    plateNumber,
    vehicleId,
    ownerId,
    createdAtMs: nowMs,
  });
  return { plateNumber, plateKey };
}

export function computeLazyMarketValue(
  model: VehicleModelCfg,
  vehicle: { condition: number; odometerKm: number; createdAtMs: number },
  nowMs: number
): number {
  if (!model || model.newPrice <= 0) return 0;
  const ageGameDays = Math.max(0, (nowMs - (vehicle.createdAtMs || nowMs)) / Math.max(60_000, GAME_DAY_DURATION_MS));
  const ageFactor = Math.max(
    vehiclesConfig.depreciation.minValueRatio,
    1 - ageGameDays * vehiclesConfig.depreciation.perGameDayRate
  );
  const odoFactor = Math.max(
    0.55,
    1 - (Math.max(0, vehicle.odometerKm || 0) / 100) * vehiclesConfig.depreciation.odometerFactorPer100Km
  );
  const condRatio = Math.max(0, Math.min(100, vehicle.condition)) / 100;
  const condFactor =
    vehiclesConfig.depreciation.conditionMinFactor +
    (1 - vehiclesConfig.depreciation.conditionMinFactor) * condRatio;

  const raw = model.newPrice * ageFactor * odoFactor * condFactor;
  return Math.max(Math.round(model.newPrice * 0.2), Math.round(raw / 500) * 500);
}

export function computeLazyStnkStatus(
  model: VehicleModelCfg,
  stnkExpiresAtMs: number,
  nowMs: number
) {
  const baseTax = model.annualTax;
  if (nowMs <= stnkExpiresAtMs) {
    return {
      isExpired: false,
      inGracePeriod: false,
      overduePeriods: 0,
      baseTax,
      latePenalty: 0,
      totalDue: baseTax + vehiclesConfig.stnkAdminFee,
    };
  }
  const overdueMs = nowMs - stnkExpiresAtMs;
  const inGracePeriod = overdueMs <= vehiclesConfig.stnkGracePeriodMs;
  const overduePeriods = Math.max(1, Math.ceil(overdueMs / Math.max(60_000, vehiclesConfig.stnkPeriodMs)));
  const latePenalty = inGracePeriod
    ? 0
    : Math.round(baseTax * vehiclesConfig.stnkLatePenaltyRate * overduePeriods);
  return {
    isExpired: true,
    inGracePeriod,
    overduePeriods,
    baseTax: baseTax * overduePeriods,
    latePenalty,
    totalDue: baseTax * overduePeriods + latePenalty + vehiclesConfig.stnkAdminFee,
  };
}

export function computeLazyLeaseQuote(
  price: number,
  downPaymentRate: number,
  termCycles: number
) {
  const cleanPrice = Math.max(0, Math.round(price));
  if (cleanPrice <= 0) return null;
  const { minDownPaymentRate, maxDownPaymentRate, tenors } = dealerConfig.leasing;
  if (
    !Number.isFinite(downPaymentRate) ||
    downPaymentRate < minDownPaymentRate - 1e-6 ||
    downPaymentRate > maxDownPaymentRate + 1e-6
  ) {
    return null;
  }
  const tenor = tenors.find((t) => t.termCycles === termCycles);
  if (!tenor) return null;

  const normalizedRate = Math.max(
    minDownPaymentRate,
    Math.min(maxDownPaymentRate, Math.round(downPaymentRate * 100) / 100)
  );
  const downPayment = Math.round((cleanPrice * normalizedRate) / 500) * 500;
  const adminAndPlateFee = vehiclesConfig.stnkAdminFee;
  const upfrontTotal = downPayment + adminAndPlateFee;
  const principal = Math.max(0, cleanPrice - downPayment);
  const totalInterest = Math.round(principal * tenor.interestRatePerTerm);
  const totalRepayment = principal + totalInterest;
  const installment = Math.max(1000, Math.ceil(totalRepayment / tenor.termCycles));

  return {
    price: cleanPrice,
    downPaymentRate: normalizedRate,
    downPayment,
    adminAndPlateFee,
    upfrontTotal,
    principal,
    interestRatePerTerm: tenor.interestRatePerTerm,
    totalInterest,
    totalRepayment,
    termCycles: tenor.termCycles,
    installment,
  };
}

export function applyDrivingWearAndFuel(
  model: VehicleModelCfg,
  vehicle: { fuel: number; condition: number; odometerKm: number },
  distanceKm: number,
  terrainType: 'road' | 'offroad' = 'road',
  crashDamage = 0
) {
  const cleanKm = Math.max(0, Math.min(25, distanceKm));
  const cleanCrashDamage = Math.max(0, Math.min(35, Number.isFinite(crashDamage) ? crashDamage : 0));
  const terrainFuelFactor = terrainType === 'offroad' && model.subType !== 'trail' && model.subType !== 'suv' ? 1.25 : 1.0;
  const terrainWearFactor =
    terrainType === 'offroad'
      ? model.subType === 'trail' || model.subType === 'suv'
        ? 0.7
        : 1.85
      : 1.0;

  const fuelUsed = cleanKm * model.consumptionPerKm * terrainFuelFactor;
  const nextFuel = Math.max(0, Math.round((vehicle.fuel - fuelUsed) * 100) / 100);
  const wear = cleanKm * model.wearRatePerKm * terrainWearFactor + cleanCrashDamage;
  const nextCondition = Math.max(0, Math.round((vehicle.condition - wear) * 10) / 10);
  const nextOdometerKm = Math.round((vehicle.odometerKm + cleanKm) * 100) / 100;

  return { nextFuel, nextCondition, nextOdometerKm };
}

const SIM_ANSWER_KEY: Record<'C' | 'A', number[]> = {
  // Jawaban benar soal aturan lalu lintas Cicalengka (index opsi 0..2)
  C: [1, 0, 2, 1, 0],
  A: [2, 1, 0, 2, 1],
};

export function gradeSimExam(category: 'C' | 'A', answers: number[]): number {
  const key = SIM_ANSWER_KEY[category];
  if (!Array.isArray(answers) || answers.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < key.length; i++) {
    if (Number(answers[i]) === key[i]) correct += 1;
  }
  return Math.round((correct / key.length) * 100);
}

/**
 * Sinkronisasi lazy kendaraan milik pemain:
 * 1. Membuat tagihan cicilan leasing & STNK jika jatuh tempo
 * 2. Menarik kendaraan (repossession) jika menunggak >= maxMissedBeforeRepossess
 * 3. Mengecek derek Dishub / risiko curanmor jika parkir sembarangan di pinggir jalan > roadsideImpoundAfterMs
 * 4. Menandai test drive yang kadaluarsa
 */
export async function syncLazyVehicleState(
  firestore: Firestore,
  uid: string,
  nowMs: number
): Promise<{ vehicleBillsCreated: number; repossessedCount: number; impoundedCount: number }> {
  let vehicleBillsCreated = 0;
  let repossessedCount = 0;
  let impoundedCount = 0;

  const [leaseSnap, vehSnap, tdSnap] = await Promise.all([
    firestore.collection('vehicle_leases').where('borrowerId', '==', uid).where('status', '==', 'active').limit(5).get(),
    firestore.collection('vehicles').where('ownerId', '==', uid).limit(6).get(),
    firestore.collection('vehicle_test_drives').doc(uid).get(),
  ]);

  if (tdSnap.exists && tdSnap.data()?.status === 'active' && nowMs >= Number(tdSnap.data()?.expiresAtMs || 0)) {
    await tdSnap.ref.update({ status: 'expired' }).catch(() => {});
  }

  for (const leaseDoc of leaseSnap.docs) {
    const lease = leaseDoc.data();
    const nextDueAtMs = Number(lease.nextDueAtMs || nowMs);
    const paidCycles = Number(lease.paidCycles || 0);
    const cycleIdx = paidCycles + 1;
    const billId = `vlease_${leaseDoc.id}_c${cycleIdx}`;
    const billRef = firestore.collection('characters').doc(uid).collection('bills').doc(billId);

    await firestore.runTransaction(async (tx) => {
      const charRef = firestore.collection('characters').doc(uid);
      const accRef = firestore.collection('accounts').doc(uid);
      const vehRef = firestore.collection('vehicles').doc(String(lease.vehicleId));
      const [freshLease, freshChar, freshAcc, freshBill, freshVeh] = await Promise.all([
        tx.get(leaseDoc.ref),
        tx.get(charRef),
        tx.get(accRef),
        tx.get(billRef),
        tx.get(vehRef),
      ]);

      if (!freshLease.exists || !freshChar.exists) return;
      const ld = freshLease.data()!;
      if (ld.status !== 'active') return;
      const remaining = Number(ld.remaining || 0);
      if (remaining <= 0) {
        tx.update(leaseDoc.ref, { status: 'paid', remaining: 0, updatedAtMs: nowMs });
        return;
      }

      const dueAmount = Math.min(remaining, Number(ld.installment || remaining));
      if (!freshBill.exists && nowMs >= nextDueAtMs - GAME_DAY_DURATION_MS) {
        tx.set(billRef, {
          id: billId,
          uid,
          billType: 'vehicle_lease_installment',
          title: `Cicilan Leasing ${String(ld.vehicleName || ld.modelId)} (#${cycleIdx})`,
          periodIndex: cycleIdx,
          baseAmount: dueAmount,
          lateFee: 0,
          status: 'unpaid',
          vehicleId: String(ld.vehicleId),
          vehicleLeaseId: leaseDoc.id,
          dueAtMs: nextDueAtMs,
        });
        vehicleBillsCreated += 1;
      }

      const graceEnd = nextDueAtMs + dealerConfig.leasing.gracePeriodMs;
      const lastPenaltyCycle = Number(ld.lastPenaltyCycle || 0);
      if (nowMs > graceEnd && lastPenaltyCycle < cycleIdx) {
        const nextMissed = Number(ld.missedCount || 0) + 1;
        const curScore = Number(
          freshAcc.exists ? freshAcc.data()!.creditScore : freshChar.data()!.creditScore ?? 70
        );
        const nextScore = clampCreditScore(curScore - 5);
        tx.update(charRef, { creditScore: nextScore, updatedAt: Timestamp.fromMillis(nowMs) });
        if (freshAcc.exists) tx.update(accRef, { creditScore: nextScore, updatedAtMs: nowMs });

        if (nextMissed >= dealerConfig.leasing.maxMissedBeforeRepossess) {
          tx.update(leaseDoc.ref, {
            missedCount: nextMissed,
            lastPenaltyCycle: cycleIdx,
            status: 'repossessed',
            updatedAtMs: nowMs,
          });
          if (freshVeh.exists) {
            tx.update(vehRef, {
              ownerId: 'bank:repossessed',
              driverId: null,
              isPublicActive: false,
              status: 'impounded',
              parkedType: 'impound',
              impoundReason: 'Penarikan leasing karena menunggak cicilan',
              impoundedAtMs: nowMs,
              updatedAtMs: nowMs,
            });
          }
          const curOwned = Number(freshChar.data()!.ownedVehicleCount || 0);
          tx.update(charRef, {
            ownedVehicleCount: Math.max(0, curOwned - 1),
            ...(freshChar.data()!.drivingVehicleId === String(ld.vehicleId) ? { drivingVehicleId: null } : {}),
          });
          appendTransaction(tx, firestore, uid, {
            type: 'penalty',
            category: 'penarikan_leasing',
            amount: remaining,
            balanceAfter: Number(freshChar.data()!.money || 0),
            description: `Kendaraan ${String(ld.vehicleName)} ditarik leasing akibat menunggak`,
            nowMs,
          });
          appendLedger(tx, firestore, {
            from: uid,
            to: 'system:bank',
            amount: remaining,
            reason: 'vehicle_lease_repossessed',
            refId: leaseDoc.id,
            nowMs,
          });
          repossessedCount += 1;
        } else {
          tx.update(leaseDoc.ref, {
            missedCount: nextMissed,
            lastPenaltyCycle: cycleIdx,
            updatedAtMs: nowMs,
          });
        }
      }
    });
  }

  // Cek STNK jatuh tempo & parkir pinggir jalan terlalu lama
  for (const vDoc of vehSnap.docs) {
    const v = vDoc.data();
    const model = getVehicleModel(String(v.modelId));
    if (!model) continue;

    // 1. Lazy STNK bill
    const stnkExp = Number(v.stnkExpiresAtMs || nowMs);
    if (nowMs >= stnkExp) {
      const periodTag = Math.floor(nowMs / Math.max(60_000, vehiclesConfig.stnkPeriodMs));
      const taxBillId = `stnk_${vDoc.id}_p${periodTag}`;
      const taxBillRef = firestore.collection('characters').doc(uid).collection('bills').doc(taxBillId);
      const existingTax = await taxBillRef.get();
      if (!existingTax.exists) {
        const stnkInfo = computeLazyStnkStatus(model, stnkExp, nowMs);
        await taxBillRef.set({
          id: taxBillId,
          uid,
          billType: 'vehicle_tax',
          title: `Pajak STNK ${String(v.name || model.name)} (${String(v.plateNumber)})`,
          periodIndex: periodTag,
          baseAmount: stnkInfo.baseTax + vehiclesConfig.stnkAdminFee,
          lateFee: stnkInfo.latePenalty,
          status: 'unpaid',
          vehicleId: vDoc.id,
          dueAtMs: stnkExp + vehiclesConfig.stnkGracePeriodMs,
        });
        vehicleBillsCreated += 1;
      }
    }

    // 2. Lazy roadside tow/impound atau curanmor jika ditinggal di pinggir jalan terlalu lama
    if (v.status === 'parked' && v.parkedType === 'roadside') {
      const parkedSince = Number(v.updatedAtMs || nowMs);
      const idleMs = nowMs - parkedSince;
      const lastWearCheck = Number(v.lastWearAtMs || parkedSince);
      if (idleMs >= vehiclesConfig.roadsideImpoundAfterMs && nowMs - lastWearCheck >= vehiclesConfig.roadsideImpoundAfterMs) {
        const accessories = Array.isArray(v.accessories) ? (v.accessories as string[]) : [];
        const hasGpsAlarm = accessories.includes('alarm_gps');
        const roll = ((Math.floor(parkedSince / 1000) + vDoc.id.charCodeAt(0) * 31) % 100) / 100;
        const theftChance = hasGpsAlarm ? 0 : Math.min(0.25, (idleMs / 3_600_000) * vehiclesConfig.roadsideTheftRiskPerHour);

        if (roll < theftChance) {
          await vDoc.ref.update({
            status: 'stolen',
            lastWearAtMs: nowMs,
            updatedAtMs: nowMs,
          });
        } else {
          await vDoc.ref.update({
            status: 'impounded',
            parkedType: 'impound',
            impoundReason: 'Parkir liar di pinggir jalan melebihi batas waktu',
            impoundedAtMs: nowMs,
            impoundFine: vehiclesConfig.impoundRecoveryBaseFee,
            lastWearAtMs: nowMs,
            updatedAtMs: nowMs,
          });
          impoundedCount += 1;
        }
      }
    }
  }

  return { vehicleBillsCreated, repossessedCount, impoundedCount };
}
