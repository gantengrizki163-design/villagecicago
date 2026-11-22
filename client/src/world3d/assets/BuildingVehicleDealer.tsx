import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { getVehicleModelById } from '../../firebase/vehicleConfigCache';
import type { GraphicsQuality } from '../../types/game';
import { VehicleModelMesh } from '../vehicles/VehicleModelMesh';
import { BuildingSignboard } from './BuildingSignboard';
import {
  getCustomColorMaterial,
  getLampMaterial,
  getPaletteMaterial,
  getWindowMaterial,
} from './paletteMaterials';

export type DealerBuildingVariant = 'motor_new' | 'motor_used' | 'mobil_new' | 'mobil_used';

interface BuildingVehicleDealerProps {
  variant: DealerBuildingVariant;
  title: string;
  subtitle?: string;
  width: number;
  depth: number;
  quality: GraphicsQuality;
  isNight: boolean;
}

function formatMillionPrice(rupiah: number): string {
  if (rupiah >= 1_000_000) {
    const jt = rupiah / 1_000_000;
    return `Rp ${Number.isInteger(jt) ? jt : jt.toFixed(1)} Jt`;
  }
  return `Rp ${Math.round(rupiah / 1000)} Rb`;
}

/**
 * Bangunan Dealer Motor, Lapak Motor Bekas, Showroom Mobil Baru, & Showroom Mobil Bekas.
 * Pivot: bottom-center (y=0), menghadap +Z. Menampilkan kendaraan contoh 3D asli & penanda harga.
 */
