import manifestData from './manifest.json';

export type AssetCategoryType =
  | 'dunia'
  | 'bangunan'
  | 'karakter'
  | 'kendaraan'
  | 'prop'
  | 'ikon'
  | 'interior'
  | 'atmosfer';

export type AssetBuildStatus = 'placeholder' | 'procedural' | 'glb';

export interface AssetFootprint {
  width: number;
  depth: number;
  height: number;
}

export interface AssetPoint {
  x: number;
  y: number;
  z: number;
}

export interface AssetInteractionPoint extends AssetPoint {
  radius: number;
}

export interface AssetLodDistances {
  high: number;
  medium: number;
  cull: number;
}

export interface AssetManifestEntry {
  id: string;
  name: string;
  type: AssetCategoryType;
  batch: number;
  referenceFile: string;
  secondaryReferenceFile?: string;
  proceduralComponent: string | null;
  glbPath: string | null;
  uiOutputFiles?: string[];
  footprint: AssetFootprint;
  pivot: 'bottom-center';
  entrancePoint: AssetPoint | null;
  interactionPoint: AssetInteractionPoint | null;
  maxTriangles: number;
  lodDistances: AssetLodDistances | null;
  status: AssetBuildStatus;
  gameLinks: Record<string, unknown>;
  notes?: string;
}

export interface AssetManifestDocument {
  version: string;
  styleGuide: string;
  scaleUnitMeters: number;
  referenceBaseDir: string;
  glbBaseDir: string;
  uiIconsBaseDir: string;
  defaultPolygonBudgets: Record<string, number>;
  assets: AssetManifestEntry[];
}

export const ASSET_MANIFEST = manifestData as AssetManifestDocument;

const ASSET_BY_ID = new Map<string, AssetManifestEntry>(
  ASSET_MANIFEST.assets.map((entry) => [entry.id, entry])
);

export function getAssetEntry(id: string): AssetManifestEntry | undefined {
  return ASSET_BY_ID.get(id);
}

export function getAllAssets(): AssetManifestEntry[] {
  return ASSET_MANIFEST.assets;
}

export function getAssetsByBatch(batch: number): AssetManifestEntry[] {
  return ASSET_MANIFEST.assets.filter((entry) => entry.batch === batch);
}

export function getAssetsByType(type: AssetCategoryType): AssetManifestEntry[] {
  return ASSET_MANIFEST.assets.filter((entry) => entry.type === type);
}
