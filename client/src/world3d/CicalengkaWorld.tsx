import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { ClientLawAlert } from '../firebase/npcDeterminism';
import type {
  BusinessDoc,
  ConstructionDoc,
  GraphicsQuality,
  LandPlotDoc,
  PropertyDoc,
  PropertyListingDoc,
  SecurityInstallDoc,
  TrainScheduleConfig,
} from '../types/game';
import { LandPlotsAndConstruction3D } from './LandPlotsAndConstruction3D';
import { Phase4Buildings3D } from './Phase4Buildings3D';
import { Phase6Buildings3D } from './Phase6Buildings3D';
import { PropertyBuildings3D } from './PropertyBuildings3D';
import { VehicleWorldBuildings3D } from './VehicleWorldBuildings3D';
import { KONTRAKAN_POSITIONS } from './worldConstants';
import { getLayoutRoads, getLotPlacement, LAYOUT_DATA } from './layout/layoutHelpers';
import { UnifiedLotCollider } from './layout/UnifiedLotCollider';
import { BuildingClinic } from './assets/BuildingClinic';
import { BuildingKontrakan } from './assets/BuildingKontrakan';
import { BuildingMasjid } from './assets/BuildingMasjid';
import { BuildingMinimarket } from './assets/BuildingMinimarket';
import { BuildingPabrik } from './assets/BuildingPabrik';
import { BuildingPasar } from './assets/BuildingPasar';
import { BuildingRuko } from './assets/BuildingRuko';
import { BuildingSekolah } from './assets/BuildingSekolah';
import { BuildingStation } from './assets/BuildingStation';
import { BuildingWarung } from './assets/BuildingWarung';
import { PasarMalam3D } from './assets/PasarMalam3D';
import { PropEnvironment } from './assets/PropEnvironment';
import { PropJpoBridge } from './assets/PropJpoBridge';
import { PropRailTrack } from './assets/PropRailTrack';
import { VehicleAmbulance } from './assets/VehicleAmbulance';
import { VehicleAngkot } from './assets/VehicleAngkot';
import { VehicleBecak } from './assets/VehicleBecak';
import { VehicleOjol } from './assets/VehicleOjol';
import { VehicleTruck } from './assets/VehicleTruck';
import { getPaletteMaterial } from './assets/paletteMaterials';

interface CicalengkaWorldProps {
  quality: GraphicsQuality;
  isNight: boolean;
  hour?: number;
  properties?: PropertyDoc[];
  listings?: PropertyListingDoc[];
  businesses?: BusinessDoc[];
  landPlots?: LandPlotDoc[];
  constructions?: ConstructionDoc[];
  securityInstalls?: SecurityInstallDoc[];
  lawAlerts?: ClientLawAlert[];
  serverNowMs?: number;
  serverOffsetMs?: number;
  trainSchedule?: TrainScheduleConfig;
  epochMs?: number;
  currentHomeId?: string | null;
  currentUid?: string | null;
}