export const BuildingVehicleDealer: React.FC<BuildingVehicleDealerProps> = ({
  variant,
  title,
  subtitle,
  width,
  depth,
  quality,
  isNight,
}) => {
  const shadows = quality !== 'low';
  const isNew = variant === 'motor_new' || variant === 'mobil_new';
  const isMotor = variant === 'motor_new' || variant === 'motor_used';

  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getPaletteMaterial(isNew ? 'wall_cream' : 'wall_pastel_mint');
  const fasciaMat = getPaletteMaterial(
    variant === 'motor_new'
      ? 'tarp_red'
      : variant === 'motor_used'
        ? 'tarp_yellow'
        : variant === 'mobil_new'
          ? 'trim_bank_blue'
          : 'tarp_blue'
  );
  const metalMat = getPaletteMaterial('roof_metal_grey');
  const darkTrimMat = getPaletteMaterial('vehicle_bumper_dark');
  const glassMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);
  const bannerGreenMat = getPaletteMaterial('trim_colonial_green');
  const buntingRed = getCustomColorMaterial('#EA3F33', { roughness: 0.7 });
  const buntingYellow = getCustomColorMaterial('#F2BC2E', { roughness: 0.7 });
  const buntingBlue = getCustomColorMaterial('#2563EB', { roughness: 0.7 });

  const showcaseItems = useMemo(() => {
    if (variant === 'motor_new') {
      const m1 = getVehicleModelById('motor_sport');
      const m2 = getVehicleModelById('motor_matic');
      return [
        {
          modelId: 'motor_sport',
          color: '#DC2626',
          label: formatMillionPrice(m1?.newPrice ?? 1650000),
          pos: [-1.85, 0.24, depth * 0.14] as [number, number, number],
          rotY: 0.38,
        },
        {
          modelId: 'motor_matic',
          color: '#0EA5E9',
          label: formatMillionPrice(m2?.newPrice ?? 880000),
          pos: [1.85, 0.24, depth * 0.14] as [number, number, number],
          rotY: -0.35,
        },
      ];
    }
    if (variant === 'motor_used') {
      const m1 = getVehicleModelById('motor_tua');
      const m2 = getVehicleModelById('motor_bebek');
      return [
        {
          modelId: 'motor_tua',
          color: '#D97706',
          label: `BEKAS ${formatMillionPrice(m1?.usedPriceMin ?? 260000)}`,
          pos: [-1.7, 0.18, depth * 0.26] as [number, number, number],
          rotY: 0.45,
        },
        {
          modelId: 'motor_bebek',
          color: '#16A34A',
          label: `BEKAS ${formatMillionPrice(m2?.usedPriceMin ?? 360000)}`,
          pos: [1.7, 0.18, depth * 0.26] as [number, number, number],
          rotY: -0.32,
        },
      ];
    }
    if (variant === 'mobil_new') {
      const c1 = getVehicleModelById('mobil_suv');
      const c2 = getVehicleModelById('mobil_sedan');
      return [
        {
          modelId: 'mobil_suv',
          color: '#1E3A8A',
          label: formatMillionPrice(c1?.newPrice ?? 5800000),
          pos: [-2.4, 0.28, depth * 0.1] as [number, number, number],
          rotY: 0.24,
        },
        {
          modelId: 'mobil_sedan',
          color: '#F8FAFC',
          label: formatMillionPrice(c2?.newPrice ?? 4200000),
          pos: [2.4, 0.28, depth * 0.1] as [number, number, number],
          rotY: -0.24,
        },
      ];
    }
    const u1 = getVehicleModelById('mobil_mpv');
    const u2 = getVehicleModelById('mobil_city');
    return [
      {
        modelId: 'mobil_mpv',
        color: '#94A3B8',
        label: `BEKAS ${formatMillionPrice(u1?.usedPriceMin ?? 2400000)}`,
        pos: [-2.45, 0.2, depth * 0.18] as [number, number, number],
        rotY: 0.22,
      },
      {
        modelId: 'mobil_city',
        color: '#FACC15',
        label: `BEKAS ${formatMillionPrice(u2?.usedPriceMin ?? 1400000)}`,
        pos: [2.45, 0.2, depth * 0.18] as [number, number, number],
        rotY: -0.22,
      },
    ];
  }, [depth, variant]);

  const halfW = width / 2;
  const halfD = depth / 2;
  const wallH = isNew ? 4.0 : 3.1;

  return (
    <group>
      {/* Pelataran Paving & Apron */}
      <mesh position={[0, 0.08, 0.12]} material={pavingMat} receiveShadow>
        <boxGeometry args={[width + 0.5, 0.16, depth + 0.55]} />
      </mesh>

      {isNew ? (
        <>
          {/* Plint & Dinding Belakang + Samping Kaca Showroom Modern */}
          <mesh position={[0, 0.28, -0.35]} material={plinthMat} receiveShadow>
            <boxGeometry args={[width, 0.24, depth - 0.7]} />
          </mesh>
          <mesh position={[0, wallH / 2 + 0.2, -halfD + 0.65]} material={wallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[width - 0.1, wallH, 1.1]} />
          </mesh>
          {/* Kaca Etalase Samping & Depan Semi-Terbuka */}
          <mesh position={[-halfW + 0.22, wallH / 2 + 0.2, 0.15]} material={glassMat} castShadow={shadows}>
            <boxGeometry args={[0.22, wallH - 0.3, depth - 0.9]} />
          </mesh>
          <mesh position={[halfW - 0.22, wallH / 2 + 0.2, 0.15]} material={glassMat} castShadow={shadows}>
            <boxGeometry args={[0.22, wallH - 0.3, depth - 0.9]} />
          </mesh>
          {/* Kolom Depan */}
          {[-halfW + 0.35, 0, halfW - 0.35].map((cx, i) => (
            <mesh key={i} position={[cx, wallH / 2 + 0.2, halfD - 0.2]} material={metalMat} castShadow={shadows}>
              <boxGeometry args={[0.32, wallH, 0.32]} />
            </mesh>
          ))}
          {/* Atap Kanopi Datar Modern & Lis Aksen */}
          <mesh position={[0, wallH + 0.42, 0.1]} material={metalMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[width + 0.4, 0.36, depth + 0.45]} />
          </mesh>
          <mesh position={[0, wallH + 0.52, halfD + 0.3]} material={fasciaMat}>
            <boxGeometry args={[width + 0.42, 0.42, 0.16]} />
          </mesh>
          {/* Meja Kasir / Sales di Dalam */}
          <mesh position={[0, 0.72, -halfD + 1.55]} material={fasciaMat}>
            <boxGeometry args={[2.2, 0.9, 0.7]} />
          </mesh>
        </>
      ) : (
        <>
          {/* Kanopi Terbuka Lapak / Showroom Bekas + Kios Sales Belakang */}
          <mesh position={[0, 1.5, -halfD + 0.95]} material={wallMat} castShadow={shadows} receiveShadow>
            <boxGeometry args={[width * 0.65, 2.7, 1.65]} />
          </mesh>
          <mesh position={[0, 1.65, -halfD + 1.8]} material={glassMat}>
            <boxGeometry args={[2.4, 1.15, 0.08]} />
          </mesh>
          {/* 4 Tiang Baja Kanopi */}
          {[
            [-halfW + 0.35, -halfD + 0.45],
            [halfW - 0.35, -halfD + 0.45],
            [-halfW + 0.35, halfD - 0.3],
            [halfW - 0.35, halfD - 0.3],
          ].map(([cx, cz], i) => (
            <mesh key={i} position={[cx, 1.68, cz]} material={darkTrimMat} castShadow={shadows}>
              <cylinderGeometry args={[0.1, 0.12, 3.25, 6]} />
            </mesh>
          ))}
          {/* Atap Miring Galvalum / Tenda */}
          <mesh
            position={[0, 3.4, 0.05]}
            rotation={[0.09, 0, 0]}
            material={fasciaMat}
            castShadow={shadows}
            receiveShadow
          >
            <boxGeometry args={[width + 0.4, 0.2, depth + 0.35]} />
          </mesh>
          {/* Bendera Rumbai Warna-Warni Khas Showroom/Lapak Bekas */}
          {[-3, -2, -1, 0, 1, 2, 3].map((idx) => (
            <mesh
              key={idx}
              position={[idx * (width * 0.12), 3.06, halfD + 0.18]}
              rotation={[0, 0, Math.PI]}
              material={idx % 3 === 0 ? buntingRed : idx % 3 === 1 ? buntingYellow : buntingBlue}
            >
              <coneGeometry args={[0.24, 0.34, 3]} />
            </mesh>
          ))}
        </>
      )}

      {/* Lampu Sorot Kanopi */}
      {[-width * 0.25, width * 0.25].map((lx, idx) => (
        <mesh key={idx} position={[lx, isNew ? wallH + 0.18 : 3.18, halfD * 0.4]} material={lampMat}>
          <boxGeometry args={[0.55, 0.08, 0.28]} />
        </mesh>
      ))}

      {/* Kendaraan Contoh 3D + Podium / Penanda Harga */}
      {showcaseItems.map((item, idx) => (
        <group key={idx} position={item.pos}>
          {/* Podium Pajangan */}
          <mesh position={[0, -0.06, 0]} material={isNew ? bannerGreenMat : plinthMat} receiveShadow>
            <boxGeometry args={[isMotor ? 1.55 : 2.9, 0.14, isMotor ? 2.15 : 4.2]} />
          </mesh>
          <group rotation={[0, item.rotY, 0]} scale={isMotor ? 0.92 : 0.72}>
            <VehicleModelMesh
              modelId={item.modelId}
              color={item.color}
              quality={quality}
              isNight={isNight}
              headlightsOn={isNight}
              lod={quality === 'low' ? 'simple' : 'full'}
              castShadow={false}
            />
          </group>
          <Text
            position={[0, isMotor ? 1.65 : 1.95, 0]}
            fontSize={0.28}
            color="#FDE68A"
            anchorX="center"
            outlineWidth={0.035}
            outlineColor="#0F172A"
          >
            {item.label}
          </Text>
        </group>
      ))}

      {/* Papan Nama Showroom / Dealer */}
      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, isNew ? wallH + 1.05 : 3.92, halfD + 0.12]}
        width={Math.min(5.8, width * 0.78)}
        height={0.88}
        variant={variant === 'mobil_new' ? 'bank' : variant === 'motor_new' ? 'mart' : 'modern'}
        isNight={isNight}
      />
    </group>
  );
};
