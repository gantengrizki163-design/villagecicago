import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { GraphicsQuality, PropertyDoc, PropertyListingDoc } from '../types/game';
import {
  EMPERAN_SPOTS,
  INITIAL_LISTINGS_DATA,
  INITIAL_PROPERTIES_DATA,
} from './worldConstants';
import {
  findLotPlacement,
  getFootprintColliderProps,
  getLotPlacement,
} from './layout/layoutHelpers';
import { UnifiedLotCollider } from './layout/UnifiedLotCollider';
import { BuildingKontrakan } from './assets/BuildingKontrakan';
import { BuildingKos } from './assets/BuildingKos';
import { BuildingRuko } from './assets/BuildingRuko';
import { BuildingRumahKampung } from './assets/BuildingRumahKampung';
import { BuildingRumahModern } from './assets/BuildingRumahModern';
import { getPaletteMaterial } from './assets/paletteMaterials';

interface PropertyBuildings3DProps {
  properties?: PropertyDoc[];
  listings?: PropertyListingDoc[];
  currentHomeId?: string | null;
  currentUid?: string | null;
  quality: GraphicsQuality;
  isNight: boolean;
}

function formatRupiahCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000;
    return `Rp ${Number.isInteger(jt) ? jt : jt.toFixed(1)} jt`;
  }
  return `Rp ${Math.round(amount / 1000)} rb`;
}

