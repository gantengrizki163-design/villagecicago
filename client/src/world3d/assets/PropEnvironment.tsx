import React from 'react';
import { RigidBody } from '@react-three/rapier';
import type { GraphicsQuality } from '../../types/game';
import { getLotPlacement, LAYOUT_DATA } from '../layout/layoutHelpers';
import { UnifiedLotCollider } from '../layout/UnifiedLotCollider';
import { AssetModelLoader } from './AssetModelLoader';
import { getLampMaterial, getPaletteMaterial, type PaletteToken } from './paletteMaterials';

// Ref: /assets/aistudio/Diorama_Kota_Indonesia_dengan_Stasiun_Kereta_53a7c2cc.png & Peta_Kota_Tropis_dengan_Masjid_dan_Stasiun_863fc6e5.png

interface PropEnvironmentProps {
  quality: GraphicsQuality;
  isNight: boolean;
}

/**
 * Elemen lingkungan ikonik Batch 1 dari diorama kota & peta jalan (posisi bersumber dari cicalengka.layout.json):
 * 1. Pohon Beringin Alun-Alun + Pendopo Gazebo + Lapak Payung Warna-Warni
 * 2. Hamparan Sawah Terasering + Saluran Irigasi + Saung Kayu
 * 3. Empang/Kolam Tenggara, Menara BTS Merah-Putih, dan Menara Air Stasiun
 */
