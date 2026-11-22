import * as THREE from 'three';
import type { VehicleModelConfig } from '../../types/game';
import { getVehicleModelById } from '../../firebase/vehicleConfigCache';
import { getCustomColorMaterial, getPaletteMaterial } from '../assets/paletteMaterials';

export interface VehicleSharedMaterials {
  body: THREE.MeshStandardMaterial;
  accentDark: THREE.MeshStandardMaterial;
  tire: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  bumper: THREE.MeshStandardMaterial;
  seatDark: THREE.MeshStandardMaterial;
  seatBrown: THREE.MeshStandardMaterial;
  headlight: THREE.MeshStandardMaterial;
  taillight: THREE.MeshStandardMaterial;
  turnLeft: THREE.MeshStandardMaterial;
  turnRight: THREE.MeshStandardMaterial;
  evAccent: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
}

const lightMatCache = new Map<string, THREE.MeshStandardMaterial>();

function getEmissiveMaterial(
  key: string,
  color: string,
  emissive: string,
  intensity: number
): THREE.MeshStandardMaterial {
  const fullKey = `${key}|${intensity.toFixed(2)}`;
  let mat = lightMatCache.get(fullKey);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.25,
      metalness: 0.05,
      emissive: new THREE.Color(emissive),
      emissiveIntensity: intensity,
    });
    lightMatCache.set(fullKey, mat);
  }
  return mat;
}

export function getVehicleMaterials(opts: {
  color: string;
  isNight?: boolean;
  headlightsOn?: boolean;
  brakeOn?: boolean;
  turnSignal?: 'off' | 'left' | 'right' | 'hazard';
  turnBlinkOn?: boolean;
  tintedGlass?: boolean;
  isPublicPlate?: boolean;
}): VehicleSharedMaterials {
  const bodyHex = opts.color || '#1E293B';
  const headIntensity = opts.headlightsOn ? (opts.isNight ? 2.4 : 1.15) : opts.isNight ? 0.55 : 0.15;
  const brakeIntensity = opts.brakeOn ? 2.2 : opts.headlightsOn || opts.isNight ? 0.9 : 0.25;
  const blink = Boolean(opts.turnBlinkOn);
  const leftActive = blink && (opts.turnSignal === 'left' || opts.turnSignal === 'hazard');
  const rightActive = blink && (opts.turnSignal === 'right' || opts.turnSignal === 'hazard');

  return {
    body: getCustomColorMaterial(bodyHex, { roughness: 0.42, metalness: 0.18 }),
    accentDark: getCustomColorMaterial('#222832', { roughness: 0.65, metalness: 0.12 }),
    tire: getPaletteMaterial('vehicle_tire'),
    rim: getPaletteMaterial('concrete_grey', { roughness: 0.32, metalness: 0.48 }),
    chrome: getPaletteMaterial('vehicle_chrome'),
    glass: opts.tintedGlass ? getPaletteMaterial('vehicle_glass_tinted') : getPaletteMaterial('glass_day'),
    bumper: getPaletteMaterial('vehicle_bumper_dark'),
    seatDark: getCustomColorMaterial('#1E222B', { roughness: 0.85 }),
    seatBrown: getCustomColorMaterial('#6E4326', { roughness: 0.82 }),
    headlight: getEmissiveMaterial('headlight', '#FFF6DC', '#FFD782', headIntensity),
    taillight: getEmissiveMaterial('taillight', '#DC2626', '#FF2E2E', brakeIntensity),
    turnLeft: getEmissiveMaterial('turn_l', leftActive ? '#FBBF24' : '#78350F', '#F59E0B', leftActive ? 2.3 : 0.12),
    turnRight: getEmissiveMaterial('turn_r', rightActive ? '#FBBF24' : '#78350F', '#F59E0B', rightActive ? 2.3 : 0.12),
    evAccent: getPaletteMaterial('vehicle_ev_accent'),
    plate: opts.isPublicPlate ? getPaletteMaterial('tarp_yellow') : getPaletteMaterial('vehicle_plate_white'),
    wood: getPaletteMaterial('wood_warm'),
  };
}

export interface VehicleSeatAnchor {
  driverOffset: [number, number, number];
  passengerOffsets: Array<[number, number, number]>;
  wheelBaseHalf: number;
  wheelRadius: number;
  seatScale: number;
}

export function getVehicleSeatAnchors(modelId: string): VehicleSeatAnchor {
  const model: VehicleModelConfig | null = getVehicleModelById(modelId);
  if (!model || model.category === 'motor') {
    if (modelId === 'npc_becak') {
      return {
        driverOffset: [0, 0.78, -0.68],
        passengerOffsets: [[0, 0.66, 0.36]],
        wheelBaseHalf: 0.6,
        wheelRadius: 0.3,
        seatScale: 0.92,
      };
    }
    return {
      driverOffset: [0, 0.76, -0.14],
      passengerOffsets: [[0, 0.78, -0.48]],
      wheelBaseHalf: 0.62,
      wheelRadius: 0.26,
      seatScale: 0.95,
    };
  }
  const halfLen = (model.dimensions.length || 4.0) * 0.31;
  const seatY = model.subType === 'bus' || model.subType === 'truk_besar' ? 0.95 : 0.54;
  return {
    driverOffset: [-0.36, seatY, 0.22],
    passengerOffsets: [
      [0.36, seatY, 0.22],
      [-0.36, seatY, -0.58],
      [0.36, seatY, -0.58],
    ],
    wheelBaseHalf: halfLen,
    wheelRadius: model.subType === 'suv' || model.subType === 'truk_kecil' || model.subType === 'truk_besar' ? 0.38 : 0.31,
    seatScale: 0.72,
  };
}
