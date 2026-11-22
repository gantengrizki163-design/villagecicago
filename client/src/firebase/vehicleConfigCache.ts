import { doc, getDoc } from 'firebase/firestore';
import dealerJson from '../../../functions/src/config/dealer.json';
import trafficJson from '../../../functions/src/config/traffic.json';
import vehiclesJson from '../../../functions/src/config/vehicles.json';
import type {
  DealerConfigDoc,
  TrafficConfigDoc,
  VehicleDoc,
  VehicleModelConfig,
  VehiclesConfigDoc,
} from '../types/game';
import { DEFAULT_GAME_CONFIG } from '../world3d/worldConstants';
import { db } from './config';

export interface VehicleBundleConfig {
  vehicles: VehiclesConfigDoc;
  traffic: TrafficConfigDoc;
  dealer: DealerConfigDoc;
}

const DEFAULT_VEHICLE_BUNDLE: VehicleBundleConfig = {
  vehicles: vehiclesJson as VehiclesConfigDoc,
  traffic: trafficJson as TrafficConfigDoc,
  dealer: dealerJson as DealerConfigDoc,
};

let cachedVehicleConfig: VehicleBundleConfig | null = null;
let loadVehiclePromise: Promise<VehicleBundleConfig> | null = null;

/**
 * Cache konfigurasi kendaraan (vehicles, traffic, dealer) per sesi browser
 * untuk menghemat Firestore read dan menjaga UI tetap akurat online/offline.
 */
export async function loadVehicleConfigCached(): Promise<VehicleBundleConfig> {
  if (cachedVehicleConfig) return cachedVehicleConfig;
  if (loadVehiclePromise) return loadVehiclePromise;

  loadVehiclePromise = (async () => {
    try {
      const [vehSnap, trafSnap, dealSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'vehicles')).catch(() => null),
        getDoc(doc(db, 'config', 'traffic')).catch(() => null),
        getDoc(doc(db, 'config', 'dealer')).catch(() => null),
      ]);

      cachedVehicleConfig = {
        vehicles:
          vehSnap?.exists() && Array.isArray(vehSnap.data()?.models)
            ? (vehSnap.data() as VehiclesConfigDoc)
            : DEFAULT_VEHICLE_BUNDLE.vehicles,
        traffic:
          trafSnap?.exists() && Array.isArray(trafSnap.data()?.trafficLights)
            ? (trafSnap.data() as TrafficConfigDoc)
            : DEFAULT_VEHICLE_BUNDLE.traffic,
        dealer:
          dealSnap?.exists() && Array.isArray(dealSnap.data()?.dealers)
            ? (dealSnap.data() as DealerConfigDoc)
            : DEFAULT_VEHICLE_BUNDLE.dealer,
      };
      return cachedVehicleConfig;
    } catch {
      cachedVehicleConfig = DEFAULT_VEHICLE_BUNDLE;
      return cachedVehicleConfig;
    } finally {
      loadVehiclePromise = null;
    }
  })();

  return loadVehiclePromise;
}

export function getDefaultVehicleConfig(): VehicleBundleConfig {
  return cachedVehicleConfig || DEFAULT_VEHICLE_BUNDLE;
}

export function getTrafficConfig(): TrafficConfigDoc {
  return getDefaultVehicleConfig().traffic;
}

export function getVehicleModelById(
  modelId: string,
  cfg: VehiclesConfigDoc = getDefaultVehicleConfig().vehicles
): VehicleModelConfig | null {
  return cfg.models.find((m) => m.id === modelId) ?? null;
}

/**
 * Estimasi nilai jual kendaraan (lazy depreciation dari umur game day, odometer, & kondisi).
 */
