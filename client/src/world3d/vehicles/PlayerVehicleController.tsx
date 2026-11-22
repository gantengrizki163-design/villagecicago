import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { AvatarMesh } from '../../components/AvatarMesh';
import { FloatingTag } from '../../components/FloatingTag';
import type { PlayerInputState } from '../../components/MobileControls';
import {
  getDefaultVehicleConfig,
  getTrafficConfig,
  getVehicleModelById,
} from '../../firebase/vehicleConfigCache';
import type {
  CharacterDoc,
  GraphicsQuality,
  PlayerAnimState,
  RTDBPlayer,
  RTDBVehiclePassenger,
  VehicleCategory,
  ZoneId,
} from '../../types/game';
import type { WeatherKind } from '../assets/WeatherEffects3D';
import type { NpcWorldPositionEntry } from '../NpcCrowd';
import type { RemotePlayerAppearance, SyncVehicleTransformPayload } from '../useMultiplayerSync';
import { VehicleModelMesh } from './VehicleModelMesh';
import { vehicleAudio } from './vehicleAudio';
import { getVehicleSeatAnchors } from './vehicleMaterials';
import {
  getPassengerSeatOffset,
  normalizeAngleRad,
  saveLocalLastDrivePos,
  shouldSendVehicleSyncUpdate,
  type VehicleSyncRecord,
} from './vehicleMultiplayer';
import {
  classifyTerrainAt,
  clampVehiclePositionToZone,
  getDisplaySpeedKmh,
  getModelMaxSpeedKmh,
  stepArcadeVehiclePhysics,
  type DrivingTelemetrySnapshot,
  type TurnSignalMode,
  type VehiclePhysicsState,
} from './vehiclePhysics';

export interface ActiveDriveVehicle {
  mode: 'owned' | 'test_drive';
  vehicleId: string;
  modelId: string;
  name: string;
  plateNumber: string;
  category: VehicleCategory;
  color: string;
  isElectric: boolean;
  fuel: number;
  fuelCapacity: number;
  condition: number;
  odometerKm: number;
  accessories?: string[];
  spawnPos: { x: number; y: number; z: number; rotY: number };
  testDriveAnchor?: { x: number; z: number; expiresAtMs: number; maxRadiusMeters: number };
}

export interface ExitVehiclePayload {
  vehicleId: string;
  mode: 'owned' | 'test_drive';
  x: number;
  y: number;
  z: number;
  rotY: number;
  distanceKm: number;
  offroadKm: number;
  fuelRemaining: number;
  conditionRemaining: number;
  crashDamage: number;
  reason?: 'manual' | 'test_drive_expired' | 'test_drive_out_of_bounds';
}

export interface PedestrianCollisionInfo {
  targetName: string;
  targetType: 'npc' | 'player';
  x: number;
  z: number;
  zone: ZoneId;
}

interface PlayerVehicleControllerProps {
  character: CharacterDoc;
  vehicle: ActiveDriveVehicle;
  currentZone: ZoneId;
  serverOffsetMs: number;
  isNight: boolean;
  weather: WeatherKind;
  quality: GraphicsQuality;
  movementLocked: boolean;
  localChatBubble: string | null;
  inputRef: React.MutableRefObject<PlayerInputState>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  vehicleHeadingRef: React.MutableRefObject<number>;
  vehicleSpeedRef: React.MutableRefObject<number>;
  hornNonce: number;
  dismountNonce?: number;
  headlightsManual: boolean | null;
  turnSignal?: TurnSignalMode;
  onToggleTurnSignal?: (mode: 'left' | 'right' | 'hazard') => void;
  remotePlayers?: RTDBPlayer[];
  rtdbPassengers?: RTDBVehiclePassenger[];
  playerAppearances?: Record<string, RemotePlayerAppearance>;
  localBubbles?: Record<string, string>;
  npcWorldPosMapRef?: React.MutableRefObject<Record<string, NpcWorldPositionEntry>>;
  knockedNpcUntilRef?: React.MutableRefObject<Record<string, number>>;
  onPedestrianCollision?: (info: PedestrianCollisionInfo) => void;
  onSyncTransform: (x: number, y: number, z: number, rotY: number, anim: PlayerAnimState) => void;
  onSyncVehicleTransform?: (payload: SyncVehicleTransformPayload) => void;
  onDrivingTelemetry?: (telemetry: DrivingTelemetrySnapshot) => void;
  onExitVehicle: (payload: ExitVehiclePayload) => void;
  onNotify?: (msg: string) => void;
}

