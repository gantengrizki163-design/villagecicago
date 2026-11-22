import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Isometric_Low-Poly_Clinic_and_Ambulance_52129f1f.png

export type ClinicVariant = 'puskesmas' | 'medika';

interface BuildingClinicProps {
  title?: string;
  subtitle?: string;
  variant?: ClinicVariant;
  quality: GraphicsQuality;
  isNight: boolean;
  width?: number;
  depth?: number;
  scale?: number;
}

/**
 * Puskesmas & Klinik Medika Low-Poly (Batch 3).
 * Mengikuti referensi Isometric_Low-Poly_Clinic_and_Ambulance:
 * teras paving bertangga & pegangan besi, atap datar berparapet hijau/biru medis,
 * pedimen tengah dengan palang merah/biru 3D tebal, kanopi pintu masuk bertiang dua,
 * pintu kaca geser, kursi tunggu biru di teras, unit AC luar, pagar taman depan, dan papan palang pojok.
 */
export const BuildingClinic: React.FC<BuildingClinicProps> = ({
  title = 'PUSKESMAS CICALENGKA',
  subtitle = 'LAYANAN MEDIS 24 JAM',
  variant = 'puskesmas',
  quality,
  isNight,
  width = 11.4,
  depth = 7.6,
  scale = 1,
}) => {
  const shadows = quality !== 'low';
  const isMedika = variant === 'medika';

  const pavingMat = getPaletteMaterial('paving_stone');
  const wallMat = getPaletteMaterial('wall_cream');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const trimMat = getPaletteMaterial(isMedika ? 'trim_mart_blue' : 'trim_clinic_green');
  const crossMat = getPaletteMaterial(isMedika ? 'trim_mart_blue' : 'flag_red');
  const frameMat = getPaletteMaterial('concrete_grey');
  const railMat = getPaletteMaterial('rail_steel');
  const chairMat = getPaletteMaterial('trim_mart_blue');
  const potMat = getPaletteMaterial('earth_clay');
  const foliageMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const acMat = getPaletteMaterial('flag_white');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const bodyW = width - 0.6;
  const bodyD = depth - 1.8;
  const bodyZ = -0.55;
  const frontZ = bodyZ + bodyD / 2;

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_clinic" quality={quality} castShadow={shadows}>
        {/* Pelataran Paving & Teras Masuk */}
        <mesh position={[0, 0.1, 0.25]} material={pavingMat} receiveShadow>
          <boxGeometry args={[width + 0.8, 0.2, depth + 0.8]} />
        </mesh>
        <mesh position={[0, 0.28, bodyZ + 0.55]} material={pavingMat} receiveShadow>
          <boxGeometry args={[bodyW + 0.4, 0.18, bodyD + 1.55]} />
        </mesh>

        {/* Tangga Masuk Depan (2 anak tangga + railing) */}
        <mesh position={[0, 0.22, frontZ + 1.15]} material={pavingMat} receiveShadow>
          <boxGeometry args={[3.2, 0.14, 0.55]} />
        </mesh>
        <mesh position={[-1.65, 0.62, frontZ + 0.9]} material={railMat}>
          <boxGeometry args={[0.06, 0.65, 0.06]} />
        </mesh>
        <mesh position={[1.65, 0.62, frontZ + 0.9]} material={railMat}>
          <boxGeometry args={[0.06, 0.65, 0.06]} />
        </mesh>

        {/* Plint Dasar & Dinding Utama Klinik */}
        <mesh position={[0, 0.52, bodyZ]} material={plinthMat} receiveShadow>
          <boxGeometry args={[bodyW + 0.18, 0.34, bodyD + 0.18]} />
        </mesh>
        <mesh position={[0, 2.25, bodyZ]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[bodyW, 3.2, bodyD]} />
        </mesh>

        {/* Lis Parapet Atap Datar Medis & Unit Mekanikal Atap */}
        <mesh position={[0, 3.95, bodyZ]} material={trimMat} castShadow={shadows}>
          <boxGeometry args={[bodyW + 0.55, 0.38, bodyD + 0.55]} />
        </mesh>
        <mesh position={[0, 4.16, bodyZ]} material={pavingMat} receiveShadow>
          <boxGeometry args={[bodyW + 0.1, 0.08, bodyD + 0.1]} />
        </mesh>
        <mesh position={[-1.6, 4.45, bodyZ - 0.5]} material={wallMat} castShadow={shadows}>
          <boxGeometry args={[2.2, 0.55, 1.5]} />
        </mesh>

        {/* Pedimen Papan Palang Tengah di Atap Depan */}
        <mesh position={[0, 4.58, frontZ + 0.18]} material={trimMat} castShadow={shadows}>
          <boxGeometry args={[3.5, 1.35, 0.32]} />
        </mesh>
        <mesh position={[0, 4.58, frontZ + 0.25]} material={wallMat}>
          <boxGeometry args={[2.9, 1.0, 0.24]} />
        </mesh>
        {/* Simbol Palang Merah / Biru 3D Tebal */}
        <mesh position={[0, 4.58, frontZ + 0.42]} material={crossMat}>
          <boxGeometry args={[0.92, 0.3, 0.12]} />
        </mesh>
        <mesh position={[0, 4.58, frontZ + 0.42]} material={crossMat}>
          <boxGeometry args={[0.3, 0.92, 0.12]} />
        </mesh>

        {/* Kanopi Teras Pintu Masuk + 2 Tiang Kotak Hijau/Biru Berumpak */}
        <mesh position={[0, 3.18, frontZ + 0.95]} material={trimMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[4.2, 0.26, 2.05]} />
        </mesh>
        <mesh position={[0, 3.33, frontZ + 0.95]} material={wallMat}>
          <boxGeometry args={[3.8, 0.08, 1.75]} />
        </mesh>
        {[-1.7, 1.7].map((px, idx) => (
          <group key={idx} position={[px, 0.37, frontZ + 1.65]}>
            <mesh position={[0, 0.24, 0]} material={wallMat}>
              <boxGeometry args={[0.48, 0.48, 0.48]} />
            </mesh>
            <mesh position={[0, 1.55, 0]} material={trimMat} castShadow={shadows}>
              <boxGeometry args={[0.36, 2.2, 0.36]} />
            </mesh>
            <mesh position={[0, 1.55, 0.21]} material={lampMat}>
              <boxGeometry args={[0.16, 0.26, 0.08]} />
            </mesh>
          </group>
        ))}

        {/* Pintu Kaca Geser Utama & Jendela Kaca Panjang Kiri-Kanan */}
        <group position={[0, 1.55, frontZ + 0.04]}>
          <mesh material={frameMat}>
            <boxGeometry args={[2.75, 2.35, 0.12]} />
          </mesh>
          <mesh position={[0, 0, 0.04]} material={windowMat}>
            <boxGeometry args={[2.35, 2.05, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.09]} material={frameMat}>
            <boxGeometry args={[0.08, 2.05, 0.05]} />
          </mesh>
        </group>

        {[-bodyW * 0.33, bodyW * 0.33].map((wx, idx) => (
          <group key={idx} position={[wx, 1.85, frontZ + 0.04]}>
            <mesh material={frameMat}>
              <boxGeometry args={[2.35, 1.45, 0.12]} />
            </mesh>
            <mesh position={[0, 0, 0.04]} material={windowMat}>
              <boxGeometry args={[2.05, 1.18, 0.08]} />
            </mesh>
            <mesh position={[0, 0, 0.09]} material={frameMat}>
              <boxGeometry args={[2.05, 0.07, 0.04]} />
            </mesh>
          </group>
        ))}

        {/* Jendela Samping Kanan-Kiri & Unit AC Dinding */}
        {[-bodyW / 2 - 0.04, bodyW / 2 + 0.04].map((sx, idx) => (
          <mesh key={idx} position={[sx, 2.05, bodyZ + 0.2]} material={windowMat}>
            <boxGeometry args={[0.08, 1.2, 1.9]} />
          </mesh>
        ))}
        <group position={[-bodyW / 2 - 0.18, 2.75, bodyZ - 1.1]}>
          <mesh material={acMat} castShadow={shadows}>
            <boxGeometry args={[0.28, 0.52, 0.78]} />
          </mesh>
          <mesh position={[-0.15, 0, 0]} material={railMat}>
            <cylinderGeometry args={[0.17, 0.17, 0.04, 8]} />
          </mesh>
        </group>

        {/* Deretan Kursi Tunggu Biru di Teras Kiri & Pot Tanaman */}
        {[-4.2, -3.5, -2.8].map((cx, idx) => (
          <group key={idx} position={[cx, 0.38, frontZ + 0.55]}>
            <mesh position={[0, 0.28, 0]} material={chairMat}>
              <boxGeometry args={[0.48, 0.1, 0.44]} />
            </mesh>
            <mesh position={[0, 0.52, -0.18]} material={chairMat}>
              <boxGeometry args={[0.48, 0.44, 0.1]} />
            </mesh>
          </group>
        ))}
        {[-2.25, 2.25].map((px, idx) => (
          <group key={idx} position={[px, 0.38, frontZ + 0.45]}>
            <mesh position={[0, 0.24, 0]} material={potMat}>
              <cylinderGeometry args={[0.24, 0.18, 0.48, 6]} />
            </mesh>
            <mesh position={[0, 0.65, 0]} material={foliageMat}>
              <icosahedronGeometry args={[0.36, 0]} />
            </mesh>
          </group>
        ))}

        {/* Pagar Rendah Taman & Papan Palang Medis Pojok Kiri Depan */}
        <group position={[-width * 0.32, 0.2, frontZ + 1.9]}>
          <mesh position={[0, 0.45, 0]} material={wallMat} receiveShadow>
            <boxGeometry args={[2.5, 0.65, 0.24]} />
          </mesh>
          <mesh position={[-1.25, 0.58, 0]} material={trimMat}>
            <boxGeometry args={[0.36, 0.92, 0.36]} />
          </mesh>
          <mesh position={[1.25, 0.58, 0]} material={trimMat}>
            <boxGeometry args={[0.36, 0.92, 0.36]} />
          </mesh>
          {/* Pylon Tanda Palang Medis */}
          <mesh position={[-1.65, 0.72, 0.15]} material={trimMat} castShadow={shadows}>
            <boxGeometry args={[0.95, 1.15, 0.28]} />
          </mesh>
          <mesh position={[-1.65, 0.72, 0.24]} material={wallMat}>
            <boxGeometry args={[0.74, 0.88, 0.16]} />
          </mesh>
          <mesh position={[-1.65, 0.72, 0.34]} material={crossMat}>
            <boxGeometry args={[0.46, 0.16, 0.08]} />
          </mesh>
          <mesh position={[-1.65, 0.72, 0.34]} material={crossMat}>
            <boxGeometry args={[0.16, 0.46, 0.08]} />
          </mesh>
        </group>

        {/* Pagar Besi & Semak Taman Sisi Kanan */}
        <group position={[width * 0.32, 0.2, frontZ + 1.9]}>
          <mesh position={[0, 0.42, 0]} material={railMat}>
            <boxGeometry args={[2.2, 0.1, 0.12]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} material={foliageMat}>
            <icosahedronGeometry args={[0.35, 0]} />
          </mesh>
          <mesh position={[0.7, 0.24, 0]} material={foliageMat}>
            <icosahedronGeometry args={[0.32, 0]} />
          </mesh>
        </group>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 5.75, frontZ + 0.18]}
        width={4.6}
        height={0.85}
        variant={isMedika ? 'mart' : 'clinic'}
        isNight={isNight}
      />
    </group>
  );
};
