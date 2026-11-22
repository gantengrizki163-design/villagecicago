import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getClientNpcClockState } from '../../firebase/npcDeterminism';
import {
  computeDeterministicTrafficVehicles,
  evaluateTrafficSlotPose,
  type DeterministicTrafficVehiclePose,
} from '../../firebase/trafficDeterminism';
import type { GraphicsQuality, TrainScheduleConfig, ZoneId } from '../../types/game';
import { VehicleModelMesh } from './VehicleModelMesh';

export interface NpcTrafficPositionEntry {
  slotKey: string;
  modelId: string;
  x: number;
  z: number;
  rotY: number;
  speedMps: number;
}

interface NpcTrafficActorProps {
  initialPose: DeterministicTrafficVehiclePose;
  serverOffsetMs: number;
  trainSchedule: TrainScheduleConfig;
  epochMs: number;
  quality: GraphicsQuality;
  isNight: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  npcTrafficPosMapRef?: React.MutableRefObject<Record<string, NpcTrafficPositionEntry>>;
}

const NpcTrafficActor: React.FC<NpcTrafficActorProps> = ({
  initialPose,
  serverOffsetMs,
  trainSchedule,
  epochMs,
  quality,
  isNight,
  playerPosRef,
  npcTrafficPosMapRef,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [brakeOn, setBrakeOn] = useState(initialPose.isStopped);
  const brakeRef = useRef(initialPose.isStopped);
  const lastCheckRef = useRef(0);

  useFrame(({ clock }) => {
    const serverNowMs = Date.now() + serverOffsetMs;
    const { daySeed } = getClientNpcClockState(serverNowMs);
    const pose = evaluateTrafficSlotPose({
      slotKey: initialPose.slotKey,
      serverNowMs,
      daySeed,
      playerPos: { x: playerPosRef.current.x, z: playerPosRef.current.z },
      trainSchedule,
      epochMs,
    });
    if (!pose) return;

    if (groupRef.current) {
      groupRef.current.position.set(pose.x, 0, pose.z);
      groupRef.current.rotation.set(0, pose.rotY, 0);
    }

    if (npcTrafficPosMapRef) {
      const existing = npcTrafficPosMapRef.current[pose.slotKey];
      if (existing) {
        existing.x = pose.x;
        existing.z = pose.z;
        existing.rotY = pose.rotY;
        existing.speedMps = pose.speedMps;
      } else {
        npcTrafficPosMapRef.current[pose.slotKey] = {
          slotKey: pose.slotKey,
          modelId: pose.modelId,
          x: pose.x,
          z: pose.z,
          rotY: pose.rotY,
          speedMps: pose.speedMps,
        };
      }
    }

    if (clock.elapsedTime - lastCheckRef.current > 0.25) {
      lastCheckRef.current = clock.elapsedTime;
      if (pose.isStopped !== brakeRef.current) {
        brakeRef.current = pose.isStopped;
        setBrakeOn(pose.isStopped);
      }
    }
  });

  const castShadow = quality === 'high' && initialPose.lod === 'full';

  return (
    <group
      ref={groupRef}
      position={[initialPose.x, 0, initialPose.z]}
      rotation={[0, initialPose.rotY, 0]}
    >
      <VehicleModelMesh
        modelId={initialPose.modelId}
        color={initialPose.color}
        quality={quality}
        isNight={isNight}
        headlightsOn={isNight}
        brakeOn={brakeOn}
        sirenActive={initialPose.sirenActive}
        steerAngle={initialPose.steerAngle}
        lod={initialPose.lod}
        castShadow={castShadow}
      />
    </group>
  );
};

interface NpcTraffic3DProps {
  zone: ZoneId;
  serverOffsetMs: number;
  trainSchedule: TrainScheduleConfig;
  epochMs: number;
  quality: GraphicsQuality;
  isNight: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  npcTrafficPosMapRef?: React.MutableRefObject<Record<string, NpcTrafficPositionEntry>>;
}

/**
 * Lalu Lintas Jalan Raya NPC Deterministik (Tanpa Write DB).
 * Semua klien melihat kendaraan motor, mobil, angkot, becak, bus, truk, polisi, dan ambulans
 * pada posisi serempak, mematuhi lajur kiri Indonesia, lampu lalu lintas, palang KA, dan halte.
 */
export const NpcTraffic3D: React.FC<NpcTraffic3DProps> = ({
  zone,
  serverOffsetMs,
  trainSchedule,
  epochMs,
  quality,
  isNight,
  playerPosRef,
  npcTrafficPosMapRef,
}) => {
  const [visiblePoses, setVisiblePoses] = useState<DeterministicTrafficVehiclePose[]>([]);
  const lastSigRef = useRef('');
  const lastScanRef = useRef(-10);

  const isMobileDevice = useMemo(() => {
    if (quality === 'low') return true;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true;
    return false;
  }, [quality]);

  useFrame(({ clock }) => {
    if (zone !== 'cicalengka') {
      if (lastSigRef.current !== '') {
        lastSigRef.current = '';
        setVisiblePoses([]);
      }
      if (npcTrafficPosMapRef && Object.keys(npcTrafficPosMapRef.current).length > 0) {
        npcTrafficPosMapRef.current = {};
      }
      return;
    }

    if (clock.elapsedTime - lastScanRef.current < 0.4) return;
    lastScanRef.current = clock.elapsedTime;

    const serverNowMs = Date.now() + serverOffsetMs;
    const { daySeed, gameHourFloat } = getClientNpcClockState(serverNowMs);

    const active = computeDeterministicTrafficVehicles({
      serverNowMs,
      daySeed,
      gameHour: gameHourFloat,
      zone,
      playerPos: { x: playerPosRef.current.x, z: playerPosRef.current.z },
      isMobile: isMobileDevice,
      trainSchedule,
      epochMs,
    });

    if (npcTrafficPosMapRef) {
      const keepKeys = new Set(active.map((v) => v.slotKey));
      for (const k of Object.keys(npcTrafficPosMapRef.current)) {
        if (!keepKeys.has(k)) {
          delete npcTrafficPosMapRef.current[k];
        }
      }
    }

    const sig = active.map((v) => `${v.slotKey}:${v.modelId}:${v.color}:${v.lod}`).join('|');
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      setVisiblePoses(active);
    }
  });

  if (zone !== 'cicalengka') return null;

  return (
    <group>
      {visiblePoses.map((pose) => (
        <NpcTrafficActor
          key={pose.slotKey}
          initialPose={pose}
          serverOffsetMs={serverOffsetMs}
          trainSchedule={trainSchedule}
          epochMs={epochMs}
          quality={quality}
          isNight={isNight}
          playerPosRef={playerPosRef}
          npcTrafficPosMapRef={npcTrafficPosMapRef}
        />
      ))}
    </group>
  );
};
