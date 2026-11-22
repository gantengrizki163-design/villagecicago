import React from 'react';
import { Text } from '@react-three/drei';
import type { GraphicsQuality } from '../../types/game';
import { BuildingSignboard } from './BuildingSignboard';
import {
  getCustomColorMaterial,
  getLampMaterial,
  getPaletteMaterial,
  getWindowMaterial,
} from './paletteMaterials';

interface SpbuProps {
  quality: GraphicsQuality;
  isNight: boolean;
}

/**
 * SPBU & Stasiun Cas EV Cicalengka.
 * Pivot: bottom-center (y=0), menghadap +Z (lokal footprint width=10, depth=7).
 */
export const BuildingSpbu: React.FC<SpbuProps> = ({ quality, isNight }) => {
  const shadows = quality !== 'low';
  const pavingMat = getPaletteMaterial('paving_stone');
  const redMat = getPaletteMaterial('tarp_red');
  const whiteMat = getPaletteMaterial('flag_white');
  const evBlueMat = getPaletteMaterial('vehicle_ev_accent');
  const darkMetalMat = getPaletteMaterial('vehicle_bumper_dark');
  const steelMat = getPaletteMaterial('rail_steel');
  const screenMat = getPaletteMaterial('vehicle_ev_accent');
  const wallMat = getPaletteMaterial('wall_cream');
  const glassMat = getWindowMaterial(isNight);
  const lampMat = getLampMaterial(isNight);

  return (
    <group>
      {/* Lantai Beton SPBU */}
      <mesh position={[0, 0.08, 0]} material={pavingMat} receiveShadow>
        <boxGeometry args={[10.2, 0.16, 7.2]} />
      </mesh>

      {/* Kios Pembayaran & Mini Kasir di Sisi Belakang (-Z) */}
      <mesh position={[-2.6, 1.5, -2.15]} material={wallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[3.6, 2.7, 2.0]} />
      </mesh>
      <mesh position={[-2.6, 1.65, -1.12]} material={glassMat}>
        <boxGeometry args={[2.5, 1.25, 0.08]} />
      </mesh>

      {/* Totem Harga BBM & Listrik di Sisi Depan Kanan */}
      <mesh position={[3.9, 1.85, 2.55]} material={redMat} castShadow={shadows}>
        <boxGeometry args={[1.1, 3.4, 0.4]} />
      </mesh>
      <mesh position={[3.9, 2.15, 2.77]} material={screenMat}>
        <boxGeometry args={[0.82, 1.3, 0.04]} />
      </mesh>

      {/* 4 Pilar Kanopi SPBU */}
      {[
        [-3.6, -0.4],
        [3.6, -0.4],
        [-3.6, 2.1],
        [3.6, 2.1],
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, 2.05, pz]} material={whiteMat} castShadow={shadows}>
          <boxGeometry args={[0.42, 3.85, 0.42]} />
        </mesh>
      ))}

      {/* Atap Kanopi Merah-Putih SPBU */}
      <mesh position={[0, 4.18, 0.7]} material={whiteMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[9.4, 0.56, 4.8]} />
      </mesh>
      <mesh position={[0, 4.3, 3.12]} material={redMat}>
        <boxGeometry args={[9.44, 0.36, 0.14]} />
      </mesh>
      <mesh position={[0, 4.3, -1.72]} material={redMat}>
        <boxGeometry args={[9.44, 0.36, 0.14]} />
      </mesh>

      {/* Lampu Kanopi */}
      {[-2.2, 0, 2.2].map((lx, idx) => (
        <mesh key={idx} position={[lx, 3.86, 0.7]} material={lampMat}>
          <boxGeometry args={[0.9, 0.08, 0.5]} />
        </mesh>
      ))}

      {/* Pulau Dispenser BBM 1 & 2 */}
      {[-1.4, 1.4].map((dx, idx) => (
        <group key={idx} position={[dx, 0.16, 0.75]}>
          <mesh position={[0, 0.1, 0]} material={darkMetalMat}>
            <boxGeometry args={[1.35, 0.2, 0.9]} />
          </mesh>
          <mesh position={[0, 0.92, 0]} material={redMat} castShadow={shadows}>
            <boxGeometry args={[0.78, 1.45, 0.52]} />
          </mesh>
          <mesh position={[0, 1.2, 0.27]} material={screenMat}>
            <boxGeometry args={[0.56, 0.42, 0.04]} />
          </mesh>
          <mesh position={[0.48, 0.95, 0]} material={steelMat}>
            <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
          </mesh>
        </group>
      ))}

      {/* Stasiun Pengisian Daya Motor/Mobil Listrik (EV Fast Charger) */}
      <group position={[2.2, 0.16, -2.0]}>
        <mesh position={[0, 0.95, 0]} material={evBlueMat} castShadow={shadows}>
          <boxGeometry args={[0.7, 1.65, 0.48]} />
        </mesh>
        <mesh position={[0, 1.25, 0.25]} material={screenMat}>
          <boxGeometry args={[0.46, 0.46, 0.04]} />
        </mesh>
        <Text position={[0, 2.02, 0.2]} fontSize={0.22} color="#38BDF8" anchorX="center" outlineWidth={0.025} outlineColor="#0F172A">
          CAS EV
        </Text>
      </group>

      <BuildingSignboard
        title="SPBU CICALENGKA"
        subtitle="BENSIN & STASIUN CAS EV"
        position={[0, 4.92, 3.05]}
        width={5.8}
        height={0.86}
        variant="clinic"
        isNight={isNight}
      />
    </group>
  );
};

