/**
 * Audit Tata Letak Kota Cicalengka (berbasis cicalengka.layout.json & rules.ts — nol salinan koordinat).
 * Jalankan:
 *   npx tsx tools/audit-layout.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import rawLayout from '../client/src/world3d/layout/cicalengka.layout.json';
import {
  boxEdgeDistance,
  boxIntersectionArea,
  checkBuildingOverlap,
  checkGridConnectivityAStar,
  checkIndustrialBuffer,
  checkPlazaSolidFree,
  checkRoadOverlap,
  checkRoadProximity,
  checkRoadSetback,
  checkTreeClearance,
  generateDeterministicPlants,
  generateDeterministicProps,
  getLotBox,
  getRailBoxes,
  getRoadBoxes,
  hasExemption,
} from '../client/src/world3d/layout/rules';
import type { CicalengkaLayout } from '../client/src/world3d/layout/types';

export interface AuditSummary {
  errors: number;
  warnings: number;
  roadOverlaps: number;
  buildingOverlaps: number;
  treesOnRoad: number;
  treesInBuilding: number;
  treesInPlot: number;
  treesOnSidewalk: number;
  buildingsInPlaza: number;
  buildingsFarFromRoad: number;
  buildingsOnRail: number;
  unreachableTargets: number;
  markdown: string;
}

export function runLayoutAudit(
  layout: CicalengkaLayout = rawLayout as unknown as CicalengkaLayout
): AuditSummary {
  const plants = generateDeterministicPlants(layout);
  const props = generateDeterministicProps(layout);

  const roadOverlaps = checkRoadOverlap(layout);
  const roadSetbacks = checkRoadSetback(layout);
  const buildingOverlaps = checkBuildingOverlap(layout);
  const plazaIntrusions = checkPlazaSolidFree(layout);
  const farFromRoad = checkRoadProximity(layout);
  const industrialBuffer = checkIndustrialBuffer(layout);
  const treeViolations = checkTreeClearance(layout, plants);
  const connectivity = checkGridConnectivityAStar(layout);

  const roads = getRoadBoxes(layout.roads);
  const rails = getRailBoxes(layout.rails, layout.rules.railSafeMeters, layout.lots);

  // Cek overlap langsung dengan rel (mengecualikan stasiun-rel sebagai peron yang disengaja)
  const buildingsOnRail: Array<{ id: string; area: number; railId: string }> = [];
  for (const lot of layout.lots) {
    if (!lot.solid) continue;
    if (hasExemption(lot, 'rail_buffer')) continue;
    const lb = getLotBox(lot, false);
    for (const rail of rails) {
      const area = boxIntersectionArea(lb, rail.ballast);
      if (area > 0.05) {
        buildingsOnRail.push({ id: lot.id, area, railId: rail.railId });
      }
    }
  }

  const treesOnRoad = treeViolations.filter((v) => v.message.includes('aspal') || v.message.includes('terlalu dekat ke jalan'));
  const treesOnSidewalk = treeViolations.filter((v) => v.message.includes('trotoar'));
  const treesInBuilding = treeViolations.filter((v) => v.message.includes('bangunan'));
  const treesInPlot = treeViolations.filter((v) => v.message.includes('kavling'));

  // Peringatan non-fatal (misal emperan di trotoar)
  const warningsList: string[] = [];
  for (const lot of layout.lots) {
    if (hasExemption(lot, 'road_setback_sidewalk_stall')) {
      const lb = getLotBox(lot, false);
      const minD = Math.min(...roads.map((r) => boxEdgeDistance(lb, r.asphalt)));
      warningsList.push(`\`${lot.id}\` berada di tepi trotoar (${minD.toFixed(2)} m dari aspal; dikecualikan sebagai emperan).`);
    }
    if (hasExemption(lot, 'rail_buffer') && lot.id === 'stasiun') {
      warningsList.push('`stasiun` berbatasan langsung dengan `rel_ganda` (dikecualikan sebagai peron stasiun aktif).');
    }
  }

  const totalErrors =
    roadOverlaps.length +
    roadSetbacks.length +
    buildingOverlaps.length +
    plazaIntrusions.length +
    farFromRoad.length +
    industrialBuffer.length +
    treeViolations.length +
    buildingsOnRail.length +
    connectivity.violations.length;

  const lines: string[] = [
    '# AUDIT TATA LETAK KOTA CICALENGKA',
    '',
    `Sumber data: \`client/src/world3d/layout/cicalengka.layout.json\` (${layout.lots.length} lot/bangunan/kavling, ${plants.trees.length} pohon + ${plants.palms.length} palem, ${props.lamps.length} lampu jalan, ${props.fences.length} pagar).`,
    '',
    `Total: **${totalErrors} ERROR**, **${warningsList.length} WARN**.`,
    `Konektivitas A*: **${connectivity.result.reachableIds.length}/${connectivity.result.checkedTargetsCount}** target terjangkau dari spawn melalui jalan/trotoar.`,
    '',
    '| Kategori Pemeriksaan | Jumlah ERROR |',
    '|---|---|',
    `| Bangunan menimpa jalan | ${roadOverlaps.length} |`,
    `| Bangunan melanggar setback jalan (< ${layout.rules.roadSetbackMeters} m) | ${roadSetbacks.length} |`,
    `| Bangunan / kavling tumpang tindih | ${buildingOverlaps.length} |`,
    `| Bangunan di dalam Alun-Alun | ${plazaIntrusions.length} |`,
    `| Bangunan non-stasiun menimpa rel / buffer | ${buildingsOnRail.length} |`,
    `| Bangunan jauh dari jalan (> ${layout.rules.maxRoadDistanceMeters} m) | ${farFromRoad.length} |`,
    `| Buffer industri ke hunian (< ${layout.rules.industrialBufferMeters} m) | ${industrialBuffer.length} |`,
    `| Pohon di jalan / terlalu dekat aspal | ${treesOnRoad.length} |`,
    `| Pohon di trotoar | ${treesOnSidewalk.length} |`,
    `| Pohon di dalam bangunan / jalur pintu | ${treesInBuilding.length} |`,
    `| Pohon di dalam kavling tanah | ${treesInPlot.length} |`,
    `| Target gagal dijangkau A* dari spawn | ${connectivity.violations.length} |`,
    '',
  ];

  if (warningsList.length > 0) {
    lines.push('## Catatan Pengecualian (WARN / Disengaja)');
    for (const w of warningsList) lines.push(`- ${w}`);
    lines.push('');
  }

  const allErrs = [
    ...roadOverlaps,
    ...roadSetbacks,
    ...buildingOverlaps,
    ...plazaIntrusions,
    ...farFromRoad,
    ...industrialBuffer,
    ...treeViolations,
    ...connectivity.violations,
  ];
  if (allErrs.length > 0 || buildingsOnRail.length > 0) {
    lines.push('## Detail ERROR');
    for (const err of allErrs) lines.push(`- **${err.id}** (\`${err.rule}\`): ${err.message}`);
    for (const br of buildingsOnRail) {
      lines.push(`- **${br.id}** (\`buildingsOnRail\`): menimpa \`${br.railId}\` (${br.area.toFixed(2)} m²)`);
    }
    lines.push('');
  }

  return {
    errors: totalErrors,
    warnings: warningsList.length,
    roadOverlaps: roadOverlaps.length,
    buildingOverlaps: buildingOverlaps.length,
    treesOnRoad: treesOnRoad.length,
    treesInBuilding: treesInBuilding.length,
    treesInPlot: treesInPlot.length,
    treesOnSidewalk: treesOnSidewalk.length,
    buildingsInPlaza: plazaIntrusions.length,
    buildingsFarFromRoad: farFromRoad.length,
    buildingsOnRail: buildingsOnRail.length,
    unreachableTargets: connectivity.violations.length,
    markdown: lines.join('\n'),
  };
}

const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').endsWith('tools/audit-layout.ts');

if (isDirectCli) {
  const summary = runLayoutAudit();
  console.log(summary.markdown);

  if (process.argv.includes('--write')) {
    const outPath = path.resolve(process.cwd(), 'docs/LAYOUT_AUDIT_CURRENT.md');
    fs.writeFileSync(outPath, summary.markdown, 'utf8');
    console.log(`[audit-layout] Ditulis ke ${outPath}`);
  }

  if (summary.errors > 0) {
    process.exit(1);
  }
}
