import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { FloatingTag } from '../../components/FloatingTag';
import { getVehicleModelById } from '../../firebase/vehicleConfigCache';
import type { GraphicsQuality, VehicleDoc, ZoneId } from '../../types/game';
import { VehicleModelMesh } from './VehicleModelMesh';

export interface NearbyVehicleTarget {
  vehicleId: string;
  modelId: string;
  name: string;
  plateNumber: string;
  category: VehicleDoc['category'];
  label: string;
}

interface ParkedVehicles3DProps {
  vehicles: VehicleDoc[];
  currentZone: ZoneId;
  activeVehicleId: string | null;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  isNight: boolean;
  quality: GraphicsQuality;
  isOnFoot: boolean;
  onNearbyVehicleChange: (target: NearbyVehicleTarget | null) => void;
}

const BOARD_RADIUS_METERS = 3.8;

/**
 * Menampilkan seluruh kendaraan yang sedang terparkir di zona aktif
 * serta mendeteksi kedekatan pemain untuk aksi naik/mengendarai.
 */
export const ParkedVehicles3D: React.FC<ParkedVehicles3DProps> = ({
  vehicles,
  currentZone,
  activeVehicleId,
  playerPosRef,
  isNight,
  quality,
  isOnFoot,
  onNearbyVehicleChange,
}) => {
  const lastNearbyKeyRef = useRef<string>('none');

  const visibleParked = useMemo(
    () =>
      vehicles.filter(
        (v) =>
          v.status === 'parked' &&
          v.id !== activeVehicleId &&
          (v.parkedPos?.zone || 'cicalengka') === currentZone
      ),
    [vehicles, activeVehicleId, currentZone]
  );

  useFrame(() => {
    if (!isOnFoot || visibleParked.length === 0) {
      if (lastNearbyKeyRef.current !== 'none') {
        lastNearbyKeyRef.current = 'none';
        onNearbyVehicleChange(null);
      }
      return;
    }

    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    let best: VehicleDoc | null = null;
    let bestDist = BOARD_RADIUS_METERS;

    for (const v of visibleParked) {
      const vx = v.parkedPos?.x ?? 0;
      const vz = v.parkedPos?.z ?? 0;
      const d = Math.hypot(px - vx, pz - vz);
      if (d <= bestDist) {
        bestDist = d;
        best = v;
      }
    }

    const nextKey = best ? `${best.id}:${Math.round(best.fuel)}` : 'none';
    if (nextKey !== lastNearbyKeyRef.current) {
      lastNearbyKeyRef.current = nextKey;
      if (best) {
        onNearbyVehicleChange({
          vehicleId: best.id,
          modelId: best.modelId,
          name: best.name,
          plateNumber: best.plateNumber,
          category: best.category,
          label: `Naik ${best.name} (${best.plateNumber})`,
        });
      } else {
        onNearbyVehicleChange(null);
      }
    }
  });

  return (
    <group>
      {visibleParked.map((v) => {
        const px = v.parkedPos?.x ?? 0;
        const py = Math.max(0, v.parkedPos?.y ?? 0);
        const pz = v.parkedPos?.z ?? 0;
        const rotY = v.parkedPos?.rotY ?? 0;
        const dims = getVehicleModelById(v.modelId)?.dimensions;
        const halfW = Math.max(0.32, (dims?.width ?? (v.category === 'motor' ? 0.72 : 1.65)) * 0.46);
        const halfH = Math.max(0.42, (dims?.height ?? (v.category === 'motor' ? 1.15 : 1.45)) * 0.48);
        const halfL = Math.max(0.75, (dims?.length ?? (v.category === 'motor' ? 1.85 : 3.9)) * 0.47);

        return (
          <RigidBody
            key={v.id}
            type="fixed"
            colliders={false}
            position={[px, py, pz]}
            rotation={[0, rotY, 0]}
          >
            <CuboidCollider args={[halfW, halfH, halfL]} position={[0, halfH + 0.04, 0]} />
            <VehicleModelMesh
              modelId={v.modelId}
              color={v.color}
              quality={quality}
              isNight={isNight}
              headlightsOn={false}
              brakeOn={false}
              accessories={v.accessories ?? []}
              lod={quality === 'low' ? 'simple' : 'full'}
              castShadow={quality !== 'low'}
            />
            <FloatingTag name={`${v.plateNumber} · ${v.name}`} yOffset={v.category === 'motor' ? 1.55 : 1.95} />
          </RigidBody>
        );
      })}
    </group>
  );
};