export const PropertyBuildings3D: React.FC<PropertyBuildings3DProps> = ({
  properties,
  listings,
  currentHomeId,
  currentUid,
  quality,
  isNight,
}) => {
  const shadows = quality !== 'low';
  const tokoMebelLot = getLotPlacement('toko_mebel');
  const penampunganLot = getLotPlacement('penampungan');

  const resolvedProperties = useMemo<PropertyDoc[]>(() => {
    if (properties && properties.length > 0) return properties;
    return INITIAL_PROPERTIES_DATA;
  }, [properties]);

  const listingByPropId = useMemo(() => {
    const map = new Map<string, PropertyListingDoc>();
    const src = listings && listings.length > 0 ? listings : INITIAL_LISTINGS_DATA;
    for (const lst of src) {
      if (lst.status === 'active') {
        map.set(lst.propertyId, lst);
      }
    }
    return map;
  }, [listings]);

  return (
    <group>
      {/* TOKO MEBEL CICALENGKA */}
      <group position={[tokoMebelLot.x, 0, tokoMebelLot.z]} rotation={[0, tokoMebelLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="toko_mebel" />
          <BuildingRuko
            title="TOKO MEBEL CICALENGKA"
            subtitle="FURNITUR & DEKOR"
            quality={quality}
            isNight={isNight}
            wallColor="#F5EBD8"
            awningToken="tarp_red"
            width={tokoMebelLot.footprint.width}
            depth={tokoMebelLot.footprint.depth}
          />
        </RigidBody>
      </group>

      {/* PENAMPUNGAN SOSIAL CICALENGKA (menghadap jalan sesuai rotY) */}
      <group position={[penampunganLot.x, 0, penampunganLot.z]} rotation={[0, penampunganLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="penampungan" />
          <BuildingRumahKampung
            quality={quality}
            isNight={isNight}
            wallColor="#F5EBD8"
            withYardProps={false}
          />
        </RigidBody>
        {isNight && quality !== 'low' && (
          <pointLight position={[0, 3.0, 4.5]} color="#FFBE55" intensity={2.0} distance={14} decay={1.4} />
        )}
        <Text
          position={[0, 5.2, 0]}
          fontSize={0.54}
          color="#F5EBD8"
          anchorX="center"
          outlineWidth={0.05}
          outlineColor="#161E38"
        >
          PENAMPUNGAN SOSIAL (19:00-07:00)
        </Text>
      </group>

      {/* TITIK EMPERAN (2 Lokasi Tidur Darurat Tanpa Rumah) */}
      {EMPERAN_SPOTS.map((spot) => {
        const spotLot = getLotPlacement(spot.id);
        return (
          <group key={spot.id} position={[spotLot.x, 0, spotLot.z]} rotation={[0, spotLot.rotY, 0]}>
            <RigidBody type="fixed" colliders={false}>
              <UnifiedLotCollider lotId={spot.id} />
              <mesh position={[0, 0.08, 0]} material={getPaletteMaterial('paving_stone')} receiveShadow>
                <boxGeometry args={[4.4, 0.16, 2.8]} />
              </mesh>
              <mesh position={[-0.7, 0.2, 0.1]} material={getPaletteMaterial('bamboo_light')} receiveShadow>
                <boxGeometry args={[1.9, 0.08, 1.0]} />
              </mesh>
              <mesh position={[1.1, 0.36, 0]} material={getPaletteMaterial('wood_warm')} castShadow={shadows}>
                <boxGeometry args={[1.3, 0.4, 0.65]} />
              </mesh>
              <mesh position={[-1.9, 1.35, -1.1]} material={getPaletteMaterial('wood_dark')}>
                <cylinderGeometry args={[0.07, 0.07, 2.5, 6]} />
              </mesh>
              <mesh position={[1.9, 1.35, -1.1]} material={getPaletteMaterial('wood_dark')}>
                <cylinderGeometry args={[0.07, 0.07, 2.5, 6]} />
              </mesh>
              <mesh position={[0, 2.5, -0.2]} rotation={[0.18, 0, 0]} material={getPaletteMaterial('roof_metal_grey')} castShadow={shadows}>
                <boxGeometry args={[4.3, 0.12, 2.4]} />
              </mesh>
            </RigidBody>
            <Text
              position={[0, 3.25, 0]}
              fontSize={0.4}
              color="#F4F2EC"
              anchorX="center"
              outlineWidth={0.04}
              outlineColor="#161E38"
            >
              {spot.label.toUpperCase()}
            </Text>
          </group>
        );
      })}

      {/* 18+ PROPERTI HUNIAN CICALENGKA (Semua model berorientasi depan lokal +Z, diputar rotY layout) */}
      {resolvedProperties.map((prop, idx) => {
        const lotPlacement =
          findLotPlacement(prop.id) ??
          (prop.builtFromPlotId ? findLotPlacement(prop.builtFromPlotId) : null);
        const rotY = lotPlacement?.rotY ?? 0;
        const posX = lotPlacement?.x ?? prop.position.x;
        const posZ = lotPlacement?.z ?? prop.position.z;

        const w = prop.size?.width ?? 6;
        const d = prop.size?.depth ?? 6;
        const wallColor = prop.layout?.wallColor || '#F5EBD8';
        const isStall = prop.type === 'lapak_pasar';
        const isTwoStory = prop.type === 'apartemen' || prop.type === 'ruko';
        const wallH = isStall ? 2.6 : isTwoStory ? 5.6 : 3.2;

        const activeListing = listingByPropId.get(prop.id);
        const isMyHome = Boolean(currentHomeId && currentHomeId === prop.id);
        const isMyOwned = Boolean(currentUid && prop.ownerId === currentUid);
        const appliedRenovations = prop.renovationsApplied || [];
        const hasUpperRenovation =
          !isTwoStory && !isStall && appliedRenovations.includes('add_floor');
        const hasFence = !isStall && appliedRenovations.includes('fence');
        const hasGarden = !isStall && appliedRenovations.includes('garden');
        const hasGarage = !isStall && appliedRenovations.includes('garage');
        const hasActiveKpr = prop.mortgageInfo?.status === 'active';
        const effectiveWallH = hasUpperRenovation ? wallH + 2.2 : wallH;

        let signBg = '#334155';
        let signLabel = 'DIHUNI';
        let signTextColor = '#e2e8f0';

        if (isMyHome) {
          signBg = '#059669';
          signLabel = hasActiveKpr ? 'RUMAHMU (KPR)' : 'RUMAHMU';
          signTextColor = '#ecfdf5';
        } else if (isMyOwned && !activeListing) {
          signBg = '#0284c7';
          signLabel = hasActiveKpr ? 'MILIKMU (KPR)' : 'MILIKMU';
          signTextColor = '#e0f2fe';
        } else if (activeListing) {
          if (activeListing.kind === 'rent') {
            signBg = '#0d9488';
            signLabel = `DISEWA\n${formatRupiahCompact(activeListing.price)}`;
            signTextColor = '#f0fdfa';
          } else {
            signBg = '#d97706';
            signLabel = `DIJUAL\n${formatRupiahCompact(activeListing.price)}`;
            signTextColor = '#fffbeb';
          }
        }

        const signX = w / 2 + 0.9;
        const signZ = d / 2 + 0.55;

        return (
          <group key={prop.id} position={[posX, 0, posZ]} rotation={[0, rotY, 0]}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider {...getFootprintColliderProps(w, effectiveWallH, d)} />

              {isStall ? (
                <>
                  {/* Lapak Pasar Terbuka menghadap +Z */}
                  <mesh position={[0, 0.1, 0]} material={getPaletteMaterial('paving_stone')} receiveShadow>
                    <boxGeometry args={[w + 0.6, 0.2, d + 0.6]} />
                  </mesh>
                  <mesh position={[0, 0.56, d * 0.14]} material={getPaletteMaterial('wood_warm')} castShadow={shadows} receiveShadow>
                    <boxGeometry args={[w * 0.88, 0.68, d * 0.44]} />
                  </mesh>
                  {[
                    [-w * 0.44, -d * 0.44],
                    [w * 0.44, -d * 0.44],
                    [-w * 0.44, d * 0.44],
                    [w * 0.44, d * 0.44],
                  ].map(([px, pz], pIdx) => (
                    <mesh key={pIdx} position={[px, 1.35, pz]} material={getPaletteMaterial('wood_warm')}>
                      <boxGeometry args={[0.14, 2.5, 0.14]} />
                    </mesh>
                  ))}
                  <mesh
                    position={[0, 2.65, 0]}
                    rotation={[0.08, 0, 0]}
                    material={getPaletteMaterial(idx % 3 === 0 ? 'tarp_blue' : idx % 3 === 1 ? 'tarp_red' : 'tarp_yellow')}
                    castShadow={shadows}
                  >
                    <boxGeometry args={[w + 0.55, 0.16, d + 0.65]} />
                  </mesh>
                  <mesh position={[0, 2.48, d * 0.52]} material={getPaletteMaterial('wall_cream')}>
                    <boxGeometry args={[w + 0.5, 0.24, 0.08]} />
                  </mesh>
                </>
              ) : prop.type === 'kos' ? (
                <BuildingKos
                  quality={quality}
                  isNight={isNight}
                  wallColor={prop.layout?.wallColor || (idx % 3 === 0 ? '#7ECBA1' : idx % 3 === 1 ? '#F0958D' : '#F2CB6E')}
                  hasAc={Boolean(prop.facilities?.ac)}
                />
              ) : prop.type === 'kontrakan' ? (
                <BuildingKontrakan
                  quality={quality}
                  isNight={isNight}
                  wallColor={prop.layout?.wallColor || (idx % 2 === 0 ? '#F2CB6E' : '#7ECBA1')}
                  hasAc={Boolean(prop.facilities?.ac)}
                  hasSecondFloor={hasUpperRenovation}
                />
              ) : prop.type === 'ruko' ? (
                <BuildingRuko
                  quality={quality}
                  isNight={isNight}
                  wallColor={prop.layout?.wallColor || '#F5EBD8'}
                  awningToken={idx % 2 === 0 ? 'tarp_red' : 'tarp_blue'}
                  hasAc={Boolean(prop.facilities?.ac)}
                  width={w}
                  depth={d}
                />
              ) : prop.type === 'rumah' && !prop.facilities?.ac && !hasUpperRenovation ? (
                <BuildingRumahKampung
                  quality={quality}
                  isNight={isNight}
                  wallColor={prop.layout?.wallColor || '#F5EBD8'}
                  hasSecondFloor={hasUpperRenovation}
                  withYardProps={false}
                />
              ) : (
                <BuildingRumahModern
                  quality={quality}
                  isNight={isNight}
                  wallColor={wallColor}
                  width={w}
                  depth={d}
                  hasAc={Boolean(prop.facilities?.ac)}
                  hasCarport={prop.type === 'rumah' || hasGarage}
                  hasFence={hasFence}
                  variant={prop.type === 'apartemen' ? 'apartemen' : 'rumah'}
                />
              )}
            </RigidBody>

            {/* 6b. VISUAL RENOVASI BESAR FASE 6 (Pagar buka di depan +Z, Taman di depan +Z) */}
            {hasFence && (
              <group>
                <mesh position={[-w / 2 - 0.55, 0.52, 0]}>
                  <boxGeometry args={[0.1, 0.9, d + 1.0]} />
                  <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.4} />
                </mesh>
                <mesh position={[w / 2 + 0.55, 0.52, 0]}>
                  <boxGeometry args={[0.1, 0.9, d + 1.0]} />
                  <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.52, -d / 2 - 0.55]}>
                  <boxGeometry args={[w + 1.1, 0.9, 0.1]} />
                  <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.4} />
                </mesh>
              </group>
            )}
            {hasGarden && (
              <group position={[-w * 0.3, 0, d / 2 + 0.95]}>
                <mesh position={[0, 0.15, 0]}>
                  <boxGeometry args={[w * 0.45, 0.24, 0.65]} />
                  <meshStandardMaterial color="#15803d" roughness={0.9} />
                </mesh>
                <mesh position={[-0.4, 0.42, 0]}>
                  <sphereGeometry args={[0.26, 7, 7]} />
                  <meshStandardMaterial color="#22c55e" roughness={0.85} />
                </mesh>
                <mesh position={[0.4, 0.38, 0]}>
                  <sphereGeometry args={[0.22, 7, 7]} />
                  <meshStandardMaterial color="#f43f5e" roughness={0.8} />
                </mesh>
              </group>
            )}
            {hasGarage && (
              <group position={[-w / 2 - 1.35, 0, 0]}>
                <mesh position={[0, 0.08, 0]} receiveShadow>
                  <boxGeometry args={[2.3, 0.14, d * 0.72]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.9} />
                </mesh>
                <mesh position={[0, 2.35, 0]} castShadow={shadows}>
                  <boxGeometry args={[2.4, 0.14, d * 0.76]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.55} />
                </mesh>
              </group>
            )}

            {/* 7. Papan Listing / Status Hunian di Depan Properti (+Z) */}
            <group position={[signX, 0, signZ]}>
              <mesh position={[0, 0.7, 0]}>
                <cylinderGeometry args={[0.06, 0.07, 1.4, 6]} />
                <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
              </mesh>
              <mesh position={[0, 1.55, 0]}>
                <boxGeometry args={[1.85, 0.92, 0.1]} />
                <meshStandardMaterial color={signBg} roughness={0.5} />
              </mesh>
              <Text
                position={[0, 1.55, -0.07]}
                rotation={[0, Math.PI, 0]}
                fontSize={0.23}
                lineHeight={1.2}
                color={signTextColor}
                anchorX="center"
                anchorY="middle"
                textAlign="center"
              >
                {signLabel}
              </Text>
              <Text
                position={[0, 1.55, 0.07]}
                fontSize={0.23}
                lineHeight={1.2}
                color={signTextColor}
                anchorX="center"
                anchorY="middle"
                textAlign="center"
              >
                {signLabel}
              </Text>
            </group>

            {/* Label Nama Properti di Atas Atap */}
            <Text
              position={[0, effectiveWallH + 1.95, 0]}
              fontSize={0.48}
              color={isMyHome ? '#6ee7b7' : activeListing ? '#fde68a' : '#e2e8f0'}
              anchorX="center"
              outlineWidth={0.04}
              outlineColor="#0f172a"
            >
              {prop.name}
            </Text>
          </group>
        );
      })}
    </group>
  );
};
