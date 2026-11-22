import type {
  BuildingSpacingGroup,
  CardinalDirection,
  CicalengkaLayout,
  ConnectivityResult,
  GeneratedPlant,
  GeneratedPropsBundle,
  GeneratedStreetLamp,
  LotDef,
  PlantZoneRule,
  RailDef,
  RoadDef,
  ValidationViolation,
  Vec2,
} from './types';

export interface Box2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  width: number;
  depth: number;
}

export interface RoadGeometry {
  roadId: string;
  label: string;
  hierarchy: RoadDef['hierarchy'];
  asphalt: Box2D;
  corridor: Box2D;
  sidewalks: Box2D[];
}

export interface RailGeometry {
  railId: string;
  ballast: Box2D;
  safeZone: Box2D;
  crossing: Box2D;
  jpoZone?: Box2D;
}

export function makeBoxFromCenter(cx: number, cz: number, width: number, depth: number): Box2D {
  const hw = width / 2;
  const hd = depth / 2;
  return {
    minX: cx - hw,
    maxX: cx + hw,
    minZ: cz - hd,
    maxZ: cz + hd,
    cx,
    cz,
    width,
    depth,
  };
}

export function makeBoxFromBounds(minX: number, maxX: number, minZ: number, maxZ: number): Box2D {
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    width: Math.max(0, maxX - minX),
    depth: Math.max(0, maxZ - minZ),
  };
}

export function expandBox(b: Box2D, margin: number): Box2D {
  return makeBoxFromBounds(b.minX - margin, b.maxX + margin, b.minZ - margin, b.maxZ + margin);
}

export function boxIntersectionArea(a: Box2D, b: Box2D): number {
  const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  if (ox <= 1e-6 || oz <= 1e-6) return 0;
  return ox * oz;
}

export function boxEdgeDistance(a: Box2D, b: Box2D): number {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
  return Math.sqrt(dx * dx + dz * dz);
}

export function pointToBoxDistance(x: number, z: number, b: Box2D): number {
  const dx = Math.max(0, b.minX - x, x - b.maxX);
  const dz = Math.max(0, b.minZ - z, z - b.maxZ);
  return Math.sqrt(dx * dx + dz * dz);
}

export function pointInBox(x: number, z: number, b: Box2D, margin = 0): boolean {
  return (
    x >= b.minX - margin &&
    x <= b.maxX + margin &&
    z >= b.minZ - margin &&
    z <= b.maxZ + margin
  );
}

export function rotateLocalOffset(ox: number, oz: number, rotDeg: number): Vec2 {
  const norm = ((rotDeg % 360) + 360) % 360;
  if (norm === 90) return { x: oz, z: -ox };
  if (norm === 180) return { x: -ox, z: -oz };
  if (norm === 270) return { x: -oz, z: ox };
  return { x: ox, z: oz };
}

export function getLotBox(lot: LotDef, useOuter = false): Box2D {
  const fp = useOuter && lot.outerFootprint ? lot.outerFootprint : lot.footprint;
  const norm = ((lot.rotDeg % 360) + 360) % 360;
  const swapped = norm === 90 || norm === 270;
  const w = swapped ? fp.depth : fp.width;
  const d = swapped ? fp.width : fp.depth;
  const off = lot.footprintOffset
    ? rotateLocalOffset(lot.footprintOffset.x, lot.footprintOffset.z, lot.rotDeg)
    : { x: 0, z: 0 };
  return makeBoxFromCenter(lot.position.x + off.x, lot.position.z + off.z, w, d);
}

export function getRoadBoxes(roads: RoadDef[]): RoadGeometry[] {
  const out: RoadGeometry[] = [];
  for (const road of roads) {
    for (let i = 0; i < road.points.length - 1; i++) {
      const [x1, z1] = road.points[i];
      const [x2, z2] = road.points[i + 1];
      const isHoriz = Math.abs(z1 - z2) <= Math.abs(x1 - x2);
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minZ = Math.min(z1, z2);
      const maxZ = Math.max(z1, z2);
      const halfW = road.width / 2;
      const sw = road.sidewalkWidth;

      const asphalt = isHoriz
        ? makeBoxFromBounds(minX, maxX, minZ - halfW, maxZ + halfW)
        : makeBoxFromBounds(minX - halfW, maxX + halfW, minZ, maxZ);

      const corridor = isHoriz
        ? makeBoxFromBounds(minX - sw, maxX + sw, minZ - halfW - sw, maxZ + halfW + sw)
        : makeBoxFromBounds(minX - halfW - sw, maxX + halfW + sw, minZ - sw, maxZ + sw);

      const sidewalks: Box2D[] = isHoriz
        ? [
            makeBoxFromBounds(minX - sw, maxX + sw, minZ - halfW - sw, minZ - halfW),
            makeBoxFromBounds(minX - sw, maxX + sw, maxZ + halfW, maxZ + halfW + sw),
          ]
        : [
            makeBoxFromBounds(minX - halfW - sw, minX - halfW, minZ - sw, maxZ + sw),
            makeBoxFromBounds(maxX + halfW, maxX + halfW + sw, minZ - sw, maxZ + sw),
          ];

      out.push({
        roadId: road.id,
        label: road.label,
        hierarchy: road.hierarchy,
        asphalt,
        corridor,
        sidewalks,
      });
    }
  }
  return out;
}

export function getRailBoxes(rails: RailDef[], safeMeters: number, lots: LotDef[] = []): RailGeometry[] {
  const out: RailGeometry[] = [];
  for (const rail of rails) {
    if (rail.points.length < 2) continue;
    const [[x1, z1], [x2, z2]] = rail.points;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const centerZ = (z1 + z2) / 2 - 1.6;
    const ballast = makeBoxFromBounds(minX, maxX, centerZ - rail.ballastHalfDepth, centerZ + rail.ballastHalfDepth);
    const safeZone = expandBox(ballast, Math.max(rail.safeBufferMeters, safeMeters));
    const crossing = makeBoxFromBounds(
      rail.crossingX - rail.crossingWidth / 2,
      rail.crossingX + rail.crossingWidth / 2,
      ballast.minZ - 0.8,
      ballast.maxZ + 0.8
    );
    const jpoLot = lots.find((l) => l.id === rail.jpoId);
    const jpoZone = jpoLot ? getLotBox(jpoLot, false) : undefined;
    out.push({ railId: rail.id, ballast, safeZone, crossing, jpoZone });
  }
  return out;
}

