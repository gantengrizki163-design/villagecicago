import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { AvatarMesh } from '../components/AvatarMesh';
import { FloatingTag } from '../components/FloatingTag';
import type { PlayerInputState } from '../components/MobileControls';
import type { ClientDeterministicNpcPose } from '../firebase/npcDeterminism';
import type {
  BusinessDoc,
  CharacterDoc,
  ConstructionDoc,
  LandPlotDoc,
  PlayerAnimState,
  PropertyDoc,
  ZoneId,
} from '../types/game';
import type { CameraOrbitState } from './ThirdPersonCamera';
import type { ActiveNavigationState } from './interactions/useLocationGate';
import { NAVIGATION_TUNING } from './interactions/navigationConfig';
import { isWithinDestination } from './interactions/registry';
import { ensureSafeSpawnPosition, findLotPlacement } from './layout/layoutHelpers';
import {
  AGENT_OFFICE_POS,
  ATM_LOCATIONS,
  BALAI_LELANG_POS,
  BANK_POS,
  BATH_POS,
  COURIER_POS,
  distance2D,
  EMPERAN_SPOTS,
  FACTORY_RANCAEKEK_POS,
  INITIAL_LAND_PLOTS_DATA,
  INITIAL_PROPERTIES_DATA,
  INTERACT_RADIUS_METERS,
  KANTOR_DESA_POS,
  KLINIK_SWASTA_POS,
  KONTRAKAN_POSITIONS,
  MINIMARKET_POS,
  NPC_INTERACT_RADIUS_METERS,
  PASAR_GROSIR_POS,
  PASAR_POS,
  PENAMPUNGAN_POS,
  POLSEK_POS,
  PUSKESMAS_POS,
  SCHOOL_BANDUNG_POS,
  SCHOOL_POS,
  STATION_SPAWN,
  TICKET_BOOTH_POS,
  TOKO_MEBEL_POS,
  WARUNG_POS,
} from './worldConstants';

function distToLot(px: number, pz: number, lotId: string, fallback: { x: number; z: number }): number {
  const pl = findLotPlacement(lotId);
  if (!pl) return distance2D(px, pz, fallback.x, fallback.z);
  return Math.min(distance2D(px, pz, pl.door.x, pl.door.z), distance2D(px, pz, pl.x, pl.z));
}

export type NearbyInteractTarget =
  | { type: 'warung'; label: string }
  | { type: 'kontrakan'; label: string }
  | { type: 'bath'; label: string }
  | { type: 'clinic'; clinicId: string; label: string }
  | { type: 'school'; label: string }
  | { type: 'station'; label: string }
  | { type: 'job_site'; jobId: string; label: string }
  | { type: 'property'; propertyId: string; label: string }
  | { type: 'toko_mebel'; label: string }
  | { type: 'penampungan'; label: string }
  | { type: 'emperan'; spotId: string; label: string }
  | { type: 'interior_exit'; label: string }
  | { type: 'interior_sleep'; label: string }
  | { type: 'interior_bath'; label: string }
  | { type: 'interior_eat'; label: string }
  | { type: 'bank'; label: string }
  | { type: 'atm'; atmId: string; label: string }
  | { type: 'kantor_desa'; label: string }
  | { type: 'pasar_grosir'; label: string }
  | { type: 'balai_lelang'; label: string }
  | { type: 'business'; businessId: string; propertyId: string; label: string }
  | { type: 'biz_cashier'; businessId: string; label: string }
  | { type: 'biz_craft'; businessId: string; label: string }
  | { type: 'biz_manage'; businessId: string; label: string }
  | { type: 'polsek'; label: string }
  | { type: 'agent_office'; label: string }
  | { type: 'land_plot'; plotId: string; label: string }
  | { type: 'construction'; constructionId: string; plotId: string; label: string }
  | { type: 'npc'; npcId: string; name: string; role: string; label: string }
  | { type: 'vehicle_board'; vehicleId: string; label: string; asPassenger?: boolean }
  | { type: 'dealer'; dealerId: string; label: string }
  | { type: 'spbu'; label: string }
  | { type: 'workshop'; businessId?: string; label: string }
  | { type: 'samsat_sim'; label: string }
  | null;

