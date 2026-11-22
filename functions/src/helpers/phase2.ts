import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import bankConfig from '../config/bank.json';
import businessConfig from '../config/business.json';
import clinicConfig from '../config/clinic.json';
import coursesConfig from '../config/courses.json';
import economyConfig from '../config/economy.json';
import furnitureConfig from '../config/furniture.json';
import housingConfig from '../config/housing.json';
import jobsConfig from '../config/jobs.json';
import productsConfig from '../config/products.json';
import taxConfig from '../config/tax.json';
import trafficJson from '../config/traffic.json';
import trainScheduleConfig from '../config/trainSchedule.json';
import vehiclesJson from '../config/vehicles.json';
import { db } from './firebase';
import { DEFAULT_DECAY_RATES, type ComputedSurvivalStats } from './stats';

export {
  bankConfig,
  businessConfig,
  clinicConfig,
  coursesConfig,
  economyConfig,
  furnitureConfig,
  housingConfig,
  jobsConfig,
  productsConfig,
  taxConfig,
  trainScheduleConfig,
};

export type ZoneId = 'cicalengka' | 'rancaekek' | 'bandung' | 'nagreg';

export const DEFAULT_SKILLS = {
  komunikasi: 0,
  fisik: 0,
  hitung: 0,
  teknis: 0,
};

export const GAME_EPOCH_MS = 1_704_067_200_000;
export const GAME_DAY_DURATION_MS = 3_600_000;

export async function ensurePhase2Configs(): Promise<void> {
  const configs: Array<[string, Record<string, unknown>]> = [
    [
      'game',
      {
        dayDurationMs: GAME_DAY_DURATION_MS,
        epochMs: GAME_EPOCH_MS,
        hungerDecayPerHour: DEFAULT_DECAY_RATES.hungerDecayPerHour,
        thirstDecayPerHour: DEFAULT_DECAY_RATES.thirstDecayPerHour,
        energyDecayPerHour: DEFAULT_DECAY_RATES.energyDecayPerHour,
        startingMoney: 100_000,
      },
    ],
    ['jobs', jobsConfig as unknown as Record<string, unknown>],
    ['clinic', clinicConfig as unknown as Record<string, unknown>],
    ['courses', coursesConfig as unknown as Record<string, unknown>],
    ['trainSchedule', trainScheduleConfig as unknown as Record<string, unknown>],
    ['economy', economyConfig as unknown as Record<string, unknown>],
    ['housing', housingConfig as unknown as Record<string, unknown>],
    ['furniture', furnitureConfig as unknown as Record<string, unknown>],
    ['bank', bankConfig as unknown as Record<string, unknown>],
    ['business', businessConfig as unknown as Record<string, unknown>],
    ['products', productsConfig as unknown as Record<string, unknown>],
    ['tax', taxConfig as unknown as Record<string, unknown>],
  ];

  for (const [id, payload] of configs) {
    const ref = db.collection('config').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(payload);
    }
  }
}

export function appendTransaction(
  tx: Transaction,
  firestore: Firestore,
  uid: string,
  entry: {
    type: 'income' | 'expense' | 'penalty';
    category: string;
    amount: number;
    balanceAfter: number;
    description: string;
    nowMs: number;
  }
) {
  const txId = `tx_${entry.nowMs}_${Math.random().toString(36).slice(2, 7)}`;
  const ref = firestore.collection('characters').doc(uid).collection('transactions').doc(txId);
  tx.set(ref, {
    uid,
    type: entry.type,
    category: entry.category,
    amount: entry.amount,
    balanceAfter: entry.balanceAfter,
    description: entry.description.slice(0, 160),
    createdAtMs: entry.nowMs,
  });
}