export function getPlazaBox(layout: CicalengkaLayout): Box2D {
  return makeBoxFromCenter(
    layout.plaza.center.x,
    layout.plaza.center.z,
    layout.plaza.width,
    layout.plaza.depth
  );
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hasExemption(lot: LotDef, flag: string): boolean {
  return Boolean(lot.exemptions && lot.exemptions.includes(flag));
}

function isResidentialLot(lot: LotDef): boolean {
  return (
    lot.zoneId === 'zona_hunian' ||
    lot.category === 'hunian' ||
    lot.category === 'kos' ||
    lot.category === 'kontrakan' ||
    lot.category === 'rumah' ||
    lot.category === 'apartemen'
  );
}

function isIndustrialLot(lot: LotDef): boolean {
  return lot.category === 'industri' || lot.id.includes('pabrik');
}

function getDoorAccessSegment(lot: LotDef, roads: RoadGeometry[], widthMeters: number): Box2D | null {
  const lotBox = getLotBox(lot, false);
  const nearestRoad = roads
    .filter((r) => r.roadId === lot.roadId)
    .sort((a, b) => pointToBoxDistance(lot.door.x, lot.door.z, a.asphalt) - pointToBoxDistance(lot.door.x, lot.door.z, b.asphalt))[0];

  const targetRoad = nearestRoad;
  if (!targetRoad) return null;

  const half = widthMeters / 2;
  const rx = Math.max(targetRoad.asphalt.minX, Math.min(targetRoad.asphalt.maxX, lot.door.x));
  const rz = Math.max(targetRoad.asphalt.minZ, Math.min(targetRoad.asphalt.maxZ, lot.door.z));

  const minX = Math.min(lot.door.x, rx) - half;
  const maxX = Math.max(lot.door.x, rx) + half;
  const minZ = Math.min(lot.door.z, rz) - half;
  const maxZ = Math.max(lot.door.z, rz) + half;

  const seg = makeBoxFromBounds(minX, maxX, minZ, maxZ);
  // Pastikan segmen akses tidak menjorok masuk ke dalam footprint bangunan pemiliknya sendiri
  if (lot.facing === 'south') {
    return makeBoxFromBounds(seg.minX, seg.maxX, Math.max(lotBox.maxZ + 0.05, seg.minZ), seg.maxZ);
  }
  if (lot.facing === 'north') {
    return makeBoxFromBounds(seg.minX, seg.maxX, seg.minZ, Math.min(lotBox.minZ - 0.05, seg.maxZ));
  }
  if (lot.facing === 'east') {
    return makeBoxFromBounds(Math.max(lotBox.maxX + 0.05, seg.minX), seg.maxX, seg.minZ, seg.maxZ);
  }
  return makeBoxFromBounds(seg.minX, Math.min(lotBox.minX - 0.05, seg.maxX), seg.minZ, seg.maxZ);
}

function getFacingVector(dir: CardinalDirection): Vec2 {
  if (dir === 'north') return { x: 0, z: -1 };
  if (dir === 'south') return { x: 0, z: 1 };
  if (dir === 'east') return { x: 1, z: 0 };
  return { x: -1, z: 0 };
}

export function isPlantSpotClear(
  x: number,
  z: number,
  radius: number,
  layout: CicalengkaLayout,
  roads: RoadGeometry[],
  rails: RailGeometry[],
  doorPaths: Box2D[],
  placedPlants: Array<{ x: number; z: number; radius: number }>
): { ok: boolean; reason?: string; blockerId?: string } {
  const limit = layout.rules.worldHalfSize - 2.0;
  if (Math.abs(x) > limit || Math.abs(z) > limit) {
    return { ok: false, reason: 'outside_world_bounds' };
  }

  for (const road of roads) {
    const dAsphalt = pointToBoxDistance(x, z, road.asphalt);
    if (dAsphalt < layout.plants.minRoadEdgeClearanceMeters) {
      return { ok: false, reason: 'on_road', blockerId: road.roadId };
    }
    for (const sw of road.sidewalks) {
      const dSw = pointToBoxDistance(x, z, sw);
      if (dSw < layout.plants.minSidewalkEdgeClearanceMeters) {
        return { ok: false, reason: 'on_sidewalk', blockerId: `${road.roadId}_sidewalk` };
      }
    }
  }

  for (const rail of rails) {
    const dRail = pointToBoxDistance(x, z, rail.ballast);
    if (dRail < layout.rules.railSafeMeters) {
      return { ok: false, reason: 'in_rail_buffer', blockerId: rail.railId };
    }
  }

  // Jangan menaruh pohon di dalam area grass plaza (beringin & pendopo punya tempat sendiri),
  // tapi pohon tepi di X=±12 berada DI LUAR lebar alun-alun (X ∈ [-10, +10]).
  const plazaBox = getPlazaBox(layout);
  if (pointInBox(x, z, plazaBox, 0.2)) {
    return { ok: false, reason: 'inside_plaza', blockerId: layout.plaza.id };
  }

  for (const lot of layout.lots) {
    const lb = getLotBox(lot, true);
    if (lot.type === 'plot') {
      if (pointToBoxDistance(x, z, lb) < radius + layout.plants.minPlotClearanceMeters) {
        return { ok: false, reason: 'inside_plot', blockerId: lot.id };
      }
    } else if (lot.id === 'sawah_timur' || lot.id === 'empang') {
      if (pointToBoxDistance(x, z, lb) < radius + 0.6) {
        return { ok: false, reason: 'inside_water_or_paddy', blockerId: lot.id };
      }
    } else if (lot.solid || lot.type === 'rail_crossing') {
      if (pointToBoxDistance(x, z, lb) < radius + layout.plants.minBuildingClearanceMeters) {
        return { ok: false, reason: 'inside_building', blockerId: lot.id };
      }
    }
  }

  for (const dp of doorPaths) {
    if (pointToBoxDistance(x, z, dp) < radius + layout.plants.minDoorPathClearanceMeters) {
      return { ok: false, reason: 'blocking_door_access' };
    }
  }

  for (const existing of placedPlants) {
    const dx = existing.x - x;
    const dz = existing.z - z;
    if (Math.sqrt(dx * dx + dz * dz) < existing.radius + radius + 1.4) {
      return { ok: false, reason: 'too_close_to_other_plant' };
    }
  }

  return { ok: true };
}

/**
 * Menghasilkan koordinat pohon dan palem secara deterministik dari aturan zona + seed di layout JSON.
 */
export function generateDeterministicPlants(layout: CicalengkaLayout): {
  trees: GeneratedPlant[];
  palms: GeneratedPlant[];
} {
  const rng = mulberry32(layout.plants.seed);
  const roads = getRoadBoxes(layout.roads);
  const rails = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);
  const doorPaths = layout.lots
    .map((l) => getDoorAccessSegment(l, roads, layout.rules.doorAccessWidthMeters))
    .filter((b): b is Box2D => Boolean(b));

  const trees: GeneratedPlant[] = [];
  const palms: GeneratedPlant[] = [];
  const placed: Array<{ x: number; z: number; radius: number }> = [];

  const tryPlace = (rule: PlantZoneRule, x: number, z: number, idxHint: number) => {
    const r = rule.kind === 'palm' ? layout.plants.palmRadius : layout.plants.treeRadius;
    const check = isPlantSpotClear(x, z, r, layout, roads, rails, doorPaths, placed);
    if (!check.ok) return;

    const scale =
      rule.kind === 'palm'
        ? 0.94 + Math.floor(rng() * 4) * 0.07
        : 0.92 + Math.floor(rng() * 8) * 0.035;
    const rotY = Number((rng() * Math.PI * 2).toFixed(3));
    const entry: GeneratedPlant = {
      id: `${rule.kind === 'palm' ? 'palem' : 'pohon'}_${rule.id}_${idxHint}`,
      kind: rule.kind,
      zoneRuleId: rule.id,
      x: Number(x.toFixed(2)),
      y: 0,
      z: Number(z.toFixed(2)),
      scale: Number(scale.toFixed(3)),
      rotY,
    };

    placed.push({ x: entry.x, z: entry.z, radius: r });
    if (rule.kind === 'palm') palms.push(entry);
    else trees.push(entry);
  };

  for (const rule of layout.plants.zones) {
    let idx = 1;
    if (rule.fixedCandidates && rule.fixedCandidates.length > 0) {
      for (const cand of rule.fixedCandidates) {
        tryPlace(rule, cand.x, cand.z, idx++);
      }
      continue;
    }

    const step = Math.max(4, rule.spacingMeters);
    for (let z = rule.bounds.minZ; z <= rule.bounds.maxZ; z += step) {
      for (let x = rule.bounds.minX; x <= rule.bounds.maxX; x += step) {
        const jx = (rng() - 0.5) * 1.2;
        const jz = (rng() - 0.5) * 1.2;
        tryPlace(rule, Math.round((x + jx) * 2) / 2, Math.round((z + jz) * 2) / 2, idx++);
      }
    }
  }

  return { trees, palms };
}

