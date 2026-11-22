import React from 'react';
import { CuboidCollider } from '@react-three/rapier';
import { getUnifiedColliderProps } from './layoutHelpers';

interface UnifiedLotColliderProps {
  lotId: string;
  override?: {
    width?: number;
    height?: number;
    depth?: number;
    offsetX?: number;
    offsetZ?: number;
  };
}

/**
 * Komponen tunggal pembentuk CuboidCollider Rapier langsung dari definisi footprint/collider di cicalengka.layout.json.
 */
export const UnifiedLotCollider: React.FC<UnifiedLotColliderProps> = ({ lotId, override }) => {
  const { args, position } = getUnifiedColliderProps(lotId, override);
  return <CuboidCollider args={args} position={position} />;
};
