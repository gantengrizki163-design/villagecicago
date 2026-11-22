import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Isometric_Indonesian_Schoolyard_Diorama_b21c613b.png

interface BuildingSekolahProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  compact?: boolean;
  scale?: number;
}

/**
 * Sekolah Dasar & Balai Kursus Low-Poly (Batch 3).
 * Mengikuti referensi Isometric_Indonesian_Schoolyard_Diorama:
 * massa bangunan huruf L dengan dinding atas krem & bawah merah bata SD, atap pelana genteng terakota,
 * teras koridor berkolom merah, tiang bendera Merah Putih di tengah lapangan upacara berpola garis putih,
 * pagar sekolah krem-merah dengan gerbang beratap genteng, papan informasi, serta area bermain ayunan & perosotan.
 */
export const BuildingSekolah: React.FC<BuildingSekolahProps> = ({
  title = 'SDN & BALAI KURSUS',
  subtitle = 'PENDIDIKAN & PELATIHAN',
  quality,
  isNight,
  compact = false,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const wallMat = getPaletteMaterial('wall_cream');
  const redWallMat = getPaletteMaterial('wall_school_red');
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const woodMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const lineMat = getPaletteMaterial('road_marking');
  const poleMat = getPaletteMaterial('rail_steel');
  const redMat = getPaletteMaterial('flag_red');
  const whiteMat = getPaletteMaterial('flag_white');
  const goldMat = getPaletteMaterial('trim_gold');
  const blueMat = getPaletteMaterial('trim_mart_blue');
  const bushMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const totalW = compact ? 12.6 : 15.6;
  const totalD = compact ? 8.6 : 12.6;
  const wingZ = compact ? -2.15 : -3.55;
  const wingD = compact ? 3.5 : 4.3;
  const sideWingLen = compact ? 3.8 : 5.4;

  return (
    <group scale={scale}>
      <AssetModelLoader
        assetId="building_sekolah"
        quality={quality}
        castShadow={shadows}
        overrideFootprint={{ width: totalW, depth: totalD, height: 5.5 }}
      >
        {/* Pelataran Upacara Sekolah */}
        <mesh position={[0, 0.08, 0]} material={pavingMat} receiveShadow>
          <boxGeometry args={[totalW, 0.16, totalD]} />
        </mesh>

        {/* Garis Lapangan Upacara Putih */}
        <mesh position={[0.4, 0.17, 1.0]} material={lineMat}>
          <boxGeometry args={[totalW * 0.45, 0.02, 0.08]} />
        </mesh>
        <mesh position={[0.4, 0.17, 1.0 + (compact ? 1.4 : 2.1)]} material={lineMat}>
          <boxGeometry args={[totalW * 0.45, 0.02, 0.08]} />
        </mesh>

        {/* Sayap Utama Kelas Belakang (Membujur Barat-Timur) */}
        <group position={[0.4, 0.16, wingZ]}>
          <mesh position={[0, 0.2, 0]} material={plinthMat} receiveShadow>
            <boxGeometry args={[totalW - 1.4, 0.4, wingD + 0.8]} />
          </mesh>
          {/* Dinding Bawah Merah Bata SD + Atas Krem */}
          <mesh position={[0, 0.82, 0]} material={redWallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[totalW - 1.8, 0.9, wingD - 0.4]} />
          </mesh>
          <mesh position={[0, 2.15, 0]} material={wallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[totalW - 1.8, 1.8, wingD - 0.4]} />
          </mesh>
          {/* Atap Pelana Terakota */}
          <mesh
            position={[0, 3.52, -wingD * 0.25]}
            rotation={[-0.4, 0, 0]}
            material={roofMat}
            castShadow={shadows}
          >
            <boxGeometry args={[totalW - 1.0, 0.2, wingD * 0.68]} />
          </mesh>
          <mesh
            position={[0, 3.52, wingD * 0.25]}
            rotation={[0.4, 0, 0]}
            material={roofMat}
            castShadow={shadows}
          >
            <boxGeometry args={[totalW - 1.0, 0.2, wingD * 0.72]} />
          </mesh>
          <mesh position={[0, 4.05, 0]} material={roofDarkMat}>
            <boxGeometry args={[totalW - 0.95, 0.18, 0.3]} />
          </mesh>

          {/* Kolom Koridor Merah & Pintu/Jendela Kelas */}
          {[-4.2, -1.4, 1.4, 4.2].map((cx, idx) => (
            <mesh key={idx} position={[cx, 1.65, wingD / 2 + 0.18]} material={redWallMat} castShadow={shadows}>
              <boxGeometry args={[0.24, 2.55, 0.24]} />
            </mesh>
          ))}
          {[-3.2, 0, 3.2].map((dx, idx) => (
            <mesh key={idx} position={[dx, 1.45, wingD / 2 - 0.18]} material={woodDarkMat}>
              <boxGeometry args={[0.95, 2.0, 0.1]} />
            </mesh>
          ))}
          {[-1.7, 1.7].map((wx, idx) => (
            <mesh key={idx} position={[wx, 1.9, wingD / 2 - 0.18]} material={windowMat}>
              <boxGeometry args={[1.4, 1.05, 0.1]} />
            </mesh>
          ))}
          <mesh position={[0, 2.95, wingD / 2 + 0.1]} material={lampMat}>
            <sphereGeometry args={[0.14, 6, 6]} />
          </mesh>
        </group>

        {/* Sayap L Kiri Sekolah */}
        <group position={[-totalW / 2 + 1.95, 0.16, wingZ + wingD / 2 + sideWingLen / 2 - 0.4]}>
          <mesh position={[0, 0.82, 0]} material={redWallMat} castShadow={shadows}>
            <boxGeometry args={[2.7, 0.9, sideWingLen]} />
          </mesh>
          <mesh position={[0, 2.15, 0]} material={wallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[2.7, 1.8, sideWingLen]} />
          </mesh>
          <mesh position={[-0.78, 3.45, 0]} rotation={[0, 0, 0.42]} material={roofMat} castShadow={shadows}>
            <boxGeometry args={[1.85, 0.2, sideWingLen + 0.5]} />
          </mesh>
          <mesh position={[0.78, 3.45, 0]} rotation={[0, 0, -0.42]} material={roofMat} castShadow={shadows}>
            <boxGeometry args={[1.85, 0.2, sideWingLen + 0.5]} />
          </mesh>
          <mesh position={[1.38, 1.9, 0]} material={windowMat}>
            <boxGeometry args={[0.1, 1.05, sideWingLen * 0.55]} />
          </mesh>
        </group>

        {/* Tiang Bendera Merah Putih di Tengah Halaman Upacara */}
        <group position={[0.4, 0.16, 0.85]}>
          <mesh position={[0, 0.14, 0]} material={plinthMat}>
            <boxGeometry args={[0.92, 0.28, 0.92]} />
          </mesh>
          <mesh position={[0, 0.34, 0]} material={plinthMat}>
            <boxGeometry args={[0.56, 0.16, 0.56]} />
          </mesh>
          <mesh position={[0, 2.65, 0]} material={poleMat} castShadow={shadows}>
            <cylinderGeometry args={[0.045, 0.06, 4.5, 6]} />
          </mesh>
          <mesh position={[0, 4.92, 0]} material={goldMat}>
            <sphereGeometry args={[0.1, 6, 6]} />
          </mesh>
          <mesh position={[0.5, 4.48, 0]} material={redMat}>
            <boxGeometry args={[0.92, 0.3, 0.04]} />
          </mesh>
          <mesh position={[0.5, 4.18, 0]} material={whiteMat}>
            <boxGeometry args={[0.92, 0.3, 0.04]} />
          </mesh>
        </group>

        {/* Area Bermain: Perosotan Kuning & Ayunan Biru di Depan Kiri */}
        <group position={[-totalW * 0.27, 0.16, totalD * 0.22]}>
          {/* Perosotan */}
          <mesh position={[-0.75, 0.65, 0]} material={blueMat} castShadow={shadows}>
            <boxGeometry args={[0.75, 1.3, 0.75]} />
          </mesh>
          <mesh position={[-0.75, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} material={redWallMat}>
            <coneGeometry args={[0.68, 0.6, 4]} />
          </mesh>
          <mesh position={[0.1, 0.55, 0]} rotation={[0, 0, -0.58]} material={goldMat} castShadow={shadows}>
            <boxGeometry args={[1.35, 0.12, 0.48]} />
          </mesh>
          {/* Ayunan Biru */}
          <group position={[1.7, 0, 0]}>
            <mesh position={[-0.68, 0.9, 0]} material={blueMat}>
              <boxGeometry args={[0.1, 1.8, 0.1]} />
            </mesh>
            <mesh position={[0.68, 0.9, 0]} material={blueMat}>
              <boxGeometry args={[0.1, 1.8, 0.1]} />
            </mesh>
            <mesh position={[0, 1.78, 0]} material={blueMat}>
              <boxGeometry args={[1.5, 0.1, 0.1]} />
            </mesh>
            <mesh position={[-0.3, 0.55, 0]} material={goldMat}>
              <boxGeometry args={[0.32, 0.08, 0.22]} />
            </mesh>
            <mesh position={[0.3, 0.55, 0]} material={goldMat}>
              <boxGeometry args={[0.32, 0.08, 0.22]} />
            </mesh>
          </group>
        </group>

        {/* Pagar Depan Merah-Krem + Gerbang Beratap Genteng + Papan Informasi */}
        {[-totalW * 0.31, totalW * 0.31].map((fx, idx) => (
          <group key={idx} position={[fx, 0.16, totalD / 2 - 0.2]}>
            <mesh position={[0, 0.4, 0]} material={redWallMat}>
              <boxGeometry args={[totalW * 0.32, 0.78, 0.2]} />
            </mesh>
            <mesh position={[-totalW * 0.16, 0.52, 0]} material={wallMat}>
              <boxGeometry args={[0.34, 1.04, 0.34]} />
            </mesh>
            <mesh position={[totalW * 0.16, 0.52, 0]} material={wallMat}>
              <boxGeometry args={[0.34, 1.04, 0.34]} />
            </mesh>
          </group>
        ))}

        {/* Gerbang Utama Beratap Genteng */}
        <group position={[0.4, 0.16, totalD / 2 - 0.2]}>
          <mesh position={[-1.35, 1.15, 0]} material={wallMat} castShadow={shadows}>
            <boxGeometry args={[0.42, 2.3, 0.42]} />
          </mesh>
          <mesh position={[1.35, 1.15, 0]} material={wallMat} castShadow={shadows}>
            <boxGeometry args={[0.42, 2.3, 0.42]} />
          </mesh>
          <mesh position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]} material={roofMat} castShadow={shadows}>
            <coneGeometry args={[2.35, 0.95, 4]} />
          </mesh>
        </group>

        {/* Papan Pengumuman Sekolah & Semak Taman */}
        <group position={[totalW * 0.35, 0.16, totalD * 0.22]}>
          <mesh position={[0, 0.95, 0]} material={woodMat}>
            <boxGeometry args={[1.3, 0.8, 0.1]} />
          </mesh>
          <mesh position={[0, 0.95, 0.06]} material={whiteMat}>
            <boxGeometry args={[1.05, 0.55, 0.03]} />
          </mesh>
          <mesh position={[0, 1.52, 0]} material={roofMat}>
            <boxGeometry args={[1.55, 0.18, 0.48]} />
          </mesh>
        </group>
        <mesh position={[-totalW * 0.16, 0.45, totalD / 2 - 0.65]} material={bushMat}>
          <icosahedronGeometry args={[0.38, 0]} />
        </mesh>
        <mesh position={[totalW * 0.22, 0.45, totalD / 2 - 0.65]} material={bushMat}>
          <icosahedronGeometry args={[0.38, 0]} />
        </mesh>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0.4, 3.65, totalD / 2 - 0.05]}
        width={compact ? 4.4 : 5.2}
        height={0.84}
        variant="wood"
        isNight={isNight}
      />
    </group>
  );
};
