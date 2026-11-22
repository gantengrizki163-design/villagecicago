import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getGameDayKey, upsertDailyReportInTx } from '../helpers/business';
import { db, ENFORCE_APP_CHECK, FUNCTIONS_REGION, rtdb } from '../helpers/firebase';
import { appendLedger, applyTreasuryCredit } from '../helpers/ledger';
import { taxConfig } from '../helpers/market';
import {
  appendTransaction,
  applyFaintingOutcome,
  computeRankForJob,
  DEFAULT_SKILLS,
  economyConfig,
  evaluateVehicleForJobServer,
  generateServerMiniGameTask,
  gradeServerMiniGameTask,
  jobsConfig,
} from '../helpers/phase2';
import { assertNearLocation, buildDynamicPropertyTarget, type DynamicLocationTarget } from '../helpers/location';
import { calculateLazyStats, DEFAULT_DECAY_RATES } from '../helpers/stats';

const JOB_ID_TO_LOCATION_ID: Record<string, string> = {
  kasir_minimarket: 'minimarket',
  pedagang_pasar: 'pasar',
  kurir: 'pos_kurir',
  ojek_online: 'pangkalan_ojek',
  sopir_angkot: 'terminal_angkot',
  sopir_logistik: 'pasar_grosir',
  polisi: 'polsek',
  agen_properti: 'kantor_agen',
  buruh_pabrik: 'factory_rancaekek',
  guru_honorer: 'school_bandung',
};

/**
 * Cek pemecatan secara lazy berdasarkan jarak waktu sejak shift terakhir / diterima kerja.
 */
export function evaluateLazyDismissal(
  tx: Transaction,
  firestore: Firestore,
  uid: string,
  charData: FirebaseFirestore.DocumentData,
  nowMs: number
) {
  const currentJob = charData.currentJob;
  if (!currentJob) return { fired: false, missedShifts: 0 };

  const lastWorkMs = Number(currentJob.lastShiftAtMs || currentJob.hiredAtMs || nowMs);
  const elapsed = Math.max(0, nowMs - lastWorkMs);
  const missed = Math.floor(elapsed / economyConfig.expectedShiftIntervalMs);

  if (missed >= economyConfig.maxMissedShiftsBeforeFiring) {
    tx.update(firestore.collection('characters').doc(uid), {
      currentJob: null,
      activeShift: null,
      updatedAt: Timestamp.fromMillis(nowMs),
    });
    if (currentJob.employmentId) {
      tx.update(
        firestore.collection('characters').doc(uid).collection('employments').doc(String(currentJob.employmentId)),
        {
          status: 'fired',
          endedAtMs: nowMs,
          reason: `Bolos kerja ${missed} periode berturut-turut`,
        }
      );
    }
    return { fired: true, missedShifts: missed };
  }

  return { fired: false, missedShifts: missed };
}

