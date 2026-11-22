import { doc, getDoc } from 'firebase/firestore';
import clinicJson from '../../../functions/src/config/clinic.json';
import coursesJson from '../../../functions/src/config/courses.json';
import economyJson from '../../../functions/src/config/economy.json';
import housingJson from '../../../functions/src/config/housing.json';
import jobsJson from '../../../functions/src/config/jobs.json';
import trainScheduleJson from '../../../functions/src/config/trainSchedule.json';
import type {
  ClinicConfigItem,
  CourseConfigItem,
  EconomyConfig,
  HousingConfigDoc,
  JobConfigItem,
  TrainScheduleConfig,
} from '../types/game';
import { DEFAULT_GAME_CONFIG } from '../world3d/worldConstants';
import { db } from './config';

export interface Phase2BundleConfig {
  jobs: JobConfigItem[];
  clinics: ClinicConfigItem[];
  schoolLocation: { zone: string; x: number; z: number; label: string };
  courses: CourseConfigItem[];
  trainSchedule: TrainScheduleConfig;
  economy: EconomyConfig;
  housing: HousingConfigDoc;
}

const DEFAULT_BUNDLE: Phase2BundleConfig = {
  jobs: jobsJson.jobs as JobConfigItem[],
  clinics: clinicJson.clinics as ClinicConfigItem[],
  schoolLocation: coursesJson.schoolLocation,
  courses: coursesJson.courses as CourseConfigItem[],
  trainSchedule: trainScheduleJson as TrainScheduleConfig,
  economy: economyJson as EconomyConfig,
  housing: housingJson as unknown as HousingConfigDoc,
};

let cachedBundle: Phase2BundleConfig | null = null;
let loadPromise: Promise<Phase2BundleConfig> | null = null;

/**
 * Membaca dokumen config Firestore sekali per sesi lalu menyimpannya di cache memori
 * agar hemat kuota read Firebase.
 */
export async function loadPhase2ConfigCached(): Promise<Phase2BundleConfig> {
  if (cachedBundle) return cachedBundle;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [jobsSnap, clinicSnap, coursesSnap, trainSnap, econSnap, housingSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'jobs')).catch(() => null),
        getDoc(doc(db, 'config', 'clinic')).catch(() => null),
        getDoc(doc(db, 'config', 'courses')).catch(() => null),
        getDoc(doc(db, 'config', 'trainSchedule')).catch(() => null),
        getDoc(doc(db, 'config', 'economy')).catch(() => null),
        getDoc(doc(db, 'config', 'housing')).catch(() => null),
      ]);

      const remoteJobs =
        jobsSnap?.exists() && Array.isArray(jobsSnap.data()?.jobs)
          ? (jobsSnap.data().jobs as JobConfigItem[])
          : [];
      const mergedJobsMap = new Map<string, JobConfigItem>();
      for (const j of DEFAULT_BUNDLE.jobs) mergedJobsMap.set(j.id, j);
      for (const j of remoteJobs) {
        const base = mergedJobsMap.get(j.id);
        mergedJobsMap.set(j.id, base ? { ...base, ...j } : j);
      }

      cachedBundle = {
        jobs: Array.from(mergedJobsMap.values()),
        clinics:
          clinicSnap?.exists() && Array.isArray(clinicSnap.data()?.clinics)
            ? (clinicSnap.data().clinics as ClinicConfigItem[])
            : DEFAULT_BUNDLE.clinics,
        schoolLocation:
          coursesSnap?.exists() && coursesSnap.data()?.schoolLocation
            ? coursesSnap.data().schoolLocation
            : DEFAULT_BUNDLE.schoolLocation,
        courses:
          coursesSnap?.exists() && Array.isArray(coursesSnap.data()?.courses)
            ? (coursesSnap.data().courses as CourseConfigItem[])
            : DEFAULT_BUNDLE.courses,
        trainSchedule:
          trainSnap?.exists() && trainSnap.data()?.stations
            ? (trainSnap.data() as TrainScheduleConfig)
            : DEFAULT_BUNDLE.trainSchedule,
        economy:
          econSnap?.exists() && typeof econSnap.data()?.hygieneDecayPerHour === 'number'
            ? (econSnap.data() as EconomyConfig)
            : DEFAULT_BUNDLE.economy,
        housing:
          housingSnap?.exists() && housingSnap.data()?.leaseSettings
            ? (housingSnap.data() as HousingConfigDoc)
            : DEFAULT_BUNDLE.housing,
      };
      return cachedBundle;
    } catch {
      cachedBundle = DEFAULT_BUNDLE;
      return cachedBundle;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function getDefaultPhase2Config(): Phase2BundleConfig {
  return cachedBundle || DEFAULT_BUNDLE;
}

export interface DeterministicTrainState {
  phase: 'approaching' | 'boarding' | 'departing' | 'away';
  boardingOpen: boolean;
  trainX: number;
  nextArrivalSec: number;
  boardingRemainSec: number;
}

/**
 * Menghitung posisi & status kereta 3D secara deterministik dari waktu game
 * sehingga seluruh pemain melihat kereta tiba/berangkat bersamaan tanpa sync RTDB.
 */
export function getDeterministicTrainState(
  serverNowMs: number,
  schedule: TrainScheduleConfig = DEFAULT_BUNDLE.trainSchedule,
  epochMs: number = DEFAULT_GAME_CONFIG.epochMs
): DeterministicTrainState {
  const cycleMs = schedule.cycleRealMs || 60000;
  const elapsed = Math.max(0, serverNowMs - epochMs);
  const phaseMs = elapsed % cycleMs;

  if (phaseMs < schedule.arriveEndMs) {
    const t = phaseMs / schedule.arriveEndMs;
    const easeOut = 1 - Math.pow(1 - t, 3);
    return {
      phase: 'approaching',
      boardingOpen: false,
      trainX: -78 + easeOut * 78,
      nextArrivalSec: Math.ceil((schedule.arriveEndMs - phaseMs) / 1000),
      boardingRemainSec: 0,
    };
  }

  if (phaseMs <= schedule.boardingEndMs) {
    return {
      phase: 'boarding',
      boardingOpen: true,
      trainX: 0,
      nextArrivalSec: 0,
      boardingRemainSec: Math.max(0, Math.ceil((schedule.boardingEndMs - phaseMs) / 1000)),
    };
  }

  if (phaseMs <= schedule.departEndMs) {
    const t = (phaseMs - schedule.boardingEndMs) / (schedule.departEndMs - schedule.boardingEndMs);
    const easeIn = t * t * t;
    return {
      phase: 'departing',
      boardingOpen: false,
      trainX: easeIn * 82,
      nextArrivalSec: Math.ceil((cycleMs - phaseMs + schedule.arriveEndMs) / 1000),
      boardingRemainSec: 0,
    };
  }

  return {
    phase: 'away',
    boardingOpen: false,
    trainX: 140,
    nextArrivalSec: Math.ceil((cycleMs - phaseMs + schedule.arriveEndMs) / 1000),
    boardingRemainSec: 0,
  };
}
