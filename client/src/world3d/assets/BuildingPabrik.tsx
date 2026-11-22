import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { BuildingSignboard } from './BuildingSignboard';
import { getLampMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Isometric_Industrial_Factory_Compound_3b9f8faf.png

interface BuildingPabrikProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  compact?: boolean;
  scale?: number;
}

/**
 * Pabrik Tekstil & Gudang Industri Low-Poly (Batch 3).
 * Mengikuti referensi Isometric_Industrial_Factory_Compound:
 * gudang utama beratap pelana biru bergelombang dengan skylight, 2 pintu loading dock berkanopi biru
 * beserta palet kotak kayu, kantor administrasi 2 lantai di sisi kiri + tangki oranye berpipa,
 * cerobong tinggi belang merah-putih beranjungan besi & kepulan asap low-poly bergerak,
 * menara tangki air rangka baja, pos satpam, tempat parkir sepeda beratap biru, serta pagar gerbang geser.
 */
export const BuildingPabrik: React.FC<BuildingPabrikProps> = ({
  title = 'PT TEKSTIL RANCAEKEK',
  subtitle = 'INDUSTRI & LOGISTIK',
  quality,
  isNight,
  compact = false,
  scale = 1,
}) => {
  const shadows = quality !== 'low';
  const smokeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!smokeRef.current) return;
    const t = clock.elapsedTime;
    smokeRef.current.position.y = (t * 0.45) % 1.4;
    smokeRef.current.rotation.y = t * 0.25;
  });

  const pavingMat = getPaletteMaterial('paving_stone');
  const concreteMat = getPaletteMaterial('concrete_grey');
  const wallMat = getPaletteMaterial('wall_cream');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const roofBlueMat = getPaletteMaterial('roof_industrial_blue');
  const shutterMat = getPaletteMaterial('roof_metal_grey');
  const steelMat = getPaletteMaterial('rail_steel');
  const redMat = getPaletteMaterial('flag_red');
  const whiteMat = getPaletteMaterial('flag_white');
  const orangeMat = getPaletteMaterial('brick_orange');
  const crateMat = getPaletteMaterial('bamboo_light');
  const woodMat = getPaletteMaterial('wood_warm');
  const goldMat = getPaletteMaterial('trim_gold');
  const windowMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  // Mode compact untuk slot utara pabrik_reserved (16x6m di dunia, kantor & papan nama menghadap timur +X)
  if (compact) {
    return (
      <group scale={scale}>
        <AssetModelLoader
          assetId="building_pabrik"
          quality={quality}
          castShadow={shadows}
          overrideFootprint={{ width: 15.2, depth: 5.6, height: 11.5 }}
        >
          <mesh position={[0, 0.08, 0]} material={pavingMat} receiveShadow>
            <boxGeometry args={[15.2, 0.16, 5.6]} />
          </mesh>
          <mesh position={[-1.6, 2.5, -0.4]} material={wallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[9.6, 4.7, 4.4]} />
          </mesh>
          <mesh position={[-1.6, 5.25, -0.4]} material={roofBlueMat} castShadow={shadows}>
            <boxGeometry args={[10.2, 0.65, 4.9]} />
          </mesh>
          <mesh position={[-2.5, 1.5, 1.85]} material={shutterMat}>
            <boxGeometry args={[3.0, 2.7, 0.14]} />
          </mesh>
          <mesh position={[1.2, 1.5, 1.85]} material={shutterMat}>
            <boxGeometry args={[3.0, 2.7, 0.14]} />
          </mesh>
          <mesh position={[-0.65, 3.15, 2.25]} rotation={[0.22, 0, 0]} material={roofBlueMat} castShadow={shadows}>
            <boxGeometry args={[7.6, 0.14, 1.3]} />
          </mesh>
          {/* Kantor Mini Menghadap Timur (+X) */}
          <mesh position={[5.1, 1.8, 0.1]} material={wallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[3.4, 3.4, 3.8]} />
          </mesh>
          <mesh position={[5.1, 3.75, 0.1]} material={roofBlueMat} castShadow={shadows}>
            <boxGeometry args={[3.8, 0.45, 4.2]} />
          </mesh>
          <mesh position={[6.82, 2.1, 0.1]} material={windowMat}>
            <boxGeometry args={[0.1, 1.1, 2.4]} />
          </mesh>
          {/* Cerobong Belang Merah-Putih */}
          <group position={[-5.2, 0.16, -1.6]}>
            {[0, 1, 2, 3, 4].map((seg) => (
              <mesh
                key={seg}
                position={[0, 1.0 + seg * 1.85, 0]}
                material={seg % 2 === 0 ? whiteMat : redMat}
                castShadow={shadows}
              >
                <cylinderGeometry args={[0.62 - seg * 0.05, 0.68 - seg * 0.05, 1.85, 10]} />
              </mesh>
            ))}
            <group ref={smokeRef} position={[0, 10.3, 0]}>
              <mesh position={[0.2, 0.4, 0]} material={whiteMat}>
                <icosahedronGeometry args={[0.52, 0]} />
              </mesh>
              <mesh position={[0.75, 1.05, -0.15]} material={concreteMat}>
                <icosahedronGeometry args={[0.38, 0]} />
              </mesh>
            </group>
          </group>
        </AssetModelLoader>
        <BuildingSignboard
          title={title}
          subtitle={subtitle}
          position={[6.9, 4.35, 0.1]}
          rotation={[0, Math.PI / 2, 0]}
          width={3.6}
          height={0.75}
          variant="modern"
          isNight={isNight}
        />
      </group>
    );
  }

  return (
    <group scale={scale}>
      <AssetModelLoader assetId="building_pabrik" quality={quality} castShadow={shadows}>
        {/* Pelataran Beton Kompleks Industri */}
        <mesh position={[0, 0.1, 0]} material={pavingMat} receiveShadow>
          <boxGeometry args={[21.4, 0.2, 15.4]} />
        </mesh>

        {/* Gudang Produksi Utama (Sisi Kanan-Belakang) */}
        <mesh position={[3.2, 0.4, -2.1]} material={plinthMat} receiveShadow>
          <boxGeometry args={[12.8, 0.45, 9.2]} />
        </mesh>
        <mesh position={[3.2, 3.25, -2.1]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[12.4, 5.3, 8.8]} />
        </mesh>
        {/* Atap Pelana Ganda Biru Industri + Skylight */}
        {[-0.1, 6.5].map((rx, idx) => (
          <group key={idx} position={[rx, 6.55, -2.1]}>
            <mesh position={[-1.6, 0, 0]} rotation={[0, 0, 0.34]} material={roofBlueMat} castShadow={shadows}>
              <boxGeometry args={[3.6, 0.22, 9.4]} />
            </mesh>
            <mesh position={[1.6, 0, 0]} rotation={[0, 0, -0.34]} material={roofBlueMat} castShadow={shadows}>
              <boxGeometry args={[3.6, 0.22, 9.4]} />
            </mesh>
            <mesh position={[0, 0.52, -1.6]} material={windowMat}>
              <boxGeometry args={[1.1, 0.16, 2.2]} />
            </mesh>
            <mesh position={[0, 0.52, 1.8]} material={windowMat}>
              <boxGeometry args={[1.1, 0.16, 2.2]} />
            </mesh>
          </group>
        ))}

        {/* 2 Pintu Loading Dock + Kanopi Biru + Palet Kargo */}
        {[1.1, 5.5].map((dx, idx) => (
          <group key={idx} position={[dx, 0.2, 2.34]}>
            <mesh position={[0, 1.65, 0]} material={shutterMat}>
              <boxGeometry args={[3.2, 3.1, 0.16]} />
            </mesh>
            <mesh position={[-1.8, 1.55, 1.75]} material={steelMat} castShadow={shadows}>
              <boxGeometry args={[0.18, 3.1, 0.18]} />
            </mesh>
            <mesh position={[1.8, 1.55, 1.75]} material={steelMat} castShadow={shadows}>
              <boxGeometry args={[0.18, 3.1, 0.18]} />
            </mesh>
          </group>
        ))}
        <mesh position={[3.3, 3.55, 3.25]} rotation={[0.24, 0, 0]} material={roofBlueMat} castShadow={shadows}>
          <boxGeometry args={[9.4, 0.18, 2.4]} />
        </mesh>
        {/* Palet & Kardus Kargo di Teras Dock */}
        <group position={[-1.4, 0.2, 3.35]}>
          <mesh position={[0, 0.12, 0]} material={woodMat}>
            <boxGeometry args={[1.3, 0.18, 1.1]} />
          </mesh>
          <mesh position={[-0.25, 0.55, 0]} material={crateMat} castShadow={shadows}>
            <boxGeometry args={[0.68, 0.68, 0.68]} />
          </mesh>
          <mesh position={[0.3, 0.48, 0.15]} material={crateMat} castShadow={shadows}>
            <boxGeometry args={[0.55, 0.55, 0.55]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} material={crateMat} castShadow={shadows}>
            <boxGeometry args={[0.55, 0.5, 0.55]} />
          </mesh>
        </group>

        {/* Kantor Administrasi 2 Lantai di Sisi Kiri */}
        <mesh position={[-6.4, 2.35, -0.3]} material={wallMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[6.4, 4.3, 6.2]} />
        </mesh>
        <mesh position={[-6.4, 4.82, -0.3]} rotation={[0, 0, 0.2]} material={roofBlueMat} castShadow={shadows}>
          <boxGeometry args={[6.9, 0.26, 6.6]} />
        </mesh>
        {/* Jendela Kantor 2 Lantai */}
        <mesh position={[-6.4, 3.35, 2.84]} material={windowMat}>
          <boxGeometry args={[4.8, 0.95, 0.1]} />
        </mesh>
        <mesh position={[-6.4, 1.65, 2.84]} material={windowMat}>
          <boxGeometry args={[3.2, 0.95, 0.1]} />
        </mesh>
        {/* Portiko Masuk Kantor */}
        <mesh position={[-4.5, 2.65, 3.45]} rotation={[0.25, 0, 0]} material={roofBlueMat} castShadow={shadows}>
          <boxGeometry args={[2.5, 0.18, 1.4]} />
        </mesh>
        <mesh position={[-5.45, 1.35, 3.9]} material={wallMat}>
          <boxGeometry args={[0.28, 2.3, 0.28]} />
        </mesh>
        <mesh position={[-3.55, 1.35, 3.9]} material={wallMat}>
          <boxGeometry args={[0.28, 2.3, 0.28]} />
        </mesh>

        {/* Tangki Cairan Oranye & Pipa Baja di Belakang Kantor */}
        <group position={[-8.6, 0.2, -4.5]}>
          <mesh position={[0, 1.35, 0]} material={orangeMat} castShadow={shadows}>
            <cylinderGeometry args={[1.05, 1.05, 2.5, 10]} />
          </mesh>
          <mesh position={[1.4, 2.95, 0.3]} material={steelMat}>
            <boxGeometry args={[2.8, 0.24, 0.24]} />
          </mesh>
        </group>

        {/* Cerobong Asap Belang Merah-Putih + Kepulan Asap Low-Poly */}
        <group position={[-5.4, 0.2, -5.6]}>
          {[0, 1, 2, 3, 4, 5].map((seg) => (
            <mesh
              key={seg}
              position={[0, 1.05 + seg * 1.9, 0]}
              material={seg % 2 === 0 ? whiteMat : redMat}
              castShadow={shadows}
            >
              <cylinderGeometry args={[0.88 - seg * 0.06, 0.96 - seg * 0.06, 1.9, 10]} />
            </mesh>
          ))}
          {/* Anjungan Ring Atas Cerobong */}
          <mesh position={[0, 11.2, 0]} material={steelMat}>
            <cylinderGeometry args={[0.92, 0.92, 0.22, 10]} />
          </mesh>
          <group ref={smokeRef} position={[0, 12.6, 0]}>
            <mesh position={[0.25, 0.35, 0]} material={whiteMat}>
              <icosahedronGeometry args={[0.72, 0]} />
            </mesh>
            <mesh position={[0.95, 1.05, -0.2]} material={concreteMat}>
              <icosahedronGeometry args={[0.52, 0]} />
            </mesh>
          </group>
        </group>

        {/* Menara Tangki Air Rangka Baja di Belakang Gudang */}
        <group position={[6.5, 0.2, -6.2]}>
          {[
            [-0.75, -0.75],
            [0.75, -0.75],
            [-0.75, 0.75],
            [0.75, 0.75],
          ].map(([lx, lz], idx) => (
            <mesh key={idx} position={[lx, 2.8, lz]} material={steelMat}>
              <boxGeometry args={[0.16, 5.6, 0.16]} />
            </mesh>
          ))}
          <mesh position={[0, 6.75, 0]} material={concreteMat} castShadow={shadows}>
            <cylinderGeometry args={[1.25, 1.25, 2.2, 10]} />
          </mesh>
        </group>

        {/* Pos Satpam & Parkiran Sepeda Pekerja di Halaman Depan Kiri */}
        <group position={[-4.5, 0.2, 6.1]}>
          <mesh position={[0, 1.25, 0]} material={wallMat} castShadow={shadows}>
            <boxGeometry args={[2.1, 2.4, 2.1]} />
          </mesh>
          <mesh position={[0, 2.75, 0]} rotation={[0, Math.PI / 4, 0]} material={roofBlueMat} castShadow={shadows}>
            <coneGeometry args={[1.85, 0.95, 4]} />
          </mesh>
          <mesh position={[0, 1.45, 1.07]} material={windowMat}>
            <boxGeometry args={[1.3, 0.9, 0.08]} />
          </mesh>
        </group>

        {/* Kanopi Parkir Sepeda Biru */}
        <group position={[-8.2, 0.2, 4.9]}>
          {[
            [-1.7, -1.0],
            [1.7, -1.0],
            [-1.7, 1.0],
            [1.7, 1.0],
          ].map(([px, pz], idx) => (
            <mesh key={idx} position={[px, 1.1, pz]} material={steelMat}>
              <cylinderGeometry args={[0.06, 0.06, 2.2, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 2.25, 0]} rotation={[0.15, 0, 0]} material={roofBlueMat} castShadow={shadows}>
            <boxGeometry args={[3.9, 0.14, 2.5]} />
          </mesh>
          {[-1.1, -0.35, 0.4, 1.15].map((bx, idx) => (
            <mesh key={idx} position={[bx, 0.55, 0]} material={steelMat}>
              <boxGeometry args={[0.12, 0.72, 1.2]} />
            </mesh>
          ))}
        </group>

        {/* Pagar Perimeter & Gerbang Besi Geser Terbuka + Lampu Sorot */}
        {[-7.2, 6.2].map((fx, idx) => (
          <group key={idx} position={[fx, 0.2, 7.45]}>
            <mesh position={[0, 0.65, 0]} material={wallMat}>
              <boxGeometry args={[5.8, 1.3, 0.26]} />
            </mesh>
            <mesh position={[-2.9, 0.85, 0]} material={plinthMat}>
              <boxGeometry args={[0.45, 1.7, 0.45]} />
            </mesh>
            <mesh position={[2.9, 0.85, 0]} material={plinthMat}>
              <boxGeometry args={[0.45, 1.7, 0.45]} />
            </mesh>
            <mesh position={[2.9, 0.25, 0]} material={goldMat}>
              <boxGeometry args={[0.5, 0.22, 0.5]} />
            </mesh>
          </group>
        ))}
        <mesh position={[-1.4, 0.85, 7.45]} material={steelMat}>
          <boxGeometry args={[3.2, 1.2, 0.12]} />
        </mesh>
        <mesh position={[3.3, 4.35, 3.8]} material={lampMat}>
          <boxGeometry args={[1.6, 0.16, 0.24]} />
        </mesh>
      </AssetModelLoader>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[3.2, 5.55, 2.45]}
        width={6.2}
        height={0.95}
        variant="modern"
        isNight={isNight}
      />
    </group>
  );
};
