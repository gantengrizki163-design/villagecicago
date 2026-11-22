import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getDeterministicTrainState } from '../../firebase/phase2ConfigCache';
import type { GraphicsQuality, TrainScheduleConfig } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getLampMaterial, getPaletteMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Stasiun_Kereta_Kolonial_Isometrik_83aa5a14.png & Diorama_Kota_Indonesia_dengan_Stasiun_Kereta_53a7c2cc.png

interface PropRailTrackProps {
  length?: number;
  doubleTrack?: boolean;
  crossingX?: number | null;
  quality: GraphicsQuality;
  isNight?: boolean;
  serverOffsetMs?: number;
  trainSchedule?: TrainScheduleConfig;
  epochMs?: number;
}

/**
 * Jalur Rel Kereta Api Ganda dengan balas kerikil, bantalan kayu instanced,
 * rel baja, dan perlintasan sebidang berpalang pintu merah-putih deterministik.
 */
export const PropRailTrack: React.FC<PropRailTrackProps> = ({
  length = 152,
  doubleTrack = true,
  crossingX = 22,
  quality,
  isNight = false,
  serverOffsetMs = 0,
  trainSchedule,
  epochMs = 0,
}) => {
  const sleeperMeshRef = useRef<THREE.InstancedMesh>(null);
  const gateNorthRef = useRef<THREE.Group>(null);
  const gateSouthRef = useRef<THREE.Group>(null);
  const beaconMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const currentGateAngleRef = useRef(1.22);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const ballastMat = getPaletteMaterial('rail_ballast');
  const sleeperMat = getPaletteMaterial('wood_dark');
  const railMat = getPaletteMaterial('rail_steel');
  const asphaltMat = getPaletteMaterial('road_asphalt');
  const redMat = getPaletteMaterial('flag_red');
  const whiteMat = getPaletteMaterial('flag_white');
  const lampMat = getLampMaterial(isNight);

  const trackOffsets = doubleTrack ? [0, -3.2] : [0];
  const sleepersPerTrack = Math.floor(length / 2.2);
  const totalSleepers = sleepersPerTrack * trackOffsets.length;

  useLayoutEffect(() => {
    if (!sleeperMeshRef.current) return;
    let idx = 0;
    const half = length / 2 - 1.2;
    for (const tz of trackOffsets) {
      for (let i = 0; i < sleepersPerTrack; i++) {
        const sx = -half + i * 2.2;
        dummy.position.set(sx, 0.08, tz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sleeperMeshRef.current.setMatrixAt(idx++, dummy.matrix);
      }
    }
    sleeperMeshRef.current.instanceMatrix.needsUpdate = true;
    sleeperMeshRef.current.computeBoundingSphere();
  }, [dummy, length, sleepersPerTrack, trackOffsets]);

  useFrame((_, delta) => {
    if (crossingX === null) return;
    let gateClosed = false;
    if (trainSchedule) {
      const state = getDeterministicTrainState(Date.now() + serverOffsetMs, trainSchedule, epochMs);
      gateClosed =
        state.phase === 'approaching' ||
        state.phase === 'boarding' ||
        state.phase === 'departing';
    }

    const targetAngle = gateClosed ? 0 : 1.24;
    const lerpRate = 1 - Math.exp(-5.5 * Math.min(delta, 0.1));
    currentGateAngleRef.current = THREE.MathUtils.lerp(
      currentGateAngleRef.current,
      targetAngle,
      lerpRate
    );

    if (gateNorthRef.current) {
      gateNorthRef.current.rotation.z = currentGateAngleRef.current;
    }
    if (gateSouthRef.current) {
      gateSouthRef.current.rotation.z = currentGateAngleRef.current;
    }
    if (beaconMatRef.current) {
      if (gateClosed) {
        const blink = Math.sin((Date.now() + serverOffsetMs) * 0.012) > 0;
        beaconMatRef.current.emissiveIntensity = blink ? 2.8 : 0.3;
      } else {
        beaconMatRef.current.emissiveIntensity = isNight ? 0.5 : 0.1;
      }
    }
  });

  return (
    <AssetModelLoader assetId="prop_rail_track" quality={quality} castShadow={false}>
      <group>
        {/* Alas Balas Kerikil */}
        <mesh
          position={[0, 0.035, doubleTrack ? -1.6 : 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={ballastMat}
          receiveShadow
        >
          <planeGeometry args={[length, doubleTrack ? 7.2 : 4.0]} />
        </mesh>

        {/* Bantalan Kayu Instanced */}
        <instancedMesh
          ref={sleeperMeshRef}
          args={[undefined, undefined, totalSleepers]}
          receiveShadow
        >
          <boxGeometry args={[0.4, 0.1, 2.3]} />
          <primitive object={sleeperMat} attach="material" />
        </instancedMesh>

        {/* Batang Rel Baja Ganda */}
        {trackOffsets.map((tz, tIdx) => (
          <group key={tIdx} position={[0, 0.16, tz]}>
            <mesh position={[0, 0, -0.7]} material={railMat}>
              <boxGeometry args={[length, 0.12, 0.14]} />
            </mesh>
            <mesh position={[0, 0, 0.7]} material={railMat}>
              <boxGeometry args={[length, 0.12, 0.14]} />
            </mesh>
          </group>
        ))}

        {/* Perlintasan Sebidang & Palang Pintu Kereta */}
        {crossingX !== null && (
          <group position={[crossingX, 0, doubleTrack ? -1.6 : 0]}>
            <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} material={asphaltMat} receiveShadow>
              <planeGeometry args={[7.2, doubleTrack ? 7.6 : 4.2]} />
            </mesh>
            {/* Palang Pintu Utara & Selatan */}
            {[-4.2, 4.2].map((pz, idx) => (
              <group key={idx} position={[-3.8, 0, pz]}>
                <mesh position={[0, 0.7, 0]} material={railMat}>
                  <boxGeometry args={[0.32, 1.4, 0.32]} />
                </mesh>
                <mesh position={[0, 1.52, 0]} material={lampMat}>
                  <boxGeometry args={[0.24, 0.24, 0.24]} />
                </mesh>
                <mesh position={[0, 1.84, 0]}>
                  <sphereGeometry args={[0.16, 6, 6]} />
                  <meshStandardMaterial
                    ref={idx === 0 ? beaconMatRef : undefined}
                    color="#EF4444"
                    emissive="#EF4444"
                    emissiveIntensity={0.2}
                  />
                </mesh>
                {/* Lengan Palang Belang Merah-Putih berporos di tiang (y=1.15) */}
                <group
                  ref={idx === 0 ? gateNorthRef : gateSouthRef}
                  position={[0, 1.15, 0]}
                  rotation={[0, 0, 1.24]}
                >
                  {[0, 1, 2, 3, 4, 5].map((seg) => (
                    <mesh
                      key={seg}
                      position={[0.75 + seg * 1.05, 0, 0]}
                      material={seg % 2 === 0 ? redMat : whiteMat}
                    >
                      <boxGeometry args={[1.0, 0.14, 0.1]} />
                    </mesh>
                  ))}
                </group>
              </group>
            ))}
          </group>
        )}
      </group>
    </AssetModelLoader>
  );
};