export const PropEnvironment: React.FC<PropEnvironmentProps> = ({ quality, isNight }) => {
  const shadows = quality !== 'low';

  const barkMat = getPaletteMaterial('wood_dark');
  const woodMat = getPaletteMaterial('wood_warm');
  const canopyBrightMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const canopyMainMat = getPaletteMaterial('grass_main', { flatShading: true });
  const stoneMat = getPaletteMaterial('paving_stone');
  const roofMat = getPaletteMaterial('roof_terracotta');
  const earthMat = getPaletteMaterial('earth_clay');
  const paddyMat = getPaletteMaterial('paddy_lime');
  const waterMat = getPaletteMaterial('water_clear');
  const redMat = getPaletteMaterial('flag_red');
  const whiteMat = getPaletteMaterial('flag_white');
  const lampMat = getLampMaterial(isNight);

  const beringin = LAYOUT_DATA.plaza.features.find((f) => f.kind === 'beringin') ?? {
    x: LAYOUT_DATA.plaza.center.x,
    z: LAYOUT_DATA.plaza.center.z,
  };
  const pendopo = LAYOUT_DATA.plaza.features.find((f) => f.kind === 'pendopo');
  const pklUmbrellas = LAYOUT_DATA.plaza.features.filter((f) => f.kind === 'pkl_umbrella');

  const sawahTimur = getLotPlacement('sawah_timur');
  const empang = getLotPlacement('empang');
  const menaraBts = getLotPlacement('menara_bts');
  const menaraAir = getLotPlacement('menara_air');

  const worldHalf = LAYOUT_DATA.rules.worldHalfSize;

  return (
    <group>
      {/* POHON BERINGIN ALUN-ALUN */}
      <AssetModelLoader assetId="prop_trees_environment" quality={quality} castShadow={shadows}>
        <group position={[beringin.x, 0, beringin.z]}>
          <RigidBody type="fixed" colliders="cuboid">
            {/* Bak Tanaman Batu Bundar */}
            <mesh position={[0, 0.35, 0]} material={stoneMat} receiveShadow castShadow={shadows}>
              <cylinderGeometry args={[3.1, 3.3, 0.7, 12]} />
            </mesh>
            <mesh position={[0, 0.72, 0]} material={canopyMainMat}>
              <cylinderGeometry args={[2.7, 2.7, 0.1, 12]} />
            </mesh>
            {/* Batang & Akar Gantung Beringin */}
            <mesh position={[0, 2.5, 0]} material={barkMat} castShadow={shadows}>
              <cylinderGeometry args={[0.85, 1.35, 3.8, 7]} />
            </mesh>
            {[-0.95, 0.95].map((rx, idx) => (
              <mesh key={idx} position={[rx, 2.2, idx === 0 ? 0.5 : -0.5]} material={barkMat}>
                <cylinderGeometry args={[0.14, 0.22, 3.2, 5]} />
              </mesh>
            ))}
          </RigidBody>

          {/* Tajuk Rimbun Bertingkat */}
          <mesh position={[0, 5.8, 0]} material={canopyBrightMat} castShadow={shadows}>
            <dodecahedronGeometry args={[3.4, 0]} />
          </mesh>
          <mesh position={[-2.2, 5.1, 1.2]} material={canopyMainMat} castShadow={shadows}>
            <dodecahedronGeometry args={[2.2, 0]} />
          </mesh>
          <mesh position={[2.2, 5.2, -1.0]} material={canopyBrightMat} castShadow={shadows}>
            <dodecahedronGeometry args={[2.3, 0]} />
          </mesh>
          <mesh position={[0.4, 7.6, 0.2]} material={canopyBrightMat} castShadow={shadows}>
            <dodecahedronGeometry args={[2.1, 0]} />
          </mesh>
        </group>
      </AssetModelLoader>

      {/* PENDOPO GAZEBO ALUN-ALUN */}
      {pendopo && (
        <group position={[pendopo.x, 0, pendopo.z]}>
          <RigidBody type="fixed" colliders="cuboid">
            <mesh position={[0, 0.18, 0]} material={stoneMat} receiveShadow>
              <boxGeometry args={[pendopo.width ?? 4.4, 0.36, pendopo.depth ?? 4.4]} />
            </mesh>
            {[
              [-1.7, -1.7],
              [1.7, -1.7],
              [-1.7, 1.7],
              [1.7, 1.7],
            ].map(([px, pz], idx) => (
              <mesh key={idx} position={[px, 1.45, pz]} material={woodMat} castShadow={shadows}>
                <boxGeometry args={[0.24, 2.3, 0.24]} />
              </mesh>
            ))}
            <mesh position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} material={roofMat} castShadow={shadows}>
              <coneGeometry args={[3.8, 1.65, 4]} />
            </mesh>
          </RigidBody>
          <mesh position={[0, 2.45, 0]} material={lampMat}>
            <sphereGeometry args={[0.18, 6, 6]} />
          </mesh>
        </group>
      )}

      {/* PAYUNG LAPAK PKL ALUN-ALUN */}
      {pklUmbrellas.map((u) => {
        const token = (u.colorToken ?? 'tarp_blue') as PaletteToken;
        return (
          <group key={u.id} position={[u.x, 0, u.z]}>
            <mesh position={[0, 0.45, 0]} material={woodMat} castShadow={shadows}>
              <boxGeometry args={[1.3, 0.9, 0.9]} />
            </mesh>
            <mesh position={[0, 1.35, 0]} material={woodMat}>
              <cylinderGeometry args={[0.06, 0.06, 2.2, 6]} />
            </mesh>
            <mesh position={[0, 2.35, 0]} material={getPaletteMaterial(token)} castShadow={shadows}>
              <coneGeometry args={[u.radius ?? 1.35, 0.7, 6]} />
            </mesh>
          </group>
        );
      })}

      {/* HAMPARAN SAWAH TERASERING TIMUR */}
      <group position={[sawahTimur.x, 0, sawahTimur.z]} rotation={[0, sawahTimur.rotY, 0]}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={earthMat} receiveShadow>
          <planeGeometry args={[sawahTimur.footprint.width, sawahTimur.footprint.depth]} />
        </mesh>
        {[-16, -6, 4, 14].map((sz, i) => (
          <group key={i} position={[0, 0.06, sz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={paddyMat} receiveShadow>
              <planeGeometry args={[11.5, 8.2]} />
            </mesh>
          </group>
        ))}
        {/* Saluran Irigasi Sawah */}
        <mesh position={[-6.4, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterMat}>
          <planeGeometry args={[1.1, 46]} />
        </mesh>
        {/* Saung Sawah Kayu */}
        <group position={[1.5, 0, -1]}>
          <mesh position={[0, 0.25, 0]} material={woodMat}>
            <boxGeometry args={[2.8, 0.5, 2.6]} />
          </mesh>
          {[
            [-1.1, -1.0],
            [1.1, -1.0],
            [-1.1, 1.0],
            [1.1, 1.0],
          ].map(([px, pz], idx) => (
            <mesh key={idx} position={[px, 1.15, pz]} material={woodMat}>
              <boxGeometry args={[0.14, 1.4, 0.14]} />
            </mesh>
          ))}
          <mesh position={[0, 2.25, 0]} rotation={[0, Math.PI / 4, 0]} material={roofMat} castShadow={shadows}>
            <coneGeometry args={[2.5, 1.2, 4]} />
          </mesh>
        </group>
      </group>

      {/* SAWAH LUAR BARAT (Visual Anti-Void di Luar Pagar Dunia) */}
      <group position={[-(worldHalf + 12), 0, -14]}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={earthMat}>
          <planeGeometry args={[20, 62]} />
        </mesh>
        {[-20, -7, 6, 19].map((sz, idx) => (
          <mesh key={idx} position={[0, 0.05, sz]} rotation={[-Math.PI / 2, 0, 0]} material={paddyMat}>
            <planeGeometry args={[16, 10.5]} />
          </mesh>
        ))}
      </group>

      {/* EMPANG / KOLAM TENGGARA */}
      <group position={[empang.x, 0, empang.z]} rotation={[0, empang.rotY, 0]}>
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} material={earthMat} receiveShadow>
          <circleGeometry args={[empang.footprint.width * 0.52, 12]} />
        </mesh>
        <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterMat}>
          <circleGeometry args={[empang.footprint.width * 0.44, 12]} />
        </mesh>
      </group>

      {/* MENARA BTS MERAH-PUTIH */}
      <group position={[menaraBts.x, 0, menaraBts.z]} rotation={[0, menaraBts.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="menara_bts" />
          <mesh position={[0, 0.25, 0]} material={stoneMat}>
            <boxGeometry args={[menaraBts.footprint.width, 0.5, menaraBts.footprint.depth]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((tier) => (
            <mesh
              key={tier}
              position={[0, 1.7 + tier * 2.4, 0]}
              material={tier % 2 === 0 ? redMat : whiteMat}
              castShadow={shadows}
            >
              <cylinderGeometry args={[0.9 - tier * 0.14, 1.05 - tier * 0.14, 2.35, 4]} />
            </mesh>
          ))}
        </RigidBody>
        <mesh position={[0, 13.4, 0]} material={lampMat}>
          <sphereGeometry args={[0.22, 6, 6]} />
        </mesh>
      </group>

      {/* MENARA AIR STASIUN */}
      <group position={[menaraAir.x, 0, menaraAir.z]} rotation={[0, menaraAir.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="menara_air" />
          {[
            [-1.0, -1.0],
            [1.0, -1.0],
            [-1.0, 1.0],
            [1.0, 1.0],
          ].map(([lx, lz], idx) => (
            <mesh key={idx} position={[lx, 3.2, lz]} material={stoneMat} castShadow={shadows}>
              <boxGeometry args={[0.25, 6.4, 0.25]} />
            </mesh>
          ))}
          <mesh position={[0, 7.3, 0]} material={whiteMat} castShadow={shadows}>
            <cylinderGeometry args={[1.65, 1.65, 2.4, 10]} />
          </mesh>
          <mesh position={[0, 8.85, 0]} material={roofMat}>
            <coneGeometry args={[1.85, 0.9, 10]} />
          </mesh>
        </RigidBody>
      </group>
    </group>
  );
};
