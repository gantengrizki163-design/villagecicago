import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface VehicleBecakProps {
  quality?: GraphicsQuality;
  castShadow?: boolean;
}

/**
 * Becak Tradisional Indonesia Berkanopi Belang (1.15 x 2.1 x 1.65 m, pivot bottom-center y=0, menghadap +Z).
 */
export const VehicleBecak: React.FC<VehicleBecakProps> = ({
  quality = 'medium',
  castShadow,
}) => {
  const shadows = castShadow ?? quality !== 'low';
  const frameBlueMat = getCustomColorMaterial('#4E8FB3', { roughness: 0.55, metalness: 0.25 });
  const tireMat = getPaletteMaterial('vehicle_tire');
  const rimMat = getPaletteMaterial('concrete_grey', { roughness: 0.35, metalness: 0.4 });
  const seatRedMat = getPaletteMaterial('tarp_red');
  const yellowMat = getPaletteMaterial('tarp_yellow');
  const blueMat = getPaletteMaterial('tarp_blue');
  const steelMat = getPaletteMaterial('rail_steel');
  const creamMat = getPaletteMaterial('wall_cream');

  return (
    <AssetModelLoader assetId="vehicle_becak" quality={quality} castShadow={shadows}>
      <group>
        {/* 2 Roda Depan Kanan & Kiri + 1 Roda Belakang */}
        {[-0.5, 0.5].map((wx) => (
          <group key={wx} position={[wx, 0.32, 0.42]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={tireMat} castShadow={shadows}>
              <cylinderGeometry args={[0.32, 0.32, 0.08, 12]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
              <cylinderGeometry args={[0.24, 0.24, 0.05, 10]} />
            </mesh>
          </group>
        ))}
        <group position={[0, 0.28, -0.78]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={tireMat} castShadow={shadows}>
            <cylinderGeometry args={[0.28, 0.28, 0.08, 12]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
            <cylinderGeometry args={[0.2, 0.2, 0.05, 10]} />
          </mesh>
        </group>

        {/* Rangka Dasar & Poros Depan */}
        <mesh position={[0, 0.32, 0.42]} rotation={[0, 0, Math.PI / 2]} material={frameBlueMat}>
          <cylinderGeometry args={[0.03, 0.03, 0.96, 8]} />
        </mesh>
        <mesh position={[0, 0.38, -0.15]} material={frameBlueMat} castShadow={shadows}>
          <boxGeometry args={[0.12, 0.08, 1.35]} />
        </mesh>

        {/* Bak Penumpang & Jok Merah */}
        <mesh position={[0, 0.48, 0.34]} material={creamMat} castShadow={shadows}>
          <boxGeometry args={[0.84, 0.24, 0.72]} />
        </mesh>
        <mesh position={[0, 0.64, 0.36]} material={seatRedMat} castShadow={shadows}>
          <boxGeometry args={[0.74, 0.14, 0.52]} />
        </mesh>
        {/* Sandaran & Dinding Samping Penumpang */}
        <mesh position={[0, 0.92, 0.06]} material={seatRedMat} castShadow={shadows}>
          <boxGeometry args={[0.78, 0.46, 0.14]} />
        </mesh>
        <mesh position={[-0.41, 0.74, 0.34]} material={yellowMat}>
          <boxGeometry args={[0.08, 0.36, 0.68]} />
        </mesh>
        <mesh position={[0.41, 0.74, 0.34]} material={yellowMat}>
          <boxGeometry args={[0.08, 0.36, 0.68]} />
        </mesh>

        {/* Tiang Penyangga Kanopi */}
        {[
          [-0.4, 1.18, 0.62],
          [0.4, 1.18, 0.62],
          [-0.4, 1.18, 0.04],
          [0.4, 1.18, 0.04],
        ].map(([px, py, pz], idx) => (
          <mesh key={idx} position={[px, py, pz]} material={steelMat}>
            <cylinderGeometry args={[0.02, 0.02, 0.76, 6]} />
          </mesh>
        ))}

        {/* Kanopi Belang Biru-Kuning-Merah */}
        <group position={[0, 1.56, 0.34]}>
          <mesh position={[-0.31, 0, 0]} rotation={[0, 0, 0.14]} material={blueMat} castShadow={shadows}>
            <boxGeometry args={[0.34, 0.06, 0.86]} />
          </mesh>
          <mesh position={[0, 0.025, 0]} material={yellowMat} castShadow={shadows}>
            <boxGeometry args={[0.32, 0.06, 0.86]} />
          </mesh>
          <mesh position={[0.31, 0, 0]} rotation={[0, 0, -0.14]} material={seatRedMat} castShadow={shadows}>
            <boxGeometry args={[0.34, 0.06, 0.86]} />
          </mesh>
        </group>

        {/* Sadel Pengayuh & Stang Belakang */}
        <mesh position={[0, 0.76, -0.68]} material={tireMat}>
          <boxGeometry args={[0.2, 0.08, 0.24]} />
        </mesh>
        <mesh position={[0, 0.94, -0.25]} material={steelMat}>
          <boxGeometry args={[0.52, 0.04, 0.04]} />
        </mesh>

        {/* Tiang & Bendera Kecil di Belakang */}
        <mesh position={[-0.38, 1.32, -0.1]} material={steelMat}>
          <cylinderGeometry args={[0.015, 0.015, 1.1, 6]} />
        </mesh>
        <mesh position={[-0.38, 1.82, -0.22]} material={seatRedMat}>
          <boxGeometry args={[0.02, 0.16, 0.22]} />
        </mesh>
      </group>
    </AssetModelLoader>
  );
};
