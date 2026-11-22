import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { AvatarMesh } from '../components/AvatarMesh';
import { FloatingTag } from '../components/FloatingTag';
import type { PlayerInputState } from '../components/MobileControls';
import type {
  CharacterDoc,
  FurniturePlacement,
  GraphicsQuality,
  PlayerAnimState,
  PropertyDoc,
} from '../types/game';
import { DecorationGrid3D } from './DecorationGrid3D';
import {
  FurnitureModel3D,
  getRotatedSize,
  gridToInteriorWorld,
  INTERIOR_TILE_SIZE,
} from './FurnitureModels3D';
import type { NearbyInteractTarget } from './LocalPlayer';
import type { CameraOrbitState } from './ThirdPersonCamera';
import { AssetModelLoader } from './assets/AssetModelLoader';
import { InteriorKontrakan } from './assets/InteriorKontrakan';
import { InteriorKos } from './assets/InteriorKos';
import { distance2D } from './worldConstants';

interface InteriorScene3DProps {
  property: PropertyDoc;
  character: CharacterDoc;
  mode: 'resident' | 'preview';
  decorationMode: boolean;
  draftFurniture: FurniturePlacement[];
  selectedInstanceId: string | null;
  pendingFurnitureId: string | null;
  pendingRotation: 0 | 90 | 180 | 270;
  hoverCell: { gx: number; gz: number } | null;
  quality: GraphicsQuality;
  isNight: boolean;
  movementLocked: boolean;
  isCriticalStats: boolean;
  localChatBubble: string | null;
  inputRef: React.MutableRefObject<PlayerInputState>;
  cameraOrbitRef: React.MutableRefObject<CameraOrbitState>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onHoverCell: (cell: { gx: number; gz: number } | null) => void;
  onSelectPlaced: (instanceId: string) => void;
  onTapGridCell: (gx: number, gz: number) => void;
  onNearbyTargetChange: (target: NearbyInteractTarget) => void;
}

const INTERIOR_WALK_SPEED = 4.4;

