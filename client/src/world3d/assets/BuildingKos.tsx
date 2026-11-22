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

interface BuildingKosProps {
  quality: GraphicsQuality;
  isNight: boolean;
  wallColor?: string;
  units?: 1 | 3;
  hasAc?: boolean;
  scale?: number;
}

const PASTEL_PALETTES = ['#7ECBA1', '#F0958D', '#F2CB6E'] as const;

/**
 * Rumah Kos Pastel Low-Poly (Batch 2).
 * Komponen sesuai referensi: dinding pastel (mint/pink/kuning), atap genteng terakota pelana,
 * sekat teras pendek, pintu panel kayu dengan ventilasi atas, jendela 4 kotak, lampu teras hangat,
 * jemuran baju besi, tong air biru, dan pagar bambu samping.
 */
export const BuildingKos: React.FC<BuildingKosProps> = ({
  quality,
  isNight,
  wallColor,
  units = 1,
  hasAc = false,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const woodMat = getPaletteMaterial('wood_dark');
  const bambooMat = getPaletteMaterial('bamboo_light');
  const blueMat = getPaletteMaterial('tarp_blue');
  const steelMat = getPaletteMaterial('rail_steel');
  const redShirtMat = getPaletteMaterial('tarp_red');
  const yellowShirtMat = getPaletteMaterial('tarp_yellow');
  const foliageMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const whiteMat = getPaletteMaterial('flag_white');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const unitList = units === 3 ? [-3.4, 0, 3.4] : [0];
  const unitW = units === 3 ? 3.4 : 4.8;
  const totalW = unitList.length * unitW;

  const gableGeom = useMemo(() => {
    const shape = new THREE.Shape();
    // x_local = -z_world; y_local = y_world
    shape.moveTo(2.26, 2.75);
    shape.lineTo(-1.26, 2.75);
    shape.lineTo(-1.26, 3.08);
    shape.lineTo(0.15, 3.72);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: totalW - 0.12, bevelEnabled: false });
    geom.translate(0, 0, -(totalW - 0.12) / 2);
    return geom;
  }, [totalW]);

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_kos" quality={quality} castShadow={shadows}>
        {/* Pelataran Teras Berundak */}
        <mesh position={[0, 0.1, 0.15]} material={pavingMat} receiveShadow>
          <boxGeometry args={[totalW + 0.8, 0.2, 5.4]} />
        </mesh>

        {/* Unit-Unit Kos Pastel */}
        {unitList.map((ux, idx) => {
          const wallHex = wallColor && units === 1 ? wallColor : PASTEL_PALETTES[idx % 3];
          const unitWallMat = getCustomColorMaterial(wallHex);
          const halfU = unitW / 2;

          return (
            <group key={idx} position={[ux, 0.2, 0]}>
              {/* Plint & Dinding Pastel */}
              <mesh position={[0, 0.18, -0.5]} material={plinthMat} receiveShadow>
                <boxGeometry args={[unitW, 0.36, 3.7]} />
              </mesh>
              <mesh position={[0, 1.5, -0.5]} material={unitWallMat} castShadow={shadows} receiveShadow>
                <boxGeometry args={[unitW - 0.04, 2.3, 3.6]} />
              </mesh>

              {/* Sekat Teras Pendek Pastel */}
              <mesh position={[-halfU + 0.12, 0.48, 1.85]} material={unitWallMat} castShadow={shadows}>
                <boxGeometry args={[0.18, 0.96, 1.15]} />
              </mesh>
              <mesh position={[halfU * 0.35, 0.48, 2.38]} material={unitWallMat} castShadow={shadows}>
                <boxGeometry args={[unitW * 0.52, 0.96, 0.18]} />
              </mesh>

              {/* Pintu Kayu + Ventilasi & Jendela 4 Kotak */}
              <mesh position={[-unitW * 0.22, 1.1, 1.32]} material={woodMat}>
                <boxGeometry args={[0.92, 2.05, 0.1]} />
              </mesh>
              <mesh position={[unitW * 0.22, 1.4, 1.32]} material={woodMat}>
                <boxGeometry args={[1.15, 1.15, 0.1]} />
              </mesh>
              <mesh position={[unitW * 0.22, 1.4, 1.36]} material={windowMat}>
                <boxGeometry args={[0.92, 0.92, 0.06]} />
              </mesh>

              {/* Lampu Teras Hangat */}
              <mesh position={[0, 2.48, 1.72]} material={lampMat}>
                <coneGeometry args={[0.18, 0.18, 6]} />
              </mesh>

              {/* Jemuran Baju Besi di Teras */}
              <group position={[unitW * 0.24, 0, 1.92]}>
                <mesh position={[0, 0.92, 0]} material={steelMat}>
                  <boxGeometry args={[1.05, 0.05, 0.05]} />
                </mesh>
                <mesh position={[-0.48, 0.46, 0]} material={steelMat}>
                  <boxGeometry args={[0.05, 0.92, 0.05]} />
                </mesh>
                <mesh position={[0.48, 0.46, 0]} material={steelMat}>
                  <boxGeometry args={[0.05, 0.92, 0.05]} />
                </mesh>
                <mesh position={[-0.2, 0.68, 0]} material={idx % 2 === 0 ? blueMat : yellowShirtMat}>
                  <boxGeometry args={[0.32, 0.44, 0.08]} />
                </mesh>
                <mesh position={[0.2, 0.68, 0]} material={redShirtMat}>
                  <boxGeometry args={[0.32, 0.44, 0.08]} />
                </mesh>
              </group>
            </group>
          );
        })}

        {/* Atap Pelana Genteng Terakota Menerus */}
        <mesh
          geometry={gableGeom}
          rotation={[0, Math.PI / 2, 0]}
          material={getPaletteMaterial('wall_cream')}
          castShadow={shadows}
        />
        <mesh position={[0, 3.25, -1.25]} rotation={[-0.44, 0, 0]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[totalW + 0.7, 0.22, 2.75]} />
        </mesh>
        <mesh position={[0, 3.25, 1.05]} rotation={[0.4, 0, 0]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[totalW + 0.7, 0.22, 3.35]} />
        </mesh>
        <mesh position={[0, 3.85, -0.15]} material={roofDarkMat}>
          <boxGeometry args={[totalW + 0.8, 0.18, 0.3]} />
        </mesh>

        {/* Tong Air Biru + Pagar Bambu + Pot Tanaman Samping */}
        <mesh position={[-totalW / 2 - 0.18, 0.62, 1.9]} material={blueMat} castShadow={shadows}>
          <cylinderGeometry args={[0.28, 0.26, 0.82, 8]} />
        </mesh>
        <mesh position={[-totalW / 2 - 0.28, 0.65, 0.5]} material={bambooMat}>
          <boxGeometry args={[0.12, 0.95, 2.2]} />
        </mesh>
        <mesh position={[totalW / 2 + 0.15, 0.52, 2.0]} material={foliageMat}>
          <icosahedronGeometry args={[0.35, 0]} />
        </mesh>

        {/* Unit AC Opsional */}
        {hasAc && (
          <mesh position={[totalW / 2 + 0.12, 2.1, -0.2]} material={whiteMat}>
            <boxGeometry args={[0.28, 0.46, 0.68]} />
          </mesh>
        )}
      </AssetModelLoader>
    </group>
  );
};
