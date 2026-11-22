import React from 'react';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface PropFurnitureItemProps {
  furnitureId: string;
  castShadow?: boolean;
  emissiveColor?: string;
  emissiveIntensity?: number;
}

/**
 * Set Furnitur Rumah Indonesia Low-Poly (Batch 5) mengacu pada Indonesian_home_furniture_set:
 * kasur lipat, ranjang single/queen berpola, meja makan kayu + kursi pastel, kursi rotan teal,
 * rak TV LED, kulkas 2 pintu, dan kompor gas 2 tungku lengkap dengan tabung gas LPG biru 3kg.
 */
export const PropFurnitureItem: React.FC<PropFurnitureItemProps> = ({
  furnitureId,
  castShadow = true,
  emissiveColor = '#000000',
  emissiveIntensity = 0,
}) => {
  const woodWarmMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const creamMat = getPaletteMaterial('wall_cream');
  const coralFrameMat = getCustomColorMaterial('#D97856', { roughness: 0.72 });
  const blanketTealMat = getCustomColorMaterial('#58B5B0', { roughness: 0.86 });
  const blanketCoralMat = getCustomColorMaterial('#E8927C', { roughness: 0.86 });
  const blanketYellowMat = getCustomColorMaterial('#F2CB6E', { roughness: 0.86 });
  const mintChairMat = getCustomColorMaterial('#4CC2B4', { roughness: 0.72 });
  const yellowChairMat = getCustomColorMaterial('#F2CB6E', { roughness: 0.72 });
  const rattanMat = getPaletteMaterial('bamboo_light');
  const whiteMat = getPaletteMaterial('flag_white');
  const steelMat = getPaletteMaterial('rail_steel');
  const gasBlueMat = getCustomColorMaterial('#3892D6', { roughness: 0.45, metalness: 0.18 });
  const slateMat = getCustomColorMaterial('#262E3B', { roughness: 0.4, metalness: 0.35 });

  const hasHighlight = emissiveIntensity > 0;
  const highlightMat = hasHighlight ? (
    <meshStandardMaterial
      color={emissiveColor}
      emissive={emissiveColor}
      emissiveIntensity={emissiveIntensity}
      transparent
      opacity={0.32}
    />
  ) : null;

  switch (furnitureId) {
    case 'kasur_lipat':
      return (
        <group>
          <mesh position={[0, 0.09, 0]} material={creamMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[0.92, 0.18, 1.9]} />
          </mesh>
          <mesh position={[0, 0.2, 0.3]} material={blanketTealMat} castShadow={castShadow}>
            <boxGeometry args={[0.9, 0.06, 1.12]} />
          </mesh>
          <mesh position={[0, 0.235, -0.08]} material={whiteMat}>
            <boxGeometry args={[0.88, 0.02, 0.24]} />
          </mesh>
          <mesh position={[0, 0.23, -0.62]} material={whiteMat} castShadow={castShadow}>
            <boxGeometry args={[0.6, 0.11, 0.34]} />
          </mesh>
          {hasHighlight && (
            <mesh position={[0, 0.16, 0]}>
              <boxGeometry args={[0.98, 0.32, 1.98]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );

    case 'tempat_tidur_single':
      return (
        <group>
          {/* Kaki & rangka kayu koral-hangat */}
          {[
            [-0.44, 0.11, -0.92],
            [0.44, 0.11, -0.92],
            [-0.44, 0.11, 0.92],
            [0.44, 0.11, 0.92],
          ].map(([lx, ly, lz], i) => (
            <mesh key={i} position={[lx, ly, lz]} material={coralFrameMat} castShadow={castShadow}>
              <boxGeometry args={[0.09, 0.22, 0.09]} />
            </mesh>
          ))}
          <mesh position={[0, 0.22, 0]} material={coralFrameMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[0.98, 0.12, 1.98]} />
          </mesh>
          <mesh position={[0, 0.56, -0.94]} material={coralFrameMat} castShadow={castShadow}>
            <boxGeometry args={[0.98, 0.68, 0.1]} />
          </mesh>
          {/* Kasur krem & selimut motif geometris */}
          <mesh position={[0, 0.36, 0.03]} material={creamMat} castShadow={castShadow}>
            <boxGeometry args={[0.9, 0.17, 1.82]} />
          </mesh>
          <mesh position={[0, 0.455, 0.32]} material={blanketTealMat} castShadow={castShadow}>
            <boxGeometry args={[0.92, 0.055, 1.06]} />
          </mesh>
          <mesh position={[-0.18, 0.486, 0.22]} material={blanketCoralMat}>
            <boxGeometry args={[0.32, 0.015, 0.38]} />
          </mesh>
          <mesh position={[0.2, 0.486, 0.46]} material={blanketYellowMat}>
            <boxGeometry args={[0.28, 0.015, 0.36]} />
          </mesh>
          <mesh position={[0, 0.49, -0.62]} material={whiteMat} castShadow={castShadow}>
            <boxGeometry args={[0.62, 0.12, 0.34]} />
          </mesh>
          {hasHighlight && (
            <mesh position={[0, 0.38, 0]}>
              <boxGeometry args={[1.04, 0.72, 2.04]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );

    case 'tempat_tidur_queen':
      return (
        <group>
          <mesh position={[0, 0.2, 0]} material={woodDarkMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[1.96, 0.24, 2.0]} />
          </mesh>
          <mesh position={[0, 0.68, -0.94]} material={woodWarmMat} castShadow={castShadow}>
            <boxGeometry args={[2.0, 0.88, 0.12]} />
          </mesh>
          <mesh position={[0, 0.4, 0.04]} material={creamMat} castShadow={castShadow}>
            <boxGeometry args={[1.84, 0.2, 1.84]} />
          </mesh>
          <mesh position={[0, 0.51, 0.32]} material={blanketCoralMat} castShadow={castShadow}>
            <boxGeometry args={[1.86, 0.06, 1.12]} />
          </mesh>
          <mesh position={[0, 0.545, 0.55]} material={blanketYellowMat}>
            <boxGeometry args={[1.86, 0.02, 0.36]} />
          </mesh>
          <mesh position={[-0.45, 0.54, -0.6]} material={whiteMat} castShadow={castShadow}>
            <boxGeometry args={[0.66, 0.12, 0.36]} />
          </mesh>
          <mesh position={[0.45, 0.54, -0.6]} material={whiteMat} castShadow={castShadow}>
            <boxGeometry args={[0.66, 0.12, 0.36]} />
          </mesh>
          {hasHighlight && (
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[2.04, 0.84, 2.06]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );

    case 'meja_kayu':
      return (
        <group>
          {/* 4 Kaki Meja */}
          {[
            [-0.78, 0.35, -0.36],
            [0.78, 0.35, -0.36],
            [-0.78, 0.35, 0.36],
            [0.78, 0.35, 0.36],
          ].map(([lx, ly, lz], i) => (
            <mesh key={i} position={[lx, ly, lz]} material={woodWarmMat} castShadow={castShadow}>
              <boxGeometry args={[0.085, 0.7, 0.085]} />
            </mesh>
          ))}
          <mesh position={[0, 0.73, 0]} material={rattanMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[1.82, 0.075, 0.9]} />
          </mesh>
          {/* 2 Kursi Makan Pastel (Mint & Kuning) */}
          {[
            { x: -0.4, mat: mintChairMat },
            { x: 0.4, mat: yellowChairMat },
          ].map((c, idx) => (
            <group key={idx} position={[c.x, 0, 0.48]}>
              <mesh position={[0, 0.38, 0]} material={c.mat} castShadow={castShadow}>
                <boxGeometry args={[0.42, 0.055, 0.4]} />
              </mesh>
              <mesh position={[0, 0.58, 0.17]} material={c.mat} castShadow={castShadow}>
                <boxGeometry args={[0.4, 0.36, 0.05]} />
              </mesh>
              {[
                [-0.15, 0.19, -0.14],
                [0.15, 0.19, -0.14],
                [-0.15, 0.19, 0.14],
                [0.15, 0.19, 0.14],
              ].map(([cx, cy, cz], li) => (
                <mesh key={li} position={[cx, cy, cz]} material={woodWarmMat}>
                  <cylinderGeometry args={[0.022, 0.016, 0.38, 6]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* Gelas & Buku di Meja */}
          <mesh position={[-0.36, 0.82, -0.05]} material={whiteMat} castShadow={castShadow}>
            <cylinderGeometry args={[0.06, 0.05, 0.11, 10]} />
          </mesh>
          <mesh position={[0.36, 0.79, 0.05]} material={mintChairMat}>
            <boxGeometry args={[0.3, 0.05, 0.22]} />
          </mesh>
          {hasHighlight && (
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[1.92, 0.85, 1.35]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );

    case 'kursi_santai':
      return (
        <group>
          {/* Kaki & rangka kursi rotan */}
          {[
            [-0.32, 0.16, -0.28],
            [0.32, 0.16, -0.28],
            [-0.32, 0.16, 0.28],
            [0.32, 0.16, 0.28],
          ].map(([lx, ly, lz], i) => (
            <mesh key={i} position={[lx, ly, lz]} material={rattanMat} castShadow={castShadow}>
              <cylinderGeometry args={[0.03, 0.024, 0.32, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 0.28, 0]} material={rattanMat} castShadow={castShadow}>
            <cylinderGeometry args={[0.42, 0.38, 0.08, 12]} />
          </mesh>
          {/* Lengkungan sandaran rotan */}
          <mesh position={[0, 0.62, -0.14]} rotation={[-0.14, 0, 0]} material={rattanMat} castShadow={castShadow}>
            <torusGeometry args={[0.38, 0.035, 8, 16, Math.PI * 1.15]} />
          </mesh>
          {[-0.24, -0.12, 0, 0.12, 0.24].map((rx) => (
            <mesh key={rx} position={[rx, 0.58, -0.32]} material={rattanMat}>
              <cylinderGeometry args={[0.015, 0.015, 0.44, 6]} />
            </mesh>
          ))}
          {/* Bantal dudukan & sandaran warna toska-mint */}
          <mesh position={[0, 0.36, 0.04]} material={mintChairMat} castShadow={castShadow}>
            <boxGeometry args={[0.64, 0.12, 0.58]} />
          </mesh>
          <mesh position={[0, 0.58, -0.18]} rotation={[-0.18, 0, 0]} material={mintChairMat} castShadow={castShadow}>
            <boxGeometry args={[0.5, 0.38, 0.13]} />
          </mesh>
          {hasHighlight && (
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.92, 0.9, 0.88]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );

    case 'tv_led':
      return (
        <group>
          {/* Meja Konsol Kayu Terang */}
          {[
            [-0.78, 0.1, -0.26],
            [0.78, 0.1, -0.26],
            [-0.78, 0.1, 0.26],
            [0.78, 0.1, 0.26],
          ].map(([lx, ly, lz], i) => (
            <mesh key={i} position={[lx, ly, lz]} material={woodWarmMat}>
              <boxGeometry args={[0.07, 0.2, 0.07]} />
            </mesh>
          ))}
          <mesh position={[0, 0.24, 0]} material={rattanMat} castShadow={castShadow}>
            <boxGeometry args={[1.76, 0.06, 0.62]} />
          </mesh>
          <mesh position={[0, 0.44, 0]} material={rattanMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[1.82, 0.07, 0.66]} />
          </mesh>
          {/* Kaki Stand TV */}
          <mesh position={[-0.36, 0.52, -0.04]} material={slateMat}>
            <boxGeometry args={[0.06, 0.12, 0.22]} />
          </mesh>
          <mesh position={[0.36, 0.52, -0.04]} material={slateMat}>
            <boxGeometry args={[0.06, 0.12, 0.22]} />
          </mesh>
          {/* Bodi & Layar TV LED */}
          <mesh position={[0, 0.96, -0.04]} material={slateMat} castShadow={castShadow}>
            <boxGeometry args={[1.46, 0.82, 0.07]} />
          </mesh>
          <mesh position={[0, 0.96, 0.005]}>
            <boxGeometry args={[1.36, 0.72, 0.015]} />
            <meshStandardMaterial
              color="#3B82A6"
              emissive="#1D6B8E"
              emissiveIntensity={0.28}
              roughness={0.2}
            />
          </mesh>
          {hasHighlight && (
            <mesh position={[0, 0.68, 0]}>
              <boxGeometry args={[1.9, 1.36, 0.72]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );

    case 'kulkas_mini':
      return (
        <group>
          <mesh position={[0, 0.72, 0]} material={whiteMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[0.8, 1.44, 0.78]} />
          </mesh>
          <mesh position={[0, 1.18, 0.4]} material={creamMat}>
            <boxGeometry args={[0.76, 0.44, 0.04]} />
          </mesh>
          <mesh position={[0, 0.48, 0.4]} material={creamMat}>
            <boxGeometry args={[0.76, 0.88, 0.04]} />
          </mesh>
          <mesh position={[0.3, 1.16, 0.435]} material={steelMat}>
            <boxGeometry args={[0.035, 0.24, 0.04]} />
          </mesh>
          <mesh position={[0.3, 0.72, 0.435]} material={steelMat}>
            <boxGeometry args={[0.035, 0.34, 0.04]} />
          </mesh>
          {hasHighlight && (
            <mesh position={[0, 0.74, 0]}>
              <boxGeometry args={[0.9, 1.5, 0.88]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );

    case 'kompor_gas':
    default:
      return (
        <group>
          {/* Kaki Meja Kompor */}
          {[
            [-0.42, 0.2, -0.22],
            [0.24, 0.2, -0.22],
            [-0.42, 0.2, 0.22],
            [0.24, 0.2, 0.22],
          ].map(([lx, ly, lz], i) => (
            <mesh key={i} position={[lx, ly, lz]} material={steelMat}>
              <boxGeometry args={[0.05, 0.4, 0.05]} />
            </mesh>
          ))}
          {/* Bodi Kompor Stainless 2 Tungku */}
          <mesh position={[-0.09, 0.46, 0]} material={whiteMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[0.8, 0.16, 0.56]} />
          </mesh>
          {[-0.28, 0.1].map((bx, i) => (
            <group key={i} position={[bx, 0.56, 0]}>
              <mesh material={slateMat}>
                <cylinderGeometry args={[0.13, 0.15, 0.04, 10]} />
              </mesh>
              {/* Panci aluminium + tutup */}
              <mesh position={[0, 0.1, 0]} material={steelMat} castShadow={castShadow}>
                <cylinderGeometry args={[0.12, 0.11, 0.14, 10]} />
              </mesh>
              <mesh position={[0, 0.18, 0]} material={whiteMat}>
                <cylinderGeometry args={[0.125, 0.125, 0.02, 10]} />
              </mesh>
            </group>
          ))}
          {/* Kenop depan */}
          <mesh position={[-0.28, 0.45, 0.29]} material={slateMat}>
            <cylinderGeometry args={[0.03, 0.03, 0.03, 8]} />
          </mesh>
          <mesh position={[0.1, 0.45, 0.29]} material={slateMat}>
            <cylinderGeometry args={[0.03, 0.03, 0.03, 8]} />
          </mesh>

          {/* Tabung Gas Elpiji 3kg/5kg Biru di Samping Kanan */}
          <group position={[0.42, 0, 0.14]}>
            <mesh position={[0, 0.24, 0]} material={gasBlueMat} castShadow={castShadow}>
              <cylinderGeometry args={[0.14, 0.14, 0.36, 12]} />
            </mesh>
            <mesh position={[0, 0.43, 0]} material={gasBlueMat}>
              <sphereGeometry args={[0.138, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            </mesh>
            <mesh position={[0, 0.5, 0]} material={gasBlueMat}>
              <cylinderGeometry args={[0.075, 0.075, 0.07, 10]} />
            </mesh>
          </group>
          {hasHighlight && (
            <mesh position={[0.05, 0.4, 0]}>
              <boxGeometry args={[1.02, 0.82, 0.8]} />
              {highlightMat}
            </mesh>
          )}
        </group>
      );
  }
};
