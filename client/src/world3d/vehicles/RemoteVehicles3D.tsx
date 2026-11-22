import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarMesh } from '../../components/AvatarMesh';
import { FloatingTag } from '../../components/FloatingTag';
import type {
  CharacterDoc,
  GraphicsQuality,
  PlayerAnimState,
  RTDBVehicle,
} from '../../types/game';
import type { RemotePlayerAppearance } from '../useMultiplayerSync';
import { VehicleModelMesh } from './VehicleModelMesh';
import { vehicleAudio } from './vehicleAudio';
import { getVehicleSeatAnchors } from './vehicleMaterials';
import {
  getAvailablePassengerSeats,
  getPassengerSeatOffset,
  stepInterpolatedVehiclePose,
  type CulledRemoteVehicle,
  type InterpolatedPose,
} from './vehicleMultiplayer';

export interface NearbyPassengerVehicleTarget {
  vehicleId: string;
  modelId: string;
  plateNumber: string;
  driverName: string;
  freeSeats: number;
  label: string;
}

interface RemoteVehicleItemProps {
  entry: CulledRemoteVehicle;
  localCharacter: CharacterDoc;
  isNight: boolean;
  quality: GraphicsQuality;
  serverOffsetMs: number;
  playerAppearances: Record<string, RemotePlayerAppearance>;
  localBubbles: Record<string, string>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  vehicleHeadingRef?: React.MutableRefObject<number>;
  vehicleSpeedRef?: React.MutableRefObject<number>;
  onSyncTransform: (x: number, y: number, z: number, rotY: number, anim: PlayerAnimState) => void;
  onReportWorldPos: (vehicleId: string, x: number, z: number) => void;
}