interface LocalPlayerProps {
  character: CharacterDoc;
  currentZone: ZoneId;
  properties?: PropertyDoc[];
  businesses?: BusinessDoc[];
  landPlots?: LandPlotDoc[];
  constructions?: ConstructionDoc[];
  nearbyNpc?: ClientDeterministicNpcPose | null;
  movementLocked: boolean;
  isCriticalStats: boolean;
  localChatBubble: string | null;
  inputRef: React.MutableRefObject<PlayerInputState>;
  cameraOrbitRef: React.MutableRefObject<CameraOrbitState>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearbyTargetChange: (target: NearbyInteractTarget) => void;
  onSyncTransform: (x: number, y: number, z: number, rotY: number, anim: PlayerAnimState) => void;
  activeNav?: ActiveNavigationState | null;
  onAutoWalkCancel?: (reason?: string) => void;
  preferLivePos?: boolean;
  castShadow?: boolean;
}

const BASE_SPEED = NAVIGATION_TUNING.WALK_SPEED_MPS;

export const LocalPlayer: React.FC<LocalPlayerProps> = ({
  character,
  currentZone,
  properties,
  businesses,
  landPlots,
  constructions,
  nearbyNpc,
  movementLocked,
  isCriticalStats,
  localChatBubble,
  inputRef,
  cameraOrbitRef,
  playerPosRef,
  onNearbyTargetChange,
  onSyncTransform,
  activeNav = null,
  onAutoWalkCancel,
  preferLivePos = false,
  castShadow = true,
}) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const [anim, setAnim] = useState<PlayerAnimState>('idle');
  const animStateRef = useRef<PlayerAnimState>('idle');
  const [spawnResolution] = useState(() => {
    const rawPos = preferLivePos
      ? { x: playerPosRef.current.x, y: playerPosRef.current.y, z: playerPosRef.current.z, rotY: 0 }
      : (character.lastPosition ?? STATION_SPAWN);
    if (currentZone !== 'cicalengka') {
      return {
        coords: [rawPos.x, Math.max(0.5, rawPos.y ?? 1), rawPos.z] as [number, number, number],
        rotY: rawPos.rotY ?? 0,
        relocated: false,
      };
    }
    const res = ensureSafeSpawnPosition(rawPos, {
      isJailed: Boolean(character.sentence?.active),
    });
    return {
      coords: [res.position.x, Math.max(0.5, res.position.y), res.position.z] as [number, number, number],
      rotY: res.position.rotY ?? rawPos.rotY ?? 0,
      relocated: res.relocated,
    };
  });
  const initialSpawn = spawnResolution.coords;
  const rotYRef = useRef(spawnResolution.rotY);
  const lastNearbyKey = useRef<string>('');
  const syncTimerRef = useRef(0);
  const hasInitializedPosRef = useRef(false);
  const lastSentPos = useRef({ x: 9999, y: 9999, z: 9999, rotY: 9999, anim: 'idle' as PlayerAnimState });
  const autoWaypointIdxRef = useRef(1);
  const autoWalkSigRef = useRef<string>('');
  const stuckTimerRef = useRef(0);
  const stuckAnchorRef = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    const sig = activeNav?.autoWalk
      ? `${activeNav.menuId}:${activeNav.destination.id}:${activeNav.waypoints.length}`
      : '';
    if (sig !== autoWalkSigRef.current) {
      autoWalkSigRef.current = sig;
      autoWaypointIdxRef.current = 1;
      stuckTimerRef.current = 0;
      stuckAnchorRef.current = null;
    }
  }, [activeNav]);

  useEffect(() => {
    if (spawnResolution.relocated) {
      playerPosRef.current.set(initialSpawn[0], initialSpawn[1], initialSpawn[2]);
      onSyncTransform(initialSpawn[0], initialSpawn[1], initialSpawn[2], spawnResolution.rotY, 'idle');
    }
  }, [initialSpawn, onSyncTransform, playerPosRef, spawnResolution.relocated, spawnResolution.rotY]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keysRef.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    const rb = rbRef.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);

    const k = keysRef.current;
    let ix = movementLocked ? 0 : inputRef.current.moveX;
    let iz = movementLocked ? 0 : inputRef.current.moveY;

    if (!movementLocked) {
      if (k['KeyA'] || k['ArrowLeft']) ix -= 1;
      if (k['KeyD'] || k['ArrowRight']) ix += 1;
      if (k['KeyW'] || k['ArrowUp']) iz -= 1;
      if (k['KeyS'] || k['ArrowDown']) iz += 1;
    }

    const len = Math.hypot(ix, iz);
    const hasManualInput = len > 0.1;

    if (hasManualInput && activeNav?.autoWalk) {
      onAutoWalkCancel?.('Jalan otomatis dihentikan — kendali manual aktif.');
    }

    const speed = isCriticalStats ? BASE_SPEED * 0.55 : BASE_SPEED;
    const pos = rb.translation();

    let worldVx = 0;
    let worldVz = 0;
    let isMoving = false;

    if (hasManualInput) {
      const nix = ix / Math.max(1, len);
      const niz = iz / Math.max(1, len);
      const yaw = cameraOrbitRef.current.yaw;
      const sinY = Math.sin(yaw);
      const cosY = Math.cos(yaw);
      worldVx = (nix * cosY + niz * sinY) * speed;
      worldVz = (-nix * sinY + niz * cosY) * speed;
      isMoving = true;
      stuckTimerRef.current = 0;
      stuckAnchorRef.current = null;
    } else if (
      !movementLocked &&
      activeNav?.autoWalk &&
      activeNav.destination.zone === currentZone &&
      !isWithinDestination({ x: pos.x, z: pos.z }, activeNav.destination, -0.35)
    ) {
      const wps = activeNav.waypoints;
      let idx = Math.min(autoWaypointIdxRef.current, Math.max(0, wps.length - 1));
      while (idx < wps.length - 1) {
        const wp = wps[idx];
        if (Math.hypot(wp.x - pos.x, wp.z - pos.z) <= NAVIGATION_TUNING.WAYPOINT_REACH_RADIUS_METERS) {
          idx++;
        } else {
          break;
        }
      }
      autoWaypointIdxRef.current = idx;
      const targetPt = wps[idx] ?? activeNav.destination.arrivalPoint;
      const dx = targetPt.x - pos.x;
      const dz = targetPt.z - pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.25) {
        worldVx = (dx / dist) * speed;
        worldVz = (dz / dist) * speed;
        isMoving = true;

        // Deteksi jalan otomatis macet
        if (!stuckAnchorRef.current) {
          stuckAnchorRef.current = { x: pos.x, z: pos.z };
          stuckTimerRef.current = 0;
        } else {
          const progressed = Math.hypot(
            pos.x - stuckAnchorRef.current.x,
            pos.z - stuckAnchorRef.current.z
          );
          if (progressed >= NAVIGATION_TUNING.AUTO_WALK_MIN_PROGRESS_METERS) {
            stuckAnchorRef.current = { x: pos.x, z: pos.z };
            stuckTimerRef.current = 0;
          } else {
            stuckTimerRef.current += dt;
            if (stuckTimerRef.current >= NAVIGATION_TUNING.AUTO_WALK_STUCK_TIMEOUT_SEC) {
              stuckTimerRef.current = 0;
              stuckAnchorRef.current = null;
              worldVx = 0;
              worldVz = 0;
              isMoving = false;
              onAutoWalkCancel?.(
                'Jalan otomatis terhenti karena halangan. Lanjutkan jalan manual mengikuti panah arah.'
              );
            }
          }
        }
      }
    } else {
      stuckTimerRef.current = 0;
      stuckAnchorRef.current = null;
    }

    const currentVel = rb.linvel();
    const cleanVy = Math.abs(currentVel.y) < 0.08 ? 0 : currentVel.y;
    rb.setLinvel({ x: worldVx, y: cleanVy, z: worldVz }, true);

    // Penegakan kurungan sel tahanan Polsek jika karakter sedang menjalani hukuman aktif
    const isJailed = Boolean(character.sentence?.active);
    if (isJailed && currentZone === 'cicalengka') {
      const jc = POLSEK_POS.jailCenter;
      const dxJail = pos.x - jc.x;
      const dzJail = pos.z - jc.z;
      const distJail = Math.hypot(dxJail, dzJail);
      if (distJail > Math.min(3.1, POLSEK_POS.jailRadius - 1.5)) {
        rb.setTranslation({ x: jc.x, y: 1.0, z: jc.z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }

    if (!hasInitializedPosRef.current || Math.hypot(pos.x - playerPosRef.current.x, pos.z - playerPosRef.current.z) > 6) {
      playerPosRef.current.set(pos.x, pos.y, pos.z);
      hasInitializedPosRef.current = true;
    } else {
      const followDamp = 1 - Math.exp(-28 * dt);
      playerPosRef.current.x = THREE.MathUtils.lerp(playerPosRef.current.x, pos.x, followDamp);
      playerPosRef.current.y = THREE.MathUtils.lerp(playerPosRef.current.y, pos.y, followDamp);
      playerPosRef.current.z = THREE.MathUtils.lerp(playerPosRef.current.z, pos.z, followDamp);
    }

    if (isMoving) {
      const targetRot = Math.atan2(worldVx, worldVz);
      let diff = targetRot - rotYRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rotYRef.current += diff * (1 - Math.exp(-12 * dt));
    }

    if (visualRef.current) {
      visualRef.current.rotation.y = rotYRef.current;
    }

    const nextAnim: PlayerAnimState = isMoving ? 'walk' : 'idle';
    if (nextAnim !== animStateRef.current) {
      animStateRef.current = nextAnim;
      setAnim(nextAnim);
    }

    // Cek objek terdekat sesuai zona aktif
    let nextTarget: NearbyInteractTarget = null;
    let nextKey = 'none';
    const currentJobId = character.currentJob?.jobId;
    const booth = TICKET_BOOTH_POS[currentZone];

    if (isJailed && currentZone === 'cicalengka') {
      nextTarget = { type: 'polsek', label: 'Status Tahanan · Kerja & Jaminan' };
      nextKey = 'polsek_jail_active';
    } else if (
      distance2D(pos.x, pos.z, booth.x, booth.z) <= INTERACT_RADIUS_METERS ||
      (currentZone === 'cicalengka' && distToLot(pos.x, pos.z, 'stasiun', STATION_SPAWN) <= INTERACT_RADIUS_METERS)
    ) {
      nextTarget = { type: 'station', label: 'Stasiun & Tiket Kereta' };
      nextKey = `station_${currentZone}`;
    } else if (currentZone === 'cicalengka') {
      const nearbyAtm = ATM_LOCATIONS.find((atm) => distance2D(pos.x, pos.z, atm.x, atm.z) <= 4.2);
      if (nearbyAtm) {
        nextTarget = { type: 'atm', atmId: nearbyAtm.id, label: nearbyAtm.label };
        nextKey = `atm_${nearbyAtm.id}`;
      } else if (nearbyNpc && nearbyNpc.distanceToPlayer <= NPC_INTERACT_RADIUS_METERS) {
        nextTarget = {
          type: 'npc',
          npcId: nearbyNpc.npcId,
          name: nearbyNpc.name,
          role: nearbyNpc.role,
          label: `Bicara: ${nearbyNpc.name}`,
        };
        nextKey = `npc_${nearbyNpc.npcId}`;
      } else if (distToLot(pos.x, pos.z, 'polsek', POLSEK_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'polsek', label: 'Polsek Cicalengka (Hukum & Polisi)' };
        nextKey = 'polsek';
      } else if (distToLot(pos.x, pos.z, 'kantor_agen', AGENT_OFFICE_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'agent_office', label: 'Kantor Agen Properti & KPR' };
        nextKey = 'agent_office';
      } else if (distToLot(pos.x, pos.z, 'bank', BANK_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'bank', label: 'Bank Priangan Cicalengka' };
        nextKey = 'bank_priangan';
      } else if (distance2D(pos.x, pos.z, -24.2, 8.6) <= 4.5) {
        nextTarget = { type: 'samsat_sim', label: 'Loket Samsat · Pajak STNK & Ujian SIM' };
        nextKey = 'samsat_sim';
      } else if (distToLot(pos.x, pos.z, 'dealer_motor_baru', { x: -32, z: -30 }) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'dealer', dealerId: 'dealer_motor_baru', label: 'Dealer Motor Siliwangi Baru' };
        nextKey = 'dealer_motor_baru';
      } else if (distToLot(pos.x, pos.z, 'lapak_motor_bekas', { x: -70, z: -30 }) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'dealer', dealerId: 'lapak_motor_bekas', label: 'Lapak Motor Bekas Kang Ujang' };
        nextKey = 'lapak_motor_bekas';
      } else if (distToLot(pos.x, pos.z, 'showroom_mobil_baru', { x: -30, z: 26 }) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'dealer', dealerId: 'showroom_mobil_baru', label: 'Showroom Mobil Priangan Baru' };
        nextKey = 'showroom_mobil_baru';
      } else if (distToLot(pos.x, pos.z, 'showroom_mobil_bekas', { x: -34, z: -50 }) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'dealer', dealerId: 'showroom_mobil_bekas', label: 'Showroom Mobil Bekas Jaya' };
        nextKey = 'showroom_mobil_bekas';
      } else if (distToLot(pos.x, pos.z, 'spbu_cicalengka', { x: -70, z: -14 }) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'spbu', label: 'SPBU & Stasiun Cas EV Cicalengka' };
        nextKey = 'spbu_cicalengka';
      } else if (distToLot(pos.x, pos.z, 'bengkel_umum', { x: -48, z: -30 }) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'workshop', label: 'Bengkel Resmi Priangan' };
        nextKey = 'bengkel_umum';
      } else if (distToLot(pos.x, pos.z, 'kantor_desa', KANTOR_DESA_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'kantor_desa', label: 'Kantor Desa · Izin Usaha & IMB' };
        nextKey = 'kantor_desa';
      } else if (distToLot(pos.x, pos.z, 'pasar_grosir', PASAR_GROSIR_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'pasar_grosir', label: 'Pasar Grosir (Stok & Material)' };
        nextKey = 'pasar_grosir';
      } else if (distToLot(pos.x, pos.z, 'balai_lelang', BALAI_LELANG_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'balai_lelang', label: 'Balai Lelang & Marketplace' };
        nextKey = 'balai_lelang';
      } else if (distToLot(pos.x, pos.z, 'warung', WARUNG_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'warung', label: 'Beli Makanan (Warung Teh Neng)' };
        nextKey = 'warung';
      } else if (distToLot(pos.x, pos.z, 'minimarket', MINIMARKET_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = {
          type: 'job_site',
          jobId: 'kasir_minimarket',
          label: currentJobId === 'kasir_minimarket' ? 'Mulai Shift Kasir' : 'Info Kerja Kasir Mart',
        };
        nextKey = `job_kasir_${currentJobId === 'kasir_minimarket'}`;
      } else if (distToLot(pos.x, pos.z, 'pasar', PASAR_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = {
          type: 'job_site',
          jobId: 'pedagang_pasar',
          label: currentJobId === 'pedagang_pasar' ? 'Mulai Shift Pedagang' : 'Info Kerja Pasar',
        };
        nextKey = `job_pasar_${currentJobId === 'pedagang_pasar'}`;
      } else if (distToLot(pos.x, pos.z, 'pos_kurir', COURIER_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = {
          type: 'job_site',
          jobId: 'kurir',
          label: currentJobId === 'kurir' ? 'Mulai Shift Kurir' : 'Info Kerja Kurir',
        };
        nextKey = `job_kurir_${currentJobId === 'kurir'}`;
      } else if (distance2D(pos.x, pos.z, 8, -40) <= 6.2) {
        nextTarget = {
          type: 'job_site',
          jobId: 'ojek_online',
          label: currentJobId === 'ojek_online' ? 'Mulai Shift CikOjek' : 'Pangkalan CikOjek',
        };
        nextKey = `job_ojek_${currentJobId === 'ojek_online'}`;
      } else if (distance2D(pos.x, pos.z, 4, -44.2) <= 5.5) {
        nextTarget = {
          type: 'job_site',
          jobId: 'sopir_angkot',
          label: currentJobId === 'sopir_angkot' ? 'Mulai Trayek Angkot' : 'Terminal Halte Angkot',
        };
        nextKey = `job_angkot_${currentJobId === 'sopir_angkot'}`;
      } else if (distToLot(pos.x, pos.z, 'puskesmas', PUSKESMAS_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'clinic', clinicId: 'puskesmas', label: 'Berobat di Puskesmas' };
        nextKey = 'clinic_puskesmas';
      } else if (distToLot(pos.x, pos.z, 'klinik_swasta', KLINIK_SWASTA_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'clinic', clinicId: 'klinik_swasta', label: 'Berobat Klinik Medika' };
        nextKey = 'clinic_swasta';
      } else if (distToLot(pos.x, pos.z, 'sekolah', SCHOOL_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'school', label: 'Balai Kursus & Skill' };
        nextKey = 'school';
      } else if (distToLot(pos.x, pos.z, 'bath_mck', BATH_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'bath', label: 'Mandi di MCK Umum' };
        nextKey = 'bath_umum';
      } else if (distToLot(pos.x, pos.z, 'toko_mebel', TOKO_MEBEL_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'toko_mebel', label: 'Toko Mebel Cicalengka' };
        nextKey = 'toko_mebel';
      } else if (distToLot(pos.x, pos.z, 'penampungan', PENAMPUNGAN_POS) <= INTERACT_RADIUS_METERS) {
        nextTarget = { type: 'penampungan', label: 'Penampungan Sosial' };
        nextKey = 'penampungan';
      } else {
        const emp = EMPERAN_SPOTS.find(
          (e) => distToLot(pos.x, pos.z, e.id, e) <= INTERACT_RADIUS_METERS
        );
        if (emp) {
          nextTarget = { type: 'emperan', spotId: emp.id, label: `Tidur di ${emp.label}` };
          nextKey = emp.id;
        } else {
          const propList = properties && properties.length > 0 ? properties : INITIAL_PROPERTIES_DATA;
          let nearestProp: PropertyDoc | null = null;
          let nearestDist = Infinity;
          for (const p of propList) {
            const dist = distance2D(pos.x, pos.z, p.position.x, p.position.z);
            const radius = Math.max(p.size?.width ?? 6, p.size?.depth ?? 6) / 2 + 4.8;
            if (dist <= radius && dist < nearestDist) {
              nearestDist = dist;
              nearestProp = p;
            }
          }
          if (nearestProp) {
            const activeBiz = businesses?.find(
              (b) => b.status === 'active' && b.propertyId === nearestProp.id
            );
            if (activeBiz) {
              const isBizOwner = activeBiz.ownerId === character.uid;
              nextTarget = {
                type: 'business',
                businessId: activeBiz.id,
                propertyId: nearestProp.id,
                label: isBizOwner
                  ? `Masuk & Kelola ${activeBiz.name}`
                  : `Kunjungi ${activeBiz.name} (${activeBiz.isOpen ? 'Buka' : 'Tutup'})`,
              };
              nextKey = `biz_${activeBiz.id}_${isBizOwner}_${activeBiz.isOpen}`;
            } else {
              const isOwnHome = character.currentHomeId === nearestProp.id;
              nextTarget = {
                type: 'property',
                propertyId: nearestProp.id,
                label: isOwnHome ? `Masuk Rumah (${nearestProp.name})` : nearestProp.name,
              };
              nextKey = `prop_${nearestProp.id}_${isOwnHome}`;
            }
          } else {
            // Cek kavling tanah atau proyek konstruksi aktif terdekat
            const plotList = landPlots && landPlots.length > 0 ? landPlots : INITIAL_LAND_PLOTS_DATA;
            let nearestPlot: LandPlotDoc | null = null;
            let nearestPlotDist = Infinity;
            for (const lp of plotList) {
              const builtId = lp.builtPropertyId || lp.propertyId;
              if ((lp.status === 'built' || Boolean(builtId)) && builtId) continue;
              const dist = distance2D(pos.x, pos.z, lp.position.x, lp.position.z);
              const radius = Math.max(lp.size?.width ?? 7, lp.size?.depth ?? 7) / 2 + 4.5;
              if (dist <= radius && dist < nearestPlotDist) {
                nearestPlotDist = dist;
                nearestPlot = lp;
              }
            }

            if (nearestPlot) {
              const activeCon = constructions?.find(
                (c) =>
                  c.plotId === nearestPlot!.id &&
                  (c.status === 'active' ||
                    c.status === 'in_progress' ||
                    c.status === 'completed_unclaimed')
              );
              if (activeCon) {
                const bpName =
                  activeCon.blueprintName ||
                  (activeCon.blueprintId === 'besar'
                    ? 'Rumah Tipe 72'
                    : activeCon.blueprintId === 'sedang'
                      ? 'Rumah Tipe 45'
                      : 'Rumah Tipe 27');
                nextTarget = {
                  type: 'construction',
                  constructionId: activeCon.id,
                  plotId: nearestPlot.id,
                  label: `Proyek: ${bpName} (${activeCon.phase})`,
                };
                nextKey = `con_${activeCon.id}_${activeCon.phase}`;
              } else {
                const imb = nearestPlot.permitStatus || nearestPlot.imbStatus || 'none';
                nextTarget = {
                  type: 'land_plot',
                  plotId: nearestPlot.id,
                  label:
                    nearestPlot.ownerId === character.uid
                      ? `Kelola Kavling (${nearestPlot.name})`
                      : `Info Kavling (${nearestPlot.name})`,
                };
                nextKey = `plot_${nearestPlot.id}_${nearestPlot.ownerId === character.uid}_${imb}`;
              }
            } else {
              const kontrakan = KONTRAKAN_POSITIONS.find(
                (kp) => distance2D(pos.x, pos.z, kp.x, kp.z) <= INTERACT_RADIUS_METERS
              );
              if (kontrakan) {
                nextTarget = { type: 'kontrakan', label: `Istirahat (${kontrakan.label})` };
                nextKey = kontrakan.id;
              }
            }
          }
        }
      }
    } else if (currentZone === 'rancaekek') {
      if (
        distance2D(pos.x, pos.z, FACTORY_RANCAEKEK_POS.x, FACTORY_RANCAEKEK_POS.z) <=
        INTERACT_RADIUS_METERS + 3
      ) {
        nextTarget = {
          type: 'job_site',
          jobId: 'buruh_pabrik',
          label: currentJobId === 'buruh_pabrik' ? 'Mulai Shift Buruh Pabrik' : 'Info Kerja Pabrik Tekstil',
        };
        nextKey = `job_pabrik_${currentJobId === 'buruh_pabrik'}`;
      }
    } else if (currentZone === 'bandung') {
      if (
        distance2D(pos.x, pos.z, SCHOOL_BANDUNG_POS.x, SCHOOL_BANDUNG_POS.z) <=
        INTERACT_RADIUS_METERS + 2
      ) {
        nextTarget = {
          type: 'job_site',
          jobId: 'guru_honorer',
          label: currentJobId === 'guru_honorer' ? 'Mulai Mengajar (Guru)' : 'Info Kerja Guru Honorer',
        };
        nextKey = `job_guru_${currentJobId === 'guru_honorer'}`;
      }
    }

    if (nextKey !== lastNearbyKey.current) {
      lastNearbyKey.current = nextKey;
      onNearbyTargetChange(nextTarget);
    }

    syncTimerRef.current += dt;
    if (syncTimerRef.current >= 0.16) {
      syncTimerRef.current = 0;
      const moved =
        Math.abs(pos.x - lastSentPos.current.x) > 0.04 ||
        Math.abs(pos.z - lastSentPos.current.z) > 0.04 ||
        Math.abs(pos.y - lastSentPos.current.y) > 0.05 ||
        Math.abs(rotYRef.current - lastSentPos.current.rotY) > 0.05 ||
        nextAnim !== lastSentPos.current.anim;

      if (moved) {
        lastSentPos.current = {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          rotY: rotYRef.current,
          anim: nextAnim,
        };
        onSyncTransform(pos.x, pos.y, pos.z, rotYRef.current, nextAnim);
      }
    }
  }, -1);

  return (
    <RigidBody
      ref={rbRef}
      position={initialSpawn}
      colliders={false}
      enabledRotations={[false, false, false]}
      mass={1}
      linearDamping={0.5}
    >
      <CapsuleCollider args={[0.45, 0.35]} position={[0, 0.85, 0]} />
      <group ref={visualRef}>
        <AvatarMesh
          uid={character.uid}
          gender={character.gender}
          skinColor={character.skinColor}
          hairColor={character.hairColor}
          shirtColor={character.shirtColor}
          pantsColor={character.pantsColor}
          anim={anim}
          castShadow={castShadow}
        />
      </group>
      <FloatingTag name={character.name} chatBubble={localChatBubble} isSelf />
    </RigidBody>
  );
};
