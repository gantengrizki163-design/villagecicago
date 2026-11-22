import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { FurniturePlacement } from '../types/game';
import {
  FurnitureModel3D,
  getRotatedSize,
  gridToInteriorWorld,
  INTERIOR_TILE_SIZE,
} from './FurnitureModels3D';

export function canPlaceFurnitureAt(
  furnitureId: string,
  gx: number,
  gz: number,
  rot: 0 | 90 | 180 | 270,
  cols: number,
  rows: number,
  placed: FurniturePlacement[],
  excludeInstanceId?: string | null
): boolean {
  const { w, d } = getRotatedSize(furnitureId, rot);
  if (gx < 0 || gz < 0 || gx + w > cols || gz + d > rows) {
    return false;
  }

  for (const item of placed) {
    if (excludeInstanceId && item.instanceId === excludeInstanceId) continue;
    const other = getRotatedSize(item.furnitureId, item.rot);
    const overlapX = gx < item.gx + other.w && gx + w > item.gx;
    const overlapZ = gz < item.gz + other.d && gz + d > item.gz;
    if (overlapX && overlapZ) return false;
  }
  return true;
}

interface DecorationGrid3DProps {
  cols: number;
  rows: number;
  draftFurniture: FurniturePlacement[];
  selectedInstanceId: string | null;
  pendingFurnitureId: string | null;
  pendingRotation: 0 | 90 | 180 | 270;
  hoverCell: { gx: number; gz: number } | null;
  onHoverCell: (cell: { gx: number; gz: number } | null) => void;
  onSelectPlaced: (instanceId: string) => void;
  onTapGridCell: (gx: number, gz: number) => void;
}

export const DecorationGrid3D: React.FC<DecorationGrid3DProps> = ({
  cols,
  rows,
  draftFurniture,
  selectedInstanceId,
  pendingFurnitureId,
  pendingRotation,
  hoverCell,
  onHoverCell,
  onSelectPlaced,
  onTapGridCell,
}) => {
  const tiles = useMemo(() => {
    const arr: Array<{ gx: number; gz: number }> = [];
    for (let gz = 0; gz < rows; gz++) {
      for (let gx = 0; gx < cols; gx++) {
        arr.push({ gx, gz });
      }
    }
    return arr;
  }, [cols, rows]);

  const activeFurnitureId = useMemo(() => {
    if (pendingFurnitureId) return pendingFurnitureId;
    const sel = draftFurniture.find((f) => f.instanceId === selectedInstanceId);
    return sel?.furnitureId ?? null;
  }, [pendingFurnitureId, draftFurniture, selectedInstanceId]);

  const activeRot = useMemo<0 | 90 | 180 | 270>(() => {
    if (pendingFurnitureId) return pendingRotation;
    const sel = draftFurniture.find((f) => f.instanceId === selectedInstanceId);
    return sel?.rot ?? 0;
  }, [pendingFurnitureId, pendingRotation, draftFurniture, selectedInstanceId]);

  const ghostValid = useMemo(() => {
    if (!hoverCell || !activeFurnitureId) return null;
    return canPlaceFurnitureAt(
      activeFurnitureId,
      hoverCell.gx,
      hoverCell.gz,
      activeRot,
      cols,
      rows,
      draftFurniture,
      selectedInstanceId
    );
  }, [hoverCell, activeFurnitureId, activeRot, cols, rows, draftFurniture, selectedInstanceId]);

  return (
    <group>
      {/* Grid ubin interaktif untuk Tap HP maupun Klik Desktop */}
      {tiles.map(({ gx, gz }) => {
        const [wx, , wz] = gridToInteriorWorld(gx, gz, 1, 1, cols, rows);
        const isHovered = hoverCell?.gx === gx && hoverCell?.gz === gz;
        const checker = (gx + gz) % 2 === 0;
        return (
          <mesh
            key={`${gx}_${gz}`}
            position={[wx, 0.025, wz]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerMove={(e) => {
              e.stopPropagation();
              onHoverCell({ gx, gz });
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTapGridCell(gx, gz);
            }}
          >
            <planeGeometry args={[INTERIOR_TILE_SIZE - 0.06, INTERIOR_TILE_SIZE - 0.06]} />
            <meshBasicMaterial
              color={isHovered ? '#38bdf8' : checker ? '#94a3b8' : '#cbd5e1'}
              transparent
              opacity={isHovered ? 0.45 : 0.22}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* Furnitur yang sudah terpasang */}
      {draftFurniture.map((item) => (
        <FurnitureModel3D
          key={item.instanceId}
          placement={item}
          cols={cols}
          rows={rows}
          selected={item.instanceId === selectedInstanceId}
          onSelect={onSelectPlaced}
        />
      ))}

      {/* Pratinjau Ghost Penempatan */}
      {hoverCell && activeFurnitureId && ghostValid !== null && (
        <FurnitureModel3D
          placement={{
            instanceId: '__ghost__',
            furnitureId: activeFurnitureId,
            gx: hoverCell.gx,
            gz: hoverCell.gz,
            rot: activeRot,
          }}
          cols={cols}
          rows={rows}
          ghostValid={ghostValid}
        />
      )}
    </group>
  );
};
