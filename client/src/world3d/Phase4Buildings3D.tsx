import React from 'react';
import { Text } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import type { BusinessDoc, GraphicsQuality } from '../types/game';
import { degToRad, getLotPlacement, LAYOUT_DATA } from './layout/layoutHelpers';
import { UnifiedLotCollider } from './layout/UnifiedLotCollider';
import { BuildingBank } from './assets/BuildingBank';
import { BuildingKantorDesa } from './assets/BuildingKantorDesa';
import { BuildingPasar } from './assets/BuildingPasar';
import { BuildingRuko } from './assets/BuildingRuko';

interface Phase4Buildings3DProps {
  quality: GraphicsQuality;
  isNight: boolean;
  businesses?: BusinessDoc[];
  serverNowMs?: number;
}

const BUSINESS_TYPE_COLORS: Record<string, string> = {
  warung: '#ea580c',
  kelontong: '#2563eb',
  bengkel: '#475569',
  jasa: '#7c3aed',
  lapak_pasar: '#059669',
  dealer: '#0369a1',
};

const BUSINESS_TYPE_SHORT: Record<string, string> = {
  warung: 'WARUNG',
  kelontong: 'KELONTONG',
  bengkel: 'BENGKEL',
  jasa: 'JASA',
  lapak_pasar: 'LAPAK',
  dealer: 'DEALER',
};

