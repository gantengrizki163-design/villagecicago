import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Colourful_Mini-Mart_Isometric_Diorama_361aca69.png

interface BuildingMinimarketProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  scale?: number;
}

/**
 * Minimarket Modern Cicalengka Low-Poly (Batch 2).
 * Komponen sesuai referensi: atap datar berparapet abu dengan unit AC, pita fasad 3-warna
 * (merah-putih-biru), kanopi merah depan, etalase kaca penuh menampilkan rak berwarna-warni,
 * tiang pylon papan nama kiri, 3 tempat sampah pilah (merah-kuning-biru), parkiran motor bergaris kuning,
 * serta 2 skuter mini parkir di depan.
 */
export const BuildingMinimarket: React.FC<BuildingMinimarketProps> = ({
  title = 'CICALENGKA MART',
  subtitle = 'BUKA 24 JAM',
  quality,
  isNight,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const wallMat = getPaletteMaterial('wall_cream');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const roofMat = getPaletteMaterial('roof_metal_grey');
  const redMat = getPaletteMaterial('trim_mart_red');
  const blueMat = getPaletteMaterial('trim_mart_blue');
  const whiteMat = getPaletteMaterial('flag_white');
  const yellowMat = getPaletteMaterial('trim_gold');
  const canopyMat = getPaletteMaterial('tarp_red');
  const shelfGreenMat = getPaletteMaterial('foliage_bright');
  const steelMat = getPaletteMaterial('rail_steel');
  const tireMat = getPaletteMaterial('vehicle_tire');
  const windowMat = getWindowMaterial(isNight);

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_minimarket" quality={quality} castShadow={shadows}>
        {/* Pelataran & Area Parkir Depan */}
        <mesh position={[0, 0.1, 0.4]} material={pavingMat} receiveShadow>
          <boxGeometry args={[10.4, 0.2, 8.4]} />
        </mesh>

        {/* Massa Bangunan Utama */}
        <mesh position={[0.2, 1.95, -1.25]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[8.6, 3.5, 4.6]} />
        </mesh>
        {/* Plint Biru Bawah */}
        <mesh position={[0.2, 0.42, -1.25]} material={blueMat}>
          <boxGeometry args={[8.66, 0.44, 4.66]} />
        </mesh>

        {/* Atap Datar + Parapet + Pita 3-Warna (Merah - Putih - Biru) */}
        <mesh position={[0.2, 3.88, -1.25]} material={roofMat} castShadow={shadows}>
          <boxGeometry args={[9.0, 0.36, 5.0]} />
        </mesh>
        <mesh position={[-1.8, 4.28, -1.5]} material={plinthMat}>
          <boxGeometry args={[1.5, 0.55, 1.1]} />
        </mesh>
        <mesh position={[0.2, 3.92, -1.25]} material={redMat}>
          <boxGeometry args={[9.08, 0.24, 5.08]} />
        </mesh>
        <mesh position={[0.2, 3.68, -1.25]} material={whiteMat}>
          <boxGeometry args={[9.08, 0.22, 5.08]} />
        </mesh>
        <mesh position={[0.2, 3.44, -1.25]} material={blueMat}>
          <boxGeometry args={[9.08, 0.24, 5.08]} />
        </mesh>

        {/* Kanopi Depan Merah & Kaca Etalase Penuh */}
        <mesh position={[0.2, 3.05, 1.55]} rotation={[0.14, 0, 0]} material={canopyMat} castShadow={shadows}>
          <boxGeometry args={[8.6, 0.16, 1.45]} />
        </mesh>
        <mesh position={[0.2, 1.65, 1.08]} material={windowMat}>
          <boxGeometry args={[7.4, 2.3, 0.1]} />
        </mesh>
        {/* Pintu Kaca Tengah & Rak Produk Warna-warni Terlihat di Etalase */}
        <mesh position={[0.2, 1.45, 1.12]} material={steelMat}>
          <boxGeometry args={[1.8, 2.1, 0.08]} />
        </mesh>
        {[-2.4, -1.4, 1.8, 2.8].map((rx, idx) => (
          <mesh
            key={idx}
            position={[rx, 1.25, 0.85]}
            material={idx % 3 === 0 ? redMat : idx % 3 === 1 ? yellowMat : shelfGreenMat}
          >
            <boxGeometry args={[0.68, 1.6, 0.35]} />
          </mesh>
        ))}

        {/* Unit AC Outdoor di Dinding Samping Kiri */}
        <mesh position={[-4.28, 2.4, -1.1]} material={whiteMat} castShadow={shadows}>
          <boxGeometry args={[0.38, 0.65, 0.92]} />
        </mesh>

        {/* 3 Tempat Sampah Pilah (Merah - Kuning - Biru) */}
        {[
          { x: -3.5, mat: redMat },
          { x: -2.85, mat: yellowMat },
          { x: -2.2, mat: blueMat },
        ].map((bin, idx) => (
          <mesh key={idx} position={[bin.x, 0.56, 2.0]} material={bin.mat} castShadow={shadows}>
            <boxGeometry args={[0.48, 0.72, 0.48]} />
          </mesh>
        ))}

        {/* Tiang Pylon Sign Kiri */}
        <mesh position={[-4.45, 1.75, 2.6]} material={plinthMat} castShadow={shadows}>
          <boxGeometry args={[0.24, 3.1, 0.24]} />
        </mesh>
        <mesh position={[-4.45, 3.35, 2.6]} material={whiteMat}>
          <boxGeometry args={[1.4, 0.9, 0.28]} />
        </mesh>
        <mesh position={[-4.45, 3.7, 2.6]} material={redMat}>
          <boxGeometry args={[1.42, 0.2, 0.3]} />
        </mesh>
        <mesh position={[-4.45, 3.0, 2.6]} material={blueMat}>
          <boxGeometry args={[1.42, 0.2, 0.3]} />
        </mesh>

        {/* Garis Kuning Parkir Motor & 2 Skuter Mini */}
        {[0.4, 1.8, 3.2].map((lx, idx) => (
          <mesh key={idx} position={[lx, 0.21, 3.15]} rotation={[-Math.PI / 2, 0, 0]} material={yellowMat}>
            <planeGeometry args={[0.14, 2.1]} />
          </mesh>
        ))}
        {[
          { x: 1.1, mat: redMat },
          { x: 2.5, mat: blueMat },
        ].map((moto, idx) => (
          <group key={idx} position={[moto.x, 0.2, 3.05]} rotation={[0, 0.2, 0]}>
            <mesh position={[0, 0.42, 0]} material={moto.mat} castShadow={shadows}>
              <boxGeometry args={[0.42, 0.48, 1.25]} />
            </mesh>
            <mesh position={[0, 0.2, -0.45]} rotation={[0, 0, Math.PI / 2]} material={tireMat}>
              <cylinderGeometry args={[0.2, 0.2, 0.14, 8]} />
            </mesh>
            <mesh position={[0, 0.2, 0.45]} rotation={[0, 0, Math.PI / 2]} material={tireMat}>
              <cylinderGeometry args={[0.2, 0.2, 0.14, 8]} />
            </mesh>
          </group>
        ))}
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0.2, 4.15, 1.38]}
        width={4.6}
        height={0.95}
        variant="mart"
        isNight={isNight}
      />
    </group>
  );
};
