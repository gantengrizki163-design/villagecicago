import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface VehicleOjolProps {
  quality?: GraphicsQuality;
  isNight?: boolean;
  castShadow?: boolean;
}

/**
 * Sepeda Motor Kurir / Ojol Low-Poly (0.85 x 1.9 x 1.3 m, pivot bottom-center y=0, menghadap +Z).
 * Dilengkapi boks pengiriman kurir di rak belakang sesuai Low-poly_Indonesian_vehicle_set.
 */
export const VehicleOjol: React.FC<VehicleOjolProps> = ({
  quality = 'medium',
  isNight = false,
  castShadow,
}) => {
  const shadows = castShadow ?? quality !== 'low';
  const tealMat = getPaletteMaterial('vehicle_ojol_teal');
  const darkSeatMat = getCustomColorMaterial('#232933', { roughness: 0.82 });
  const tireMat = getPaletteMaterial('vehicle_tire');
  const rimMat = getPaletteMaterial('concrete_grey', { roughness: 0.35, metalness: 0.45 });
  const boxBlueMat = getCustomColorMaterial('#3B668E', { roughness: 0.65 });
  const whiteMat = getPaletteMaterial('flag_white');
  const headlightMat = getPaletteMaterial('emissive_warm', {
    emissiveIntensity: isNight ? 1.8 : 0.25,
  });

  return (
    <AssetModelLoader assetId="vehicle_ojol" quality={quality} castShadow={shadows}>
      <group>
        {/* Roda Depan & Belakang */}
        <group position={[0, 0.25, 0.64]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={tireMat} castShadow={shadows}>
            <cylinderGeometry args={[0.25, 0.25, 0.13, 12]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
            <cylinderGeometry args={[0.14, 0.14, 0.14, 10]} />
          </mesh>
        </group>
        <group position={[0, 0.25, -0.58]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={tireMat} castShadow={shadows}>
            <cylinderGeometry args={[0.25, 0.25, 0.14, 12]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
            <cylinderGeometry args={[0.14, 0.14, 0.15, 10]} />
          </mesh>
        </group>

        {/* Rangka Bawah & Dek Kaki */}
        <mesh position={[0, 0.34, 0.05]} material={darkSeatMat} castShadow={shadows}>
          <boxGeometry args={[0.36, 0.14, 0.92]} />
        </mesh>
        {/* Bodi Belakang Skuter */}
        <mesh position={[0, 0.56, -0.32]} material={tealMat} castShadow={shadows}>
          <boxGeometry args={[0.42, 0.34, 0.72]} />
        </mesh>
        {/* Jok Kulit Gelap */}
        <mesh position={[0, 0.76, -0.22]} material={darkSeatMat} castShadow={shadows}>
          <boxGeometry args={[0.34, 0.11, 0.62]} />
        </mesh>

        {/* Tameng Depan & Batang Kemudi */}
        <mesh position={[0, 0.68, 0.45]} rotation={[-0.22, 0, 0]} material={tealMat} castShadow={shadows}>
          <boxGeometry args={[0.4, 0.56, 0.22]} />
        </mesh>
        {/* Spakbor Depan */}
        <mesh position={[0, 0.47, 0.64]} rotation={[0.25, 0, 0]} material={tealMat}>
          <boxGeometry args={[0.18, 0.06, 0.34]} />
        </mesh>
        {/* Stang & Lampu Depan */}
        <mesh position={[0, 1.0, 0.38]} material={tealMat} castShadow={shadows}>
          <boxGeometry args={[0.22, 0.14, 0.22]} />
        </mesh>
        <mesh position={[0, 1.01, 0.36]} material={darkSeatMat}>
          <boxGeometry args={[0.72, 0.05, 0.06]} />
        </mesh>
        <mesh position={[0, 0.98, 0.5]} material={headlightMat}>
          <boxGeometry args={[0.14, 0.11, 0.05]} />
        </mesh>
        {/* Spion */}
        <mesh position={[-0.31, 1.12, 0.36]} material={darkSeatMat}>
          <boxGeometry args={[0.08, 0.06, 0.03]} />
        </mesh>
        <mesh position={[0.31, 1.12, 0.36]} material={darkSeatMat}>
          <boxGeometry args={[0.08, 0.06, 0.03]} />
        </mesh>

        {/* Boks Kurir di Rak Belakang */}
        <group position={[0, 0.98, -0.72]}>
          <mesh material={boxBlueMat} castShadow={shadows}>
            <boxGeometry args={[0.48, 0.42, 0.46]} />
          </mesh>
          <mesh position={[0.245, 0, 0]} material={whiteMat}>
            <boxGeometry args={[0.02, 0.18, 0.2]} />
          </mesh>
          <mesh position={[-0.245, 0, 0]} material={whiteMat}>
            <boxGeometry args={[0.02, 0.18, 0.2]} />
          </mesh>
        </group>
      </group>
    </AssetModelLoader>
  );
};
