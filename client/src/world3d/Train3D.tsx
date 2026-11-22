import React, { useRef, useState } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getDeterministicTrainState } from '../firebase/phase2ConfigCache';
import type { GraphicsQuality, TrainScheduleConfig } from '../types/game';
import { VehicleTrain } from './assets/VehicleTrain';

interface Train3DProps {
  serverOffsetMs: number;
  schedule: TrainScheduleConfig;
  epochMs: number;
  zTrack: number;
  labelPosZ: number;
  quality: GraphicsQuality;
  isNight?: boolean;
}

/**
 * Kereta Komuter Cicalengka 3D deterministik berdasarkan jam/waktu server.
 * Tanpa write ke database: semua klien melihat kereta masuk/berhenti/berangkat serentak.
 */
export const Train3D: React.FC<Train3DProps> = ({
  serverOffsetMs,
  schedule,
  epochMs,
  zTrack,
  labelPosZ,
  quality,
  isNight = false,
}) => {
  const trainGroupRef = useRef<THREE.Group>(null);
  const [statusLabel, setStatusLabel] = useState('Kereta Dalam Perjalanan');
  const lastStatusRef = useRef('');

  useFrame(() => {
    const state = getDeterministicTrainState(Date.now() + serverOffsetMs, schedule, epochMs);
    if (trainGroupRef.current) {
      trainGroupRef.current.position.x = state.trainX;
      trainGroupRef.current.visible = state.phase !== 'away';
    }

    let nextText = `Kereta tiba ~${state.nextArrivalSec}s`;
    if (state.phase === 'approaching') {
      nextText = `KERETA MASUK (${state.nextArrivalSec}s)`;
    } else if (state.phase === 'boarding') {
      nextText = `NAIK SEKARANG! (${state.boardingRemainSec}s)`;
    } else if (state.phase === 'departing') {
      nextText = 'KERETA BERANGKAT';
    }

    if (nextText !== lastStatusRef.current) {
      lastStatusRef.current = nextText;
      setStatusLabel(nextText);
    }
  });

  return (
    <group>
      {/* Papan Jadwal Digital Deterministik di Peron */}
      <Text
        position={[0, 4.9, labelPosZ]}
        fontSize={0.48}
        color={statusLabel.includes('NAIK') ? '#4ade80' : '#FFBE55'}
        anchorX="center"
        outlineWidth={0.04}
        outlineColor="#161E38"
      >
        {statusLabel}
      </Text>

      {/* Rangkaian Kereta Komuter (AssetModelLoader GLB/Procedural) */}
      <group ref={trainGroupRef} position={[-78, 0.24, zTrack]}>
        <VehicleTrain quality={quality} isNight={isNight} />
      </group>
    </group>
  );
};
