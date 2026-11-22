import React, { useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { CharacterNpcVariants } from './assets/CharacterNpcVariants';
import { FloatingTag } from '../components/FloatingTag';
import type { ClientLawAlert } from '../firebase/npcDeterminism';
import type { GraphicsQuality, PropertyDoc, SecurityInstallDoc } from '../types/game';
import { CCTV_ZONES, INITIAL_PROPERTIES_DATA } from './worldConstants';
import { findLotPlacement, getLotPlacement } from './layout/layoutHelpers';
import { UnifiedLotCollider } from './layout/UnifiedLotCollider';
import { BuildingPolsek } from './assets/BuildingPolsek';
import { BuildingRuko } from './assets/BuildingRuko';
import { getPaletteMaterial } from './assets/paletteMaterials';

interface Phase6Buildings3DProps {
  quality: GraphicsQuality;
  isNight: boolean;
  properties?: PropertyDoc[];
  securityInstalls?: SecurityInstallDoc[];
  lawAlerts?: ClientLawAlert[];
}

const CctvPole: React.FC<{
  label: string;
  x: number;
  z: number;
  quality: GraphicsQuality;
}> = ({ label, x, z, quality }) => {
  const ledRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!ledRef.current) return;
    const pulse = Math.sin(clock.elapsedTime * 4.2 + x) > 0.15 ? 1.8 : 0.2;
    ledRef.current.emissiveIntensity = pulse;
  });

  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 2.7, 0]} castShadow={quality !== 'low'}>
          <cylinderGeometry args={[0.1, 0.14, 5.4, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.35} />
        </mesh>
      </RigidBody>
      <mesh position={[0.45, 5.15, 0]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[1.0, 0.12, 0.12]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.9, 4.95, 0]} rotation={[0.25, 0, -0.3]}>
        <boxGeometry args={[0.48, 0.24, 0.26]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} />
      </mesh>
      <mesh position={[1.12, 4.9, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial
          ref={ledRef}
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={1.2}
          roughness={0.2}
        />
      </mesh>
      {quality !== 'low' && (
        <Text
          position={[0, 5.75, 0]}
          fontSize={0.32}
          color="#fca5a5"
          anchorX="center"
          outlineWidth={0.03}
          outlineColor="#0f172a"
        >
          {label.replace('CCTV ', 'CCTV · ')}
        </Text>
      )}
    </group>
  );
};

