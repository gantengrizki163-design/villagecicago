import React from 'react';
import { RigidBody } from '@react-three/rapier';
import type { GraphicsQuality } from '../types/game';
import { getLotPlacement } from './layout/layoutHelpers';
import { UnifiedLotCollider } from './layout/UnifiedLotCollider';
import { BuildingBengkel, BuildingSpbu, SamsatSimKioskProp } from './assets/BuildingSpbuAndBengkel';
import { BuildingVehicleDealer } from './assets/BuildingVehicleDealer';
import { TrafficInfrastructure3D } from './assets/TrafficInfrastructure3D';

interface VehicleWorldBuildings3DProps {
  quality: GraphicsQuality;
  isNight: boolean;
  serverOffsetMs: number;
}

/**
 * Bangunan Sistem Kendaraan & Infrastruktur Jalan Kota Cicalengka:
 * - Dealer Motor Baru, Lapak Motor Bekas
 * - Showroom Mobil Baru, Showroom Mobil Bekas
 * - SPBU & Stasiun Cas EV
 * - Bengkel Resmi Priangan
 * - Loket Samsat & Area Ujian SIM di Kantor Desa
 * - Lampu Lalu Lintas Deterministik, 4 Lahan Parkir Umum, 4 Halte Angkot, & Rambu Jalan
 */
export const VehicleWorldBuildings3D: React.FC<VehicleWorldBuildings3DProps> = ({
  quality,
  isNight,
  serverOffsetMs,
}) => {
  const dealerMotorBaru = getLotPlacement('dealer_motor_baru');
  const lapakMotorBekas = getLotPlacement('lapak_motor_bekas');
  const showroomMobilBaru = getLotPlacement('showroom_mobil_baru');
  const showroomMobilBekas = getLotPlacement('showroom_mobil_bekas');
  const spbuLot = getLotPlacement('spbu_cicalengka');
  const bengkelLot = getLotPlacement('bengkel_umum');

  return (
    <group>
      {/* 1. DEALER MOTOR BARU */}
      <group
        position={[dealerMotorBaru.x, 0, dealerMotorBaru.z]}
        rotation={[0, dealerMotorBaru.rotY, 0]}
      >
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="dealer_motor_baru" />
          <BuildingVehicleDealer
            variant="motor_new"
            title="DEALER MOTOR SILIWANGI"
            subtitle="MOTOR BARU · TUNAI & KREDIT"
            width={dealerMotorBaru.footprint.width}
            depth={dealerMotorBaru.footprint.depth}
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* 2. LAPAK MOTOR BEKAS */}
      <group
        position={[lapakMotorBekas.x, 0, lapakMotorBekas.z]}
        rotation={[0, lapakMotorBekas.rotY, 0]}
      >
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="lapak_motor_bekas" />
          <BuildingVehicleDealer
            variant="motor_used"
            title="LAPAK MOTOR BEKAS"
            subtitle="KANG UJANG · TUKAR TAMBAH"
            width={lapakMotorBekas.footprint.width}
            depth={lapakMotorBekas.footprint.depth}
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* 3. SHOWROOM MOBIL BARU */}
      <group
        position={[showroomMobilBaru.x, 0, showroomMobilBaru.z]}
        rotation={[0, showroomMobilBaru.rotY, 0]}
      >
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="showroom_mobil_baru" />
          <BuildingVehicleDealer
            variant="mobil_new"
            title="SHOWROOM PRIANGAN"
            subtitle="MOBIL BARU · TEST DRIVE"
            width={showroomMobilBaru.footprint.width}
            depth={showroomMobilBaru.footprint.depth}
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* 4. SHOWROOM MOBIL BEKAS */}
      <group
        position={[showroomMobilBekas.x, 0, showroomMobilBekas.z]}
        rotation={[0, showroomMobilBekas.rotY, 0]}
      >
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="showroom_mobil_bekas" />
          <BuildingVehicleDealer
            variant="mobil_used"
            title="SHOWROOM MOBIL BEKAS"
            subtitle="JAYA MOTOR · LEASING & CASH"
            width={showroomMobilBekas.footprint.width}
            depth={showroomMobilBekas.footprint.depth}
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* 5. SPBU & STASIUN CAS EV */}
      <group position={[spbuLot.x, 0, spbuLot.z]} rotation={[0, spbuLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="spbu_cicalengka" />
          <BuildingSpbu quality={quality} isNight={isNight} />
        </RigidBody>
      </group>

      {/* 6. BENGKEL RESMI */}
      <group position={[bengkelLot.x, 0, bengkelLot.z]} rotation={[0, bengkelLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="bengkel_umum" />
          <BuildingBengkel quality={quality} isNight={isNight} />
        </RigidBody>
      </group>

      {/* 7. LOKET SAMSAT & UJIAN SIM DI HALAMAN KANTOR DESA */}
      <SamsatSimKioskProp position={[-24.2, 0, 8.6]} isNight={isNight} />

      {/* 8. INFRASTRUKTUR JALAN, LAMPU LALU LINTAS, PARKIR, & HALTE ANGKOT */}
      <TrafficInfrastructure3D
        serverOffsetMs={serverOffsetMs}
        quality={quality}
        isNight={isNight}
      />
    </group>
  );
};