/**
 * Menghasilkan lampu jalan, bangku taman, dan segmen pagar secara deterministik sesuai interval jalan.
 */
export function generateDeterministicProps(layout: CicalengkaLayout): GeneratedPropsBundle {
  const roads = getRoadBoxes(layout.roads);
  const rails = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);
  const interval = Math.max(8, layout.props.streetLampIntervalMeters);
  const curbOffset = layout.props.streetLampOffsetFromRoadEdge;
  const lamps: GeneratedStreetLamp[] = [];

  for (const road of layout.roads) {
    if (road.hierarchy === 'gang' || road.points.length < 2) continue;
    const [x1, z1] = road.points[0];
    const [x2, z2] = road.points[1];
    const isHoriz = Math.abs(z1 - z2) <= Math.abs(x1 - x2);
    const halfW = road.width / 2;

    if (isHoriz) {
      const startX = Math.min(x1, x2) + 8;
      const endX = Math.max(x1, x2) - 8;
      let idx = 0;
      for (let x = startX; x <= endX; x += interval) {
        const side = idx % 2 === 0 ? -1 : 1;
        const lz = z1 + side * (halfW + curbOffset);
        const overlapsIntersection = roads.some(
          (other) => other.roadId !== road.id && pointToBoxDistance(x, lz, other.asphalt) < 2.2
        );
        const overlapsBuilding = layout.lots.some(
          (lot) => lot.solid && pointToBoxDistance(x, lz, getLotBox(lot, true)) < 0.7
        );
        if (!overlapsIntersection && !overlapsBuilding) {
          lamps.push({
            id: `lamp_${road.id}_${idx}`,
            x: Number(x.toFixed(2)),
            z: Number(lz.toFixed(2)),
            rotY: side < 0 ? 0 : Math.PI,
            roadId: road.id,
          });
        }
        idx++;
      }
    } else {
      const startZ = Math.min(z1, z2) + 8;
      const endZ = Math.max(z1, z2) - 8;
      let idx = 0;
      for (let z = startZ; z <= endZ; z += interval) {
        const side = idx % 2 === 0 ? -1 : 1;
        const lx = x1 + side * (halfW + curbOffset);
        const overlapsIntersection = roads.some(
          (other) => other.roadId !== road.id && pointToBoxDistance(lx, z, other.asphalt) < 2.2
        );
        const overlapsRail = rails.some((r) => pointToBoxDistance(lx, z, r.ballast) < 2.5);
        const overlapsBuilding = layout.lots.some(
          (lot) => lot.solid && pointToBoxDistance(lx, z, getLotBox(lot, true)) < 0.7
        );
        if (!overlapsIntersection && !overlapsRail && !overlapsBuilding) {
          lamps.push({
            id: `lamp_${road.id}_${idx}`,
            x: Number(lx.toFixed(2)),
            z: Number(z.toFixed(2)),
            rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
            roadId: road.id,
          });
        }
        idx++;
      }
    }
  }

  const fences = layout.props.fenceRules.flatMap((r) =>
    r.points.map((pt, idx) => ({
      id: `${r.id}_${idx}`,
      x: pt.x,
      z: pt.z,
      rotY: pt.rotY,
    }))
  );
  return {
    lamps,
    benches: layout.props.benchPositions,
    fences,
  };
}

export function checkRoadOverlap(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const roads = getRoadBoxes(layout.roads);

  for (const lot of layout.lots) {
    if (!lot.solid && lot.type !== 'plot') continue;
    const lb = getLotBox(lot, false);
    for (const road of roads) {
      const area = boxIntersectionArea(lb, road.asphalt);
      if (area > 0.05) {
        violations.push({
          id: lot.id,
          targetId: road.roadId,
          rule: 'ruleRoadOverlap',
          severity: 'ERROR',
          message: `Objek "${lot.id}" menimpa jalan "${road.roadId}" seluas ${area.toFixed(2)} m².`,
          details: { area, roadId: road.roadId },
        });
      }
    }
  }
  return violations;
}

