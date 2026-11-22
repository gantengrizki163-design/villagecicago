import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Low-Poly_Indonesian_Village_Office_Diorama_af653e36.png

interface BuildingKantorDesaProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  scale?: number;
}

/**
 * Kantor Desa Cicalengka Low-Poly (Batch 3).
 * Mengikuti referensi Low-Poly_Indonesian_Village_Office_Diorama:
 * atap joglo/limasan 2 tingkat genteng terakota + balok kayu hangat,
 * pendopo teras depan berpilar 4 berplint batu abu, bangku & meja pelayanan kayu,
 * dinding krem berjendela kusen kayu gelap, tiang bendera Merah Putih berumpak di halaman,
 * papan pengumuman beratap genteng kecil, serta pagar halaman rendah berujung batu.
 */
export const BuildingKantorDesa: React.FC<BuildingKantorDesaProps> = ({
  title = 'KANTOR DESA CICALENGKA',
  subtitle = 'LAYANAN WARGA & IZIN USAHA',
  quality,
  isNight,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getPaletteMaterial('wall_cream');
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const woodMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const poleMat = getPaletteMaterial('rail_steel');
  const redMat = getPaletteMaterial('flag_red');
  const whiteMat = getPaletteMaterial('flag_white');
  const goldMat = getPaletteMaterial('trim_gold');
  const shrubMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_kantor_desa" quality={quality} castShadow={shadows}>
        {/* Pelataran Paving Halaman */}
        <mesh position={[0, 0.09, 0.15]} material={pavingMat} receiveShadow>
          <boxGeometry args={[11.4, 0.18, 8.6]} />
        </mesh>

        {/* Plint Batu Tinggi & Tangga Pendopo */}
        <mesh position={[0, 0.42, -0.35]} material={plinthMat} receiveShadow>
          <boxGeometry args={[9.6, 0.48, 6.2]} />
        </mesh>
        <mesh position={[0, 0.28, 2.95]} material={pavingMat} receiveShadow>
          <boxGeometry args={[3.2, 0.24, 0.7]} />
        </mesh>
        <mesh position={[0, 0.16, 3.35]} material={pavingMat} receiveShadow>
          <boxGeometry args={[3.4, 0.14, 0.45]} />
        </mesh>

        {/* Massa Kantor Utama (Bagian Belakang Teras) */}
        <mesh position={[0, 2.0, -1.05]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[8.4, 2.75, 4.1]} />
        </mesh>

        {/* Pintu Ganda & Jendela Kusen Kayu Gelap */}
        <group position={[0, 1.7, 1.04]}>
          <mesh material={woodDarkMat}>
            <boxGeometry args={[1.65, 2.15, 0.1]} />
          </mesh>
          <mesh position={[-0.38, 0.1, 0.04]} material={windowMat}>
            <boxGeometry args={[0.55, 1.4, 0.06]} />
          </mesh>
          <mesh position={[0.38, 0.1, 0.04]} material={windowMat}>
            <boxGeometry args={[0.55, 1.4, 0.06]} />
          </mesh>
        </group>

        {[-2.75, 2.75].map((wx, idx) => (
          <group key={idx} position={[wx, 1.95, 1.04]}>
            <mesh material={woodDarkMat}>
              <boxGeometry args={[1.55, 1.28, 0.1]} />
            </mesh>
            <mesh position={[0, 0, 0.04]} material={windowMat}>
              <boxGeometry args={[1.28, 1.0, 0.06]} />
            </mesh>
          </group>
        ))}

        {/* Jendela Samping + Kanopi Genteng Mini */}
        {[-4.24, 4.24].map((sx, idx) => (
          <group key={idx} position={[sx, 1.95, -1.05]}>
            <mesh material={woodDarkMat}>
              <boxGeometry args={[0.1, 1.25, 1.55]} />
            </mesh>
            <mesh position={[idx === 0 ? -0.04 : 0.04, 0, 0]} material={windowMat}>
              <boxGeometry args={[0.06, 0.98, 1.28]} />
            </mesh>
            <mesh
              position={[idx === 0 ? -0.28 : 0.28, 0.82, 0]}
              rotation={[0, 0, idx === 0 ? 0.45 : -0.45]}
              material={roofMat}
            >
              <boxGeometry args={[0.7, 0.12, 1.85]} />
            </mesh>
          </group>
        ))}

        {/* 4 Pilar Pendopo Teras Depan Berumpak Batu + Bangku & Meja Kayu */}
        {[-3.95, -1.45, 1.45, 3.95].map((px, idx) => (
          <group key={idx} position={[px, 0.66, 2.45]}>
            <mesh position={[0, 0.25, 0]} material={plinthMat}>
              <boxGeometry args={[0.46, 0.5, 0.46]} />
            </mesh>
            <mesh position={[0, 1.55, 0]} material={wallMat} castShadow={shadows}>
              <boxGeometry args={[0.34, 2.25, 0.34]} />
            </mesh>
          </group>
        ))}

        {/* Bangku & Meja Layanan Teras */}
        <group position={[-2.6, 0.66, 1.55]}>
          <mesh position={[0, 0.35, 0]} material={woodMat} castShadow={shadows}>
            <boxGeometry args={[1.5, 0.14, 0.55]} />
          </mesh>
          <mesh position={[0, 0.65, -0.22]} material={woodDarkMat}>
            <boxGeometry args={[1.5, 0.52, 0.1]} />
          </mesh>
        </group>
        <mesh position={[2.6, 1.05, 1.55]} material={woodMat} castShadow={shadows}>
          <boxGeometry args={[1.65, 0.78, 0.62]} />
        </mesh>

        {/* Balok Lis Kayu & Atap Joglo / Limasan 2 Tingkat */}
        <mesh position={[0, 3.45, -0.35]} material={woodDarkMat}>
          <boxGeometry args={[9.4, 0.28, 6.2]} />
        </mesh>
        <mesh
          position={[0, 4.3, -0.35]}
          rotation={[0, Math.PI / 4, 0]}
          material={roofMat}
          castShadow={shadows}
        >
          <coneGeometry args={[6.9, 1.75, 4]} />
        </mesh>
        <mesh position={[0, 4.88, -0.35]} material={roofDarkMat}>
          <boxGeometry args={[4.4, 0.25, 3.4]} />
        </mesh>
        <mesh
          position={[0, 5.65, -0.35]}
          rotation={[0, Math.PI / 4, 0]}
          material={roofMat}
          castShadow={shadows}
        >
          <coneGeometry args={[3.4, 1.35, 4]} />
        </mesh>
        <mesh position={[0, 6.36, -0.35]} material={roofDarkMat}>
          <boxGeometry args={[0.42, 0.26, 0.42]} />
        </mesh>

        {/* Lampu Teras Hangat */}
        <mesh position={[0, 3.22, 2.25]} material={lampMat}>
          <sphereGeometry args={[0.14, 6, 6]} />
        </mesh>

        {/* Tiang Bendera Merah Putih Berumpak di Halaman Kiri Depan */}
        <group position={[-2.9, 0.18, 3.7]}>
          <mesh position={[0, 0.12, 0]} material={plinthMat}>
            <boxGeometry args={[0.92, 0.24, 0.92]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={plinthMat}>
            <boxGeometry args={[0.56, 0.16, 0.56]} />
          </mesh>
          <mesh position={[0, 2.65, 0]} material={poleMat} castShadow={shadows}>
            <cylinderGeometry args={[0.045, 0.065, 4.6, 6]} />
          </mesh>
          <mesh position={[0, 5.0, 0]} material={goldMat}>
            <sphereGeometry args={[0.11, 6, 6]} />
          </mesh>
          <mesh position={[0.52, 4.55, 0]} material={redMat}>
            <boxGeometry args={[0.96, 0.32, 0.04]} />
          </mesh>
          <mesh position={[0.52, 4.23, 0]} material={whiteMat}>
            <boxGeometry args={[0.96, 0.32, 0.04]} />
          </mesh>
        </group>

        {/* Papan Pengumuman Beratap Genteng Kecil di Kiri */}
        <group position={[-4.55, 0.18, 2.95]} rotation={[0, 0.35, 0]}>
          <mesh position={[-0.75, 0.95, 0]} material={woodDarkMat}>
            <boxGeometry args={[0.12, 1.9, 0.12]} />
          </mesh>
          <mesh position={[0.75, 0.95, 0]} material={woodDarkMat}>
            <boxGeometry args={[0.12, 1.9, 0.12]} />
          </mesh>
          <mesh position={[0, 1.15, 0]} material={woodMat} castShadow={shadows}>
            <boxGeometry args={[1.65, 0.95, 0.12]} />
          </mesh>
          <mesh position={[-0.44, 1.15, 0.07]} material={whiteMat}>
            <boxGeometry args={[0.36, 0.62, 0.03]} />
          </mesh>
          <mesh position={[0, 1.15, 0.07]} material={whiteMat}>
            <boxGeometry args={[0.36, 0.62, 0.03]} />
          </mesh>
          <mesh position={[0.44, 1.15, 0.07]} material={whiteMat}>
            <boxGeometry args={[0.36, 0.62, 0.03]} />
          </mesh>
          <mesh position={[0, 1.85, 0]} material={roofMat} castShadow={shadows}>
            <boxGeometry args={[1.95, 0.22, 0.65]} />
          </mesh>
        </group>

        {/* Pagar Rendah Halaman Depan (Kiri & Kanan Terbuka di Tangga) */}
        {[-3.95, 3.95].map((fx, idx) => (
          <group key={idx} position={[fx, 0.18, 4.18]}>
            <mesh position={[0, 0.36, 0]} material={wallMat} receiveShadow>
              <boxGeometry args={[2.9, 0.72, 0.22]} />
            </mesh>
            <mesh position={[-1.45, 0.48, 0]} material={wallMat}>
              <boxGeometry args={[0.38, 0.96, 0.38]} />
            </mesh>
            <mesh position={[-1.45, 0.99, 0]} material={plinthMat}>
              <boxGeometry args={[0.44, 0.1, 0.44]} />
            </mesh>
            <mesh position={[1.45, 0.48, 0]} material={wallMat}>
              <boxGeometry args={[0.38, 0.96, 0.38]} />
            </mesh>
            <mesh position={[1.45, 0.99, 0]} material={plinthMat}>
              <boxGeometry args={[0.44, 0.1, 0.44]} />
            </mesh>
          </group>
        ))}

        {/* Semak Taman Pendopo */}
        {[-2.35, 2.35].map((sx, idx) => (
          <mesh key={idx} position={[sx, 0.55, 2.95]} material={shrubMat}>
            <icosahedronGeometry args={[0.34, 0]} />
          </mesh>
        ))}
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 4.1, 2.75]}
        width={4.6}
        height={0.85}
        variant="colonial"
        isNight={isNight}
      />
    </group>
  );
};