const RemoteVehicleItem: React.FC<RemoteVehicleItemProps> = ({
  entry,
  localCharacter,
  isNight,
  quality,
  serverOffsetMs,
  playerAppearances,
  localBubbles,
  playerPosRef,
  vehicleHeadingRef,
  vehicleSpeedRef,
  onSyncTransform,
  onReportWorldPos,
}) => {
  const { vehicle, lod, isLocalPassenger } = entry;
  const groupRef = useRef<THREE.Group>(null);
  const poseRef = useRef<InterpolatedPose>({
    x: vehicle.x,
    y: vehicle.y,
    z: vehicle.z,
    rotY: vehicle.rotY,
  });
  const wheelSpinRef = useRef(0);
  const [wheelSpin, setWheelSpin] = useState(0);
  const [turnBlinkOn, setTurnBlinkOn] = useState(false);
  const [hornToastActive, setHornToastActive] = useState(false);

  const blinkTimerRef = useRef(0);
  const wheelSyncTimerRef = useRef(0);
  const passengerSyncTimerRef = useRef(0);
  const lastHornPlayedAtRef = useRef<number>(vehicle.hornAtMs || 0);
  const hornBannerTimeoutRef = useRef<number | null>(null);

  const anchors = getVehicleSeatAnchors(vehicle.modelId);
  const driverAppearance = vehicle.driverId ? playerAppearances[vehicle.driverId] : undefined;
  const driverLabel = vehicle.driverName || driverAppearance?.name || 'Pengemudi';
  const passengers = vehicle.passengers ? Object.values(vehicle.passengers) : [];
  const turnSignal = vehicle.turnSignal || 'off';

  // Efek klakson audio & indikator visual saat kendaraan remote membunyikan klakson
  useEffect(() => {
    const hTs = Number(vehicle.hornAtMs || 0);
    if (hTs > 0 && hTs > lastHornPlayedAtRef.current) {
      lastHornPlayedAtRef.current = hTs;
      const dist = Math.hypot(
        poseRef.current.x - playerPosRef.current.x,
        poseRef.current.z - playerPosRef.current.z
      );
      if (dist <= 30 || isLocalPassenger) {
        vehicleAudio.playHorn(vehicle.category);
      }
      setHornToastActive(true);
      if (hornBannerTimeoutRef.current) {
        window.clearTimeout(hornBannerTimeoutRef.current);
      }
      hornBannerTimeoutRef.current = window.setTimeout(() => {
        setHornToastActive(false);
      }, 1500);
    }
    return () => {
      if (hornBannerTimeoutRef.current) {
        window.clearTimeout(hornBannerTimeoutRef.current);
      }
    };
  }, [vehicle.hornAtMs, vehicle.category, isLocalPassenger, playerPosRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const nowServerMs = Date.now() + serverOffsetMs;

    const nextPose = stepInterpolatedVehiclePose(
      poseRef.current,
      {
        x: vehicle.x,
        y: vehicle.y,
        z: vehicle.z,
        rotY: vehicle.rotY,
        vx: vehicle.vx,
        vz: vehicle.vz,
        updatedAt: vehicle.updatedAt,
      },
      { nowServerMs, dt }
    );
    poseRef.current = nextPose;

    onReportWorldPos(vehicle.vehicleId, nextPose.x, nextPose.z);

    if (groupRef.current) {
      groupRef.current.position.set(nextPose.x, Math.max(0, nextPose.y), nextPose.z);
      groupRef.current.rotation.set(0, nextPose.rotY, 0);
    }

    // Jika pemain lokal menumpang di kendaraan ini, kamera & playerPosRef mengikuti mulus
    if (isLocalPassenger) {
      playerPosRef.current.set(nextPose.x, Math.max(0, nextPose.y), nextPose.z);
      if (vehicleHeadingRef) vehicleHeadingRef.current = nextPose.rotY;
      if (vehicleSpeedRef) vehicleSpeedRef.current = vehicle.speed;

      passengerSyncTimerRef.current += dt;
      if (passengerSyncTimerRef.current >= 0.35) {
        passengerSyncTimerRef.current = 0;
        onSyncTransform(nextPose.x, Math.max(0, nextPose.y), nextPose.z, nextPose.rotY, 'passenger');
      }
    }

    // Animasi putar roda sesuai kecepatan (hanya jika LOD full)
    if (lod === 'full') {
      const signedSpeed =
        Math.sin(nextPose.rotY) * (vehicle.vx || 0) + Math.cos(nextPose.rotY) * (vehicle.vz || 0);
      if (Math.abs(signedSpeed) > 0.12) {
        wheelSpinRef.current = (wheelSpinRef.current + (signedSpeed * dt) / Math.max(0.18, anchors.wheelRadius)) % (Math.PI * 200);
        wheelSyncTimerRef.current += dt;
        if (wheelSyncTimerRef.current >= 0.06) {
          wheelSyncTimerRef.current = 0;
          setWheelSpin(Number(wheelSpinRef.current.toFixed(2)));
        }
      }

      if (turnSignal !== 'off') {
        blinkTimerRef.current += dt;
        if (blinkTimerRef.current >= 0.42) {
          blinkTimerRef.current = 0;
          setTurnBlinkOn((prev) => !prev);
        }
      } else if (turnBlinkOn) {
        setTurnBlinkOn(false);
      }
    }
  });

  const driverBubble =
    hornToastActive
      ? 'TIN! TIN!'
      : vehicle.driverId
        ? localBubbles[vehicle.driverId] ?? null
        : null;

  return (
    <group
      ref={groupRef}
      position={[vehicle.x, Math.max(0, vehicle.y), vehicle.z]}
      rotation={[0, vehicle.rotY, 0]}
    >
      <VehicleModelMesh
        modelId={vehicle.modelId}
        color={vehicle.color}
        quality={quality}
        isNight={isNight}
        headlightsOn={Boolean(vehicle.headlights)}
        brakeOn={Math.abs(vehicle.speed) < 0.25 && Boolean(vehicle.headlights)}
        turnSignal={turnSignal}
        turnBlinkOn={turnBlinkOn}
        steerAngle={vehicle.steerAngle || 0}
        wheelSpinRad={wheelSpin}
        lod={lod}
        castShadow={quality !== 'low' && lod === 'full'}
      />

      {/* Sorotan kerucut lampu depan kendaraan pemain lain */}
      {vehicle.headlights && lod === 'full' && (
        <mesh
          position={[0, 0.2, (vehicle.category === 'motor' ? 1.1 : 2.0) + 3.6]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1, 1, 0.18]}
        >
          <coneGeometry args={[vehicle.category === 'motor' ? 1.6 : 2.35, 7.4, 6, 1, true]} />
          <meshBasicMaterial
            color="#FFF3C4"
            transparent
            opacity={isNight ? 0.16 : 0.05}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Avatar pengemudi remote */}
      {vehicle.driverId && (
        <group position={anchors.driverOffset}>
          <AvatarMesh
            uid={vehicle.driverId}
            gender={driverAppearance?.gender ?? 'laki-laki'}
            skinColor={driverAppearance?.skinColor ?? '#E8B898'}
            hairColor={driverAppearance?.hairColor ?? '#261C15'}
            shirtColor={driverAppearance?.shirtColor ?? '#E2E8F0'}
            pantsColor={driverAppearance?.pantsColor ?? '#1E293B'}
            anim="driving"
            scale={anchors.seatScale}
            ridingHelmet={vehicle.category === 'motor'}
            castShadow={quality !== 'low' && lod === 'full'}
          />
        </group>
      )}

      {/* Penumpang (pemain lokal maupun remote) */}
      {passengers.map((p) => {
        const isMe = p.uid === localCharacter.uid;
        const app = isMe ? localCharacter : playerAppearances[p.uid];
        const offset = getPassengerSeatOffset(vehicle.modelId, p.seatIndex || 1);
        return (
          <group key={p.uid} position={offset}>
            <AvatarMesh
              uid={p.uid}
              gender={app?.gender ?? 'laki-laki'}
              skinColor={app?.skinColor ?? '#E8B898'}
              hairColor={app?.hairColor ?? '#261C15'}
              shirtColor={app?.shirtColor ?? '#3B82F6'}
              pantsColor={app?.pantsColor ?? '#1E293B'}
              anim="passenger"
              scale={anchors.seatScale}
              ridingHelmet={vehicle.category === 'motor'}
              castShadow={quality !== 'low' && lod === 'full'}
            />
            {isMe && (
              <FloatingTag
                name={localCharacter.name}
                chatBubble={localBubbles[localCharacter.uid] ?? null}
                yOffset={1.95}
                isSelf
              />
            )}
          </group>
        );
      })}

      <FloatingTag
        name={`${driverLabel} · ${vehicle.plateNumber}`}
        chatBubble={driverBubble}
        yOffset={vehicle.category === 'motor' ? 2.05 : 2.35}
      />
    </group>
  );
};

