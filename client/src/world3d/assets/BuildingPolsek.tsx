import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Low-Poly_Indonesian_Village_Office_Diorama_af653e36.png

const CELL_BAR_OFFSETS = [-3.2, -2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4, 3.2];

interface BuildingPolsekProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  scale?: number;
}

const PoliceSirenBeacon: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  const blueMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const redMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const phase = Math.sin(clock.elapsedTime * 6.5);
    if (blueMatRef.current) {
      blueMatRef.current.emissiveIntensity = phase >= 0 ? (isNight ? 2.4 : 1.3) : 0.15;
    }
    if (redMatRef.current) {
      redMatRef.current.emissiveIntensity = phase < 0 ? (isNight ? 2.4 : 1.3) : 0.15;
    }
  });

  return (
    <group position={[0, 5.2, -2.55]}>
      <mesh position={[-0.36, 0, 0]}>
        <boxGeometry args={[0.62, 0.26, 0.3]} />
        <meshStandardMaterial ref={blueMatRef} color="#1F5FC4" emissive="#3B82F6" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.36, 0, 0]}>
        <boxGeometry args={[0.62, 0.26, 0.3]} />
        <meshStandardMaterial ref={redMatRef} color="#E13630" emissive="#EF4444" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
};

/**
 * Polsek Cicalengka & Ruang Tahanan Low-Poly (Batch 3).
 * Mengikuti tata bangunan dinas berteras & tiang bendera dari referensi kantor desa
 * dengan aksen khaki/coklat-navy kepolisian, lampu sirene atap berkedip,
 * dan sayap sel tahanan berjeruji besi hollow di sisi +Z sesuai koordinat hukum Fase 6.
 */
