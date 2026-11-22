import React, { useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTrafficConfig } from '../../firebase/vehicleConfigCache';
import type { GraphicsQuality } from '../../types/game';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

interface TrafficInfrastructureProps {
  serverOffsetMs: number;
  quality: GraphicsQuality;
  isNight: boolean;
}

interface LightBulbRefs {
  ewRed: THREE.MeshStandardMaterial | null;
  ewYellow: THREE.MeshStandardMaterial | null;
  ewGreen: THREE.MeshStandardMaterial | null;
  nsRed: THREE.MeshStandardMaterial | null;
  nsYellow: THREE.MeshStandardMaterial | null;
  nsGreen: THREE.MeshStandardMaterial | null;
}

export interface DeterministicTrafficLightPhase {
  ewSignal: 'green' | 'yellow' | 'red';
  nsSignal: 'green' | 'yellow' | 'red';
}

export function getDeterministicTrafficLightPhase(
  nowMs: number,
  phaseOffsetMs: number,
  cycleMs: number,
  greenMs: number,
  yellowMs: number
): DeterministicTrafficLightPhase {
  const safeCycle = Math.max(8000, cycleMs);
  const half = safeCycle / 2;
  const t = ((nowMs + phaseOffsetMs) % safeCycle + safeCycle) % safeCycle;
  const clampedGreen = Math.min(greenMs, half - 1500);
  const clampedYellow = Math.min(yellowMs, half - clampedGreen);

  if (t < clampedGreen) {
    return { ewSignal: 'green', nsSignal: 'red' };
  }
  if (t < clampedGreen + clampedYellow) {
    return { ewSignal: 'yellow', nsSignal: 'red' };
  }
  if (t < half) {
    return { ewSignal: 'red', nsSignal: 'red' };
  }
  const t2 = t - half;
  if (t2 < clampedGreen) {
    return { ewSignal: 'red', nsSignal: 'green' };
  }
  if (t2 < clampedGreen + clampedYellow) {
    return { ewSignal: 'red', nsSignal: 'yellow' };
  }
  return { ewSignal: 'red', nsSignal: 'red' };
}

const PARKING_LOTS_SPEC = [
  {
    id: 'parkir_stasiun',
    label: 'PARKIR STASIUN',
    x: 16,
    z: -48,
    width: 4.8,
    depth: 3.8,
    rotY: 0,
    signOffset: [2.2, -1.6] as [number, number],
  },
  {
    id: 'parkir_pasar',
    label: 'PARKIR PASAR',
    x: 36,
    z: 12.2,
    width: 4.8,
    depth: 3.0,
    rotY: 0,
    signOffset: [2.2, 1.2] as [number, number],
  },
  {
    id: 'parkir_bank',
    label: 'PARKIR BANK',
    x: -37,
    z: -1,
    width: 4.4,
    depth: 4.2,
    rotY: 0,
    signOffset: [-1.8, -1.7] as [number, number],
  },
  {
    id: 'parkir_alun',
    label: 'PARKIR ALUN',
    x: 12,
    z: 2,
    width: 2.5,
    depth: 5.0,
    rotY: Math.PI / 2,
    signOffset: [-1.0, 2.2] as [number, number],
  },
];

const HALTE_SHELTERS_SPEC = [
  { id: 'halte_stasiun', label: 'HALTE STASIUN', x: 4, z: -44.2, rotY: 0 },
  { id: 'halte_alun', label: 'HALTE ALUN-ALUN', x: 0, z: -3.6, rotY: Math.PI },
  { id: 'halte_pasar', label: 'HALTE PASAR', x: 40, z: -3.6, rotY: Math.PI },
  { id: 'halte_perumahan', label: 'HALTE TIMUR', x: 64.5, z: 18, rotY: -Math.PI / 2 },
];

