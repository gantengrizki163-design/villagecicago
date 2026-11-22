export type RoadHierarchy = 'arteri' | 'kolektor' | 'lingkungan' | 'gang';

export type CardinalDirection = 'north' | 'south' | 'east' | 'west';

export type LotKind =
  | 'landmark'
  | 'property'
  | 'kontrakan_npc'
  | 'plot'
  | 'stall'
  | 'utility'
  | 'reserved'
  | 'rail_crossing';

export type ZoneCategory =
  | 'stasiun'
  | 'perdagangan'
  | 'pemerintahan'
  | 'kesehatan_pendidikan'
  | 'hunian'
  | 'hijau_industri';

export type BuildingSpacingGroup = 'kampung' | 'ruko' | 'perumahan' | 'default';

export interface Vec2 {
  x: number;
  z: number;
}

export interface RoadDef {
  id: string;
  label: string;
  hierarchy: RoadHierarchy;
  points: [number, number][];
  width: number;
  sidewalkWidth: number;
  hasMarkings?: boolean;
  crosswalksAt?: number[];
}

export interface RailDef {
  id: string;
  label: string;
  points: [number, number][];
  ballastHalfDepth: number;
  safeBufferMeters: number;
  crossingX: number;
  crossingWidth: number;
  jpoId: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  category: ZoneCategory;
  polygon: [number, number][];
}

export interface PlazaFeatureDef {
  id: string;
  kind: 'beringin' | 'pendopo' | 'pkl_umbrella' | 'lamp' | 'bench';
  x: number;
  z: number;
  radius?: number;
  width?: number;
  depth?: number;
  colorToken?: string;
}

export interface PlazaDef {
  id: string;
  label: string;
  center: Vec2;
  width: number;
  depth: number;
  grassWidth: number;
  grassDepth: number;
  features: PlazaFeatureDef[];
}

export interface LotDef {
  id: string;
  label: string;
  type: LotKind;
  category: string;
  spacingGroup: BuildingSpacingGroup;
  zoneId: string;
  /** Main structural footprint in local asset space (used for setback & building spacing). */
  footprint: { width: number; depth: number };
  /** Optional larger outer apron/roof/paving footprint for strict zero-overlap checks. */
  outerFootprint?: { width: number; depth: number };
  /** Optional local center offset if the mesh is not centered at group origin (e.g. stasiun, polsek). */
  footprintOffset?: Vec2;
  /** Unified Rapier collider dimensions in local space. */
  collider?: { width: number; depth: number; height: number; offsetX?: number; offsetZ?: number };
  position: Vec2;
  rotDeg: 0 | 90 | 180 | 270;
  facing: CardinalDirection;
  roadId: string;
  /** World-space exterior point directly outside main door / front access. */
  door: Vec2;
  solid: boolean;
  exemptions?: string[];
  notes?: string;
}

export interface PlantZoneRule {
  id: string;
  kind: 'tree' | 'palm';
  style: 'avenue' | 'cluster';
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spacingMeters: number;
  /** Explicit deterministic avenue slots when avenue trees follow plaza/boulevard symmetry. */
  fixedCandidates?: Vec2[];
}

export interface PlantConfig {
  seed: number;
  treeRadius: number;
  palmRadius: number;
  minRoadEdgeClearanceMeters: number;
  minSidewalkEdgeClearanceMeters: number;
  minBuildingClearanceMeters: number;
  minPlotClearanceMeters: number;
  minDoorPathClearanceMeters: number;
  zones: PlantZoneRule[];
}

export interface PropConfig {
  seed: number;
  streetLampIntervalMeters: number;
  streetLampOffsetFromRoadEdge: number;
  fenceRules: {
    id: string;
    points: Array<{ x: number; z: number; rotY: number }>;
  }[];
  benchPositions: Array<{ id: string; x: number; z: number; rotY: number }>;
}

export interface LayoutRulesConfig {
  worldHalfSize: number;
  gridSnapMeters: number;
  allowedRotationsDeg: number[];
  roadSetbackMeters: number;
  railSafeMeters: number;
  industrialBufferMeters: number;
  maxRoadDistanceMeters: number;
  doorAccessWidthMeters: number;
  treeRoadClearanceMeters: number;
  treeSidewalkClearanceMeters: number;
  spacingByGroupMeters: Record<BuildingSpacingGroup, number>;
  connectivityGridStepMeters: number;
  connectivityAgentRadiusMeters: number;
}

export interface AnchorsDef {
  stationSpawn: { x: number; y: number; z: number; rotY: number };
  alunAlunCenter: Vec2;
  ticketBooth: Record<'cicalengka' | 'rancaekek' | 'bandung' | 'nagreg', Vec2>;
  policeStation: {
    x: number;
    z: number;
    label: string;
    jailCenter: { x: number; y: number; z: number };
    jailRadius: number;
    releaseSpawn: { x: number; y: number; z: number };
  };
  agentOffice: { x: number; z: number; label: string };
  hospitalPos: Vec2;
  atms: Array<{ id: string; label: string; x: number; z: number; rotDeg: 0 | 90 | 180 | 270 }>;
  cctvs: Array<{ id: string; label: string; x: number; z: number; radius: number; catchBonus: number }>;
  zoneTagAnchors: Record<string, Vec2>;
  npcRoutes: {
    patrolPolisi: [number, number][];
    joggingAlun: [number, number][];
    pasarKurir: [number, number][];
  };
}

export interface CicalengkaLayout {
  version: number;
  city: string;
  rules: LayoutRulesConfig;
  rails: RailDef[];
  roads: RoadDef[];
  zones: ZoneDef[];
  plaza: PlazaDef;
  lots: LotDef[];
  plants: PlantConfig;
  props: PropConfig;
  anchors: AnchorsDef;
}

export type ValidationRuleId =
  | 'ruleRoadOverlap'
  | 'ruleRoadSetback'
  | 'ruleBuildingOverlap'
  | 'ruleBuildingSpacing'
  | 'ruleRailSafety'
  | 'rulePlazaSolidFree'
  | 'ruleRoadProximity'
  | 'ruleGridAndRotation'
  | 'ruleFacingAndDoorAccess'
  | 'ruleIndustrialBuffer'
  | 'ruleTreeClearance'
  | 'ruleGridConnectivityAStar';

export interface ValidationViolation {
  id: string;
  targetId?: string;
  rule: ValidationRuleId;
  severity: 'ERROR' | 'WARN';
  message: string;
  details?: Record<string, unknown>;
}

export interface GeneratedPlant {
  id: string;
  kind: 'tree' | 'palm';
  zoneRuleId: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

export interface GeneratedStreetLamp {
  id: string;
  x: number;
  z: number;
  rotY: number;
  roadId: string;
}

export interface GeneratedPropsBundle {
  lamps: GeneratedStreetLamp[];
  benches: Array<{ id: string; x: number; z: number; rotY: number }>;
  fences: Array<{ id: string; x: number; z: number; rotY: number }>;
}

export interface ConnectivityResult {
  reachableIds: string[];
  unreachableIds: Array<{ id: string; target: Vec2; reason: string }>;
  checkedTargetsCount: number;
  gridStepMeters: number;
}

export interface LayoutValidationReport {
  valid: boolean;
  errorCount: number;
  warnCount: number;
  violations: ValidationViolation[];
  connectivity: ConnectivityResult;
  plantsGenerated: { trees: GeneratedPlant[]; palms: GeneratedPlant[] };
}