export function checkRoadSetback(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const roads = getRoadBoxes(layout.roads);
  const minSetback = layout.rules.roadSetbackMeters;

  for (const lot of layout.lots) {
    if (!lot.solid && lot.type !== 'plot') continue;
    if (hasExemption(lot, 'road_setback_sidewalk_stall')) continue;
    const lb = getLotBox(lot, false);

    let closestDist = Infinity;
    let closestRoadId = '';
    for (const road of roads) {
      const dist = boxEdgeDistance(lb, road.asphalt);
      if (dist < closestDist) {
        closestDist = dist;
        closestRoadId = road.roadId;
      }
    }

    if (closestDist > 0 && closestDist < minSetback - 1e-4) {
      violations.push({
        id: lot.id,
        targetId: closestRoadId,
        rule: 'ruleRoadSetback',
        severity: 'ERROR',
        message: `Objek "${lot.id}" berjarak ${closestDist.toFixed(2)} m dari tepi aspal "${closestRoadId}" (< setback minimal ${minSetback} m).`,
        details: { distance: closestDist, required: minSetback, roadId: closestRoadId },
      });
    }
  }
  return violations;
}

export function checkBuildingOverlap(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const checkLots = layout.lots.filter((l) => l.solid || l.type === 'plot');

  for (let i = 0; i < checkLots.length; i++) {
    for (let j = i + 1; j < checkLots.length; j++) {
      const a = checkLots[i];
      const b = checkLots[j];
      const boxA = getLotBox(a, true);
      const boxB = getLotBox(b, true);
      const area = boxIntersectionArea(boxA, boxB);
      if (area > 0.05) {
        violations.push({
          id: a.id,
          targetId: b.id,
          rule: 'ruleBuildingOverlap',
          severity: 'ERROR',
          message: `Objek "${a.id}" tumpang tindih dengan "${b.id}" seluas ${area.toFixed(2)} m².`,
          details: { area, otherId: b.id },
        });
      }
    }
  }
  return violations;
}

export function checkBuildingSpacing(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const buildingLots = layout.lots.filter((l) => l.solid);

  for (let i = 0; i < buildingLots.length; i++) {
    for (let j = i + 1; j < buildingLots.length; j++) {
      const a = buildingLots[i];
      const b = buildingLots[j];
      if (a.zoneId !== b.zoneId) continue;

      const boxA = getLotBox(a, false);
      const boxB = getLotBox(b, false);
      // Cek hanya jika keduanya sejajar berdampingan pada baris atau kolom yang sama
      const sameRowZ = Math.min(boxA.maxZ, boxB.maxZ) - Math.max(boxA.minZ, boxB.minZ) > 1.5;
      const sameColX = Math.min(boxA.maxX, boxB.maxX) - Math.max(boxA.minX, boxB.minX) > 1.5;
      if (!sameRowZ && !sameColX) continue;

      const gap = boxEdgeDistance(boxA, boxB);
      if (gap <= 1e-4) continue; // overlap sudah dilaporkan ruleBuildingOverlap

      const group: BuildingSpacingGroup =
        a.spacingGroup === b.spacingGroup ? a.spacingGroup : 'default';
      const requiredGap = layout.rules.spacingByGroupMeters[group];

      // Jika jaraknya dekat (< 5m), pastikan memenuhi jarak minimum antar bangunan sekelompok
      if (gap < 5.0 && gap < requiredGap - 1e-4) {
        violations.push({
          id: a.id,
          targetId: b.id,
          rule: 'ruleBuildingSpacing',
          severity: 'ERROR',
          message: `Jarak antar bangunan "${a.id}" dan "${b.id}" hanya ${gap.toFixed(2)} m (< minimal ${requiredGap} m untuk grup "${group}").`,
          details: { gap, required: requiredGap, group, otherId: b.id },
        });
      }
    }
  }
  return violations;
}

export function checkRailSafety(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const rails = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);

  for (const lot of layout.lots) {
    if (!lot.solid && lot.type !== 'plot') continue;
    if (hasExemption(lot, 'rail_buffer')) continue;
    const lb = getLotBox(lot, false);
    for (const rail of rails) {
      const d = boxEdgeDistance(lb, rail.ballast);
      if (d < layout.rules.railSafeMeters - 1e-4) {
        violations.push({
          id: lot.id,
          targetId: rail.railId,
          rule: 'ruleRailSafety',
          severity: 'ERROR',
          message: `Objek "${lot.id}" melanggar zona aman rel "${rail.railId}" (jarak ${d.toFixed(2)} m < ${layout.rules.railSafeMeters} m).`,
          details: { distance: d, required: layout.rules.railSafeMeters },
        });
      }
    }
  }
  return violations;
}

export function checkPlazaSolidFree(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const plazaBox = getPlazaBox(layout);

  for (const lot of layout.lots) {
    if (!lot.solid) continue;
    const lb = getLotBox(lot, true);
    const area = boxIntersectionArea(lb, plazaBox);
    if (area > 0.05) {
      violations.push({
        id: lot.id,
        targetId: layout.plaza.id,
        rule: 'rulePlazaSolidFree',
        severity: 'ERROR',
        message: `Bangunan solid "${lot.id}" masuk ke dalam Alun-Alun seluas ${area.toFixed(2)} m².`,
        details: { area },
      });
    }
  }
  return violations;
}

export function checkRoadProximity(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const roads = getRoadBoxes(layout.roads);
  const maxDist = layout.rules.maxRoadDistanceMeters;

  for (const lot of layout.lots) {
    if (!lot.solid && lot.type !== 'plot') continue;
    if (lot.type === 'utility' || lot.type === 'rail_crossing') continue;
    if (
      hasExemption(lot, 'road_distance_station_forecourt') ||
      hasExemption(lot, 'road_distance_utility_north_rail') ||
      hasExemption(lot, 'road_distance_jpo')
    ) {
      continue;
    }

    const lb = getLotBox(lot, false);
    let minD = Infinity;
    for (const road of roads) {
      minD = Math.min(minD, boxEdgeDistance(lb, road.asphalt));
    }
    if (minD > maxDist + 1e-4) {
      violations.push({
        id: lot.id,
        rule: 'ruleRoadProximity',
        severity: 'ERROR',
        message: `Objek "${lot.id}" terlalu jauh dari jalan terdekat (${minD.toFixed(2)} m > ${maxDist} m).`,
        details: { distance: minD, maxAllowed: maxDist },
      });
    }
  }
  return violations;
}

