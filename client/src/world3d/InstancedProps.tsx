import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { GraphicsQuality } from '../types/game';
import { getPaletteMaterial, STYLE_PALETTE } from './assets/paletteMaterials';
import { getLayoutPlants, getLayoutProps, LAYOUT_DATA } from './layout/layoutHelpers';

// Ref: /assets/aistudio/Diorama_Kota_Indonesia_dengan_Stasiun_Kereta_53a7c2cc.png & Peta_Kota_Tropis_dengan_Masjid_dan_Stasiun_863fc6e5.png

interface InstancedPropsConfig {
  quality: GraphicsQuality;
  isNight?: boolean;
}

const layoutPlants = getLayoutPlants();
const layoutProps = getLayoutProps();

// Export deterministik hasil generator aturan layout (tanpa koordinat hardcode)
export const TREE_COORDS: [number, number, number][] = layoutPlants.trees.map((t) => [t.x, t.y, t.z]);
export const PALM_COORDS: [number, number, number][] = layoutPlants.palms.map((p) => [p.x, p.y, p.z]);
export const FENCE_SEGMENTS: { x: number; z: number; rotY: number }[] = layoutProps.fences.map((f) => ({
  x: f.x,
  z: f.z,
  rotY: f.rotY,
}));
export const STREET_LAMP_COORDS = layoutProps.lamps;
export const PARK_BENCH_COORDS = layoutProps.benches;

