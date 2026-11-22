import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FloatingTag } from '../components/FloatingTag';
import type { WorldPoint2D } from './interactions/registry';
import type { ActiveNavigationState } from './interactions/useLocationGate';

export interface OffscreenTargetIndicator {
  active: boolean;
  onScreen: boolean;
  xPct: number;
  yPct: number;
  angleDeg: number;
  distanceMeters: number;
  label: string;
}

interface DestinationGuide3DProps {
  activeNav: ActiveNavigationState | null;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onScreenIndicatorUpdate?: (indicator: OffscreenTargetIndicator) => void;
}

function buildPathMarkers(waypoints: WorldPoint2D[]): Array<{ x: number; z: number; yaw: number }> {
  if (waypoints.length < 2) return [];
  const markers: Array<{ x: number; z: number; yaw: number }> = [];
  const spacing = 3.2;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 0.8) continue;

    const yaw = Math.atan2(dx, dz);
    const count = Math.max(1, Math.floor(segLen / spacing));
    for (let s = 1; s <= count; s++) {
      const t = s / (count + 0.35);
      markers.push({
        x: a.x + dx * t,
        z: a.z + dz * t,
        yaw,
      });
    }
  }
  return markers.slice(0, 48);
}

export const DestinationGuide3D: React.FC<DestinationGuide3DProps> = ({
  activeNav,
  playerPosRef,
  onScreenIndicatorUpdate,
}) => {
  const arrowGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const markersGroupRef = useRef<THREE.Group>(null);
  const hudTimerRef = useRef(0);
  const tempVecRef = useRef(new THREE.Vector3());

  const markers = useMemo(
    () => (activeNav ? buildPathMarkers(activeNav.waypoints) : []),
    [activeNav]
  );

  useFrame((state, delta) => {
    if (!activeNav) return;

    const now = state.clock.elapsedTime;
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const goal = activeNav.destination.arrivalPoint;

    // 1. Panah kompas di sekitar kaki pemain menunjuk waypoint berikutnya / tujuan
    if (arrowGroupRef.current) {
      let targetPt = goal;
      for (let i = 1; i < activeNav.waypoints.length; i++) {
        const wp = activeNav.waypoints[i];
        if (Math.hypot(wp.x - px, wp.z - pz) > 2.2) {
          targetPt = wp;
          break;
        }
      }
      const dx = targetPt.x - px;
      const dz = targetPt.z - pz;
      const angle = Math.atan2(dx, dz);
      const offsetDist = 1.45;
      arrowGroupRef.current.position.set(
        px + Math.sin(angle) * offsetDist,
        0.14 + Math.sin(now * 4.5) * 0.03,
        pz + Math.cos(angle) * offsetDist
      );
      arrowGroupRef.current.rotation.y = angle;
    }

    // 2. Denyut cincin tujuan & beacon di pintu bangunan tujuan
    if (ringRef.current) {
      const pulse = 1 + Math.sin(now * 4) * 0.1;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
    if (beaconRef.current) {
      beaconRef.current.position.y = 3.2 + Math.sin(now * 3) * 0.35;
      beaconRef.current.rotation.y += delta * 1.6;
    }

    // 3. Animasi gelombang marker jalan di tanah
    if (markersGroupRef.current) {
      const children = markersGroupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const mesh = children[i];
        const wave = 0.72 + 0.28 * Math.sin(now * 5.2 - i * 0.65);
        mesh.scale.setScalar(wave);
      }
    }

    // 4. Proyeksi layar untuk penunjuk arah tepi layar (throttled ~120ms)
    if (onScreenIndicatorUpdate) {
      hudTimerRef.current += delta;
      if (hudTimerRef.current >= 0.12) {
        hudTimerRef.current = 0;
        const proj = tempVecRef.current.set(goal.x, 1.8, goal.z).project(state.camera);
        const inFront = proj.z < 1;
        let nx = proj.x;
        let ny = proj.y;
        if (!inFront) {
          nx = -nx;
          ny = -ny;
        }
        const onScreen = inFront && Math.abs(nx) <= 0.88 && Math.abs(ny) <= 0.82;

        // Klem ke tepi layar bila di luar kamera
        const clampScale = Math.max(Math.abs(nx) / 0.86, Math.abs(ny) / 0.76, 1);
        const cx = onScreen ? nx : nx / clampScale;
        const cy = onScreen ? ny : ny / clampScale;

        const xPct = (cx * 0.5 + 0.5) * 100;
        const yPct = (-cy * 0.5 + 0.5) * 100;
        const angleDeg = (Math.atan2(-cy, cx) * 180) / Math.PI;
        const distMeters = Math.round(Math.hypot(goal.x - px, goal.z - pz));

        onScreenIndicatorUpdate({
          active: true,
          onScreen,
          xPct,
          yPct,
          angleDeg,
          distanceMeters: distMeters,
          label: activeNav.destination.label,
        });
      }
    }
  });

  if (!activeNav) return null;

  const dest = activeNav.destination;

  return (
    <group>
      {/* Panah kompas di dekat kaki pemain */}
      <group ref={arrowGroupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.26, 0.68, 4]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.92} />
        </mesh>
        <mesh position={[0, -0.04, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.28, 16]} />
          <meshBasicMaterial color="#fde047" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Jejak chevron penunjuk jalan sepanjang rute A* */}
      <group ref={markersGroupRef}>
        {markers.map((m, idx) => (
          <group key={idx} position={[m.x, 0.08, m.z]} rotation={[0, m.yaw, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.22, 0.52, 3]} />
              <meshBasicMaterial color="#7dd3fc" transparent opacity={0.78} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Cincin & Beacon di pintu bangunan tujuan */}
      <group position={[dest.arrivalPoint.x, 0, dest.arrivalPoint.z]}>
        <mesh ref={ringRef} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.45, 2.0, 32]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 3.0, 10]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.45} />
        </mesh>
        <mesh ref={beaconRef} position={[0, 3.2, 0]}>
          <octahedronGeometry args={[0.45, 0]} />
          <meshBasicMaterial color="#fde047" />
        </mesh>
        <FloatingTag name={`Tujuan: ${dest.label}`} />
      </group>
    </group>
  );
};
