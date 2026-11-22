import * as THREE from 'three';

/**
 * Palet warna resmi Cicalengka Life 3D sesuai /docs/STYLE_GUIDE.md.
 * Semua material 3D berbagi instance MeshStandardMaterial per token warna
 * untuk meminimalkan draw call dan kompilasi shader di GPU ponsel kelas menengah.
 */
export const STYLE_PALETTE = {
  // Alam, Tanah & Infrastruktur
  earth_clay: '#8E613E',
  earth_yard: '#C79C63',
  grass_main: '#7DB844',
  grass_hill: '#528D49',
  paddy_lime: '#A7D842',
  foliage_bright: '#69AD3B',
  foliage_palm: '#80BE43',
  road_asphalt: '#686E78',
  paving_stone: '#D4C3AD',
  rail_ballast: '#8A8177',
  rail_steel: '#636973',
  road_marking: '#F4F2EC',
  water_clear: '#5EB3D6',
  water_rain: '#6486A6',

  // Arsitektur, Atap, Dinding & Kayu
  roof_terracotta: '#E06B3B',
  roof_terracotta_dark: '#BD532D',
  roof_metal_grey: '#9198A2',
  roof_industrial_blue: '#4A76B5',
  roof_mosque_green: '#45AA50',
  wall_cream: '#F5EBD8',
  wall_plinth_grey: '#9A9590',
  wall_school_red: '#D64937',
  wall_pastel_mint: '#7ECBA1',
  wall_pastel_pink: '#F0958D',
  wall_pastel_yellow: '#F2CB6E',
  brick_orange: '#DC663C',
  concrete_grey: '#A9ADB4',
  wood_warm: '#B87842',
  wood_dark: '#744A2D',
  bamboo_light: '#CFA261',
  trim_colonial_green: '#28644B',
  trim_clinic_green: '#47B85C',
  trim_mart_red: '#EA3F33',
  trim_mart_blue: '#1F75DB',
  trim_bank_blue: '#1F5FC4',
  trim_police_khaki: '#7A6B5D',
  trim_police_dark: '#4A3C31',
  trim_gold: '#F2BC2E',
  tarp_blue: '#3A7FE5',
  tarp_red: '#E34C3E',
  tarp_yellow: '#F2B52C',
  glass_day: '#4E6E82',
  emissive_warm: '#FFBE55',
  shadow_tint: '#4E5B75',

  // Kendaraan & Detail Tambahan
  vehicle_angkot_green: '#6EC16E',
  vehicle_ojol_teal: '#4D9B8B',
  vehicle_truck_periwinkle: '#9FB4DE',
  vehicle_pickup_ochre: '#E3BA66',
  vehicle_tire: '#2E3238',
  vehicle_chrome: '#D6DCE5',
  vehicle_glass_tinted: '#1F2D3D',
  vehicle_ev_accent: '#22D3EE',
  vehicle_brake_red: '#EF4444',
  vehicle_plate_white: '#F8FAFC',
  vehicle_bumper_dark: '#333942',
  train_cream: '#F4ECE0',
  train_blue: '#457EC2',
  train_red: '#D44A35',
  ambulance_white: '#F4EFE6',
  flag_red: '#E13630',
  flag_white: '#F7F6F2',
} as const;

export type PaletteToken = keyof typeof STYLE_PALETTE;

export interface PaletteMaterialSpec {
  roughness: number;
  metalness: number;
  flatShading?: boolean;
  transparent?: boolean;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
}

