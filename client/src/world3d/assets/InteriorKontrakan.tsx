import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface InteriorKontrakanProps {
  roomW: number;
  roomD: number;
  wallHeight: number;
  wallColor?: string;
  floorColor?: string;
  bathPos: { x: number; z: number };
  exitPos: { x: number; z: number };
  hasAc?: boolean;
  isNight?: boolean;
  quality?: GraphicsQuality;
}

/**
 * Casing Interior Rumah Kontrakan / Hunian Cutaway (Batch 5).
 * Mengacu pada Isometric_rental_house_cutaway: lantai ubin terakota hangat,
 * sekat kamar mandi dengan shower & wastafel, list atap genteng cutaway, tangga masuk & tanaman.
 */
export const InteriorKontrakan: React.FC<InteriorKontrakanProps> = ({
  roomW,
  roomD,
  wallHeight,
  wallColor = '#F7EAD7',
  floorColor = '#E29873',
  bathPos,
  exitPos,
  hasAc = false,
  isNight = false,
  quality = 'medium',
}) => {
  const shadows = quality !== 'low';
  const halfW = roomW / 2;
  const halfD = roomD / 2;

  const wallMat = getCustomColorMaterial(wallColor, { roughness: 0.86 });
  const accentYellowWallMat = getPaletteMaterial('wall_pastel_yellow');
  const floorTileMat = getCustomColorMaterial(floorColor, { roughness: 0.78 });
  const terracottaMat = getPaletteMaterial('roof_terracotta');
  const terracottaDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const woodWarmMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const whiteCeramicMat = getPaletteMaterial('flag_white');
  const bathTileMat = getCustomColorMaterial('#D5E6EC', { roughness: 0.45 });
  const foliageMat = getPaletteMaterial('foliage_bright');
  const stoneMat = getPaletteMaterial('paving_stone');
  const lampMat = getPaletteMaterial('emissive_warm', { emissiveIntensity: isNight ? 1.8 : 0.7 });

  return (
    <group>
      {/* Plint Fondasi */}
      <mesh position={[0, -0.14, 0]} material={woodDarkMat} receiveShadow>
        <boxGeometry args={[roomW + 0.5, 0.28, roomD + 0.5]} />
      </mesh>
      {/* Lantai Ubin Terakota */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} material={floorTileMat} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
      </mesh>

      {/* Dinding Belakang (-Z) & Sisi Kiri-Kanan dengan Genteng Cutaway */}
      <mesh position={[0, wallHeight / 2, -halfD]} material={wallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[roomW + 0.3, wallHeight, 0.22]} />
      </mesh>
      <mesh position={[0, 0.1, -halfD + 0.12]} material={woodWarmMat}>
        <boxGeometry args={[roomW, 0.2, 0.04]} />
      </mesh>
      <mesh position={[0, wallHeight + 0.18, -halfD]} material={terracottaDarkMat} castShadow={shadows}>
        <boxGeometry args={[roomW + 0.5, 0.24, 0.46]} />
      </mesh>

      <mesh position={[-halfW, wallHeight / 2, 0]} material={wallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.22, wallHeight, roomD]} />
      </mesh>
      <mesh position={[-halfW, wallHeight + 0.18, 0]} material={terracottaDarkMat} castShadow={shadows}>
        <boxGeometry args={[0.46, 0.24, roomD + 0.4]} />
      </mesh>

      <mesh position={[halfW, wallHeight / 2, 0]} material={accentYellowWallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.22, wallHeight, roomD]} />
      </mesh>
      <mesh position={[halfW, wallHeight + 0.18, 0]} material={terracottaDarkMat} castShadow={shadows}>
        <boxGeometry args={[0.46, 0.24, roomD + 0.4]} />
      </mesh>

      {/* Cutaway Dinding Depan (+Z) */}
      <mesh position={[0, 0.16, halfD]} material={terracottaMat} receiveShadow>
        <boxGeometry args={[roomW + 0.3, 0.32, 0.22]} />
      </mesh>

      {/* Rak Dinding Kiri dengan Tanaman Hias & Lukisan */}
      <group position={[-halfW + 0.2, 1.85, 0.1]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={woodWarmMat}>
          <boxGeometry args={[1.35, 0.08, 0.24]} />
        </mesh>
        <mesh position={[-0.32, 0.16, 0]} material={terracottaMat}>
          <cylinderGeometry args={[0.09, 0.07, 0.16, 8]} />
        </mesh>
        <mesh position={[-0.32, 0.3, 0]} material={foliageMat}>
          <dodecahedronGeometry args={[0.16, 0]} />
        </mesh>
        <mesh position={[0.3, 0.14, 0]} material={terracottaMat}>
          <cylinderGeometry args={[0.07, 0.06, 0.12, 8]} />
        </mesh>
        <mesh position={[0.3, 0.26, 0]} material={foliageMat}>
          <coneGeometry args={[0.09, 0.18, 6]} />
        </mesh>
      </group>
      <mesh position={[-1.4, 1.9, -halfD + 0.13]} material={woodWarmMat}>
        <boxGeometry args={[0.78, 0.62, 0.05]} />
      </mesh>
      <mesh position={[-1.4, 1.9, -halfD + 0.16]} material={accentYellowWallMat}>
        <boxGeometry args={[0.64, 0.48, 0.03]} />
      </mesh>

      {hasAc && (
        <mesh position={[0.4, 2.55, -halfD + 0.24]} material={whiteCeramicMat} castShadow={shadows}>
          <boxGeometry args={[1.25, 0.32, 0.24]} />
        </mesh>
      )}

      {/* Kamar Mandi Sekat Cutaway (Belakang-Kanan) */}
      <group position={[bathPos.x, 0, bathPos.z]}>
        <mesh position={[-0.95, 1.25, 0.1]} material={wallMat} castShadow={shadows}>
          <boxGeometry args={[0.14, 2.5, 1.7]} />
        </mesh>
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} material={bathTileMat}>
          <planeGeometry args={[1.65, 1.55]} />
        </mesh>
        <mesh position={[0.35, 0.22, -0.3]} material={whiteCeramicMat} castShadow={shadows}>
          <cylinderGeometry args={[0.18, 0.14, 0.4, 10]} />
        </mesh>
        <mesh position={[0.45, 0.54, -0.42]} material={whiteCeramicMat}>
          <boxGeometry args={[0.32, 0.34, 0.18]} />
        </mesh>
        {/* Wastafel & Shower */}
        <mesh position={[-0.55, 0.88, -0.45]} material={whiteCeramicMat}>
          <boxGeometry args={[0.42, 0.14, 0.32]} />
        </mesh>
        <mesh position={[0.3, 1.95, -0.62]} material={getPaletteMaterial('rail_steel')}>
          <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
        </mesh>
      </group>

      {/* Tangga & Lentera Pintu Masuk di Luar Cutaway */}
      <group position={[exitPos.x, 0, halfD + 0.45]}>
        <mesh position={[0, 0.08, 0]} material={stoneMat} receiveShadow>
          <boxGeometry args={[1.6, 0.16, 0.55]} />
        </mesh>
        <mesh position={[-0.95, 0.22, 0]} material={woodDarkMat}>
          <boxGeometry args={[0.24, 0.44, 0.24]} />
        </mesh>
        <mesh position={[-0.95, 0.32, 0]} material={lampMat}>
          <boxGeometry args={[0.16, 0.2, 0.16]} />
        </mesh>
      </group>
    </group>
  );
};
