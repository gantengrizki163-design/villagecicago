import React from 'react';
import type { FurniturePlacement } from '../types/game';
import { PropFurnitureItem } from './assets/PropFurnitureSet';
import { FURNITURE_CATALOG } from './worldConstants';

export const INTERIOR_TILE_SIZE = 1.1;

export function getRotatedSize(
  furnitureId: string,
  rot: 0 | 90 | 180 | 270
): { w: number; d: number } {
  const item = FURNITURE_CATALOG.find((f) => f.id === furnitureId);
  const bw = item?.size.w ?? 1;
  const bd = item?.size.d ?? 1;
  if (rot === 90 || rot === 270) {
    return { w: bd, d: bw };
  }
  return { w: bw, d: bd };
}

export function gridToInteriorWorld(
  gx: number,
  gz: number,
  w: number,
  d: number,
  cols: number,
  rows: number
): [number, number, number] {
  const halfW = (cols * INTERIOR_TILE_SIZE) / 2;
  const halfD = (rows * INTERIOR_TILE_SIZE) / 2;
  const wx = -halfW + (gx + w / 2) * INTERIOR_TILE_SIZE;
  const wz = -halfD + (gz + d / 2) * INTERIOR_TILE_SIZE;
  return [wx, 0, wz];
}

interface FurnitureMeshProps {
  placement: FurniturePlacement;
  cols: number;
  rows: number;
  selected?: boolean;
  ghostValid?: boolean | null;
  onSelect?: (instanceId: string) => void;
}

export const FurnitureModel3D: React.FC<FurnitureMeshProps> = ({
  placement,
  cols,
  rows,
  selected = false,
  ghostValid = null,
  onSelect,
}) => {
  const { w, d } = getRotatedSize(placement.furnitureId, placement.rot);
  const [wx, wy, wz] = gridToInteriorWorld(placement.gx, placement.gz, w, d, cols, rows);
  const rotRad = (placement.rot * Math.PI) / 180;

  const isGhost = ghostValid !== null;
  const emissive = isGhost
    ? ghostValid
      ? '#10b981'
      : '#ef4444'
    : selected
      ? '#38bdf8'
      : '#000000';
  const emissiveIntensity = isGhost ? 0.45 : selected ? 0.35 : 0;

  return (
    <group
      position={[wx, wy, wz]}
      rotation={[0, -rotRad, 0]}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect(placement.instanceId);
        }
      }}
    >
      <PropFurnitureItem
        furnitureId={placement.furnitureId}
        castShadow
        emissiveColor={emissive}
        emissiveIntensity={emissiveIntensity}
      />
      {(selected || isGhost) && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w * INTERIOR_TILE_SIZE - 0.08, d * INTERIOR_TILE_SIZE - 0.08]} />
          <meshBasicMaterial
            color={isGhost ? (ghostValid ? '#10b981' : '#ef4444') : '#38bdf8'}
            transparent
            opacity={0.35}
          />
        </mesh>
      )}
    </group>
  );
};