export const applyJob = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const data = request.data as { jobId?: unknown };
    const jobId = typeof data?.jobId === 'string' ? data.jobId.trim() : '';

    const job = jobsConfig.jobs.find((j) => j.id === jobId);
    if (!job) {
      throw new HttpsError('invalid-argument', 'Lowongan pekerjaan tidak ditemukan.');
    }

    const charRef = db.collection('characters').doc(uid);
    const charPre = await charRef.get();
    if (!charPre.exists) {
      throw new HttpsError('not-found', 'Karakter belum dibuat.');
    }
    const charPreData = charPre.data()!;
    const currentZonePre = String(charPreData.currentZone || 'cicalengka');
    if (currentZonePre !== job.zone) {
      throw new HttpsError(
        'failed-precondition',
        `Lowongan ini berada di zona ${job.zone.toUpperCase()}. Naik kereta dari Stasiun dulu.`
      );
    }

    const mappedLocId = JOB_ID_TO_LOCATION_ID[jobId];
    const dynJobTargets: DynamicLocationTarget[] = mappedLocId
      ? []
      : [
          {
            id: jobId,
            label: job.location.label,
            zone: job.zone,
            x: job.location.x,
            z: job.location.z,
          },
        ];
    await assertNearLocation(
      rtdb,
      uid,
      charPreData,
      mappedLocId ? [mappedLocId] : [],
      0,
      dynJobTargets,
      `Datangi ${job.location.label} terlebih dahulu untuk melamar pekerjaan ini.`
    );

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const ownedVehPre = await db.collection('vehicles').where('ownerId', '==', uid).limit(6).get();

    const result = await db.runTransaction(async (tx) => {
      const charDoc = await tx.get(charRef);
      if (!charDoc.exists) {
        throw new HttpsError('not-found', 'Karakter belum dibuat.');
      }
      const vehDocs = await Promise.all(ownedVehPre.docs.map((d) => tx.get(d.ref)));
      const vehiclesList = vehDocs
        .filter((d) => d.exists)
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

      const charData = charDoc.data()!;
      const dismissal = evaluateLazyDismissal(tx, db, uid, charData, nowMs);
      const effectiveJob = dismissal.fired ? null : charData.currentJob;

      if (effectiveJob) {
        throw new HttpsError(
          'failed-precondition',
          `Kamu masih bekerja sebagai ${String(effectiveJob.title)}. Resign dulu jika ingin pindah.`
        );
      }

      const skills = { ...DEFAULT_SKILLS, ...(charData.skills || {}) } as Record<string, number>;
      const reqSkills = job.requiredSkills as Record<string, number>;
      for (const [key, minVal] of Object.entries(reqSkills)) {
        if ((skills[key] || 0) < minVal) {
          throw new HttpsError(
            'failed-precondition',
            `Skill ${key} minimal ${minVal} (saat ini ${skills[key] || 0}). Ikuti kursus dulu.`
          );
        }
      }

      const vehCheck = evaluateVehicleForJobServer(
        job.id,
        vehiclesList,
        charData.drivingVehicleId ? String(charData.drivingVehicleId) : null,
        charData,
        nowMs
      );
      if (vehCheck.requiresVehicle && vehCheck.errorReason) {
        throw new HttpsError('failed-precondition', vehCheck.errorReason);
      }

      const employmentId = `emp_${nowMs}`;
      const newJob = {
        employmentId,
        jobId: job.id,
        title: job.title,
        employer: job.employer,
        rankIndex: 0,
        rankTitle: job.ranks[0].title,
        totalWorkSeconds: 0,
        shiftsCompleted: 0,
        hiredAtMs: nowMs,
        lastShiftAtMs: nowMs,
      };

      tx.update(charRef, {
        currentJob: newJob,
        updatedAt: now,
      });

      tx.set(charRef.collection('employments').doc(employmentId), {
        uid,
        jobId: job.id,
        title: job.title,
        status: 'active',
        hiredAtMs: nowMs,
      });

      return { currentJob: newJob };
    });

    return { ok: true, ...result };
  }
);

export const resignJob = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const charRef = db.collection('characters').doc(uid);
    const nowMs = Date.now();

    await db.runTransaction(async (tx) => {
      const charDoc = await tx.get(charRef);
      if (!charDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }
      const charData = charDoc.data()!;
      if (!charData.currentJob) {
        throw new HttpsError('failed-precondition', 'Kamu sedang tidak terikat pekerjaan.');
      }
      if (charData.activeShift) {
        throw new HttpsError('failed-precondition', 'Selesaikan shift aktif terlebih dahulu.');
      }

      const empId = charData.currentJob.employmentId;
      const curJobId = String(charData.currentJob.jobId || '');
      if (curJobId.startsWith('biz_')) {
        const bizId = curJobId.slice(4);
        const bizEmpRef = db.collection('businesses').doc(bizId).collection('employees').doc(`emp_${uid}`);
        const bizEmpDoc = await tx.get(bizEmpRef);
        if (bizEmpDoc.exists) {
          tx.update(bizEmpRef, { status: 'resigned' });
        }
      }

      tx.update(charRef, {
        currentJob: null,
        updatedAt: Timestamp.fromMillis(nowMs),
      });
      if (empId) {
        const empRef = charRef.collection('employments').doc(String(empId));
        const empSnap = await tx.get(empRef);
        if (empSnap.exists) {
          tx.update(empRef, {
            status: 'resigned',
            endedAtMs: nowMs,
            reason: 'Mengundurkan diri',
          });
        }
      }
    });

    return { ok: true };
  }
);