/**
 * Kontroler fisik & visual kendaraan yang sedang dikendarai pemain lokal.
 * Menggunakan Rapier RigidBody (kinematik kecepatan terkendali) + efek audio, lampu, sein & tabrakan.
 */
export const PlayerVehicleController: React.FC<PlayerVehicleControllerProps> = ({
  character,
  vehicle,
  currentZone,
  serverOffsetMs,
  isNight,
  weather,
  quality,
  movementLocked,
  localChatBubble,
  inputRef,
  playerPosRef,
  vehicleHeadingRef,
  vehicleSpeedRef,
  hornNonce,
  dismountNonce = 0,
  headlightsManual,
  turnSignal = 'off',
  onToggleTurnSignal,
  remotePlayers = [],
  rtdbPassengers = [],
  playerAppearances = {},
  localBubbles = {},
  npcWorldPosMapRef,
  knockedNpcUntilRef,
  onPedestrianCollision,
  onSyncTransform,
  onSyncVehicleTransform,
  onDrivingTelemetry,
  onExitVehicle,
  onNotify,
}) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const visualGroupRef = useRef<THREE.Group>(null);
  const dustRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null]);
  const keysRef = useRef<Record<string, boolean>>({});
  const exitedRef = useRef(false);

  const bundleCfg = getDefaultVehicleConfig();
  const trafficCfg = getTrafficConfig();
  const model = useMemo(
    () => getVehicleModelById(vehicle.modelId, bundleCfg.vehicles) ?? bundleCfg.vehicles.models[0],
    [vehicle.modelId, bundleCfg.vehicles]
  );
  const anchors = useMemo(() => getVehicleSeatAnchors(vehicle.modelId), [vehicle.modelId]);

  const physRef = useRef<VehiclePhysicsState>({
    speedMps: 0,
    headingRad: vehicle.spawnPos.rotY || 0,
    steerAngle: 0,
    wheelSpinRad: 0,
    motorLeanRad: 0,
    distanceKmAccum: 0,
    offroadKmAccum: 0,
    fuelRemaining: Math.max(0, vehicle.fuel),
    condition: Math.max(5, vehicle.condition),
    crashDamageAccum: 0,
    stalledUntilMs: 0,
    nextSputterAtMs: 0,
    pushHoldSec: 0,
  });

  const [wheelPose, setWheelPose] = useState({ steer: 0, spin: 0, brake: false });
  const [turnBlinkOn, setTurnBlinkOn] = useState(false);
  const turnBlinkRef = useRef(false);
  const blinkTimerRef = useRef(0);
  const wheelSyncTimerRef = useRef(0);
  const telemetryTimerRef = useRef(0);
  const syncTimerRef = useRef(0);
  const lastVehicleSyncRef = useRef<VehicleSyncRecord | null>(null);
  const lastHornAtMsRef = useRef(0);
  const lastLocalSaveTimerRef = useRef(0);
  const crashCooldownRef = useRef(0);
  const pedCooldownRef = useRef(0);
  const expectedSpeedRef = useRef(0);
  const prevHornNonceRef = useRef(hornNonce);
  const prevDismountNonceRef = useRef(dismountNonce);
  const lastDustPhaseRef = useRef(0);
  const outFuelWarnedRef = useRef(false);

  const [localHeadlights, setLocalHeadlights] = useState<boolean>(() => isNight);
  const headlightsOn = headlightsManual !== null ? headlightsManual : localHeadlights;

  const colliderHalfW = Math.max(0.32, (model.dimensions?.width ?? 1.6) * 0.46);
  const colliderHalfH = Math.max(0.42, (model.dimensions?.height ?? 1.4) * 0.48);
  const colliderHalfL = Math.max(0.75, (model.dimensions?.length ?? 3.8) * 0.47);

  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.15, colliderHalfL + 13);
    return o;
  }, [colliderHalfL]);

  const triggerExit = useCallback(
    (reason: ExitVehiclePayload['reason'] = 'manual') => {
      if (exitedRef.current) return;
      exitedRef.current = true;
      const pos = rbRef.current?.translation() ?? vehicle.spawnPos;
      onExitVehicle({
        vehicleId: vehicle.vehicleId,
        mode: vehicle.mode,
        x: pos.x,
        y: Math.max(0, pos.y),
        z: pos.z,
        rotY: physRef.current.headingRad,
        distanceKm: Number(physRef.current.distanceKmAccum.toFixed(3)),
        offroadKm: Number(physRef.current.offroadKmAccum.toFixed(3)),
        fuelRemaining: Number(physRef.current.fuelRemaining.toFixed(2)),
        conditionRemaining: Number(physRef.current.condition.toFixed(1)),
        crashDamage: Number((physRef.current.crashDamageAccum ?? 0).toFixed(1)),
        reason,
      });
    },
    [onExitVehicle, vehicle.mode, vehicle.spawnPos, vehicle.vehicleId]
  );

  // Sinkronisasi awal heading & audio mesin saat naik
  useEffect(() => {
    exitedRef.current = false;
    vehicleHeadingRef.current = vehicle.spawnPos.rotY || 0;
    vehicleSpeedRef.current = 0;
    playerPosRef.current.set(vehicle.spawnPos.x, vehicle.spawnPos.y, vehicle.spawnPos.z);

    vehicleAudio.playEngineStart(vehicle.isElectric);
    vehicleAudio.startEngine(vehicle.isElectric, vehicle.category);

    return () => {
      vehicleAudio.stopEngine();
      vehicleSpeedRef.current = 0;
    };
  }, [
    playerPosRef,
    vehicle.category,
    vehicle.isElectric,
    vehicle.spawnPos.rotY,
    vehicle.spawnPos.x,
    vehicle.spawnPos.y,
    vehicle.spawnPos.z,
    vehicleHeadingRef,
    vehicleSpeedRef,
  ]);

  // Trigger klakson dari tombol HUD HP
  useEffect(() => {
    if (hornNonce !== prevHornNonceRef.current) {
      prevHornNonceRef.current = hornNonce;
      lastHornAtMsRef.current = Date.now() + serverOffsetMs;
      vehicleAudio.playHorn(vehicle.category);
    }
  }, [hornNonce, serverOffsetMs, vehicle.category]);

  // Trigger turun & parkir dari tombol HUD / HP (melewati alur keluar terpadu)
  useEffect(() => {
    if (dismountNonce !== prevDismountNonceRef.current) {
      prevDismountNonceRef.current = dismountNonce;
      triggerExit('manual');
    }
  }, [dismountNonce, triggerExit]);

  // Reset fase kedip sein saat mode berubah
  useEffect(() => {
    blinkTimerRef.current = 0;
    const active = turnSignal !== 'off';
    turnBlinkRef.current = active;
    setTurnBlinkOn(active);
    if (active) {
      vehicleAudio.playTurnSignalTick(true);
    }
  }, [turnSignal]);

  // Keyboard listener (WASD/Panah, Space Rem, H Klakson, L Lampu, Z/C/X Sein, F Turun)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keysRef.current[e.code] = true;

      if (movementLocked || exitedRef.current) return;

      if (e.code === 'KeyH' && !e.repeat) {
        lastHornAtMsRef.current = Date.now() + serverOffsetMs;
        vehicleAudio.playHorn(vehicle.category);
      } else if (e.code === 'KeyL' && !e.repeat) {
        setLocalHeadlights((prev) => !prev);
      } else if (e.code === 'KeyZ' && !e.repeat) {
        onToggleTurnSignal?.('left');
      } else if (e.code === 'KeyC' && !e.repeat) {
        onToggleTurnSignal?.('right');
      } else if (e.code === 'KeyX' && !e.repeat) {
        onToggleTurnSignal?.('hazard');
      } else if (e.code === 'Space' && !e.repeat && Math.abs(physRef.current.speedMps) > 4.5) {
        vehicleAudio.playSkidChirp();
      } else if (e.code === 'KeyF' && !e.repeat) {
        triggerExit('manual');
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [movementLocked, onToggleTurnSignal, triggerExit, vehicle.category]);

  useFrame((_, delta) => {
    const rb = rbRef.current;
    if (!rb || exitedRef.current) return;
    const dt = Math.min(delta, 0.05);
    const p = physRef.current;

    if (crashCooldownRef.current > 0) {
      crashCooldownRef.current = Math.max(0, crashCooldownRef.current - dt);
    }
    if (pedCooldownRef.current > 0) {
      pedCooldownRef.current = Math.max(0, pedCooldownRef.current - dt);
    }

    // Kedip lampu sein (~2.3 Hz)
    if (turnSignal !== 'off') {
      blinkTimerRef.current += dt;
      if (blinkTimerRef.current >= 0.42) {
        blinkTimerRef.current = 0;
        const nextBlink = !turnBlinkRef.current;
        turnBlinkRef.current = nextBlink;
        setTurnBlinkOn(nextBlink);
        vehicleAudio.playTurnSignalTick(nextBlink);
      }
    }

    const pos = rb.translation();
    const curLinvel = rb.linvel();

    // Deteksi benturan mendadak dengan bangunan/pagar/kendaraan parkir
    const actualHorizSpeed = Math.hypot(curLinvel.x, curLinvel.z);
    if (
      crashCooldownRef.current <= 0 &&
      expectedSpeedRef.current > 5.2 &&
      actualHorizSpeed < expectedSpeedRef.current * 0.35
    ) {
      const severity = Math.min(1, expectedSpeedRef.current / Math.max(10, model.maxSpeedMps));
      const dmg = 0.6 + severity * 1.4;
      crashCooldownRef.current = 0.85;
      p.speedMps = -p.speedMps * 0.22;
      p.condition = Math.max(5, p.condition - dmg);
      p.crashDamageAccum = (p.crashDamageAccum ?? 0) + dmg;
      vehicleAudio.playCrash(severity);
      if (severity > 0.65) {
        onNotify?.('Brak! Kendaraan menabrak penghalang, kondisi berkurang sedikit.');
      }
    }

    // Batas waktu & radius Test Drive
    if (vehicle.mode === 'test_drive' && vehicle.testDriveAnchor) {
      const now = Date.now() + serverOffsetMs;
      if (now >= vehicle.testDriveAnchor.expiresAtMs) {
        triggerExit('test_drive_expired');
        return;
      }
      const distFromDealer = Math.hypot(
        pos.x - vehicle.testDriveAnchor.x,
        pos.z - vehicle.testDriveAnchor.z
      );
      if (distFromDealer > vehicle.testDriveAnchor.maxRadiusMeters + 3) {
        triggerExit('test_drive_out_of_bounds');
        return;
      }
    }

    // Baca input keyboard + tombol sentuh HP
    const k = keysRef.current;
    const inp = inputRef.current;
    let throttle = movementLocked ? 0 : Math.max(0, inp.driveThrottle ?? 0);
    let brakeReverse = movementLocked ? 0 : Math.max(0, inp.driveBrake ?? 0);
    let steerInput = movementLocked ? 0 : (inp.driveSteer ?? 0);
    const handbrake = !movementLocked && Boolean(k['Space']);

    if (!movementLocked) {
      if (k['KeyW'] || k['ArrowUp']) throttle = Math.max(throttle, 1);
      if (k['KeyS'] || k['ArrowDown']) brakeReverse = Math.max(brakeReverse, 1);
      if (k['KeyA'] || k['ArrowLeft']) steerInput -= 1;
      if (k['KeyD'] || k['ArrowRight']) steerInput += 1;
      steerInput = Math.max(-1, Math.min(1, steerInput));
    }

    const nowWallMs = Date.now();
    const terrain = classifyTerrainAt(pos.x, pos.z, currentZone, trafficCfg);
    const step = stepArcadeVehiclePhysics({
      state: p,
      model,
      throttle,
      brakeReverse,
      steerInput,
      handbrake,
      weather,
      surface: terrain.surface,
      wheelRadius: anchors.wheelRadius,
      dt,
      nowMs: nowWallMs,
    });

    p.speedMps = step.speedMps;
    p.headingRad = step.headingRad;
    p.steerAngle = step.steerAngle;
    p.wheelSpinRad = step.wheelSpinRad;
    p.motorLeanRad = step.motorLeanRad;
    p.stalledUntilMs = step.stalledUntilMs;
    p.nextSputterAtMs = step.nextSputterAtMs;
    p.pushHoldSec = step.pushHoldSec;
    p.distanceKmAccum += step.deltaKm;
    if (terrain.surface === 'offroad' || terrain.surface === 'sawah') {
      p.offroadKmAccum += step.deltaKm;
    }

    if (step.justStalled) {
      vehicleAudio.playEngineSputter();
      onNotify?.('Mesin tersendat (mogok)! Kondisi kendaraan rendah, segera servis di bengkel.');
    }

    // Deteksi tabrakan pejalan kaki (NPC & pemain lain yang sedang berjalan)
    let outVx = step.vx;
    let outVz = step.vz;
    if (pedCooldownRef.current <= 0 && Math.abs(step.speedMps) > 3.2 && vehicle.mode === 'owned') {
      const hitRadius = vehicle.category === 'motor' ? 1.05 : 1.45;
      const faintMs = (trafficCfg.pedestrianFaintSec ?? 3.5) * 1000;
      let hitTarget: { name: string; type: 'npc' | 'player'; npcId?: string } | null = null;

      if (npcWorldPosMapRef) {
        const entries = Object.values(npcWorldPosMapRef.current);
        for (let i = 0; i < entries.length; i++) {
          const npc = entries[i];
          if ((knockedNpcUntilRef?.current[npc.npcId] ?? 0) > nowWallMs) continue;
          if (Math.hypot(pos.x - npc.x, pos.z - npc.z) <= hitRadius) {
            hitTarget = { name: npc.name, type: 'npc', npcId: npc.npcId };
            break;
          }
        }
      }

      if (!hitTarget && remotePlayers.length > 0) {
        for (let i = 0; i < remotePlayers.length; i++) {
          const rp = remotePlayers[i];
          if (rp.zone !== currentZone || rp.anim === 'driving') continue;
          if (Math.hypot(pos.x - rp.x, pos.z - rp.z) <= hitRadius) {
            hitTarget = { name: rp.name, type: 'player' };
            break;
          }
        }
      }

      if (hitTarget) {
        pedCooldownRef.current = 8;
        if (hitTarget.npcId && knockedNpcUntilRef) {
          knockedNpcUntilRef.current[hitTarget.npcId] = nowWallMs + faintMs;
        }
        p.speedMps = 0;
        outVx = 0;
        outVz = 0;
        p.condition = Math.max(5, p.condition - 1.5);
        p.crashDamageAccum = (p.crashDamageAccum ?? 0) + 1.5;
        vehicleAudio.playCrash(0.85);
        onPedestrianCollision?.({
          targetName: hitTarget.name,
          targetType: hitTarget.type,
          x: Number(pos.x.toFixed(2)),
          z: Number(pos.z.toFixed(2)),
          zone: currentZone,
        });
      }
    }

    // Konsumsi bahan bakar / baterai lazy
    if (step.deltaKm > 0 && vehicle.mode === 'owned') {
      const fuelBurn = step.deltaKm * model.consumptionPerKm * (throttle > 0.2 ? 1.15 : 0.85);
      p.fuelRemaining = Math.max(0, p.fuelRemaining - fuelBurn);
      if (p.fuelRemaining <= 0.05 && !outFuelWarnedRef.current) {
        outFuelWarnedRef.current = true;
        onNotify?.(
          vehicle.isElectric
            ? 'Baterai habis! Hentikan lalu tahan gas untuk dorong pelan ke SPBU.'
            : 'Bensin habis! Hentikan lalu tahan gas untuk dorong pelan ke SPBU.'
        );
      } else if (p.fuelRemaining > 1) {
        outFuelWarnedRef.current = false;
      }

      const wearBurn =
        step.deltaKm *
        model.wearRatePerKm *
        (terrain.surface === 'sawah' ? 1.8 : terrain.surface === 'offroad' ? 1.45 : 1);
      p.condition = Math.max(5, p.condition - wearBurn);
    }

    expectedSpeedRef.current = Math.abs(p.speedMps);

    // Clamp agar tidak keluar batas peta
    const clamped = clampVehiclePositionToZone(pos.x, pos.z, currentZone);
    if (clamped.x !== pos.x || clamped.z !== pos.z) {
      rb.setTranslation({ x: clamped.x, y: pos.y, z: clamped.z }, true);
    }

    const cleanVy = Math.abs(curLinvel.y) < 0.08 ? 0 : curLinvel.y;
    rb.setLinvel({ x: outVx, y: cleanVy, z: outVz }, true);

    // Sinkronkan orientasi visual + kamera kejar
    if (visualGroupRef.current) {
      visualGroupRef.current.rotation.set(0, p.headingRad, p.motorLeanRad);
    }

    vehicleHeadingRef.current = p.headingRad;
    vehicleSpeedRef.current = p.speedMps;

    const followDamp = 1 - Math.exp(-32 * dt);
    playerPosRef.current.x = THREE.MathUtils.lerp(playerPosRef.current.x, pos.x, followDamp);
    playerPosRef.current.y = THREE.MathUtils.lerp(playerPosRef.current.y, Math.max(0, pos.y), followDamp);
    playerPosRef.current.z = THREE.MathUtils.lerp(playerPosRef.current.z, pos.z, followDamp);

    // Update modul audio web sesuai RPM / status mogok & bensin
    vehicleAudio.updateEngine(
      step.rpmRatio,
      vehicle.isElectric,
      vehicle.category,
      (p.fuelRemaining > 0.05 && !step.isStalled) || vehicle.mode === 'test_drive'
    );

    // Partikel asap/debu ringan di roda belakang saat melaju
    if (quality !== 'low') {
      lastDustPhaseRef.current += dt * (2 + Math.abs(p.speedMps) * 0.65);
      const showDust =
        Math.abs(p.speedMps) > 3.2 &&
        (terrain.surface === 'offroad' || terrain.surface === 'sawah' || Math.abs(p.speedMps) > 8);
      for (let i = 0; i < dustRefs.current.length; i++) {
        const mesh = dustRefs.current[i];
        if (!mesh) continue;
        mesh.visible = showDust;
        if (showDust) {
          const cycle = (lastDustPhaseRef.current + i * 0.25) % 1;
          mesh.position.set(
            (i % 2 === 0 ? -0.25 : 0.25) * (vehicle.category === 'motor' ? 0.35 : 1),
            0.14 + cycle * 0.32,
            -colliderHalfL - 0.15 - cycle * 1.1
          );
          const s = (1 - cycle * 0.65) * (terrain.surface === 'offroad' || terrain.surface === 'sawah' ? 1.25 : 0.75);
          mesh.scale.setScalar(Math.max(0.1, s));
        }
      }
    }

    // Throttle animasi roda & lampu rem (20Hz saat aktif agar minim re-render)
    wheelSyncTimerRef.current += dt;
    if (wheelSyncTimerRef.current >= 0.05) {
      wheelSyncTimerRef.current = 0;
      if (
        Math.abs(p.speedMps) > 0.08 ||
        Math.abs(step.steerAngle - wheelPose.steer) > 0.02 ||
        step.isBraking !== wheelPose.brake
      ) {
        setWheelPose({
          steer: Number(step.steerAngle.toFixed(3)),
          spin: Number(step.wheelSpinRad.toFixed(2)),
          brake: step.isBraking,
        });
      }
    }

    // Telemetri speedometer HUD (10Hz)
    telemetryTimerRef.current += dt;
    if (onDrivingTelemetry && telemetryTimerRef.current >= 0.1) {
      telemetryTimerRef.current = 0;
      const speedKmh = getDisplaySpeedKmh(p.speedMps);
      const limitKmh =
        terrain.speedLimitMps !== null ? Math.round(terrain.speedLimitMps * 3.2) : null;
      const isSpeeding =
        terrain.speedLimitMps !== null &&
        Math.abs(p.speedMps) > terrain.speedLimitMps + trafficCfg.speedingToleranceMps;
      const tdRemaining =
        vehicle.mode === 'test_drive' && vehicle.testDriveAnchor
          ? Math.max(0, Math.ceil((vehicle.testDriveAnchor.expiresAtMs - (nowWallMs + serverOffsetMs)) / 1000))
          : null;

      onDrivingTelemetry({
        vehicleId: vehicle.vehicleId,
        modelId: vehicle.modelId,
        name: vehicle.name,
        plateNumber: vehicle.plateNumber,
        category: vehicle.category,
        isElectric: vehicle.isElectric,
        speedKmh,
        maxSpeedKmh: getModelMaxSpeedKmh(vehicle.modelId),
        rpmRatio: step.rpmRatio,
        gearLabel: step.gearLabel,
        fuel: p.fuelRemaining,
        fuelCapacity: vehicle.fuelCapacity,
        condition: p.condition,
        odometerKm: vehicle.odometerKm + p.distanceKmAccum,
        headlightsOn,
        brakeOn: step.isBraking,
        turnSignal,
        isOutOfFuel: step.isOutOfFuel,
        isPushing: step.isPushing,
        isStalled: step.isStalled,
        terrain: terrain.surface,
        speedLimitKmh: limitKmh,
        isSpeeding,
        isTestDrive: vehicle.mode === 'test_drive',
        testDriveRemainingSec: tdRemaining,
      });
    }

    // Sinkronisasi posisi kendaraan & karakter mengemudi ke RTDB secara adaptif (hemat kuota)
    const normHeading = normalizeAngleRad(p.headingRad);
    const vehicleSample = {
      vehicleId: vehicle.vehicleId,
      x: pos.x,
      y: Math.max(0, pos.y),
      z: pos.z,
      rotY: normHeading,
      vx: outVx,
      vz: outVz,
      speed: Math.abs(p.speedMps),
      steerAngle: p.steerAngle,
      headlights: headlightsOn,
      turnSignal,
      hornAtMs: lastHornAtMsRef.current,
    };

    if (
      onSyncVehicleTransform &&
      shouldSendVehicleSyncUpdate(lastVehicleSyncRef.current, vehicleSample, nowWallMs)
    ) {
      lastVehicleSyncRef.current = {
        ...vehicleSample,
        sentAtMs: nowWallMs,
      };
      onSyncVehicleTransform({
        ...vehicleSample,
        maxSpeed: model.maxSpeedMps,
      });
    }

    syncTimerRef.current += dt;
    const isMovingForPlayer = Math.abs(p.speedMps) > 0.2;
    const playerSyncInterval = isMovingForPlayer ? 0.25 : 4.5;
    if (syncTimerRef.current >= playerSyncInterval) {
      syncTimerRef.current = 0;
      onSyncTransform(pos.x, Math.max(0, pos.y), pos.z, normHeading, 'driving');
    }

    lastLocalSaveTimerRef.current += dt;
    if (lastLocalSaveTimerRef.current >= 1.5 && vehicle.mode === 'owned') {
      lastLocalSaveTimerRef.current = 0;
      saveLocalLastDrivePos(character.uid, {
        vehicleId: vehicle.vehicleId,
        x: Number(pos.x.toFixed(2)),
        y: Number(Math.max(0, pos.y).toFixed(2)),
        z: Number(pos.z.toFixed(2)),
        rotY: Number(normHeading.toFixed(3)),
        distanceKm: Number(p.distanceKmAccum.toFixed(3)),
        updatedAtMs: nowWallMs,
      });
    }
  }, -1);

  return (
    <RigidBody
      ref={rbRef}
      position={[vehicle.spawnPos.x, Math.max(0.05, vehicle.spawnPos.y), vehicle.spawnPos.z]}
      colliders={false}
      enabledRotations={[false, false, false]}
      mass={vehicle.category === 'motor' ? 2.5 : 8}
      linearDamping={0.35}
    >
      <CuboidCollider
        args={[colliderHalfW, colliderHalfH, colliderHalfL]}
        position={[0, colliderHalfH + 0.04, 0]}
      />
      <group ref={visualGroupRef} rotation={[0, vehicle.spawnPos.rotY || 0, 0]}>
        <VehicleModelMesh
          modelId={vehicle.modelId}
          color={vehicle.color}
          quality={quality}
          isNight={isNight}
          headlightsOn={headlightsOn}
          brakeOn={wheelPose.brake}
          turnSignal={turnSignal}
          turnBlinkOn={turnBlinkOn}
          steerAngle={wheelPose.steer}
          wheelSpinRad={wheelPose.spin}
          accessories={vehicle.accessories ?? []}
          lod="full"
          castShadow={quality !== 'low'}
        />

        {/* Sorotan Lampu Depan (beam cone ringan di jalan + SpotLight non-shadow saat malam) */}
        {headlightsOn && (
          <>
            <mesh
              position={[0, 0.2, colliderHalfL + 4.2]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[1, 1, 0.18]}
            >
              <coneGeometry args={[vehicle.category === 'motor' ? 1.85 : 2.65, 8.6, 6, 1, true]} />
              <meshBasicMaterial
                color="#FFF3C4"
                transparent
                opacity={isNight ? 0.2 : 0.07}
                depthWrite={false}
              />
            </mesh>
            {quality !== 'low' && isNight && (
              <>
                <primitive object={spotTarget} />
                <spotLight
                  position={[0, 0.88, colliderHalfL + 0.2]}
                  target={spotTarget}
                  angle={0.54}
                  penumbra={0.65}
                  intensity={14}
                  distance={22}
                  decay={1.6}
                  color="#FFF3C4"
                />
              </>
            )}
          </>
        )}

        {/* Avatar pemain duduk di kursi pengemudi + helm otomatis untuk motor */}
        <group position={anchors.driverOffset}>
          <AvatarMesh
            uid={character.uid}
            gender={character.gender}
            skinColor={character.skinColor}
            hairColor={character.hairColor}
            shirtColor={character.shirtColor}
            pantsColor={character.pantsColor}
            anim="driving"
            scale={anchors.seatScale}
            ridingHelmet={vehicle.category === 'motor'}
            castShadow={quality !== 'low'}
          />
        </group>

        {/* Penumpang multiplayer yang ikut membonceng di kendaraan ini */}
        {rtdbPassengers.map((pass) => {
          if (pass.uid === character.uid) return null;
          const app = playerAppearances[pass.uid];
          const offset = getPassengerSeatOffset(vehicle.modelId, pass.seatIndex || 1);
          return (
            <group key={pass.uid} position={offset}>
              <AvatarMesh
                uid={pass.uid}
                gender={app?.gender ?? 'laki-laki'}
                skinColor={app?.skinColor ?? '#E8B898'}
                hairColor={app?.hairColor ?? '#261C15'}
                shirtColor={app?.shirtColor ?? '#3B82F6'}
                pantsColor={app?.pantsColor ?? '#1E293B'}
                anim="passenger"
                scale={anchors.seatScale}
                ridingHelmet={vehicle.category === 'motor'}
                castShadow={quality !== 'low'}
              />
              <FloatingTag
                name={pass.name || app?.name || 'Penumpang'}
                chatBubble={localBubbles[pass.uid] ?? null}
                yOffset={1.95}
              />
            </group>
          );
        })}

        {/* Efek debu / asap tipis di roda belakang */}
        {quality !== 'low' &&
          [0, 1, 2, 3].map((idx) => (
            <mesh
              key={idx}
              ref={(el) => {
                dustRefs.current[idx] = el;
              }}
              visible={false}
            >
              <dodecahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial color="#D6CEC0" roughness={0.95} transparent opacity={0.45} />
            </mesh>
          ))}
      </group>

      <FloatingTag
        name={`${character.name} · ${vehicle.plateNumber}`}
        chatBubble={localChatBubble}
        yOffset={vehicle.category === 'motor' ? 2.05 : 2.35}
        isSelf
      />
    </RigidBody>
  );
};
