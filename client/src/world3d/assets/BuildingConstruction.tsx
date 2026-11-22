import React from 'react';
import type { ConstructionPhase, GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getPaletteMaterial, getWindowMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Isometric_House_Construction_Progression_88492ee6.png

interface BuildingConstructionProps {
  phase: ConstructionPhase;
  width: number;
  depth: number;
  wallColor?: string;
  quality: GraphicsQuality;
  isNight: boolean;
  scale?: number;
}

/**
 * Fase Konstruksi Rumah 4 Tahap Low-Poly (Batch 3).
 * Mengikuti referensi Isometric_House_Construction_Progression:
 * 1) pondasi: sloof beton bertangga, 6 kolom pilar abu & tulangan besi, tumpukan bata, balok kayu, dan pasir.
 * 2) dinding: kolom beton + dinding bata oranye terekspos berlubang pintu & jendela + sekat ruang.
 * 3) atap: dinding bata lengkap + rangka kuda-kuda & usuk atap kayu hangat + perancah bambu/kayu di tepi.
 * 4) finishing/selesai: dinding acian cat warna blueprint, kusen pintu-jendela kaca, atap genteng terakota penuh.
 */
export const BuildingConstruction: React.FC<BuildingConstructionProps> = ({
  phase,
  width,
  depth,
  wallColor = '#F5EBD8',
  quality,
  isNight,
  scale = 1,
}) => {
  const shadows = quality !== 'low';

  const earthMat = getPaletteMaterial('earth_yard');
  const concreteMat = getPaletteMaterial('concrete_grey');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const brickMat = getPaletteMaterial('brick_orange');
  const woodMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const bambooMat = getPaletteMaterial('bamboo_light');
  const steelMat = getPaletteMaterial('rail_steel');
  const roofMat = getPaletteMaterial('roof_terracotta');
  const roofDarkMat = getPaletteMaterial('roof_terracotta_dark');
  const plasterMat = getCustomColorMaterial(wallColor);
  const bushMat = getPaletteMaterial('foliage_bright', { flatShading: true });
  const windowMat = getWindowMaterial(isNight);

  const w = Math.max(4.8, width);
  const d = Math.max(4.8, depth);
  const hw = w / 2;
  const hd = d / 2;
  const isFinished = phase === 'finishing' || phase === 'selesai';

  const columnPoints: Array<[number, number]> = [
    [-hw + 0.18, -hd + 0.18],
    [0, -hd + 0.18],
    [hw - 0.18, -hd + 0.18],
    [-hw + 0.18, hd - 0.18],
    [0, hd - 0.18],
    [hw - 0.18, hd - 0.18],
  ];

  return (
    <group scale={scale}>
      <AssetModelLoader
        assetId="building_construction"
        quality={quality}
        castShadow={shadows}
        overrideFootprint={{ width: w + 1.0, depth: d + 1.0, height: 4.8 }}
      >
        {/* Tanah Lokasi Proyek & Pondasi Beton Bertangga */}
        <mesh position={[0, 0.04, 0]} material={earthMat} receiveShadow>
          <boxGeometry args={[w + 1.4, 0.08, d + 1.4]} />
        </mesh>
        <mesh position={[0, 0.22, 0]} material={concreteMat} receiveShadow>
          <boxGeometry args={[w + 0.35, 0.36, d + 0.35]} />
        </mesh>
        <mesh position={[0, 0.16, hd + 0.42]} material={concreteMat} receiveShadow>
          <boxGeometry args={[1.8, 0.24, 0.55]} />
        </mesh>

        {/* FASE 1: PONDASI & SLOOF BETON + KOLOM COR + BESI TULANGAN */}
        {phase === 'pondasi' && (
          <>
            <mesh position={[0, 0.5, -hd + 0.2]} material={plinthMat}>
              <boxGeometry args={[w, 0.36, 0.32]} />
            </mesh>
            <mesh position={[0, 0.5, hd - 0.2]} material={plinthMat}>
              <boxGeometry args={[w, 0.36, 0.32]} />
            </mesh>
            <mesh position={[-hw + 0.2, 0.5, 0]} material={plinthMat}>
              <boxGeometry args={[0.32, 0.36, d]} />
            </mesh>
            <mesh position={[hw - 0.2, 0.5, 0]} material={plinthMat}>
              <boxGeometry args={[0.32, 0.36, d]} />
            </mesh>
            <mesh position={[0, 0.48, 0]} material={plinthMat}>
              <boxGeometry args={[w - 0.4, 0.3, 0.24]} />
            </mesh>
            {columnPoints.map(([cx, cz], idx) => (
              <group key={idx} position={[cx, 0.4, cz]}>
                <mesh position={[0, 0.65, 0]} material={concreteMat} castShadow={shadows}>
                  <boxGeometry args={[0.32, 1.3, 0.32]} />
                </mesh>
                <mesh position={[0, 1.45, 0]} material={steelMat}>
                  <boxGeometry args={[0.08, 0.45, 0.08]} />
                </mesh>
              </group>
            ))}
          </>
        )}

        {/* FASE 2 & 3: KOLOM BETON PENUH + DINDING BATA ORANYE BERLUBANG PINTU & JENDELA */}
        {(phase === 'dinding' || phase === 'atap') && (
          <>
            {columnPoints.map(([cx, cz], idx) => (
              <mesh
                key={idx}
                position={[cx, phase === 'dinding' ? 1.35 : 1.75, cz]}
                material={concreteMat}
                castShadow={shadows}
              >
                <boxGeometry args={[0.34, phase === 'dinding' ? 2.1 : 2.9, 0.34]} />
              </mesh>
            ))}
            {/* Dinding Belakang & Samping Bata Merah */}
            <mesh
              position={[0, phase === 'dinding' ? 1.25 : 1.7, -hd + 0.2]}
              material={brickMat}
              castShadow={shadows}
              receiveShadow
            >
              <boxGeometry args={[w - 0.45, phase === 'dinding' ? 1.9 : 2.8, 0.26]} />
            </mesh>
            <mesh
              position={[-hw + 0.2, phase === 'dinding' ? 1.25 : 1.7, 0]}
              material={brickMat}
              castShadow={shadows}
              receiveShadow
            >
              <boxGeometry args={[0.26, phase === 'dinding' ? 1.9 : 2.8, d - 0.45]} />
            </mesh>
            <mesh
              position={[hw - 0.2, phase === 'dinding' ? 1.25 : 1.7, 0]}
              material={brickMat}
              castShadow={shadows}
              receiveShadow
            >
              <boxGeometry args={[0.26, phase === 'dinding' ? 1.9 : 2.8, d - 0.45]} />
            </mesh>
            {/* Dinding Sekat Dalam */}
            <mesh position={[0, phase === 'dinding' ? 1.15 : 1.55, -0.3]} material={brickMat}>
              <boxGeometry args={[w - 0.8, phase === 'dinding' ? 1.7 : 2.5, 0.22]} />
            </mesh>
            {/* Dinding Depan Kiri & Kanan (Menyisakan Bukaan Pintu di Tengah & Jendela) */}
            <mesh position={[-hw * 0.56, 0.72, hd - 0.2]} material={brickMat} castShadow={shadows}>
              <boxGeometry args={[w * 0.32, 0.85, 0.26]} />
            </mesh>
            <mesh position={[hw * 0.56, 0.72, hd - 0.2]} material={brickMat} castShadow={shadows}>
              <boxGeometry args={[w * 0.32, 0.85, 0.26]} />
            </mesh>
            {phase === 'atap' && (
              <>
                <mesh position={[0, 2.82, hd - 0.2]} material={brickMat}>
                  <boxGeometry args={[w - 0.4, 0.55, 0.26]} />
                </mesh>
                {/* Rangka Atap Kuda-Kuda & Usuk Kayu Hangat */}
                <mesh position={[0, 3.25, -hd]} material={woodMat}>
                  <boxGeometry args={[w + 0.65, 0.16, 0.18]} />
                </mesh>
                <mesh position={[0, 3.25, hd]} material={woodMat}>
                  <boxGeometry args={[w + 0.65, 0.16, 0.18]} />
                </mesh>
                <mesh position={[0, 4.18, 0]} material={woodMat} castShadow={shadows}>
                  <boxGeometry args={[w + 0.65, 0.18, 0.18]} />
                </mesh>
                {[-hw + 0.2, -hw * 0.45, 0, hw * 0.45, hw - 0.2].map((rx, idx) => (
                  <group key={idx} position={[rx, 3.72, 0]}>
                    <mesh position={[0, 0, -hd * 0.52]} rotation={[0.52, 0, 0]} material={woodMat} castShadow={shadows}>
                      <boxGeometry args={[0.14, 0.14, d * 0.62]} />
                    </mesh>
                    <mesh position={[0, 0, hd * 0.52]} rotation={[-0.52, 0, 0]} material={woodMat} castShadow={shadows}>
                      <boxGeometry args={[0.14, 0.14, d * 0.62]} />
                    </mesh>
                    <mesh position={[0, -0.45, 0]} material={woodMat}>
                      <boxGeometry args={[0.12, 0.12, d + 0.2]} />
                    </mesh>
                  </group>
                ))}
              </>
            )}
          </>
        )}

        {/* FASE 4 (FINISHING & SELESAI): DINDING ACIAN CAT + KUSEN JENDELA/PINTU + ATAP GENTENG TERAKOTA */}
        {isFinished && (
          <>
            <mesh position={[0, 1.75, 0]} material={plasterMat} castShadow={shadows} receiveShadow>
              <boxGeometry args={[w, 2.85, d]} />
            </mesh>
            {/* Pilar Teras Depan */}
            {[-0.95, 0.95].map((px, idx) => (
              <mesh key={idx} position={[px, 1.65, hd + 0.35]} material={plasterMat}>
                <boxGeometry args={[0.24, 2.6, 0.24]} />
              </mesh>
            ))}
            {/* Pintu Kayu & Jendela Kaca */}
            <mesh position={[0, 1.38, hd + 0.05]} material={woodDarkMat}>
              <boxGeometry args={[1.0, 2.05, 0.1]} />
            </mesh>
            {[-hw * 0.56, hw * 0.56].map((wx, idx) => (
              <group key={idx} position={[wx, 1.85, hd + 0.05]}>
                <mesh material={woodDarkMat}>
                  <boxGeometry args={[1.25, 1.15, 0.1]} />
                </mesh>
                <mesh position={[0, 0, 0.04]} material={windowMat}>
                  <boxGeometry args={[0.98, 0.9, 0.06]} />
                </mesh>
              </group>
            ))}
            {/* Atap Limasan / Pelana Genteng Terakota Penuh */}
            <mesh position={[0, 3.3, 0]} material={roofDarkMat}>
              <boxGeometry args={[w + 0.85, 0.22, d + 0.95]} />
            </mesh>
            <mesh
              position={[0, 4.02, 0]}
              rotation={[0, Math.PI / 4, 0]}
              material={roofMat}
              castShadow={shadows}
            >
              <coneGeometry args={[Math.max(w, d) * 0.78, 1.5, 4]} />
            </mesh>
          </>
        )}

        {/* PERANCAH KAYU/BAMBU (Muncul di Fase Dinding, Atap, & Finishing; Hilang saat Selesai) */}
        {(phase === 'dinding' || phase === 'atap' || phase === 'finishing') && (
          <>
            {[
              [-hw - 0.38, hd + 0.38],
              [hw + 0.38, hd + 0.38],
              [hw + 0.38, -hd - 0.38],
            ].map(([sx, sz], idx) => (
              <mesh key={idx} position={[sx, 1.8, sz]} material={bambooMat}>
                <cylinderGeometry args={[0.055, 0.065, 3.6, 5]} />
              </mesh>
            ))}
            <mesh position={[0, 2.15, hd + 0.38]} material={woodMat}>
              <boxGeometry args={[w + 0.9, 0.1, 0.24]} />
            </mesh>
            <mesh position={[hw + 0.38, 2.15, 0]} material={woodMat}>
              <boxGeometry args={[0.24, 0.1, d + 0.9]} />
            </mesh>
          </>
        )}

        {/* MATERIAL PROYEK DI HALAMAN (Bata Oranye, Balok Kayu, Pasir, Batako) — Dibersihkan Saat Selesai */}
        {phase !== 'selesai' ? (
          <>
            {/* Tumpukan Bata Oranye */}
            <mesh position={[hw * 0.65, 0.36, hd + 0.55]} material={brickMat} castShadow={shadows}>
              <boxGeometry args={[0.95, 0.55, 0.65]} />
            </mesh>
            {/* Gundukan Pasir */}
            <mesh position={[-hw * 0.65, 0.36, hd + 0.52]} material={bambooMat}>
              <coneGeometry args={[0.68, 0.62, 7]} />
            </mesh>
            {/* Tumpukan Balok Kayu */}
            <mesh position={[hw + 0.52, 0.28, 0.3]} material={woodMat}>
              <boxGeometry args={[0.55, 0.38, 1.5]} />
            </mesh>
          </>
        ) : (
          /* Semak Taman Rapi Saat Rumah Selesai */
          <>
            <mesh position={[-hw * 0.55, 0.4, hd + 0.45]} material={bushMat}>
              <icosahedronGeometry args={[0.35, 0]} />
            </mesh>
            <mesh position={[hw * 0.55, 0.4, hd + 0.45]} material={bushMat}>
              <icosahedronGeometry args={[0.35, 0]} />
            </mesh>
          </>
        )}
      </AssetModelLoader>
    </group>
  );
};
