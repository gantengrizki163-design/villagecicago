import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import {
  getCustomColorMaterial,
  getLampMaterial,
  getPaletteMaterial,
  getWindowMaterial,
} from './paletteMaterials';

// Ref: /assets/aistudio/Isometric_Pastel_Boarding_House_Row_6c3d8d56.png

interface BuildingKontrakanProps {
  quality: GraphicsQuality;
  isNight: boolean;
  wallColor?: string;
  hasAc?: boolean;
  hasSecondFloor?: boolean;
  scale?: number;
}

/**
 * Rumah Kontrakan Asri Low-Poly (Batch 2).
 * Mengacu pada deretan hunian pastel di referensi: pondasi paving berundak,
 * dinding pastel hangat, sekat teras berplint abu-abu, atap pelana genteng terakota,
 * pintu kayu & jendela 4 kotak, lampu teras hangat, jemuran baju, dan tong air biru.
 */
export const BuildingKontrakan: React.FC<BuildingKontrakanProps> = ({
  quality,
  isNight,
  wallColor = '#F2CB6E',
  hasAc = false,
  hasSecondFloor = false,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getCustomColorMaterial(wallColor);
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const woodMat = getPaletteMaterial('wood_dark');
  const warmWoodMat = getPaletteMaterial('wood_warm');
  const bambooMat = getPaletteMaterial('bamboo_light');
  const blueMat = getPaletteMaterial('tarp_blue');
  const steelMat = getPaletteMaterial('rail_steel');
  const yellowShirtMat = getPaletteMaterial('tarp_yellow');
  const redShirtMat = getPaletteMaterial('tarp_red');
  const foliageMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const whiteMat = getPaletteMaterial('flag_white');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const wallH = hasSecondFloor ? 4.4 : 2.55;

  const gableGeom = useMemo(() => {
    const shape = new THREE.Shape();
    // x_local = -z_world; y_local = y_world
    shape.moveTo(2.54, wallH + 0.5);
    shape.lineTo(-1.64, wallH + 0.5);
    shape.lineTo(-1.64, wallH + 0.96);
    shape.lineTo(-0.05, wallH + 1.62);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 5.56, bevelEnabled: false });
    geom.translate(0, 0, -5.56 / 2);
    return geom;
  }, [wallH]);

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_kontrakan" quality={quality} castShadow={shadows}>
        {/* Pelataran Teras Berundak */}
        <mesh position={[0, 0.1, 0.2]} material={pavingMat} receiveShadow>
          <boxGeometry args={[6.6, 0.2, 6.4]} />
        </mesh>
        <mesh position={[-1.0, 0.14, 3.2]} material={pavingMat}>
          <boxGeometry args={[1.6, 0.14, 0.6]} />
        </mesh>

        {/* Plint Abu & Dinding Utama */}
        <mesh position={[0, 0.36, -0.45]} material={plinthMat} receiveShadow>
          <boxGeometry args={[5.8, 0.36, 4.4]} />
        </mesh>
        <mesh position={[0, 0.54 + wallH / 2, -0.45]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[5.6, wallH, 4.25]} />
        </mesh>

        {/* Tiang Teras Kayu & Sekat Dinding Pendek */}
        <mesh position={[-2.65, 1.65, 2.7]} material={warmWoodMat} castShadow={shadows}>
          <boxGeometry args={[0.2, 2.9, 0.2]} />
        </mesh>
        <mesh position={[2.65, 1.65, 2.7]} material={warmWoodMat} castShadow={shadows}>
          <boxGeometry args={[0.2, 2.9, 0.2]} />
        </mesh>
        <mesh position={[1.15, 0.65, 2.85]} material={wallMat} castShadow={shadows}>
          <boxGeometry args={[2.9, 0.9, 0.2]} />
        </mesh>
        <mesh position={[-2.75, 0.65, 2.2]} material={wallMat} castShadow={shadows}>
          <boxGeometry args={[0.2, 0.9, 1.4]} />
        </mesh>

        {/* Pintu Kayu Panel + Jendela 4 Kotak */}
        <mesh position={[-1.25, 1.25, 1.7]} material={woodMat}>
          <boxGeometry args={[1.05, 2.1, 0.12]} />
        </mesh>
        <mesh position={[1.15, 1.55, 1.7]} material={woodMat}>
          <boxGeometry args={[1.45, 1.25, 0.12]} />
        </mesh>
        <mesh position={[1.15, 1.55, 1.75]} material={windowMat}>
          <boxGeometry args={[1.18, 1.0, 0.06]} />
        </mesh>
        {hasSecondFloor && (
          <mesh position={[0, 3.65, 1.72]} material={windowMat}>
            <boxGeometry args={[2.2, 1.05, 0.1]} />
          </mesh>
        )}

        {/* Atap Pelana Genteng Terakota */}
        <mesh
          geometry={gableGeom}
          rotation={[0, Math.PI / 2, 0]}
          material={wallMat}
          castShadow={shadows}
        />
        <mesh position={[0, wallH + 1.15, -1.2]} rotation={[-0.42, 0, 0]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[6.4, 0.24, 3.3]} />
        </mesh>
        <mesh position={[0, wallH + 1.15, 1.3]} rotation={[0.38, 0, 0]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[6.4, 0.24, 3.6]} />
        </mesh>
        <mesh position={[0, wallH + 1.75, 0.05]} material={roofDarkMat}>
          <boxGeometry args={[6.5, 0.2, 0.32]} />
        </mesh>

        {/* Lampu Teras Hangat */}
        <mesh position={[-0.1, 2.55, 2.15]} material={lampMat}>
          <coneGeometry args={[0.2, 0.18, 6]} />
        </mesh>

        {/* Jemuran Baju di Teras Kanan */}
        <group position={[1.45, 0.2, 2.25]}>
          <mesh position={[0, 0.92, 0]} material={steelMat}>
            <boxGeometry args={[1.2, 0.05, 0.05]} />
          </mesh>
          <mesh position={[-0.55, 0.46, 0]} material={steelMat}>
            <boxGeometry args={[0.05, 0.92, 0.05]} />
          </mesh>
          <mesh position={[0.55, 0.46, 0]} material={steelMat}>
            <boxGeometry args={[0.05, 0.92, 0.05]} />
          </mesh>
          <mesh position={[-0.22, 0.68, 0]} material={yellowShirtMat}>
            <boxGeometry args={[0.34, 0.46, 0.08]} />
          </mesh>
          <mesh position={[0.22, 0.68, 0]} material={redShirtMat}>
            <boxGeometry args={[0.34, 0.46, 0.08]} />
          </mesh>
        </group>

        {/* Tong Air Biru, Pagar Bambu & Pot Tanaman */}
        <mesh position={[-2.95, 0.62, 2.3]} material={blueMat} castShadow={shadows}>
          <cylinderGeometry args={[0.28, 0.26, 0.84, 8]} />
        </mesh>
        <mesh position={[3.05, 0.65, 0.2]} material={bambooMat}>
          <boxGeometry args={[0.14, 0.95, 3.4]} />
        </mesh>
        <mesh position={[-0.2, 0.55, 2.1]} material={foliageMat}>
          <icosahedronGeometry args={[0.35, 0]} />
        </mesh>

        {hasAc && (
          <mesh position={[2.95, 2.25, -0.3]} material={whiteMat}>
            <boxGeometry args={[0.28, 0.48, 0.7]} />
          </mesh>
        )}
      </AssetModelLoader>
    </group>
  );
};