export const startShift = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const configRef = db.collection('config').doc('game');

    const charPre = await charRef.get();
    if (!charPre.exists) {
      throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
    }
    const charPreData = charPre.data()!;
    const preJobId = String(charPreData.currentJob?.jobId || '');
    if (preJobId) {
      const preIsBiz = preJobId.startsWith('biz_');
      if (preIsBiz) {
        const preBizId = preJobId.slice(4);
        const bizPre = await db.collection('businesses').doc(preBizId).get();
        if (bizPre.exists) {
          const bDataPre = bizPre.data()!;
          const propIdPre = typeof bDataPre.propertyId === 'string' ? bDataPre.propertyId : '';
          const propPre = propIdPre ? await db.collection('properties').doc(propIdPre).get() : null;
          if ((charPreData.currentZone || 'cicalengka') !== 'cicalengka') {
            throw new HttpsError(
              'failed-precondition',
              'Pekerjaan ini berada di zona CICALENGKA. Naik kereta dari Stasiun dulu.'
            );
          }
          const bizTarget = buildDynamicPropertyTarget(
            preBizId,
            propPre?.exists ? propPre.data()! : bDataPre,
            String(bDataPre.name || 'Lokasi Bisnis')
          );
          await assertNearLocation(
            rtdb,
            uid,
            charPreData,
            [],
            0,
            [bizTarget],
            `Mendekatlah ke ${bizTarget.label}.`
          );
        }
      } else {
        const jobPre = jobsConfig.jobs.find((j) => j.id === preJobId);
        if (jobPre) {
          if ((charPreData.currentZone || 'cicalengka') !== jobPre.zone) {
            throw new HttpsError(
              'failed-precondition',
              `Pekerjaan ini berada di zona ${jobPre.zone.toUpperCase()}. Naik kereta dari Stasiun dulu.`
            );
          }
          const mappedLocId = JOB_ID_TO_LOCATION_ID[preJobId];
          await assertNearLocation(
            rtdb,
            uid,
            charPreData,
            mappedLocId ? [mappedLocId] : [],
            0,
            mappedLocId
              ? []
              : [
                  {
                    id: preJobId,
                    label: jobPre.location.label,
                    zone: jobPre.zone,
                    x: jobPre.location.x,
                    z: jobPre.location.z,
                  },
                ],
            `Mendekatlah ke ${jobPre.location.label}.`
          );
        }
      }
    }

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const ownedVehPre = await db.collection('vehicles').where('ownerId', '==', uid).limit(6).get();

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, statsDoc, configDoc, ...vehDocs] = await Promise.all([
        tx.get(charRef),
        tx.get(statsRef),
        tx.get(configRef),
        ...ownedVehPre.docs.map((d) => tx.get(d.ref)),
      ]);

      if (!charDoc.exists || !statsDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }
      const vehiclesList = vehDocs
        .filter((d) => d.exists)
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

      const charData = charDoc.data()!;
      const statsData = statsDoc.data()!;

      if (charData.activeTrip && nowMs < Number(charData.activeTrip.arrivesAtMs || 0)) {
        throw new HttpsError('failed-precondition', 'Sedang dalam perjalanan kereta.');
      }

      const dismissal = evaluateLazyDismissal(tx, db, uid, charData, nowMs);
      if (dismissal.fired) {
        return { fired: true, missedShifts: dismissal.missedShifts };
      }

      const currentJob = charData.currentJob;
      if (!currentJob) {
        throw new HttpsError('failed-precondition', 'Lamar pekerjaan terlebih dahulu.');
      }
      if (charData.activeShift) {
        throw new HttpsError('failed-precondition', 'Shift kerja sudah aktif.');
      }

      const currentJobId = String(currentJob.jobId || '');
      const isBizJob = currentJobId.startsWith('biz_');
      const bizId = isBizJob ? currentJobId.slice(4) : '';

      const job = !isBizJob ? jobsConfig.jobs.find((j) => j.id === currentJobId) : null;
      if (!isBizJob && !job) {
        throw new HttpsError('not-found', 'Data konfigurasi pekerjaan tidak valid.');
      }

      let targetZone = job?.zone ?? 'cicalengka';
      let requiredEnergy = job?.energyCost ?? 12;
      let minDurationSec = job?.minDurationSec ?? 20;
      let miniGameTaskType = currentJobId;

      if (isBizJob) {
        const [bizDoc, empDoc] = await Promise.all([
          tx.get(db.collection('businesses').doc(bizId)),
          tx.get(db.collection('businesses').doc(bizId).collection('employees').doc(`emp_${uid}`)),
        ]);
        if (!bizDoc.exists || bizDoc.data()!.status !== 'active') {
          throw new HttpsError('failed-precondition', 'Bisnis tempat bekerja sedang tidak aktif.');
        }
        if (!empDoc.exists || empDoc.data()!.status !== 'active') {
          throw new HttpsError('failed-precondition', 'Status karyawanmu sudah tidak aktif di bisnis ini.');
        }
        const bData = bizDoc.data()!;
        targetZone = 'cicalengka';
        miniGameTaskType = bData.type === 'bengkel' || bData.type === 'jasa' ? 'pedagang_pasar' : 'kasir_minimarket';
      }

      const currentZone = charData.currentZone || 'cicalengka';
      if (currentZone !== targetZone) {
        throw new HttpsError(
          'failed-precondition',
          `Pekerjaan ini berada di zona ${targetZone.toUpperCase()}. Naik kereta dari Stasiun dulu.`
        );
      }

      const rates = configDoc.exists
        ? {
            hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? DEFAULT_DECAY_RATES.hungerDecayPerHour),
            thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? DEFAULT_DECAY_RATES.thirstDecayPerHour),
            energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? DEFAULT_DECAY_RATES.energyDecayPerHour),
          }
        : DEFAULT_DECAY_RATES;

      const currentStats = calculateLazyStats(
        {
          hunger: Number(statsData.hunger),
          thirst: Number(statsData.thirst),
          energy: Number(statsData.energy),
          health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
          hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
          mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
          lastCalculatedAtMs: (statsData.lastCalculatedAt as Timestamp).toMillis(),
        },
        nowMs,
        rates
      );

      const faintCheck = applyFaintingOutcome(
        tx,
        db,
        uid,
        currentStats,
        Number(charData.money),
        Number(charData.faintedCount || 0),
        nowMs
      );
      if (faintCheck.fainted) {
        tx.update(statsRef, { ...faintCheck.stats, lastCalculatedAt: now });
        return { fainted: true };
      }

      if (currentStats.energy < requiredEnergy) {
        throw new HttpsError(
          'failed-precondition',
          `Energi tidak cukup (butuh ${requiredEnergy}%, tersisa ${Math.round(currentStats.energy)}%). Istirahat atau makan dulu.`
        );
      }

      const vehEligibility = !isBizJob
        ? evaluateVehicleForJobServer(
            currentJobId,
            vehiclesList,
            charData.drivingVehicleId ? String(charData.drivingVehicleId) : null,
            charData,
            nowMs
          )
        : null;
      if (vehEligibility?.requiresVehicle && vehEligibility.errorReason) {
        throw new HttpsError('failed-precondition', vehEligibility.errorReason);
      }

      const shiftId = `shift_${nowMs}`;
      const { prompt, secret } = generateServerMiniGameTask(miniGameTaskType, {
        assignedVehicleId: vehEligibility?.preferredVehicle ? String(vehEligibility.preferredVehicle.id) : null,
        assignedVehicleName: vehEligibility?.preferredVehicle
          ? String(vehEligibility.preferredVehicle.name || '')
          : null,
        bonusLabel: vehEligibility?.bonusLabel ?? null,
      });
      const minDurationMs = minDurationSec * 1000;

      const activeShift = {
        shiftId,
        jobId: currentJobId,
        miniGameType: miniGameTaskType,
        jobTitle: String(currentJob.title || job?.title || 'Staf Bisnis'),
        startedAtMs: nowMs,
        minDurationMs,
        taskPrompt: prompt,
      };

      tx.update(charRef, {
        activeShift,
        health: currentStats.health,
        hygiene: currentStats.hygiene,
        mood: currentStats.mood,
        statsUpdatedAt: now,
        updatedAt: now,
      });

      tx.update(statsRef, {
        hunger: currentStats.hunger,
        thirst: currentStats.thirst,
        energy: currentStats.energy,
        health: currentStats.health,
        hygiene: currentStats.hygiene,
        mood: currentStats.mood,
        lastCalculatedAt: now,
      });

      tx.set(charRef.collection('shifts').doc(shiftId), {
        uid,
        jobId: currentJobId,
        status: 'active',
        startedAtMs: nowMs,
      });

      // Simpan kunci jawaban di subkoleksi server-only
      tx.set(charRef.collection('shift_secrets').doc(shiftId), {
        uid,
        answers: secret,
      });

      return { fired: false, fainted: false, activeShift };
    });

    return { ok: true, ...result };
  }
);