export function computeVehicleMarketValueClient(
  vehicle: Pick<VehicleDoc, 'modelId' | 'condition' | 'odometerKm' | 'createdAtMs'>,
  nowMs: number,
  cfg: VehiclesConfigDoc = getDefaultVehicleConfig().vehicles,
  dayDurationMs: number = DEFAULT_GAME_CONFIG.dayDurationMs
): number {
  const model = getVehicleModelById(vehicle.modelId, cfg);
  if (!model || model.newPrice <= 0) return 0;

  const ageGameDays = Math.max(0, (nowMs - (vehicle.createdAtMs || nowMs)) / Math.max(60_000, dayDurationMs));
  const ageFactor = Math.max(
    cfg.depreciation.minValueRatio,
    1 - ageGameDays * cfg.depreciation.perGameDayRate
  );
  const odoFactor = Math.max(
    0.55,
    1 - (Math.max(0, vehicle.odometerKm || 0) / 100) * cfg.depreciation.odometerFactorPer100Km
  );
  const condRatio = Math.max(0, Math.min(100, vehicle.condition)) / 100;
  const condFactor =
    cfg.depreciation.conditionMinFactor +
    (1 - cfg.depreciation.conditionMinFactor) * condRatio;

  const raw = model.newPrice * ageFactor * odoFactor * condFactor;
  return Math.max(Math.round(model.newPrice * 0.2), Math.round(raw / 500) * 500);
}

/**
 * Hitung kapasitas bagasi kendaraan terbaik milik pemain (+ bonus aksesori box_kurir/rak_atap)
 * untuk menentukan batas maksimal kulakan grosir dalam satu transaksi.
 */
export function computeBestVehicleCargoBonus(
  vehicles: Array<Pick<VehicleDoc, 'id' | 'modelId' | 'name' | 'status' | 'accessories'>>,
  cfg: VehiclesConfigDoc = getDefaultVehicleConfig().vehicles
): {
  bestVehicle: Pick<VehicleDoc, 'id' | 'modelId' | 'name' | 'status' | 'accessories'> | null;
  trunkCapacity: number;
  maxWholesaleQty: number;
} {
  let bestVehicle: Pick<VehicleDoc, 'id' | 'modelId' | 'name' | 'status' | 'accessories'> | null = null;
  let bestTrunk = 0;

  for (const v of vehicles) {
    if (v.status !== 'parked' && v.status !== 'driving') continue;
    const model = getVehicleModelById(v.modelId, cfg);
    if (!model) continue;
    const baseTrunk = Math.max(0, model.trunkCapacity || 0);
    const accBonus = (v.accessories || []).reduce((sum, accId) => {
      const acc = cfg.accessories.find((a) => a.id === accId);
      return sum + (acc?.trunkBonus || 0);
    }, 0);
    const totalTrunk = baseTrunk + accBonus;
    if (totalTrunk > bestTrunk) {
      bestTrunk = totalTrunk;
      bestVehicle = v;
    }
  }

  return {
    bestVehicle,
    trunkCapacity: bestTrunk,
    maxWholesaleQty: Math.min(200, 50 + bestTrunk),
  };
}

/**
 * Simulasi kuotasi kredit / leasing kendaraan di klien (sinkron dengan server).
 */
export interface ClientVehicleLeaseQuote {
  price: number;
  downPaymentRate: number;
  downPayment: number;
  adminAndPlateFee: number;
  upfrontTotal: number;
  principal: number;
  interestRatePerTerm: number;
  totalInterest: number;
  totalRepayment: number;
  termCycles: number;
  installment: number;
}

