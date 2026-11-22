import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { ConstructionDoc, ConstructionPhase, GraphicsQuality, LandPlotDoc } from '../types/game';
import { INITIAL_LAND_PLOTS_DATA, PHASE6_CONSTRUCTION_CONFIG } from './worldConstants';
import { findLotPlacement, getFootprintColliderProps } from './layout/layoutHelpers';
import { BuildingConstruction } from './assets/BuildingConstruction';

interface LandPlotsAndConstruction3DProps {
  landPlots?: LandPlotDoc[];
  constructions?: ConstructionDoc[];
  currentUid?: string | null;
  quality: GraphicsQuality;
  isNight: boolean;
  serverNowMs?: number;
}

const PHASE_LABELS: Record<ConstructionPhase, string> = {
  pondasi: '1/4 · Pondasi',
  dinding: '2/4 · Pasang Dinding',
  atap: '3/4 · Rangka & Atap',
  finishing: '4/4 · Finishing',
  selesai: 'Selesai · Siap Klaim',
};

function formatCompactRp(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000;
    return `Rp ${Number.isInteger(jt) ? jt : jt.toFixed(1)} jt`;
  }
  return `Rp ${Math.round(amount / 1000)} rb`;
}

function resolveVisualPhase(con: ConstructionDoc, nowMs: number): ConstructionPhase {
  if (con.status === 'completed_unclaimed' || con.phase === 'selesai') return 'selesai';
  const order = PHASE6_CONSTRUCTION_CONFIG.phasesOrder;
  const elapsedMs = Math.max(0, nowMs - con.startedAtMs);
  const perPhaseMs = Math.max(10_000, con.phaseDurationMs || 35_000);
  const computedIndex = Math.floor(elapsedMs / perPhaseMs);
  if (computedIndex >= order.length) return 'selesai';
  const effectiveIdx = Math.max(con.phaseIndex || 0, computedIndex);
  return order[Math.min(order.length - 1, effectiveIdx)] || con.phase;
}

