import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  LocateFixed,
  Map,
  Minus,
  Plus,
  RotateCw,
  X,
} from 'lucide-react';
import type { GameClockInfo } from '../firebase/gameTime';
import type { ZoneId } from '../types/game';
import type { DroneTelemetry } from '../world3d/ThirdPersonCamera';
import { ALUN_ALUN_POS } from '../world3d/worldConstants';
import { useViewportMode } from './useViewportMode';

export interface DronePreset {
  id: string;
  label: string;
  x: number;
  z: number;
  altitude: number;
  pitch: number;
  yaw?: number;
}

interface DroneHUDProps {
  zone: ZoneId;
  clock: GameClockInfo;
  telemetry: DroneTelemetry;
  autoOrbit: boolean;
  activePresetId: string | null;
  playerPos: { x: number; z: number };
  onSelectPreset: (preset: DronePreset) => void;
  onChangeAltitude: (altitude: number) => void;
  onSetPitch: (pitch: number) => void;
  onToggleAutoOrbit: () => void;
  onExit: () => void;
}

const ZONE_NAMES: Record<ZoneId, string> = {
  cicalengka: 'Cicalengka',
  rancaekek: 'Rancaekek',
  bandung: 'Bandung',
  nagreg: 'Nagreg',
};

export const DroneHUD: React.FC<DroneHUDProps> = ({
  zone,
  clock,
  telemetry,
  autoOrbit,
  activePresetId,
  playerPos,
  onSelectPreset,
  onChangeAltitude,
  onSetPitch,
  onToggleAutoOrbit,
  onExit,
}) => {
  const { isCompactHud, isMobileLandscape, showTouchControls } = useViewportMode();
  const [dockCollapsed, setDockCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyH') {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const presets = useMemo<DronePreset[]>(() => {
    const selfPreset: DronePreset = {
      id: 'self',
      label: 'Posisi Saya',
      x: playerPos.x,
      z: playerPos.z,
      altitude: 24,
      pitch: 0.62,
    };

    if (zone === 'cicalengka') {
      return [
        {
          id: 'overview',
          label: 'Seluruh Kota',
          x: 0,
          z: 0,
          altitude: 72,
          pitch: 0.88,
          yaw: 0.45,
        },
        {
          id: 'alun_alun',
          label: 'Alun-Alun',
          x: ALUN_ALUN_POS.x,
          z: ALUN_ALUN_POS.z,
          altitude: 24,
          pitch: 0.6,
          yaw: 0.25,
        },
        {
          id: 'stasiun',
          label: 'Stasiun',
          x: 0,
          z: -52,
          altitude: 24,
          pitch: 0.56,
          yaw: 0.0,
        },
        {
          id: 'pasar',
          label: 'Pasar & Niaga',
          x: 34,
          z: -6,
          altitude: 28,
          pitch: 0.64,
          yaw: -0.4,
        },
        {
          id: 'hunian',
          label: 'Hunian & Kavling',
          x: 4,
          z: 46,
          altitude: 32,
          pitch: 0.68,
          yaw: 0.25,
        },
        {
          id: 'kesehatan',
          label: 'Kesehatan & Sekolah',
          x: -54,
          z: 2,
          altitude: 26,
          pitch: 0.62,
          yaw: 0.45,
        },
        selfPreset,
      ];
    }

    return [
      {
        id: 'overview',
        label: 'Pusat Area',
        x: 0,
        z: -16,
        altitude: 44,
        pitch: 0.74,
        yaw: 0.35,
      },
      {
        id: 'stasiun',
        label: 'Stasiun',
        x: 0,
        z: -48,
        altitude: 24,
        pitch: 0.58,
        yaw: 0,
      },
      selfPreset,
    ];
  }, [zone, playerPos.x, playerPos.z]);

  const isTopDown = telemetry.pitchDeg >= 72;
  const isTouchPortrait = showTouchControls && !isMobileLandscape;

  const dockContainerClass = isTouchPortrait
    ? 'bottom-4 left-[142px] right-3 sm:left-[148px] sm:right-4 sm:max-w-[560px] sm:ml-auto items-end'
    : isMobileLandscape && showTouchControls
      ? 'bottom-2.5 left-1/2 -translate-x-1/2 w-[min(520px,calc(100vw-244px))] items-center'
      : 'bottom-4 left-1/2 -translate-x-1/2 w-[min(820px,94vw)] items-center';

  return (
    <>
      {/* Top Minimal Header */}
      <div
        className={`pointer-events-none fixed left-2.5 right-2.5 z-30 flex items-start justify-between gap-2 ${
          isMobileLandscape ? 'top-1.5' : 'top-2.5'
        }`}
      >
        <div
          className={`pointer-events-auto min-w-0 rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-lg ${
            isCompactHud ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white whitespace-nowrap">
            <Compass className="h-4 w-4 text-sky-400 shrink-0" />
            <span>Mode Drone</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-sky-300 truncate">{ZONE_NAMES[zone]}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums whitespace-nowrap">
            <span>{isCompactHud ? `${telemetry.altitude}m` : `Tinggi ${telemetry.altitude} m`}</span>
            <span aria-hidden="true">·</span>
            <span>X {telemetry.x}</span>
            <span aria-hidden="true">·</span>
            <span>Z {telemetry.z}</span>
            {!isCompactHud && (
              <>
                <span aria-hidden="true">·</span>
                <span>Sudut {telemetry.pitchDeg}°</span>
              </>
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          {!isCompactHud && (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-lg font-mono tabular-nums whitespace-nowrap">
              <span>{clock.formattedTime}</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="text-slate-400">{clock.phaseLabel}</span>
            </div>
          )}
          {isMobileLandscape && (
            <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-950/90 px-2.5 py-1.5 text-xs text-slate-300 shadow-lg font-mono tabular-nums whitespace-nowrap">
              <span>{clock.formattedTime}</span>
            </div>
          )}
          <button
            type="button"
            onClick={onExit}
            className="min-h-[42px] flex items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-rose-400 active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4 shrink-0" />
            <span>{isCompactHud ? 'Keluar' : 'Keluar Drone'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      <div className={`pointer-events-none fixed z-30 flex flex-col ${dockContainerClass}`}>
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white shadow-md whitespace-nowrap cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>{isTouchPortrait ? 'Kontrol Drone' : 'Tampilkan Kontrol Drone'}</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>{isTouchPortrait ? 'Sembunyikan' : 'Sembunyikan Kontrol'}</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div
            className={`pointer-events-auto w-full rounded-2xl border border-slate-700/80 bg-slate-950/92 shadow-2xl ${
              isTouchPortrait || isMobileLandscape ? 'p-2 space-y-1.5' : 'p-3 space-y-2.5'
            }`}
          >
            {/* Waypoints / Titik Cepat */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {presets.map((preset) => {
                const active = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className={`${
                      isTouchPortrait || isMobileLandscape
                        ? 'min-h-[30px] px-2.5 py-1 text-[11px]'
                        : 'min-h-[36px] px-3 py-1.5 text-xs'
                    } flex items-center gap-1 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {preset.id === 'self' && <LocateFixed className="h-3 w-3 shrink-0" />}
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Flight Controls */}
            {isTouchPortrait ? (
              <div className="space-y-1.5 border-t border-slate-800 pt-1.5">
                {/* Altitude Row */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChangeAltitude(Math.max(10, telemetry.altitude - 8))}
                    className="h-8 w-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label="Turunkan drone"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    value={telemetry.altitude}
                    onChange={(e) => onChangeAltitude(Number(e.target.value))}
                    aria-label="Ketinggian drone"
                    className="flex-1 min-w-0 accent-sky-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => onChangeAltitude(Math.min(95, telemetry.altitude + 8))}
                    className="h-8 w-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label="Naikkan drone"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-right text-[11px] font-mono tabular-nums text-sky-300 shrink-0">
                    {telemetry.altitude}m
                  </span>
                </div>

                {/* Camera Angle & Auto Orbit - Even 3-Col Row */}
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => onSetPitch(0.62)}
                    className={`min-h-[34px] px-1.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                      !isTopDown
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Miring
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetPitch(1.44)}
                    className={`min-h-[34px] flex items-center justify-center gap-1 px-1.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                      isTopDown
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Map className="h-3 w-3 shrink-0" />
                    <span>Atas</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleAutoOrbit}
                    className={`min-h-[34px] flex items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      autoOrbit
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <RotateCw className="h-3 w-3 shrink-0" />
                    <span>Orbit</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`flex flex-wrap items-center justify-between border-t border-slate-800 ${
                  isMobileLandscape ? 'gap-1.5 pt-1.5' : 'gap-2.5 pt-2'
                }`}
              >
                {/* Altitude Slider & Steppers */}
                <div
                  className={`flex items-center gap-1.5 flex-1 ${
                    isMobileLandscape ? 'min-w-[140px]' : 'min-w-[200px]'
                  }`}
                >
                  {!isMobileLandscape && (
                    <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      Tinggi
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChangeAltitude(Math.max(10, telemetry.altitude - 8))}
                    className={`${
                      isMobileLandscape ? 'h-8 w-8' : 'h-9 w-9'
                    } rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center shrink-0 cursor-pointer`}
                    aria-label="Turunkan drone"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    value={telemetry.altitude}
                    onChange={(e) => onChangeAltitude(Number(e.target.value))}
                    aria-label="Ketinggian drone"
                    className="flex-1 min-w-[60px] accent-sky-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => onChangeAltitude(Math.min(95, telemetry.altitude + 8))}
                    className={`${
                      isMobileLandscape ? 'h-8 w-8' : 'h-9 w-9'
                    } rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center shrink-0 cursor-pointer`}
                    aria-label="Naikkan drone"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-10 text-right text-[11px] font-mono tabular-nums text-sky-300 shrink-0">
                    {telemetry.altitude} m
                  </span>
                </div>

                {/* Camera Angle & Auto Orbit */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => onSetPitch(0.62)}
                      className={`${
                        isMobileLandscape ? 'min-h-[30px] px-2 text-[11px]' : 'min-h-[34px] px-2.5 text-xs'
                      } py-1 font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                        !isTopDown
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Miring
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetPitch(1.44)}
                      className={`${
                        isMobileLandscape ? 'min-h-[30px] px-2 text-[11px]' : 'min-h-[34px] px-2.5 text-xs'
                      } flex items-center gap-1 py-1 font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                        isTopDown
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Map className="h-3.5 w-3.5 shrink-0" />
                      <span>Atas</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleAutoOrbit}
                    className={`${
                      isMobileLandscape ? 'min-h-[32px] px-2.5 py-1 text-[11px]' : 'min-h-[36px] px-3 py-1.5 text-xs'
                    } flex items-center gap-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      autoOrbit
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <RotateCw className="h-3.5 w-3.5 shrink-0" />
                    <span>Orbit</span>
                  </button>
                </div>
              </div>
            )}

            {!isCompactHud && !showTouchControls && (
              <p className="text-[11px] text-slate-400 text-center">
                WASD / Panah: Terbang · Seret Mouse: Putar Kamera · Scroll / E-Q: Ketinggian · V / Esc: Keluar
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
};
