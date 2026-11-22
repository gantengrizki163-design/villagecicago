import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getLampMaterial, getPaletteMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Diorama_Kota_Indonesia_dengan_Stasiun_Kereta_53a7c2cc.png

interface PropJpoBridgeProps {
  quality: GraphicsQuality;
  isNight?: boolean;
  spanLength?: number;
}

/**
 * Jembatan Penyeberangan Orang (JPO) rangka baja abu-abu dengan tangga ganda
 * dan atap seng melintang di atas rel kereta.
 */
export const PropJpoBridge: React.FC<PropJpoBridgeProps> = ({
  quality,
  isNight = false,
  spanLength = 12,
}) => {
  const shadows = quality !== 'low';
  const steelMat = getPaletteMaterial('rail_steel');
  const deckMat = getPaletteMaterial('concrete_grey');
  const canopyMat = getPaletteMaterial('roof_metal_grey');
  const lampMat = getLampMaterial(isNight);

  const halfSpan = spanLength / 2;

  return (
    <AssetModelLoader assetId="prop_jpo_bridge" quality={quality} castShadow={shadows}>
      <group>
        {/* Tiang Penyangga Utama */}
        {[-halfSpan, halfSpan].map((zCol, idx) => (
          <group key={idx} position={[0, 0, zCol]}>
            <mesh position={[-1.4, 2.2, 0]} material={steelMat} castShadow={shadows}>
              <boxGeometry args={[0.32, 4.4, 0.32]} />
            </mesh>
            <mesh position={[1.4, 2.2, 0]} material={steelMat} castShadow={shadows}>
              <boxGeometry args={[0.32, 4.4, 0.32]} />
            </mesh>
            {/* Tangga Akses Miring */}
            <mesh
              position={[0, 2.05, idx === 0 ? -2.6 : 2.6]}
              rotation={[idx === 0 ? -0.68 : 0.68, 0, 0]}
              material={deckMat}
              castShadow={shadows}
            >
              <boxGeometry args={[2.3, 0.25, 6.2]} />
            </mesh>
            <mesh
              position={[-1.1, 2.65, idx === 0 ? -2.6 : 2.6]}
              rotation={[idx === 0 ? -0.68 : 0.68, 0, 0]}
              material={steelMat}
            >
              <boxGeometry args={[0.1, 0.85, 6.2]} />
            </mesh>
            <mesh
              position={[1.1, 2.65, idx === 0 ? -2.6 : 2.6]}
              rotation={[idx === 0 ? -0.68 : 0.68, 0, 0]}
              material={steelMat}
            >
              <boxGeometry args={[0.1, 0.85, 6.2]} />
            </mesh>
          </group>
        ))}

        {/* Lantai Dek Penyeberangan */}
        <mesh position={[0, 4.2, 0]} material={deckMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[2.8, 0.28, spanLength + 0.6]} />
        </mesh>

        {/* Pagar Rangka Baja Kiri & Kanan */}
        {[-1.32, 1.32].map((rx, i) => (
          <group key={i} position={[rx, 4.85, 0]}>
            <mesh position={[0, 0.45, 0]} material={steelMat}>
              <boxGeometry args={[0.1, 0.12, spanLength + 0.4]} />
            </mesh>
            <mesh position={[0, -0.05, 0]} material={steelMat}>
              <boxGeometry args={[0.1, 0.12, spanLength + 0.4]} />
            </mesh>
            {[-4, -2, 0, 2, 4].map((pz) => (
              <mesh key={pz} position={[0, 0.2, pz]} material={steelMat}>
                <boxGeometry args={[0.12, 1.15, 0.12]} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Atap Kanopi JPO + Lampu Lorong */}
        <mesh position={[0, 5.75, 0]} material={canopyMat} castShadow={shadows}>
          <boxGeometry args={[3.1, 0.18, spanLength + 1.0]} />
        </mesh>
        {[-3, 0, 3].map((lz) => (
          <mesh key={lz} position={[0, 5.58, lz]} material={lampMat}>
            <boxGeometry args={[0.4, 0.08, 0.4]} />
          </mesh>
        ))}
      </group>
    </AssetModelLoader>
  );
};