export function checkGridAndRotation(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const snap = layout.rules.gridSnapMeters;
  const allowedRots = new Set(layout.rules.allowedRotationsDeg);

  for (const lot of layout.lots) {
    if (lot.type === 'rail_crossing' || lot.category === 'hijau') continue;
    // Cek snap grid 2m kecuali utilitas kecil atau emperan yang sudah grid-2m
    const mx = Math.abs(lot.position.x % snap);
    const mz = Math.abs(lot.position.z % snap);
    if (mx > 1e-4 && Math.abs(mx - snap) > 1e-4) {
      violations.push({
        id: lot.id,
        rule: 'ruleGridAndRotation',
        severity: 'ERROR',
        message: `Posisi X objek "${lot.id}" (${lot.position.x}) tidak snap ke grid ${snap} m.`,
        details: { axis: 'x', value: lot.position.x, gridSnap: snap },
      });
    }
    if (mz > 1e-4 && Math.abs(mz - snap) > 1e-4) {
      violations.push({
        id: lot.id,
        rule: 'ruleGridAndRotation',
        severity: 'ERROR',
        message: `Posisi Z objek "${lot.id}" (${lot.position.z}) tidak snap ke grid ${snap} m.`,
        details: { axis: 'z', value: lot.position.z, gridSnap: snap },
      });
    }
    if (!allowedRots.has(lot.rotDeg)) {
      violations.push({
        id: lot.id,
        rule: 'ruleGridAndRotation',
        severity: 'ERROR',
        message: `Rotasi objek "${lot.id}" (${lot.rotDeg}°) harus kelipatan 90°.`,
        details: { rotDeg: lot.rotDeg },
      });
    }
  }
  return violations;
}

export function checkFacingAndDoorAccess(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const roads = getRoadBoxes(layout.roads);
  const accessW = layout.rules.doorAccessWidthMeters;

  for (const lot of layout.lots) {
    if (lot.type === 'rail_crossing' || lot.category === 'hijau' || lot.id === 'menara_air' || lot.id === 'menara_bts') {
      continue;
    }

    const lb = getLotBox(lot, false);
    const vec = getFacingVector(lot.facing);
    const toDoorX = lot.door.x - lb.cx;
    const toDoorZ = lot.door.z - lb.cz;
    const dot = toDoorX * vec.x + toDoorZ * vec.z;
    if (dot <= 0) {
      violations.push({
        id: lot.id,
        rule: 'ruleFacingAndDoorAccess',
        severity: 'ERROR',
        message: `Titik pintu objek "${lot.id}" (${lot.door.x}, ${lot.door.z}) tidak searah dengan arah hadap "${lot.facing}".`,
      });
    }

    const servedRoads = roads.filter((r) => r.roadId === lot.roadId);
    if (servedRoads.length === 0) {
      violations.push({
        id: lot.id,
        rule: 'ruleFacingAndDoorAccess',
        severity: 'ERROR',
        message: `Jalan tujuan "${lot.roadId}" untuk pintu "${lot.id}" tidak ditemukan.`,
      });
      continue;
    }

    const nearestSeg = servedRoads
      .slice()
      .sort((a, b) => pointToBoxDistance(lot.door.x, lot.door.z, a.asphalt) - pointToBoxDistance(lot.door.x, lot.door.z, b.asphalt))[0];

    // Pastikan sisi hadap benar-benar mengarah menuju jalan yang dilayaninya
    const roadCenterVecX = Math.max(nearestSeg.asphalt.minX, Math.min(nearestSeg.asphalt.maxX, lb.cx)) - lb.cx;
    const roadCenterVecZ = Math.max(nearestSeg.asphalt.minZ, Math.min(nearestSeg.asphalt.maxZ, lb.cz)) - lb.cz;
    if (roadCenterVecX * vec.x + roadCenterVecZ * vec.z <= 0) {
      violations.push({
        id: lot.id,
        targetId: lot.roadId,
        rule: 'ruleFacingAndDoorAccess',
        severity: 'ERROR',
        message: `Bangunan "${lot.id}" menghadap "${lot.facing}" tetapi jalan "${lot.roadId}" tidak berada di arah tersebut.`,
      });
    }

    const accessBox = getDoorAccessSegment(lot, roads, accessW);
    if (accessBox) {
      for (const other of layout.lots) {
        if (other.id === lot.id || !other.solid) continue;
        const ob = getLotBox(other, true);
        if (boxIntersectionArea(accessBox, ob) > 0.05) {
          violations.push({
            id: lot.id,
            targetId: other.id,
            rule: 'ruleFacingAndDoorAccess',
            severity: 'ERROR',
            message: `Jalur akses pintu "${lot.id}" (${accessW} m) ke jalan "${lot.roadId}" terhalang oleh "${other.id}".`,
            details: { blockerId: other.id, roadId: lot.roadId },
          });
        }
      }
    }
  }
  return violations;
}

export function checkIndustrialBuffer(layout: CicalengkaLayout): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const required = layout.rules.industrialBufferMeters;
  const industrialLots = layout.lots.filter(isIndustrialLot);
  const residentialLots = layout.lots.filter(isResidentialLot);

  for (const ind of industrialLots) {
    const ib = getLotBox(ind, false);
    for (const res of residentialLots) {
      const rb = getLotBox(res, false);
      const dist = boxEdgeDistance(ib, rb);
      if (dist < required - 1e-4) {
        violations.push({
          id: ind.id,
          targetId: res.id,
          rule: 'ruleIndustrialBuffer',
          severity: 'ERROR',
          message: `Zona industri "${ind.id}" berjarak ${dist.toFixed(2)} m dari hunian "${res.id}" (< buffer minimal ${required} m).`,
          details: { distance: dist, required, residentialId: res.id },
        });
      }
    }
  }
  return violations;
}

