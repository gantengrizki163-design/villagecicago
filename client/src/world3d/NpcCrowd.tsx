import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CharacterNpcVariants } from './assets/CharacterNpcVariants';
import { FloatingTag } from '../components/FloatingTag';
import {
  computeClientNpcPose,
  DEFAULT_NPCS_CONFIG,
  formatNpcActivityLabel,
  getVisibleDeterministicNpcs,
  type ClientDeterministicNpcPose,
  type ClientLawAlert,
  type NpcDefinition,
} from '../firebase/npcDeterminism';
import type { GraphicsQuality, ZoneId } from '../types/game';

export interface NpcWorldPositionEntry {
  npcId: string;
  name: string;
  x: number;
  z: number;
}

interface DeterministicNpcActorProps {
  def: NpcDefinition;
  initialPose: ClientDeterministicNpcPose;
  serverOffsetMs: number;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  activeAlerts?: ClientLawAlert[];
  isNearestTalkable: boolean;
  castShadow: boolean;
  npcWorldPosMapRef?: React.MutableRefObject<Record<string, NpcWorldPositionEntry>>;
  knockedNpcUntilRef?: React.MutableRefObject<Record<string, number>>;
}

const DeterministicNpcActor: React.FC<DeterministicNpcActorProps> = ({
  def,
  initialPose,
  serverOffsetMs,
  playerPosRef,
  activeAlerts,
  isNearestTalkable,
  castShadow,
  npcWorldPosMapRef,
  knockedNpcUntilRef,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [anim, setAnim] = useState<'walk' | 'idle'>(initialPose.anim);
  const [isDizzy, setIsDizzy] = useState(false);
  const animRef = useRef<'walk' | 'idle'>(initialPose.anim);
  const isDizzyRef = useRef(false);
  const knockedFreezeRef = useRef<{ x: number; z: number; rotY: number } | null>(null);
  const lastAnimCheckRef = useRef(0);
  const lodRadius = DEFAULT_NPCS_CONFIG.lodActiveRadiusMeters ?? 45;
  const isPolice = def.role === 'polisi_patroli' || def.role === 'polisi_atasan';

  useFrame(({ clock }) => {
    const nowWall = Date.now();
    const knockedUntil = knockedNpcUntilRef?.current[def.id] ?? 0;
    const currentlyKnocked = knockedUntil > nowWall;

    if (currentlyKnocked !== isDizzyRef.current) {
      isDizzyRef.current = currentlyKnocked;
      setIsDizzy(currentlyKnocked);
      if (!currentlyKnocked) {
        knockedFreezeRef.current = null;
      }
    }

    if (currentlyKnocked) {
      if (!knockedFreezeRef.current && groupRef.current) {
        knockedFreezeRef.current = {
          x: groupRef.current.position.x,
          z: groupRef.current.position.z,
          rotY: groupRef.current.rotation.y,
        };
      }
      const freeze = knockedFreezeRef.current;
      if (groupRef.current && freeze) {
        groupRef.current.position.set(freeze.x, 0.24, freeze.z);
        groupRef.current.rotation.set(0, freeze.rotY, Math.PI * 0.36);
      }
      if (animRef.current !== 'idle') {
        animRef.current = 'idle';
        setAnim('idle');
      }
      return;
    }

    const serverNowMs = nowWall + serverOffsetMs;
    const pose = computeClientNpcPose(
      def,
      serverNowMs,
      { x: playerPosRef.current.x, z: playerPosRef.current.z },
      lodRadius,
      activeAlerts
    );

    if (groupRef.current) {
      groupRef.current.position.set(pose.x, 0, pose.z);
      groupRef.current.rotation.set(0, pose.rotY, 0);
    }

    if (npcWorldPosMapRef) {
      const entry = npcWorldPosMapRef.current[def.id];
      if (entry) {
        entry.x = pose.x;
        entry.z = pose.z;
      } else {
        npcWorldPosMapRef.current[def.id] = {
          npcId: def.id,
          name: def.name,
          x: pose.x,
          z: pose.z,
        };
      }
    }

    if (clock.elapsedTime - lastAnimCheckRef.current > 0.3) {
      lastAnimCheckRef.current = clock.elapsedTime;
      if (pose.anim !== animRef.current) {
        animRef.current = pose.anim;
        setAnim(pose.anim);
      }
    }
  });

  const bubble = isDizzy
    ? 'Aduh, kaget! Pusing sebentar...'
    : initialPose.respondingAlertId
      ? 'Patroli: Menuju TKP!'
      : isNearestTalkable
        ? formatNpcActivityLabel(initialPose.activity)
        : null;

  return (
    <group ref={groupRef} position={[initialPose.x, 0, initialPose.z]} rotation={[0, initialPose.rotY, 0]}>
      <CharacterNpcVariants
        npcId={def.id}
        role={def.role}
        gender={def.gender}
        skinColor={def.appearance.skinColor}
        hairColor={def.appearance.hairColor}
        shirtColor={def.appearance.shirtColor}
        pantsColor={def.appearance.pantsColor}
        anim={anim}
        castShadow={castShadow && initialPose.lodTier === 'near'}
        isPoliceAlert={isPolice && Boolean(initialPose.respondingAlertId)}
      />

      {/* Ring Penanda NPC Siap Diajak Bicara / Quest */}
      {isNearestTalkable && !isDizzy && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.72, 20]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0ea5e9"
            emissiveIntensity={1.0}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      <FloatingTag name={def.name} chatBubble={bubble} />
    </group>
  );
};

interface NpcCrowdProps {
  zone: ZoneId;
  serverOffsetMs: number;
  quality: GraphicsQuality;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  activeAlerts?: ClientLawAlert[];
  onNearestNpcChange?: (npc: ClientDeterministicNpcPose | null) => void;
  npcWorldPosMapRef?: React.MutableRefObject<Record<string, NpcWorldPositionEntry>>;
  knockedNpcUntilRef?: React.MutableRefObject<Record<string, number>>;
}

/**
 * NPC Fase 6 Deterministik & LOD-aware (tanpa menulis posisi NPC ke database).
 * Jadwal harian, waypoint patroli polisi, respons alert kejahatan, dan batas render per-kualitas.
 */
export const NpcCrowd: React.FC<NpcCrowdProps> = ({
  zone,
  serverOffsetMs,
  quality,
  playerPosRef,
  activeAlerts,
  onNearestNpcChange,
  npcWorldPosMapRef,
  knockedNpcUntilRef,
}) => {
  const shadows = quality === 'high';
  const defById = useMemo(() => {
    const map = new Map<string, NpcDefinition>();
    for (const def of DEFAULT_NPCS_CONFIG.npcs) {
      map.set(def.id, def);
    }
    return map;
  }, []);

  const [visiblePoses, setVisiblePoses] = useState<ClientDeterministicNpcPose[]>([]);
  const [nearestId, setNearestId] = useState<string | null>(null);
  const lastListSigRef = useRef('');
  const lastNearestKeyRef = useRef('');
  const lastScanTimeRef = useRef(-10);

  useFrame(({ clock }) => {
    if (zone !== 'cicalengka') {
      if (npcWorldPosMapRef && Object.keys(npcWorldPosMapRef.current).length > 0) {
        npcWorldPosMapRef.current = {};
      }
      return;
    }
    if (clock.elapsedTime - lastScanTimeRef.current < 0.35) return;
    lastScanTimeRef.current = clock.elapsedTime;

    const { visibleNpcs, nearestTalkableNpc } = getVisibleDeterministicNpcs({
      serverNowMs: Date.now() + serverOffsetMs,
      playerPos: { x: playerPosRef.current.x, z: playerPosRef.current.z },
      quality,
      zone,
      activeAlerts,
    });

    if (npcWorldPosMapRef) {
      const activeIds = new Set(visibleNpcs.map((n) => n.npcId));
      for (const k of Object.keys(npcWorldPosMapRef.current)) {
        if (!activeIds.has(k)) {
          delete npcWorldPosMapRef.current[k];
        }
      }
    }

    const sig = visibleNpcs
      .map((n) => `${n.npcId}:${n.lodTier}:${n.respondingAlertId || ''}:${n.activity}`)
      .join('|');
    if (sig !== lastListSigRef.current) {
      lastListSigRef.current = sig;
      setVisiblePoses(visibleNpcs);
    }

    const nextNearestKey = nearestTalkableNpc
      ? `${nearestTalkableNpc.npcId}:${nearestTalkableNpc.activity}`
      : 'none';
    if (nextNearestKey !== lastNearestKeyRef.current) {
      lastNearestKeyRef.current = nextNearestKey;
      setNearestId(nearestTalkableNpc?.npcId ?? null);
      onNearestNpcChange?.(nearestTalkableNpc);
    }
  });

  if (zone !== 'cicalengka') {
    const zoneNpc =
      zone === 'rancaekek'
        ? { name: 'Mandor Pabrik', role: 'mandor', pos: [14, 0, -9] as [number, number, number], shirt: '#496791' }
        : zone === 'bandung'
          ? { name: 'Kepala Sekolah', role: 'guru', pos: [-14, 0, -8] as [number, number, number], shirt: '#16a34a' }
          : { name: 'Penjaga Gazebo', role: 'penjaga', pos: [0, 0, -10] as [number, number, number], shirt: '#b87842' };

    return (
      <group position={zoneNpc.pos} rotation={[0, 0.2, 0]}>
        <CharacterNpcVariants
          role={zoneNpc.role}
          gender="laki-laki"
          skinColor="#D2996C"
          hairColor="#1e1b18"
          shirtColor={zoneNpc.shirt}
          pantsColor="#1e293b"
          anim="idle"
          castShadow={shadows}
        />
        <FloatingTag name={zoneNpc.name} />
      </group>
    );
  }

  return (
    <group>
      {visiblePoses.map((pose) => {
        const def = defById.get(pose.npcId);
        if (!def) return null;
        return (
          <DeterministicNpcActor
            key={pose.npcId}
            def={def}
            initialPose={pose}
            serverOffsetMs={serverOffsetMs}
            playerPosRef={playerPosRef}
            activeAlerts={activeAlerts}
            isNearestTalkable={nearestId === pose.npcId}
            castShadow={shadows}
            npcWorldPosMapRef={npcWorldPosMapRef}
            knockedNpcUntilRef={knockedNpcUntilRef}
          />
        );
      })}
    </group>
  );
};