interface BengkelProps {
  title?: string;
  subtitle?: string;
  quality: GraphicsQuality;
  isNight: boolean;
}

/**
 * Bengkel Resmi & Tambal Ban (width=8, depth=5).
 */
export const BuildingBengkel: React.FC<BengkelProps> = ({
  title = 'BENGKEL PRIANGAN',
  subtitle = 'SERVIS · OLI · CAT · AKSESORIS',
  quality,
  isNight,
}) => {
  const shadows = quality !== 'low';
  const pavingMat = getPaletteMaterial('paving_stone');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const wallMat = getPaletteMaterial('wall_cream');
  const roofMat = getPaletteMaterial('roof_metal_grey');
  const blueTrim = getPaletteMaterial('tarp_blue');
  const orangeMat = getPaletteMaterial('tarp_yellow');
  const redMat = getPaletteMaterial('tarp_red');
  const tireMat = getPaletteMaterial('vehicle_tire');
  const lampMat = getLampMaterial(isNight);

  return (
    <group>
      <mesh position={[0, 0.08, 0.1]} material={pavingMat} receiveShadow>
        <boxGeometry args={[8.2, 0.16, 5.2]} />
      </mesh>
      {/* Dinding Samping & Belakang Workshop */}
      <mesh position={[0, 1.65, -2.0]} material={wallMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[7.8, 3.1, 0.9]} />
      </mesh>
      <mesh position={[-3.7, 1.65, 0.2]} material={wallMat} castShadow={shadows}>
        <boxGeometry args={[0.45, 3.1, 4.1]} />
      </mesh>
      <mesh position={[3.7, 1.65, 0.2]} material={wallMat} castShadow={shadows}>
        <boxGeometry args={[0.45, 3.1, 4.1]} />
      </mesh>
      {/* Atap Seng Bergelombang & Lis Biru Bengkel */}
      <mesh position={[0, 3.42, 0.15]} rotation={[0.08, 0, 0]} material={roofMat} castShadow={shadows} receiveShadow>
        <boxGeometry args={[8.3, 0.28, 5.15]} />
      </mesh>
      <mesh position={[0, 3.22, 2.55]} material={blueTrim}>
        <boxGeometry args={[8.2, 0.36, 0.18]} />
      </mesh>
      {/* Bay Lifter Hidrolik & Meja Alat */}
      <mesh position={[-1.2, 0.22, 0.5]} material={redMat}>
        <boxGeometry args={[2.1, 0.14, 2.6]} />
      </mesh>
      <mesh position={[-1.2, 1.35, -1.25]} material={plinthMat}>
        <boxGeometry args={[0.24, 2.4, 0.24]} />
      </mesh>
      {/* Tangki Kompresor Merah */}
      <mesh position={[2.55, 0.65, -1.1]} rotation={[0, 0, Math.PI / 2]} material={redMat}>
        <cylinderGeometry args={[0.32, 0.32, 1.05, 8]} />
      </mesh>
      {/* Rak Perkakas & Tumpukan Ban */}
      <mesh position={[1.0, 0.72, -1.35]} material={orangeMat}>
        <boxGeometry args={[1.4, 1.2, 0.5]} />
      </mesh>
      {[0, 1, 2].map((idx) => (
        <mesh key={idx} position={[3.05, 0.24 + idx * 0.22, 1.4]} rotation={[Math.PI / 2, 0, 0]} material={tireMat}>
          <torusGeometry args={[0.3, 0.11, 6, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 3.05, 1.4]} material={lampMat}>
        <boxGeometry args={[1.8, 0.08, 0.26]} />
      </mesh>

      <BuildingSignboard
        title={title}
        subtitle={subtitle}
        position={[0, 3.88, 2.5]}
        width={5.2}
        height={0.82}
        variant="mart"
        isNight={isNight}
      />
    </group>
  );
};

interface SamsatSimCornerProps {
  position: [number, number, number];
  isNight: boolean;
}

/**
 * Penanda Loket Samsat, Pajak STNK & Kerucut Praktik Ujian SIM di Halaman Kantor Desa.
 */
export const SamsatSimKioskProp: React.FC<SamsatSimCornerProps> = ({ position, isNight }) => {
  const coneMat = getCustomColorMaterial('#F97316', { roughness: 0.55 });
  const baseMat = getPaletteMaterial('vehicle_bumper_dark');

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <BuildingSignboard
        title="SAMSAT & UJIAN SIM"
        subtitle="PAJAK STNK · SIM A & C"
        position={[0, 2.15, 0]}
        width={2.6}
        height={0.78}
        variant="bank"
        withPost
        isNight={isNight}
      />
      {[-0.9, 0, 0.9].map((cx, idx) => (
        <group key={idx} position={[cx, 0, 0.75]}>
          <mesh position={[0, 0.04, 0]} material={baseMat}>
            <boxGeometry args={[0.32, 0.08, 0.32]} />
          </mesh>
          <mesh position={[0, 0.26, 0]} material={coneMat}>
            <coneGeometry args={[0.12, 0.42, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
