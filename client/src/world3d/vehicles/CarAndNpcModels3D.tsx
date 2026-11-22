import React from 'react';
import { getCustomColorMaterial, getPaletteMaterial } from '../assets/paletteMaterials';
import type { VehicleSharedMaterials } from './vehicleMaterials';

export interface CarModelMeshProps {
  subType: string;
  mats: VehicleSharedMaterials;
  castShadow: boolean;
  lod: 'full' | 'simple';
  steerAngle: number;
  wheelSpinRad: number;
  isNight?: boolean;
  sirenActive?: boolean;
  accessories?: string[];
}

const CarWheel: React.FC<{
  pos: [number, number, number];
  radius: number;
  width: number;
  mats: VehicleSharedMaterials;
  castShadow: boolean;
  spin: number;
  steer?: number;
  simple?: boolean;
  aero?: boolean;
}> = ({ pos, radius, width, mats, castShadow, spin, steer = 0, simple, aero }) => (
  <group position={pos} rotation={[0, steer, 0]}>
    <group rotation={[spin, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={mats.tire} castShadow={castShadow}>
        <cylinderGeometry args={[radius, radius, width, simple ? 8 : 12]} />
      </mesh>
      {!simple && (
        <mesh rotation={[0, 0, Math.PI / 2]} material={aero ? mats.accentDark : mats.rim}>
          <cylinderGeometry args={[radius * 0.56, radius * 0.56, width + 0.015, 10]} />
        </mesh>
      )}
    </group>
  </group>
);

export const CarAndNpcModelMesh: React.FC<CarModelMeshProps> = ({
  subType,
  mats,
  castShadow,
  lod,
  steerAngle,
  wheelSpinRad,
  isNight = false,
  sirenActive = false,
  accessories = [],
}) => {
  const hasRoofRack = accessories.includes('rak_atap');
  const hasLedBar = accessories.includes('lampu_led');
  const hasSportExhaust = accessories.includes('knalpot_sport');

  // --- BUS PRIANGAN (7.6m) ---
  if (subType === 'bus') {
    const stripeMat = getPaletteMaterial('trim_bank_blue');
    if (lod === 'simple') {
      return (
        <group>
          <mesh position={[0, 1.48, 0]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[2.18, 2.25, 7.2]} />
          </mesh>
          <mesh position={[-0.98, 0.42, 2.2]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
            <cylinderGeometry args={[0.42, 0.42, 0.24, 8]} />
          </mesh>
          <mesh position={[0.98, 0.42, 2.2]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
            <cylinderGeometry args={[0.42, 0.42, 0.24, 8]} />
          </mesh>
          <mesh position={[-0.98, 0.42, -2.1]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 8]} />
          </mesh>
          <mesh position={[0.98, 0.42, -2.1]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 8]} />
          </mesh>
        </group>
      );
    }

    return (
      <group>
        <mesh position={[0, 1.46, 0]} material={mats.body} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[2.22, 2.2, 7.35]} />
        </mesh>
        <mesh position={[0, 0.96, 0]} material={stripeMat}>
          <boxGeometry args={[2.26, 0.26, 7.38]} />
        </mesh>
        {/* Kaca Depan Panorama */}
        <mesh position={[0, 1.72, 3.68]} material={mats.glass}>
          <boxGeometry args={[1.98, 0.92, 0.06]} />
        </mesh>
        {/* Kaca Samping Panjang */}
        <mesh position={[-1.12, 1.78, -0.15]} material={mats.glass}>
          <boxGeometry args={[0.04, 0.72, 6.2]} />
        </mesh>
        <mesh position={[1.12, 1.78, -0.15]} material={mats.glass}>
          <boxGeometry args={[0.04, 0.72, 6.2]} />
        </mesh>
        {/* Unit AC Atap */}
        <mesh position={[0, 2.66, 0.4]} material={mats.plate} castShadow={castShadow}>
          <boxGeometry args={[1.25, 0.2, 2.4]} />
        </mesh>
        <mesh position={[0, 2.32, 3.66]} material={mats.headlight}>
          <boxGeometry args={[1.1, 0.18, 0.06]} />
        </mesh>
        <mesh position={[0, 0.42, 3.68]} material={mats.bumper}>
          <boxGeometry args={[2.22, 0.24, 0.14]} />
        </mesh>
        <mesh position={[0, 0.42, -3.68]} material={mats.bumper}>
          <boxGeometry args={[2.22, 0.24, 0.14]} />
        </mesh>
        <mesh position={[-0.78, 0.72, 3.69]} material={mats.headlight}>
          <boxGeometry args={[0.3, 0.18, 0.05]} />
        </mesh>
        <mesh position={[0.78, 0.72, 3.69]} material={mats.headlight}>
          <boxGeometry args={[0.3, 0.18, 0.05]} />
        </mesh>
        <mesh position={[0.98, 0.72, 3.69]} material={mats.turnLeft}>
          <boxGeometry args={[0.1, 0.14, 0.05]} />
        </mesh>
        <mesh position={[-0.98, 0.72, 3.69]} material={mats.turnRight}>
          <boxGeometry args={[0.1, 0.14, 0.05]} />
        </mesh>
        <mesh position={[-0.78, 0.74, -3.69]} material={mats.taillight}>
          <boxGeometry args={[0.26, 0.22, 0.05]} />
        </mesh>
        <mesh position={[0.78, 0.74, -3.69]} material={mats.taillight}>
          <boxGeometry args={[0.26, 0.22, 0.05]} />
        </mesh>
        <mesh position={[0.96, 0.74, -3.69]} material={mats.turnLeft}>
          <boxGeometry args={[0.1, 0.18, 0.05]} />
        </mesh>
        <mesh position={[-0.96, 0.74, -3.69]} material={mats.turnRight}>
          <boxGeometry args={[0.1, 0.18, 0.05]} />
        </mesh>
        <CarWheel pos={[-1.02, 0.42, 2.18]} radius={0.42} width={0.24} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[1.02, 0.42, 2.18]} radius={0.42} width={0.24} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[-1.0, 0.42, -2.08]} radius={0.42} width={0.3} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        <CarWheel pos={[1.0, 0.42, -2.08]} radius={0.42} width={0.3} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
      </group>
    );
  }

  // --- TRUK BESAR NIAGA (6.8m, 6 Roda / 3 Poros) ---
  if (subType === 'truk_besar') {
    const cargoMat = getCustomColorMaterial('#CBD5E1', { roughness: 0.65 });
    const tarpMat = getPaletteMaterial('tarp_blue');
    if (lod === 'simple') {
      return (
        <group>
          <mesh position={[0, 1.32, 2.1]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[2.06, 1.75, 1.6]} />
          </mesh>
          <mesh position={[0, 1.56, -0.95]} material={cargoMat} castShadow={castShadow}>
            <boxGeometry args={[2.18, 2.1, 4.4]} />
          </mesh>
          <CarWheel pos={[-0.98, 0.42, 2.1]} radius={0.42} width={0.24} mats={mats} castShadow={false} spin={0} simple />
          <CarWheel pos={[0.98, 0.42, 2.1]} radius={0.42} width={0.24} mats={mats} castShadow={false} spin={0} simple />
          <CarWheel pos={[-0.98, 0.42, -1.8]} radius={0.42} width={0.26} mats={mats} castShadow={false} spin={0} simple />
          <CarWheel pos={[0.98, 0.42, -1.8]} radius={0.42} width={0.26} mats={mats} castShadow={false} spin={0} simple />
        </group>
      );
    }

    return (
      <group>
        <mesh position={[0, 0.54, 0]} material={mats.bumper} castShadow={castShadow}>
          <boxGeometry args={[1.76, 0.26, 6.4]} />
        </mesh>
        <mesh position={[0, 1.36, 2.25]} material={mats.body} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[2.08, 1.65, 1.62]} />
        </mesh>
        <mesh position={[0, 1.72, 3.06]} material={mats.glass}>
          <boxGeometry args={[1.82, 0.66, 0.06]} />
        </mesh>
        <mesh position={[0, 1.64, -0.92]} material={cargoMat} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[2.16, 2.02, 4.45]} />
        </mesh>
        <mesh position={[0, 2.68, -0.92]} material={tarpMat}>
          <boxGeometry args={[2.12, 0.14, 4.4]} />
        </mesh>
        <mesh position={[0, 0.52, 3.12]} material={mats.bumper}>
          <boxGeometry args={[2.12, 0.24, 0.16]} />
        </mesh>
        <mesh position={[-0.72, 0.86, 3.08]} material={mats.headlight}>
          <boxGeometry args={[0.28, 0.18, 0.06]} />
        </mesh>
        <mesh position={[0.72, 0.86, 3.08]} material={mats.headlight}>
          <boxGeometry args={[0.28, 0.18, 0.06]} />
        </mesh>
        <CarWheel pos={[-0.98, 0.42, 2.15]} radius={0.42} width={0.25} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[0.98, 0.42, 2.15]} radius={0.42} width={0.25} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[-0.98, 0.42, -1.2]} radius={0.42} width={0.28} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        <CarWheel pos={[0.98, 0.42, -1.2]} radius={0.42} width={0.28} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        <CarWheel pos={[-0.98, 0.42, -2.28]} radius={0.42} width={0.28} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        <CarWheel pos={[0.98, 0.42, -2.28]} radius={0.42} width={0.28} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
      </group>
    );
  }

  // --- AMBULANS PUSKESMAS ---
  if (subType === 'ambulans') {
    const redMat = getPaletteMaterial('trim_mart_red');
    const blueSirenMat = getPaletteMaterial('trim_mart_blue', {
      emissive: '#3B82F6',
      emissiveIntensity: sirenActive || isNight ? 1.8 : 0.6,
    });
    const redSirenMat = getCustomColorMaterial('#EF4444');
    if (lod === 'simple') {
      return (
        <group>
          <mesh position={[0, 1.02, -0.1]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[1.82, 1.38, 3.8]} />
          </mesh>
          <mesh position={[0, 1.78, 0.8]} material={blueSirenMat}>
            <boxGeometry args={[0.8, 0.14, 0.24]} />
          </mesh>
        </group>
      );
    }

    return (
      <group>
        <mesh position={[0, 1.05, -0.18]} material={mats.body} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[1.82, 1.44, 3.3]} />
        </mesh>
        <mesh position={[0, 0.72, 1.62]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[1.78, 0.76, 0.85]} />
        </mesh>
        <mesh position={[0, 1.32, 1.48]} rotation={[-0.36, 0, 0]} material={mats.glass}>
          <boxGeometry args={[1.56, 0.62, 0.28]} />
        </mesh>
        <mesh position={[0, 0.84, -0.18]} material={redMat}>
          <boxGeometry args={[1.85, 0.16, 3.33]} />
        </mesh>
        {[-0.93, 0.93].map((sx) => (
          <group key={sx} position={[sx, 1.36, -0.35]}>
            <mesh material={redMat}>
              <boxGeometry args={[0.04, 0.44, 0.14]} />
            </mesh>
            <mesh material={redMat}>
              <boxGeometry args={[0.04, 0.14, 0.44]} />
            </mesh>
          </group>
        ))}
        <group position={[0, 1.85, 0.92]}>
          <mesh position={[-0.28, 0, 0]} material={redSirenMat}>
            <boxGeometry args={[0.32, 0.14, 0.24]} />
          </mesh>
          <mesh position={[0, 0, 0]} material={mats.plate}>
            <boxGeometry args={[0.24, 0.13, 0.24]} />
          </mesh>
          <mesh position={[0.28, 0, 0]} material={blueSirenMat}>
            <boxGeometry args={[0.32, 0.14, 0.24]} />
          </mesh>
        </group>
        <mesh position={[0, 0.34, 2.06]} material={mats.bumper}>
          <boxGeometry args={[1.84, 0.18, 0.12]} />
        </mesh>
        <mesh position={[-0.64, 0.64, 2.05]} material={mats.headlight}>
          <boxGeometry args={[0.26, 0.16, 0.05]} />
        </mesh>
        <mesh position={[0.64, 0.64, 2.05]} material={mats.headlight}>
          <boxGeometry args={[0.26, 0.16, 0.05]} />
        </mesh>
        <CarWheel pos={[-0.86, 0.32, 1.32]} radius={0.32} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[0.86, 0.32, 1.32]} radius={0.32} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[-0.86, 0.32, -1.25]} radius={0.32} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        <CarWheel pos={[0.86, 0.32, -1.25]} radius={0.32} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
      </group>
    );
  }

  // --- MOBIL ANGKOT CICALENGKA ---
  if (subType === 'angkot') {
    const darkTrim = getCustomColorMaterial('#2C6B32', { roughness: 0.55 });
    const rackMat = getPaletteMaterial('rail_steel');
    if (lod === 'simple') {
      return (
        <group>
          <mesh position={[0, 0.88, 0]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[1.68, 1.15, 3.7]} />
          </mesh>
          <CarWheel pos={[-0.82, 0.3, 1.16]} radius={0.3} width={0.2} mats={mats} castShadow={false} spin={0} simple />
          <CarWheel pos={[0.82, 0.3, 1.16]} radius={0.3} width={0.2} mats={mats} castShadow={false} spin={0} simple />
          <CarWheel pos={[-0.82, 0.3, -1.16]} radius={0.3} width={0.2} mats={mats} castShadow={false} spin={0} simple />
          <CarWheel pos={[0.82, 0.3, -1.16]} radius={0.3} width={0.2} mats={mats} castShadow={false} spin={0} simple />
        </group>
      );
    }

    return (
      <group>
        <mesh position={[0, 0.55, 0]} material={mats.body} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[1.68, 0.62, 3.72]} />
        </mesh>
        <mesh position={[0, 0.42, 0]} material={darkTrim}>
          <boxGeometry args={[1.72, 0.1, 3.66]} />
        </mesh>
        <mesh position={[0, 1.44, -0.08]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[1.64, 0.2, 3.35]} />
        </mesh>
        <mesh position={[-0.76, 1.12, -0.15]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[0.14, 0.56, 3.15]} />
        </mesh>
        <mesh position={[-0.81, 1.13, -0.25]} material={mats.glass}>
          <boxGeometry args={[0.06, 0.4, 2.35]} />
        </mesh>
        <mesh position={[0.76, 1.12, 0.92]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[0.14, 0.56, 0.92]} />
        </mesh>
        <mesh position={[0.76, 1.12, -1.25]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[0.14, 0.56, 0.95]} />
        </mesh>
        <mesh position={[-0.45, 0.64, -0.45]} material={mats.wood}>
          <boxGeometry args={[0.42, 0.16, 1.8]} />
        </mesh>
        <mesh position={[0.45, 0.64, -0.95]} material={mats.wood}>
          <boxGeometry args={[0.42, 0.16, 0.85]} />
        </mesh>
        <mesh position={[0, 1.12, -1.78]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[1.64, 0.56, 0.16]} />
        </mesh>
        <mesh position={[0, 1.14, -1.84]} material={mats.glass}>
          <boxGeometry args={[1.25, 0.36, 0.06]} />
        </mesh>
        <mesh position={[0, 1.06, 1.56]} rotation={[-0.24, 0, 0]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[1.64, 0.62, 0.42]} />
        </mesh>
        <mesh position={[0, 1.12, 1.72]} rotation={[-0.24, 0, 0]} material={mats.glass}>
          <boxGeometry args={[1.42, 0.44, 0.12]} />
        </mesh>
        <mesh position={[0, 0.28, 1.88]} material={mats.bumper}>
          <boxGeometry args={[1.74, 0.16, 0.14]} />
        </mesh>
        <mesh position={[0, 0.28, -1.88]} material={mats.bumper}>
          <boxGeometry args={[1.74, 0.16, 0.14]} />
        </mesh>
        <mesh position={[0, 0.28, 1.96]} material={mats.plate}>
          <boxGeometry args={[0.46, 0.11, 0.03]} />
        </mesh>
        <mesh position={[-0.6, 0.52, 1.88]} material={mats.headlight}>
          <boxGeometry args={[0.26, 0.15, 0.06]} />
        </mesh>
        <mesh position={[0.6, 0.52, 1.88]} material={mats.headlight}>
          <boxGeometry args={[0.26, 0.15, 0.06]} />
        </mesh>
        <mesh position={[0.76, 0.52, 1.88]} material={mats.turnLeft}>
          <boxGeometry args={[0.08, 0.12, 0.06]} />
        </mesh>
        <mesh position={[-0.76, 0.52, 1.88]} material={mats.turnRight}>
          <boxGeometry args={[0.08, 0.12, 0.06]} />
        </mesh>
        <mesh position={[-0.66, 0.54, -1.88]} material={mats.taillight}>
          <boxGeometry args={[0.2, 0.18, 0.05]} />
        </mesh>
        <mesh position={[0.66, 0.54, -1.88]} material={mats.taillight}>
          <boxGeometry args={[0.2, 0.18, 0.05]} />
        </mesh>
        <mesh position={[0.79, 0.54, -1.88]} material={mats.turnLeft}>
          <boxGeometry args={[0.08, 0.15, 0.05]} />
        </mesh>
        <mesh position={[-0.79, 0.54, -1.88]} material={mats.turnRight}>
          <boxGeometry args={[0.08, 0.15, 0.05]} />
        </mesh>
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
        <CarWheel pos={[-0.84, 0.3, 1.18]} radius={0.3} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[0.84, 0.3, 1.18]} radius={0.3} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[-0.84, 0.3, -1.16]} radius={0.3} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        <CarWheel pos={[0.84, 0.3, -1.16]} radius={0.3} width={0.2} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
      </group>
    );
  }

  // --- PICKUP & TRUK KECIL BOX ---
  if (subType === 'pickup' || subType === 'truk_kecil') {
    const isBox = subType === 'truk_kecil';
    const cargoMat = getCustomColorMaterial('#E2E8F0', { roughness: 0.58 });
    const wRadius = isBox ? 0.35 : 0.33;
    const len = isBox ? 4.5 : 4.1;
    const fZ = len * 0.31;
    const rZ = -len * 0.3;

    if (lod === 'simple') {
      return (
        <group>
          <mesh position={[0, 0.92, 1.1]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[1.76, 1.1, 1.3]} />
          </mesh>
          <mesh position={[0, isBox ? 1.4 : 0.72, -0.78]} material={isBox ? cargoMat : mats.body}>
            <boxGeometry args={[1.82, isBox ? 1.72 : 0.65, 2.5]} />
          </mesh>
        </group>
      );
    }

    return (
      <group>
        <mesh position={[0, 0.4, -0.05]} material={mats.bumper} castShadow={castShadow}>
          <boxGeometry args={[1.56, 0.18, len * 0.9]} />
        </mesh>
        <mesh position={[0, 0.88, fZ + 0.02]} material={mats.body} castShadow={castShadow} receiveShadow>
          <boxGeometry args={[1.76, 0.84, 1.25]} />
        </mesh>
        <mesh position={[0, 1.48, fZ - 0.14]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[1.68, 0.56, 0.98]} />
        </mesh>
        <mesh position={[0, 1.44, fZ + 0.32]} rotation={[-0.22, 0, 0]} material={mats.glass}>
          <boxGeometry args={[1.48, 0.46, 0.12]} />
        </mesh>
        <mesh position={[-0.86, 1.46, fZ - 0.12]} material={mats.glass}>
          <boxGeometry args={[0.04, 0.38, 0.62]} />
        </mesh>
        <mesh position={[0.86, 1.46, fZ - 0.12]} material={mats.glass}>
          <boxGeometry args={[0.04, 0.38, 0.62]} />
        </mesh>
        {isBox ? (
          <mesh position={[0, 1.42, -0.76]} material={cargoMat} castShadow={castShadow} receiveShadow>
            <boxGeometry args={[1.88, 1.78, 2.75]} />
          </mesh>
        ) : (
          <group position={[0, 0.78, -0.74]}>
            <mesh position={[0, -0.16, 0]} material={mats.wood} castShadow={castShadow}>
              <boxGeometry args={[1.72, 0.12, 2.32]} />
            </mesh>
            <mesh position={[-0.82, 0.14, 0]} material={mats.body} castShadow={castShadow}>
              <boxGeometry args={[0.1, 0.54, 2.32]} />
            </mesh>
            <mesh position={[0.82, 0.14, 0]} material={mats.body} castShadow={castShadow}>
              <boxGeometry args={[0.1, 0.54, 2.32]} />
            </mesh>
            <mesh position={[0, 0.14, -1.12]} material={mats.body} castShadow={castShadow}>
              <boxGeometry args={[1.72, 0.54, 0.1]} />
            </mesh>
          </group>
        )}
        <mesh position={[0, 0.4, fZ + 0.68]} material={mats.bumper}>
          <boxGeometry args={[1.8, 0.18, 0.14]} />
        </mesh>
        <mesh position={[-0.6, 0.66, fZ + 0.66]} material={mats.headlight}>
          <boxGeometry args={[0.26, 0.16, 0.05]} />
        </mesh>
        <mesh position={[0.6, 0.66, fZ + 0.66]} material={mats.headlight}>
          <boxGeometry args={[0.26, 0.16, 0.05]} />
        </mesh>
        <mesh position={[0.78, 0.66, fZ + 0.66]} material={mats.turnLeft}>
          <boxGeometry args={[0.09, 0.13, 0.05]} />
        </mesh>
        <mesh position={[-0.78, 0.66, fZ + 0.66]} material={mats.turnRight}>
          <boxGeometry args={[0.09, 0.13, 0.05]} />
        </mesh>
        <mesh position={[0.74, 0.52, -len * 0.48]} material={mats.turnLeft}>
          <boxGeometry args={[0.09, 0.13, 0.05]} />
        </mesh>
        <mesh position={[-0.74, 0.52, -len * 0.48]} material={mats.turnRight}>
          <boxGeometry args={[0.09, 0.13, 0.05]} />
        </mesh>
        <mesh position={[0, 0.4, fZ + 0.76]} material={mats.plate}>
          <boxGeometry args={[0.46, 0.11, 0.02]} />
        </mesh>
        <CarWheel pos={[-0.84, wRadius, fZ]} radius={wRadius} width={0.22} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[0.84, wRadius, fZ]} radius={wRadius} width={0.22} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} />
        <CarWheel pos={[-0.84, wRadius, rZ]} radius={wRadius} width={0.24} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        <CarWheel pos={[0.84, wRadius, rZ]} radius={wRadius} width={0.24} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
      </group>
    );
  }

  // --- MOBIL PENUMPANG: city_car, hatchback, sedan, mpv, suv, ev, polisi ---
  const isCity = subType === 'city_car';
  const isHatch = subType === 'hatchback';
  const isSedan = subType === 'sedan';
  const isMpv = subType === 'mpv';
  const isSuv = subType === 'suv';
  const isEv = subType === 'ev';
  const isPolice = subType === 'polisi';

  const bodyLen = isCity ? 3.45 : isHatch ? 3.85 : isSedan ? 4.35 : isMpv ? 4.3 : isSuv ? 4.4 : isPolice ? 4.3 : 4.05;
  const bodyWid = isCity ? 1.62 : isSuv ? 1.84 : 1.74;
  const groundLift = isSuv ? 0.14 : 0.04;
  const wheelR = isSuv ? 0.37 : 0.3;
  const frontZ = bodyLen * 0.31;
  const rearZ = -bodyLen * 0.31;

  if (lod === 'simple') {
    return (
      <group>
        <mesh position={[0, 0.56 + groundLift, 0]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[bodyWid, 0.56, bodyLen]} />
        </mesh>
        <mesh position={[0, 1.05 + groundLift, isSedan ? -0.15 : -0.22]} material={mats.glass}>
          <boxGeometry args={[bodyWid * 0.86, 0.48, bodyLen * (isMpv || isSuv ? 0.62 : 0.52)]} />
        </mesh>
        <CarWheel pos={[-bodyWid * 0.46, wheelR, frontZ]} radius={wheelR} width={0.2} mats={mats} castShadow={false} spin={0} simple />
        <CarWheel pos={[bodyWid * 0.46, wheelR, frontZ]} radius={wheelR} width={0.2} mats={mats} castShadow={false} spin={0} simple />
        <CarWheel pos={[-bodyWid * 0.46, wheelR, rearZ]} radius={wheelR} width={0.2} mats={mats} castShadow={false} spin={0} simple />
        <CarWheel pos={[bodyWid * 0.46, wheelR, rearZ]} radius={wheelR} width={0.2} mats={mats} castShadow={false} spin={0} simple />
      </group>
    );
  }

  const cabinLen = isSedan || isPolice ? bodyLen * 0.46 : isMpv || isSuv ? bodyLen * 0.64 : bodyLen * 0.56;
  const cabinZ = isSedan || isPolice ? -0.16 : isCity ? -0.2 : -0.24;
  const cabinHeight = isMpv ? 0.64 : isSuv ? 0.62 : 0.54;
  const policeDoorWhite = getPaletteMaterial('flag_white');
  const blueSirenMat = getPaletteMaterial('trim_mart_blue', {
    emissive: '#3B82F6',
    emissiveIntensity: sirenActive || isNight ? 1.8 : 0.7,
  });
  const redSirenMat = getCustomColorMaterial('#EF4444');

  return (
    <group>
      {/* Bodi bawah & kap mesin */}
      <mesh position={[0, 0.54 + groundLift, 0]} material={mats.body} castShadow={castShadow} receiveShadow>
        <boxGeometry args={[bodyWid, 0.56, bodyLen]} />
      </mesh>
      {/* Cladding fender hitam untuk SUV / EV / Police */}
      {(isSuv || isEv || isPolice) && (
        <mesh position={[0, 0.34 + groundLift, 0]} material={mats.bumper}>
          <boxGeometry args={[bodyWid + 0.06, 0.18, bodyLen - 0.1]} />
        </mesh>
      )}
      {/* Pintu putih polisi Polsek Cicalengka */}
      {isPolice && (
        <mesh position={[0, 0.56 + groundLift, -0.05]} material={policeDoorWhite}>
          <boxGeometry args={[bodyWid + 0.04, 0.44, 1.55]} />
        </mesh>
      )}

      {/* Atap & Kabin Kaca */}
      <mesh position={[0, 0.82 + groundLift + cabinHeight * 0.5, cabinZ]} material={mats.body} castShadow={castShadow}>
        <boxGeometry args={[bodyWid * 0.86, cabinHeight, cabinLen]} />
      </mesh>
      {/* Kaca Depan */}
      <mesh
        position={[0, 0.8 + groundLift + cabinHeight * 0.48, cabinZ + cabinLen * 0.5]}
        rotation={[-0.45, 0, 0]}
        material={mats.glass}
      >
        <boxGeometry args={[bodyWid * 0.78, cabinHeight * 0.9, 0.14]} />
      </mesh>
      {/* Kaca Belakang */}
      <mesh
        position={[0, 0.8 + groundLift + cabinHeight * 0.48, cabinZ - cabinLen * 0.5]}
        rotation={[isHatch || isCity ? 0.32 : 0.48, 0, 0]}
        material={mats.glass}
      >
        <boxGeometry args={[bodyWid * 0.76, cabinHeight * 0.82, 0.12]} />
      </mesh>
      {/* Kaca Samping */}
      <mesh position={[-bodyWid * 0.435, 0.8 + groundLift + cabinHeight * 0.5, cabinZ]} material={mats.glass}>
        <boxGeometry args={[0.04, cabinHeight * 0.68, cabinLen * 0.86]} />
      </mesh>
      <mesh position={[bodyWid * 0.435, 0.8 + groundLift + cabinHeight * 0.5, cabinZ]} material={mats.glass}>
        <boxGeometry args={[0.04, cabinHeight * 0.68, cabinLen * 0.86]} />
      </mesh>

      {/* Detail Khas per Varian */}
      {isHatch && (
        /* Spoiler belakang Hatchback RS */
        <mesh position={[0, 1.38 + groundLift, cabinZ - cabinLen * 0.52]} material={mats.accentDark} castShadow={castShadow}>
          <boxGeometry args={[bodyWid * 0.78, 0.07, 0.24]} />
        </mesh>
      )}
      {isSedan && (
        /* Lis chrome jendela & bagasi belakang Sedan Eksekutif */
        <mesh position={[0, 0.84 + groundLift, -bodyLen * 0.36]} material={mats.chrome}>
          <boxGeometry args={[bodyWid * 0.72, 0.04, 0.08]} />
        </mesh>
      )}
      {(isMpv || isSuv || hasRoofRack) && (
        /* Roof rail / rak atap */
        <group position={[0, 0.82 + groundLift + cabinHeight + 0.05, cabinZ]}>
          <mesh position={[-bodyWid * 0.34, 0, 0]} material={mats.chrome}>
            <boxGeometry args={[0.06, 0.07, cabinLen * 0.82]} />
          </mesh>
          <mesh position={[bodyWid * 0.34, 0, 0]} material={mats.chrome}>
            <boxGeometry args={[0.06, 0.07, cabinLen * 0.82]} />
          </mesh>
          {hasRoofRack && (
            <mesh position={[0, 0.04, 0]} material={mats.accentDark}>
              <boxGeometry args={[bodyWid * 0.68, 0.06, cabinLen * 0.68]} />
            </mesh>
          )}
        </group>
      )}
      {isSuv && (
        /* Ban cadangan pintu belakang & bullbar depan SUV */
        <>
          <mesh position={[0, 0.74 + groundLift, -bodyLen * 0.52]} rotation={[Math.PI / 2, 0, 0]} material={mats.tire} castShadow={castShadow}>
            <cylinderGeometry args={[0.31, 0.31, 0.18, 12]} />
          </mesh>
          <mesh position={[0, 0.46 + groundLift, bodyLen * 0.52]} material={mats.chrome}>
            <boxGeometry args={[1.1, 0.22, 0.1]} />
          </mesh>
        </>
      )}
      {isEv && (
        /* Lightbar cyan futuristik depan & atap panorama hitam */
        <>
          <mesh position={[0, 0.62 + groundLift, bodyLen * 0.505]} material={mats.evAccent}>
            <boxGeometry args={[bodyWid * 0.82, 0.06, 0.04]} />
          </mesh>
          <mesh position={[0, 0.82 + groundLift + cabinHeight + 0.01, cabinZ]} material={mats.glass}>
            <boxGeometry args={[bodyWid * 0.72, 0.04, cabinLen * 0.76]} />
          </mesh>
        </>
      )}
      {isPolice && (
        /* Bar sirine Polsek & pushbar depan */
        <>
          <group position={[0, 0.86 + groundLift + cabinHeight, cabinZ + 0.1]}>
            <mesh position={[-0.28, 0, 0]} material={redSirenMat}>
              <boxGeometry args={[0.34, 0.12, 0.22]} />
            </mesh>
            <mesh position={[0, 0, 0]} material={mats.plate}>
              <boxGeometry args={[0.2, 0.11, 0.22]} />
            </mesh>
            <mesh position={[0.28, 0, 0]} material={blueSirenMat}>
              <boxGeometry args={[0.34, 0.12, 0.22]} />
            </mesh>
          </group>
          <mesh position={[0, 0.42 + groundLift, bodyLen * 0.53]} material={mats.accentDark}>
            <boxGeometry args={[0.92, 0.24, 0.12]} />
          </mesh>
        </>
      )}

      {/* Bemper, Grille, Plat & Lampu */}
      <mesh position={[0, 0.3 + groundLift, bodyLen * 0.505]} material={mats.bumper}>
        <boxGeometry args={[bodyWid + 0.02, 0.16, 0.12]} />
      </mesh>
      <mesh position={[0, 0.3 + groundLift, -bodyLen * 0.505]} material={mats.bumper}>
        <boxGeometry args={[bodyWid + 0.02, 0.16, 0.12]} />
      </mesh>
      <mesh position={[0, 0.32 + groundLift, bodyLen * 0.525]} material={mats.plate}>
        <boxGeometry args={[0.42, 0.1, 0.02]} />
      </mesh>
      <mesh position={[0, 0.32 + groundLift, -bodyLen * 0.525]} material={mats.plate}>
        <boxGeometry args={[0.42, 0.1, 0.02]} />
      </mesh>
      <mesh position={[-bodyWid * 0.34, 0.56 + groundLift, bodyLen * 0.505]} material={mats.headlight}>
        <boxGeometry args={[0.28, 0.13, 0.05]} />
      </mesh>
      <mesh position={[bodyWid * 0.34, 0.56 + groundLift, bodyLen * 0.505]} material={mats.headlight}>
        <boxGeometry args={[0.28, 0.13, 0.05]} />
      </mesh>
      <mesh position={[bodyWid * 0.45, 0.56 + groundLift, bodyLen * 0.505]} material={mats.turnLeft}>
        <boxGeometry args={[0.08, 0.11, 0.05]} />
      </mesh>
      <mesh position={[-bodyWid * 0.45, 0.56 + groundLift, bodyLen * 0.505]} material={mats.turnRight}>
        <boxGeometry args={[0.08, 0.11, 0.05]} />
      </mesh>
      {hasLedBar && (
        <mesh position={[0, 0.4 + groundLift, bodyLen * 0.52]} material={mats.evAccent}>
          <boxGeometry args={[0.72, 0.06, 0.06]} />
        </mesh>
      )}
      <mesh position={[-bodyWid * 0.34, 0.58 + groundLift, -bodyLen * 0.505]} material={mats.taillight}>
        <boxGeometry args={[0.28, 0.13, 0.05]} />
      </mesh>
      <mesh position={[bodyWid * 0.34, 0.58 + groundLift, -bodyLen * 0.505]} material={mats.taillight}>
        <boxGeometry args={[0.28, 0.13, 0.05]} />
      </mesh>
      <mesh position={[bodyWid * 0.45, 0.58 + groundLift, -bodyLen * 0.505]} material={mats.turnLeft}>
        <boxGeometry args={[0.08, 0.12, 0.05]} />
      </mesh>
      <mesh position={[-bodyWid * 0.45, 0.58 + groundLift, -bodyLen * 0.505]} material={mats.turnRight}>
        <boxGeometry args={[0.08, 0.12, 0.05]} />
      </mesh>

      {/* Spion Kiri & Kanan */}
      <mesh position={[-bodyWid * 0.49, 0.92 + groundLift, cabinZ + cabinLen * 0.36]} material={mats.accentDark}>
        <boxGeometry args={[0.14, 0.09, 0.08]} />
      </mesh>
      <mesh position={[bodyWid * 0.49, 0.92 + groundLift, cabinZ + cabinLen * 0.36]} material={mats.accentDark}>
        <boxGeometry args={[0.14, 0.09, 0.08]} />
      </mesh>

      {/* Knalpot (kecuali EV) */}
      {!isEv && (
        <mesh position={[bodyWid * 0.3, 0.25 + groundLift, -bodyLen * 0.5]} rotation={[Math.PI / 2, 0, 0]} material={mats.chrome}>
          <cylinderGeometry args={[0.045, 0.045, 0.18, 8]} />
        </mesh>
      )}
      {hasSportExhaust && !isEv && (
        <mesh position={[-bodyWid * 0.3, 0.25 + groundLift, -bodyLen * 0.5]} rotation={[Math.PI / 2, 0, 0]} material={mats.chrome}>
          <cylinderGeometry args={[0.045, 0.045, 0.18, 8]} />
        </mesh>
      )}

      {/* 4 Roda */}
      <CarWheel pos={[-bodyWid * 0.47, wheelR, frontZ]} radius={wheelR} width={0.21} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} aero={isEv} />
      <CarWheel pos={[bodyWid * 0.47, wheelR, frontZ]} radius={wheelR} width={0.21} mats={mats} castShadow={castShadow} spin={wheelSpinRad} steer={steerAngle} aero={isEv} />
      <CarWheel pos={[-bodyWid * 0.47, wheelR, rearZ]} radius={wheelR} width={0.21} mats={mats} castShadow={castShadow} spin={wheelSpinRad} aero={isEv} />
      <CarWheel pos={[bodyWid * 0.47, wheelR, rearZ]} radius={wheelR} width={0.21} mats={mats} castShadow={castShadow} spin={wheelSpinRad} aero={isEv} />
    </group>
  );
};
