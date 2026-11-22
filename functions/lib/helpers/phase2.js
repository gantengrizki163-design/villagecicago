"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_DAY_DURATION_MS = exports.GAME_EPOCH_MS = exports.DEFAULT_SKILLS = exports.trainScheduleConfig = exports.taxConfig = exports.productsConfig = exports.jobsConfig = exports.housingConfig = exports.furnitureConfig = exports.economyConfig = exports.coursesConfig = exports.clinicConfig = exports.businessConfig = exports.bankConfig = void 0;
exports.ensurePhase2Configs = ensurePhase2Configs;
exports.appendTransaction = appendTransaction;
exports.applyFaintingOutcome = applyFaintingOutcome;
exports.getDeterministicTrainState = getDeterministicTrainState;
exports.computeRankForJob = computeRankForJob;
exports.generateServerMiniGameTask = generateServerMiniGameTask;
exports.gradeServerMiniGameTask = gradeServerMiniGameTask;
const firestore_1 = require("firebase-admin/firestore");
const bank_json_1 = __importDefault(require("../config/bank.json"));
exports.bankConfig = bank_json_1.default;
const business_json_1 = __importDefault(require("../config/business.json"));
exports.businessConfig = business_json_1.default;
const clinic_json_1 = __importDefault(require("../config/clinic.json"));
exports.clinicConfig = clinic_json_1.default;
const courses_json_1 = __importDefault(require("../config/courses.json"));
exports.coursesConfig = courses_json_1.default;
const economy_json_1 = __importDefault(require("../config/economy.json"));
exports.economyConfig = economy_json_1.default;
const furniture_json_1 = __importDefault(require("../config/furniture.json"));
exports.furnitureConfig = furniture_json_1.default;
const housing_json_1 = __importDefault(require("../config/housing.json"));
exports.housingConfig = housing_json_1.default;
const jobs_json_1 = __importDefault(require("../config/jobs.json"));
exports.jobsConfig = jobs_json_1.default;
const products_json_1 = __importDefault(require("../config/products.json"));
exports.productsConfig = products_json_1.default;
const tax_json_1 = __importDefault(require("../config/tax.json"));
exports.taxConfig = tax_json_1.default;
const trainSchedule_json_1 = __importDefault(require("../config/trainSchedule.json"));
exports.trainScheduleConfig = trainSchedule_json_1.default;
const firebase_1 = require("./firebase");
const stats_1 = require("./stats");
exports.DEFAULT_SKILLS = {
    komunikasi: 0,
    fisik: 0,
    hitung: 0,
    teknis: 0,
};
exports.GAME_EPOCH_MS = 1_704_067_200_000;
exports.GAME_DAY_DURATION_MS = 3_600_000;
async function ensurePhase2Configs() {
    const configs = [
        [
            'game',
            {
                dayDurationMs: exports.GAME_DAY_DURATION_MS,
                epochMs: exports.GAME_EPOCH_MS,
                hungerDecayPerHour: stats_1.DEFAULT_DECAY_RATES.hungerDecayPerHour,
                thirstDecayPerHour: stats_1.DEFAULT_DECAY_RATES.thirstDecayPerHour,
                energyDecayPerHour: stats_1.DEFAULT_DECAY_RATES.energyDecayPerHour,
                startingMoney: 100_000,
            },
        ],
        ['jobs', jobs_json_1.default],
        ['clinic', clinic_json_1.default],
        ['courses', courses_json_1.default],
        ['trainSchedule', trainSchedule_json_1.default],
        ['economy', economy_json_1.default],
        ['housing', housing_json_1.default],
        ['furniture', furniture_json_1.default],
        ['bank', bank_json_1.default],
        ['business', business_json_1.default],
        ['products', products_json_1.default],
        ['tax', tax_json_1.default],
    ];
    for (const [id, payload] of configs) {
        const ref = firebase_1.db.collection('config').doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set(payload);
        }
    }
}
function appendTransaction(tx, firestore, uid, entry) {
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
function applyFaintingOutcome(tx, firestore, uid, stats, currentMoney, currentFaintedCount, nowMs, homeRespawnPos) {
    if (!stats.didFaint) {
        return {
            fainted: false,
            money: currentMoney,
            stats,
        };
    }
    const penalty = clinic_json_1.default.faintPenalty;
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
    const revivedStats = {
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
        statsUpdatedAt: firestore_1.Timestamp.fromMillis(nowMs),
        updatedAt: firestore_1.Timestamp.fromMillis(nowMs),
    });
    return {
        fainted: true,
        money: nextMoney,
        stats: revivedStats,
    };
}
function getDeterministicTrainState(nowMs) {
    const cycleMs = trainSchedule_json_1.default.cycleRealMs;
    const elapsed = Math.max(0, nowMs - exports.GAME_EPOCH_MS);
    const phaseMs = elapsed % cycleMs;
    const boardingOpen = phaseMs >= trainSchedule_json_1.default.arriveEndMs && phaseMs <= trainSchedule_json_1.default.boardingEndMs;
    let nextBoardingInSec = 0;
    if (phaseMs < trainSchedule_json_1.default.arriveEndMs) {
        nextBoardingInSec = Math.ceil((trainSchedule_json_1.default.arriveEndMs - phaseMs) / 1000);
    }
    else if (phaseMs > trainSchedule_json_1.default.boardingEndMs) {
        nextBoardingInSec = Math.ceil((cycleMs - phaseMs + trainSchedule_json_1.default.arriveEndMs) / 1000);
    }
    return {
        boardingOpen,
        phaseMs,
        nextBoardingInSec,
        boardingRemainingSec: boardingOpen
            ? Math.max(0, Math.ceil((trainSchedule_json_1.default.boardingEndMs - phaseMs) / 1000))
            : 0,
    };
}
function computeRankForJob(jobId, totalWorkSec) {
    const job = jobs_json_1.default.jobs.find((j) => j.id === jobId);
    if (!job)
        return { title: 'Pekerja', rankIndex: 0, payMultiplier: 1 };
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
function generateServerMiniGameTask(jobId) {
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
                instructions: 'Ikuti panah 3D menuju 2 titik penerima paket di peta sebelum selesai shift.',
                targets,
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
function gradeServerMiniGameTask(jobId, secret, submission) {
    if (jobId === 'kasir_minimarket' || jobId === 'pedagang_pasar' || jobId === 'guru_honorer') {
        const expected = Array.isArray(secret.answers) ? secret.answers : [];
        const submitted = Array.isArray(submission.answers) ? submission.answers : [];
        if (expected.length === 0)
            return 60;
        let correct = 0;
        for (let i = 0; i < expected.length; i++) {
            if (Number(submitted[i]) === Number(expected[i]))
                correct += 1;
        }
        return Math.round((correct / expected.length) * 100);
    }
    if (jobId === 'kurir') {
        const expectedTargets = Array.isArray(secret.targets)
            ? secret.targets
            : [];
        const visitedIds = Array.isArray(submission.visitedIds)
            ? new Set(submission.visitedIds.map(String))
            : new Set();
        if (expectedTargets.length === 0)
            return 60;
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
//# sourceMappingURL=phase2.js.map