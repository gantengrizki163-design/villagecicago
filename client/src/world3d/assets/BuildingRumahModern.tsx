import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Modern_Indonesian_House_with_Garden_and_Carport_afec1f1a.png

interface BuildingRumahModernProps {
  quality: GraphicsQuality;
  isNight: boolean;
  wallColor?: string;
  width?: number;
  depth?: number;
  hasAc?: boolean;
  hasCarport?: boolean;
  hasFence?: boolean;
  variant?: 'rumah' | 'apartemen';
  scale?: number;
}

/**
 * Rumah 2 Lantai Modern & Apartemen Studio Low-Poly (Batch 3).
 * Mengikuti referensi Modern_Indonesian_House_with_Garden_and_Carport:
 * massa 2 lantai berkulit krem/custom dengan kolom aksen batu alam abu,
 * atap limasan genteng terakota + plat dak beton, balkon lantai 2 dengan pagar besi gelap,
 * panel kisi kayu vertikal hangat, unit kondensor AC di sisi samping,
 * carport kanopi abu gelap (beserta siluet mobil modern opsional), serta lampu dinding hangat.
 */
export const BuildingRumahModern: React.FC<BuildingRumahModernProps> = ({
  quality,
  isNight,
  wallColor = '#F5EBD8',
  width = 8,
  depth = 8,
  hasAc = true,
  hasCarport = true,
  hasFence = false,
  variant = 'rumah',
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const wallMat = getCustomColorMaterial(wallColor);
  const stoneMat = getPaletteMaterial('wall_plinth_grey');
  const concreteMat = getPaletteMaterial('concrete_grey');
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const ironMat = getPaletteMaterial('rail_steel');
  const woodMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const whiteMat = getPaletteMaterial('flag_white');
  const potMat = getPaletteMaterial('earth_clay');
  const foliageMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const tireMat = getPaletteMaterial('vehicle_tire');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const isCompact = width <= 6.5;
  const bodyW = width * 0.72;
  const bodyD = depth * 0.68;
  const bodyX = hasCarport && !isCompact ? -width * 0.11 : 0;
  const bodyZ = -depth * 0.08;
  const frontZ = bodyZ + bodyD / 2;
  const carportX = width * 0.28;
  const carportW = width * 0.34;

  return (
    <group scale={scale}>
      <AssetModelLoader
        assetId="building_rumah_modern"
        quality={quality}
        castShadow={shadows}
        overrideFootprint={{ width: width + 0.6, depth: depth + 0.6, height: 6.8 }}
      >
        {/* Pelataran Paving Halaman */}
        <mesh position={[0, 0.1, 0]} material={pavingMat} receiveShadow>
          <boxGeometry args={[width + 0.8, 0.2, depth + 0.8]} />
        </mesh>

        {/* Plint Dasar & Tangga Depan */}
        <mesh position={[bodyX, 0.32, bodyZ]} material={stoneMat} receiveShadow>
          <boxGeometry args={[bodyW + 0.24, 0.28, bodyD + 0.24]} />
        </mesh>
        <mesh position={[bodyX + bodyW * 0.2, 0.25, frontZ + 0.38]} material={pavingMat}>
          <boxGeometry args={[1.45, 0.16, 0.6]} />
        </mesh>

        {/* Lantai 1 & Lantai 2 Massa Utama */}
        <mesh position={[bodyX, 1.65, bodyZ]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[bodyW, 2.45, bodyD]} />
        </mesh>
        <mesh position={[bodyX, 2.95, bodyZ + 0.12]} material={concreteMat}>
          <boxGeometry args={[bodyW + 0.35, 0.18, bodyD + 0.45]} />
        </mesh>
        <mesh position={[bodyX, 4.15, bodyZ - 0.15]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[bodyW, 2.25, bodyD - 0.3]} />
        </mesh>

        {/* Kolom Aksen Batu Alam Sudut Kiri */}
        <mesh position={[bodyX - bodyW / 2 + 0.24, 1.65, frontZ + 0.04]} material={stoneMat}>
          <boxGeometry args={[0.56, 2.45, 0.16]} />
        </mesh>

        {/* Panel Kisi Kayu Vertikal Lantai 2 di Kanan */}
        <mesh position={[bodyX + bodyW * 0.32, 4.15, frontZ - 0.12]} material={woodMat}>
          <boxGeometry args={[bodyW * 0.26, 2.05, 0.14]} />
        </mesh>

        {/* Balkon Lantai 2 & Pagar Besi Gelap */}
        <group position={[bodyX - bodyW * 0.12, 3.04, frontZ + 0.32]}>
          <mesh position={[0, 0, 0]} material={wallMat} castShadow={shadows}>
            <boxGeometry args={[bodyW * 0.66, 0.22, 0.85]} />
          </mesh>
          <mesh position={[0, 0.48, 0.38]} material={ironMat}>
            <boxGeometry args={[bodyW * 0.64, 0.08, 0.06]} />
          </mesh>
          <mesh position={[0, 0.28, 0.38]} material={ironMat}>
            <boxGeometry args={[bodyW * 0.64, 0.06, 0.06]} />
          </mesh>
          {[-bodyW * 0.3, 0, bodyW * 0.3].map((rx, idx) => (
            <mesh key={idx} position={[rx, 0.28, 0.38]} material={ironMat}>
              <boxGeometry args={[0.07, 0.52, 0.07]} />
            </mesh>
          ))}
        </group>

        {/* Dak Beton Atas + Atap Limasan Genteng Terakota */}
        <mesh position={[bodyX, 5.34, bodyZ - 0.05]} material={concreteMat}>
          <boxGeometry args={[bodyW + 0.45, 0.18, bodyD + 0.35]} />
        </mesh>
        <mesh position={[bodyX, 5.5, bodyZ - 0.12]} material={roofDarkMat}>
          <boxGeometry args={[bodyW + 0.55, 0.2, bodyD + 0.2]} />
        </mesh>
        <mesh
          position={[bodyX, 6.18, bodyZ - 0.12]}
          rotation={[0, Math.PI / 4, 0]}
          material={roofMat}
          castShadow={shadows}
        >
          <coneGeometry args={[Math.max(bodyW, bodyD) * 0.74, 1.35, 4]} />
        </mesh>

        {/* Pintu Kayu Utama & Jendela Lantai 1 + Lantai 2 */}
        <mesh position={[bodyX + bodyW * 0.22, 1.35, frontZ + 0.04]} material={woodMat}>
          <boxGeometry args={[0.92, 1.9, 0.1]} />
        </mesh>
        <group position={[bodyX - bodyW * 0.18, 1.55, frontZ + 0.04]}>
          <mesh material={woodDarkMat}>
            <boxGeometry args={[1.3, 1.35, 0.1]} />
          </mesh>
          <mesh position={[0, 0, 0.04]} material={windowMat}>
            <boxGeometry args={[1.05, 1.08, 0.06]} />
          </mesh>
        </group>
        <group position={[bodyX - bodyW * 0.14, 4.15, frontZ - 0.14]}>
          <mesh material={woodDarkMat}>
            <boxGeometry args={[bodyW * 0.45, 1.5, 0.1]} />
          </mesh>
          <mesh position={[0, 0, 0.04]} material={windowMat}>
            <boxGeometry args={[bodyW * 0.38, 1.25, 0.06]} />
          </mesh>
        </group>
        {/* Jendela Samping Kiri */}
        <mesh position={[bodyX - bodyW / 2 - 0.04, 4.35, bodyZ]} material={windowMat}>
          <boxGeometry args={[0.08, 0.52, 1.5]} />
        </mesh>

        {/* Lampu Dinding Hangat */}
        <mesh position={[bodyX + bodyW * 0.04, 2.38, frontZ + 0.12]} material={lampMat}>
          <sphereGeometry args={[0.12, 6, 6]} />
        </mesh>
        <mesh position={[bodyX + bodyW * 0.04, 4.9, frontZ - 0.05]} material={lampMat}>
          <sphereGeometry args={[0.12, 6, 6]} />
        </mesh>

        {/* Unit Outdoor AC di Dinding Samping */}
        {hasAc && (
          <group position={[bodyX - bodyW / 2 - 0.16, 3.6, bodyZ + 0.4]}>
            <mesh material={whiteMat} castShadow={shadows}>
              <boxGeometry args={[0.26, 0.46, 0.68]} />
            </mesh>
            <mesh position={[-0.14, 0, 0]} material={stoneMat}>
              <cylinderGeometry args={[0.15, 0.15, 0.04, 8]} />
            </mesh>
          </group>
        )}

        {/* Kanopi Carport Modern Abu Gelap + Mobil Mini (Khusus Tipe Rumah Cukup Lebar) */}
        {hasCarport && !isCompact && variant === 'rumah' && (
          <group position={[carportX, 0.2, frontZ + 0.3]}>
            <mesh position={[0, 2.35, 0]} rotation={[0.08, 0, 0]} material={ironMat} castShadow={shadows}>
              <boxGeometry args={[carportW, 0.16, 3.3]} />
            </mesh>
            <mesh position={[-carportW * 0.4, 1.18, 1.35]} material={stoneMat}>
              <boxGeometry args={[0.24, 2.3, 0.24]} />
            </mesh>
            <mesh position={[carportW * 0.4, 1.18, 1.35]} material={stoneMat}>
              <boxGeometry args={[0.24, 2.3, 0.24]} />
            </mesh>
            {/* Siluet Mobil Putih Low-Poly di Bawah Carport */}
            <group position={[0, 0.22, 0]}>
              <mesh position={[0, 0.38, 0]} material={whiteMat} castShadow={shadows}>
                <boxGeometry args={[1.45, 0.56, 2.65]} />
              </mesh>
              <mesh position={[0, 0.8, -0.15]} material={whiteMat} castShadow={shadows}>
                <boxGeometry args={[1.25, 0.42, 1.45]} />
              </mesh>
              <mesh position={[0, 0.82, 0.6]} material={windowMat}>
                <boxGeometry args={[1.18, 0.32, 0.1]} />
              </mesh>
              {[
                [-0.68, -0.82],
                [0.68, -0.82],
                [-0.68, 0.82],
                [0.68, 0.82],
              ].map(([wx, wz], idx) => (
                <mesh key={idx} position={[wx, 0.16, wz]} rotation={[0, 0, Math.PI / 2]} material={tireMat}>
                  <cylinderGeometry args={[0.24, 0.24, 0.16, 8]} />
                </mesh>
              ))}
            </group>
          </group>
        )}

        {/* Pot Tanaman Teras */}
        <group position={[bodyX - bodyW * 0.38, 0.2, frontZ + 0.45]}>
          <mesh position={[0, 0.2, 0]} material={potMat}>
            <cylinderGeometry args={[0.2, 0.15, 0.4, 6]} />
          </mesh>
          <mesh position={[0, 0.52, 0]} material={foliageMat}>
            <icosahedronGeometry args={[0.28, 0]} />
          </mesh>
        </group>

        {/* Pagar Besi Horizontal + Pilar Lampu Hangat (bila direnovasi atau rumah modern) */}
        {hasFence && (
          <group position={[0, 0.2, depth / 2 + 0.22]}>
            <mesh position={[-width * 0.28, 0.48, 0]} material={ironMat}>
              <boxGeometry args={[width * 0.36, 0.55, 0.08]} />
            </mesh>
            {[-width * 0.46, -width * 0.08, width * 0.46].map((px, idx) => (
              <group key={idx} position={[px, 0.55, 0]}>
                <mesh material={stoneMat}>
                  <boxGeometry args={[0.34, 1.1, 0.34]} />
                </mesh>
                <mesh position={[0, 0.64, 0]} material={lampMat}>
                  <boxGeometry args={[0.22, 0.18, 0.22]} />
                </mesh>
              </group>
            ))}
          </group>
        )}
      </AssetModelLoader>
    </group>
  );
};