const ROAD_SIGNS_SPEC = [
  { id: 'sign_rail_north', kind: 'rail', x: 56, z: -57.5, rotY: 0 },
  { id: 'sign_rail_south', kind: 'rail', x: 64, z: -69.5, rotY: Math.PI },
  { id: 'sign_speed_west', kind: 'speed', x: -38, z: -3.8, rotY: Math.PI },
  { id: 'sign_speed_east', kind: 'speed', x: 30, z: -16.2, rotY: 0 },
  { id: 'sign_nopark_alun', kind: 'nopark', x: -13.5, z: -16.2, rotY: 0 },
];

/**
 * Infrastruktur Jalan Kendaraan:
 * 1. Lampu lalu lintas 3D deterministik di Simpang Alun Barat & Timur
 * 2. 4 Lahan Parkir Umum (Stasiun, Pasar, Bank, Alun-Alun)
 * 3. 4 Halte Angkot
 * 4. Rambu Lalu Lintas (Batas Kecepatan, Perlintasan KA, Dilarang Parkir)
 */
export const TrafficInfrastructure3D: React.FC<TrafficInfrastructureProps> = ({
  serverOffsetMs,
  quality,
  isNight,
}) => {
  const trafficCfg = useMemo(() => getTrafficConfig(), []);
  const shadows = quality !== 'low';

  const steelMat = getPaletteMaterial('rail_steel');
  const darkHousingMat = getPaletteMaterial('vehicle_bumper_dark');
  const markingMat = getPaletteMaterial('road_marking');
  const asphaltParkMat = getCustomColorMaterial('#383E4A', { roughness: 0.92 });
  const blueSignMat = getCustomColorMaterial('#1D4ED8', { roughness: 0.45 });
  const yellowSignMat = getCustomColorMaterial('#FACC15', { roughness: 0.5 });
  const redSignMat = getCustomColorMaterial('#DC2626', { roughness: 0.45 });
  const shelterRoofMat = getPaletteMaterial('tarp_blue');
  const benchWoodMat = getPaletteMaterial('wood_warm');

  const lightRefs = useRef<LightBulbRefs[]>([]);

  useFrame(() => {
    const nowMs = Date.now() + serverOffsetMs;
    trafficCfg.trafficLights.forEach((tl, idx) => {
      const refs = lightRefs.current[idx];
      if (!refs) return;
      const phase = getDeterministicTrafficLightPhase(
        nowMs,
        tl.phaseOffsetMs,
        trafficCfg.trafficLightCycleMs,
        trafficCfg.trafficLightGreenMs,
        trafficCfg.trafficLightYellowMs
      );
      const setIntensity = (mat: THREE.MeshStandardMaterial | null, on: boolean) => {
        if (mat) mat.emissiveIntensity = on ? 2.6 : 0.1;
      };
      setIntensity(refs.ewRed, phase.ewSignal === 'red');
      setIntensity(refs.ewYellow, phase.ewSignal === 'yellow');
      setIntensity(refs.ewGreen, phase.ewSignal === 'green');
      setIntensity(refs.nsRed, phase.nsSignal === 'red');
      setIntensity(refs.nsYellow, phase.nsSignal === 'yellow');
      setIntensity(refs.nsGreen, phase.nsSignal === 'green');
    });
  });

  return (
    <group>
      {/* 1. LAMPU LALU LINTAS DETERMINISTIK (Tanpa Write DB) */}
      {trafficCfg.trafficLights.map((tl, idx) => {
        if (!lightRefs.current[idx]) {
          lightRefs.current[idx] = {
            ewRed: null,
            ewYellow: null,
            ewGreen: null,
            nsRed: null,
            nsYellow: null,
            nsGreen: null,
          };
        }
        const refs = lightRefs.current[idx];
        return (
          <group key={tl.id} position={[tl.x, 0, tl.z]}>
            {/* Tiang Sudut Timur-Laut Simpang (-6.2, -5.8 relatif simpang atau di sudut trotoar) */}
            <group position={[5.6, 0, -6.2]}>
              <mesh position={[0, 2.4, 0]} material={steelMat} castShadow={shadows}>
                <cylinderGeometry args={[0.1, 0.14, 4.8, 6]} />
              </mesh>
              <mesh position={[-1.4, 4.65, 0]} material={steelMat}>
                <boxGeometry args={[2.9, 0.12, 0.12]} />
              </mesh>
              {/* Kotak Lampu Arah E-W */}
              <group position={[-2.2, 4.28, 0]}>
                <mesh material={darkHousingMat}>
                  <boxGeometry args={[0.88, 0.36, 0.28]} />
                </mesh>
                <mesh position={[-0.26, 0, 0.15]}>
                  <sphereGeometry args={[0.09, 6, 6]} />
                  <meshStandardMaterial ref={(m) => { refs.ewRed = m; }} color="#EF4444" emissive="#EF4444" emissiveIntensity={0.2} />
                </mesh>
                <mesh position={[0, 0, 0.15]}>
                  <sphereGeometry args={[0.09, 6, 6]} />
                  <meshStandardMaterial ref={(m) => { refs.ewYellow = m; }} color="#FACC15" emissive="#FACC15" emissiveIntensity={0.2} />
                </mesh>
                <mesh position={[0.26, 0, 0.15]}>
                  <sphereGeometry args={[0.09, 6, 6]} />
                  <meshStandardMaterial ref={(m) => { refs.ewGreen = m; }} color="#22C55E" emissive="#22C55E" emissiveIntensity={0.2} />
                </mesh>
              </group>
            </group>

            {/* Tiang Sudut Barat-Daya Simpang untuk Arus N-S */}
            <group position={[-5.6, 0, 6.2]}>
              <mesh position={[0, 2.4, 0]} material={steelMat} castShadow={shadows}>
                <cylinderGeometry args={[0.1, 0.14, 4.8, 6]} />
              </mesh>
              <mesh position={[1.4, 4.65, 0]} material={steelMat}>
                <boxGeometry args={[2.9, 0.12, 0.12]} />
              </mesh>
              {/* Kotak Lampu Arah N-S */}
              <group position={[2.2, 4.28, 0]} rotation={[0, Math.PI / 2, 0]}>
                <mesh material={darkHousingMat}>
                  <boxGeometry args={[0.88, 0.36, 0.28]} />
                </mesh>
                <mesh position={[-0.26, 0, 0.15]}>
                  <sphereGeometry args={[0.09, 6, 6]} />
                  <meshStandardMaterial ref={(m) => { refs.nsRed = m; }} color="#EF4444" emissive="#EF4444" emissiveIntensity={0.2} />
                </mesh>
                <mesh position={[0, 0, 0.15]}>
                  <sphereGeometry args={[0.09, 6, 6]} />
                  <meshStandardMaterial ref={(m) => { refs.nsYellow = m; }} color="#FACC15" emissive="#FACC15" emissiveIntensity={0.2} />
                </mesh>
                <mesh position={[0.26, 0, 0.15]}>
                  <sphereGeometry args={[0.09, 6, 6]} />
                  <meshStandardMaterial ref={(m) => { refs.nsGreen = m; }} color="#22C55E" emissive="#22C55E" emissiveIntensity={0.2} />
                </mesh>
              </group>
            </group>
          </group>
        );
      })}

      {/* 2. 4 LAHAN PARKIR UMUM (Stasiun, Pasar, Bank, Alun-Alun) */}
      {PARKING_LOTS_SPEC.map((lot) => (
        <group key={lot.id} position={[lot.x, 0.042, lot.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={asphaltParkMat} receiveShadow>
            <planeGeometry args={[lot.width, lot.depth]} />
          </mesh>
          {/* Garis Batas Parkir Putih */}
          <mesh position={[0, 0.008, -lot.depth / 2 + 0.08]} rotation={[-Math.PI / 2, 0, 0]} material={markingMat}>
            <planeGeometry args={[lot.width, 0.1]} />
          </mesh>
          <mesh position={[0, 0.008, lot.depth / 2 - 0.08]} rotation={[-Math.PI / 2, 0, 0]} material={markingMat}>
            <planeGeometry args={[lot.width, 0.1]} />
          </mesh>
          <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={markingMat}>
            <planeGeometry args={[0.1, lot.depth * 0.88]} />
          </mesh>
          {/* Rambu P Parkir */}
          <group position={[lot.signOffset[0], 0, lot.signOffset[1]]}>
            <mesh position={[0, 1.15, 0]} material={steelMat}>
              <cylinderGeometry args={[0.045, 0.055, 2.3, 6]} />
            </mesh>
            <mesh position={[0, 2.35, 0]} material={blueSignMat}>
              <boxGeometry args={[0.62, 0.62, 0.08]} />
            </mesh>
            <Text position={[0, 2.35, 0.05]} fontSize={0.38} color="#FFFFFF" anchorX="center" anchorY="middle">
              P
            </Text>
          </group>
        </group>
      ))}

      {/* 3. 4 HALTE ANGKOT RESMI */}
      {HALTE_SHELTERS_SPEC.map((halte) => (
        <group key={halte.id} position={[halte.x, 0, halte.z]} rotation={[0, halte.rotY, 0]}>
          <mesh position={[0, 0.06, 0]} material={asphaltParkMat}>
            <boxGeometry args={[3.2, 0.12, 1.2]} />
          </mesh>
          <mesh position={[-1.35, 1.1, -0.45]} material={steelMat}>
            <cylinderGeometry args={[0.05, 0.05, 2.2, 6]} />
          </mesh>
          <mesh position={[1.35, 1.1, -0.45]} material={steelMat}>
            <cylinderGeometry args={[0.05, 0.05, 2.2, 6]} />
          </mesh>
          <mesh position={[0, 2.24, 0.05]} rotation={[-0.1, 0, 0]} material={shelterRoofMat} castShadow={shadows}>
            <boxGeometry args={[3.35, 0.14, 1.45]} />
          </mesh>
          <mesh position={[0, 0.45, -0.25]} material={benchWoodMat}>
            <boxGeometry args={[2.2, 0.12, 0.42]} />
          </mesh>
          <Text
            position={[0, 2.58, 0.1]}
            fontSize={0.28}
            color={isNight ? '#FDE68A' : '#FFFFFF'}
            anchorX="center"
            outlineWidth={0.03}
            outlineColor="#0F172A"
          >
            {halte.label}
          </Text>
        </group>
      ))}

      {/* 4. RAMBU LALU LINTAS INDONESIA */}
      {ROAD_SIGNS_SPEC.map((sign) => (
        <group key={sign.id} position={[sign.x, 0, sign.z]} rotation={[0, sign.rotY, 0]}>
          <mesh position={[0, 1.1, 0]} material={steelMat}>
            <cylinderGeometry args={[0.04, 0.05, 2.2, 6]} />
          </mesh>
          {sign.kind === 'rail' ? (
            <mesh position={[0, 2.25, 0]} rotation={[0, 0, Math.PI / 4]} material={yellowSignMat}>
              <boxGeometry args={[0.54, 0.54, 0.06]} />
            </mesh>
          ) : sign.kind === 'speed' ? (
            <>
              <mesh position={[0, 2.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={redSignMat}>
                <cylinderGeometry args={[0.3, 0.3, 0.06, 12]} />
              </mesh>
              <Text position={[0, 2.25, 0.04]} fontSize={0.22} color="#FFFFFF" anchorX="center" anchorY="middle">
                40
              </Text>
            </>
          ) : (
            <>
              <mesh position={[0, 2.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={redSignMat}>
                <cylinderGeometry args={[0.28, 0.28, 0.06, 12]} />
              </mesh>
              <Text position={[0, 2.25, 0.04]} fontSize={0.22} color="#FFFFFF" anchorX="center" anchorY="middle">
                P/
              </Text>
            </>
          )}
        </group>
      ))}
    </group>
  );
};
