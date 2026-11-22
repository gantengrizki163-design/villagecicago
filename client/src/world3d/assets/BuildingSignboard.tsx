import React from 'react';
import { Text } from '@react-three/drei';
import { getPaletteMaterial, type PaletteToken } from './paletteMaterials';

export type SignboardVariant =
  | 'wood'
  | 'colonial'
  | 'modern'
  | 'clinic'
  | 'mart'
  | 'bank'
  | 'police';

interface BuildingSignboardProps {
  title: string;
  subtitle?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  variant?: SignboardVariant;
  isNight?: boolean;
  withPost?: boolean;
}

const VARIANT_STYLES: Record<
  SignboardVariant,
  { boardToken: PaletteToken; borderToken: PaletteToken; textColor: string; subColor: string }
> = {
  wood: {
    boardToken: 'wood_warm',
    borderToken: 'wood_dark',
    textColor: '#FFF7E8',
    subColor: '#FDE68A',
  },
  colonial: {
    boardToken: 'trim_colonial_green',
    borderToken: 'wall_cream',
    textColor: '#F5EBD8',
    subColor: '#F2BC2E',
  },
  modern: {
    boardToken: 'wall_cream',
    borderToken: 'wood_dark',
    textColor: '#2B303A',
    subColor: '#686E78',
  },
  clinic: {
    boardToken: 'wall_cream',
    borderToken: 'trim_clinic_green',
    textColor: '#1E5B32',
    subColor: '#D64937',
  },
  mart: {
    boardToken: 'wall_cream',
    borderToken: 'trim_mart_blue',
    textColor: '#1F4B99',
    subColor: '#EA3F33',
  },
  bank: {
    boardToken: 'trim_bank_blue',
    borderToken: 'trim_gold',
    textColor: '#F7F6F2',
    subColor: '#F2BC2E',
  },
  police: {
    boardToken: 'trim_police_dark',
    borderToken: 'trim_police_khaki',
    textColor: '#F5EBD8',
    subColor: '#F2BC2E',
  },
};

/**
 * Komponen papan nama terpisah yang dapat diubah teksnya secara dinamis.
 * Menghindari penulisan teks permanen pada geometri model bangunan 3D.
 */
export const BuildingSignboard: React.FC<BuildingSignboardProps> = ({
  title,
  subtitle,
  position = [0, 3.2, 0],
  rotation = [0, 0, 0],
  width = 3.6,
  height = 0.9,
  variant = 'wood',
  isNight = false,
  withPost = false,
}) => {
  const style = VARIANT_STYLES[variant];
  const boardMat = getPaletteMaterial(style.boardToken);
  const borderMat = getPaletteMaterial(style.borderToken);
  const postMat = getPaletteMaterial('rail_steel');
  const lampMat = getPaletteMaterial(isNight ? 'emissive_warm' : 'wall_cream');

  return (
    <group position={position} rotation={rotation}>
      {/* Bingkai Luar */}
      <mesh material={borderMat}>
        <boxGeometry args={[width + 0.16, height + 0.16, 0.12]} />
      </mesh>
      {/* Bidang Papan */}
      <mesh position={[0, 0, 0.03]} material={boardMat}>
        <boxGeometry args={[width, height, 0.08]} />
      </mesh>
      {/* Lampu Sorot Kecil di Atas Papan */}
      <mesh position={[0, height / 2 + 0.12, 0.14]} material={lampMat}>
        <boxGeometry args={[width * 0.45, 0.08, 0.16]} />
      </mesh>
      {/* Tiang Opsional (untuk papan halaman / pylon) */}
      {withPost && (
        <>
          <mesh position={[-width * 0.36, -height / 2 - 0.9, 0]} material={postMat}>
            <cylinderGeometry args={[0.07, 0.08, 1.8, 6]} />
          </mesh>
          <mesh position={[width * 0.36, -height / 2 - 0.9, 0]} material={postMat}>
            <cylinderGeometry args={[0.07, 0.08, 1.8, 6]} />
          </mesh>
        </>
      )}
      <Text
        position={[0, subtitle ? 0.12 : 0, 0.085]}
        fontSize={Math.min(0.32, height * 0.36)}
        maxWidth={width - 0.3}
        color={style.textColor}
        anchorX="center"
        anchorY="middle"
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          position={[0, -0.2, 0.085]}
          fontSize={Math.min(0.18, height * 0.22)}
          maxWidth={width - 0.3}
          color={style.subColor}
          anchorX="center"
          anchorY="middle"
        >
          {subtitle}
        </Text>
      )}
    </group>
  );
};