export function applyFaintingOutcome(
  tx: Transaction,
  firestore: Firestore,
  uid: string,
  stats: ComputedSurvivalStats,
  currentMoney: number,
  currentFaintedCount: number,
  nowMs: number,
  homeRespawnPos?: { x: number; y: number; z: number; rotY?: number } | null
) {
  if (!stats.didFaint) {
    return {
      fainted: false,
      money: currentMoney,
      stats,
    };
  }

  const penalty = clinicConfig.faintPenalty;
  const fee = Math.min(currentMoney, penalty.maxFee);
  const nextMoney = currentMoney - fee;

  if (fee > 0) {
    appendTransaction(tx, firestore, uid, {
      type: 'penalty',
      category: 'pingsan',
      amount: fee,
      balanceAfter: nextMoney,
      description: 'Biaya evakuasi & perawatan darurat Puskesmas Cicalengka',
      nowMs,
    });
  }

  const revivedStats: ComputedSurvivalStats = {
    hunger: penalty.reviveHunger,
    thirst: penalty.reviveThirst,
    energy: penalty.reviveEnergy,
    health: penalty.reviveHealth,
    hygiene: Math.max(20, stats.hygiene),
    mood: Math.max(25, stats.mood),
    isCritical: false,
    didFaint: false,
  };

  const respawnPos = homeRespawnPos
    ? {
        x: Number(homeRespawnPos.x),
        y: Number(homeRespawnPos.y || 1),
        z: Number(homeRespawnPos.z),
        rotY: Number(homeRespawnPos.rotY || 0),
      }
    : penalty.hospitalPos;

  tx.update(firestore.collection('characters').doc(uid), {
    money: nextMoney,
    health: revivedStats.health,
    hygiene: revivedStats.hygiene,
    mood: revivedStats.mood,
    currentZone: 'cicalengka',
    lastPosition: respawnPos,
    activeShift: null,
    activeSleep: null,
    faintedCount: currentFaintedCount + 1,
    statsUpdatedAt: Timestamp.fromMillis(nowMs),
    updatedAt: Timestamp.fromMillis(nowMs),
  });

  return {
    fainted: true,
    money: nextMoney,
    stats: revivedStats,
  };
}

export function getDeterministicTrainState(nowMs: number) {
  const cycleMs = trainScheduleConfig.cycleRealMs;
  const elapsed = Math.max(0, nowMs - GAME_EPOCH_MS);
  const phaseMs = elapsed % cycleMs;

  const boardingOpen =
    phaseMs >= trainScheduleConfig.arriveEndMs && phaseMs <= trainScheduleConfig.boardingEndMs;

  let nextBoardingInSec = 0;
  if (phaseMs < trainScheduleConfig.arriveEndMs) {
    nextBoardingInSec = Math.ceil((trainScheduleConfig.arriveEndMs - phaseMs) / 1000);
  } else if (phaseMs > trainScheduleConfig.boardingEndMs) {
    nextBoardingInSec = Math.ceil((cycleMs - phaseMs + trainScheduleConfig.arriveEndMs) / 1000);
  }

  return {
    boardingOpen,
    phaseMs,
    nextBoardingInSec,
    boardingRemainingSec: boardingOpen
      ? Math.max(0, Math.ceil((trainScheduleConfig.boardingEndMs - phaseMs) / 1000))
      : 0,
  };
}

export function computeRankForJob(jobId: string, totalWorkSec: number) {
  const job = jobsConfig.jobs.find((j) => j.id === jobId);
  if (!job) return { title: 'Pekerja', rankIndex: 0, payMultiplier: 1 };

  let rankIndex = 0;
  for (let i = 0; i < job.ranks.length; i++) {
    if (totalWorkSec >= job.ranks[i].minTotalWorkSec) {
      rankIndex = i;
    }
  }
  const rank = job.ranks[rankIndex];
  return {
    title: rank.title,
    rankIndex,
    payMultiplier: rank.payMultiplier,
  };
}

const GURU_QUESTIONS = [
  { q: 'Ibu kota Kabupaten Bandung adalah...', options: ['Soreang', 'Cimahi', 'Garut'], ans: 0 },
  { q: 'Kecamatan Cicalengka berada di ketinggian sekitar...', options: ['689 mdpl', '50 mdpl', '2500 mdpl'], ans: 0 },
  { q: 'Hasil dari 14 x 5 - 12 adalah...', options: ['58', '62', '48'], ans: 0 },
  { q: 'Kata "Nuhun" dalam Bahasa Sunda berarti...', options: ['Permisi', 'Terima kasih', 'Selamat pagi'], ans: 1 },
  { q: 'Hasil dari 120 : 4 + 15 adalah...', options: ['45', '35', '50'], ans: 0 },
  { q: 'Stasiun kereta setelah Cicalengka ke arah Bandung adalah...', options: ['Haurpugur', 'Garut', 'Tasikmalaya'], ans: 0 },
];

