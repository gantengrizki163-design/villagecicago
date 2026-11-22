import rawLayoutJson from './cicalengka.layout.json';
import {
  checkBuildingOverlap,
  checkBuildingSpacing,
  checkFacingAndDoorAccess,
  checkGridAndRotation,
  checkGridConnectivityAStar,
  checkIndustrialBuffer,
  checkPlazaSolidFree,
  checkRailSafety,
  checkRoadOverlap,
  checkRoadProximity,
  checkRoadSetback,
  checkTreeClearance,
  generateDeterministicPlants,
} from './rules';
import type { CicalengkaLayout, LayoutValidationReport, ValidationViolation } from './types';

export const CICALENGKA_LAYOUT: CicalengkaLayout = rawLayoutJson as unknown as CicalengkaLayout;

export function validateLayout(
  layout: CicalengkaLayout = CICALENGKA_LAYOUT
): LayoutValidationReport {
  const plantsGenerated = generateDeterministicPlants(layout);

  const violations: ValidationViolation[] = [
    ...checkRoadOverlap(layout),
    ...checkRoadSetback(layout),
    ...checkBuildingOverlap(layout),
    ...checkBuildingSpacing(layout),
    ...checkRailSafety(layout),
    ...checkPlazaSolidFree(layout),
    ...checkRoadProximity(layout),
    ...checkGridAndRotation(layout),
    ...checkFacingAndDoorAccess(layout),
    ...checkIndustrialBuffer(layout),
    ...checkTreeClearance(layout, plantsGenerated),
  ];

  const connectivityCheck = checkGridConnectivityAStar(layout);
  violations.push(...connectivityCheck.violations);

  const errorCount = violations.filter((v) => v.severity === 'ERROR').length;
  const warnCount = violations.filter((v) => v.severity === 'WARN').length;

  return {
    valid: errorCount === 0,
    errorCount,
    warnCount,
    violations,
    connectivity: connectivityCheck.result,
    plantsGenerated,
  };
}

function runCli() {
  const report = validateLayout(CICALENGKA_LAYOUT);
  const totalLots = CICALENGKA_LAYOUT.lots.length;
  const totalPlants = report.plantsGenerated.trees.length + report.plantsGenerated.palms.length;

  console.log(
    `[layout:validate] Objek: ${totalLots} lot, Tanaman: ${report.plantsGenerated.trees.length} pohon + ${report.plantsGenerated.palms.length} palem (${totalPlants} total)`
  );
  console.log(
    `[layout:validate] Konektivitas A*: ${report.connectivity.reachableIds.length}/${report.connectivity.checkedTargetsCount} titik terjangkau dari spawn (step ${report.connectivity.gridStepMeters}m)`
  );

  if (report.violations.length > 0) {
    console.error(
      `[layout:validate] GAGAL — ditemukan ${report.errorCount} ERROR, ${report.warnCount} WARN:`
    );
    for (const v of report.violations) {
      const targetSuffix = v.targetId ? ` -> ${v.targetId}` : '';
      console.error(`  - [${v.severity}] ${v.id}${targetSuffix} (${v.rule}): ${v.message}`);
    }
    process.exit(1);
  }

  console.log('[layout:validate] LULUS — 0 pelanggaran tata letak dan 100% rute terhubung.');
}

const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').endsWith('client/src/world3d/layout/validate.ts');

if (isDirectCli) {
  runCli();
}