export const InstancedProps: React.FC<InstancedPropsConfig> = ({ quality, isNight = false }) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyMainRef = useRef<THREE.InstancedMesh>(null);
  const canopyTopRef = useRef<THREE.InstancedMesh>(null);
  const palmTrunkRef = useRef<THREE.InstancedMesh>(null);
  const palmCrownRef = useRef<THREE.InstancedMesh>(null);
  const fenceRef = useRef<THREE.InstancedMesh>(null);
  const lampPoleRef = useRef<THREE.InstancedMesh>(null);
  const lampHeadRef = useRef<THREE.InstancedMesh>(null);
  const benchSeatRef = useRef<THREE.InstancedMesh>(null);
  const benchLegsRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const trunkMat = getPaletteMaterial('wood_dark');
  const warmWoodMat = getPaletteMaterial('wood_warm');
  const bambooFenceMat = getPaletteMaterial('bamboo_light');
  const palmLeafMat = getPaletteMaterial('foliage_palm', { flatShading: true });
  const steelMat = getPaletteMaterial('rail_steel');
  const lampHeadMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isNight ? '#FEF08A' : '#E2E8F0',
        emissive: isNight ? '#FBBF24' : '#000000',
        emissiveIntensity: isNight ? 1.45 : 0,
        roughness: 0.25,
      }),
    [isNight]
  );
  const canopyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.88,
        metalness: 0.0,
        flatShading: true,
      }),
    []
  );

  useLayoutEffect(() => {
    if (!trunkRef.current || !canopyMainRef.current || !canopyTopRef.current) return;
    const tintMain = new THREE.Color();
    const tintTop = new THREE.Color();
    const brightColor = new THREE.Color(STYLE_PALETTE.foliage_bright);
    const mainGrassColor = new THREE.Color(STYLE_PALETTE.grass_main);
    const hillColor = new THREE.Color(STYLE_PALETTE.grass_hill);

    layoutPlants.trees.forEach((tree, i) => {
      const { x, y, z, scale, rotY } = tree;

      // Batang pohon
      dummy.position.set(x, y + 1.15 * scale, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      // Gumpalan tajuk bawah
      dummy.position.set(x, y + 2.95 * scale, z);
      dummy.rotation.set(0.1, rotY, 0.08);
      dummy.scale.set(scale * 1.12, scale * 0.98, scale * 1.12);
      dummy.updateMatrix();
      canopyMainRef.current!.setMatrixAt(i, dummy.matrix);

      // Gumpalan tajuk atas
      dummy.position.set(
        x + Math.sin(rotY) * 0.35 * scale,
        y + 4.1 * scale,
        z + Math.cos(rotY) * 0.35 * scale
      );
      dummy.rotation.set(-0.1, rotY + 0.7, 0);
      dummy.scale.set(scale * 0.82, scale * 0.85, scale * 0.82);
      dummy.updateMatrix();
      canopyTopRef.current!.setMatrixAt(i, dummy.matrix);

      tintMain.copy(i % 3 === 0 ? hillColor : brightColor);
      tintTop.copy(i % 2 === 0 ? mainGrassColor : brightColor);
      canopyMainRef.current!.setColorAt(i, tintMain);
      canopyTopRef.current!.setColorAt(i, tintTop);
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    canopyMainRef.current.instanceMatrix.needsUpdate = true;
    canopyTopRef.current.instanceMatrix.needsUpdate = true;
    if (canopyMainRef.current.instanceColor) canopyMainRef.current.instanceColor.needsUpdate = true;
    if (canopyTopRef.current.instanceColor) canopyTopRef.current.instanceColor.needsUpdate = true;
    trunkRef.current.computeBoundingSphere();
    canopyMainRef.current.computeBoundingSphere();
    canopyTopRef.current.computeBoundingSphere();
  }, [dummy]);

  useLayoutEffect(() => {
    if (!palmTrunkRef.current || !palmCrownRef.current) return;
    layoutPlants.palms.forEach((palm, i) => {
      const { x, y, z, scale: s, rotY } = palm;
      dummy.position.set(x, y + 2.1 * s, z);
      dummy.rotation.set(0.06, rotY, 0.05);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      palmTrunkRef.current!.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x + 0.16 * s, y + 4.25 * s, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(s * 1.1, s * 0.55, s * 1.1);
      dummy.updateMatrix();
      palmCrownRef.current!.setMatrixAt(i, dummy.matrix);
    });
    palmTrunkRef.current.instanceMatrix.needsUpdate = true;
    palmCrownRef.current.instanceMatrix.needsUpdate = true;
    palmTrunkRef.current.computeBoundingSphere();
    palmCrownRef.current.computeBoundingSphere();
  }, [dummy]);

  useLayoutEffect(() => {
    if (!fenceRef.current) return;
    FENCE_SEGMENTS.forEach((seg, i) => {
      dummy.position.set(seg.x, 0.55, seg.z);
      dummy.rotation.set(0, seg.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      fenceRef.current!.setMatrixAt(i, dummy.matrix);
    });
    fenceRef.current.instanceMatrix.needsUpdate = true;
    fenceRef.current.computeBoundingSphere();
  }, [dummy]);

  useLayoutEffect(() => {
    if (!lampPoleRef.current || !lampHeadRef.current) return;
    STREET_LAMP_COORDS.forEach((lamp, i) => {
      dummy.position.set(lamp.x, 2.0, lamp.z);
      dummy.rotation.set(0, lamp.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lampPoleRef.current!.setMatrixAt(i, dummy.matrix);

      dummy.position.set(lamp.x + Math.sin(lamp.rotY) * 0.28, 4.05, lamp.z + Math.cos(lamp.rotY) * 0.28);
      dummy.rotation.set(0, lamp.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lampHeadRef.current!.setMatrixAt(i, dummy.matrix);
    });
    lampPoleRef.current.instanceMatrix.needsUpdate = true;
    lampHeadRef.current.instanceMatrix.needsUpdate = true;
    lampPoleRef.current.computeBoundingSphere();
    lampHeadRef.current.computeBoundingSphere();
  }, [dummy]);

  useLayoutEffect(() => {
    if (!benchSeatRef.current || !benchLegsRef.current) return;
    PARK_BENCH_COORDS.forEach((bench, i) => {
      dummy.position.set(bench.x, 0.48, bench.z);
      dummy.rotation.set(0, bench.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      benchSeatRef.current!.setMatrixAt(i, dummy.matrix);

      dummy.position.set(bench.x, 0.24, bench.z);
      dummy.rotation.set(0, bench.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      benchLegsRef.current!.setMatrixAt(i, dummy.matrix);
    });
    benchSeatRef.current.instanceMatrix.needsUpdate = true;
    benchLegsRef.current.instanceMatrix.needsUpdate = true;
    benchSeatRef.current.computeBoundingSphere();
    benchLegsRef.current.computeBoundingSphere();
  }, [dummy]);

  const castShadow = quality === 'high';
  const worldHalf = LAYOUT_DATA.rules.worldHalfSize;

  return (
    <group>
      {/* Instanced Pohon Kampung Bertumpuk */}
      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, TREE_COORDS.length]}
        material={trunkMat}
        castShadow={castShadow}
        receiveShadow
      >
        <cylinderGeometry args={[0.2, 0.34, 2.3, 6]} />
      </instancedMesh>

      <instancedMesh
        ref={canopyMainRef}
        args={[undefined, undefined, TREE_COORDS.length]}
        material={canopyMat}
        castShadow={castShadow}
        receiveShadow
      >
        <dodecahedronGeometry args={[1.5, 0]} />
      </instancedMesh>

      <instancedMesh
        ref={canopyTopRef}
        args={[undefined, undefined, TREE_COORDS.length]}
        material={canopyMat}
        castShadow={castShadow}
        receiveShadow
      >
        <dodecahedronGeometry args={[1.35, 0]} />
      </instancedMesh>

      {/* Instanced Pohon Palem Tropis */}
      <instancedMesh
        ref={palmTrunkRef}
        args={[undefined, undefined, PALM_COORDS.length]}
        material={trunkMat}
        castShadow={castShadow}
      >
        <cylinderGeometry args={[0.14, 0.24, 4.2, 6]} />
      </instancedMesh>

      <instancedMesh
        ref={palmCrownRef}
        args={[undefined, undefined, PALM_COORDS.length]}
        material={palmLeafMat}
        castShadow={castShadow}
      >
        <coneGeometry args={[2.1, 1.35, 6]} />
      </instancedMesh>

      {/* Instanced Pagar Bambu/Kayu + Collider fisik */}
      <instancedMesh
        ref={fenceRef}
        args={[undefined, undefined, FENCE_SEGMENTS.length]}
        material={bambooFenceMat}
        castShadow={castShadow}
        receiveShadow
      >
        <boxGeometry args={[4.6, 1.05, 0.24]} />
      </instancedMesh>

      {/* Instanced Lampu Jalan PJU */}
      {STREET_LAMP_COORDS.length > 0 && (
        <>
          <instancedMesh
            ref={lampPoleRef}
            args={[undefined, undefined, STREET_LAMP_COORDS.length]}
            material={steelMat}
            castShadow={castShadow}
          >
            <cylinderGeometry args={[0.07, 0.1, 4.0, 6]} />
          </instancedMesh>
          <instancedMesh
            ref={lampHeadRef}
            args={[undefined, undefined, STREET_LAMP_COORDS.length]}
            material={lampHeadMat}
          >
            <boxGeometry args={[0.36, 0.18, 0.56]} />
          </instancedMesh>
        </>
      )}

      {/* Instanced Bangku Taman */}
      {PARK_BENCH_COORDS.length > 0 && (
        <>
          <instancedMesh
            ref={benchSeatRef}
            args={[undefined, undefined, PARK_BENCH_COORDS.length]}
            material={warmWoodMat}
            castShadow={castShadow}
            receiveShadow
          >
            <boxGeometry args={[1.8, 0.14, 0.56]} />
          </instancedMesh>
          <instancedMesh
            ref={benchLegsRef}
            args={[undefined, undefined, PARK_BENCH_COORDS.length]}
            material={steelMat}
          >
            <boxGeometry args={[1.5, 0.42, 0.46]} />
          </instancedMesh>
        </>
      )}

      <RigidBody type="fixed" colliders={false}>
        {FENCE_SEGMENTS.map((seg, idx) => (
          <CuboidCollider
            key={`fence-col-${idx}`}
            args={Math.abs(Math.sin(seg.rotY)) < 0.5 ? [2.3, 0.6, 0.15] : [0.15, 0.6, 2.3]}
            position={[seg.x, 0.6, seg.z]}
          />
        ))}
        {/* Batas keliling dunia sesuai worldHalfSize config */}
        <CuboidCollider args={[worldHalf + 2, 4, 1]} position={[0, 2, -worldHalf]} />
        <CuboidCollider args={[worldHalf + 2, 4, 1]} position={[0, 2, worldHalf]} />
        <CuboidCollider args={[1, 4, worldHalf + 2]} position={[-worldHalf, 2, 0]} />
        <CuboidCollider args={[1, 4, worldHalf + 2]} position={[worldHalf, 2, 0]} />
      </RigidBody>
    </group>
  );
};
