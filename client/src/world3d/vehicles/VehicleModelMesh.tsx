import React, { useMemo } from 'react';
import { getVehicleModelById } from '../../firebase/vehicleConfigCache';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from '../assets/AssetModelLoader';
import { CarAndNpcModelMesh } from './CarAndNpcModels3D';
import { MotorcycleModelMesh } from './MotorcycleModels3D';
import { getVehicleMaterials } from './vehicleMaterials';

export interface VehicleModelMeshProps {
  modelId: string;
  color?: string;
  quality?: GraphicsQuality;
  isNight?: boolean;
  headlightsOn?: boolean;
  brakeOn?: boolean;
  turnSignal?: 'off' | 'left' | 'right' | 'hazard';
  turnBlinkOn?: boolean;
  sirenActive?: boolean;
  steerAngle?: number;
  wheelSpinRad?: number;
  accessories?: string[];
  lod?: 'full' | 'simple';
  castShadow?: boolean;
  /** Aktifkan probe GLB opsional dari /public/models/{assetId}.glb (bila tidak memakai warna/aksesoris dinamis). */
  enableGlb?: boolean;
}

/**
 * Dispatcher tunggal model kendaraan 3D low-poly (21 varian: 7 motor, 9 mobil, 5 kendaraan NPC).
 * Pivot berada di bottom-center (y = 0) dan menghadap sumbu +Z.
 */
export const VehicleModelMesh: React.FC<VehicleModelMeshProps> = ({
  modelId,
  color,
  quality = 'medium',
  isNight = false,
  headlightsOn = false,
  brakeOn = false,
  turnSignal = 'off',
  turnBlinkOn = false,
  sirenActive = false,
  steerAngle = 0,
  wheelSpinRad = 0,
  accessories = [],
  lod = 'full',
  castShadow,
  enableGlb = false,
}) => {
  const modelCfg = getVehicleModelById(modelId);
  const subType = modelCfg?.subType || modelId.replace(/^(motor_|mobil_|npc_)/, '');
  const isMotorCategory =
    modelCfg?.category === 'motor' ||
    modelId.startsWith('motor_') ||
    subType === 'becak';

  const resolvedColor = color || modelCfg?.colors?.[0] || '#1E293B';
  const tintedGlass = accessories.includes('kaca_film');
  const isPublicPlate = subType === 'angkot' || subType === 'bus' || subType === 'truk_besar';
  const shadows = (castShadow ?? quality !== 'low') && lod === 'full';

  const mats = useMemo(
    () =>
      getVehicleMaterials({
        color: resolvedColor,
        isNight,
        headlightsOn,
        brakeOn,
        turnSignal,
        turnBlinkOn,
        tintedGlass,
        isPublicPlate,
      }),
    [resolvedColor, isNight, headlightsOn, brakeOn, turnSignal, turnBlinkOn, tintedGlass, isPublicPlate]
  );

  const meshNode = isMotorCategory ? (
    <MotorcycleModelMesh
      subType={subType}
      mats={mats}
      castShadow={shadows}
      lod={lod}
      steerAngle={steerAngle}
      wheelSpinRad={wheelSpinRad}
      accessories={accessories}
    />
  ) : (
    <CarAndNpcModelMesh
      subType={subType}
      mats={mats}
      castShadow={shadows}
      lod={lod}
      steerAngle={steerAngle}
      wheelSpinRad={wheelSpinRad}
      isNight={isNight}
      sirenActive={sirenActive}
      accessories={accessories}
    />
  );

  if (enableGlb) {
    return (
      <AssetModelLoader assetId={`vehicle_${modelId}`} quality={quality} castShadow={shadows}>
        {meshNode}
      </AssetModelLoader>
    );
  }

  return meshNode;
};
