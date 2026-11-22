import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Isometric_Low-Poly_Clinic_and_Ambulance_52129f1f.png

interface BuildingBankProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  scale?: number;
}

/**
 * Bank Priangan Cicalengka & Bilik ATM Terintegrasi (Batch 3).
 * Menggunakan bahasa bentuk paviliun layanan modern 1 lantai dari referensi klinik
 * dengan fasad krem berplint batu, lis biru korporat & emas, 4 pilar teras berkanopi,
 * dinding kaca lebar, tangga masuk, serta bilik ATM 24 jam menyala di sayap kanan teras.
 */
export const BuildingBank: React.FC<BuildingBankProps> = ({
  title = 'BANK PRIANGAN CICALENGKA',
  subtitle = 'TABUNGAN · KPR · ATM 24 JAM',
  quality,
  isNight,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const wallMat = getPaletteMaterial('wall_cream');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const blueMat = getPaletteMaterial('trim_bank_blue');
  const accentBlueMat = getPaletteMaterial('trim_mart_blue');
  const goldMat = getPaletteMaterial('trim_gold');
  const railMat = getPaletteMaterial('rail_steel');
  const screenMat = getPaletteMaterial('emissive_warm', {
    emissive: '#38BDF8',
    emissiveIntensity: isNight ? 1.8 : 1.0,
  });
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_bank" quality={quality} castShadow={shadows}>
        {/* Pelataran & Tangga Masuk */}
        <mesh position={[0, 0.12, 0.2]} material={pavingMat} receiveShadow>
          <boxGeometry args={[12.2, 0.24, 9.4]} />
        </mesh>
        <mesh position={[0, 0.3, 0.0]} material={pavingMat} receiveShadow>
          <boxGeometry args={[11.2, 0.18, 8.2]} />
        </mesh>
        <mesh position={[-0.4, 0.24, 4.35]} material={pavingMat} receiveShadow>
          <boxGeometry args={[3.6, 0.14, 0.55]} />
        </mesh>
        {[-2.25, 1.45].map((rx, idx) => (
          <mesh key={idx} position={[rx, 0.65, 4.15]} material={railMat}>
            <boxGeometry args={[0.07, 0.68, 0.07]} />
          </mesh>
        ))}

        {/* Plint Dasar & Massa Utama Bank */}
        <mesh position={[0, 0.58, -0.45]} material={plinthMat} receiveShadow>
          <boxGeometry args={[10.4, 0.4, 6.6]} />
        </mesh>
        <mesh position={[0, 2.55, -0.45]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[10.0, 3.6, 6.2]} />
        </mesh>

        {/* Parapet Atap Biru Korporat + Sabuk Emas */}
        <mesh position={[0, 4.45, -0.45]} material={goldMat}>
          <boxGeometry args={[10.4, 0.18, 6.6]} />
        </mesh>
        <mesh position={[0, 4.78, -0.45]} material={blueMat} castShadow={shadows}>
          <boxGeometry args={[10.8, 0.52, 7.0]} />
        </mesh>
        <mesh position={[0, 5.06, -0.45]} material={pavingMat}>
          <boxGeometry args={[10.1, 0.08, 6.3]} />
        </mesh>

        {/* Pedimen Tengah Logo Koin / Brankas Bank */}
        <mesh position={[0, 5.38, 2.8]} material={blueMat} castShadow={shadows}>
          <boxGeometry args={[3.4, 1.1, 0.34]} />
        </mesh>
        <mesh position={[0, 5.38, 2.98]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
          <cylinderGeometry args={[0.38, 0.38, 0.12, 12]} />
        </mesh>

        {/* Kanopi Portiko + 4 Pilar Modern Beralas Plint */}
        <mesh position={[0, 3.68, 3.35]} material={blueMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[8.8, 0.28, 1.9]} />
        </mesh>
        <mesh position={[0, 3.52, 3.35]} material={goldMat}>
          <boxGeometry args={[8.6, 0.08, 1.75]} />
        </mesh>
        {[-3.6, -1.5, 1.5, 3.6].map((px, idx) => (
          <group key={idx} position={[px, 0.39, 3.95]}>
            <mesh position={[0, 0.26, 0]} material={plinthMat}>
              <boxGeometry args={[0.56, 0.52, 0.56]} />
            </mesh>
            <mesh position={[0, 1.8, 0]} material={wallMat} castShadow={shadows}>
              <cylinderGeometry args={[0.2, 0.24, 2.75, 8]} />
            </mesh>
            <mesh position={[0, 1.85, 0.24]} material={lampMat}>
              <boxGeometry args={[0.14, 0.24, 0.06]} />
            </mesh>
          </group>
        ))}

        {/* Etalase Kaca Perbankan & Pintu Ganda */}
        <group position={[-0.2, 1.85, 2.68]}>
          <mesh material={blueMat}>
            <boxGeometry args={[6.4, 2.55, 0.14]} />
          </mesh>
          <mesh position={[0, 0, 0.04]} material={windowMat}>
            <boxGeometry args={[5.95, 2.25, 0.08]} />
          </mesh>
          <mesh position={[-1.1, 0, 0.09]} material={blueMat}>
            <boxGeometry args={[0.08, 2.25, 0.05]} />
          </mesh>
          <mesh position={[1.1, 0, 0.09]} material={blueMat}>
            <boxGeometry args={[0.08, 2.25, 0.05]} />
          </mesh>
        </group>

        {/* Bilik ATM 24 Jam Terintegrasi di Sayap Kanan Teras */}
        <group position={[4.25, 0.39, 3.35]}>
          <mesh position={[0, 1.1, -0.05]} material={blueMat} castShadow={shadows}>
            <boxGeometry args={[1.3, 2.2, 1.05]} />
          </mesh>
          <mesh position={[0, 2.32, 0.08]} material={accentBlueMat} castShadow={shadows}>
            <boxGeometry args={[1.55, 0.26, 1.35]} />
          </mesh>
          <mesh position={[0, 1.35, 0.49]} material={screenMat}>
            <boxGeometry args={[0.68, 0.48, 0.05]} />
          </mesh>
          <mesh position={[0, 0.9, 0.54]} rotation={[-0.35, 0, 0]} material={railMat}>
            <boxGeometry args={[0.65, 0.18, 0.22]} />
          </mesh>
        </group>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 6.45, 2.9]}
        width={5.4}
        height={0.9}
        variant="bank"
        isNight={isNight}
      />
    </group>
  );
};
