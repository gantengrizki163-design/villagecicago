import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import {
  getCustomColorMaterial,
  getLampMaterial,
  getPaletteMaterial,
  getWindowMaterial,
} from './paletteMaterials';

// Ref: /assets/aistudio/Isometric_Southeast_Asian_Village_House_454e9f0d.png

interface BuildingRumahKampungProps {
  quality: GraphicsQuality;
  isNight: boolean;
  wallColor?: string;
  hasSecondFloor?: boolean;
  withYardProps?: boolean;
  scale?: number;
}

/**
 * Rumah Kampung Tradisional Low-Poly (Batch 2).
 * Komponen sesuai referensi: atap limasan/joglo genteng terakota, dinding krem berplint abu-abu,
 * teras kayu beranak tangga & bangku santai, lampu lampion bulat hangat, jendela krepyak kayu,
 * pagar bambu, kandang ayam bambu, gentong tanah liat, dan pohon pisang.
 */
export const BuildingRumahKampung: React.FC<BuildingRumahKampungProps> = ({
  quality,
  isNight,
  wallColor = '#F5EBD8',
  hasSecondFloor = false,
  withYardProps = true,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const yardMat = getPaletteMaterial('earth_yard');
  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getCustomColorMaterial(wallColor);
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const woodMat = getPaletteMaterial('wood_warm');
  const darkWoodMat = getPaletteMaterial('wood_dark');
  const bambooMat = getPaletteMaterial('bamboo_light');
  const clayMat = getPaletteMaterial('earth_clay');
  const palmMat = getPaletteMaterial('foliage_palm', { flatShading: true });
  const redMat = getPaletteMaterial('tarp_red');
  const blueMat = getPaletteMaterial('tarp_blue');
  const canopyGreyMat = getPaletteMaterial('roof_metal_grey');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const wallH = hasSecondFloor ? 4.4 : 2.55;

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_rumah_kampung" quality={quality} castShadow={shadows}>
        {/* Halaman Tanah Kampung */}
        <mesh position={[0, 0.04, 0]} material={yardMat} receiveShadow>
          <boxGeometry args={[8.0, 0.08, 8.0]} />
        </mesh>

        {/* Plint Batu & Teras Depan Beranak Tangga */}
        <mesh position={[0, 0.34, -0.3]} material={plinthMat} receiveShadow>
          <boxGeometry args={[5.4, 0.56, 5.2]} />
        </mesh>
        <mesh position={[0, 0.64, 1.55]} material={woodMat} receiveShadow>
          <boxGeometry args={[5.2, 0.1, 1.5]} />
        </mesh>
        <mesh position={[0, 0.24, 2.5]} material={pavingMat} receiveShadow>
          <boxGeometry args={[1.65, 0.32, 0.68]} />
        </mesh>

        {/* Dinding Utama Rumah */}
        <mesh position={[0, 0.62 + wallH / 2, -0.9]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[5.1, wallH, 3.8]} />
        </mesh>

        {/* Tiang Kayu Teras & Bangku Kayu */}
        {[-2.4, -0.9, 0.9, 2.4].map((px, idx) => (
          <mesh key={idx} position={[px, 1.85, 2.2]} material={woodMat} castShadow={shadows}>
            <boxGeometry args={[0.2, 2.4, 0.2]} />
          </mesh>
        ))}
        <mesh position={[-1.65, 1.0, 2.2]} material={woodMat}>
          <boxGeometry args={[1.4, 0.65, 0.14]} />
        </mesh>
        <mesh position={[1.65, 0.9, 1.7]} material={woodMat} castShadow={shadows}>
          <boxGeometry args={[1.45, 0.45, 0.55]} />
        </mesh>

        {/* Pintu Kayu & Jendela Krepyak */}
        <mesh position={[0, 1.68, 1.04]} material={darkWoodMat}>
          <boxGeometry args={[1.05, 2.1, 0.12]} />
        </mesh>
        {[-1.65, 1.65].map((wx, idx) => (
          <group key={idx} position={[wx, 1.75, 1.04]}>
            <mesh material={darkWoodMat}>
              <boxGeometry args={[1.1, 1.15, 0.12]} />
            </mesh>
            <mesh position={[0, 0, 0.05]} material={windowMat}>
              <boxGeometry args={[0.82, 0.88, 0.06]} />
            </mesh>
          </group>
        ))}
        {/* Jendela Samping Kiri Terbuka ke Atas */}
        <mesh position={[-2.62, 1.95, -0.9]} rotation={[0, 0, 0.45]} material={darkWoodMat}>
          <boxGeometry args={[0.75, 0.95, 1.1]} />
        </mesh>

        {/* Atap Limasan / Joglo Terakota */}
        <mesh
          position={[0, wallH + 1.55, -0.25]}
          rotation={[0, Math.PI / 4, 0]}
          material={roofMat}
          castShadow={shadows}
        >
          <coneGeometry args={[4.6, 2.1, 4]} />
        </mesh>
        <mesh position={[0, wallH + 2.6, -0.25]} material={roofDarkMat}>
          <boxGeometry args={[0.35, 0.25, 0.35]} />
        </mesh>

        {/* Lampion Bulat Hangat di Teras */}
        <mesh position={[0.75, 2.55, 2.05]} material={lampMat}>
          <sphereGeometry args={[0.2, 8, 8]} />
        </mesh>

        {withYardProps && (
          <>
            {/* Pagar Bambu Depan & Samping */}
            <mesh position={[-2.4, 0.55, 3.85]} material={bambooMat}>
              <boxGeometry args={[3.0, 0.85, 0.14]} />
            </mesh>
            <mesh position={[2.4, 0.55, 3.85]} material={bambooMat}>
              <boxGeometry args={[3.0, 0.85, 0.14]} />
            </mesh>
            <mesh position={[-3.9, 0.55, 0.4]} material={bambooMat}>
              <boxGeometry args={[0.14, 0.85, 6.8]} />
            </mesh>
            <mesh position={[3.9, 0.55, 0.4]} material={bambooMat}>
              <boxGeometry args={[0.14, 0.85, 6.8]} />
            </mesh>

            {/* Kandang Ayam Bambu + Ayam Kampung Low-Poly (Kiri) */}
            <group position={[-3.05, 0.08, 1.9]}>
              <mesh position={[0, 0.82, 0]} material={bambooMat} castShadow={shadows}>
                <boxGeometry args={[1.25, 0.85, 1.05]} />
              </mesh>
              <mesh position={[0, 1.4, 0]} rotation={[0.15, 0, 0]} material={canopyGreyMat} castShadow={shadows}>
                <boxGeometry args={[1.45, 0.12, 1.25]} />
              </mesh>
            </group>
            <mesh position={[-2.1, 0.32, 3.05]} material={roofMat}>
              <boxGeometry args={[0.32, 0.32, 0.42]} />
            </mesh>

            {/* Gentong Tanah Liat, Jemuran Handuk & Pohon Pisang (Kanan) */}
            <mesh position={[3.05, 0.42, 2.3]} material={clayMat} castShadow={shadows}>
              <cylinderGeometry args={[0.28, 0.24, 0.65, 8]} />
            </mesh>
            <group position={[3.15, 0.08, 1.2]}>
              <mesh position={[0, 1.15, 0]} material={bambooMat}>
                <boxGeometry args={[0.06, 0.06, 1.3]} />
              </mesh>
              <mesh position={[0, 0.85, -0.25]} material={blueMat}>
                <boxGeometry args={[0.08, 0.52, 0.36]} />
              </mesh>
              <mesh position={[0, 0.85, 0.25]} material={redMat}>
                <boxGeometry args={[0.08, 0.52, 0.36]} />
              </mesh>
            </group>
            <group position={[3.25, 0.08, -2.8]}>
              <mesh position={[0, 1.1, 0]} material={woodMat}>
                <cylinderGeometry args={[0.12, 0.18, 2.2, 6]} />
              </mesh>
              <mesh position={[0, 2.35, 0]} material={palmMat} castShadow={shadows}>
                <coneGeometry args={[1.3, 0.9, 6]} />
              </mesh>
            </group>
          </>
        )}
      </AssetModelLoader>
    </group>
  );
};