export const LandPlotsAndConstruction3D: React.FC<LandPlotsAndConstruction3DProps> = ({
  landPlots,
  constructions,
  currentUid,
  quality,
  isNight,
  serverNowMs,
}) => {
  const nowMs = serverNowMs ?? Date.now();

  const resolvedPlots = useMemo<LandPlotDoc[]>(() => {
    if (landPlots && landPlots.length > 0) return landPlots;
    return INITIAL_LAND_PLOTS_DATA;
  }, [landPlots]);

  const constructionByPlotId = useMemo(() => {
    const map = new Map<string, ConstructionDoc>();
    for (const c of constructions || []) {
      if (
        c.status === 'active' ||
        c.status === 'in_progress' ||
        c.status === 'completed_unclaimed'
      ) {
        map.set(c.plotId, c);
      }
    }
    return map;
  }, [constructions]);

  return (
    <group>
      {resolvedPlots.map((plot) => {
        const w = plot.size?.width ?? 7;
        const d = plot.size?.depth ?? 7;
        const activeCon = constructionByPlotId.get(plot.id);
        const isMine = Boolean(currentUid && plot.ownerId === currentUid);
        const lotPlacement = findLotPlacement(plot.id);
        const rotY = lotPlacement?.rotY ?? 0;
        const posX = lotPlacement?.x ?? plot.position.x;
        const posZ = lotPlacement?.z ?? plot.position.z;
        const builtId = plot.builtPropertyId || plot.propertyId;
        const imb = plot.permitStatus || plot.imbStatus || 'none';
        const hasOwner = Boolean(plot.ownerId && plot.ownerId !== 'npc_pemdes_cicalengka');

        if ((plot.status === 'built' || Boolean(builtId)) && builtId) {
          return (
            <group key={plot.id} position={[posX, 0, posZ]} rotation={[0, rotY, 0]}>
              <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[w + 1.4, d + 1.4]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.95} />
              </mesh>
            </group>
          );
        }

        const stakeOffsets: Array<[number, number]> = [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [-w / 2, d / 2],
          [w / 2, d / 2],
        ];

        let boardColor = '#d97706';
        let boardText = `DIJUAL KAVLING\n${formatCompactRp(plot.price)}`;
        if (isMine) {
          if (imb === 'approved') {
            boardColor = '#059669';
            boardText = 'MILIKMU\nIMB TERBIT';
          } else if (imb === 'pending') {
            boardColor = '#0284c7';
            boardText = 'MILIKMU\nIMB DIPROSES';
          } else {
            boardColor = '#0284c7';
            boardText = 'KAVLING MILIKMU\nPERLU IMB';
          }
        } else if (hasOwner && plot.status !== 'available') {
          boardColor = '#475569';
          boardText = `MILIK\n${plot.ownerName.slice(0, 14)}`;
        }

        const phase = activeCon ? resolveVisualPhase(activeCon, nowMs) : null;
        const bpConfig = activeCon ? PHASE6_CONSTRUCTION_CONFIG.blueprints[activeCon.blueprintId] : null;
        const cw = bpConfig?.size.width ?? Math.max(5.5, w - 1);
        const cd = bpConfig?.size.depth ?? Math.max(5.5, d - 1);

        return (
          <group key={plot.id} position={[posX, 0, posZ]} rotation={[0, rotY, 0]}>
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[w + 0.8, d + 0.8]} />
              <meshStandardMaterial
                color={activeCon ? '#a8a29e' : '#a16207'}
                roughness={0.96}
              />
            </mesh>

            {stakeOffsets.map(([sx, sz], idx) => (
              <mesh key={idx} position={[sx, 0.55, sz]}>
                <cylinderGeometry args={[0.08, 0.09, 1.1, 6]} />
                <meshStandardMaterial color={isMine ? '#10b981' : '#f59e0b'} roughness={0.6} />
              </mesh>
            ))}

            {/* Papan Nama Kavling menghadap jalan (+Z lokal) */}
            {!activeCon && (
              <>
                <group position={[w / 2 - 0.6, 0, d / 2 + 0.45]}>
                  <mesh position={[0, 0.7, 0]}>
                    <cylinderGeometry args={[0.06, 0.07, 1.4, 6]} />
                    <meshStandardMaterial color="#475569" roughness={0.6} />
                  </mesh>
                  <mesh position={[0, 1.55, 0]}>
                    <boxGeometry args={[2.1, 0.96, 0.1]} />
                    <meshStandardMaterial color={boardColor} roughness={0.5} />
                  </mesh>
                  <Text
                    position={[0, 1.55, -0.07]}
                    rotation={[0, Math.PI, 0]}
                    fontSize={0.22}
                    lineHeight={1.2}
                    color="#f8fafc"
                    anchorX="center"
                    anchorY="middle"
                    textAlign="center"
                  >
                    {boardText}
                  </Text>
                  <Text
                    position={[0, 1.55, 0.07]}
                    fontSize={0.22}
                    lineHeight={1.2}
                    color="#f8fafc"
                    anchorX="center"
                    anchorY="middle"
                    textAlign="center"
                  >
                    {boardText}
                  </Text>
                </group>

                <Text
                  position={[0, 2.6, 0]}
                  fontSize={0.44}
                  color={isMine ? '#6ee7b7' : '#fde68a'}
                  anchorX="center"
                  outlineWidth={0.04}
                  outlineColor="#0f172a"
                >
                  {plot.name}
                </Text>
              </>
            )}

            {/* VISUALISASI KONSTRUKSI 4 FASE REAL-TIME */}
            {activeCon && phase && (
              <group>
                <RigidBody type="fixed" colliders={false}>
                  <CuboidCollider
                    {...getFootprintColliderProps(cw, phase === 'pondasi' ? 0.9 : 3.4, cd)}
                  />
                  <BuildingConstruction
                    phase={phase}
                    width={cw}
                    depth={cd}
                    wallColor={bpConfig?.layout.wallColor || '#F5EBD8'}
                    quality={quality}
                    isNight={isNight}
                  />
                </RigidBody>

                <Text
                  position={[0, 5.2, 0]}
                  fontSize={0.44}
                  color={phase === 'selesai' ? '#6ee7b7' : '#fde047'}
                  anchorX="center"
                  outlineWidth={0.04}
                  outlineColor="#0f172a"
                >
                  {`${activeCon.blueprintName}\n[${PHASE_LABELS[phase]}]`}
                </Text>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
};