export const InteriorScene3D: React.FC<InteriorScene3DProps> = ({
  property,
  character,
  mode,
  decorationMode,
  draftFurniture,
  selectedInstanceId,
  pendingFurnitureId,
  pendingRotation,
  hoverCell,
  quality,
  isNight,
  movementLocked,
  isCriticalStats,
  localChatBubble,
  inputRef,
  cameraOrbitRef,
  playerPosRef,
  onHoverCell,
  onSelectPlaced,
  onTapGridCell,
  onNearbyTargetChange,
}) => {
  const shadows = quality !== 'low';
  const cols = property.layout?.gridCols ?? 6;
  const rows = property.layout?.gridRows ?? 6;
  const gridW = cols * INTERIOR_TILE_SIZE;
  const gridD = rows * INTERIOR_TILE_SIZE;
  const roomW = gridW + 2.0;
  const roomD = gridD + 2.0;
  const halfRoomW = roomW / 2;
  const halfRoomD = roomD / 2;
  const wallHeight = 3.1;

  const exitPos = useMemo(
    () => ({ x: -halfRoomW + 1.1, z: halfRoomD - 0.75 }),
    [halfRoomW, halfRoomD]
  );
  const bathPos = useMemo(
    () => ({ x: halfRoomW - 0.85, z: -halfRoomD + 0.9 }),
    [halfRoomW, halfRoomD]
  );

  // Set kamera ke pusat ruangan saat mode dekorasi aktif
  useEffect(() => {
    if (decorationMode) {
      playerPosRef.current.set(0, 0.35, 0);
      cameraOrbitRef.current.pitch = 0.88;
      cameraOrbitRef.current.distance = Math.max(7.2, Math.min(12.5, Math.max(roomW, roomD) * 1.1));
    } else {
      cameraOrbitRef.current.pitch = 0.52;
      cameraOrbitRef.current.distance = 6.8;
    }
  }, [decorationMode, playerPosRef, cameraOrbitRef, roomW, roomD]);

  const activeFurnitureList = decorationMode ? draftFurniture : property.furniture || [];

  const rbRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const [anim, setAnim] = useState<PlayerAnimState>('idle');
  const animStateRef = useRef<PlayerAnimState>('idle');
  const rotYRef = useRef(0);
  const lastNearbyKey = useRef('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keysRef.current[e.code] = true;
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
  }, []);

  // Precompute interactive bed & kitchen spots from placed furniture
  const interactiveSpots = useMemo(() => {
    const beds: Array<{ x: number; z: number }> = [];
    const kitchens: Array<{ x: number; z: number }> = [];
    for (const f of activeFurnitureList) {
      const { w, d } = getRotatedSize(f.furnitureId, f.rot);
      const [wx, , wz] = gridToInteriorWorld(f.gx, f.gz, w, d, cols, rows);
      if (
        f.furnitureId === 'kasur_lipat' ||
        f.furnitureId === 'tempat_tidur_single' ||
        f.furnitureId === 'tempat_tidur_queen'
      ) {
        beds.push({ x: wx, z: wz });
      } else if (
        f.furnitureId === 'kulkas_mini' ||
        f.furnitureId === 'kompor_gas' ||
        f.furnitureId === 'meja_kayu'
      ) {
        kitchens.push({ x: wx, z: wz });
      }
    }
    return { beds, kitchens };
  }, [activeFurnitureList, cols, rows]);

  const hasInitPosRef = useRef(false);

  useFrame((_, delta) => {
    if (decorationMode) {
      if (lastNearbyKey.current !== 'none_deco') {
        lastNearbyKey.current = 'none_deco';
        onNearbyTargetChange(null);
      }
      return;
    }

    const rb = rbRef.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);

    const k = keysRef.current;
    let ix = movementLocked ? 0 : inputRef.current.moveX;
    let iz = movementLocked ? 0 : inputRef.current.moveY;
    if (!movementLocked) {
      if (k['KeyA'] || k['ArrowLeft']) ix -= 1;
      if (k['KeyD'] || k['ArrowRight']) ix += 1;
      if (k['KeyW'] || k['ArrowUp']) iz -= 1;
      if (k['KeyS'] || k['ArrowDown']) iz += 1;
    }

    const len = Math.hypot(ix, iz);
    const isMoving = len > 0.1;
    if (isMoving) {
      ix /= Math.max(1, len);
      iz /= Math.max(1, len);
    } else {
      ix = 0;
      iz = 0;
    }

    const speed = isCriticalStats ? INTERIOR_WALK_SPEED * 0.6 : INTERIOR_WALK_SPEED;
    const yaw = cameraOrbitRef.current.yaw;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const worldVx = (ix * cosY + iz * sinY) * speed;
    const worldVz = (-ix * sinY + iz * cosY) * speed;

    const curVel = rb.linvel();
    const cleanVy = Math.abs(curVel.y) < 0.08 ? 0 : curVel.y;
    rb.setLinvel({ x: worldVx, y: cleanVy, z: worldVz }, true);

    const pos = rb.translation();
    if (!hasInitPosRef.current || Math.hypot(pos.x - playerPosRef.current.x, pos.z - playerPosRef.current.z) > 4) {
      playerPosRef.current.set(pos.x, pos.y, pos.z);
      hasInitPosRef.current = true;
    } else {
      const followDamp = 1 - Math.exp(-28 * dt);
      playerPosRef.current.x = THREE.MathUtils.lerp(playerPosRef.current.x, pos.x, followDamp);
      playerPosRef.current.y = THREE.MathUtils.lerp(playerPosRef.current.y, pos.y, followDamp);
      playerPosRef.current.z = THREE.MathUtils.lerp(playerPosRef.current.z, pos.z, followDamp);
    }

    if (isMoving) {
      const targetRot = Math.atan2(worldVx, worldVz);
      let diff = targetRot - rotYRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rotYRef.current += diff * (1 - Math.exp(-12 * dt));
    }
    if (visualRef.current) {
      visualRef.current.rotation.y = rotYRef.current;
    }

    const nextAnim: PlayerAnimState = isMoving ? 'walk' : 'idle';
    if (nextAnim !== animStateRef.current) {
      animStateRef.current = nextAnim;
      setAnim(nextAnim);
    }

    // Deteksi interaksi di dalam ruangan
    let nextTarget: NearbyInteractTarget = null;
    let nextKey = 'none';

    if (distance2D(pos.x, pos.z, exitPos.x, exitPos.z) <= 2.1) {
      nextTarget = {
        type: 'interior_exit',
        label: mode === 'preview' ? 'Selesai Survei (Keluar)' : 'Keluar ke Cicalengka',
      };
      nextKey = 'interior_exit';
    } else if (mode === 'resident') {
      if (distance2D(pos.x, pos.z, bathPos.x, bathPos.z) <= 2.2) {
        nextTarget = { type: 'interior_bath', label: 'Mandi di Kamar Mandi' };
        nextKey = 'interior_bath';
      } else if (interactiveSpots.beds.some((b) => distance2D(pos.x, pos.z, b.x, b.z) <= 2.2)) {
        nextTarget = { type: 'interior_sleep', label: 'Tidur di Rumah' };
        nextKey = 'interior_sleep';
      } else if (interactiveSpots.kitchens.some((kt) => distance2D(pos.x, pos.z, kt.x, kt.z) <= 2.1)) {
        nextTarget = { type: 'interior_eat', label: 'Makan dari Inventori' };
        nextKey = 'interior_eat';
      }
    }

    if (nextKey !== lastNearbyKey.current) {
      lastNearbyKey.current = nextKey;
      onNearbyTargetChange(nextTarget);
    }
  }, -1);

  const isKos = property.type === 'kos';
  const wallColor = property.layout?.wallColor;
  const floorColor = property.layout?.floorColor;
  const interiorFootprint = useMemo(
    () => ({ width: roomW, depth: roomD, height: wallHeight }),
    [roomW, roomD, wallHeight]
  );

  return (
    <group>
      {/* Lantai & Dinding Pembatas Fisik Ruangan */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[halfRoomW + 0.5, 0.5, halfRoomD + 0.5]} position={[0, -0.5, 0]} />
        {/* Collider 4 sisi dinding agar pemain tetap di dalam ruangan */}
        <CuboidCollider args={[halfRoomW + 0.3, wallHeight / 2, 0.25]} position={[0, wallHeight / 2, -halfRoomD - 0.15]} />
        <CuboidCollider args={[halfRoomW + 0.3, wallHeight / 2, 0.25]} position={[0, wallHeight / 2, halfRoomD + 0.15]} />
        <CuboidCollider args={[0.25, wallHeight / 2, halfRoomD + 0.3]} position={[-halfRoomW - 0.15, wallHeight / 2, 0]} />
        <CuboidCollider args={[0.25, wallHeight / 2, halfRoomD + 0.3]} position={[halfRoomW + 0.15, wallHeight / 2, 0]} />

        <AssetModelLoader
          assetId={isKos ? 'interior_kos' : 'interior_kontrakan'}
          quality={quality}
          overrideFootprint={interiorFootprint}
        >
          {isKos ? (
            <InteriorKos
              roomW={roomW}
              roomD={roomD}
              wallHeight={wallHeight}
              wallColor={wallColor}
              floorColor={floorColor}
              bathPos={bathPos}
              hasAc={Boolean(property.facilities?.ac)}
              isNight={isNight}
              quality={quality}
            />
          ) : (
            <InteriorKontrakan
              roomW={roomW}
              roomD={roomD}
              wallHeight={wallHeight}
              wallColor={wallColor}
              floorColor={floorColor}
              bathPos={bathPos}
              exitPos={exitPos}
              hasAc={Boolean(property.facilities?.ac)}
              isNight={isNight}
              quality={quality}
            />
          )}
        </AssetModelLoader>
      </RigidBody>

      {/* Cahaya Ruangan Hangat */}
      <pointLight position={[0, wallHeight - 0.35, 0]} color="#fff7ed" intensity={3.2} distance={18} decay={1.2} />

      {/* Zona Pintu Keluar (Depan-Kiri) */}
      <group position={[exitPos.x, 0, exitPos.z]}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.4, 0.9]} />
          <meshStandardMaterial color="#b45309" roughness={0.9} />
        </mesh>
        <Text
          position={[0, 0.72, 0.4]}
          fontSize={0.24}
          color="#fde68a"
          anchorX="center"
          outlineWidth={0.03}
          outlineColor="#0f172a"
        >
          {mode === 'preview' ? 'KELUAR SURVEI' : 'PINTU KELUAR'}
        </Text>
      </group>

      {/* Label Kamar Mandi Dalam (Belakang-Kanan) */}
      <group position={[bathPos.x, 0, bathPos.z]}>
        <Text
          position={[0, 1.3, 0]}
          fontSize={0.22}
          color="#67e8f9"
          anchorX="center"
          outlineWidth={0.03}
          outlineColor="#0f172a"
        >
          KAMAR MANDI
        </Text>
      </group>

      {/* Furnitur atau Mode Dekorasi Grid */}
      {decorationMode ? (
        <DecorationGrid3D
          cols={cols}
          rows={rows}
          draftFurniture={draftFurniture}
          selectedInstanceId={selectedInstanceId}
          pendingFurnitureId={pendingFurnitureId}
          pendingRotation={pendingRotation}
          hoverCell={hoverCell}
          onHoverCell={onHoverCell}
          onSelectPlaced={onSelectPlaced}
          onTapGridCell={onTapGridCell}
        />
      ) : (
        <>
          {/* Border Grid tipis agar tata letak tetap terasa rapi */}
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[gridW, gridD]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.85} transparent opacity={0.3} />
          </mesh>
          {activeFurnitureList.map((item) => (
            <FurnitureModel3D key={item.instanceId} placement={item} cols={cols} rows={rows} />
          ))}

          {/* Pemain Lokal Berjalan di Dalam Rumah */}
          <RigidBody
            ref={rbRef}
            position={[exitPos.x + 0.9, 0.6, exitPos.z - 0.9]}
            colliders={false}
            enabledRotations={[false, false, false]}
            mass={1}
            linearDamping={0.6}
          >
            <CapsuleCollider args={[0.45, 0.35]} position={[0, 0.85, 0]} />
            <group ref={visualRef}>
              <AvatarMesh
                uid={character.uid}
                gender={character.gender}
                skinColor={character.skinColor}
                hairColor={character.hairColor}
                shirtColor={character.shirtColor}
                pantsColor={character.pantsColor}
                anim={anim}
                castShadow={shadows}
              />
            </group>
            <FloatingTag name={character.name} chatBubble={localChatBubble} isSelf />
          </RigidBody>
        </>
      )}
    </group>
  );
};