export const endShift = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login diperlukan.');
    }

    const uid = request.auth.uid;
    const submission = (request.data || {}) as Record<string, unknown>;

    const charRef = db.collection('characters').doc(uid);
    const statsRef = db.collection('character_stats').doc(uid);
    const configRef = db.collection('config').doc('game');

    const nowMs = Date.now();
    const now = Timestamp.fromMillis(nowMs);
    const ownedVehPre = await db.collection('vehicles').where('ownerId', '==', uid).limit(6).get();

    const result = await db.runTransaction(async (tx) => {
      const [charDoc, statsDoc, configDoc, ...vehDocs] = await Promise.all([
        tx.get(charRef),
        tx.get(statsRef),
        tx.get(configRef),
        ...ownedVehPre.docs.map((d) => tx.get(d.ref)),
      ]);

      if (!charDoc.exists || !statsDoc.exists) {
        throw new HttpsError('not-found', 'Karakter tidak ditemukan.');
      }
      const vehiclesList = vehDocs
        .filter((d) => d.exists)
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

      const charData = charDoc.data()!;
      const statsData = statsDoc.data()!;
      const activeShift = charData.activeShift;
      if (!activeShift) {
        throw new HttpsError('failed-precondition', 'Tidak ada shift aktif.');
      }

      const shiftId = String(activeShift.shiftId);
      const shiftRef = charRef.collection('shifts').doc(shiftId);
      const secretRef = charRef.collection('shift_secrets').doc(shiftId);
      const [shiftDoc, secretDoc] = await Promise.all([tx.get(shiftRef), tx.get(secretRef)]);

      if (!shiftDoc.exists || shiftDoc.data()?.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Shift sudah selesai atau tidak valid.');
      }

      const startedAtMs = Number(activeShift.startedAtMs);
      const minDurationMs = Number(activeShift.minDurationMs || 20000);
      if (nowMs - startedAtMs < minDurationMs) {
        const waitSec = Math.ceil((minDurationMs - (nowMs - startedAtMs)) / 1000);
        throw new HttpsError('failed-precondition', `Durasi minimal shift belum tercapai, tunggu ${waitSec} detik lagi.`);
      }

      const activeJobId = String(activeShift.jobId || '');
      const isBizJob = activeJobId.startsWith('biz_');
      const bizId = isBizJob ? activeJobId.slice(4) : '';
      const job = !isBizJob ? jobsConfig.jobs.find((j) => j.id === activeJobId) : null;

      if (!isBizJob && !job) {
        throw new HttpsError('not-found', 'Konfigurasi pekerjaan tidak valid.');
      }

      const dayKey = getGameDayKey(nowMs);
      const treasuryRef = db.collection('state').doc('treasury');
      const bizRef = isBizJob ? db.collection('businesses').doc(bizId) : null;
      const bizEmpRef = bizRef ? bizRef.collection('employees').doc(`emp_${uid}`) : null;
      const bizReportRef = bizRef ? bizRef.collection('daily_reports').doc(dayKey) : null;

      const [treasuryDoc, bizDoc, bizEmpDoc, bizReportDoc] = await Promise.all([
        tx.get(treasuryRef),
        bizRef ? tx.get(bizRef) : Promise.resolve(null),
        bizEmpRef ? tx.get(bizEmpRef) : Promise.resolve(null),
        bizReportRef ? tx.get(bizReportRef) : Promise.resolve(null),
      ]);

      const miniGameType = String(
        activeShift.miniGameType ||
          (isBizJob ? 'kasir_minimarket' : activeJobId)
      );
      const secret = secretDoc.exists ? (secretDoc.data()?.answers as Record<string, unknown>) : {};
      const score = gradeServerMiniGameTask(miniGameType, secret, submission);

      const currentJob = charData.currentJob || { totalWorkSeconds: 0, shiftsCompleted: 0 };
      const workedSec = Math.min(1800, Math.round((nowMs - startedAtMs) / 1000));
      const newTotalSec = Number(currentJob.totalWorkSeconds || 0) + workedSec;

      const perfFactor = 0.5 + 0.5 * (score / 100);
      let grossPay = 0;
      let rankTitle = String(currentJob.rankTitle || 'Staf Bisnis');
      let rankIndex = Number(currentJob.rankIndex || 0);
      let energyCost = job?.energyCost ?? 12;
      let hygieneCost = job?.hygieneCost ?? 6;
      const skillGainMap: Record<string, number> = job
        ? (job.skillGain as unknown as Record<string, number>)
        : { komunikasi: 1, hitung: 1 };
      let jobTitleLabel = job?.title ?? String(activeShift.jobTitle || 'Staf Bisnis');

      let vehicleBonusRate = 0;
      let vehicleBonusPay = 0;

      if (isBizJob) {
        const baseWage = bizEmpDoc?.exists ? Number(bizEmpDoc.data()!.wagePerCycle || 25000) : 25000;
        grossPay = Math.round(baseWage * perfFactor);
      } else if (job) {
        const rankInfo = computeRankForJob(job.id, newTotalSec);
        rankTitle = rankInfo.title;
        rankIndex = rankInfo.rankIndex;
        const preferredVehId =
          typeof submission.vehicleId === 'string' && submission.vehicleId.trim()
            ? submission.vehicleId.trim()
            : charData.drivingVehicleId
              ? String(charData.drivingVehicleId)
              : typeof activeShift.taskPrompt?.assignedVehicleId === 'string'
                ? String(activeShift.taskPrompt.assignedVehicleId)
                : null;
        const vehEval = evaluateVehicleForJobServer(
          job.id,
          vehiclesList,
          preferredVehId,
          charData,
          nowMs
        );
        if (vehEval.requiresVehicle && vehEval.qualifyingVehicles.length === 0) {
          throw new HttpsError('failed-precondition', vehEval.errorReason || 'Kendaraan kerja tidak valid.');
        }
        // Kurir on-foot mendapat 0 bonus; bonus kurir/ojek/angkot/logistik diberikan jika punya unit sesuai
        const usedMotorKurir =
          job.id === 'kurir' &&
          Boolean(
            typeof submission.vehicleId === 'string' &&
              vehEval.qualifyingVehicles.some((v) => v.id === submission.vehicleId)
          );
        if (job.id === 'kurir') {
          if (usedMotorKurir && vehEval.preferredVehicle) {
            const hasOjolOrBox =
              vehEval.preferredVehicle.modelId === 'motor_ojek' ||
              (Array.isArray(vehEval.preferredVehicle.accessories) &&
                vehEval.preferredVehicle.accessories.includes('box_kurir'));
            vehicleBonusRate = hasOjolOrBox ? 0.3 : 0.15;
          }
        } else {
          vehicleBonusRate = vehEval.bonusRate;
        }
        const baseGross = Math.round(job.basePay * rankInfo.payMultiplier * perfFactor);
        vehicleBonusPay = Math.round(baseGross * vehicleBonusRate);
        grossPay = baseGross + vehicleBonusPay;
      }

      let paidFromSource = grossPay;
      let unpaidShortfall = 0;

      if (isBizJob && bizDoc?.exists && bizRef && bizEmpRef) {
        const bizData = bizDoc.data()!;
        const bizCash = Number(bizData.cash || 0);
        paidFromSource = Math.min(bizCash, grossPay);
        unpaidShortfall = grossPay - paidFromSource;

        const nextBizPop = Math.min(100, Number(bizData.popularity || 30) + (score >= 70 ? 2 : 1));
        tx.update(bizRef, {
          cash: bizCash - paidFromSource,
          popularity: nextBizPop,
          updatedAtMs: nowMs,
        });

        if (bizEmpDoc?.exists) {
          tx.update(bizEmpRef, {
            lastPaidAtMs: nowMs,
            unpaidWage: Number(bizEmpDoc.data()!.unpaidWage || 0) + unpaidShortfall,
          });
        }

        if (paidFromSource > 0) {
          upsertDailyReportInTx(
            tx,
            db,
            bizId,
            String(bizData.ownerId),
            dayKey,
            bizReportDoc?.exists ? bizReportDoc.data() : undefined,
            { wageCost: paidFromSource },
            nowMs
          );
        }
      }

      const incomeTax = Math.round(paidFromSource * taxConfig.incomeTaxRate);
      const netPay = Math.max(0, paidFromSource - incomeTax);

      const rates = configDoc.exists
        ? {
            hungerDecayPerHour: Number(configDoc.data()?.hungerDecayPerHour ?? DEFAULT_DECAY_RATES.hungerDecayPerHour),
            thirstDecayPerHour: Number(configDoc.data()?.thirstDecayPerHour ?? DEFAULT_DECAY_RATES.thirstDecayPerHour),
            energyDecayPerHour: Number(configDoc.data()?.energyDecayPerHour ?? DEFAULT_DECAY_RATES.energyDecayPerHour),
          }
        : DEFAULT_DECAY_RATES;

      const currentStats = calculateLazyStats(
        {
          hunger: Number(statsData.hunger),
          thirst: Number(statsData.thirst),
          energy: Number(statsData.energy),
          health: typeof statsData.health === 'number' ? statsData.health : Number(charData.health ?? 100),
          hygiene: typeof statsData.hygiene === 'number' ? statsData.hygiene : Number(charData.hygiene ?? 100),
          mood: typeof statsData.mood === 'number' ? statsData.mood : Number(charData.mood ?? 80),
          lastCalculatedAtMs: (statsData.lastCalculatedAt as Timestamp).toMillis(),
        },
        nowMs,
        rates
      );

      const nextEnergy = Math.max(0, currentStats.energy - energyCost);
      const nextHygiene = Math.max(0, currentStats.hygiene - hygieneCost);
      const nextMood = Math.max(0, Math.min(100, currentStats.mood + (score >= 70 ? 4 : -6)));

      const nextSkills = { ...DEFAULT_SKILLS, ...(charData.skills || {}) } as Record<string, number>;
      for (const [sk, gain] of Object.entries(skillGainMap)) {
        nextSkills[sk] = (nextSkills[sk] || 0) + (gain ?? 0);
      }

      const nextMoney = Number(charData.money) + netPay;
      const updatedJob = {
        ...currentJob,
        rankIndex,
        rankTitle,
        totalWorkSeconds: newTotalSec,
        shiftsCompleted: Number(currentJob.shiftsCompleted || 0) + 1,
        lastShiftAtMs: nowMs,
      };

      tx.update(charRef, {
        money: nextMoney,
        skills: nextSkills,
        currentJob: updatedJob,
        activeShift: null,
        health: currentStats.health,
        hygiene: nextHygiene,
        mood: nextMood,
        statsUpdatedAt: now,
        updatedAt: now,
      });

      tx.update(statsRef, {
        hunger: currentStats.hunger,
        thirst: currentStats.thirst,
        energy: nextEnergy,
        health: currentStats.health,
        hygiene: nextHygiene,
        mood: nextMood,
        lastCalculatedAt: now,
      });

      tx.update(shiftRef, {
        status: 'completed',
        endedAtMs: nowMs,
        score,
        payEarned: netPay,
        incomeTax,
      });

      if (incomeTax > 0) {
        applyTreasuryCredit(tx, db, treasuryDoc, incomeTax, 'income', nowMs);
      }

      appendTransaction(tx, db, uid, {
        type: 'income',
        category: 'gaji',
        amount: netPay,
        balanceAfter: nextMoney,
        description: `Gaji shift ${jobTitleLabel} (Skor ${score}%, PPh Rp ${incomeTax.toLocaleString('id-ID')})${
          unpaidShortfall > 0 ? ' [Sebagian tertunggak kas usaha]' : ''
        }`,
        nowMs,
      });

      appendLedger(tx, db, {
        from: isBizJob ? `biz:${bizId}` : 'system:employer',
        to: uid,
        amount: netPay,
        taxAmount: incomeTax,
        reason: isBizJob ? 'business_employee_shift_wage' : 'job_shift_income',
        refId: shiftId,
        nowMs,
      });

      return {
        money: nextMoney,
        payEarned: netPay,
        incomeTax,
        score,
        rankTitle,
        skills: nextSkills,
        unpaidShortfall,
        vehicleBonusRate,
        vehicleBonusPay,
      };
    });

    return { ok: true, ...result };
  }
);
