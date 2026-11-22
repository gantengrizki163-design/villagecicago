import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard, type SignboardVariant } from './BuildingSignboard';
import {
  getCustomColorMaterial,
  getLampMaterial,
  getPaletteMaterial,
  getWindowMaterial,
  type PaletteToken,
} from './paletteMaterials';

// Ref: /assets/aistudio/Diorama_Kota_Indonesia_dengan_Stasiun_Kereta_53a7c2cc.png

interface BuildingRukoProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  wallColor?: string;
  awningToken?: 'tarp_blue' | 'tarp_red' | 'tarp_yellow' | 'trim_clinic_green';
  roofToken?: PaletteToken;
  signVariant?: SignboardVariant;
  hasAc?: boolean;
  width?: number;
  depth?: number;
  scale?: number;
}

/**
 * Ruko Niaga 2 Lantai Low-Poly (Batch 2).
 * Mengikuti deretan ruko pada diorama kota referensi: teras paving trotoar,
 * lantai dasar etalase kaca/rolling door berkanopi belang warna cerah,
 * lantai 2 berpilar & berjendela krem/pastel, serta atap pelana genteng terakota.
 */
export const BuildingRuko: React.FC<BuildingRukoProps> = ({
  title,
  subtitle,
  quality,
  isNight,
  wallColor = '#F5EBD8',
  awningToken = 'tarp_blue',
  roofToken = 'roof_terracotta',
  signVariant = 'modern',
  hasAc = false,
  width = 7.2,
  depth = 6.8,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getCustomColorMaterial(wallColor);
  const roofMat = getPaletteMaterial(roofToken);
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const awningMat = getPaletteMaterial(awningToken);
  const stripeWhiteMat = getPaletteMaterial('flag_white');
  const shutterMat = getPaletteMaterial('roof_metal_grey');
  const woodMat = getPaletteMaterial('wood_dark');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const halfW = width / 2;
  const halfD = depth / 2;

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_ruko" quality={quality} castShadow={shadows}>
        {/* Pelataran Trotoar */}
        <mesh position={[0, 0.1, 0.25]} material={pavingMat} receiveShadow>
          <boxGeometry args={[width + 0.8, 0.2, depth + 1.4]} />
        </mesh>

        {/* Plint Bawah & Massa Utama 2 Lantai */}
        <mesh position={[0, 0.35, -0.15]} material={plinthMat} receiveShadow>
          <boxGeometry args={[width + 0.16, 0.32, depth - 0.3]} />
        </mesh>
        <mesh position={[0, 3.25, -0.15]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[width, 5.5, depth - 0.5]} />
        </mesh>

        {/* Pilar Samping Lantai 1 & 2 */}
        {[-halfW + 0.22, halfW - 0.22].map((px, idx) => (
          <mesh key={idx} position={[px, 3.25, halfD - 0.38]} material={plinthMat} castShadow={shadows}>
            <boxGeometry args={[0.38, 5.5, 0.28]} />
          </mesh>
        ))}

        {/* Etalase Kaca & Pintu Rolling Door Lantai 1 */}
        <mesh position={[-width * 0.18, 1.45, halfD - 0.36]} material={windowMat}>
          <boxGeometry args={[width * 0.42, 2.0, 0.1]} />
        </mesh>
        <mesh position={[width * 0.22, 1.38, halfD - 0.36]} material={shutterMat}>
          <boxGeometry args={[width * 0.28, 2.15, 0.12]} />
        </mesh>

        {/* Kanopi Kain Belang Lantai 1 */}
        <mesh
          position={[0, 2.82, halfD + 0.28]}
          rotation={[0.25, 0, 0]}
          material={awningMat}
          castShadow={shadows}
        >
          <boxGeometry args={[width - 0.2, 0.14, 1.45]} />
        </mesh>
        {[-width * 0.28, 0, width * 0.28].map((sx, idx) => (
          <mesh key={idx} position={[sx, 2.85, halfD + 0.28]} rotation={[0.25, 0, 0]} material={stripeWhiteMat}>
            <boxGeometry args={[0.42, 0.15, 1.44]} />
          </mesh>
        ))}

        {/* Balkon & Jendela Lantai 2 */}
        <mesh position={[0, 3.35, halfD - 0.12]} material={plinthMat}>
          <boxGeometry args={[width - 0.8, 0.2, 0.65]} />
        </mesh>
        {[-width * 0.24, width * 0.24].map((wx, idx) => (
          <group key={idx} position={[wx, 4.45, halfD - 0.36]}>
            <mesh material={woodMat}>
              <boxGeometry args={[1.35, 1.35, 0.1]} />
            </mesh>
            <mesh position={[0, 0, 0.04]} material={windowMat}>
              <boxGeometry args={[1.06, 1.06, 0.06]} />
            </mesh>
          </group>
        ))}

        {/* Lampu Teras Bawah Kanopi */}
        <mesh position={[0, 2.55, halfD + 0.15]} material={lampMat}>
          <sphereGeometry args={[0.14, 6, 6]} />
        </mesh>

        {/* Atap Limasan / Pelana Genteng Terakota */}
        <mesh position={[0, 6.22, -0.15]} material={roofDarkMat}>
          <boxGeometry args={[width + 0.5, 0.28, depth - 0.1]} />
        </mesh>
        <mesh
          position={[0, 6.85, -0.15]}
          rotation={[0, Math.PI / 4, 0]}
          material={roofMat}
          castShadow={shadows}
        >
          <coneGeometry args={[Math.max(width, depth) * 0.72, 1.45, 4]} />
        </mesh>

        {hasAc && (
          <mesh position={[halfW + 0.16, 4.3, -0.2]} material={stripeWhiteMat}>
            <boxGeometry args={[0.28, 0.48, 0.72]} />
          </mesh>
        )}
      </AssetModelLoader>

      {title && (
        <BuildingSignboard
          title={title}
          subtitle={subtitle}
          position={[0, 3.65, halfD - 0.02]}
          width={Math.min(4.8, width * 0.75)}
          height={0.82}
          variant={signVariant}
          isNight={isNight}
        />
      )}
    </group>
  );
};
