import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface VehicleAngkotProps {
  quality?: GraphicsQuality;
  isNight?: boolean;
  castShadow?: boolean;
}

/**
 * Angkot Hijau Cicalengka low-poly (1.8 x 3.9 x 2.0 m, pivot bottom-center y=0, menghadap +Z).
 * Mengacu pada Low-poly_Indonesian_vehicle_set: bodi hijau, rak atap, kaca miring, & pintu samping terbuka.
 */
export const VehicleAngkot: React.FC<VehicleAngkotProps> = ({
  quality = 'medium',
  isNight = false,
  castShadow,
}) => {
  const shadows = castShadow ?? quality !== 'low';
  const bodyGreenMat = getPaletteMaterial('vehicle_angkot_green');
  const darkGreenMat = getCustomColorMaterial('#4E9B52', { roughness: 0.55 });
  const tireMat = getPaletteMaterial('vehicle_tire');
  const rimMat = getPaletteMaterial('concrete_grey', { roughness: 0.35, metalness: 0.4 });
  const glassMat = getPaletteMaterial('glass_day');
  const rackMat = getPaletteMaterial('rail_steel');
  const bumperMat = getCustomColorMaterial('#383E46', { roughness: 0.72 });
  const plateMat = getPaletteMaterial('tarp_yellow');
  const benchMat = getPaletteMaterial('wood_warm');
  const headlightMat = getPaletteMaterial('emissive_warm', {
    emissiveIntensity: isNight ? 1.8 : 0.25,
  });
  const tailLightMat = getPaletteMaterial('trim_mart_red');

  const wheelPositions: [number, number, number][] = [
    [-0.84, 0.3, 1.18],
    [0.84, 0.3, 1.18],
    [-0.84, 0.3, -1.16],
    [0.84, 0.3, -1.16],
  ];

  return (
    <AssetModelLoader assetId="vehicle_angkot" quality={quality} castShadow={shadows}>
      <group>
        {/* Sasis & Bodi Bawah */}
        <mesh position={[0, 0.55, 0]} material={bodyGreenMat} castShadow={shadows} receiveShadow>
          <boxGeometry args={[1.68, 0.62, 3.72]} />
        </mesh>
        {/* Lis Bodi Samping */}
        <mesh position={[0, 0.42, 0]} material={darkGreenMat}>
          <boxGeometry args={[1.72, 0.1, 3.66]} />
        </mesh>

        {/* Kabin Atas (belakang & kiri) + Atap */}
        <mesh position={[0, 1.44, -0.08]} material={bodyGreenMat} castShadow={shadows}>
          <boxGeometry args={[1.64, 0.2, 3.35]} />
        </mesh>
        {/* Pilar & Dinding Kiri Penuh */}
        <mesh position={[-0.76, 1.12, -0.15]} material={bodyGreenMat} castShadow={shadows}>
          <boxGeometry args={[0.14, 0.56, 3.15]} />
        </mesh>
        {/* Kaca Samping Kiri */}
        <mesh position={[-0.81, 1.13, -0.25]} material={glassMat}>
          <boxGeometry args={[0.06, 0.4, 2.35]} />
        </mesh>

        {/* Sisi Kanan: Pilar Depan, Pilar Belakang, & Pintu Geser Terbuka */}
        <mesh position={[0.76, 1.12, 0.92]} material={bodyGreenMat} castShadow={shadows}>
          <boxGeometry args={[0.14, 0.56, 0.92]} />
        </mesh>
        <mesh position={[0.76, 1.12, -1.25]} material={bodyGreenMat} castShadow={shadows}>
          <boxGeometry args={[0.14, 0.56, 0.95]} />
        </mesh>
        {/* Kaca Depan Kanan & Belakang Kanan */}
        <mesh position={[0.81, 1.13, 0.92]} material={glassMat}>
          <boxGeometry args={[0.06, 0.4, 0.68]} />
        </mesh>
        <mesh position={[0.81, 1.13, -1.25]} material={glassMat}>
          <boxGeometry args={[0.06, 0.4, 0.72]} />
        </mesh>

        {/* Bangku Penumpang Interior (terlihat melalui pintu terbuka) */}
        <mesh position={[-0.45, 0.64, -0.45]} material={benchMat}>
          <boxGeometry args={[0.42, 0.16, 1.8]} />
        </mesh>
        <mesh position={[0.45, 0.64, -0.95]} material={benchMat}>
          <boxGeometry args={[0.42, 0.16, 0.85]} />
        </mesh>

        {/* Dinding Belakang & Kaca Belakang */}
        <mesh position={[0, 1.12, -1.78]} material={bodyGreenMat} castShadow={shadows}>
          <boxGeometry args={[1.64, 0.56, 0.16]} />
        </mesh>
        <mesh position={[0, 1.14, -1.84]} material={glassMat}>
          <boxGeometry args={[1.25, 0.36, 0.06]} />
        </mesh>

        {/* Hidung Kabin & Kaca Depan Miring */}
        <mesh position={[0, 1.06, 1.56]} rotation={[-0.24, 0, 0]} material={bodyGreenMat} castShadow={shadows}>
          <boxGeometry args={[1.64, 0.62, 0.42]} />
        </mesh>
        <mesh position={[0, 1.12, 1.72]} rotation={[-0.24, 0, 0]} material={glassMat}>
          <boxGeometry args={[1.42, 0.44, 0.12]} />
        </mesh>

        {/* Bemper Depan & Belakang, Pelat Kuning, Lampu */}
        <mesh position={[0, 0.28, 1.88]} material={bumperMat}>
          <boxGeometry args={[1.74, 0.16, 0.14]} />
        </mesh>
        <mesh position={[0, 0.28, -1.88]} material={bumperMat}>
          <boxGeometry args={[1.74, 0.16, 0.14]} />
        </mesh>
        <mesh position={[0, 0.28, 1.96]} material={plateMat}>
          <boxGeometry args={[0.46, 0.11, 0.03]} />
        </mesh>
        <mesh position={[-0.6, 0.52, 1.88]} material={headlightMat}>
          <boxGeometry args={[0.26, 0.15, 0.06]} />
        </mesh>
        <mesh position={[0.6, 0.52, 1.88]} material={headlightMat}>
          <boxGeometry args={[0.26, 0.15, 0.06]} />
        </mesh>
        <mesh position={[-0.66, 0.54, -1.88]} material={tailLightMat}>
          <boxGeometry args={[0.2, 0.18, 0.05]} />
        </mesh>
        <mesh position={[0.66, 0.54, -1.88]} material={tailLightMat}>
          <boxGeometry args={[0.2, 0.18, 0.05]} />
        </mesh>

        {/* Rak Bagasi Atap (Roof Rack) */}
        <group position={[0, 1.62, -0.15]}>
          <mesh position={[-0.64, 0.06, 0]} material={rackMat}>
            <boxGeometry args={[0.06, 0.12, 2.25]} />
          </mesh>
          <mesh position={[0.64, 0.06, 0]} material={rackMat}>
            <boxGeometry args={[0.06, 0.12, 2.25]} />
          </mesh>
          {[-0.95, -0.32, 0.32, 0.95].map((rz) => (
            <mesh key={rz} position={[0, 0.05, rz]} material={rackMat}>
              <boxGeometry args={[1.32, 0.05, 0.05]} />
            </mesh>
          ))}
        </group>

        {/* 4 Roda */}
        {wheelPositions.map(([wx, wy, wz], idx) => (
          <group key={idx} position={[wx, wy, wz]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={tireMat} castShadow={shadows}>
              <cylinderGeometry args={[0.3, 0.3, 0.2, 12]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
              <cylinderGeometry args={[0.16, 0.16, 0.215, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    </AssetModelLoader>
  );
};
