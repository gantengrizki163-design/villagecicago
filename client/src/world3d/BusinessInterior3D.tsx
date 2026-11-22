import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { AvatarMesh } from '../components/AvatarMesh';
import { FloatingTag } from '../components/FloatingTag';
import type { PlayerInputState } from '../components/MobileControls';
import type {
  BusinessDoc,
  BusinessStockDoc,
  CharacterDoc,
  GraphicsQuality,
  PlayerAnimState,
} from '../types/game';
import type { NearbyInteractTarget } from './LocalPlayer';
import type { CameraOrbitState } from './ThirdPersonCamera';
import { AssetModelLoader } from './assets/AssetModelLoader';
import { InteriorWarung } from './assets/InteriorWarung';
import { distance2D } from './worldConstants';

interface BusinessInterior3DProps {
  business: BusinessDoc;
  stock: BusinessStockDoc[];
  character: CharacterDoc;
  quality: GraphicsQuality;
  movementLocked: boolean;
  isCriticalStats: boolean;
  localChatBubble: string | null;
  inputRef: React.MutableRefObject<PlayerInputState>;
  cameraOrbitRef: React.MutableRefObject<CameraOrbitState>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearbyTargetChange: (target: NearbyInteractTarget) => void;
}

const WALK_SPEED = 4.5;

const THEME_BY_TYPE: Record<string, { floor: string; wall: string; accent: string }> = {
  warung: { floor: '#fde68a', wall: '#fff7ed', accent: '#ea580c' },
  kelontong: { floor: '#e2e8f0', wall: '#eff6ff', accent: '#2563eb' },
  bengkel: { floor: '#94a3b8', wall: '#cbd5e1', accent: '#334155' },
  jasa: { floor: '#ede9fe', wall: '#f8fafc', accent: '#7c3aed' },
  lapak_pasar: { floor: '#dcfce7', wall: '#fefce8', accent: '#059669' },
};