export const CicalengkaWorld: React.FC<CicalengkaWorldProps> = ({
  quality,
  isNight,
  hour = 12,
  properties,
  listings,
  businesses,
  landPlots,
  constructions,
  securityInstalls,
  lawAlerts,
  serverNowMs,
  serverOffsetMs = 0,
  trainSchedule,
  epochMs = 0,
  currentHomeId,
  currentUid,
}) => {
  const shadows = quality !== 'low';

  const grassMat = getPaletteMaterial('grass_main');
  const hillMat = getPaletteMaterial('grass_hill', { flatShading: true });
  const earthSkirtMat = getPaletteMaterial('earth_clay');
  const roadMat = getPaletteMaterial('road_asphalt');
  const sidewalkMat = getPaletteMaterial('paving_stone');
  const markingMat = getPaletteMaterial('road_marking');
  const wallCreamMat = getPaletteMaterial('wall_cream');
  const colonialGreenMat = getPaletteMaterial('trim_colonial_green');
  const terracottaMat = getPaletteMaterial('roof_terracotta');

  const roadGeometries = useMemo(() => getLayoutRoads(), []);

  const worldHalf = LAYOUT_DATA.rules.worldHalfSize;
  const dioramaSize = worldHalf * 2 + 60;
  const perimeterHills = useMemo(
    () => [
      { pos: [-(worldHalf + 15), 7, -(worldHalf + 2)] as [number, number, number], r: 28, h: 16 },
      { pos: [-worldHalf * 0.56, 8, -(worldHalf + 24)] as [number, number, number], r: 32, h: 19 },
      { pos: [worldHalf * 0.25, 12, -(worldHalf + 44)] as [number, number, number], r: 44, h: 28 },
      { pos: [worldHalf * 0.81, 9, -(worldHalf + 22)] as [number, number, number], r: 34, h: 20 },
      { pos: [worldHalf + 18, 8, -(worldHalf - 4)] as [number, number, number], r: 30, h: 18 },
      { pos: [-(worldHalf + 28), 6, worldHalf * 0.48] as [number, number, number], r: 32, h: 15 },
      { pos: [worldHalf + 28, 7, worldHalf * 0.6] as [number, number, number], r: 34, h: 18 },
      { pos: [0, 8, worldHalf + 32] as [number, number, number], r: 42, h: 20 },
    ],
    [worldHalf]
  );

  // Semua lot dan infrastruktur dibaca dari satu sumber layout JSON
  const plaza = LAYOUT_DATA.plaza;
  const rail = LAYOUT_DATA.rails[0];
  const railSpanLength = Math.abs(rail.points[1][0] - rail.points[0][0]);
  const railCenterX = (rail.points[0][0] + rail.points[1][0]) / 2;
  const railZ = (rail.points[0][1] + rail.points[1][1]) / 2;

  const jpoLot = getLotPlacement(rail.jpoId);
  const stasiunLot = getLotPlacement('stasiun');
  const loketLot = getLotPlacement('loket_tiket');
  const warungLot = getLotPlacement('warung');
  const minimarketLot = getLotPlacement('minimarket');
  const pasarLot = getLotPlacement('pasar');
  const kurirLot = getLotPlacement('pos_kurir');
  const puskesmasLot = getLotPlacement('puskesmas');
  const klinikLot = getLotPlacement('klinik_swasta');
  const sekolahLot = getLotPlacement('sekolah');
  const bathLot = getLotPlacement('bath_mck');
  const masjidLot = getLotPlacement('masjid_reserved');
  const pabrikLot = getLotPlacement('pabrik_reserved');

  const kontrakanLots = useMemo(
    () =>
      KONTRAKAN_POSITIONS.map((k, idx) => ({
        ...k,
        idx,
        placement: getLotPlacement(k.id),
      })),
    []
  );

  // Hitung marka garis putus-putus & zebra cross dari konfigurasi jalan
  const roadMarkings = useMemo(() => {
    const dashes: Array<{ key: string; x: number; z: number; rotY: number }> = [];
    const crosswalks: Array<{ key: string; x: number; z: number }> = [];
    for (const r of LAYOUT_DATA.roads) {
      if (r.points.length < 2) continue;
      const [x1, z1] = r.points[0];
      const [x2, z2] = r.points[1];
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const zCenter = (z1 + z2) / 2;
      if (r.hasMarkings) {
        for (let x = minX + 8; x <= maxX - 8; x += 14) {
          dashes.push({ key: `${r.id}-dash-${x}`, x, z: zCenter, rotY: 0 });
        }
      }
      for (const zx of r.crosswalksAt || []) {
        crosswalks.push({ key: `${r.id}-cw-${zx}`, x: zx, z: zCenter });
      }
    }
    return { dashes, crosswalks };
  }, []);

  return (
    <group>
      {/* Tanah Utama Diorama & Penampang Tanah Cokelat */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[worldHalf + 15, 1, worldHalf + 15]} position={[0, -1, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={grassMat} receiveShadow>
          <planeGeometry args={[dioramaSize, dioramaSize]} />
        </mesh>
      </RigidBody>
      <mesh position={[0, -4.05, 0]} material={earthSkirtMat}>
        <boxGeometry args={[dioramaSize, 8, dioramaSize]} />
      </mesh>

      {/* Perbukitan Hijau & Siluet Gunung Kareumbi di Perimeter Luar */}
      {perimeterHills.map((hill, idx) => (
        <mesh key={idx} position={hill.pos} material={hillMat}>
          <coneGeometry args={[hill.r, hill.h, 7]} />
        </mesh>
      ))}

      {/* Jaringan Trotoar & Jalan Lurus Ortogonal dari cicalengka.layout.json */}
      {roadGeometries.map((rg, idx) => {
        const roadY =
          rg.hierarchy === 'arteri' ? 0.036 : rg.hierarchy === 'kolektor' ? 0.032 : 0.028;
        return (
          <group key={`${rg.roadId}-${idx}`}>
            {rg.sidewalks.map((sw, sIdx) => (
              <mesh
                key={`${rg.roadId}-sw-${sIdx}`}
                position={[sw.cx, 0.018, sw.cz]}
                rotation={[-Math.PI / 2, 0, 0]}
                material={sidewalkMat}
                receiveShadow
              >
                <planeGeometry args={[sw.width, sw.depth]} />
              </mesh>
            ))}
            <mesh
              position={[rg.asphalt.cx, roadY, rg.asphalt.cz]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={roadMat}
              receiveShadow
            >
              <planeGeometry args={[rg.asphalt.width, rg.asphalt.depth]} />
            </mesh>
          </group>
        );
      })}

      {/* Marka Jalan Putus-Putus & Zebra Cross */}
      {roadMarkings.dashes.map((d) => (
        <mesh key={d.key} position={[d.x, 0.048, d.z]} rotation={[-Math.PI / 2, 0, d.rotY]} material={markingMat}>
          <planeGeometry args={[6, 0.32]} />
        </mesh>
      ))}
      {roadMarkings.crosswalks.map((cw) => (
        <group key={cw.key} position={[cw.x, 0.05, cw.z]}>
          {[-1.5, -0.5, 0.5, 1.5].map((stripeZ, si) => (
            <mesh key={si} position={[0, 0, stripeZ]} rotation={[-Math.PI / 2, 0, 0]} material={markingMat}>
              <planeGeometry args={[2.6, 0.48]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ALUN-ALUN CICALENGKA */}
      <group position={[plaza.center.x, 0, plaza.center.z]}>
        <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]} material={sidewalkMat} receiveShadow>
          <planeGeometry args={[plaza.width, plaza.depth]} />
        </mesh>
        <mesh position={[0, 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]} material={grassMat} receiveShadow>
          <planeGeometry args={[plaza.grassWidth, plaza.grassDepth]} />
        </mesh>
        <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} material={sidewalkMat} receiveShadow>
          <ringGeometry args={[3.4, 5.2, 20]} />
        </mesh>
        <Text position={[0, 10.2, 0]} fontSize={0.8} color="#F4F2EC" anchorX="center" outlineWidth={0.05} outlineColor="#161E38">
          {plaza.label}
        </Text>
      </group>

      {/* Elemen Lingkungan Batch 1: Beringin Alun-Alun, Pendopo, PKL, Sawah, Empang, BTS & Menara Air */}
      <PropEnvironment quality={quality} isNight={isNight} />

      {/* Suasana Pasar Malam & Lampu Hangat Alun-Alun (Batch 6) */}
      <PasarMalam3D isNight={isNight} hour={hour} quality={quality} />

      {/* REL KERETA GANDA & PERLINTASAN SEBIDANG */}
      <group position={[railCenterX, 0, railZ]}>
        <PropRailTrack
          length={railSpanLength}
          doubleTrack
          crossingX={rail.crossingX - railCenterX}
          quality={quality}
          isNight={isNight}
          serverOffsetMs={serverOffsetMs}
          trainSchedule={trainSchedule}
          epochMs={epochMs}
        />
      </group>

      {/* JEMBATAN PENYEBERANGAN ORANG (JPO) */}
      <group position={[jpoLot.x, 0, jpoLot.z]} rotation={[0, jpoLot.rotY, 0]}>
        <PropJpoBridge quality={quality} isNight={isNight} spanLength={jpoLot.footprint.depth} />
      </group>

      {/* STASIUN KOLONIAL CICALENGKA */}
      <group position={[stasiunLot.x, 0, stasiunLot.z]} rotation={[0, stasiunLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[14, 0.3, 3.8]} position={[0, 0.3, 1.4]} />
          <CuboidCollider args={[10, 2.2, 2.5]} position={[0, 2.8, 2.7]} />
          <BuildingStation
            title="STASIUN CICALENGKA"
            subtitle="+689m · DAOP 2"
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* LOKET TIKET STASIUN */}
      <group position={[loketLot.x, 0, loketLot.z]} rotation={[0, loketLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="loket_tiket" />
          <mesh position={[0, 1.35, 0]} material={wallCreamMat} castShadow={shadows}>
            <boxGeometry args={[3.2, 2.5, 2.4]} />
          </mesh>
          <mesh position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]} material={terracottaMat} castShadow={shadows}>
            <coneGeometry args={[2.5, 1.0, 4]} />
          </mesh>
          <mesh position={[0, 1.45, 1.22]} material={colonialGreenMat}>
            <boxGeometry args={[1.4, 1.1, 0.1]} />
          </mesh>
        </RigidBody>
        <Text position={[0, 3.8, 0]} fontSize={0.48} color="#FFBE55" anchorX="center" outlineWidth={0.04} outlineColor="#161E38">
          LOKET KERETA
        </Text>
      </group>

      {/* WARUNG MAKAN ("Warung Teh Neng") */}
      <group position={[warungLot.x, 0, warungLot.z]} rotation={[0, warungLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="warung" />
          <BuildingWarung
            title="WARUNG TEH NENG"
            subtitle="MAKANAN & MINUMAN"
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* MINIMARKET CICALENGKA MART */}
      <group position={[minimarketLot.x, 0, minimarketLot.z]} rotation={[0, minimarketLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="minimarket" />
          <BuildingMinimarket
            title="CICALENGKA MART"
            subtitle="KERJA KASIR · 24 JAM"
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* PASAR CICALENGKA */}
      <group position={[pasarLot.x, 0, pasarLot.z]} rotation={[0, pasarLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="pasar" />
          <BuildingPasar
            title="PASAR CICALENGKA"
            subtitle="SEGAR & TRADISIONAL"
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* POS KURIR CICALENGKA */}
      <group position={[kurirLot.x, 0, kurirLot.z]} rotation={[0, kurirLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="pos_kurir" />
          <BuildingRuko
            title="POS KURIR CICALENGKA"
            subtitle="ANTAR PAKET"
            quality={quality}
            isNight={isNight}
            wallColor="#F5EBD8"
            awningToken="tarp_yellow"
            width={5.8}
            depth={4.8}
            scale={0.92}
          />
        </RigidBody>
      </group>

      {/* PUSKESMAS CICALENGKA */}
      <group position={[puskesmasLot.x, 0, puskesmasLot.z]} rotation={[0, puskesmasLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="puskesmas" />
          <BuildingClinic
            title="PUSKESMAS CICALENGKA"
            subtitle="LAYANAN MEDIS & BPJS"
            variant="puskesmas"
            width={11.8}
            depth={7.8}
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* KLINIK MEDIKA SWASTA */}
      <group position={[klinikLot.x, 0, klinikLot.z]} rotation={[0, klinikLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="klinik_swasta" />
          <BuildingClinic
            title="KLINIK MEDIKA SWASTA"
            subtitle="DOKTER & APOTEK 24 JAM"
            variant="medika"
            width={10.0}
            depth={7.0}
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* BALAI KURSUS & SEKOLAH CICALENGKA (rotDeg 180 di layout -> putar PI agar fasad +Z menghadap Selatan) */}
      <group position={[sekolahLot.x, 0, sekolahLot.z]} rotation={[0, sekolahLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="sekolah" />
          <group rotation={[0, Math.PI, 0]}>
            <BuildingSekolah
              title="BALAI KURSUS & SEKOLAH"
              subtitle="KURSUS & SD CICALENGKA"
              compact
              quality={quality}
              isNight={isNight}
            />
          </group>
        </RigidBody>
      </group>

      {/* MASJID AGUNG CICALENGKA (Sisi Timur Alun-Alun) */}
      <group position={[masjidLot.x, 0, masjidLot.z]} rotation={[0, masjidLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="masjid_reserved" />
          <BuildingMasjid
            title="MASJID AGUNG CICALENGKA"
            subtitle="IBADAH & KETENANGAN"
            compact
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* KAWASAN PABRIK & GUDANG UTARA */}
      <group position={[pabrikLot.x, 0, pabrikLot.z]} rotation={[0, pabrikLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="pabrik_reserved" />
          <BuildingPabrik
            title="KAWASAN INDUSTRI UTARA"
            subtitle="GUDANG & PABRIK TEKSTIL"
            compact
            quality={quality}
            isNight={isNight}
          />
        </RigidBody>
      </group>

      {/* KAMAR MANDI UMUM / MCK ALUN-ALUN */}
      <group position={[bathLot.x, 0, bathLot.z]} rotation={[0, bathLot.rotY, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <UnifiedLotCollider lotId="bath_mck" />
          <mesh position={[0, 1.5, 0]} castShadow={shadows} receiveShadow>
            <boxGeometry args={[5.2, 3.0, 4.2]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.75} />
          </mesh>
          <mesh position={[0, 3.3, 0]} castShadow={shadows}>
            <boxGeometry args={[5.8, 0.6, 4.8]} />
            <meshStandardMaterial color="#06b6d4" roughness={0.6} />
          </mesh>
        </RigidBody>
        <Text position={[0, 4.3, 0]} fontSize={0.55} color="#67e8f9" anchorX="center" outlineWidth={0.04} outlineColor="#0f172a">
          MCK / KAMAR MANDI UMUM
        </Text>
      </group>

      {/* 5 KONTRAKAN CICALENGKA */}
      {kontrakanLots.map(({ id, label, idx, placement }) => (
        <group key={id} position={[placement.x, 0, placement.z]} rotation={[0, placement.rotY, 0]}>
          <RigidBody type="fixed" colliders={false}>
            <UnifiedLotCollider lotId={id} />
            <BuildingKontrakan
              quality={quality}
              isNight={isNight}
              wallColor={idx % 3 === 0 ? '#7ECBA1' : idx % 3 === 1 ? '#F0958D' : '#F2CB6E'}
            />
          </RigidBody>
          <Text position={[0, 4.9, 1.0]} fontSize={0.52} color="#F5EBD8" anchorX="center" outlineWidth={0.04} outlineColor="#161E38">
            {label}
          </Text>
        </group>
      ))}

      {/* Properti Fase 3, Papan Listing, Toko Mebel, Penampungan Sosial & Emperan */}
      <PropertyBuildings3D
        properties={properties}
        listings={listings}
        currentHomeId={currentHomeId}
        currentUid={currentUid}
        quality={quality}
        isNight={isNight}
      />

      {/* Bangunan & Landmark Fase 4: Bank, ATM, Kantor Desa, Pasar Grosir, Balai Lelang & Papan Bisnis */}
      <Phase4Buildings3D
        quality={quality}
        isNight={isNight}
        businesses={businesses}
        serverNowMs={serverNowMs}
      />

      {/* Bangunan & Landmark Fase 6: Polsek & Ruang Tahanan, Kantor Agen Properti, 4 CCTV Publik, Keamanan Properti */}
      <Phase6Buildings3D
        quality={quality}
        isNight={isNight}
        properties={properties}
        securityInstalls={securityInstalls}
        lawAlerts={lawAlerts}
      />

      {/* Kavling Tanah & Visualisasi Konstruksi 4 Fase Fase 6 */}
      <LandPlotsAndConstruction3D
        landPlots={landPlots}
        constructions={constructions}
        currentUid={currentUid}
        quality={quality}
        isNight={isNight}
        serverNowMs={serverNowMs}
      />

      {/* Bangunan Sistem Kendaraan & Infrastruktur Jalan (Dealer, Showroom, SPBU, Bengkel, Lampu Lalin, Parkir, Halte) */}
      <VehicleWorldBuildings3D
        quality={quality}
        isNight={isNight}
        serverOffsetMs={serverOffsetMs}
      />

      {/* Kendaraan Khas Indonesia (Batch 5) di Area Parkir & Pangkalan Aman */}
      {/* Angkot & Becak di Pelataran Stasiun Cicalengka */}
      <RigidBody type="fixed" colliders={false} position={[14.5, 0, -48.5]} rotation={[0, 0.32, 0]}>
        <CuboidCollider args={[0.9, 1.0, 1.95]} position={[0, 1.0, 0]} />
        <VehicleAngkot quality={quality} isNight={isNight} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[19.2, 0, -48.2]} rotation={[0, -0.25, 0]}>
        <CuboidCollider args={[0.58, 0.82, 1.05]} position={[0, 0.82, 0]} />
        <VehicleBecak quality={quality} />
      </RigidBody>

      {/* Armada Sepeda Motor Kurir / Ojol di Samping Pos Kurir */}
      <RigidBody type="fixed" colliders={false} position={[4.6, 0, -30.5]} rotation={[0, Math.PI, 0]}>
        <CuboidCollider args={[0.45, 0.65, 0.95]} position={[0, 0.65, 0]} />
        <VehicleOjol quality={quality} isNight={isNight} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[6.0, 0, -30.5]} rotation={[0, Math.PI - 0.18, 0]}>
        <CuboidCollider args={[0.45, 0.65, 0.95]} position={[0, 0.65, 0]} />
        <VehicleOjol quality={quality} isNight={isNight} />
      </RigidBody>

      {/* Ambulans Siaga di Samping Puskesmas Cicalengka */}
      <RigidBody type="fixed" colliders={false} position={[-39.2, 0, -22]} rotation={[0, 0, 0]}>
        <CuboidCollider args={[0.95, 1.1, 2.15]} position={[0, 1.1, 0]} />
        <VehicleAmbulance quality={quality} isNight={isNight} />
      </RigidBody>

      {/* Truk Bak Pengangkut Sembako di Area Bongkar Muat Pasar Grosir */}
      <RigidBody type="fixed" colliders={false} position={[53.2, 0, -22.2]} rotation={[0, 0, 0]}>
        <CuboidCollider args={[1.05, 1.3, 2.4]} position={[0, 1.3, 0]} />
        <VehicleTruck variant="pickup" quality={quality} isNight={isNight} />
      </RigidBody>
    </group>
  );
};
