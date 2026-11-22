import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface InteriorKosProps {
  roomW: number;
  roomD: number;
  wallHeight: number;
  wallColor?: string;
  floorColor?: string;
  bathPos: { x: number; z: number };
  hasAc?: boolean;
  isNight?: boolean;
  quality?: GraphicsQuality;
}

/**
 * Casing Interior Kamar Kos & Kamar Mandi Dalam (Batch 5).
 * Mengacu pada Indonesian_boarding_room_game_asset:
 * lantai keramik kotak, dinding dua nada krem-okre + balok kayu atas, jendela bertirai + tanaman,
 * rak baju terbuka di dinding belakang, kipas/lampu sudut, & kamar mandi dalam berpintu kayu.
 */
export const InteriorKos: React.FC<InteriorKosProps> = ({
  roomW,
  roomD,
  wallHeight,
  wallColor = '#F5EBD8',
  floorColor = '#ECEAE4',
  bathPos,
  hasAc = false,
  isNight = false,
  quality = 'medium',
}) => {
  const shadows = quality !== 'low';
  const halfW = roomW / 2;
  const halfD = roomD / 2;

  const wallUpperMat = getCustomColorMaterial(wallColor, { roughness: 0.86 });
  const wallLowerMat = getCustomColorMaterial('#E5C59A', { roughness: 0.88 });
  const floorMat = getCustomColorMaterial(floorColor, { roughness: 0.72 });
  const woodWarmMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const curtainMat = getCustomColorMaterial('#F3D3C4', { roughness: 0.86 });
  const foliageMat = getPaletteMaterial('foliage_bright');
  const terracottaMat = getPaletteMaterial('roof_terracotta');
  const whiteCeramicMat = getPaletteMaterial('flag_white');
  const bucketBlueMat = getCustomColorMaterial('#4A90D9', { roughness: 0.55 });
  const towelMat = getPaletteMaterial('wall_cream');
  const windowMat = getCustomColorMaterial(isNight ? '#243054' : '#FFF4D6', { roughness: 0.25 });
  const lampMat = getPaletteMaterial('emissive_warm', { emissiveIntensity: 1.4 });
  const slateMat = getPaletteMaterial('concrete_grey');

  return (
    <group>
      {/* Plint Fondasi Diorama Luar */}
      <mesh position={[0, -0.14, 0]} material={woodDarkMat} receiveShadow>
        <boxGeometry args={[roomW + 0.5, 0.28, roomD + 0.5]} />
      </mesh>
      {/* Lantai Keramik */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} material={floorMat} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
      </mesh>

      {/* Dinding Belakang (-Z) & Kiri (-X) Dua Nada + Balok Kayu Atas */}
      <mesh position={[0, wallHeight / 2, -halfD]} material={wallUpperMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[roomW + 0.3, wallHeight, 0.22]} />
      </mesh>
      <mesh position={[0, 0.55, -halfD + 0.115]} material={wallLowerMat}>
        <boxGeometry args={[roomW, 1.1, 0.02]} />
      </mesh>
      <mesh position={[0, wallHeight + 0.08, -halfD]} material={woodDarkMat}>
        <boxGeometry args={[roomW + 0.36, 0.18, 0.28]} />
      </mesh>

      <mesh position={[-halfW, wallHeight / 2, 0]} material={wallUpperMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.22, wallHeight, roomD]} />
      </mesh>
      <mesh position={[-halfW + 0.115, 0.55, 0]} material={wallLowerMat}>
        <boxGeometry args={[0.02, 1.1, roomD]} />
      </mesh>
      <mesh position={[-halfW, wallHeight + 0.08, 0]} material={woodDarkMat}>
        <boxGeometry args={[0.28, 0.18, roomD + 0.3]} />
      </mesh>

      {/* Dinding Kanan (+X) & Cutaway Depan (+Z) */}
      <mesh position={[halfW, wallHeight / 2, 0]} material={wallUpperMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.22, wallHeight, roomD]} />
      </mesh>
      <mesh position={[0, 0.16, halfD]} material={woodDarkMat} receiveShadow>
        <boxGeometry args={[roomW + 0.3, 0.32, 0.22]} />
      </mesh>

      {/* Jendela Dinding Kiri Bertirai Pastel + 3 Pot Tanaman Mini */}
      <group position={[-halfW + 0.13, 1.68, -0.35]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={woodWarmMat}>
          <boxGeometry args={[2.1, 1.28, 0.08]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={windowMat}>
          <boxGeometry args={[1.86, 1.06, 0.04]} />
        </mesh>
        <mesh position={[0, 0, 0.055]} material={woodWarmMat}>
          <boxGeometry args={[0.06, 1.1, 0.04]} />
        </mesh>
        {/* Batang & Tirai Kiri/Kanan */}
        <mesh position={[0, 0.72, 0.08]} rotation={[0, 0, Math.PI / 2]} material={woodWarmMat}>
          <cylinderGeometry args={[0.025, 0.025, 2.35, 8]} />
        </mesh>
        <mesh position={[-0.86, -0.08, 0.08]} material={curtainMat} castShadow={shadows}>
          <boxGeometry args={[0.38, 1.56, 0.07]} />
        </mesh>
        <mesh position={[0.86, -0.08, 0.08]} material={curtainMat} castShadow={shadows}>
          <boxGeometry args={[0.38, 1.56, 0.07]} />
        </mesh>
        {/* 3 Pot Tanaman di Ambang Jendela */}
        {[-0.45, 0, 0.45].map((px, i) => (
          <group key={i} position={[px, -0.52, 0.1]}>
            <mesh material={terracottaMat}>
              <cylinderGeometry args={[0.07, 0.05, 0.1, 7]} />
            </mesh>
            <mesh position={[0, 0.1, 0]} material={foliageMat}>
              <dodecahedronGeometry args={[0.09, 0]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Lemari Baju Kayu Terbuka di Dinding Belakang (Flush di zona pinggir) */}
      <group position={[-halfW + 1.15, 0, -halfD + 0.42]}>
        <mesh position={[0, 0.06, 0]} material={woodWarmMat} castShadow={shadows}>
          <boxGeometry args={[1.22, 0.12, 0.48]} />
        </mesh>
        <mesh position={[-0.56, 0.92, 0]} material={woodWarmMat} castShadow={shadows}>
          <boxGeometry args={[0.08, 1.72, 0.46]} />
        </mesh>
        <mesh position={[0.56, 0.92, 0]} material={woodWarmMat} castShadow={shadows}>
          <boxGeometry args={[0.08, 1.72, 0.46]} />
        </mesh>
        <mesh position={[0, 1.74, 0]} material={woodWarmMat} castShadow={shadows}>
          <boxGeometry args={[1.22, 0.08, 0.48]} />
        </mesh>
        {/* Baju Gantung */}
        {[-0.3, 0, 0.3].map((hx, idx) => (
          <mesh
            key={hx}
            position={[hx, 1.18, 0]}
            material={getCustomColorMaterial(idx === 0 ? '#F4EFE8' : idx === 1 ? '#4F698F' : '#D6B892')}
          >
            <boxGeometry args={[0.24, 0.62, 0.18]} />
          </mesh>
        ))}
        {/* Tas di Atas Lemari */}
        <mesh position={[0, 1.9, 0]} material={woodDarkMat}>
          <boxGeometry args={[0.38, 0.24, 0.24]} />
        </mesh>
      </group>

      {/* Rak Dinding Mini + Botol & Gelas + Lampu Sudut Plafon */}
      <group position={[0.1, 1.25, -halfD + 0.22]}>
        <mesh material={woodDarkMat}>
          <boxGeometry args={[0.72, 0.06, 0.22]} />
        </mesh>
        <mesh position={[-0.2, 0.16, 0]} material={bucketBlueMat}>
          <cylinderGeometry args={[0.06, 0.06, 0.26, 8]} />
        </mesh>
        <mesh position={[0.14, 0.08, 0]} material={whiteCeramicMat}>
          <cylinderGeometry args={[0.05, 0.04, 0.1, 8]} />
        </mesh>
      </group>
      <group position={[-halfW + 0.45, wallHeight - 0.25, -halfD + 0.45]}>
        <mesh position={[0, 0.18, 0]} material={woodDarkMat}>
          <cylinderGeometry args={[0.03, 0.03, 0.3, 6]} />
        </mesh>
        <mesh material={lampMat}>
          <sphereGeometry args={[0.14, 10, 8]} />
        </mesh>
      </group>

      {hasAc && (
        <mesh position={[0.4, 2.55, -halfD + 0.24]} material={whiteCeramicMat} castShadow={shadows}>
          <boxGeometry args={[1.25, 0.32, 0.24]} />
        </mesh>
      )}

      {/* Kamar Mandi Dalam (Pojok Belakang-Kanan) */}
      <group position={[bathPos.x, 0, bathPos.z]}>
        {/* Sekat & Kusen Pintu Kamar Mandi */}
        <mesh position={[-0.9, 1.35, 0.15]} material={wallUpperMat} castShadow={shadows}>
          <boxGeometry args={[0.12, 2.7, 1.75]} />
        </mesh>
        <mesh position={[-0.86, 1.05, 0.42]} material={woodDarkMat}>
          <boxGeometry args={[0.15, 2.1, 0.08]} />
        </mesh>
        {/* Lantai Basah Keramik Kamar Mandi */}
        <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} material={slateMat}>
          <planeGeometry args={[1.55, 1.55]} />
        </mesh>
        {/* Kloset Duduk Keramik */}
        <mesh position={[0.35, 0.22, -0.32]} material={whiteCeramicMat} castShadow={shadows}>
          <cylinderGeometry args={[0.18, 0.15, 0.4, 10]} />
        </mesh>
        <mesh position={[0.45, 0.56, -0.45]} material={whiteCeramicMat}>
          <boxGeometry args={[0.34, 0.36, 0.2]} />
        </mesh>
        {/* Ember & Gayung Biru Khas Indonesia */}
        <mesh position={[-0.25, 0.18, -0.2]} material={bucketBlueMat} castShadow={shadows}>
          <cylinderGeometry args={[0.18, 0.15, 0.34, 10]} />
        </mesh>
        <mesh position={[-0.25, 0.37, -0.2]} material={whiteCeramicMat}>
          <cylinderGeometry args={[0.09, 0.08, 0.08, 8]} />
        </mesh>
        {/* Rak Handuk & Cermin */}
        <mesh position={[-0.78, 1.35, -0.15]} material={woodWarmMat}>
          <boxGeometry args={[0.08, 0.08, 0.5]} />
        </mesh>
        <mesh position={[-0.74, 1.15, -0.15]} material={towelMat}>
          <boxGeometry args={[0.04, 0.36, 0.34]} />
        </mesh>
      </group>
    </group>
  );
};