const KURIR_TARGETS = [
  { id: 'alun', label: 'Pendopo Alun-Alun', x: -6, z: 5.5 },
  { id: 'warung', label: 'Warung Teh Neng', x: -30, z: -17 },
  { id: 'kontrakan', label: 'Kontrakan 3 Selatan', x: -8, z: 45 },
  { id: 'pasar', label: 'Gerbang Pasar Cicalengka', x: 46, z: -4 },
  { id: 'puskesmas', label: 'Halaman Puskesmas', x: -48, z: -16 },
];

const OJEK_ORDER_PAIRS = [
  {
    pickup: { id: 'ojek_pick_stasiun', label: 'Jemput Penumpang: Stasiun', x: 4, z: -40 },
    dropoff: { id: 'ojek_drop_pasar', label: 'Antar ke Pasar Sehat', x: 44, z: -10 },
  },
  {
    pickup: { id: 'ojek_pick_alun', label: 'Jemput Penumpang: Alun-Alun', x: 0, z: -10 },
    dropoff: { id: 'ojek_drop_sekolah', label: 'Antar ke Balai Kursus', x: -48, z: 43 },
  },
  {
    pickup: { id: 'ojek_pick_bank', label: 'Jemput Penumpang: Bank Priangan', x: -44, z: -4 },
    dropoff: { id: 'ojek_drop_kontrakan', label: 'Antar ke Kontrakan Selatan', x: -8, z: 45 },
  },
  {
    pickup: { id: 'ojek_pick_warung', label: 'Jemput CikFood: Warung Teh Neng', x: -30, z: -17 },
    dropoff: { id: 'ojek_drop_puskesmas', label: 'Antar ke Puskesmas', x: -48, z: -16 },
  },
];

const LOGISTIK_DELIVERY_SPOTS = [
  { id: 'log_minimarket', label: 'Bongkar Muatan: Minimarket Cicalengka', x: 30, z: -16 },
  { id: 'log_warung', label: 'Bongkar Muatan: Warung Teh Neng', x: -30, z: -16 },
  { id: 'log_pasar', label: 'Bongkar Muatan: Pasar Sehat', x: 44, z: -10 },
  { id: 'log_mebel', label: 'Bongkar Muatan: Toko Mebel Jaya', x: -6, z: -16 },
  { id: 'log_balai', label: 'Bongkar Muatan: Balai Lelang Kota', x: 6, z: -16 },
];

export interface VehicleJobEligibilityResult {
  requiresVehicle: boolean;
  requiredSim: 'A' | 'C' | null;
  hasValidSim: boolean;
  qualifyingVehicles: Array<Record<string, unknown>>;
  operationalVehicles: Array<Record<string, unknown>>;
  activeDrivenMatch: Record<string, unknown> | null;
  preferredVehicle: Record<string, unknown> | null;
  bonusRate: number;
  bonusLabel: string | null;
  errorReason: string | null;
}

