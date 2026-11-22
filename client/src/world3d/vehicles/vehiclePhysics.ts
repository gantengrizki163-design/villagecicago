import type { TrafficConfigDoc, VehicleCategory, VehicleModelConfig, ZoneId } from '../../types/game';
import { getTrafficConfig, getVehicleModelById } from '../../firebase/vehicleConfigCache';
import { getLayoutRoads, LAYOUT_DATA } from '../layout/layoutHelpers';
import { pointInBox } from '../layout/rules';
import type { WeatherKind } from '../assets/WeatherEffects3D';

export type TerrainSurface = 'asphalt' | 'paving' | 'offroad' | 'sawah';
export type RoadHierarchy = 'arteri' | 'kolektor' | 'lingkungan' | 'gang';
export type TurnSignalMode = 'off' | 'left' | 'right' | 'hazard';

export interface TerrainSample {
  surface: TerrainSurface;
  roadId: string | null;
  roadHierarchy: RoadHierarchy | null;
  speedLimitMps: number | null;
}

export interface DrivingTelemetrySnapshot {
  vehicleId: string;
  modelId: string;
  name: string;
  plateNumber: string;
  category: VehicleCategory;
  isElectric: boolean;
  speedKmh: number;
  maxSpeedKmh: number;
  rpmRatio: number;
  gearLabel: 'N' | 'D' | 'R';
  fuel: number;
  fuelCapacity: number;
  condition: number;
  odometerKm: number;
  headlightsOn: boolean;
  brakeOn: boolean;
  turnSignal: TurnSignalMode;
  isOutOfFuel: boolean;
  isPushing: boolean;
  isStalled: boolean;
  terrain: TerrainSurface;
  speedLimitKmh: number | null;
  isSpeeding: boolean;
  isTestDrive: boolean;
  testDriveRemainingSec: number | null;
}

export interface VehiclePhysicsState {
  speedMps: number;
  headingRad: number;
  steerAngle: number;
  wheelSpinRad: number;
  motorLeanRad: number;
  distanceKmAccum: number;
  offroadKmAccum: number;
  fuelRemaining: number;
  condition: number;
  crashDamageAccum?: number;
  stalledUntilMs?: number;
  nextSputterAtMs?: number;
  pushHoldSec?: number;
}

export interface StepVehiclePhysicsInput {
  state: VehiclePhysicsState;
  model: VehicleModelConfig;
  throttle: number; // 0..1
  brakeReverse: number; // 0..1
  steerInput: number; // -1 (left) .. 1 (right)
  handbrake: boolean;
  weather: WeatherKind;
  surface: TerrainSurface;
  wheelRadius: number;
  dt: number;
  nowMs?: number;
}

export interface StepVehiclePhysicsResult {
  vx: number;
  vz: number;
  speedMps: number;
  headingRad: number;
  steerAngle: number;
  wheelSpinRad: number;
  motorLeanRad: number;
  deltaKm: number;
  isBraking: boolean;
  rpmRatio: number;
  gearLabel: 'N' | 'D' | 'R';
  isOutOfFuel: boolean;
  isPushing: boolean;
  isStalled: boolean;
  justStalled: boolean;
  stalledUntilMs: number;
  nextSputterAtMs: number;
  pushHoldSec: number;
}

const ROAD_BOXES = getLayoutRoads();

function getZoneBound(zone: ZoneId): number {
  return zone === 'cicalengka' ? LAYOUT_DATA.rules.worldHalfSize - 2.5 : 70;
}

export function clampVehiclePositionToZone(x: number, z: number, zone: ZoneId): { x: number; z: number } {
  const b = getZoneBound(zone);
  return {
    x: Math.max(-b, Math.min(b, x)),
    z: Math.max(-b, Math.min(b, z)),
  };
}

/**
 * Klasifikasi permukaan tanah berdasarkan layout jalan, trotoar, alun-alun, dan sawah.
 */