export const BusinessInterior3D: React.FC<BusinessInterior3DProps> = ({
  business,
  stock,
  character,
  quality,
  movementLocked,
  isCriticalStats,
  localChatBubble,
  inputRef,
  cameraOrbitRef,
  playerPosRef,
  onNearbyTargetChange,
}) => {
  const shadows = quality !== 'low';
  const theme = THEME_BY_TYPE[business.type] || THEME_BY_TYPE.warung;
  const isOwner = business.ownerId === character.uid;

  const roomW = 9.5;
  const roomD = 8.0;
  const halfW = roomW / 2;
  const halfD = roomD / 2;
  const wallH = 3.2;

  const exitSpot = useMemo(() => ({ x: -halfW + 1.2, z: halfD - 0.9 }), [halfW, halfD]);
  const cashierSpot = useMemo(() => ({ x: halfW - 1.8, z: 0.4 }), [halfW]);
  const shelfSpot = useMemo(() => ({ x: 0, z: -halfD + 1.6 }), [halfD]);
  const craftSpot = useMemo(() => ({ x: -halfW + 1.8, z: -halfD + 1.6 }), [halfW, halfD]);

  useEffect(() => {
    cameraOrbitRef.current.pitch = 0.54;
    cameraOrbitRef.current.distance = 7.2;
  }, [cameraOrbitRef]);

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

  const hasInitPosRef = useRef(false);

  useFrame((_, delta) => {
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

    const speed = isCriticalStats ? WALK_SPEED * 0.6 : WALK_SPEED;
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

    let nextTarget: NearbyInteractTarget = null;
    let nextKey = 'none';

    if (distance2D(pos.x, pos.z, exitSpot.x, exitSpot.z) <= 2.1) {
      nextTarget = { type: 'interior_exit', label: 'Keluar Toko ke Cicalengka' };
      nextKey = 'biz_exit';
    } else if (distance2D(pos.x, pos.z, cashierSpot.x, cashierSpot.z) <= 2.4) {
      nextTarget = isOwner
        ? { type: 'biz_manage', businessId: business.id, label: `Kelola ${business.name}` }
        : { type: 'biz_cashier', businessId: business.id, label: `Bayar di Kasir (${business.name})` };
      nextKey = isOwner ? 'biz_manage_cashier' : 'biz_cashier';
    } else if (distance2D(pos.x, pos.z, craftSpot.x, craftSpot.z) <= 2.3 && isOwner) {
      nextTarget = { type: 'biz_craft', businessId: business.id, label: 'Meja Produksi / Masak' };
      nextKey = 'biz_craft';
    } else if (distance2D(pos.x, pos.z, shelfSpot.x, shelfSpot.z) <= 2.4) {
      nextTarget = isOwner
        ? { type: 'biz_manage', businessId: business.id, label: 'Atur Stok & Harga Rak' }
        : { type: 'biz_cashier', businessId: business.id, label: 'Lihat Etalase Produk' };
      nextKey = isOwner ? 'biz_manage_shelf' : 'biz_shelf';
    }

    if (nextKey !== lastNearbyKey.current) {
      lastNearbyKey.current = nextKey;
      onNearbyTargetChange(nextTarget);
    }
  }, -1);

  const visibleStock = stock.filter((s) => s.qty > 0).slice(0, 6);
  const shopFootprint = useMemo(
    () => ({ width: roomW, depth: roomD, height: wallH }),
    [roomW, roomD, wallH]
  );

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[halfW + 0.5, 0.5, halfD + 0.5]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[halfW + 0.3, wallH / 2, 0.25]} position={[0, wallH / 2, -halfD - 0.15]} />
        <CuboidCollider args={[halfW + 0.3, wallH / 2, 0.25]} position={[0, wallH / 2, halfD + 0.15]} />
        <CuboidCollider args={[0.25, wallH / 2, halfD + 0.3]} position={[-halfW - 0.15, wallH / 2, 0]} />
        <CuboidCollider args={[0.25, wallH / 2, halfD + 0.3]} position={[halfW + 0.15, wallH / 2, 0]} />

        <AssetModelLoader assetId="interior_warung" quality={quality} overrideFootprint={shopFootprint}>
          <InteriorWarung
            roomW={roomW}
            roomD={roomD}
            wallHeight={wallH}
            theme={theme}
            cashierSpot={cashierSpot}
            craftSpot={craftSpot}
            quality={quality}
          />
        </AssetModelLoader>

        {/* Collider Meja Kasir (Kanan - visual dirender oleh InteriorWarung) */}
        <group position={[cashierSpot.x + 0.4, 0, cashierSpot.z]}>
          <CuboidCollider args={[0.7, 0.55, 1.3]} position={[0, 0.55, 0]} />
        </group>

        {/* Rak Etalase Produk Dinamis (Tengah Belakang) */}
        <group position={[shelfSpot.x, 0, shelfSpot.z - 0.5]}>
          <CuboidCollider args={[1.8, 0.8, 0.4]} position={[0, 0.8, 0]} />
          <mesh position={[0, 0.85, 0]} castShadow={shadows}>
            <boxGeometry args={[3.4, 1.7, 0.65]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
          </mesh>
          {visibleStock.map((item, idx) => (
            <mesh key={item.itemId} position={[-1.2 + idx * 0.48, 1.85, 0]} castShadow={shadows}>
              <boxGeometry args={[0.32, 0.28 + Math.min(0.35, item.qty * 0.02), 0.32]} />
              <meshStandardMaterial color={idx % 2 === 0 ? '#f59e0b' : '#10b981'} roughness={0.5} />
            </mesh>
          ))}
        </group>

        {/* Collider Meja Produksi / Dapur (Kiri Belakang - visual dirender oleh InteriorWarung) */}
        <group position={[craftSpot.x - 0.2, 0, craftSpot.z - 0.4]}>
          <CuboidCollider args={[0.9, 0.5, 0.6]} position={[0, 0.5, 0]} />
        </group>
      </RigidBody>

      <pointLight position={[0, wallH - 0.4, 0]} color="#fff7ed" intensity={3.2} distance={18} decay={1.2} />

      <Text position={[cashierSpot.x, 1.85, cashierSpot.z]} fontSize={0.25} color="#fde68a" anchorX="center" outlineWidth={0.03} outlineColor="#0f172a">
        KASIR
      </Text>
      <Text position={[shelfSpot.x, 2.35, shelfSpot.z - 0.4]} fontSize={0.25} color="#a7f3d0" anchorX="center" outlineWidth={0.03} outlineColor="#0f172a">
        ETALASE STOK
      </Text>
      <Text position={[craftSpot.x, 1.55, craftSpot.z - 0.3]} fontSize={0.22} color="#93c5fd" anchorX="center" outlineWidth={0.03} outlineColor="#0f172a">
        MEJA PRODUKSI
      </Text>
      <Text position={[exitSpot.x, 0.75, exitSpot.z]} fontSize={0.24} color="#fca5a5" anchorX="center" outlineWidth={0.03} outlineColor="#0f172a">
        PINTU KELUAR
      </Text>

      <RigidBody
        ref={rbRef}
        position={[exitSpot.x + 1.1, 0.6, exitSpot.z - 0.9]}
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
    </group>
  );
};
