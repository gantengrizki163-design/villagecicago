import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Warung_Hangat_dengan_Meja_Makan_2c4e7c05.png

interface BuildingWarungProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  scale?: number;
}

/**
 * Warung Makan Indonesia Low-Poly (Batch 2).
 * Komponen sesuai referensi: teras ubin hangat, rangka kayu terbuka, atap pelana terakota
 * dan kanopi seng miring, spanduk kain krem bergaris merah, etalase kaca miring berisi lauk,
 * ceret & rice cooker, kulkas minuman biru, meja kayu dengan bangku plastik merah & biru,
 * lampu gantung hangat, serta tempat sampah hijau.
 */
export const BuildingWarung: React.FC<BuildingWarungProps> = ({
  title = 'WARUNG TEH NENG',
  subtitle = 'MAKANAN & MINUMAN',
  quality,
  isNight,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const woodMat = getPaletteMaterial('wood_warm');
  const darkWoodMat = getPaletteMaterial('wood_dark');
  const creamMat = getPaletteMaterial('wall_cream');
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const canopyMat = getPaletteMaterial('roof_metal_grey');
  const blueMat = getPaletteMaterial('tarp_blue');
  const redMat = getPaletteMaterial('tarp_red');
  const yellowMat = getPaletteMaterial('tarp_yellow');
  const greenMat = getPaletteMaterial('trim_clinic_green');
  const bambooMat = getPaletteMaterial('bamboo_light');
  const foliageMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const steelMat = getPaletteMaterial('rail_steel');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_warung" quality={quality} castShadow={shadows}>
        {/* Pondasi Teras Ubin */}
        <mesh position={[0, 0.12, 0]} material={pavingMat} receiveShadow>
          <boxGeometry args={[8.4, 0.24, 6.8]} />
        </mesh>

        {/* Dinding Belakang & Samping Kanan Kayu Hangat */}
        <mesh position={[0, 1.75, -2.5]} material={creamMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[7.4, 3.0, 0.26]} />
        </mesh>
        <mesh position={[3.6, 1.55, -0.7]} material={woodMat} castShadow={shadows}>
          <boxGeometry args={[0.24, 2.7, 3.6]} />
        </mesh>
        {/* Jendela Samping Kanan 4 Kotak */}
        <mesh position={[3.74, 1.75, -0.7]} material={windowMat}>
          <boxGeometry args={[0.08, 1.0, 1.1]} />
        </mesh>
        {/* Pagar Bambu Sisi Kiri */}
        <mesh position={[-3.6, 0.85, -0.4]} material={bambooMat} castShadow={shadows}>
          <boxGeometry args={[0.16, 1.2, 4.0]} />
        </mesh>

        {/* Tiang Kayu Penyangga Terbuka */}
        {[
          [-3.55, -2.4],
          [3.55, -2.4],
          [-3.55, 0.5],
          [3.55, 0.5],
          [-3.55, 2.55],
          [2.0, 2.55],
        ].map(([px, pz], idx) => (
          <mesh key={idx} position={[px, 1.65, pz]} material={woodMat} castShadow={shadows}>
            <boxGeometry args={[0.22, 2.95, 0.22]} />
          </mesh>
        ))}

        {/* Atap Pelana Genteng Terakota + Atap Samping Kecil */}
        <mesh position={[0, 3.65, -1.6]} rotation={[-0.42, 0, 0]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[8.2, 0.24, 3.2]} />
        </mesh>
        <mesh position={[0, 3.65, 0.7]} rotation={[0.42, 0, 0]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[8.2, 0.24, 2.6]} />
        </mesh>
        <mesh position={[0, 4.28, -0.45]} material={roofDarkMat}>
          <boxGeometry args={[8.3, 0.2, 0.32]} />
        </mesh>
        {/* Kanopi Seng Miring Depan */}
        <mesh position={[-0.4, 2.85, 2.1]} rotation={[0.22, 0, 0]} material={canopyMat} castShadow={shadows}>
          <boxGeometry args={[7.1, 0.14, 2.2]} />
        </mesh>

        {/* Spanduk Kain Krem Bergaris Merah */}
        <mesh position={[-0.95, 2.35, 2.55]} material={creamMat}>
          <boxGeometry args={[3.9, 0.82, 0.06]} />
        </mesh>
        <mesh position={[-0.95, 2.02, 2.57]} material={redMat}>
          <boxGeometry args={[3.9, 0.16, 0.07]} />
        </mesh>

        {/* Meja Counter Kayu & Etalase Kaca Lauk */}
        <mesh position={[-0.3, 0.72, -0.85]} material={woodMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[4.4, 0.96, 1.15]} />
        </mesh>
        {/* Etalase Kaca Sisi Kiri Counter */}
        <mesh position={[-1.4, 1.56, -0.85]} material={windowMat}>
          <boxGeometry args={[1.9, 0.74, 0.85]} />
        </mesh>
        <mesh position={[-1.4, 1.42, -0.85]} material={yellowMat}>
          <boxGeometry args={[1.65, 0.24, 0.62]} />
        </mesh>
        {/* Ceret & Rice Cooker di Counter */}
        <mesh position={[0.45, 1.38, -0.85]} material={steelMat}>
          <cylinderGeometry args={[0.22, 0.28, 0.34, 8]} />
        </mesh>
        <mesh position={[1.2, 1.38, -0.85]} material={creamMat}>
          <cylinderGeometry args={[0.24, 0.24, 0.32, 8]} />
        </mesh>

        {/* Kulkas Minuman Biru di Sisi Kanan */}
        <mesh position={[2.85, 1.28, -1.35]} material={blueMat} castShadow={shadows}>
          <boxGeometry args={[1.05, 2.1, 0.95]} />
        </mesh>
        <mesh position={[2.85, 1.35, -0.85]} material={windowMat}>
          <boxGeometry args={[0.82, 1.55, 0.06]} />
        </mesh>

        {/* Lampu Gantung Hangat di Atas Counter */}
        <mesh position={[0.4, 2.48, -0.35]} material={darkWoodMat}>
          <coneGeometry args={[0.26, 0.18, 8]} />
        </mesh>
        <mesh position={[0.4, 2.36, -0.35]} material={lampMat}>
          <sphereGeometry args={[0.15, 6, 6]} />
        </mesh>

        {/* 2 Meja Makan Kayu + Bangku Plastik Merah & Biru */}
        {[-1.7, 1.25].map((mx, mIdx) => (
          <group key={mIdx} position={[mx, 0.24, 1.55]}>
            <mesh position={[0, 0.68, 0]} material={woodMat} castShadow={shadows}>
              <boxGeometry args={[2.1, 0.12, 1.05]} />
            </mesh>
            {[
              [-0.85, -0.38],
              [0.85, -0.38],
              [-0.85, 0.38],
              [0.85, 0.38],
            ].map(([lx, lz], idx) => (
              <mesh key={idx} position={[lx, 0.34, lz]} material={woodMat}>
                <boxGeometry args={[0.12, 0.68, 0.12]} />
              </mesh>
            ))}
            {/* Bangku Plastik Merah & Biru */}
            <mesh position={[-0.55, 0.24, 0.78]} material={mIdx === 0 ? redMat : blueMat}>
              <boxGeometry args={[0.44, 0.48, 0.44]} />
            </mesh>
            <mesh position={[0.55, 0.24, 0.78]} material={mIdx === 0 ? blueMat : redMat}>
              <boxGeometry args={[0.44, 0.48, 0.44]} />
            </mesh>
          </group>
        ))}

        {/* Pot Tanaman Kiri & Tong Sampah Hijau Kanan */}
        <mesh position={[-3.35, 0.5, 2.55]} material={roofDarkMat}>
          <cylinderGeometry args={[0.3, 0.22, 0.52, 7]} />
        </mesh>
        <mesh position={[-3.35, 0.98, 2.55]} material={foliageMat}>
          <icosahedronGeometry args={[0.45, 0]} />
        </mesh>
        <mesh position={[3.65, 0.6, 1.8]} material={greenMat} castShadow={shadows}>
          <boxGeometry args={[0.52, 0.72, 0.52]} />
        </mesh>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0.4, 3.85, 2.75]}
        width={4.2}
        height={0.85}
        variant="wood"
        isNight={isNight}
      />
    </group>
  );
};
