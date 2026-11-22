import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Stasiun_Kereta_Kolonial_Isometrik_83aa5a14.png

interface BuildingStationProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  accentRoofToken?: 'roof_terracotta' | 'roof_industrial_blue' | 'trim_clinic_green' | 'tarp_yellow';
  scale?: number;
}

/**
 * Stasiun Kereta Kolonial Low-Poly (Batch 1).
 * Komponen unik sesuai referensi: plint batu, dinding krem berpilaster, atap pelana & limasan terakota,
 * jam bulat stasiun di pediment tengah, kusen & krepyak hijau tua, kanopi peron seng abu,
 * lampu gantung hangat, bangku kayu, dan garis kuning tepi peron.
 */
export const BuildingStation: React.FC<BuildingStationProps> = ({
  title = 'STASIUN CICALENGKA',
  subtitle = '+689m · DAOP 2',
  quality,
  isNight,
  accentRoofToken = 'roof_terracotta',
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const wallMat = getPaletteMaterial('wall_cream');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const platformMat = getPaletteMaterial('paving_stone');
  const yellowLineMat = getPaletteMaterial('trim_gold');
  const roofMat = getPaletteMaterial(accentRoofToken);
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const canopyMat = getPaletteMaterial('roof_metal_grey');
  const colonialGreenMat = getPaletteMaterial('trim_colonial_green');
  const woodMat = getPaletteMaterial('wood_warm');
  const potMat = getPaletteMaterial('earth_clay');
  const foliageMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const clockFaceMat = getPaletteMaterial('flag_white');
  const clockHandMat = getPaletteMaterial('rail_steel');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const gableGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2.7, 0);
    shape.lineTo(2.7, 0);
    shape.lineTo(0, 1.85);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 5.4, bevelEnabled: false });
    geom.center();
    return geom;
  }, []);

  const windowPositionsX = [-7.6, -5.0, -2.0, 2.0, 5.0, 7.6];
  const pillarPositionsX = [-9.6, -4.8, 0, 4.8, 9.6];

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_station" quality={quality} castShadow={shadows}>
        {/* Peron Batu & Garis Kuning Keselamatan */}
        <mesh position={[0, 0.3, 1.4]} material={platformMat} receiveShadow>
          <boxGeometry args={[28, 0.6, 7.6]} />
        </mesh>
        <mesh position={[0, 0.61, -2.2]} material={yellowLineMat}>
          <boxGeometry args={[27.8, 0.03, 0.22]} />
        </mesh>

        {/* Plint Dasar Bangunan */}
        <mesh position={[0, 0.85, 2.7]} material={plinthMat} receiveShadow>
          <boxGeometry args={[20.6, 0.5, 5.4]} />
        </mesh>

        {/* Massa Utama Bangunan (Sayap Kiri & Kanan + Tengah Lebih Tinggi) */}
        <mesh position={[0, 2.7, 2.7]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[20.0, 3.3, 5.0]} />
        </mesh>
        <mesh position={[0, 3.3, 2.7]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[5.4, 4.1, 5.25]} />
        </mesh>

        {/* Paviliun Samping Kiri & Kanan */}
        <mesh position={[-11.8, 2.0, 2.8]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[3.6, 2.8, 4.2]} />
        </mesh>
        <mesh position={[11.8, 2.0, 2.8]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[3.6, 2.8, 4.2]} />
        </mesh>

        {/* Atap Limasan Sayap & Paviliun */}
        <mesh position={[-6.4, 5.05, 2.7]} rotation={[0, Math.PI / 4, 0]} material={roofMat} castShadow={shadows}>
          <coneGeometry args={[5.8, 1.85, 4]} />
        </mesh>
        <mesh position={[6.4, 5.05, 2.7]} rotation={[0, Math.PI / 4, 0]} material={roofMat} castShadow={shadows}>
          <coneGeometry args={[5.8, 1.85, 4]} />
        </mesh>
        <mesh position={[-11.8, 4.05, 2.8]} rotation={[0, Math.PI / 4, 0]} material={roofMat} castShadow={shadows}>
          <coneGeometry args={[3.2, 1.4, 4]} />
        </mesh>
        <mesh position={[11.8, 4.05, 2.8]} rotation={[0, Math.PI / 4, 0]} material={roofMat} castShadow={shadows}>
          <coneGeometry args={[3.2, 1.4, 4]} />
        </mesh>

        {/* Pedimen Tengah + Atap Pelana & Jam Stasiun */}
        <mesh position={[0, 5.3, 2.7]} geometry={gableGeometry} material={wallMat} castShadow={shadows} />
        <mesh position={[-1.4, 5.55, 2.7]} rotation={[0, 0, 0.59]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[3.4, 0.22, 5.8]} />
        </mesh>
        <mesh position={[1.4, 5.55, 2.7]} rotation={[0, 0, -0.59]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[3.4, 0.22, 5.8]} />
        </mesh>
        <mesh position={[0, 6.32, 2.7]} material={roofDarkMat}>
          <boxGeometry args={[0.35, 0.2, 5.9]} />
        </mesh>

        {/* Jam Bulat Stasiun (Sisi Peron z = 0.05 & Sisi Kota z = 5.38) */}
        {[0.02, 5.38].map((zClock, idx) => (
          <group key={idx} position={[0, 5.25, zClock]} rotation={[0, idx === 0 ? Math.PI : 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={colonialGreenMat}>
              <cylinderGeometry args={[0.58, 0.58, 0.14, 16]} />
            </mesh>
            <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]} material={clockFaceMat}>
              <cylinderGeometry args={[0.46, 0.46, 0.06, 16]} />
            </mesh>
            <mesh position={[0, 0.12, 0.1]} material={clockHandMat}>
              <boxGeometry args={[0.05, 0.28, 0.03]} />
            </mesh>
            <mesh position={[0.1, 0, 0.1]} material={clockHandMat}>
              <boxGeometry args={[0.22, 0.05, 0.03]} />
            </mesh>
          </group>
        ))}

        {/* Jendela Kusen & Daun Krepyak Hijau Kolonial (Menghadap Peron & Kota) */}
        {windowPositionsX.map((wx) => (
          <React.Fragment key={wx}>
            <group position={[wx, 2.75, 0.16]}>
              <mesh material={colonialGreenMat}>
                <boxGeometry args={[1.55, 1.65, 0.14]} />
              </mesh>
              <mesh position={[0, 0, -0.04]} material={windowMat}>
                <boxGeometry args={[1.05, 1.25, 0.08]} />
              </mesh>
            </group>
            <group position={[wx, 2.75, 5.24]}>
              <mesh material={colonialGreenMat}>
                <boxGeometry args={[1.55, 1.65, 0.14]} />
              </mesh>
              <mesh position={[0, 0, 0.04]} material={windowMat}>
                <boxGeometry args={[1.05, 1.25, 0.08]} />
              </mesh>
            </group>
          </React.Fragment>
        ))}

        {/* Pintu Utama Stasiun Hijau Kolonial */}
        {[0.14, 5.26].map((zDoor, idx) => (
          <group key={idx} position={[0, 1.75, zDoor]}>
            <mesh material={colonialGreenMat}>
              <boxGeometry args={[2.2, 2.3, 0.16]} />
            </mesh>
            <mesh position={[0, 0.4, idx === 0 ? -0.05 : 0.05]} material={windowMat}>
              <boxGeometry args={[1.5, 0.85, 0.08]} />
            </mesh>
          </group>
        ))}

        {/* Kanopi Peron Seng Abu + Tiang Besi Kolonial + Lampu Gantung */}
        <mesh position={[0, 3.65, -0.85]} rotation={[-0.12, 0, 0]} material={canopyMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[23.2, 0.22, 3.6]} />
        </mesh>
        {pillarPositionsX.map((px) => (
          <group key={px} position={[px, 0.6, -2.0]}>
            <mesh position={[0, 0.25, 0]} material={plinthMat}>
              <boxGeometry args={[0.38, 0.5, 0.38]} />
            </mesh>
            <mesh position={[0, 1.65, 0]} material={colonialGreenMat} castShadow={shadows}>
              <cylinderGeometry args={[0.1, 0.13, 2.6, 6]} />
            </mesh>
            {/* Lampu Gantung Peron */}
            <mesh position={[0, 2.75, 0.55]} material={lampMat}>
              <coneGeometry args={[0.22, 0.2, 8]} />
            </mesh>
          </group>
        ))}

        {/* Bangku Kayu & Pot Tanaman di Peron */}
        {[-7.2, -2.4, 2.4, 7.2].map((bx) => (
          <group key={bx} position={[bx, 0.6, -0.75]}>
            <mesh position={[0, 0.42, 0]} material={woodMat} castShadow={shadows}>
              <boxGeometry args={[1.9, 0.12, 0.55]} />
            </mesh>
            <mesh position={[0, 0.72, 0.22]} material={woodMat}>
              <boxGeometry args={[1.9, 0.45, 0.1]} />
            </mesh>
            <mesh position={[-0.75, 0.21, 0]} material={colonialGreenMat}>
              <boxGeometry args={[0.12, 0.42, 0.48]} />
            </mesh>
            <mesh position={[0.75, 0.21, 0]} material={colonialGreenMat}>
              <boxGeometry args={[0.12, 0.42, 0.48]} />
            </mesh>
          </group>
        ))}

        {[-10.6, 10.6].map((px) => (
          <group key={px} position={[px, 0.6, -1.2]}>
            <mesh position={[0, 0.28, 0]} material={potMat}>
              <cylinderGeometry args={[0.32, 0.24, 0.56, 7]} />
            </mesh>
            <mesh position={[0, 0.85, 0]} material={foliageMat}>
              <icosahedronGeometry args={[0.48, 0]} />
            </mesh>
          </group>
        ))}
      </AssetModelLoader>

      {/* Papan Nama Terpisah (Dapat Diubah Dinamis) */}
      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 4.15, -2.62]}
        rotation={[0, Math.PI, 0]}
        width={5.6}
        height={0.95}
        variant="colonial"
        isNight={isNight}
      />
      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 4.15, 5.42]}
        width={5.6}
        height={0.95}
        variant="colonial"
        isNight={isNight}
      />
    </group>
  );
};
