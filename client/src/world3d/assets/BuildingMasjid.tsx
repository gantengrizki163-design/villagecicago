import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Low-Poly_Isometric_Mosque_Courtyard_59f52ee0.png

interface BuildingMasjidProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  compact?: boolean;
  scale?: number;
}

/**
 * Masjid Agung Cicalengka Low-Poly (Batch 3).
 * Mengikuti referensi Low-Poly_Isometric_Mosque_Courtyard:
 * kubah besar hijau berfaset dengan bulan sabit emas, drum jendela lengkung,
 * menara tinggi di sudut kanan lengkap dengan balkon & kubah kecil, serambi depan berarkade lengkung,
 * pelataran berpagar krem-hijau dengan gerbang lengkung, gazebo/bale beratap hijau di sisi kiri,
 * serta kolam tempat wudhu oktagonal berisi air biru jernih di sisi kanan halaman.
 */
export const BuildingMasjid: React.FC<BuildingMasjidProps> = ({
  title = 'MASJID AGUNG CICALENGKA',
  subtitle = 'IBADAH & KETENANGAN',
  quality,
  isNight,
  compact = true,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getPaletteMaterial('wall_cream');
  const domeMat = getPaletteMaterial('roof_mosque_green', { flatShading: true });
  const roofGreenMat = getPaletteMaterial('roof_mosque_green');
  const goldMat = getPaletteMaterial('trim_gold');
  const woodMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const waterMat = getPaletteMaterial('water_clear');
  const bushMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  const s = compact ? 0.56 : 1.0;

  return (
    <group scale={scale}>
      <AssetModelLoader
        assetId="building_masjid"
        quality={quality}
        castShadow={shadows}
        overrideFootprint={compact ? { width: 8.8, depth: 8.8, height: 10.5 } : undefined}
      >
        <group scale={[s, compact ? 0.72 : 1.0, s]}>
          {/* Pelataran Paving Halaman Masjid */}
          <mesh position={[0, 0.14, 0]} material={pavingMat} receiveShadow>
            <boxGeometry args={[15.4, 0.28, 15.4]} />
          </mesh>

          {/* Plint & Ruang Utama Salat Masjid */}
          <mesh position={[-0.6, 0.52, -2.5]} material={plinthMat} receiveShadow>
            <boxGeometry args={[11.4, 0.52, 8.2]} />
          </mesh>
          <mesh position={[-0.6, 2.65, -2.9]} material={wallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[10.8, 3.8, 6.6]} />
          </mesh>

          {/* Serambi Depan Berpilar & Arkade Lengkung */}
          <mesh position={[-0.6, 4.7, -2.1]} material={roofGreenMat} castShadow={shadows}>
            <boxGeometry args={[11.5, 0.38, 8.4]} />
          </mesh>
          {[-4.5, -1.9, 0.7, 3.3].map((px, idx) => (
            <group key={idx} position={[px, 0.78, 1.45]}>
              <mesh position={[0, 0.22, 0]} material={roofGreenMat}>
                <boxGeometry args={[0.54, 0.44, 0.54]} />
              </mesh>
              <mesh position={[0, 1.9, 0]} material={wallMat} castShadow={shadows}>
                <boxGeometry args={[0.42, 3.1, 0.42]} />
              </mesh>
            </group>
          ))}
          <mesh position={[-0.6, 4.05, 1.45]} material={wallMat}>
            <boxGeometry args={[8.6, 0.85, 0.36]} />
          </mesh>

          {/* Pintu & Jendela Berbingkai Kayu */}
          {[-2.2, 1.0].map((dx, idx) => (
            <mesh key={idx} position={[dx, 2.0, 0.44]} material={woodDarkMat}>
              <boxGeometry args={[1.35, 2.4, 0.12]} />
            </mesh>
          ))}
          {[-4.3, 2.9].map((wx, idx) => (
            <mesh key={idx} position={[wx, 2.35, 0.44]} material={windowMat}>
              <boxGeometry args={[1.25, 1.55, 0.1]} />
            </mesh>
          ))}
          {[-6.04, 4.84].map((sx, idx) => (
            <group key={idx} position={[sx, 2.35, -2.8]}>
              <mesh position={[0, 0, -1.4]} material={windowMat}>
                <boxGeometry args={[0.1, 1.5, 1.25]} />
              </mesh>
              <mesh position={[0, 0, 1.4]} material={windowMat}>
                <boxGeometry args={[0.1, 1.5, 1.25]} />
              </mesh>
            </group>
          ))}

          {/* Drum Kubah & Kubah Utama Hijau Berfaset + Bulan Sabit Emas */}
          <group position={[-0.6, 4.9, -2.9]}>
            <mesh position={[0, 0.75, 0]} material={wallMat} castShadow={shadows}>
              <cylinderGeometry args={[3.4, 3.5, 1.5, 8]} />
            </mesh>
            <mesh position={[0, 1.55, 0]} material={roofGreenMat}>
              <cylinderGeometry args={[3.65, 3.65, 0.25, 8]} />
            </mesh>
            <mesh position={[0, 1.65, 0]} material={domeMat} castShadow={shadows}>
              <sphereGeometry args={[3.25, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
            </mesh>
            {/* Puncak Bulan Sabit Emas */}
            <mesh position={[0, 5.25, 0]} material={goldMat}>
              <cylinderGeometry args={[0.08, 0.14, 0.9, 6]} />
            </mesh>
            <mesh position={[0, 5.9, 0]} rotation={[0, 0, 0.45]} material={goldMat}>
              <torusGeometry args={[0.36, 0.09, 6, 12, Math.PI * 1.35]} />
            </mesh>
          </group>

          {/* Menara Tinggi di Sudut Kanan Masjid */}
          <group position={[5.35, 0.28, -0.4]}>
            <mesh position={[0, 1.4, 0]} material={roofGreenMat} castShadow={shadows}>
              <boxGeometry args={[2.25, 2.8, 2.25]} />
            </mesh>
            <mesh position={[0, 4.8, 0]} material={wallMat} castShadow={shadows}>
              <boxGeometry args={[1.9, 4.2, 1.9]} />
            </mesh>
            <mesh position={[0, 5.1, 0.98]} material={windowMat}>
              <boxGeometry args={[0.55, 1.25, 0.08]} />
            </mesh>
            {/* Balkon Menara */}
            <mesh position={[0, 7.1, 0]} material={roofGreenMat}>
              <boxGeometry args={[2.65, 0.34, 2.65]} />
            </mesh>
            <mesh position={[0, 7.55, 0]} material={wallMat}>
              <boxGeometry args={[2.45, 0.55, 2.45]} />
            </mesh>
            <mesh position={[0, 8.75, 0]} material={wallMat} castShadow={shadows}>
              <boxGeometry args={[1.55, 1.9, 1.55]} />
            </mesh>
            <mesh position={[0, 9.85, 0]} material={roofGreenMat}>
              <cylinderGeometry args={[1.25, 1.25, 0.24, 8]} />
            </mesh>
            <mesh position={[0, 9.95, 0]} material={domeMat} castShadow={shadows}>
              <sphereGeometry args={[1.05, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
            </mesh>
            <mesh position={[0, 11.2, 0]} material={goldMat}>
              <cylinderGeometry args={[0.05, 0.08, 0.5, 6]} />
            </mesh>
            <mesh position={[0, 11.55, 0]} rotation={[0, 0, 0.45]} material={goldMat}>
              <torusGeometry args={[0.2, 0.06, 6, 10, Math.PI * 1.35]} />
            </mesh>
            <mesh position={[0, 7.35, 1.35]} material={lampMat}>
              <sphereGeometry args={[0.16, 6, 6]} />
            </mesh>
          </group>

          {/* Bale / Gazebo Beratap Hijau di Halaman Kiri Depan */}
          <group position={[-5.1, 0.28, 3.8]}>
            {[
              [-1.25, -1.25],
              [1.25, -1.25],
              [-1.25, 1.25],
              [1.25, 1.25],
            ].map(([px, pz], idx) => (
              <mesh key={idx} position={[px, 1.15, pz]} material={woodMat} castShadow={shadows}>
                <boxGeometry args={[0.2, 2.3, 0.2]} />
              </mesh>
            ))}
            <mesh position={[0, 0.35, 0]} material={woodMat}>
              <boxGeometry args={[2.6, 0.25, 2.6]} />
            </mesh>
            <mesh position={[0, 2.95, 0]} rotation={[0, Math.PI / 4, 0]} material={domeMat} castShadow={shadows}>
              <coneGeometry args={[2.45, 1.45, 4]} />
            </mesh>
          </group>

          {/* Kolam Wudhu Oktagonal Air Biru di Halaman Kanan Depan */}
          <group position={[2.8, 0.28, 4.4]}>
            <mesh position={[0, 0.34, 0]} material={plinthMat} receiveShadow>
              <cylinderGeometry args={[1.95, 2.05, 0.68, 8]} />
            </mesh>
            <mesh position={[0, 0.62, 0]} material={waterMat}>
              <cylinderGeometry args={[1.65, 1.65, 0.16, 8]} />
            </mesh>
            <mesh position={[0, 1.25, 0]} material={wallMat}>
              <boxGeometry args={[0.62, 1.45, 0.62]} />
            </mesh>
            <mesh position={[0, 2.18, 0]} rotation={[0, Math.PI / 4, 0]} material={domeMat}>
              <coneGeometry args={[0.72, 0.55, 4]} />
            </mesh>
          </group>

          {/* Pagar Keliling & Gerbang Utama Lengkung di Depan (+Z) */}
          {[-4.6, 4.6].map((fx, idx) => (
            <group key={idx} position={[fx, 0.28, 7.42]}>
              <mesh position={[0, 0.55, 0]} material={wallMat} receiveShadow>
                <boxGeometry args={[5.4, 1.1, 0.32]} />
              </mesh>
              <mesh position={[-2.7, 0.72, 0]} material={wallMat}>
                <boxGeometry args={[0.52, 1.45, 0.52]} />
              </mesh>
              <mesh position={[-2.7, 1.5, 0]} material={plinthMat}>
                <boxGeometry args={[0.6, 0.14, 0.6]} />
              </mesh>
              <mesh position={[2.7, 0.72, 0]} material={wallMat}>
                <boxGeometry args={[0.52, 1.45, 0.52]} />
              </mesh>
              <mesh position={[2.7, 1.5, 0]} material={plinthMat}>
                <boxGeometry args={[0.6, 0.14, 0.6]} />
              </mesh>
            </group>
          ))}
          <group position={[0, 0.28, 7.42]}>
            <mesh position={[-1.45, 1.3, 0]} material={roofGreenMat} castShadow={shadows}>
              <boxGeometry args={[0.65, 2.6, 0.65]} />
            </mesh>
            <mesh position={[1.45, 1.3, 0]} material={roofGreenMat} castShadow={shadows}>
              <boxGeometry args={[0.65, 2.6, 0.65]} />
            </mesh>
            <mesh position={[0, 2.7, 0]} material={wallMat} castShadow={shadows}>
              <boxGeometry args={[3.7, 0.7, 0.7]} />
            </mesh>
            <mesh position={[0, 3.22, 0]} material={roofGreenMat}>
              <boxGeometry args={[3.9, 0.36, 0.85]} />
            </mesh>
          </group>
          <mesh position={[-3.1, 0.6, 6.6]} material={bushMat}>
            <icosahedronGeometry args={[0.45, 0]} />
          </mesh>
          <mesh position={[6.1, 0.6, 5.8]} material={bushMat}>
            <icosahedronGeometry args={[0.45, 0]} />
          </mesh>
        </group>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, compact ? 3.2 : 4.2, compact ? 4.3 : 7.5]}
        width={compact ? 3.8 : 4.8}
        height={compact ? 0.72 : 0.85}
        variant="colonial"
        isNight={isNight}
      />
    </group>
  );
};