const DEFAULT_MAT_SPECS: Partial<Record<PaletteToken, PaletteMaterialSpec>> = {
  earth_clay: { roughness: 0.94, metalness: 0.0 },
  earth_yard: { roughness: 0.94, metalness: 0.0 },
  grass_main: { roughness: 0.92, metalness: 0.0 },
  grass_hill: { roughness: 0.92, metalness: 0.0, flatShading: true },
  paddy_lime: { roughness: 0.9, metalness: 0.0 },
  foliage_bright: { roughness: 0.88, metalness: 0.0, flatShading: true },
  foliage_palm: { roughness: 0.85, metalness: 0.0, flatShading: true, side: THREE.DoubleSide },
  road_asphalt: { roughness: 0.9, metalness: 0.0 },
  paving_stone: { roughness: 0.86, metalness: 0.0 },
  rail_ballast: { roughness: 0.95, metalness: 0.0 },
  rail_steel: { roughness: 0.38, metalness: 0.72 },
  road_marking: { roughness: 0.8, metalness: 0.0 },
  water_clear: { roughness: 0.14, metalness: 0.1, transparent: true, opacity: 0.82 },
  water_rain: { roughness: 0.1, metalness: 0.18, transparent: true, opacity: 0.74 },
  roof_terracotta: { roughness: 0.76, metalness: 0.0 },
  roof_terracotta_dark: { roughness: 0.78, metalness: 0.0 },
  roof_metal_grey: { roughness: 0.44, metalness: 0.48 },
  roof_industrial_blue: { roughness: 0.46, metalness: 0.42 },
  roof_mosque_green: { roughness: 0.56, metalness: 0.12, flatShading: true },
  wall_cream: { roughness: 0.88, metalness: 0.0 },
  wall_plinth_grey: { roughness: 0.9, metalness: 0.0 },
  wall_school_red: { roughness: 0.86, metalness: 0.0 },
  wall_pastel_mint: { roughness: 0.86, metalness: 0.0 },
  wall_pastel_pink: { roughness: 0.86, metalness: 0.0 },
  wall_pastel_yellow: { roughness: 0.86, metalness: 0.0 },
  brick_orange: { roughness: 0.92, metalness: 0.0 },
  concrete_grey: { roughness: 0.9, metalness: 0.0 },
  wood_warm: { roughness: 0.8, metalness: 0.0 },
  wood_dark: { roughness: 0.78, metalness: 0.0 },
  bamboo_light: { roughness: 0.82, metalness: 0.0 },
  trim_colonial_green: { roughness: 0.74, metalness: 0.04 },
  trim_clinic_green: { roughness: 0.72, metalness: 0.04 },
  trim_mart_red: { roughness: 0.65, metalness: 0.05 },
  trim_mart_blue: { roughness: 0.65, metalness: 0.05 },
  trim_bank_blue: { roughness: 0.62, metalness: 0.08 },
  trim_police_khaki: { roughness: 0.8, metalness: 0.02 },
  trim_police_dark: { roughness: 0.76, metalness: 0.05 },
  trim_gold: { roughness: 0.28, metalness: 0.75 },
  tarp_blue: { roughness: 0.84, metalness: 0.0, side: THREE.DoubleSide },
  tarp_red: { roughness: 0.84, metalness: 0.0, side: THREE.DoubleSide },
  tarp_yellow: { roughness: 0.84, metalness: 0.0, side: THREE.DoubleSide },
  glass_day: { roughness: 0.18, metalness: 0.25 },
  emissive_warm: {
    roughness: 0.35,
    metalness: 0.0,
    emissive: '#FFBE55',
    emissiveIntensity: 1.35,
  },
  shadow_tint: { roughness: 0.92, metalness: 0.0 },
  vehicle_angkot_green: { roughness: 0.45, metalness: 0.18 },
  vehicle_ojol_teal: { roughness: 0.42, metalness: 0.22 },
  vehicle_truck_periwinkle: { roughness: 0.48, metalness: 0.16 },
  vehicle_pickup_ochre: { roughness: 0.48, metalness: 0.16 },
  vehicle_tire: { roughness: 0.9, metalness: 0.04 },
  vehicle_chrome: { roughness: 0.25, metalness: 0.82 },
  vehicle_glass_tinted: { roughness: 0.14, metalness: 0.32 },
  vehicle_ev_accent: { roughness: 0.3, metalness: 0.1, emissive: '#06B6D4', emissiveIntensity: 0.9 },
  vehicle_brake_red: { roughness: 0.35, metalness: 0.05, emissive: '#DC2626', emissiveIntensity: 0.35 },
  vehicle_plate_white: { roughness: 0.65, metalness: 0.05 },
  vehicle_bumper_dark: { roughness: 0.72, metalness: 0.08 },
  train_cream: { roughness: 0.48, metalness: 0.16 },
  train_blue: { roughness: 0.44, metalness: 0.2 },
  train_red: { roughness: 0.46, metalness: 0.18 },
  ambulance_white: { roughness: 0.42, metalness: 0.15 },
  flag_red: { roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide },
  flag_white: { roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide },
};

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Mengambil material palet bersama (singleton per token + flatShading).
 */
export function getPaletteMaterial(
  token: PaletteToken,
  overrides?: Partial<PaletteMaterialSpec>
): THREE.MeshStandardMaterial {
  const spec = {
    roughness: 0.85,
    metalness: 0.0,
    ...DEFAULT_MAT_SPECS[token],
    ...overrides,
  };
  const key = [
    token,
    spec.roughness,
    spec.metalness,
    spec.flatShading ? 1 : 0,
    spec.transparent ? 1 : 0,
    spec.opacity ?? 1,
    spec.emissive ?? '',
    spec.emissiveIntensity ?? 0,
    spec.side ?? THREE.FrontSide,
  ].join('|');

  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: STYLE_PALETTE[token],
      roughness: spec.roughness,
      metalness: spec.metalness,
      flatShading: Boolean(spec.flatShading),
      transparent: Boolean(spec.transparent),
      opacity: spec.opacity ?? 1,
      emissive: spec.emissive ? new THREE.Color(spec.emissive) : new THREE.Color('#000000'),
      emissiveIntensity: spec.emissiveIntensity ?? 0,
      side: spec.side ?? THREE.FrontSide,
    });
    materialCache.set(key, mat);
  }
  return mat;
}

/**
 * Material jendela bangunan bersama: kaca siang vs pendar hangat malam.
 */
export function getWindowMaterial(isNight: boolean): THREE.MeshStandardMaterial {
  return isNight ? getPaletteMaterial('emissive_warm') : getPaletteMaterial('glass_day');
}

/**
 * Material bohlam / lampion: redup hangat di siang hari, menyala terang saat malam.
 */
export function getLampMaterial(isNight: boolean): THREE.MeshStandardMaterial {
  return isNight
    ? getPaletteMaterial('emissive_warm', { emissiveIntensity: 2.1 })
    : getPaletteMaterial('emissive_warm', { emissiveIntensity: 0.12 });
}

/**
 * Material bersama untuk warna dinamis (kustomisasi karakter, warna cat properti Fase 3).
 */
export function getCustomColorMaterial(
  hex: string,
  options?: { roughness?: number; metalness?: number; flatShading?: boolean }
): THREE.MeshStandardMaterial {
  const normalized = hex.trim().toLowerCase();
  const roughness = options?.roughness ?? 0.84;
  const metalness = options?.metalness ?? 0.0;
  const flatShading = Boolean(options?.flatShading);
  const key = `custom|${normalized}|${roughness}|${metalness}|${flatShading ? 1 : 0}`;
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: normalized,
      roughness,
      metalness,
      flatShading,
    });
    materialCache.set(key, mat);
  }
  return mat;
}