export function computeVehicleLeaseQuoteClient(
  price: number,
  downPaymentRate: number,
  termCycles: number,
  dealerCfg: DealerConfigDoc = getDefaultVehicleConfig().dealer,
  vehiclesCfg: VehiclesConfigDoc = getDefaultVehicleConfig().vehicles
): ClientVehicleLeaseQuote | null {
  const cleanPrice = Math.max(0, Math.round(price));
  if (cleanPrice <= 0) return null;
  const { minDownPaymentRate, maxDownPaymentRate, tenors } = dealerCfg.leasing;
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
  const adminAndPlateFee = vehiclesCfg.stnkAdminFee;
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

/**
 * Hitung status pajak STNK & denda keterlambatan secara lazy dari timestamp.
 */
export function computeLazyStnkStatusClient(
  vehicle: Pick<VehicleDoc, 'modelId' | 'stnkExpiresAtMs'>,
  nowMs: number,
  cfg: VehiclesConfigDoc = getDefaultVehicleConfig().vehicles
): {
  isExpired: boolean;
  inGracePeriod: boolean;
  overduePeriods: number;
  baseTax: number;
  latePenalty: number;
  totalDue: number;
} {
  const model = getVehicleModelById(vehicle.modelId, cfg);
  const baseTax = model?.annualTax ?? 15000;
  const expiresAt = Number(vehicle.stnkExpiresAtMs || nowMs);

  if (nowMs <= expiresAt) {
    return {
      isExpired: false,
      inGracePeriod: false,
      overduePeriods: 0,
      baseTax,
      latePenalty: 0,
      totalDue: baseTax + cfg.stnkAdminFee,
    };
  }

  const overdueMs = nowMs - expiresAt;
  const inGracePeriod = overdueMs <= cfg.stnkGracePeriodMs;
  const overduePeriods = Math.max(1, Math.ceil(overdueMs / Math.max(60_000, cfg.stnkPeriodMs)));
  const latePenalty = inGracePeriod
    ? 0
    : Math.round(baseTax * cfg.stnkLatePenaltyRate * overduePeriods);

  return {
    isExpired: true,
    inGracePeriod,
    overduePeriods,
    baseTax: baseTax * overduePeriods,
    latePenalty,
    totalDue: baseTax * overduePeriods + latePenalty + cfg.stnkAdminFee,
  };
}

export interface VehicleJobEligibilityClient {
  requiresVehicle: boolean;
  requiredSim: 'A' | 'C' | null;
  hasValidSim: boolean;
  qualifyingVehicles: VehicleDoc[];
  operationalVehicles: VehicleDoc[];
  activeDrivenMatch: VehicleDoc | null;
  preferredVehicle: VehicleDoc | null;
  bonusRate: number;
  bonusLabel: string | null;
  errorReason: string | null;
}

export function evaluateVehicleJobEligibilityClient(
  job: Pick<import('../types/game').JobConfigItem, 'id' | 'vehicleReq'>,
  vehicles: VehicleDoc[],
  character: Pick<import('../types/game').CharacterDoc, 'drivingVehicleId' | 'simA' | 'simC'>,
  nowMs: number,
  cfg: VehiclesConfigDoc = getDefaultVehicleConfig().vehicles
): VehicleJobEligibilityClient {
  const vReq = job.vehicleReq;
  const simCActive = Boolean(
    character.simC?.active && (!character.simC.expiresAtMs || character.simC.expiresAtMs > nowMs)
  );
  const simAActive = Boolean(
    character.simA?.active && (!character.simA.expiresAtMs || character.simA.expiresAtMs > nowMs)
  );
  const usable = vehicles.filter((v) => v.status === 'parked' || v.status === 'driving');
  const drivingId = character.drivingVehicleId || null;

  if (!vReq) {
    if (job.id === 'kurir') {
      const motors = usable.filter((v) => {
        const m = getVehicleModelById(v.modelId, cfg);
        return (m?.category || v.category) === 'motor' && (v.condition ?? 100) > 10 && (v.fuel ?? 0) > 0;
      });
      const drivenMotor = motors.find((v) => v.id === drivingId) || null;
      const preferredVehicle =
        drivenMotor ||
        motors.find((v) => v.modelId === 'motor_ojek' || (v.accessories || []).includes('box_kurir')) ||
        motors[0] ||
        null;
      let bonusRate = 0;
      let bonusLabel: string | null = null;
      if (preferredVehicle) {
        const hasOjolOrBox =
          preferredVehicle.modelId === 'motor_ojek' ||
          (preferredVehicle.accessories || []).includes('box_kurir');
        bonusRate = hasOjolOrBox ? 0.3 : 0.15;
        bonusLabel = hasOjolOrBox ? 'Bonus Motor Ojol / Box Kurir +30%' : 'Bonus Kurir Bermotor +15%';
      }
      return {
        requiresVehicle: false,
        requiredSim: null,
        hasValidSim: true,
        qualifyingVehicles: motors,
        operationalVehicles: motors,
        activeDrivenMatch: drivenMotor,
        preferredVehicle,
        bonusRate,
        bonusLabel,
        errorReason: null,
      };
    }
    return {
      requiresVehicle: false,
      requiredSim: null,
      hasValidSim: true,
      qualifyingVehicles: [],
      operationalVehicles: [],
      activeDrivenMatch: null,
      preferredVehicle: null,
      bonusRate: 0,
      bonusLabel: null,
      errorReason: null,
    };
  }

  const hasValidSim = vReq.requiredSim === 'A' ? simAActive : simCActive;
  const qualifying = usable.filter((v) => {
    const m = getVehicleModelById(v.modelId, cfg);
    const cat = (m?.category || v.category) as 'motor' | 'mobil';
    if (!vReq.categories.includes(cat)) return false;
    if (vReq.allowedModelIds && vReq.allowedModelIds.length > 0 && !vReq.allowedModelIds.includes(v.modelId)) {
      return false;
    }
    return true;
  });

  const operational = qualifying.filter((v) => (v.condition ?? 100) > 15 && (v.fuel ?? 0) > 0);
  const activeDrivenMatch = operational.find((v) => v.id === drivingId) || null;
  let preferredVehicle: VehicleDoc | null = activeDrivenMatch;
  if (!preferredVehicle && operational.length > 0) {
    preferredVehicle =
      operational.find((v) => {
        if (vReq.preferredModelIds?.includes(v.modelId)) return true;
        if (
          vReq.preferredAccessories &&
          (v.accessories || []).some((a) => vReq.preferredAccessories!.includes(a))
        ) {
          return true;
        }
        return false;
      }) || operational[0];
  }

  let bonusRate = 0;
  let bonusLabel: string | null = null;
  if (preferredVehicle) {
    if (job.id === 'ojek_online') {
      const hasBoxOrOjol =
        preferredVehicle.modelId === 'motor_ojek' ||
        (preferredVehicle.accessories || []).includes('box_kurir');
      if (hasBoxOrOjol) {
        bonusRate = 0.2;
        bonusLabel = 'Bonus Motor Ojol / Box +20%';
      }
    } else if (job.id === 'sopir_angkot') {
      if ((preferredVehicle.condition ?? 0) >= 75) {
        bonusRate = 0.15;
        bonusLabel = 'Bonus Angkot Prima +15%';
      }
    } else if (job.id === 'sopir_logistik') {
      const m = getVehicleModelById(preferredVehicle.modelId, cfg);
      const baseTrunk = m?.trunkCapacity || 60;
      const accBonus = (preferredVehicle.accessories || []).reduce((sum, accId) => {
        const acc = cfg.accessories.find((a) => a.id === accId);
        return sum + (acc?.trunkBonus || 0);
      }, 0);
      const totalTrunk = baseTrunk + accBonus;
      bonusRate = Math.min(0.35, Math.max(0, Math.round(((totalTrunk - 50) / 150) * 100) / 100));
      if (bonusRate > 0) {
        bonusLabel = `Bonus Muatan ${totalTrunk} unit (+${Math.round(bonusRate * 100)}%)`;
      }
    }
  }

  let errorReason: string | null = null;
  if (!hasValidSim) {
    errorReason = `Butuh SIM ${vReq.requiredSim} aktif untuk pekerjaan ini. Ikuti ujian di Samsat Cicalengka.`;
  } else if (qualifying.length === 0) {
    if (job.id === 'sopir_angkot') {
      errorReason = 'Butuh memiliki kendaraan Angkot (mobil_angkot) untuk melamar & bekerja di trayek ini.';
    } else if (job.id === 'sopir_logistik') {
      errorReason = 'Butuh memiliki Pickup atau Truk Kecil untuk bekerja sebagai Sopir Logistik.';
    } else {
      errorReason = 'Butuh memiliki sepeda motor operasional untuk menjadi pengemudi Ojek Online.';
    }
  } else if (operational.length === 0) {
    errorReason = 'Kendaraan kerjamu habis bensin/baterai atau kondisi di bawah 15%. Isi di SPBU / servis di Bengkel dulu.';
  }

  return {
    requiresVehicle: true,
    requiredSim: vReq.requiredSim,
    hasValidSim,
    qualifyingVehicles: qualifying,
    operationalVehicles: operational,
    activeDrivenMatch,
    preferredVehicle,
    bonusRate,
    bonusLabel,
    errorReason,
  };
}
