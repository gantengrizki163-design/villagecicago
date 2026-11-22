import { describe, expect, it } from 'vitest';
import trainScheduleJson from '../../../../functions/src/config/trainSchedule.json';
import type { TrainScheduleConfig } from '../../types/game';
import { DEFAULT_GAME_CONFIG } from '../../world3d/worldConstants';
import { getDeterministicTrafficLightPhase } from '../../world3d/assets/TrafficInfrastructure3D';
import { getDeterministicTrainState } from '../phase2ConfigCache';
import { computeDeterministicTrafficVehicles } from '../trafficDeterminism';
import { getTrafficConfig } from '../vehicleConfigCache';

const TRAIN_SCHEDULE = trainScheduleJson as TrainScheduleConfig;
const EPOCH_MS = DEFAULT_GAME_CONFIG.epochMs;

describe('Lalu Lintas NPC Deterministik (trafficDeterminism)', () => {
  it('menghasilkan posisi, model, plat, dan kecepatan identik di dua klien berbeda pada waktu yang sama', () => {
    const serverNowMs = EPOCH_MS + 123_450;
    const a = computeDeterministicTrafficVehicles({
      serverNowMs,
      daySeed: 12345,
      gameHour: 16.5,
      zone: 'cicalengka',
      playerPos: { x: 0, z: -10 },
      isMobile: false,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });
    const b = computeDeterministicTrafficVehicles({
      serverNowMs,
      daySeed: 12345,
      gameHour: 16.5,
      zone: 'cicalengka',
      playerPos: { x: 0, z: -10 },
      isMobile: false,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });

    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('mematuhi batas jumlah kendaraan mobile (<=14), desktop (<=24), kepadatan jam, dan culling jarak', () => {
    const cfg = getTrafficConfig();
    const serverNowMs = EPOCH_MS + 88_000;

    const mobilePeak = computeDeterministicTrafficVehicles({
      serverNowMs,
      daySeed: 777,
      gameHour: 17,
      zone: 'cicalengka',
      playerPos: { x: 0, z: 0 },
      isMobile: true,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });
    const desktopPeak = computeDeterministicTrafficVehicles({
      serverNowMs,
      daySeed: 777,
      gameHour: 17,
      zone: 'cicalengka',
      playerPos: { x: 0, z: 0 },
      isMobile: false,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });
    const desktopNight = computeDeterministicTrafficVehicles({
      serverNowMs,
      daySeed: 777,
      gameHour: 2,
      zone: 'cicalengka',
      playerPos: { x: 0, z: 0 },
      isMobile: false,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });

    expect(mobilePeak.length).toBeLessThanOrEqual(cfg.maxActiveNpcVehiclesMobile);
    expect(desktopPeak.length).toBeLessThanOrEqual(cfg.maxActiveNpcVehiclesDesktop);
    expect(desktopNight.length).toBeLessThan(desktopPeak.length);

    for (const v of desktopPeak) {
      expect(v.distanceToPlayer).toBeLessThanOrEqual(cfg.cullRadiusMeters);
      expect(v.lod).toBe(v.distanceToPlayer <= cfg.lodSimpleRadiusMeters ? 'full' : 'simple');
    }

    const luarZona = computeDeterministicTrafficVehicles({
      serverNowMs,
      daySeed: 777,
      gameHour: 17,
      zone: 'bandung',
      playerPos: { x: 0, z: 0 },
      isMobile: false,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });
    expect(luarZona).toEqual([]);
  });

  it('kendaraan di Jalan Raya melaju di lajur kiri Indonesia dan mulus setelah 420 detik', () => {
    const baseMs = EPOCH_MS + 35_500;
    const atT0 = computeDeterministicTrafficVehicles({
      serverNowMs: baseMs,
      daySeed: 99,
      gameHour: 16,
      zone: 'cicalengka',
      playerPos: { x: 0, z: -10 },
      isMobile: false,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });
    const atT420 = computeDeterministicTrafficVehicles({
      serverNowMs: baseMs + 420_000,
      daySeed: 99,
      gameHour: 16,
      zone: 'cicalengka',
      playerPos: { x: 0, z: -10 },
      isMobile: false,
      trainSchedule: TRAIN_SCHEDULE,
      epochMs: EPOCH_MS,
    });

    // Periodik tepat setiap 420 detik
    expect(atT420.length).toBe(atT0.length);
    for (let i = 0; i < atT0.length; i++) {
      expect(Math.hypot(atT420[i].x - atT0[i].x, atT420[i].z - atT0[i].z)).toBeLessThan(0.05);
    }

    // Cek lajur kiri di segmen lurus Jalan Raya (z sekitar -10, x di tengah blok [-45..45])
    let checkedLane = 0;
    for (let step = 0; step < 80; step++) {
      const list = computeDeterministicTrafficVehicles({
        serverNowMs: EPOCH_MS + step * 3000,
        daySeed: 99,
        gameHour: 16,
        zone: 'cicalengka',
        playerPos: { x: 0, z: -10 },
        isMobile: false,
        trainSchedule: TRAIN_SCHEDULE,
        epochMs: EPOCH_MS,
      });
      for (const v of list) {
        if (Math.abs(v.z - -10) < 4 && Math.abs(v.x) < 50 && Math.abs(Math.abs(v.rotY) - Math.PI / 2) < 0.08) {
          checkedLane++;
          if (v.rotY > 0) {
            // Menghadap +X (Timur): lajur kiri adalah sisi utara (z < -10)
            expect(v.z).toBeLessThan(-10.5);
          } else {
            // Menghadap -X (Barat): lajur kiri adalah sisi selatan (z > -10)
            expect(v.z).toBeGreaterThan(-9.5);
          }
        }
      }
    }
    expect(checkedLane).toBeGreaterThan(20);
  });

  it('tidak menerobos lampu merah di simpang Alun-Alun dan berhenti saat palang rel KA tertutup', () => {
    const cfg = getTrafficConfig();
    const redViolations: Array<Record<string, unknown>> = [];
    let railViolationCount = 0;
    let redStopObserved = 0;
    let railStopObserved = 0;

    const prevMap = new Map<string, { x: number; z: number; rotY: number }>();

    // Sample setiap 0.5 detik penuh selama 1 periode 420 detik
    for (let step = 0; step < 840; step += 1) {
      const serverNowMs = EPOCH_MS + step * 500;
      const vehicles = computeDeterministicTrafficVehicles({
        serverNowMs,
        daySeed: 404,
        gameHour: 16.5,
        zone: 'cicalengka',
        playerPos: { x: 10, z: -20 },
        isMobile: false,
        trainSchedule: TRAIN_SCHEDULE,
        epochMs: EPOCH_MS,
      });

      for (const v of vehicles) {
        if (v.stopReason === 'red_light') redStopObserved++;
        if (v.stopReason === 'rail_gate') railStopObserved++;

        const prev = prevMap.get(v.slotKey);
        if (prev) {
          for (const tl of cfg.trafficLights) {
            const phase = getDeterministicTrafficLightPhase(
              serverNowMs,
              tl.phaseOffsetMs,
              cfg.trafficLightCycleMs,
              cfg.trafficLightGreenMs,
              cfg.trafficLightYellowMs
            );
            const prevInside = Math.abs(prev.x - tl.x) < 2.2 && Math.abs(prev.z - tl.z) < 3.6;
            const curInside = Math.abs(v.x - tl.x) < 2.2 && Math.abs(v.z - tl.z) < 3.6;
            if (!prevInside && curInside) {
              const entryEw = Math.abs(Math.sin(prev.rotY)) > 0.7;
              const entrySignal = entryEw ? phase.ewSignal : phase.nsSignal;
              if (entrySignal === 'red' && redViolations.length < 5) {
                redViolations.push({
                  step,
                  slot: v.slotKey,
                  tl: tl.id,
                  prevX: Number(prev.x.toFixed(2)),
                  prevZ: Number(prev.z.toFixed(2)),
                  x: Number(v.x.toFixed(2)),
                  z: Number(v.z.toFixed(2)),
                  entryEw,
                  phase,
                });
              }
            }
          }

          const train = getDeterministicTrainState(serverNowMs, TRAIN_SCHEDULE, EPOCH_MS);
          const gateClosed =
            train.phase === 'approaching' || train.phase === 'boarding' || train.phase === 'departing';
          const prevOnRail = Math.abs(prev.x - 60) < 4.0 && Math.abs(prev.z - -62) < 3.2;
          const curOnRail = Math.abs(v.x - 60) < 4.0 && Math.abs(v.z - -62) < 3.2;
          if (!prevOnRail && curOnRail && gateClosed) {
            railViolationCount++;
          }
        }
        prevMap.set(v.slotKey, { x: v.x, z: v.z, rotY: v.rotY });
      }
    }

    expect(redStopObserved).toBeGreaterThan(0);
    expect(railStopObserved).toBeGreaterThan(0);
    expect(redViolations).toEqual([]);
    expect(railViolationCount).toBe(0);
  });
});