export function classifyTerrainAt(
  x: number,
  z: number,
  zone: ZoneId = 'cicalengka',
  trafficCfg: TrafficConfigDoc = getTrafficConfig()
): TerrainSample {
  if (zone !== 'cicalengka') {
    // Zona destinasi kereta memiliki jalan utama di sumbu Z sekitar -26..+10
    if (Math.abs(z + 24) <= 6 || Math.abs(x) <= 6) {
      return {
        surface: 'asphalt',
        roadId: `${zone}_main`,
        roadHierarchy: 'kolektor',
        speedLimitMps: trafficCfg.speedLimitsMps.kolektor,
      };
    }
    return {
      surface: 'paving',
      roadId: null,
      roadHierarchy: null,
      speedLimitMps: null,
    };
  }

  for (const rb of ROAD_BOXES) {
    if (pointInBox(x, z, rb.asphalt, 0.25)) {
      const h = rb.hierarchy as RoadHierarchy;
      return {
        surface: 'asphalt',
        roadId: rb.roadId,
        roadHierarchy: h,
        speedLimitMps: trafficCfg.speedLimitsMps[h] ?? trafficCfg.speedLimitsMps.lingkungan,
      };
    }
  }

  for (const rb of ROAD_BOXES) {
    if (rb.sidewalks.some((sw) => pointInBox(x, z, sw, 0.15))) {
      return {
        surface: 'paving',
        roadId: rb.roadId,
        roadHierarchy: rb.hierarchy as RoadHierarchy,
        speedLimitMps: trafficCfg.speedLimitsMps.gang,
      };
    }
  }

  // Area Alun-Alun & lahan parkir umum
  const alun = LAYOUT_DATA.anchors.alunAlunCenter;
  if (Math.abs(x - alun.x) <= 13 && Math.abs(z - alun.z) <= 11) {
    return {
      surface: 'paving',
      roadId: null,
      roadHierarchy: null,
      speedLimitMps: trafficCfg.speedLimitsMps.gang,
    };
  }

  // Area persawahan timur Cicalengka
  if (x >= 50 && x <= 96 && z >= -38 && z <= 34) {
    return {
      surface: 'sawah',
      roadId: null,
      roadHierarchy: null,
      speedLimitMps: null,
    };
  }

  return {
    surface: 'offroad',
    roadId: null,
    roadHierarchy: null,
    speedLimitMps: null,
  };
}

function getOffroadCapability(modelId: string): number {
  if (modelId === 'motor_trail') return 0.94;
  if (modelId === 'mobil_suv') return 0.9;
  if (modelId === 'mobil_pickup') return 0.85;
  if (modelId === 'motor_ojek' || modelId === 'motor_bebek') return 0.72;
  return 0.56;
}

/**
 * Integrator fisika gaya arcade yang ringan di HP (kinematic-velocity driven)
 * dengan efek medan, cuaca hujan, keausan mesin, dan konsumsi bahan bakar/baterai.
 */