export const Phase4Buildings3D: React.FC<Phase4Buildings3DProps> = ({
  quality,
  isNight,
  businesses = [],
  serverNowMs = Date.now(),
}) => {
  const shadows = quality !== 'low';
  const activeBusinesses = businesses.filter((b) => b.status === 'active' && b.position);

  const bankLot = getLotPlacement('bank');
  const kantorDesaLot = getLotPlacement('kantor_desa');
  const pasarGrosirLot = getLotPlacement('pasar_grosir');
  const balaiLelangLot = getLotPlacement('balai_lelang');
  const atms = LAYOUT_DATA.anchors.atms;

  return (
    <group>
      {/* 1. GEDUNG BANK PRIANGAN CICALENGKA */}
      <group position={[bankLot.x, 0, bankLot.z]} rotation={[0, bankLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="bank" />
          <BuildingBank
            title="BANK PRIANGAN CICALENGKA"
            subtitle="TABUNGAN · KPR · ATM 24 JAM"
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
        {isNight && quality !== 'low' && (
          <pointLight position={[0, 3.8, 5.5]} color="#fde68a" intensity={2.2} distance={15} decay={1.4} />
        )}
      </group>

      {/* 2. 3 BILIK ATM TERPISAH (Stasiun, Alun-Alun, Pasar) */}
      {atms.map((atm) => (
        <group key={atm.id} position={[atm.x, 0, atm.z]} rotation={[0, degToRad(atm.rotDeg), 0]}>
          <RigidBody type="fixed" colliders={false}>
            <UnifiedLotCollider lotId={atm.id} />
            <mesh position={[0, 0.08, 0]} receiveShadow>
              <boxGeometry args={[1.8, 0.16, 1.6]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.15, -0.1]} castShadow={shadows}>
              <boxGeometry args={[1.2, 2.1, 1.0]} />
              <meshStandardMaterial color="#1e3a8a" roughness={0.45} metalness={0.3} />
            </mesh>
            <mesh position={[0, 2.35, 0.05]} castShadow={shadows}>
              <boxGeometry args={[1.55, 0.35, 1.45]} />
              <meshStandardMaterial color="#0284c7" roughness={0.45} />
            </mesh>
            <mesh position={[0, 1.38, 0.42]}>
              <boxGeometry args={[0.7, 0.5, 0.05]} />
              <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.4} />
            </mesh>
            <mesh position={[0, 0.92, 0.46]} rotation={[-0.35, 0, 0]}>
              <boxGeometry args={[0.68, 0.2, 0.25]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
            </mesh>
          </RigidBody>
          <Text
            position={[0, 3.05, 0]}
            fontSize={0.4}
            color="#38bdf8"
            anchorX="center"
            outlineWidth={0.04}
            outlineColor="#0f172a"
          >
            ATM 24 JAM
          </Text>
        </group>
      ))}

      {/* 3. KANTOR DESA CICALENGKA — IZIN USAHA */}
      <group position={[kantorDesaLot.x, 0, kantorDesaLot.z]} rotation={[0, kantorDesaLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="kantor_desa" />
          <BuildingKantorDesa
            title="KANTOR DESA CICALENGKA"
            subtitle="IZIN USAHA & LAYANAN WARGA"
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* 4. PASAR GROSIR CICALENGKA */}
      <group position={[pasarGrosirLot.x, 0, pasarGrosirLot.z]} rotation={[0, pasarGrosirLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="pasar_grosir" />
          <BuildingPasar
            title="PASAR GROSIR"
            subtitle="STOK BISNIS"
            quality={quality}
            isNight={isNight}
            variant="grosir"
          />
        </RigidBody>
      </group>

      {/* 5. BALAI LELANG & MARKETPLACE CICALENGKA */}
      <group position={[balaiLelangLot.x, 0, balaiLelangLot.z]} rotation={[0, balaiLelangLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="balai_lelang" />
          <BuildingRuko
            title="BALAI LELANG"
            subtitle="MARKETPLACE"
            quality={quality}
            isNight={isNight}
            wallColor="#F5EBD8"
            awningToken="tarp_yellow"
            signVariant="colonial"
            width={8.0}
            depth={6.4}
          />
        </RigidBody>
      </group>

      {/* 6. PAPAN NAMA 3D DINAMIS UNTUK SETIAP BISNIS PEMAIN AKTIF */}
      {activeBusinesses.map((biz) => {
        const bx = Number(biz.position?.x ?? 0);
        const bz = Number(biz.position?.z ?? 0);
        const isPromoActive = Number(biz.promoBoostUntilMs || 0) > serverNowMs;
        const typeColor = BUSINESS_TYPE_COLORS[biz.type] || '#0284c7';
        const statusColor = biz.isOpen ? '#10b981' : '#e11d48';
        const statusText = biz.isOpen ? (isPromoActive ? 'BUKA · PROMO' : 'BUKA') : 'TUTUP';
        const typeTag = BUSINESS_TYPE_SHORT[biz.type] || 'USAHA';

        return (
          <group key={biz.id} position={[bx - 2.6, 0, bz + 3.6]}>
            <mesh position={[0, 1.25, 0]}>
              <cylinderGeometry args={[0.07, 0.08, 2.5, 6]} />
              <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.45} />
            </mesh>
            <mesh position={[0, 2.35, 0]} castShadow={shadows}>
              <boxGeometry args={[3.2, 1.05, 0.14]} />
              <meshStandardMaterial color={typeColor} roughness={0.55} />
            </mesh>
            <mesh position={[0, 1.65, 0]}>
              <boxGeometry args={[1.65, 0.36, 0.16]} />
              <meshStandardMaterial
                color={statusColor}
                emissive={statusColor}
                emissiveIntensity={biz.isOpen ? 0.85 : 0.45}
                roughness={0.35}
              />
            </mesh>
            <Text
              position={[0, 2.48, -0.09]}
              rotation={[0, Math.PI, 0]}
              fontSize={0.21}
              maxWidth={2.9}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              {`${typeTag}: ${biz.name.slice(0, 22)}`}
            </Text>
            <Text
              position={[0, 2.48, 0.09]}
              fontSize={0.21}
              maxWidth={2.9}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              {`${typeTag}: ${biz.name.slice(0, 22)}`}
            </Text>
            <Text
              position={[0, 1.65, -0.1]}
              rotation={[0, Math.PI, 0]}
              fontSize={0.18}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              {statusText}
            </Text>
            <Text
              position={[0, 1.65, 0.1]}
              fontSize={0.18}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              {statusText}
            </Text>
          </group>
        );
      })}
    </group>
  );
};
