import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface VehicleAmbulanceProps {
  quality?: GraphicsQuality;
  isNight?: boolean;
  castShadow?: boolean;
}

/**
 * Ambulans Klinik / Puskesmas Low-Poly (1.9 x 4.3 x 2.2 m, pivot bottom-center y=0, menghadap +Z).
 * Mengacu pada Isometric_Low-Poly_Clinic_and_Ambulance: bodi putih, strip merah, palang medis, & sirine atap.
 */
export const VehicleAmbulance: React.FC<VehicleAmbulanceProps> = ({
  quality = 'medium',
  isNight = false,
  castShadow,
}) => {
  const shadows = castShadow ?? quality !== 'low';
  const whiteMat = getPaletteMaterial('ambulance_white');
  const redMat = getPaletteMaterial('trim_mart_red');
  const blueSirenMat = getPaletteMaterial('trim_mart_blue', {
    emissive: '#3B82F6',
    emissiveIntensity: isNight ? 1.5 : 0.65,
  });
  const redSirenMat = getCustomColorMaterial('#EF4444');
  const tireMat = getPaletteMaterial('vehicle_tire');
  const rimMat = getPaletteMaterial('concrete_grey', { roughness: 0.35, metalness: 0.4 });
  const glassMat = getPaletteMaterial('glass_day');
  const bumperMat = getCustomColorMaterial('#383E46', { roughness: 0.72 });
  const headlightMat = getPaletteMaterial('emissive_warm', {
    emissiveIntensity: isNight ? 1.8 : 0.25,
  });

  const wheelPositions: [number, number, number][] = [
    [-0.86, 0.32, 1.32],
    [0.86, 0.32, 1.32],
    [-0.86, 0.32, -1.25],
    [0.86, 0.32, -1.25],
  ];

  return (
    <AssetModelLoader assetId="vehicle_ambulance" quality={quality} castShadow={shadows}>
      <group>
        {/* Bodi Utama Ambulans */}
        <mesh position={[0, 1.05, -0.18]} material={whiteMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[1.82, 1.44, 3.3]} />
        </mesh>
        {/* Hidung Kabin & Kaca Depan */}
        <mesh position={[0, 0.72, 1.62]} material={whiteMat} castShadow={shadows}>
          <boxGeometry args={[1.78, 0.76, 0.85]} />
        </mesh>
        <mesh position={[0, 1.32, 1.48]} rotation={[-0.36, 0, 0]} material={glassMat}>
          <boxGeometry args={[1.56, 0.62, 0.28]} />
        </mesh>

        {/* Strip Merah Sepanjang Sisi & Belakang */}
        <mesh position={[0, 0.84, -0.18]} material={redMat}>
          <boxGeometry args={[1.85, 0.16, 3.33]} />
        </mesh>
        {/* Palang Medis 3D Kiri & Kanan */}
        {[-0.93, 0.93].map((sx) => (
          <group key={sx} position={[sx, 1.36, -0.35]}>
            <mesh material={redMat}>
              <boxGeometry args={[0.04, 0.44, 0.14]} />
            </mesh>
            <mesh material={redMat}>
              <boxGeometry args={[0.04, 0.14, 0.44]} />
            </mesh>
          </group>
        ))}

        {/* Kaca Samping Kabin & Belakang */}
        <mesh position={[-0.92, 1.3, 1.02]} material={glassMat}>
          <boxGeometry args={[0.04, 0.42, 0.62]} />
        </mesh>
        <mesh position={[0.92, 1.3, 1.02]} material={glassMat}>
          <boxGeometry args={[0.04, 0.42, 0.62]} />
        </mesh>

        {/* Bar Sirine Atap Merah-Putih-Biru */}
        <group position={[0, 1.85, 0.92]}>
          <mesh position={[-0.28, 0, 0]} material={redSirenMat}>
            <boxGeometry args={[0.32, 0.14, 0.24]} />
          </mesh>
          <mesh position={[0, 0, 0]} material={whiteMat}>
            <boxGeometry args={[0.24, 0.13, 0.24]} />
          </mesh>
          <mesh position={[0.28, 0, 0]} material={blueSirenMat}>
            <boxGeometry args={[0.32, 0.14, 0.24]} />
          </mesh>
        </group>

        {/* Bemper & Lampu Depan */}
        <mesh position={[0, 0.34, 2.06]} material={bumperMat}>
          <boxGeometry args={[1.84, 0.18, 0.12]} />
        </mesh>
        <mesh position={[0, 0.34, -1.86]} material={bumperMat}>
          <boxGeometry args={[1.84, 0.18, 0.12]} />
        </mesh>
        <mesh position={[-0.64, 0.64, 2.05]} material={headlightMat}>
          <boxGeometry args={[0.26, 0.16, 0.05]} />
        </mesh>
        <mesh position={[0.64, 0.64, 2.05]} material={headlightMat}>
          <boxGeometry args={[0.26, 0.16, 0.05]} />
        </mesh>

        {/* 4 Roda */}
        {wheelPositions.map(([wx, wy, wz], idx) => (
          <group key={idx} position={[wx, wy, wz]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={tireMat} castShadow={shadows}>
              <cylinderGeometry args={[0.32, 0.32, 0.2, 12]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
              <cylinderGeometry args={[0.17, 0.17, 0.215, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    </AssetModelLoader>
  );
};
