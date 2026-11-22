import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface InteriorWarungProps {
  roomW: number;
  roomD: number;
  wallHeight: number;
  theme: { floor: string; wall: string; accent: string };
  cashierSpot: { x: number; z: number };
  craftSpot: { x: number; z: number };
  quality?: GraphicsQuality;
}

/**
 * Interior Warung Makan & Etalase Kaca (Batch 5).
 * Mengacu pada Warung_interior_isometric_game_asset:
 * dinding dua nada krem-teal, lantai ubin pastel, balok kayu + lampu gantung,
 * etalase lauk berkaca miring, kulkas minuman, kompor wajan, galon air, & meja makan pastel.
 */
export const InteriorWarung: React.FC<InteriorWarungProps> = ({
  roomW,
  roomD,
  wallHeight,
  theme,
  cashierSpot,
  craftSpot,
  quality = 'medium',
}) => {
  const shadows = quality !== 'low';
  const halfW = roomW / 2;
  const halfD = roomD / 2;

  const wallMat = getCustomColorMaterial(theme.wall, { roughness: 0.86 });
  const tealBandMat = getCustomColorMaterial('#76A4A2', { roughness: 0.86 });
  const floorBaseMat = getCustomColorMaterial(theme.floor, { roughness: 0.8 });
  const accentMat = getCustomColorMaterial(theme.accent, { roughness: 0.72 });
  const woodWarmMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const terracottaMat = getPaletteMaterial('roof_terracotta');
  const steelMat = getPaletteMaterial('rail_steel');
  const glassMat = getPaletteMaterial('glass_day', {
    roughness: 0.18,
    transparent: true,
    opacity: 0.45,
  });
  const lampMat = getPaletteMaterial('emissive_warm', { emissiveIntensity: 1.35 });
  const mintTableMat = getCustomColorMaterial('#92D2C9', { roughness: 0.75 });
  const pinkTableMat = getCustomColorMaterial('#F3B4BA', { roughness: 0.75 });
  const yellowFoodMat = getPaletteMaterial('tarp_yellow');
  const redFoodMat = getPaletteMaterial('tarp_red');
  const waterBlueMat = getPaletteMaterial('water_clear');
  const foliageMat = getPaletteMaterial('foliage_bright');
  const whiteMat = getPaletteMaterial('flag_white');

  return (
    <group>
      {/* Plint & Lantai Warung */}
      <mesh position={[0, -0.14, 0]} material={woodDarkMat} receiveShadow>
        <boxGeometry args={[roomW + 0.5, 0.28, roomD + 0.5]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={floorBaseMat} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
      </mesh>
      {/* Pola Ubin Pastel Halus */}
      {[-3.2, -1.6, 0, 1.6, 3.2].map((tx, xi) =>
        [-2.4, -0.8, 0.8, 2.4].map((tz, zi) => (
          <mesh
            key={`${xi}_${zi}`}
            position={[tx, 0.008, tz]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={(xi + zi) % 2 === 0 ? mintTableMat : pinkTableMat}
          >
            <planeGeometry args={[0.72, 0.72]} />
          </mesh>
        ))
      )}

      {/* Dinding Dua Nada Krem-Teal + Lis Atap Genteng Cutaway */}
      <mesh position={[0, wallHeight / 2, -halfD]} material={wallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[roomW + 0.3, wallHeight, 0.22]} />
      </mesh>
      <mesh position={[0, 0.65, -halfD + 0.115]} material={tealBandMat}>
        <boxGeometry args={[roomW, 1.3, 0.02]} />
      </mesh>
      <mesh position={[0, wallHeight + 0.15, -halfD]} material={terracottaMat} castShadow={shadows}>
        <boxGeometry args={[roomW + 0.45, 0.24, 0.44]} />
      </mesh>

      <mesh position={[-halfW, wallHeight / 2, 0]} material={wallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.22, wallHeight, roomD]} />
      </mesh>
      <mesh position={[-halfW + 0.115, 0.65, 0]} material={tealBandMat}>
        <boxGeometry args={[0.02, 1.3, roomD]} />
      </mesh>
      <mesh position={[-halfW, wallHeight + 0.15, 0]} material={terracottaMat} castShadow={shadows}>
        <boxGeometry args={[0.44, 0.24, roomD + 0.35]} />
      </mesh>

      <mesh position={[halfW, wallHeight / 2, 0]} material={wallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.22, wallHeight, roomD]} />
      </mesh>
      <mesh position={[halfW - 0.115, 0.65, 0]} material={tealBandMat}>
        <boxGeometry args={[0.02, 1.3, roomD]} />
      </mesh>

      {/* Cutaway Dinding Depan */}
      <mesh position={[0, 0.16, halfD]} material={accentMat}>
        <boxGeometry args={[roomW + 0.3, 0.32, 0.22]} />
      </mesh>

      {/* Jendela Dinding Kanan Bertirai & Tanaman */}
      <group position={[halfW - 0.14, 1.82, -0.2]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={woodWarmMat}>
          <boxGeometry args={[2.1, 1.15, 0.08]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={lampMat}>
          <boxGeometry args={[1.88, 0.94, 0.04]} />
        </mesh>
        <mesh position={[-0.4, -0.45, 0.14]} material={foliageMat}>
          <dodecahedronGeometry args={[0.14, 0]} />
        </mesh>
        <mesh position={[0.4, -0.45, 0.14]} material={foliageMat}>
          <dodecahedronGeometry args={[0.14, 0]} />
        </mesh>
      </group>

      {/* Balok Kayu Plafon & 2 Lampu Gantung Warung */}
      <mesh position={[-1.4, wallHeight - 0.22, -halfD + 1.5]} material={woodDarkMat}>
        <boxGeometry args={[4.4, 0.14, 0.16]} />
      </mesh>
      {[-2.2, -0.4].map((lx) => (
        <group key={lx} position={[lx, wallHeight - 0.68, -halfD + 1.5]}>
          <mesh position={[0, 0.24, 0]} material={woodDarkMat}>
            <cylinderGeometry args={[0.02, 0.02, 0.42, 6]} />
          </mesh>
          <mesh position={[0, 0.05, 0]} material={woodWarmMat}>
            <coneGeometry args={[0.22, 0.14, 10]} />
          </mesh>
          <mesh position={[0, -0.02, 0]} material={lampMat}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
        </group>
      ))}

      {/* Meja Kasir & Etalase Kaca Warung (di posisi cashierSpot) */}
      <group position={[cashierSpot.x + 0.4, 0, cashierSpot.z]}>
        <mesh position={[0, 0.5, 0]} material={woodWarmMat} castShadow={shadows}>
          <boxGeometry args={[1.18, 1.0, 2.4]} />
        </mesh>
        {/* Etalase Kaca Miring dengan Nampan Lauk */}
        <mesh position={[-0.1, 1.24, 0.2]} material={glassMat} castShadow={shadows}>
          <boxGeometry args={[0.68, 0.52, 1.45]} />
        </mesh>
        <mesh position={[-0.1, 1.1, -0.15]} material={yellowFoodMat}>
          <boxGeometry args={[0.44, 0.08, 0.45]} />
        </mesh>
        <mesh position={[-0.1, 1.1, 0.45]} material={redFoodMat}>
          <boxGeometry args={[0.44, 0.08, 0.45]} />
        </mesh>
        {/* Kulkas Minuman Samping Kasir */}
        <mesh position={[0.05, 0.72, -1.62]} material={whiteMat} castShadow={shadows}>
          <boxGeometry args={[0.85, 1.44, 0.72]} />
        </mesh>
        <mesh position={[-0.38, 0.78, -1.62]} material={glassMat}>
          <boxGeometry args={[0.04, 1.1, 0.56]} />
        </mesh>
      </group>

      {/* Area Masak (craftSpot): Meja Kompor + Wajan + Galon Dispenser */}
      <group position={[craftSpot.x - 0.2, 0, craftSpot.z - 0.4]}>
        <mesh position={[0, 0.46, 0]} material={woodWarmMat} castShadow={shadows}>
          <boxGeometry args={[1.7, 0.9, 0.98]} />
        </mesh>
        <mesh position={[0, 0.94, 0]} material={steelMat}>
          <boxGeometry args={[1.64, 0.08, 0.9]} />
        </mesh>
        <mesh position={[-0.35, 1.04, 0]} material={woodDarkMat}>
          <cylinderGeometry args={[0.24, 0.14, 0.12, 10]} />
        </mesh>
        <mesh position={[0.35, 1.06, 0]} material={steelMat}>
          <cylinderGeometry args={[0.16, 0.15, 0.16, 10]} />
        </mesh>
        {/* Dispenser Galon Biru */}
        <group position={[1.15, 0, -0.12]}>
          <mesh position={[0, 0.5, 0]} material={whiteMat} castShadow={shadows}>
            <boxGeometry args={[0.42, 1.0, 0.42]} />
          </mesh>
          <mesh position={[0, 1.18, 0]} material={waterBlueMat}>
            <cylinderGeometry args={[0.16, 0.16, 0.38, 10]} />
          </mesh>
        </group>
      </group>

      {/* 2 Meja Makan Pastel & Bangku Kayu Warung */}
      {[
        { x: 0.4, z: 1.5, mat: mintTableMat },
        { x: 0.6, z: -0.35, mat: pinkTableMat },
      ].map((tbl, idx) => (
        <group key={idx} position={[tbl.x, 0, tbl.z]}>
          <mesh position={[0, 0.68, 0]} material={tbl.mat} castShadow={shadows}>
            <boxGeometry args={[0.92, 0.06, 0.92]} />
          </mesh>
          {[
            [-0.36, 0.34, -0.36],
            [0.36, 0.34, -0.36],
            [-0.36, 0.34, 0.36],
            [0.36, 0.34, 0.36],
          ].map(([lx, ly, lz], li) => (
            <mesh key={li} position={[lx, ly, lz]} material={tbl.mat}>
              <boxGeometry args={[0.07, 0.68, 0.07]} />
            </mesh>
          ))}
          {/* 2 Bangku Kecil */}
          {[-0.64, 0.64].map((sx) => (
            <mesh key={sx} position={[sx, 0.24, 0]} material={woodWarmMat} castShadow={shadows}>
              <boxGeometry args={[0.32, 0.48, 0.32]} />
            </mesh>
          ))}
          {/* Mangkok & Gelas */}
          <mesh position={[-0.18, 0.74, 0.12]} material={whiteMat}>
            <cylinderGeometry args={[0.1, 0.06, 0.07, 8]} />
          </mesh>
          <mesh position={[0.2, 0.76, -0.1]} material={waterBlueMat}>
            <cylinderGeometry args={[0.045, 0.04, 0.12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