export function checkTreeClearance(
  layout: CicalengkaLayout,
  plantsInput?: { trees: GeneratedPlant[]; palms: GeneratedPlant[] }
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const plants = plantsInput || generateDeterministicPlants(layout);
  const roads = getRoadBoxes(layout.roads);
  const rails = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);
  const doorPaths = layout.lots
    .map((l) => getDoorAccessSegment(l, roads, layout.rules.doorAccessWidthMeters))
    .filter((b): b is Box2D => Boolean(b));

  const allPlants = [...plants.trees, ...plants.palms];
  for (const plant of allPlants) {
    const r = plant.kind === 'palm' ? layout.plants.palmRadius : layout.plants.treeRadius;

    for (const road of roads) {
      const distRoad = pointToBoxDistance(plant.x, plant.z, road.asphalt);
      if (distRoad <= 0.05) {
        violations.push({
          id: plant.id,
          targetId: road.roadId,
          rule: 'ruleTreeClearance',
          severity: 'ERROR',
          message: `Pohon "${plant.id}" berada di atas aspal jalan "${road.roadId}".`,
        });
      } else if (distRoad < layout.rules.treeRoadClearanceMeters - 1e-4) {
        violations.push({
          id: plant.id,
          targetId: road.roadId,
          rule: 'ruleTreeClearance',
          severity: 'ERROR',
          message: `Pohon "${plant.id}" terlalu dekat ke jalan "${road.roadId}" (${distRoad.toFixed(2)} m < ${layout.rules.treeRoadClearanceMeters} m).`,
        });
      }
      for (const sw of road.sidewalks) {
        if (pointInBox(plant.x, plant.z, sw, layout.rules.treeSidewalkClearanceMeters - 0.01)) {
          violations.push({
            id: plant.id,
            targetId: `${road.roadId}_sidewalk`,
            rule: 'ruleTreeClearance',
            severity: 'ERROR',
            message: `Pohon "${plant.id}" berada di trotoar "${road.roadId}".`,
          });
        }
      }
    }

    for (const rail of rails) {
      if (pointToBoxDistance(plant.x, plant.z, rail.ballast) < layout.rules.railSafeMeters - 1e-4) {
        violations.push({
          id: plant.id,
          targetId: rail.railId,
          rule: 'ruleTreeClearance',
          severity: 'ERROR',
          message: `Pohon "${plant.id}" berada di zona aman rel "${rail.railId}".`,
        });
      }
    }

    for (const lot of layout.lots) {
      const lb = getLotBox(lot, true);
      if (lot.type === 'plot' && pointToBoxDistance(plant.x, plant.z, lb) < 0.2) {
        violations.push({
          id: plant.id,
          targetId: lot.id,
          rule: 'ruleTreeClearance',
          severity: 'ERROR',
          message: `Pohon "${plant.id}" berada di dalam kavling tanah "${lot.id}".`,
        });
      } else if (lot.solid && pointToBoxDistance(plant.x, plant.z, lb) < r * 0.5) {
        violations.push({
          id: plant.id,
          targetId: lot.id,
          rule: 'ruleTreeClearance',
          severity: 'ERROR',
          message: `Pohon "${plant.id}" menabrak bangunan "${lot.id}".`,
        });
      }
    }

    for (const dp of doorPaths) {
      if (pointInBox(plant.x, plant.z, dp, 0.2)) {
        violations.push({
          id: plant.id,
          rule: 'ruleTreeClearance',
          severity: 'ERROR',
          message: `Pohon "${plant.id}" menghalangi jalur akses pintu bangunan.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Pengujian konektivitas grid A* dari titik spawn ke seluruh pintu bangunan, ATM,
 * loket tiket, dan anchor interaksi melalui jalan, trotoar, pelataran stasiun, dan plaza.
 */
export function checkGridConnectivityAStar(layout: CicalengkaLayout): {
  result: ConnectivityResult;
  violations: ValidationViolation[];
} {
  const half = layout.rules.worldHalfSize;
  const step = Math.max(0.5, layout.rules.connectivityGridStepMeters);
  const cols = Math.floor((half * 2) / step) + 1;
  const rows = cols;

  const toIdx = (gx: number, gz: number) => gz * cols + gx;
  const toGrid = (v: number) => Math.max(0, Math.min(cols - 1, Math.round((v + half) / step)));
  const toWorld = (g: number) => -half + g * step;

  const walkable = new Uint8Array(cols * rows);
  const roads = getRoadBoxes(layout.roads);
  const rails = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);

  // Pelataran stasiun yang menghubungkan spawn, loket, atm_stasiun, emperan_stasiun ke jalan_stasiun
  const stationForecourt = makeBoxFromBounds(-22, 12, -51.5, -42.5);
  const plazaBox = expandBox(getPlazaBox(layout), 2.8); // tersambung dengan trotoar jalan sekeliling Alun-Alun

  const doorPaths = layout.lots
    .map((l) => ({
      lot: l,
      box: getDoorAccessSegment(l, roads, Math.max(2.0, layout.rules.doorAccessWidthMeters)),
    }))
    .filter((entry): entry is { lot: LotDef; box: Box2D } => Boolean(entry.box));

  // Tandai seluruh koridor jalan + trotoar + pelataran stasiun + perlintasan rel + plaza + akses pintu sebagai walkable
  const markBoxWalkable = (box: Box2D) => {
    const minGx = toGrid(box.minX);
    const maxGx = toGrid(box.maxX);
    const minGz = toGrid(box.minZ);
    const maxGz = toGrid(box.maxZ);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        walkable[toIdx(gx, gz)] = 1;
      }
    }
  };

  for (const r of roads) markBoxWalkable(r.corridor);
  for (const rail of rails) {
    markBoxWalkable(rail.crossing);
    if (rail.jpoZone) markBoxWalkable(expandBox(rail.jpoZone, 1.0));
  }
  markBoxWalkable(stationForecourt);
  markBoxWalkable(plazaBox);
  for (const dp of doorPaths) {
    markBoxWalkable(expandBox(dp.box, 0.5));
    markBoxWalkable(makeBoxFromCenter(dp.lot.door.x, dp.lot.door.z, 2.2, 2.2));
  }

  // Blokir seluruh bangunan solid + rel di luar perlintasan
  const markBoxBlocked = (box: Box2D) => {
    const minGx = toGrid(box.minX);
    const maxGx = toGrid(box.maxX);
    const minGz = toGrid(box.minZ);
    const maxGz = toGrid(box.maxZ);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        walkable[toIdx(gx, gz)] = 0;
      }
    }
  };

  const agentPad = 0.2;
  for (const lot of layout.lots) {
    if (!lot.solid) continue;
    markBoxBlocked(expandBox(getLotBox(lot, false), agentPad));
  }
  // Fitur solid di dalam Alun-Alun (batang beringin & pendopo)
  for (const feat of layout.plaza.features) {
    if (feat.kind === 'beringin' && feat.radius) {
      markBoxBlocked(makeBoxFromCenter(feat.x, feat.z, feat.radius * 1.4, feat.radius * 1.4));
    }
  }
  // Rel kereta di luar crossing tidak bisa dilewati
  for (const rail of rails) {
    const minGx = toGrid(rail.ballast.minX);
    const maxGx = toGrid(rail.ballast.maxX);
    const minGz = toGrid(rail.ballast.minZ);
    const maxGz = toGrid(rail.ballast.maxZ);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const wx = toWorld(gx);
        const wz = toWorld(gz);
        const onCrossing = pointInBox(wx, wz, rail.crossing, 0.4);
        const onJpo = rail.jpoZone ? pointInBox(wx, wz, rail.jpoZone, 0.4) : false;
        if (!onCrossing && !onJpo) {
          walkable[toIdx(gx, gz)] = 0;
        }
      }
    }
  }

  // Pastikan titik spawn dan pintu bangunan terbuka di grid luar bangunan
  const openPoint = (p: Vec2) => {
    const gx = toGrid(p.x);
    const gz = toGrid(p.z);
    walkable[toIdx(gx, gz)] = 1;
  };
  openPoint(layout.anchors.stationSpawn);

  const targets: Array<{ id: string; point: Vec2 }> = [];
  for (const lot of layout.lots) {
    if (lot.type === 'utility' && lot.id.startsWith('menara_')) continue;
    if (lot.type === 'rail_crossing' || lot.category === 'hijau') continue;
    openPoint(lot.door);
    targets.push({ id: lot.id, point: lot.door });
  }
  const loketLot = layout.lots.find((l) => l.id === 'loket_tiket');
  targets.push({
    id: 'anchor_ticket_booth',
    point: loketLot ? loketLot.door : layout.anchors.ticketBooth.cicalengka,
  });
  targets.push({ id: 'anchor_hospital', point: layout.anchors.hospitalPos });
  targets.push({ id: 'anchor_polsek_release', point: layout.anchors.policeStation.releaseSpawn });
  targets.push({
    id: 'anchor_alun_alun',
    point: {
      x: layout.anchors.alunAlunCenter.x,
      z: layout.plaza.center.z - layout.plaza.grassDepth / 2 + 1.0,
    },
  });
  for (const atm of layout.anchors.atms) {
    const lotAtm = layout.lots.find((l) => l.id === atm.id);
    targets.push({ id: `anchor_${atm.id}`, point: lotAtm ? lotAtm.door : { x: atm.x, z: atm.z } });
  }
  for (const t of targets) openPoint(t.point);

  // BFS/A* dari spawn untuk menandai semua sel yang terhubung secara cepat, lalu A* per target yang gagal atau untuk verifikasi jarak
  const startGx = toGrid(layout.anchors.stationSpawn.x);
  const startGz = toGrid(layout.anchors.stationSpawn.z);

  const runAStar = (goalGx: number, goalGz: number): boolean => {
    const total = cols * rows;
    const gScore = new Float32Array(total).fill(Infinity);
    const closed = new Uint8Array(total);
    const startIdx = toIdx(startGx, startGz);
    const goalIdx = toIdx(goalGx, goalGz);
    if (startIdx === goalIdx) return true;

    const heap: Array<{ idx: number; f: number }> = [{ idx: startIdx, f: 0 }];
    gScore[startIdx] = 0;

    const dirs = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, 1.414],
      [-1, 1, 1.414],
      [1, -1, 1.414],
      [-1, -1, 1.414],
    ];

    const pushHeap = (item: { idx: number; f: number }) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].f <= heap[i].f) break;
        const tmp = heap[p];
        heap[p] = heap[i];
        heap[i] = tmp;
        i = p;
      }
    };

    const popHeap = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let smallest = i;
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          if (l < heap.length && heap[l].f < heap[smallest].f) smallest = l;
          if (r < heap.length && heap[r].f < heap[smallest].f) smallest = r;
          if (smallest === i) break;
          const tmp = heap[i];
          heap[i] = heap[smallest];
          heap[smallest] = tmp;
          i = smallest;
        }
      }
      return top;
    };

    while (heap.length > 0) {
      const curr = popHeap();
      if (curr.idx === goalIdx) return true;
      if (closed[curr.idx]) continue;
      closed[curr.idx] = 1;

      const cx = curr.idx % cols;
      const cz = Math.floor(curr.idx / cols);

      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;
        const nIdx = toIdx(nx, nz);
        if (closed[nIdx] || walkable[nIdx] === 0) continue;
        // Cegah corner cutting menembus sudut gedung
        if (dx !== 0 && dz !== 0) {
          if (walkable[toIdx(cx + dx, cz)] === 0 || walkable[toIdx(cx, cz + dz)] === 0) continue;
        }
        const tentativeG = gScore[curr.idx] + cost;
        if (tentativeG < gScore[nIdx]) {
          gScore[nIdx] = tentativeG;
          const h = Math.hypot(goalGx - nx, goalGz - nz);
          pushHeap({ idx: nIdx, f: tentativeG + h });
        }
      }
    }
    return false;
  };

  // Flood-fill 1x dari spawn dulu untuk efisiensi, lalu konfirmasi unreachable dengan A*
  const flood = new Uint8Array(cols * rows);
  const queue: number[] = [toIdx(startGx, startGz)];
  flood[queue[0]] = 1;
  let head = 0;
  const floodDirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % cols;
    const cz = Math.floor(curr / cols);
    for (const [dx, dz] of floodDirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;
      const nIdx = toIdx(nx, nz);
      if (flood[nIdx] || walkable[nIdx] === 0) continue;
      flood[nIdx] = 1;
      queue.push(nIdx);
    }
  }

  const reachableIds: string[] = [];
  const unreachableIds: Array<{ id: string; target: Vec2; reason: string }> = [];
  const violations: ValidationViolation[] = [];

  for (const t of targets) {
    const gx = toGrid(t.point.x);
    const gz = toGrid(t.point.z);
    const ok = flood[toIdx(gx, gz)] === 1 || runAStar(gx, gz);
    if (ok) {
      reachableIds.push(t.id);
    } else {
      const reason = `Tidak ada jalur jalan/trotoar yang terhubung dari spawn (${layout.anchors.stationSpawn.x}, ${layout.anchors.stationSpawn.z}) ke "${t.id}" di (${t.point.x}, ${t.point.z}).`;
      unreachableIds.push({ id: t.id, target: t.point, reason });
      violations.push({
        id: t.id,
        rule: 'ruleGridConnectivityAStar',
        severity: 'ERROR',
        message: reason,
        details: { target: t.point },
      });
    }
  }

  return {
    result: {
      reachableIds,
      unreachableIds,
      checkedTargetsCount: targets.length,
      gridStepMeters: step,
    },
    violations,
  };
}

/**
 * Menghitung bounding box Rapier collider di ruang dunia (mempertimbangkan rotDeg & collider offset).
 */
export function getLotColliderWorldBox(lot: LotDef): Box2D {
  const colW = lot.collider?.width ?? lot.footprint.width;
  const colD = lot.collider?.depth ?? lot.footprint.depth;
  const offX = lot.collider?.offsetX ?? lot.footprintOffset?.x ?? 0;
  const offZ = lot.collider?.offsetZ ?? lot.footprintOffset?.z ?? 0;
  const norm = ((lot.rotDeg % 360) + 360) % 360;
  const swapped = norm === 90 || norm === 270;
  const w = swapped ? colD : colW;
  const d = swapped ? colW : colD;
  const worldOff = rotateLocalOffset(offX, offZ, lot.rotDeg);
  return makeBoxFromCenter(lot.position.x + worldOff.x, lot.position.z + worldOff.z, w, d);
}

export interface SafeSpawnOptions {
  isJailed?: boolean;
  layout?: CicalengkaLayout;
  clearanceMeters?: number;
}

export interface SafeSpawnResult {
  position: { x: number; y: number; z: number; rotY?: number };
  relocated: boolean;
  reason?: string;
}

/**
 * Memastikan posisi spawn/tersimpan pemain tidak berada di dalam collider solid bangunan,
 * beringin/pendopo alun-alun, rel kereta (non-crossing), atau di luar batas kota.
 * Jika tertimpa, fungsi memindahkan pemain ke titik aman terdekat (jalan/trotoar/plaza/pintu).
 */
export function ensureSafeSpawnPosition(
  pos: { x: number; y?: number; z: number; rotY?: number } | null | undefined,
  layout: CicalengkaLayout,
  opts: Omit<SafeSpawnOptions, 'layout'> = {}
): SafeSpawnResult {
  const fallback = layout.anchors.stationSpawn;
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) {
    return {
      position: { x: fallback.x, y: fallback.y, z: fallback.z, rotY: fallback.rotY },
      relocated: true,
      reason: 'invalid_coordinates',
    };
  }

  const jailCenter = layout.anchors.policeStation.jailCenter;
  const jailRadius = layout.anchors.policeStation.jailRadius;
  if (opts.isJailed) {
    const distToCell = Math.hypot(pos.x - jailCenter.x, pos.z - jailCenter.z);
    if (distToCell <= jailRadius - 0.8) {
      return {
        position: { x: pos.x, y: pos.y ?? 1.0, z: pos.z, rotY: pos.rotY },
        relocated: false,
      };
    }
    return {
      position: { x: jailCenter.x, y: jailCenter.y, z: jailCenter.z, rotY: pos.rotY },
      relocated: true,
      reason: 'jailed_relocate_to_cell',
    };
  }

  const clearance = opts.clearanceMeters ?? 0.65;
  const worldLimit = layout.rules.worldHalfSize - 2.5;
  const roads = getRoadBoxes(layout.roads);
  const rails = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);

  // Bangun daftar kotak solid yang tidak boleh ditembus pemain
  const solidBoxes: Array<{ id: string; box: Box2D }> = [];
  for (const lot of layout.lots) {
    if (!lot.solid) continue;
    // Polsek memiliki sel hollow di bagian belakang; gunakan kotak gabungan fasad/sel saat non-jailed
    solidBoxes.push({ id: lot.id, box: getLotColliderWorldBox(lot) });
  }
  for (const feat of layout.plaza.features) {
    if (feat.kind === 'beringin') {
      const r = (feat.radius ?? 3.3) + 0.3;
      solidBoxes.push({ id: feat.id, box: makeBoxFromCenter(feat.x, feat.z, r * 2, r * 2) });
    } else if (feat.kind === 'pendopo') {
      solidBoxes.push({
        id: feat.id,
        box: makeBoxFromCenter(feat.x, feat.z, feat.width ?? 4.4, feat.depth ?? 4.4),
      });
    }
  }

  const isSpotBlocked = (x: number, z: number): string | null => {
    if (Math.abs(x) > worldLimit || Math.abs(z) > worldLimit) {
      return 'outside_world_bounds';
    }
    for (const s of solidBoxes) {
      if (pointInBox(x, z, s.box, clearance)) {
        return `inside_solid:${s.id}`;
      }
    }
    for (const rail of rails) {
      if (pointInBox(x, z, rail.ballast, 0.35)) {
        const onCrossing = pointInBox(x, z, rail.crossing, 0.2);
        const onJpo = rail.jpoZone ? pointInBox(x, z, rail.jpoZone, 0.2) : false;
        if (!onCrossing && !onJpo) {
          return `on_rail:${rail.railId}`;
        }
      }
    }
    return null;
  };

  const blocker = isSpotBlocked(pos.x, pos.z);
  if (!blocker) {
    return {
      position: { x: pos.x, y: pos.y ?? 1.0, z: pos.z, rotY: pos.rotY },
      relocated: false,
    };
  }

  // Cari titik aman terdekat dari: proyeksi ke jalan terdekat, trotoar, pintu lot, dan anchor aman
  const candidates: Vec2[] = [];
  for (const road of roads) {
    const clampedX = Math.max(road.asphalt.minX, Math.min(road.asphalt.maxX, pos.x));
    const clampedZ = Math.max(road.asphalt.minZ, Math.min(road.asphalt.maxZ, pos.z));
    candidates.push({ x: clampedX, z: clampedZ });
    for (const sw of road.sidewalks) {
      candidates.push({
        x: Math.max(sw.minX, Math.min(sw.maxX, pos.x)),
        z: Math.max(sw.minZ, Math.min(sw.maxZ, pos.z)),
      });
    }
  }
  for (const lot of layout.lots) {
    candidates.push(lot.door);
  }
  candidates.push(fallback);
  candidates.push({
    x: layout.plaza.center.x,
    z: layout.plaza.center.z - layout.plaza.grassDepth / 2 + 1.0,
  });

  // Tambahkan ring radial di sekitar posisi tersimpan agar perpindahan sependek mungkin
  for (const radius of [2, 4, 6, 8, 11]) {
    for (let deg = 0; deg < 360; deg += 45) {
      const rad = (deg * Math.PI) / 180;
      candidates.push({
        x: Number((pos.x + Math.cos(rad) * radius).toFixed(2)),
        z: Number((pos.z + Math.sin(rad) * radius).toFixed(2)),
      });
    }
  }

  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (isSpotBlocked(c.x, c.z)) continue;
    const d = Math.hypot(c.x - pos.x, c.z - pos.z);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }

  const target = best ?? { x: fallback.x, z: fallback.z };
  return {
    position: {
      x: Number(target.x.toFixed(2)),
      y: Math.max(0.9, Number(pos.y ?? fallback.y ?? 1.0)),
      z: Number(target.z.toFixed(2)),
      rotY: pos.rotY ?? fallback.rotY,
    },
    relocated: true,
    reason: blocker,
  };
}