interface RemoteVehicles3DProps {
  remoteVehicles: CulledRemoteVehicle[];
  localCharacter: CharacterDoc;
  isNight: boolean;
  quality: GraphicsQuality;
  serverOffsetMs: number;
  playerAppearances: Record<string, RemotePlayerAppearance>;
  localBubbles: Record<string, string>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  vehicleHeadingRef?: React.MutableRefObject<number>;
  vehicleSpeedRef?: React.MutableRefObject<number>;
  isOnFoot: boolean;
  isPassengerNow: boolean;
  onSyncTransform: (x: number, y: number, z: number, rotY: number, anim: PlayerAnimState) => void;
  onNearbyPassengerTargetChange?: (target: NearbyPassengerVehicleTarget | null) => void;
  onDismountPassenger?: () => void;
}

const PASSENGER_BOARD_RADIUS_METERS = 4.4;

/**
 * Menampilkan seluruh kendaraan pemain lain dari RTDB yang lolos radius culling:
 * - Interpolasi + dead-reckoning singkat
 * - LOD full vs simple berdasarkan jarak
 * - Pengemudi & penumpang multiplayer terpasang langsung pada kursi kendaraan
 * - Deteksi kendaraan aktif terdekat untuk menumpang (asPassenger)
 */
export const RemoteVehicles3D: React.FC<RemoteVehicles3DProps> = ({
  remoteVehicles,
  localCharacter,
  isNight,
  quality,
  serverOffsetMs,
  playerAppearances,
  localBubbles,
  playerPosRef,
  vehicleHeadingRef,
  vehicleSpeedRef,
  isOnFoot,
  isPassengerNow,
  onSyncTransform,
  onNearbyPassengerTargetChange,
  onDismountPassenger,
}) => {
  const livePosMapRef = useRef<Record<string, { x: number; z: number }>>({});
  const lastNearbyKeyRef = useRef<string>('none');

  const handleReportPos = (vehicleId: string, x: number, z: number) => {
    livePosMapRef.current[vehicleId] = { x, z };
  };

  // Pintasan KeyF saat sedang duduk sebagai penumpang untuk turun
  useEffect(() => {
    if (!isPassengerNow || !onDismountPassenger) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyF' && !e.repeat) {
        onDismountPassenger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPassengerNow, onDismountPassenger]);

  // Deteksi kendaraan RTDB aktif terdekat dengan kursi kosong untuk aksi "Naik Penumpang"
  useFrame(() => {
    if (!onNearbyPassengerTargetChange) return;
    if (!isOnFoot || isPassengerNow || remoteVehicles.length === 0) {
      if (lastNearbyKeyRef.current !== 'none') {
        lastNearbyKeyRef.current = 'none';
        onNearbyPassengerTargetChange(null);
      }
      return;
    }

    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    let best: RTDBVehicle | null = null;
    let bestFree = 0;
    let bestDist = PASSENGER_BOARD_RADIUS_METERS;

    for (const entry of remoteVehicles) {
      const v = entry.vehicle;
      if (v.isTestDrive || v.vehicleId.startsWith('td_')) continue;
      if (!v.driverId || v.driverId === localCharacter.uid) continue;
      const free = getAvailablePassengerSeats(v);
      if (free <= 0) continue;

      const live = livePosMapRef.current[v.vehicleId];
      const vx = live ? live.x : v.x;
      const vz = live ? live.z : v.z;
      const d = Math.hypot(px - vx, pz - vz);
      if (d <= bestDist) {
        bestDist = d;
        best = v;
        bestFree = free;
      }
    }

    const nextKey = best ? `${best.vehicleId}:${bestFree}` : 'none';
    if (nextKey !== lastNearbyKeyRef.current) {
      lastNearbyKeyRef.current = nextKey;
      if (best) {
        const driverName =
          best.driverName ||
          (best.driverId ? playerAppearances[best.driverId]?.name : undefined) ||
          'Warga';
        onNearbyPassengerTargetChange({
          vehicleId: best.vehicleId,
          modelId: best.modelId,
          plateNumber: best.plateNumber,
          driverName,
          freeSeats: bestFree,
          label: `Numpang ${best.plateNumber} (${driverName})`,
        });
      } else {
        onNearbyPassengerTargetChange(null);
      }
    }
  });

  return (
    <group>
      {remoteVehicles.map((entry) => (
        <RemoteVehicleItem
          key={entry.vehicle.vehicleId}
          entry={entry}
          localCharacter={localCharacter}
          isNight={isNight}
          quality={quality}
          serverOffsetMs={serverOffsetMs}
          playerAppearances={playerAppearances}
          localBubbles={localBubbles}
          playerPosRef={playerPosRef}
          vehicleHeadingRef={vehicleHeadingRef}
          vehicleSpeedRef={vehicleSpeedRef}
          onSyncTransform={onSyncTransform}
          onReportWorldPos={handleReportPos}
        />
      ))}
    </group>
  );
};
