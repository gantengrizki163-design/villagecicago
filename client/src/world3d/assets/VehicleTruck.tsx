import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface VehicleTruckProps {
  variant?: 'box' | 'pickup';
  quality?: GraphicsQuality;
  isNight?: boolean;
  castShadow?: boolean;
}

/**
 * Truk Box & Truk Bak Distribusi Low-Poly (2.1 x 4.8 x 2.6 m, pivot bottom-center y=0, menghadap +Z).
 */
export const VehicleTruck: React.FC<VehicleTruckProps> = ({
  variant = 'box',
  quality = 'medium',
  isNight = false,
  castShadow,
}) => {
  const shadows = castShadow ?? quality !== 'low';
  const cabMat = getPaletteMaterial(
    variant === 'box' ? 'vehicle_truck_periwinkle' : 'vehicle_pickup_ochre'
  );
  const boxCargoMat = getCustomColorMaterial('#BAC7E0', { roughness: 0.62 });
  const bedWoodMat = getPaletteMaterial('wood_warm');
  const tireMat = getPaletteMaterial('vehicle_tire');
  const rimMat = getPaletteMaterial('concrete_grey', { roughness: 0.35, metalness: 0.4 });
  const glassMat = getPaletteMaterial('glass_day');
  const bumperMat = getCustomColorMaterial('#383E46', { roughness: 0.74 });
  const headlightMat = getPaletteMaterial('emissive_warm', {
    emissiveIntensity: isNight ? 1.8 : 0.25,
  });

  const wheelPositions: [number, number, number][] = [
    [-0.92, 0.36, 1.38],
    [0.92, 0.36, 1.38],
    [-0.92, 0.36, -1.28],
    [0.92, 0.36, -1.28],
  ];

  return (
    <AssetModelLoader assetId="vehicle_truck_box" quality={quality} castShadow={shadows}>
      <group>
        {/* Sasis Baja Panjang */}
        <mesh position={[0, 0.44, -0.08]} material={bumperMat} castShadow={shadows}>
          <boxGeometry args={[1.64, 0.22, 4.35]} />
        </mesh>

        {/* Kabin Depan */}
        <mesh position={[0, 0.96, 1.45]} material={cabMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[1.88, 0.92, 1.32]} />
        </mesh>
        {/* Kabin Atas + Kaca Depan Miring */}
        <mesh position={[0, 1.62, 1.24]} material={cabMat} castShadow={shadows}>
          <boxGeometry args={[1.82, 0.64, 1.05]} />
        </mesh>
        <mesh position={[0, 1.56, 1.72]} rotation={[-0.24, 0, 0]} material={glassMat}>
          <boxGeometry args={[1.62, 0.54, 0.14]} />
        </mesh>
        {/* Kaca Pintu Samping Kabin */}
        <mesh position={[-0.93, 1.58, 1.28]} material={glassMat}>
          <boxGeometry args={[0.04, 0.44, 0.68]} />
        </mesh>
        <mesh position={[0.93, 1.58, 1.28]} material={glassMat}>
          <boxGeometry args={[0.04, 0.44, 0.68]} />
        </mesh>

        {/* Bemper & Lampu Depan */}
        <mesh position={[0, 0.46, 2.15]} material={bumperMat}>
          <boxGeometry args={[1.94, 0.2, 0.14]} />
        </mesh>
        <mesh position={[-0.68, 0.72, 2.13]} material={headlightMat}>
          <boxGeometry args={[0.28, 0.18, 0.06]} />
        </mesh>
        <mesh position={[0.68, 0.72, 2.13]} material={headlightMat}>
          <boxGeometry args={[0.28, 0.18, 0.06]} />
        </mesh>
        {variant === 'pickup' && (
          <mesh position={[0, 0.72, 2.13]} material={bumperMat}>
            <boxGeometry args={[0.88, 0.22, 0.05]} />
          </mesh>
        )}

        {/* Bak Kargo: Box Tertutup vs Bak Terbuka */}
        {variant === 'box' ? (
          <mesh position={[0, 1.58, -0.78]} material={boxCargoMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[2.02, 2.02, 2.95]} />
          </mesh>
        ) : (
          <group position={[0, 0.84, -0.78]}>
            <mesh position={[0, -0.18, 0]} material={bedWoodMat} castShadow={shadows} receiveShadow>
              <boxGeometry args={[1.96, 0.14, 2.86]} />
            </mesh>
            <mesh position={[-0.94, 0.16, 0]} material={cabMat} castShadow={shadows}>
              <boxGeometry args={[0.1, 0.62, 2.86]} />
            </mesh>
            <mesh position={[0.94, 0.16, 0]} material={cabMat} castShadow={shadows}>
              <boxGeometry args={[0.1, 0.62, 2.86]} />
            </mesh>
            <mesh position={[0, 0.16, -1.38]} material={cabMat} castShadow={shadows}>
              <boxGeometry args={[1.96, 0.62, 0.1]} />
            </mesh>
            <mesh position={[0, 0.16, 1.38]} material={cabMat}>
              <boxGeometry args={[1.96, 0.62, 0.1]} />
            </mesh>
          </group>
        )}

        {/* 4 Roda Truk */}
        {wheelPositions.map(([wx, wy, wz], idx) => (
          <group key={idx} position={[wx, wy, wz]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={tireMat} castShadow={shadows}>
              <cylinderGeometry args={[0.36, 0.36, 0.24, 12]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
              <cylinderGeometry args={[0.18, 0.18, 0.255, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    </AssetModelLoader>
  );
};
