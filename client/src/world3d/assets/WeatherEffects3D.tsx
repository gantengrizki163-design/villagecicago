import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GraphicsQuality, ZoneId } from '../../types/game';
import { getPaletteMaterial } from './paletteMaterials';

export type WeatherKind = 'cerah' | 'gerimis' | 'hujan_deras';

export interface WeatherEffects3DProps {
  weather: WeatherKind;
  quality: GraphicsQuality;
  currentZone?: ZoneId;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  droneMode?: boolean;
}

/**
 * Efek Cuaca Hujan Deras, Riak Air & Genangan Banjir Reflektif (Batch 6).
 * Mengacu pada People_walking_in_heavy_rain_7e1a3d0c_ca270327.jpg:
 * garis hujan miring ringan (LineSegments), riak cincin di genangan, serta bidang genangan air (#6486A6).
 */
export const WeatherEffects3D: React.FC<WeatherEffects3DProps> = ({
  weather,
  quality,
  currentZone = 'cicalengka',
  playerPosRef,
  droneMode = false,
}) => {
  const rainLinesRef = useRef<THREE.LineSegments>(null);
  const rippleGroupRef = useRef<THREE.Group>(null);
  const puddleGroupRef = useRef<THREE.Group>(null);
  const floodOpacityRef = useRef(0);

  const isRaining = weather !== 'cerah';
  const isHeavy = weather === 'hujan_deras';

  const streakCount = useMemo(() => {
    const base = isHeavy ? 320 : 150;
    if (quality === 'high') return Math.round(base * 1.2);
    if (quality === 'low') return Math.round(base * 0.55);
    return base;
  }, [isHeavy, quality]);

  const { geometry, seeds } = useMemo(() => {
    const positions = new Float32Array(streakCount * 6);
    const seedArr = new Float32Array(streakCount * 4);
    for (let i = 0; i < streakCount; i++) {
      const rx = (Math.random() - 0.5) * 42;
      const ry = Math.random() * 20;
      const rz = (Math.random() - 0.5) * 42;
      const len = 0.65 + Math.random() * 0.55;
      seedArr[i * 4] = rx;
      seedArr[i * 4 + 1] = ry;
      seedArr[i * 4 + 2] = rz;
      seedArr[i * 4 + 3] = len;

      const idx = i * 6;
      positions[idx] = rx;
      positions[idx + 1] = ry;
      positions[idx + 2] = rz;
      positions[idx + 3] = rx - 0.14;
      positions[idx + 4] = ry - len;
      positions[idx + 5] = rz + 0.08;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, seeds: seedArr };
  }, [streakCount]);

  const rainMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#DCE8F5',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    []
  );

  const puddleMat = getPaletteMaterial('water_rain');
  const rippleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#DCE8F5',
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  const rippleSpecs = useMemo(() => {
    const count = quality === 'low' ? 6 : 12;
    return Array.from({ length: count }, (_, i) => ({
      dx: ((i * 7.3) % 18) - 9,
      dz: ((i * 11.7) % 18) - 9,
      phase: (i / count) * Math.PI * 2,
    }));
  }, [quality]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const cx = droneMode ? 0 : playerPosRef?.current?.x ?? 0;
    const cz = droneMode ? 0 : playerPosRef?.current?.z ?? 0;

    // Update rain streaks
    if (rainLinesRef.current && isRaining) {
      rainLinesRef.current.position.set(cx, 0, cz);
      const posAttr = rainLinesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const fallSpeed = isHeavy ? 26 : 18;
      for (let i = 0; i < streakCount; i++) {
        let y = seeds[i * 4 + 1] - fallSpeed * dt;
        if (y < 0.1) y += 20;
        seeds[i * 4 + 1] = y;
        const x = seeds[i * 4];
        const z = seeds[i * 4 + 2];
        const len = seeds[i * 4 + 3];
        const idx = i * 6;
        arr[idx] = x;
        arr[idx + 1] = y;
        arr[idx + 2] = z;
        arr[idx + 3] = x - 0.16;
        arr[idx + 4] = y - len;
        arr[idx + 5] = z + 0.09;
      }
      posAttr.needsUpdate = true;
      rainMat.opacity = isHeavy ? 0.52 : 0.34;
    }

    // Smooth flood puddle height / visibility
    const targetLevel = isHeavy ? 1 : weather === 'gerimis' ? 0.35 : 0;
    floodOpacityRef.current = THREE.MathUtils.lerp(floodOpacityRef.current, targetLevel, 1 - Math.exp(-2 * dt));
    if (puddleGroupRef.current) {
      puddleGroupRef.current.visible = floodOpacityRef.current > 0.03;
      // Naik perlahan dari y=0.044 ke y=0.072 saat hujan deras
      puddleGroupRef.current.position.y = 0.042 + floodOpacityRef.current * 0.028;
    }

    // Animate surface ripples near player
    if (rippleGroupRef.current) {
      rippleGroupRef.current.visible = isRaining;
      if (isRaining) {
        rippleGroupRef.current.position.set(cx, 0.068, cz);
        rippleGroupRef.current.children.forEach((child, idx) => {
          const spec = rippleSpecs[idx];
          if (!spec) return;
          const cycle = ((t * 1.45 + spec.phase) % 1);
          const scale = 0.25 + cycle * 1.3;
          child.scale.set(scale, scale, 1);
        });
      }
    }
  });

  return (
    <group>
      {/* Partikel Garis Hujan */}
      {isRaining && (
        <lineSegments ref={rainLinesRef} geometry={geometry} material={rainMat} frustumCulled={false} />
      )}

      {/* Riak Tetesan Hujan di Permukaan Jalan */}
      <group ref={rippleGroupRef} visible={isRaining}>
        {rippleSpecs.map((spec, idx) => (
          <mesh
            key={idx}
            position={[spec.dx, 0, spec.dz]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={rippleMat}
          >
            <ringGeometry args={[0.14, 0.22, 12]} />
          </mesh>
        ))}
      </group>

      {/* Genangan Reflektif & Banjir Ringan di Ruas Jalan Utama Cicalengka */}
      {currentZone === 'cicalengka' && (
        <group ref={puddleGroupRef} visible={false}>
          {/* Genangan Jalan Raya Cicalengka (z = -10) */}
          <mesh position={[-28, 0, -10]} rotation={[-Math.PI / 2, 0, 0]} material={puddleMat} receiveShadow>
            <planeGeometry args={[36, 7.2]} />
          </mesh>
          <mesh position={[26, 0, -10]} rotation={[-Math.PI / 2, 0, 0]} material={puddleMat} receiveShadow>
            <planeGeometry args={[42, 7.2]} />
          </mesh>
          {/* Genangan Jalan Stasiun (z = -40) & Simpang Kampung */}
          <mesh position={[0, 0, -40]} rotation={[-Math.PI / 2, 0, 0]} material={puddleMat} receiveShadow>
            <planeGeometry args={[48, 5.2]} />
          </mesh>
          <mesh position={[0, 0, 18]} rotation={[-Math.PI / 2, 0, 0]} material={puddleMat} receiveShadow>
            <planeGeometry args={[34, 4.2]} />
          </mesh>
          <mesh position={[-12, 0, 48]} rotation={[-Math.PI / 2, 0, 0]} material={puddleMat} receiveShadow>
            <planeGeometry args={[36, 4.2]} />
          </mesh>
        </group>
      )}
    </group>
  );
};