export const BuildingPolsek: React.FC<BuildingPolsekProps> = ({
  title = 'POLSEK CICALENGKA',
  subtitle = 'LAYANAN KEAMANAN & PATROLI',
  quality,
  isNight,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getPaletteMaterial('wall_cream');
  const khakiMat = getPaletteMaterial('trim_police_khaki');
  const policeDarkMat = getPaletteMaterial('trim_police_dark');
  const blueMat = getPaletteMaterial('trim_bank_blue');
  const goldMat = getPaletteMaterial('trim_gold');
  const woodMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const steelMat = getPaletteMaterial('rail_steel');
  const concreteMat = getPaletteMaterial('concrete_grey');
  const redMat = getPaletteMaterial('flag_red');
  const whiteMat = getPaletteMaterial('flag_white');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_polsek" quality={quality} castShadow={shadows}>
        {/* Pelataran Paving Kompleks Polsek */}
        <mesh position={[0, 0.06, 1.8]} material={pavingMat} receiveShadow>
          <boxGeometry args={[11.6, 0.12, 13.0]} />
        </mesh>

        {/* Plint & Tangga Depan Menghadap -Z (Jalan Alun-Alun Selatan) */}
        <mesh position={[0, 0.28, -0.5]} material={plinthMat} receiveShadow>
          <boxGeometry args={[11.2, 0.44, 4.6]} />
        </mesh>
        <mesh position={[0, 0.2, -3.05]} material={pavingMat} receiveShadow>
          <boxGeometry args={[3.4, 0.2, 0.65]} />
        </mesh>

        {/* Massa Bangunan Utama Polsek (Fasad Depan di -Z) */}
        <mesh position={[0, 2.15, -0.25]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[10.4, 3.35, 3.6]} />
        </mesh>

        {/* 4 Pilar Serambi Depan (-Z) */}
        {[-4.2, -1.6, 1.6, 4.2].map((px, idx) => (
          <group key={idx} position={[px, 0.5, -2.55]}>
            <mesh position={[0, 0.24, 0]} material={plinthMat}>
              <boxGeometry args={[0.46, 0.48, 0.46]} />
            </mesh>
            <mesh position={[0, 1.7, 0]} material={khakiMat} castShadow={shadows}>
              <boxGeometry args={[0.34, 2.55, 0.34]} />
            </mesh>
          </group>
        ))}

        {/* Pintu & Jendela Kantor Polsek Menghadap -Z */}
        <group position={[0, 1.6, -2.07]}>
          <mesh material={policeDarkMat}>
            <boxGeometry args={[1.8, 2.15, 0.12]} />
          </mesh>
          <mesh position={[0, 0.12, -0.04]} material={windowMat}>
            <boxGeometry args={[1.25, 1.35, 0.06]} />
          </mesh>
        </group>
        {[-3.15, 3.15].map((wx, idx) => (
          <group key={idx} position={[wx, 1.95, -2.07]}>
            <mesh material={policeDarkMat}>
              <boxGeometry args={[1.85, 1.25, 0.12]} />
            </mesh>
            <mesh position={[0, 0, -0.04]} material={windowMat}>
              <boxGeometry args={[1.55, 0.98, 0.06]} />
            </mesh>
          </group>
        ))}

        {/* Sabuk Emas & Atap Limasan Kepolisian 2 Tingkat */}
        <mesh position={[0, 3.75, -0.5]} material={goldMat}>
          <boxGeometry args={[11.2, 0.18, 4.8]} />
        </mesh>
        <mesh position={[0, 4.08, -0.5]} material={blueMat} castShadow={shadows}>
          <boxGeometry args={[11.6, 0.48, 5.1]} />
        </mesh>
        <mesh
          position={[0, 4.88, -0.5]}
          rotation={[0, Math.PI / 4, 0]}
          material={policeDarkMat}
          castShadow={shadows}
        >
          <coneGeometry args={[7.2, 1.45, 4]} />
        </mesh>
        <mesh position={[0, 5.58, -0.5]} material={khakiMat}>
          <boxGeometry args={[1.4, 0.22, 1.1]} />
        </mesh>

        {/* Lampu Teras Depan & Sirene Atap */}
        <mesh position={[0, 3.4, -2.35]} material={lampMat}>
          <sphereGeometry args={[0.15, 6, 6]} />
        </mesh>
        <PoliceSirenBeacon isNight={isNight} />

        {/* Tiang Bendera Merah Putih di Sudut Kiri Depan (-Z) */}
        <group position={[-4.95, 0.12, -3.55]}>
          <mesh position={[0, 0.14, 0]} material={plinthMat}>
            <boxGeometry args={[0.85, 0.28, 0.85]} />
          </mesh>
          <mesh position={[0, 2.55, 0]} material={steelMat} castShadow={shadows}>
            <cylinderGeometry args={[0.045, 0.06, 4.4, 6]} />
          </mesh>
          <mesh position={[0, 4.78, 0]} material={goldMat}>
            <sphereGeometry args={[0.1, 6, 6]} />
          </mesh>
          <mesh position={[-0.48, 4.35, 0]} material={redMat}>
            <boxGeometry args={[0.92, 0.3, 0.04]} />
          </mesh>
          <mesh position={[-0.48, 4.05, 0]} material={whiteMat}>
            <boxGeometry args={[0.92, 0.3, 0.04]} />
          </mesh>
        </group>

        {/* Papan Informasi Kepolisian di Sudut Kanan Depan (-Z) */}
        <group position={[4.85, 0.12, -3.55]} rotation={[0, -0.35, 0]}>
          <mesh position={[-0.65, 0.9, 0]} material={woodDarkMat}>
            <boxGeometry args={[0.1, 1.8, 0.1]} />
          </mesh>
          <mesh position={[0.65, 0.9, 0]} material={woodDarkMat}>
            <boxGeometry args={[0.1, 1.8, 0.1]} />
          </mesh>
          <mesh position={[0, 1.1, 0]} material={woodMat}>
            <boxGeometry args={[1.45, 0.85, 0.1]} />
          </mesh>
          <mesh position={[0, 1.1, -0.06]} material={whiteMat}>
            <boxGeometry args={[1.2, 0.6, 0.03]} />
          </mesh>
          <mesh position={[0, 1.72, 0]} material={policeDarkMat}>
            <boxGeometry args={[1.7, 0.2, 0.55]} />
          </mesh>
        </group>

        {/* Sayap Sel Tahanan Hollow (Tetap Mempertahankan Dimensi Ruang Penjara di +Z = 1.7..7.2) */}
        <mesh position={[0, 1.7, 7.2]} material={plinthMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[8.0, 3.4, 0.4]} />
        </mesh>
        <mesh position={[-3.9, 1.7, 4.45]} material={concreteMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[0.36, 3.4, 5.5]} />
        </mesh>
        <mesh position={[3.9, 1.7, 4.45]} material={concreteMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[0.36, 3.4, 5.5]} />
        </mesh>
        {CELL_BAR_OFFSETS.map((bx) => (
          <mesh key={bx} position={[bx, 1.65, 1.7]} material={steelMat} castShadow={shadows}>
            <cylinderGeometry args={[0.055, 0.055, 3.2, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 1.6, 1.7]} material={steelMat}>
          <boxGeometry args={[7.8, 0.12, 0.1]} />
        </mesh>
        <mesh position={[0, 3.52, 4.45]} material={policeDarkMat} castShadow={shadows}>
          <boxGeometry args={[8.4, 0.34, 6.0]} />
        </mesh>
        <mesh position={[2.4, 0.35, 6.2]} material={woodDarkMat}>
          <boxGeometry args={[2.0, 0.5, 1.0]} />
        </mesh>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 4.5, -3.08]}
        rotation={[0, Math.PI, 0]}
        width={4.8}
        height={0.85}
        variant="police"
        isNight={isNight}
      />
      <BuildingSignboard
        title="RUANG TAHANAN"
        position={[0, 4.15, 4.45]}
        width={3.2}
        height={0.62}
        variant="police"
        isNight={isNight}
      />
    </group>
  );
};
