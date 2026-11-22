import React from 'react';
import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { GraphicsQuality, ZoneId } from '../types/game';
import { FACTORY_RANCAEKEK_POS, SCHOOL_BANDUNG_POS } from './worldConstants';
import { BuildingPabrik } from './assets/BuildingPabrik';
import { BuildingSekolah } from './assets/BuildingSekolah';
import { BuildingStation } from './assets/BuildingStation';
import { PropRailTrack } from './assets/PropRailTrack';
import { VehicleAngkot } from './assets/VehicleAngkot';
import { VehicleOjol } from './assets/VehicleOjol';
import { VehicleTruck } from './assets/VehicleTruck';
import { getPaletteMaterial } from './assets/paletteMaterials';

interface DestinationZoneWorldProps {
  zone: Exclude<ZoneId, 'cicalengka'>;
  quality: GraphicsQuality;
  isNight: boolean;
}

export const DestinationZoneWorld: React.FC<DestinationZoneWorldProps> = ({
  zone,
  quality,
  isNight,
}) => {
  const shadows = quality !== 'low';
  const stationTitle =
    zone === 'rancaekek'
      ? 'STASIUN RANCAEKEK'
      : zone === 'bandung'
        ? 'STASIUN BANDUNG'
        : 'STASIUN NAGREG';
  const stationSubtitle =
    zone === 'rancaekek'
      ? '+668m · INDUSTRI'
      : zone === 'bandung'
        ? '+709m · KOTA'
        : '+848m · PEGUNUNGAN';
  const accentRoofToken =
    zone === 'rancaekek'
      ? 'roof_industrial_blue'
      : zone === 'bandung'
        ? 'trim_clinic_green'
        : 'roof_terracotta';

  const groundMat = getPaletteMaterial(
    zone === 'bandung' ? 'paving_stone' : zone === 'nagreg' ? 'grass_hill' : 'grass_main'
  );
  const earthSkirtMat = getPaletteMaterial('earth_clay');
  const roadMat = getPaletteMaterial('road_asphalt');
  const sidewalkMat = getPaletteMaterial('paving_stone');
  const markingMat = getPaletteMaterial('road_marking');
  const hillMat = getPaletteMaterial('grass_hill', { flatShading: true });

  return (
    <group>
      {/* Lantai Tanah Zona Tujuan & Penampang Diorama */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[70, 1, 70]} position={[0, -1, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={groundMat} receiveShadow>
          <planeGeometry args={[160, 160]} />
        </mesh>
      </RigidBody>
      <mesh position={[0, -3.55, 0]} material={earthSkirtMat}>
        <boxGeometry args={[160, 7, 160]} />
      </mesh>

      {/* Jalan Utama & Trotoar */}
      <mesh position={[0, 0.02, -22]} rotation={[-Math.PI / 2, 0, 0]} material={sidewalkMat} receiveShadow>
        <planeGeometry args={[102, 11.4]} />
      </mesh>
      <mesh position={[0, 0.035, -22]} rotation={[-Math.PI / 2, 0, 0]} material={roadMat} receiveShadow>
        <planeGeometry args={[100, 9]} />
      </mesh>
      <mesh position={[0, 0.035, -32]} rotation={[-Math.PI / 2, 0, 0]} material={roadMat} receiveShadow>
        <planeGeometry args={[8, 28]} />
      </mesh>
      {[-36, -20, 20, 36].map((x) => (
        <mesh key={x} position={[x, 0.05, -22]} rotation={[-Math.PI / 2, 0, 0]} material={markingMat}>
          <planeGeometry args={[5.5, 0.3]} />
        </mesh>
      ))}

      {/* Rel & Stasiun Kedatangan / Kembali ke Cicalengka */}
      <group position={[0, 0, -53.5]}>
        <PropRailTrack length={120} doubleTrack={false} crossingX={null} quality={quality} isNight={isNight} />
      </group>
      <group position={[0, 0, -48]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[14, 0.3, 3.8]} position={[0, 0.3, 1.4]} />
          <CuboidCollider args={[10, 2.2, 2.5]} position={[0, 2.8, 2.7]} />
          <BuildingStation
            title={stationTitle}
            subtitle={stationSubtitle}
            quality={quality}
            isNight={isNight}
            accentRoofToken={accentRoofToken}
          />
        </RigidBody>
      </group>

      {/* Landmark Khusus Masing-Masing Zona */}
      {zone === 'rancaekek' && (
        <group position={[FACTORY_RANCAEKEK_POS.x, 0, FACTORY_RANCAEKEK_POS.z]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[10.5, 3.2, 6.8]} position={[0, 3.2, -1.0]} />
            <BuildingPabrik
              title="PT TEKSTIL RANCAEKEK"
              subtitle="INDUSTRI & GUDANG TEKSTIL"
              quality={quality}
              isNight={isNight}
            />
          </RigidBody>
          <RigidBody type="fixed" colliders={false} position={[12.8, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <CuboidCollider args={[1.05, 1.3, 2.4]} position={[0, 1.3, 0]} />
            <VehicleTruck variant="box" quality={quality} isNight={isNight} />
          </RigidBody>
          <RigidBody type="fixed" colliders={false} position={[-12.8, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <CuboidCollider args={[1.05, 1.3, 2.4]} position={[0, 1.3, 0]} />
            <VehicleTruck variant="pickup" quality={quality} isNight={isNight} />
          </RigidBody>
        </group>
      )}

      {zone === 'bandung' && (
        <>
          <RigidBody type="fixed" colliders={false} position={[16, 0, -44]} rotation={[0, -0.35, 0]}>
            <CuboidCollider args={[0.9, 1.0, 1.95]} position={[0, 1.0, 0]} />
            <VehicleAngkot quality={quality} isNight={isNight} />
          </RigidBody>
          <RigidBody type="fixed" colliders={false} position={[19, 0, -44]} rotation={[0, -0.15, 0]}>
            <CuboidCollider args={[0.45, 0.65, 0.95]} position={[0, 0.65, 0]} />
            <VehicleOjol quality={quality} isNight={isNight} />
          </RigidBody>
          {/* SDN Harapan Bandung */}
          <group position={[SCHOOL_BANDUNG_POS.x, 0, SCHOOL_BANDUNG_POS.z]} rotation={[0, Math.PI, 0]}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[7.4, 2.2, 2.6]} position={[0, 2.2, -3.5]} />
              <BuildingSekolah
                title="SDN HARAPAN BANDUNG"
                subtitle="SEKOLAH DASAR PERCONTOHAN"
                quality={quality}
                isNight={isNight}
              />
            </RigidBody>
          </group>

          {/* Ikon Mini Gedung Sate Bandung */}
          <group position={[22, 0, -12]}>
            <RigidBody type="fixed" colliders="cuboid">
              <mesh position={[0, 3, 0]} castShadow={shadows}>
                <boxGeometry args={[12, 6, 8]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.75} />
              </mesh>
              <mesh position={[0, 7.2, 0]} castShadow={shadows}>
                <boxGeometry args={[3.5, 2.8, 3.5]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
              </mesh>
              <mesh position={[0, 10, 0]}>
                <cylinderGeometry args={[0.15, 0.25, 3, 6]} />
                <meshStandardMaterial
                  color={isNight ? '#fde047' : '#d97706'}
                  emissive={isNight ? '#f59e0b' : '#000000'}
                />
              </mesh>
            </RigidBody>
            <Text
              position={[0, 12, 0]}
              fontSize={0.75}
              color="#fde68a"
              anchorX="center"
              outlineWidth={0.05}
              outlineColor="#0f172a"
            >
              PUSAT KOTA BANDUNG
            </Text>
          </group>
        </>
      )}

      {zone === 'nagreg' && (
        <>
          {/* Perbukitan Tinggi Lingkar Nagreg */}
          {[
            { pos: [-40, 10, -10] as [number, number, number], r: 22, h: 22 },
            { pos: [40, 11, -8] as [number, number, number], r: 24, h: 24 },
            { pos: [0, 13, 30] as [number, number, number], r: 30, h: 28 },
          ].map((h, i) => (
            <mesh key={i} position={h.pos} material={hillMat}>
              <coneGeometry args={[h.r, h.h, 7]} />
            </mesh>
          ))}
          <group position={[0, 0, -10]}>
            <RigidBody type="fixed" colliders="cuboid">
              <mesh position={[0, 0.2, 0]} receiveShadow>
                <boxGeometry args={[8, 0.4, 8]} />
                <meshStandardMaterial color="#d6d3d1" />
              </mesh>
              <mesh position={[0, 3.2, 0]} castShadow={shadows}>
                <coneGeometry args={[5.5, 2.2, 4]} />
                <meshStandardMaterial color="#b45309" />
              </mesh>
            </RigidBody>
            <Text
              position={[0, 5.2, 0]}
              fontSize={0.75}
              color="#fef08a"
              anchorX="center"
              outlineWidth={0.05}
              outlineColor="#0f172a"
            >
              GAZEBO PUNCAK NAGREG
            </Text>
          </group>
        </>
      )}
    </group>
  );
};
