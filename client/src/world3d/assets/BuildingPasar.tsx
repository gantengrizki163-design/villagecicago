import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Diorama_Pasar_Tradisional_Nusantara_Berwarna-warni_463277fd.png

interface BuildingPasarProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  variant?: 'main' | 'grosir';
  scale?: number;
}

/**
 * Pasar Tradisional Cicalengka Low-Poly (Batch 2).
 * Komponen sesuai referensi: lantai paving batu, los utama beratap genteng terakota
 * dan lampu bohlam gantung, deretan lapak kayu dengan tenda warna-warni (biru, merah,
 * kuning, belang), peti buah/sayur, keranjang anyaman, karung beras, dan tiang lampu.
 */
export const BuildingPasar: React.FC<BuildingPasarProps> = ({
  title = 'PASAR CICALENGKA',
  subtitle = 'SEGAR & GROSIR',
  quality,
  isNight,
  variant = 'main',
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const woodMat = getPaletteMaterial('wood_warm');
  const darkWoodMat = getPaletteMaterial('wood_dark');
  const roofMat = getPaletteMaterial(variant === 'grosir' ? 'trim_clinic_green' : 'roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const blueTarp = getPaletteMaterial('tarp_blue');
  const redTarp = getPaletteMaterial('tarp_red');
  const yellowTarp = getPaletteMaterial('tarp_yellow');
  const creamMat = getPaletteMaterial('wall_cream');
  const basketMat = getPaletteMaterial('bamboo_light');
  const greenGoodsMat = getPaletteMaterial('foliage_bright');
  const orangeGoodsMat = getPaletteMaterial('brick_orange');
  const lampMat = getLampMaterial(isNight);

  const stalls: {
    x: number;
    z: number;
    rotY: number;
    tarp: 'blue' | 'red' | 'yellow' | 'stripedRed' | 'stripedBlue';
  }[] =
    variant === 'grosir'
      ? [
          { x: -3.2, z: 2.2, rotY: 0, tarp: 'blue' },
          { x: 3.2, z: 2.2, rotY: 0, tarp: 'yellow' },
        ]
      : [
          { x: -5.0, z: -2.2, rotY: 0.15, tarp: 'blue' },
          { x: 5.0, z: -2.2, rotY: -0.15, tarp: 'red' },
          { x: -4.8, z: 3.8, rotY: 0, tarp: 'stripedRed' },
          { x: 0.0, z: 3.5, rotY: 0, tarp: 'blue' },
          { x: 4.8, z: 3.8, rotY: 0, tarp: 'yellow' },
          { x: 5.2, z: 0.8, rotY: -Math.PI / 2, tarp: 'stripedBlue' },
        ];

  const mainW = variant === 'grosir' ? 11.4 : 15.8;
  const mainD = variant === 'grosir' ? 9.4 : 13.8;

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_pasar" quality={quality} castShadow={shadows}>
        {/* Lantai Paving Pasar */}
        <mesh position={[0, 0.08, 0]} material={pavingMat} receiveShadow>
          <boxGeometry args={[mainW, 0.16, mainD]} />
        </mesh>

        {/* Los Utama Pasar Berkerangka Kayu */}
        <group position={[0, 0.16, variant === 'grosir' ? -1.1 : -2.6]}>
          {[
            [-4.6, -2.5],
            [0, -2.5],
            [4.6, -2.5],
            [-4.6, 2.5],
            [0, 2.5],
            [4.6, 2.5],
          ].map(([px, pz], idx) => (
            <mesh key={idx} position={[px, 1.7, pz]} material={woodMat} castShadow={shadows}>
              <boxGeometry args={[0.24, 3.4, 0.24]} />
            </mesh>
          ))}
          {/* Dinding belakang setengah + meja los tengah */}
          <mesh position={[0, 1.1, -2.5]} material={creamMat} receiveShadow>
            <boxGeometry args={[9.2, 2.2, 0.2]} />
          </mesh>
          <mesh position={[-2.2, 0.5, 0]} material={woodMat} castShadow={shadows}>
            <boxGeometry args={[3.4, 0.9, 1.4]} />
          </mesh>
          <mesh position={[2.2, 0.5, 0]} material={woodMat} castShadow={shadows}>
            <boxGeometry args={[3.4, 0.9, 1.4]} />
          </mesh>
          {/* Atap Pelana Los Utama */}
          <mesh position={[0, 3.9, -1.4]} rotation={[-0.38, 0, 0]} material={roofMat} castShadow={shadows}>
            <boxGeometry args={[10.4, 0.22, 3.6]} />
          </mesh>
          <mesh position={[0, 3.9, 1.4]} rotation={[0.38, 0, 0]} material={roofMat} castShadow={shadows}>
            <boxGeometry args={[10.4, 0.22, 3.6]} />
          </mesh>
          <mesh position={[0, 4.55, 0]} material={roofDarkMat}>
            <boxGeometry args={[10.5, 0.2, 0.35]} />
          </mesh>
          {/* Kanopi Samping Kuning Hangat */}
          <mesh position={[-5.9, 3.05, 0]} rotation={[0, 0, 0.3]} material={yellowTarp} castShadow={shadows}>
            <boxGeometry args={[2.1, 0.12, 5.4]} />
          </mesh>
          {/* Bohlam Gantung di Bawah Atap Los */}
          {[-3.2, 0, 3.2].map((lx, idx) => (
            <mesh key={idx} position={[lx, 2.95, 2.3]} material={lampMat}>
              <sphereGeometry args={[0.16, 6, 6]} />
            </mesh>
          ))}
        </group>

        {/* Deretan Tenda Lapak Warna-Warni */}
        {stalls.map((st, idx) => {
          const primaryTarp =
            st.tarp === 'red' || st.tarp === 'stripedRed'
              ? redTarp
              : st.tarp === 'yellow'
                ? yellowTarp
                : blueTarp;
          const isStriped = st.tarp === 'stripedRed' || st.tarp === 'stripedBlue';

          return (
            <group key={idx} position={[st.x, 0.16, st.z]} rotation={[0, st.rotY, 0]}>
              {/* 4 Tiang Kayu Lapak */}
              {[
                [-1.35, -1.0],
                [1.35, -1.0],
                [-1.35, 1.0],
                [1.35, 1.0],
              ].map(([px, pz], pIdx) => (
                <mesh key={pIdx} position={[px, 1.15, pz]} material={woodMat} castShadow={shadows}>
                  <boxGeometry args={[0.14, 2.3, 0.14]} />
                </mesh>
              ))}
              {/* Meja Dagang & Peti Sayur/Buah */}
              <mesh position={[0, 0.55, -0.15]} material={woodMat} castShadow={shadows} receiveShadow>
                <boxGeometry args={[2.5, 0.72, 1.15]} />
              </mesh>
              <mesh position={[-0.65, 1.02, -0.15]} material={greenGoodsMat}>
                <boxGeometry args={[0.9, 0.28, 0.8]} />
              </mesh>
              <mesh position={[0.65, 1.02, -0.15]} material={orangeGoodsMat}>
                <boxGeometry args={[0.9, 0.28, 0.8]} />
              </mesh>
              {/* Keranjang Anyaman & Karung */}
              <mesh position={[-1.05, 0.34, 0.85]} material={basketMat} castShadow={shadows}>
                <cylinderGeometry args={[0.3, 0.24, 0.65, 7]} />
              </mesh>
              <mesh position={[1.05, 0.32, 0.82]} material={creamMat}>
                <cylinderGeometry args={[0.26, 0.3, 0.6, 7]} />
              </mesh>
              {/* Kanopi Tenda Miring */}
              <mesh position={[0, 2.38, 0]} rotation={[0.16, 0, 0]} material={primaryTarp} castShadow={shadows}>
                <boxGeometry args={[3.15, 0.12, 2.55]} />
              </mesh>
              {isStriped && (
                <>
                  <mesh position={[-0.75, 2.43, 0]} rotation={[0.16, 0, 0]} material={creamMat}>
                    <boxGeometry args={[0.42, 0.08, 2.52]} />
                  </mesh>
                  <mesh position={[0.75, 2.43, 0]} rotation={[0.16, 0, 0]} material={creamMat}>
                    <boxGeometry args={[0.42, 0.08, 2.52]} />
                  </mesh>
                </>
              )}
              {/* Rumbai Depan Tenda */}
              <mesh position={[0, 2.08, 1.24]} material={primaryTarp}>
                <boxGeometry args={[3.1, 0.22, 0.06]} />
              </mesh>
            </group>
          );
        })}

        {/* Tiang Lampu Kayu Sudut Pasar */}
        <group position={[-mainW / 2 + 0.9, 0.16, -mainD / 2 + 1.2]}>
          <mesh position={[0, 2.1, 0]} material={darkWoodMat} castShadow={shadows}>
            <boxGeometry args={[0.18, 4.2, 0.18]} />
          </mesh>
          <mesh position={[0.45, 4.0, 0]} material={darkWoodMat}>
            <boxGeometry args={[0.9, 0.14, 0.14]} />
          </mesh>
          <mesh position={[0.8, 3.72, 0]} material={lampMat}>
            <sphereGeometry args={[0.2, 6, 6]} />
          </mesh>
        </group>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 4.95, variant === 'grosir' ? 4.2 : 5.8]}
        width={4.8}
        height={0.9}
        variant="wood"
        isNight={isNight}
      />
    </group>
  );
};
