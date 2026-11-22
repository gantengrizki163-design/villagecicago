import type { ZoneId } from '../../types/game';
import { LAYOUT_DATA } from '../layout/layoutHelpers';
import {
  type Box2D,
  expandBox,
  getLotBox,
  getPlazaBox,
  getRailBoxes,
  getRoadBoxes,
  makeBoxFromBounds,
  pointInBox,
} from '../layout/rules';
import { NAVIGATION_TUNING } from './navigationConfig';
import type { WorldPoint2D } from './registry';

const GRID_STEP = NAVIGATION_TUNING.ASTAR_GRID_STEP_METERS;
const GRID_HALF = Math.floor((LAYOUT_DATA.rules.worldHalfSize - 2) / GRID_STEP) * GRID_STEP; // 74
const GRID_DIM = Math.floor((GRID_HALF * 2) / GRID_STEP) + 1;

// Pelataran Stasiun Cicalengka yang aman dilalui pejalan kaki
const STATION_FORECOURT_BOX: Box2D = makeBoxFromBounds(-22, 12, -52, -42);

interface NavGridCache {
  blocked: Uint8Array;
  cost: Float32Array;
}

let cachedCicalengkaGrid: NavGridCache | null = null;

function toGridIndex(coord: number): number {
  const clamped = Math.max(-GRID_HALF, Math.min(GRID_HALF, coord));
  return Math.round((clamped + GRID_HALF) / GRID_STEP);
}

function toWorldCoord(idx: number): number {
  return -GRID_HALF + idx * GRID_STEP;
}

function getCicalengkaNavGrid(): NavGridCache {
  if (cachedCicalengkaGrid) return cachedCicalengkaGrid;

  const total = GRID_DIM * GRID_DIM;
  const blocked = new Uint8Array(total);
  const cost = new Float32Array(total);

  const roads = getRoadBoxes(LAYOUT_DATA.roads);
  const rails = getRailBoxes(LAYOUT_DATA.rails, LAYOUT_DATA.rules.railSafeMeters, LAYOUT_DATA.lots);
  const plaza = getPlazaBox(LAYOUT_DATA);

  const solidBoxes: Box2D[] = [];
  for (const lot of LAYOUT_DATA.lots) {
    if (lot.type === 'rail_crossing') continue;
    if (lot.solid !== false) {
      solidBoxes.push(expandBox(getLotBox(lot, false), 0.35));
    }
  }

  for (let gz = 0; gz < GRID_DIM; gz++) {
    const z = toWorldCoord(gz);
    for (let gx = 0; gx < GRID_DIM; gx++) {
      const x = toWorldCoord(gx);
      const cellIdx = gz * GRID_DIM + gx;

      // Blokir bangunan solid
      let isBlocked = false;
      for (const sb of solidBoxes) {
        if (pointInBox(x, z, sb, 0)) {
          isBlocked = true;
          break;
        }
      }

      // Blokir rel kereta kecuali di perlintasan sebidang atau JPO
      if (!isBlocked) {
        for (const rail of rails) {
          const onCrossing = pointInBox(x, z, rail.crossing, 0.5);
          const onJpo = rail.jpoZone ? pointInBox(x, z, rail.jpoZone, 0.5) : false;
          if (!onCrossing && !onJpo && pointInBox(x, z, rail.ballast, 0.9)) {
            isBlocked = true;
            break;
          }
        }
      }

      if (isBlocked) {
        blocked[cellIdx] = 1;
        cost[cellIdx] = 9999;
        continue;
      }

      // Preferensi rute: jalan aspal / crossing / plaza / trotoar / pelataran stasiun
      let onPaved = pointInBox(x, z, plaza, 0.2) || pointInBox(x, z, STATION_FORECOURT_BOX, 0.2);
      if (!onPaved) {
        for (const r of roads) {
          if (pointInBox(x, z, r.corridor, 0.3)) {
            onPaved = true;
            break;
          }
        }
      }
      if (!onPaved) {
        for (const rail of rails) {
          if (pointInBox(x, z, rail.crossing, 0.5)) {
            onPaved = true;
            break;
          }
        }
      }

      cost[cellIdx] = onPaved ? 1.0 : 2.8;
    }
  }

  cachedCicalengkaGrid = { blocked, cost };
  return cachedCicalengkaGrid;
}

function findNearestWalkableCell(
  gx0: number,
  gz0: number,
  blocked: Uint8Array
): { gx: number; gz: number } | null {
  if (gx0 >= 0 && gx0 < GRID_DIM && gz0 >= 0 && gz0 < GRID_DIM && !blocked[gz0 * GRID_DIM + gx0]) {
    return { gx: gx0, gz: gz0 };
  }
  for (let r = 1; r <= 6; r++) {
    let best: { gx: number; gz: number; d: number } | null = null;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const gx = gx0 + dx;
        const gz = gz0 + dz;
        if (gx < 0 || gx >= GRID_DIM || gz < 0 || gz >= GRID_DIM) continue;
        if (blocked[gz * GRID_DIM + gx]) continue;
        const d = dx * dx + dz * dz;
        if (!best || d < best.d) best = { gx, gz, d };
      }
    }
    if (best) return { gx: best.gx, gz: best.gz };
  }
  return null;
}

