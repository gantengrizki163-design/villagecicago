import React, { useState } from 'react';
import { AlertTriangle, Fuel, Lightbulb, LogOut, Volume2, VolumeX, Wrench, Zap } from 'lucide-react';
import type { DrivingTelemetrySnapshot } from '../world3d/vehicles/vehiclePhysics';
import { vehicleAudio } from '../world3d/vehicles/vehicleAudio';
import { useViewportMode } from './useViewportMode';

interface DrivingMiniHudProps {
  telemetry: DrivingTelemetrySnapshot;
  isHeadlightsOn: boolean;
  onHorn: () => void;
  onToggleHeadlights: () => void;
  onToggleTurnSignal?: (mode: 'left' | 'right' | 'hazard') => void;
  onBrakeChange?: (held: boolean) => void;
  onDismount: () => void;
}

const TERRAIN_LABEL: Record<DrivingTelemetrySnapshot['terrain'], string> = {
  asphalt: 'Aspal',
  paving: 'Paving',
  offroad: 'Tanah',
  sawah: 'Sawah',
};

export const DrivingMiniHud: React.FC<DrivingMiniHudProps> = ({
  telemetry,
  isHeadlightsOn,
  onHorn,
  onToggleHeadlights,
  onToggleTurnSignal,
  onBrakeChange,
  onDismount,
}) => {
  const { isCompactHud, isMobileLandscape, showTouchControls } = useViewportMode();
  const [audioMuted, setAudioMuted] = useState(() => vehicleAudio.isMuted());
  const [brakeHeld, setBrakeHeld] = useState(false);

  const fuelPct =
    telemetry.fuelCapacity > 0
      ? Math.max(0, Math.min(100, Math.round((telemetry.fuel / telemetry.fuelCapacity) * 100)))
      : 0;
  const rpmPct = Math.max(0, Math.min(100, Math.round(telemetry.rpmRatio * 100)));

  const handleToggleMute = () => {
    const next = !audioMuted;
    vehicleAudio.setMuted(next);
    setAudioMuted(next);
  };

  const setBrakeState = (held: boolean) => {
    setBrakeHeld(held);
    onBrakeChange?.(held);
  };

  const leftActive = telemetry.turnSignal === 'left' || telemetry.turnSignal === 'hazard';
  const rightActive = telemetry.turnSignal === 'right' || telemetry.turnSignal === 'hazard';
  const hazardActive = telemetry.turnSignal === 'hazard';

  return (
    <div
      className={`fixed z-20 pointer-events-auto rounded-2xl border border-[#F5EFE0]/25 bg-[#161E38]/92 text-[#FFFDF8] shadow-2xl backdrop-blur-md ${
        isMobileLandscape
          ? 'bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1.5 w-[232px]'
          : isCompactHud
            ? 'bottom-[148px] left-1/2 -translate-x-1/2 px-3 py-1.5 w-[min(328px,calc(100vw-1.5rem))]'
            : 'bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 w-[420px]'
      }`}
    >
      {(telemetry.isOutOfFuel || telemetry.isStalled) && (
        <div className="mb-1.5 flex items-center justify-between rounded-lg bg-rose-500/20 border border-rose-400/50 px-2 py-0.5 text-[10px] font-bold text-rose-200">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-300 shrink-0" />
            {telemetry.isOutOfFuel
              ? telemetry.isPushing
                ? 'MENDORONG PELAN · Cari SPBU'
                : telemetry.isElectric
                  ? 'BATERAI HABIS · Tahan Gas utk dorong / SPBU'
                  : 'BENSIN HABIS · Tahan Gas utk dorong / SPBU'
              : 'MESIN MOGOK · Kondisi rendah, servis di bengkel'}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-[#E5B84B] px-1.5 py-0.5 text-[10px] font-extrabold text-[#161E38]">
              {telemetry.gearLabel}
            </span>
            <span className="truncate text-xs font-bold">{telemetry.name}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-300 font-mono tabular-nums">
            <span className="font-semibold text-amber-200">{telemetry.plateNumber}</span>
            <span>• {TERRAIN_LABEL[telemetry.terrain]}</span>
            {telemetry.speedLimitKmh !== null && (
              <span className={telemetry.isSpeeding ? 'font-bold text-rose-400' : 'text-emerald-300'}>
                Batas {telemetry.speedLimitKmh}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-baseline justify-end gap-1">
            <span
              className={`font-mono tabular-nums text-2xl font-black leading-none ${
                telemetry.isSpeeding ? 'text-rose-400' : 'text-white'
              }`}
            >
              {telemetry.speedKmh}
            </span>
            <span className="text-[10px] font-semibold text-slate-300">km/j</span>
          </div>
          {telemetry.isTestDrive && telemetry.testDriveRemainingSec !== null && (
            <div className="text-[10px] font-bold text-amber-300 font-mono tabular-nums">
              Uji Coba: {telemetry.testDriveRemainingSec}d
            </div>
          )}
        </div>
      </div>

      {/* Bar RPM */}
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-100 ${
            rpmPct > 85 ? 'bg-rose-400' : rpmPct > 55 ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${rpmPct}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-1.5 text-[11px]">
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span
            className={`flex items-center gap-0.5 font-semibold ${
              fuelPct <= 20 ? 'text-rose-400' : 'text-sky-300'
            }`}
          >
            {telemetry.isElectric ? <Zap className="h-3.5 w-3.5" /> : <Fuel className="h-3.5 w-3.5" />}
            {fuelPct}%
          </span>
          <span
            className={`flex items-center gap-0.5 font-semibold ${
              telemetry.condition <= 30 ? 'text-amber-400' : 'text-emerald-300'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            {Math.round(telemetry.condition)}%
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onToggleTurnSignal && !showTouchControls && (
            <>
              <button
                type="button"
                onClick={() => onToggleTurnSignal('left')}
                title="Sein Kiri (Z)"
                className={`rounded-lg px-1.5 py-1 text-[10px] font-black cursor-pointer ${
                  leftActive
                    ? 'bg-amber-400 text-slate-950 animate-pulse'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => onToggleTurnSignal('hazard')}
                title="Hazard (X)"
                className={`rounded-lg px-1.5 py-1 text-[10px] font-black cursor-pointer ${
                  hazardActive
                    ? 'bg-amber-400 text-slate-950 animate-pulse'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ⚠
              </button>
              <button
                type="button"
                onClick={() => onToggleTurnSignal('right')}
                title="Sein Kanan (C)"
                className={`rounded-lg px-1.5 py-1 text-[10px] font-black cursor-pointer ${
                  rightActive
                    ? 'bg-amber-400 text-slate-950 animate-pulse'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ▶
              </button>
            </>
          )}
          {onToggleTurnSignal && showTouchControls && (
            <button
              type="button"
              onClick={() => onToggleTurnSignal('hazard')}
              title="Lampu Hazard"
              className={`rounded-lg px-1.5 py-1 text-[10px] font-black ${
                hazardActive
                  ? 'bg-amber-400 text-slate-950 animate-pulse'
                  : 'bg-slate-800/90 text-slate-300'
              }`}
            >
              ⚠
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleMute}
            title={audioMuted ? 'Nyalakan suara mesin' : 'Bisukan suara mesin'}
            className="rounded-lg bg-slate-800/90 p-1.5 text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            {audioMuted ? <VolumeX className="h-3.5 w-3.5 text-rose-300" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          {!showTouchControls && (
            <>
              {onBrakeChange && (
                <button
                  type="button"
                  onPointerDown={() => setBrakeState(true)}
                  onPointerUp={() => setBrakeState(false)}
                  onPointerLeave={() => setBrakeState(false)}
                  onPointerCancel={() => setBrakeState(false)}
                  title="Tahan untuk Rem / Mundur (S / Spasi)"
                  className={`rounded-lg px-2 py-1 text-[10px] font-extrabold select-none cursor-pointer ${
                    brakeHeld
                      ? 'bg-rose-500 text-white'
                      : 'bg-rose-900/75 border border-rose-400/50 text-rose-100 hover:bg-rose-800/80'
                  }`}
                >
                  Rem
                </button>
              )}
              <button
                type="button"
                onClick={onHorn}
                title="Klakson (H)"
                className="rounded-lg bg-slate-800/90 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-slate-700 cursor-pointer"
              >
                H
              </button>
              <button
                type="button"
                onClick={onToggleHeadlights}
                title="Lampu (L)"
                className={`rounded-lg p-1.5 cursor-pointer ${
                  isHeadlightsOn
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {!isCompactHud && (
            <button
              type="button"
              onClick={onDismount}
              title="Turun & Parkir (F)"
              className="flex items-center gap-1 rounded-lg bg-[#EC7C70] px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-[#F28C80] cursor-pointer"
            >
              <LogOut className="h-3 w-3" />
              <span>Parkir (F)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