export function stepArcadeVehiclePhysics(input: StepVehiclePhysicsInput): StepVehiclePhysicsResult {
  const { state, model, throttle, brakeReverse, steerInput, handbrake, weather, surface, wheelRadius, dt } = input;

  const isMotor = model.category === 'motor';
  const safeDt = Math.max(0.001, Math.min(dt, 0.05));

  // Pengali cuaca (jalan basah menurunkan cengkeraman dan kecepatan aman)
  const weatherGrip = weather === 'hujan_deras' ? 0.78 : weather === 'gerimis' ? 0.9 : 1.0;
  const weatherTopFactor = weather === 'hujan_deras' ? 0.88 : weather === 'gerimis' ? 0.95 : 1.0;

  // Pengali permukaan medan
  const offroadCap = getOffroadCapability(model.id);
  const surfaceTopFactor =
    surface === 'asphalt'
      ? 1.0
      : surface === 'paving'
        ? 0.9
        : surface === 'offroad'
          ? offroadCap
          : Math.max(0.4, offroadCap * 0.82);

  // Pengali kondisi mesin & status bahan bakar / mogok
  const now = input.nowMs ?? Date.now();
  const hasFuel = state.fuelRemaining > 0.05;
  const isOutOfFuel = !hasFuel;
  const isDeadCondition = state.condition <= 5;
  const condFactor =
    state.condition >= 50
      ? 1.0
      : state.condition >= 22
        ? 0.78
        : 0.52;

  let stalledUntilMs = state.stalledUntilMs ?? 0;
  let nextSputterAtMs = state.nextSputterAtMs ?? 0;
  let pushHoldSec = state.pushHoldSec ?? 0;
  let isStalled = isDeadCondition;
  let justStalled = false;
  let isPushing = false;

  if (hasFuel && !isDeadCondition && state.condition <= 22) {
    if (now < stalledUntilMs) {
      isStalled = true;
    } else if (throttle > 0.2) {
      if (nextSputterAtMs <= 0) {
        nextSputterAtMs = now + 4500;
      } else if (now >= nextSputterAtMs) {
        stalledUntilMs = now + 1500;
        nextSputterAtMs = now + 6500;
        isStalled = true;
        justStalled = true;
      }
    }
  } else if (state.condition > 22) {
    stalledUntilMs = 0;
    nextSputterAtMs = 0;
  }

  const engineCanRun = hasFuel && !isStalled;
  const effectiveMaxSpeed = engineCanRun
    ? model.maxSpeedMps * surfaceTopFactor * weatherTopFactor * condFactor
    : 1.35; // Habis bensin / mogok parah: hanya bisa didorong pelan setelah berhenti

  const maxReverseSpeed = engineCanRun ? Math.min(6.5, model.maxSpeedMps * 0.34) : 0.9;
  const accelRate = (engineCanRun ? model.acceleration : 1.05) * condFactor * (surface === 'sawah' ? 0.75 : 1.0);
  const decelBrake = (isMotor ? 16.5 : 14.5) * weatherGrip;
  const dragCoeff = !engineCanRun
    ? (surface === 'sawah' ? 4.2 : 2.8)
    : surface === 'sawah'
      ? 3.2
      : surface === 'offroad'
        ? 2.4
        : 1.65;

  let v = state.speedMps;
  let isBraking = false;

  if (justStalled && v > 1.5) {
    v *= 0.72;
  }

  // Jika habis bensin atau mesin mati total: hentikan kendaraan dulu, lalu boleh didorong pelan
  const allowPushMode = !engineCanRun && (isOutOfFuel || isDeadCondition);
  if (allowPushMode) {
    if (Math.abs(v) <= 1.45 && throttle > 0.1 && brakeReverse <= 0.05 && !handbrake) {
      pushHoldSec += safeDt;
    } else if (Math.abs(v) > 1.6 || throttle <= 0.05) {
      pushHoldSec = 0;
    }
  } else {
    pushHoldSec = 0;
  }

  const effectiveThrottle = engineCanRun
    ? throttle
    : allowPushMode && pushHoldSec >= 0.35
      ? throttle
      : 0;

  if (handbrake) {
    isBraking = true;
    const stopStep = decelBrake * 1.25 * safeDt;
    if (Math.abs(v) <= stopStep) v = 0;
    else v -= Math.sign(v) * stopStep;
  } else if (effectiveThrottle > 0.05 && brakeReverse <= 0.05) {
    if (v < -0.2) {
      // Mengerem dari mundur ke maju
      isBraking = true;
      v = Math.min(0, v + decelBrake * safeDt);
    } else {
      if (allowPushMode) {
        isPushing = true;
      }
      v += accelRate * effectiveThrottle * safeDt;
      if (v > effectiveMaxSpeed) {
        v = effectiveMaxSpeed + (v - effectiveMaxSpeed) * Math.exp(-3.5 * safeDt);
      }
    }
  } else if (brakeReverse > 0.05) {
    if (v > 0.35) {
      // Pengereman saat maju
      isBraking = true;
      v = Math.max(0, v - decelBrake * brakeReverse * safeDt);
    } else if (engineCanRun) {
      // Mundur perlahan hanya saat mesin hidup
      v -= accelRate * 0.55 * brakeReverse * safeDt;
      if (v < -maxReverseSpeed) v = -maxReverseSpeed;
    } else {
      const coast = v * Math.exp(-dragCoeff * safeDt);
      v = Math.abs(coast) < 0.05 ? 0 : coast;
    }
  } else {
    // Coasting rolling resistance
    const coast = v * Math.exp(-dragCoeff * safeDt);
    v = Math.abs(coast) < 0.06 ? 0 : coast;
  }

  // Kemudi visual & laju rotasi heading (belok sesuai arah laju + sensitivitas kecepatan)
  const targetSteerAngle = -steerInput * (isMotor ? 0.42 : 0.38);
  const nextSteerAngle = state.steerAngle + (targetSteerAngle - state.steerAngle) * (1 - Math.exp(-12 * safeDt));

  const speedFactor = Math.min(1, Math.abs(v) / (isPushing ? 0.9 : 2.6));
  const reverseSign = v >= -0.05 ? 1 : -1;
  const highSpeedDamp = 1 - Math.min(0.38, Math.abs(v) / Math.max(10, model.maxSpeedMps * 1.35));
  const yawRate =
    -steerInput *
    reverseSign *
    (1.35 + model.handling * 1.45) *
    speedFactor *
    highSpeedDamp *
    weatherGrip;

  const nextHeading = state.headingRad + yawRate * safeDt;

  // Kemiringan bodi motor saat menikung (banking lean)
  const targetLean = isMotor ? -steerInput * speedFactor * 0.24 : 0;
  const nextLean = state.motorLeanRad + (targetLean - state.motorLeanRad) * (1 - Math.exp(-10 * safeDt));

  // Rotasi roda sesuai jarak tempuh
  const safeRadius = Math.max(0.18, wheelRadius);
  const nextWheelSpin = (state.wheelSpinRad + (v * safeDt) / safeRadius) % (Math.PI * 200);

  // Vektor kecepatan dunia (model menghadapi +Z saat rotY = 0)
  const vx = Math.sin(nextHeading) * v;
  const vz = Math.cos(nextHeading) * v;

  const deltaKm = (Math.abs(v) * safeDt) / 1000;
  const speedRatio = Math.min(1, Math.abs(v) / Math.max(1, model.maxSpeedMps));
  const rpmRatio = engineCanRun ? Math.min(1, throttle * 0.35 + speedRatio * 0.65) : 0;
  const gearLabel: 'N' | 'D' | 'R' = v < -0.25 ? 'R' : Math.abs(v) < 0.2 && effectiveThrottle < 0.05 ? 'N' : 'D';

  return {
    vx,
    vz,
    speedMps: v,
    headingRad: nextHeading,
    steerAngle: nextSteerAngle,
    wheelSpinRad: nextWheelSpin,
    motorLeanRad: nextLean,
    deltaKm,
    isBraking,
    rpmRatio,
    gearLabel,
    isOutOfFuel,
    isPushing,
    isStalled,
    justStalled,
    stalledUntilMs,
    nextSputterAtMs,
    pushHoldSec,
  };
}

export function getDisplaySpeedKmh(speedMps: number): number {
  // Skala arcade Cicalengka: 1 m/s game ~ 3.2 km/jam speedometer agar terasa pas di peta kota 200m
  return Math.round(Math.abs(speedMps) * 3.2);
}

export function getModelMaxSpeedKmh(modelId: string): number {
  const m = getVehicleModelById(modelId);
  return Math.round((m?.maxSpeedMps ?? 16) * 3.2);
}