export const Phase6Buildings3D: React.FC<Phase6Buildings3DProps> = ({
  quality,
  isNight,
  properties,
  securityInstalls,
  lawAlerts,
}) => {
  const shadows = quality !== 'low';
  const polsekLot = getLotPlacement('polsek');
  const agentLot = getLotPlacement('kantor_agen');

  const propById = useMemo(() => {
    const map = new Map<string, PropertyDoc>();
    const list = properties && properties.length > 0 ? properties : INITIAL_PROPERTIES_DATA;
    for (const p of list) {
      map.set(p.id, p);
    }
    return map;
  }, [properties]);

  const activeInstalls = useMemo(
    () => (securityInstalls || []).filter((inst) => inst.active && inst.totalProtection > 0),
    [securityInstalls]
  );

  const visibleAlerts = useMemo(() => {
    const now = Date.now();
    return (lawAlerts || []).filter((a) => a.expiresAt > now).slice(0, 6);
  }, [lawAlerts]);

  return (
    <group>
      {/* 1. POLSEK CICALENGKA & RUANG TAHANAN */}
      <group position={[polsekLot.x, 0, polsekLot.z]} rotation={[0, polsekLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Collider massa utama Polsek di sisi utara (-Z) */}
          <CuboidCollider args={[5.4, 1.85, 1.9]} position={[0, 1.85, -0.25]} />
          {/* Collider dinding hollow sel tahanan di sisi +Z = 1.7..7.2 */}
          <CuboidCollider args={[4.0, 1.7, 0.2]} position={[0, 1.7, 7.2]} />
          <CuboidCollider args={[0.18, 1.7, 2.75]} position={[-3.9, 1.7, 4.45]} />
          <CuboidCollider args={[0.18, 1.7, 2.75]} position={[3.9, 1.7, 4.45]} />
          <CuboidCollider args={[3.9, 1.6, 0.14]} position={[0, 1.6, 1.7]} />

          <BuildingPolsek
            title="POLSEK CICALENGKA"
            subtitle="KEAMANAN & RUANG TAHANAN"
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>

        {isNight && quality !== 'low' && (
          <pointLight position={[0, 3.4, -3.5]} color="#93c5fd" intensity={2.0} distance={14} decay={1.4} />
        )}
      </group>

      {/* 2. KANTOR AGEN PROPERTI PRIANGAN */}
      <group position={[agentLot.x, 0, agentLot.z]} rotation={[0, agentLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="kantor_agen" />
          <BuildingRuko
            title="AGEN PROPERTI & KPR"
            subtitle="KAVLING & RENOVASI"
            quality={quality}
            isNight={isNight}
            wallColor="#F5EBD8"
            awningToken="trim_clinic_green"
            signVariant="clinic"
            width={agentLot.footprint.width}
            depth={agentLot.footprint.depth}
          />
        </RigidBody>
        {/* Papan Info Kavling & Simulasi KPR di teras depan */}
        <mesh position={[3.3, 1.15, 2.85]} material={getPaletteMaterial('trim_clinic_green')}>
          <boxGeometry args={[1.35, 1.5, 0.12]} />
        </mesh>
      </group>

      {/* 3. 4 TIANG CCTV PUBLIK DI ZONA STRATEGIS (langsung di koordinat layout) */}
      {CCTV_ZONES.map((zone) => (
        <CctvPole
          key={zone.id}
          label={zone.label}
          x={zone.x}
          z={zone.z}
          quality={quality}
        />
      ))}

      {/* 4. MODUL KEAMANAN TERPASANG PADA PROPERTI (CCTV, ALARM, SATPAM HANSIP) */}
      {activeInstalls.map((inst) => {
        const prop = propById.get(inst.propertyId);
        if (!prop) return null;
        const w = prop.size?.width ?? 6;
        const d = prop.size?.depth ?? 6;
        const px = prop.position.x;
        const pz = prop.position.z;
        const lotRotY = findLotPlacement(prop.id)?.rotY ?? findLotPlacement(prop.builtFromPlotId ?? '')?.rotY ?? 0;

        return (
          <group key={inst.id} position={[px, 0, pz]} rotation={[0, lotRotY, 0]}>
            {inst.modules.cctv && (
              <group position={[w / 2 + 0.15, 3.1, d / 2 + 0.15]}>
                <mesh>
                  <boxGeometry args={[0.32, 0.22, 0.35]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.35} />
                </mesh>
                <mesh position={[0, -0.05, 0.2]}>
                  <sphereGeometry args={[0.06, 6, 6]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
                </mesh>
              </group>
            )}

            {inst.modules.alarm && (
              <mesh position={[-w / 2 - 0.1, 2.9, d / 2 + 0.08]}>
                <cylinderGeometry args={[0.14, 0.14, 0.24, 8]} />
                <meshStandardMaterial
                  color="#dc2626"
                  emissive="#ef4444"
                  emissiveIntensity={isNight ? 1.5 : 0.7}
                />
              </mesh>
            )}

            {inst.modules.guard && (
              <group position={[-w / 2 - 1.1, 0, d / 2 + 0.9]} rotation={[0, 0.3, 0]}>
                <CharacterNpcVariants
                  role="satpam"
                  gender="laki-laki"
                  skinColor="#C68642"
                  hairColor="#1e1b18"
                  shirtColor="#246A4D"
                  pantsColor="#1B2432"
                  anim="idle"
                  castShadow={false}
                />
                <FloatingTag name="Satpam Hansip" />
              </group>
            )}
          </group>
        );
      })}

      {/* 5. INDIKATOR ALERT KEJADIAN / PATROLI POLISI DI 3D */}
      {visibleAlerts.map((alert) => (
        <mesh key={alert.id} position={[alert.x, 0.09, alert.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.4, 2.1, 20]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={1.3}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
};