function hasLineOfSight(
  a: WorldPoint2D,
  b: WorldPoint2D,
  blocked: Uint8Array
): boolean {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  if (dist < 0.5) return true;
  const steps = Math.ceil(dist / (GRID_STEP * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const gx = toGridIndex(x);
    const gz = toGridIndex(z);
    if (blocked[gz * GRID_DIM + gx]) return false;
  }
  return true;
}

function smoothWaypoints(raw: WorldPoint2D[], blocked: Uint8Array): WorldPoint2D[] {
  if (raw.length <= 2) return raw;
  const out: WorldPoint2D[] = [raw[0]];
  let anchorIdx = 0;

  while (anchorIdx < raw.length - 1) {
    let farthestIdx = anchorIdx + 1;
    for (let probe = raw.length - 1; probe > anchorIdx + 1; probe--) {
      if (hasLineOfSight(raw[anchorIdx], raw[probe], blocked)) {
        farthestIdx = probe;
        break;
      }
    }
    out.push(raw[farthestIdx]);
    anchorIdx = farthestIdx;
  }

  return out;
}

const DIRS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Menghitung daftar titik jalan (waypoints) dari posisi pemain menuju tujuan menggunakan A*
 * mengikuti koridor jalan, trotoar, alun-alun, dan perlintasan rel. Fallback ke garis lurus
 * di zona luar Cicalengka atau bila grid tidak terjangkau.
 */
export function findNavigationPath(
  start: WorldPoint2D,
  goal: WorldPoint2D,
  zone: ZoneId = 'cicalengka'
): WorldPoint2D[] {
  const directDist = Math.hypot(goal.x - start.x, goal.z - start.z);
  if (directDist <= 2.5 || zone !== 'cicalengka') {
    return [{ ...start }, { ...goal }];
  }

  const { blocked, cost } = getCicalengkaNavGrid();
  const startCell = findNearestWalkableCell(toGridIndex(start.x), toGridIndex(start.z), blocked);
  const goalCell = findNearestWalkableCell(toGridIndex(goal.x), toGridIndex(goal.z), blocked);

  if (!startCell || !goalCell) {
    return [{ ...start }, { ...goal }];
  }

  const startKey = startCell.gz * GRID_DIM + startCell.gx;
  const goalKey = goalCell.gz * GRID_DIM + goalCell.gx;

  if (startKey === goalKey) {
    return [{ ...start }, { ...goal }];
  }

  const total = GRID_DIM * GRID_DIM;
  const gScore = new Float32Array(total).fill(Infinity);
  const fScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);

  const open: number[] = [startKey];
  gScore[startKey] = 0;
  fScore[startKey] = Math.hypot(goalCell.gx - startCell.gx, goalCell.gz - startCell.gz);

  let found = false;
  let iterations = 0;
  const maxIterations = total * 2;

  while (open.length > 0 && iterations < maxIterations) {
    iterations++;
    let bestOpenIdx = 0;
    let bestF = fScore[open[0]];
    for (let i = 1; i < open.length; i++) {
      const f = fScore[open[i]];
      if (f < bestF) {
        bestF = f;
        bestOpenIdx = i;
      }
    }

    const current = open[bestOpenIdx];
    open[bestOpenIdx] = open[open.length - 1];
    open.pop();

    if (current === goalKey) {
      found = true;
      break;
    }

    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % GRID_DIM;
    const cz = Math.floor(current / GRID_DIM);

    for (const [dx, dz, stepDist] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= GRID_DIM || nz < 0 || nz >= GRID_DIM) continue;
      const nKey = nz * GRID_DIM + nx;
      if (closed[nKey] || blocked[nKey]) continue;

      // Cegah diagonal memotong sudut bangunan
      if (dx !== 0 && dz !== 0) {
        if (blocked[cz * GRID_DIM + nx] || blocked[nz * GRID_DIM + cx]) {
          continue;
        }
      }

      const tentativeG = gScore[current] + stepDist * cost[nKey];
      if (tentativeG < gScore[nKey]) {
        cameFrom[nKey] = current;
        gScore[nKey] = tentativeG;
        fScore[nKey] = tentativeG + Math.hypot(goalCell.gx - nx, goalCell.gz - nz);
        open.push(nKey);
      }
    }
  }

  if (!found) {
    return [{ ...start }, { ...goal }];
  }

  const gridPoints: WorldPoint2D[] = [];
  let cursor = goalKey;
  while (cursor !== -1) {
    const gx = cursor % GRID_DIM;
    const gz = Math.floor(cursor / GRID_DIM);
    gridPoints.push({ x: toWorldCoord(gx), z: toWorldCoord(gz) });
    if (cursor === startKey) break;
    cursor = cameFrom[cursor];
  }
  gridPoints.reverse();

  const fullRaw: WorldPoint2D[] = [{ ...start }, ...gridPoints, { ...goal }];
  // Hapus titik duplikat terlalu dekat (< 0.5m)
  const deduped: WorldPoint2D[] = [];
  for (const pt of fullRaw) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.z - prev.z) >= 0.5) {
      deduped.push(pt);
    }
  }
  if (deduped.length < 2) {
    return [{ ...start }, { ...goal }];
  }

  return smoothWaypoints(deduped, blocked);
}

export function computePathLengthMeters(waypoints: WorldPoint2D[]): number {
  let sum = 0;
  for (let i = 1; i < waypoints.length; i++) {
    sum += Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].z - waypoints[i - 1].z);
  }
  return sum;
}

export function estimateWalkTimeSeconds(
  waypoints: WorldPoint2D[],
  speedMps = NAVIGATION_TUNING.WALK_SPEED_MPS
): number {
  const dist = computePathLengthMeters(waypoints);
  return Math.max(1, Math.round(dist / Math.max(1, speedMps)));
}
