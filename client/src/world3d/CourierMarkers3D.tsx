import React, { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ActiveShiftInfo } from '../types/game';
import type { ActiveDriveVehicle } from './vehicles/PlayerVehicleController';
import { distance2D } from './worldConstants';

export interface CourierTarget {
  id: string;
  label: string;
  x: number;
  z: number;
  role?: string;
  boarded?: number;
  alighted?: number;
}

interface CourierMarkers3DProps {
  activeShift: ActiveShiftInfo | null | undefined;
  visitedIds: string[];
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  activeDriveVehicle?: ActiveDriveVehicle | null;
  onVisitTarget: (target: CourierTarget) => void;
  onNotify?: (msg: string) => void;
}

const ROUTE_SHIFT_TYPES = new Set(['kurir', 'ojek_online', 'sopir_angkot', 'sopir_logistik']);

function getBeaconPalette(shiftType: string) {
  if (shiftType === 'ojek_online') {
    return { beam: '#34d399', box: '#059669', badge: 'bg-emerald-400 text-slate-950', prefix: 'CikOjek' };
  }
  if (shiftType === 'sopir_angkot') {
    return { beam: '#38bdf8', box: '#0284c7', badge: 'bg-sky-400 text-slate-950', prefix: 'Halte Trayek' };
  }
  if (shiftType === 'sopir_logistik') {
    return { beam: '#fb923c', box: '#ea580c', badge: 'bg-orange-400 text-slate-950', prefix: 'Ekspedisi' };
  }
  return { beam: '#fbbf24', box: '#d97706', badge: 'bg-amber-500 text-slate-950', prefix: 'Antar Paket' };
}

function isDriveVehicleValidForShift(
  prompt: Record<string, unknown>,
  drive: ActiveDriveVehicle | null | undefined
): boolean {
  if (!prompt.requiresVehicle) return true;
  if (!drive || drive.mode === 'test_drive') return false;
  const reqCats = Array.isArray(prompt.requiredCategories)
    ? prompt.requiredCategories.map(String)
    : [];
  if (reqCats.length > 0 && !reqCats.includes(drive.category)) return false;
  const allowedModels = Array.isArray(prompt.allowedModelIds)
    ? prompt.allowedModelIds.map(String)
    : [];
  if (allowedModels.length > 0 && !allowedModels.includes(drive.modelId)) return false;
  return true;
}

export const CourierMarkers3D: React.FC<CourierMarkers3DProps> = ({
  activeShift,
  visitedIds,
  playerPosRef,
  activeDriveVehicle = null,
  onVisitTarget,
  onNotify,
}) => {
  const arrowRef = useRef<THREE.Group>(null);
  const lastWarnAtRef = useRef(0);
  const visitedSet = useMemo(() => new Set(visitedIds), [visitedIds]);

  const prompt = (activeShift?.taskPrompt || {}) as Record<string, unknown>;
  const shiftType = String(prompt.type || '');
  const isRouteShift = Boolean(activeShift && ROUTE_SHIFT_TYPES.has(shiftType));
  const isSequential = Boolean(prompt.sequential);

  const targets = useMemo<CourierTarget[]>(() => {
    if (!isRouteShift) return [];
    const raw = prompt.targets;
    return Array.isArray(raw) ? (raw as CourierTarget[]) : [];
  }, [isRouteShift, prompt.targets]);

  const remainingTargets = useMemo(
    () => targets.filter((t) => !visitedSet.has(t.id)),
    [targets, visitedSet]
  );

  const visibleTargets = useMemo(
    () => (isSequential ? remainingTargets.slice(0, 1) : remainingTargets),
    [isSequential, remainingTargets]
  );

  const palette = getBeaconPalette(shiftType);

  useFrame(({ clock }) => {
    if (visibleTargets.length === 0) return;
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const triggerRadius = prompt.requiresVehicle ? 5.6 : 4.2;

    for (const t of visibleTargets) {
      if (distance2D(px, pz, t.x, t.z) <= triggerRadius) {
        if (!isDriveVehicleValidForShift(prompt, activeDriveVehicle)) {
          const now = Date.now();
          if (onNotify && now - lastWarnAtRef.current > 4500) {
            lastWarnAtRef.current = now;
            const hint =
              shiftType === 'sopir_angkot'
                ? 'Kendarai Angkot milikmu untuk melayani halte ini!'
                : shiftType === 'sopir_logistik'
                  ? 'Kendarai Pickup/Truk Kecil milikmu untuk bongkar-muat di titik ini!'
                  : 'Kendarai sepeda motor milikmu untuk menjemput/mengantar order CikOjek!';
            onNotify(hint);
          }
          return;
        }
        onVisitTarget(t);
        return;
      }
    }

    if (arrowRef.current) {
      const nearest = visibleTargets[0];
      arrowRef.current.position.set(
        px,
        playerPosRef.current.y + (activeDriveVehicle ? 3.25 : 2.85) + Math.sin(clock.elapsedTime * 4) * 0.12,
        pz
      );
      const angle = Math.atan2(nearest.x - px, nearest.z - pz);
      arrowRef.current.rotation.set(0, angle, 0);
    }
  });

  if (targets.length === 0) return null;

  return (
    <group>
      {visibleTargets.map((t) => (
        <group key={t.id} position={[t.x, 0, t.z]}>
          {/* Pilar Cahaya Tujuan Shift */}
          <mesh position={[0, 3.4, 0]}>
            <cylinderGeometry args={[1.05, 1.45, 6.8, 12, 1, true]} />
            <meshBasicMaterial color={palette.beam} transparent opacity={0.28} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.95, 0.95, 0.95]} />
            <meshStandardMaterial
              color={palette.box}
              emissive={palette.beam}
              emissiveIntensity={0.45}
              roughness={0.5}
            />
          </mesh>
          <Html position={[0, 2.3, 0]} center distanceFactor={14}>
            <div className={`pointer-events-none whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold shadow-lg ${palette.badge}`}>
              {palette.prefix}: {t.label}
            </div>
          </Html>
        </group>
      ))}

      {/* Panah Arah 3D di atas Kepala Pemain / Atap Kendaraan */}
      {visibleTargets.length > 0 && (
        <group ref={arrowRef}>
          <mesh position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.3, 0.76, 6]} />
            <meshStandardMaterial color={palette.beam} emissive={palette.box} emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[0, 0, -0.22]}>
            <boxGeometry args={[0.16, 0.14, 0.55]} />
            <meshStandardMaterial color={palette.beam} emissive={palette.box} emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
};