export function evaluateVehicleForJobServer(
  jobId: string,
  vehicles: Array<Record<string, unknown>>,
  drivingVehicleId: string | null | undefined,
  charData: Record<string, unknown>,
  nowMs: number
): VehicleJobEligibilityResult {
  const job = jobsConfig.jobs.find((j) => j.id === jobId) as
    | (typeof jobsConfig.jobs)[number] & {
        vehicleReq?: {
          requiredSim: 'A' | 'C';
          categories: string[];
          allowedModelIds?: string[];
          preferredModelIds?: string[];
          preferredAccessories?: string[];
        };
      }
    | undefined;

  const vReq = job?.vehicleReq;
  const simCActive = Boolean(
    (charData.simC as { active?: boolean; expiresAtMs?: number } | undefined)?.active &&
      (!(charData.simC as { expiresAtMs?: number }).expiresAtMs ||
        Number((charData.simC as { expiresAtMs?: number }).expiresAtMs) > nowMs)
  );
  const simAActive = Boolean(
    (charData.simA as { active?: boolean; expiresAtMs?: number } | undefined)?.active &&
      (!(charData.simA as { expiresAtMs?: number }).expiresAtMs ||
        Number((charData.simA as { expiresAtMs?: number }).expiresAtMs) > nowMs)
  );

  const models = vehiclesJson.models as Array<{
    id: string;
    category: string;
    trunkCapacity: number;
  }>;
  const accessories = vehiclesJson.accessories as Array<{ id: string; trunkBonus?: number }>;

  const usable = vehicles.filter((v) => v.status === 'parked' || v.status === 'driving');

  if (!vReq) {
    if (jobId === 'kurir') {
      const motors = usable.filter((v) => {
        const m = models.find((x) => x.id === v.modelId);
        return (m?.category || v.category) === 'motor' && Number(v.condition ?? 100) > 10 && Number(v.fuel ?? 0) > 0;
      });
      const drivenMotor = motors.find((v) => v.id === drivingVehicleId) || null;
      const picked =
        drivenMotor ||
        motors.find(
          (v) =>
            v.modelId === 'motor_ojek' ||
            (Array.isArray(v.accessories) && v.accessories.includes('box_kurir'))
        ) ||
        motors[0] ||
        null;
      let bonusRate = 0;
      let bonusLabel: string | null = null;
      if (picked) {
        const hasOjolOrBox =
          picked.modelId === 'motor_ojek' ||
          (Array.isArray(picked.accessories) && picked.accessories.includes('box_kurir'));
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
        preferredVehicle: picked,
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
    const m = models.find((x) => x.id === v.modelId);
    const cat = String(m?.category || v.category || '');
    if (!vReq.categories.includes(cat)) return false;
    if (vReq.allowedModelIds && vReq.allowedModelIds.length > 0) {
      if (!vReq.allowedModelIds.includes(String(v.modelId))) return false;
    }
    return true;
  });

  const operational = qualifying.filter(
    (v) => Number(v.condition ?? 100) > 15 && Number(v.fuel ?? 0) > 0
  );
  const activeDrivenMatch = operational.find((v) => v.id === drivingVehicleId) || null;

  let preferredVehicle: Record<string, unknown> | null = activeDrivenMatch;
  if (!preferredVehicle && operational.length > 0) {
    preferredVehicle =
      operational.find((v) => {
        if (vReq.preferredModelIds?.includes(String(v.modelId))) return true;
        if (
          vReq.preferredAccessories &&
          Array.isArray(v.accessories) &&
          v.accessories.some((a) => vReq.preferredAccessories!.includes(String(a)))
        ) {
          return true;
        }
        return false;
      }) || operational[0];
  }

  let bonusRate = 0;
  let bonusLabel: string | null = null;
  if (preferredVehicle) {
    if (jobId === 'ojek_online') {
      const hasBoxOrOjol =
        preferredVehicle.modelId === 'motor_ojek' ||
        (Array.isArray(preferredVehicle.accessories) &&
          preferredVehicle.accessories.includes('box_kurir'));
      if (hasBoxOrOjol) {
        bonusRate = 0.2;
        bonusLabel = 'Bonus Motor Ojol / Box +20%';
      }
    } else if (jobId === 'sopir_angkot') {
      if (Number(preferredVehicle.condition ?? 0) >= 75) {
        bonusRate = 0.15;
        bonusLabel = 'Bonus Angkot Prima +15%';
      }
    } else if (jobId === 'sopir_logistik') {
      const m = models.find((x) => x.id === preferredVehicle!.modelId);
      const baseTrunk = Number(m?.trunkCapacity || 60);
      const accBonus = (Array.isArray(preferredVehicle.accessories) ? preferredVehicle.accessories : []).reduce(
        (sum: number, accId) => {
          const acc = accessories.find((a) => a.id === accId);
          return sum + Number(acc?.trunkBonus || 0);
        },
        0
      );
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
    if (jobId === 'sopir_angkot') {
      errorReason = 'Butuh memiliki kendaraan Angkot (mobil_angkot) untuk melamar & bekerja di trayek ini.';
    } else if (jobId === 'sopir_logistik') {
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

export function generateServerMiniGameTask(
  jobId: string,
  vehicleOpts?: {
    assignedVehicleId?: string | null;
    assignedVehicleName?: string | null;
    bonusLabel?: string | null;
  }
): {
  prompt: Record<string, unknown>;
  secret: Record<string, unknown>;
} {
  if (jobId === 'kasir_minimarket') {
    const items = Array.from({ length: 3 }, (_, idx) => {
      const total = (Math.floor(Math.random() * 8) + 2) * 5000 + (Math.random() > 0.5 ? 2500 : 0);
      const paidOptions = [20000, 50000, 100000];
      const paid = paidOptions.find((p) => p >= total) ?? 100000;
      return { idx, total, paid, change: paid - total };
    });
    return {
      prompt: {
        type: 'kasir',
        title: 'Kasir Cicalengka Mart',
        instructions: 'Hitung uang kembalian pelanggan dengan tepat.',
        rounds: items.map(({ idx, total, paid }) => ({ id: idx, total, paid })),
      },
      secret: { answers: items.map((i) => i.change) },
    };
  }

  if (jobId === 'pedagang_pasar') {
    const goods = [
      { name: 'Beras Pandan Wangi', unit: 'kg', price: 14000 },
      { name: 'Bawang Merah', unit: 'kg', price: 32000 },
      { name: 'Telur Ayam', unit: 'kg', price: 28000 },
      { name: 'Tahu Sumedang', unit: 'bungkus', price: 6000 },
    ];
    const orders = Array.from({ length: 3 }, (_, idx) => {
      const g = goods[Math.floor(Math.random() * goods.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      return { idx, itemName: g.name, unit: g.unit, unitPrice: g.price, qty, total: g.price * qty };
    });
    return {
      prompt: {
        type: 'pedagang',
        title: 'Lapak Pasar Cicalengka',
        instructions: 'Hitung total harga pesanan pembeli NPC.',
        rounds: orders.map(({ idx, itemName, unit, unitPrice, qty }) => ({
          id: idx,
          itemName,
          unit,
          unitPrice,
          qty,
        })),
      },
      secret: { answers: orders.map((o) => o.total) },
    };
  }

  if (jobId === 'kurir') {
    const shuffled = [...KURIR_TARGETS].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, 2);
    return {
      prompt: {
        type: 'kurir',
        title: 'Antar Paket Cicalengka',
        instructions: 'Ikuti panah 3D menuju 2 titik penerima paket (boleh naik motor untuk bonus!).',
        targets,
        sequential: false,
        requiresVehicle: false,
        assignedVehicleId: vehicleOpts?.assignedVehicleId ?? null,
        assignedVehicleName: vehicleOpts?.assignedVehicleName ?? null,
        vehicleBonusLabel: vehicleOpts?.bonusLabel ?? null,
      },
      secret: { targets },
    };
  }

  if (jobId === 'ojek_online') {
    const pair = OJEK_ORDER_PAIRS[Math.floor(Math.random() * OJEK_ORDER_PAIRS.length)];
    const bonusPair = OJEK_ORDER_PAIRS.find((p) => p.pickup.id !== pair.pickup.id) || pair;
    const targets = [
      { ...pair.pickup, role: 'pickup' },
      { ...pair.dropoff, role: 'dropoff' },
      { ...bonusPair.dropoff, id: `ojek_order2_${bonusPair.dropoff.id}`, label: `Order #2: ${bonusPair.dropoff.label}`, role: 'dropoff' },
    ];
    return {
      prompt: {
        type: 'ojek_online',
        title: 'Order CikOjek Cicalengka',
        instructions: 'Kendarai motormu mengikuti panah 3D untuk jemput & antar penumpang.',
        targets,
        sequential: true,
        requiresVehicle: true,
        requiredCategories: ['motor'],
        assignedVehicleId: vehicleOpts?.assignedVehicleId ?? null,
        assignedVehicleName: vehicleOpts?.assignedVehicleName ?? null,
        vehicleBonusLabel: vehicleOpts?.bonusLabel ?? null,
      },
      secret: { targets },
    };
  }

  if (jobId === 'sopir_angkot') {
    const passengerDeltas = [
      { boarded: 3, alighted: 0 },
      { boarded: 2, alighted: 1 },
      { boarded: 3, alighted: 2 },
      { boarded: 1, alighted: 4 },
    ];
    const targets = trafficJson.halteSpots.map((h, idx) => ({
      id: h.id,
      label: h.label,
      x: h.x,
      z: h.z,
      boarded: passengerDeltas[idx]?.boarded ?? 2,
      alighted: passengerDeltas[idx]?.alighted ?? 1,
    }));
    return {
      prompt: {
        type: 'sopir_angkot',
        title: 'Trayek Angkot Cicalengka',
        instructions: 'Kendarai Angkot melewati 4 halte resmi secara berurutan.',
        targets,
        sequential: true,
        requiresVehicle: true,
        requiredCategories: ['mobil'],
        allowedModelIds: ['mobil_angkot'],
        assignedVehicleId: vehicleOpts?.assignedVehicleId ?? null,
        assignedVehicleName: vehicleOpts?.assignedVehicleName ?? null,
        vehicleBonusLabel: vehicleOpts?.bonusLabel ?? null,
      },
      secret: { targets },
    };
  }

  if (jobId === 'sopir_logistik') {
    const drops = [...LOGISTIK_DELIVERY_SPOTS].sort(() => Math.random() - 0.5).slice(0, 2);
    const targets = [
      { id: 'log_muat_grosir', label: 'Muat Barang: Pasar Grosir Induk', x: 46, z: -15 },
      ...drops,
    ];
    return {
      prompt: {
        type: 'sopir_logistik',
        title: 'Ekspedisi Niaga Priangan',
        instructions: 'Kendarai Pickup/Truk Kecil dari Pasar Grosir ke 2 toko tujuan.',
        targets,
        sequential: true,
        requiresVehicle: true,
        requiredCategories: ['mobil'],
        allowedModelIds: ['mobil_pickup', 'mobil_truk_kecil'],
        assignedVehicleId: vehicleOpts?.assignedVehicleId ?? null,
        assignedVehicleName: vehicleOpts?.assignedVehicleName ?? null,
        vehicleBonusLabel: vehicleOpts?.bonusLabel ?? null,
      },
      secret: { targets },
    };
  }

  if (jobId === 'buruh_pabrik') {
    const requiredSteps = 10;
    return {
      prompt: {
        type: 'pabrik',
        title: 'Operasi Mesin Tekstil Rancaekek',
        instructions: 'Tekan tombol jahit saat jarum berada di zona hijau sebanyak 10 kali.',
        requiredSteps,
      },
      secret: { requiredSteps },
    };
  }

  // guru_honorer
  const picked = [...GURU_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    prompt: {
      type: 'guru',
      title: 'Kelas SDN Harapan Bandung',
      instructions: 'Jawab 3 pertanyaan murid dengan benar.',
      questions: picked.map((p, idx) => ({ id: idx, q: p.q, options: p.options })),
    },
    secret: { answers: picked.map((p) => p.ans) },
  };
}

export function gradeServerMiniGameTask(
  jobId: string,
  secret: Record<string, unknown>,
  submission: Record<string, unknown>
): number {
  if (jobId === 'kasir_minimarket' || jobId === 'pedagang_pasar' || jobId === 'guru_honorer') {
    const expected = Array.isArray(secret.answers) ? (secret.answers as number[]) : [];
    const submitted = Array.isArray(submission.answers) ? (submission.answers as number[]) : [];
    if (expected.length === 0) return 60;
    let correct = 0;
    for (let i = 0; i < expected.length; i++) {
      if (Number(submitted[i]) === Number(expected[i])) correct += 1;
    }
    return Math.round((correct / expected.length) * 100);
  }

  if (
    jobId === 'kurir' ||
    jobId === 'ojek_online' ||
    jobId === 'sopir_angkot' ||
    jobId === 'sopir_logistik'
  ) {
    const expectedTargets = Array.isArray(secret.targets)
      ? (secret.targets as Array<{ id: string }>)
      : [];
    const visitedIds = Array.isArray(submission.visitedIds)
      ? new Set(submission.visitedIds.map(String))
      : new Set<string>();
    if (expectedTargets.length === 0) return 60;
    const hitCount = expectedTargets.filter((t) => visitedIds.has(t.id)).length;
    return Math.round((hitCount / expectedTargets.length) * 100);
  }

  if (jobId === 'buruh_pabrik') {
    const required = Number(secret.requiredSteps || 10);
    const hits = Math.max(0, Math.min(required, Number(submission.hits || 0)));
    return Math.round((hits / required) * 100);
  }

  return 70;
}
