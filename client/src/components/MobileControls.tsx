import React, { useEffect, useRef, useState } from 'react';
import { Car, Fuel, Lightbulb, LogOut, Volume2 } from 'lucide-react';
import type { TurnSignalMode } from '../world3d/vehicles/vehiclePhysics';
import { useViewportMode } from '../ui/useViewportMode';

export interface PlayerInputState {
  moveX: number;
  moveY: number;
  camDeltaYaw: number;
  camDeltaPitch: number;
  driveThrottle?: number;
  driveBrake?: number;
  driveSteer?: number;
}

interface MobileControlsProps {
  inputRef: React.MutableRefObject<PlayerInputState>;
  onZoomStep: (delta: number) => void;
  hideZoom?: boolean;
  drivingMode?: boolean;
  isHeadlightsOn?: boolean;
  turnSignal?: TurnSignalMode;
  onToggleTurnSignal?: (mode: 'left' | 'right' | 'hazard') => void;
  onHorn?: () => void;
  onToggleHeadlights?: () => void;
  onDismount?: () => void;
}

/**
 * Kontrol HP (Portrait & Landscape): Joystick virtual / kontrol setir-pedal saat mengemudi + area geser kamera di kanan.
 * Menyimpan vektor ke ref agar tidak memicu re-render React 60 FPS.
 */
export const MobileControls: React.FC<MobileControlsProps> = ({
  inputRef,
  onZoomStep,
  hideZoom = false,
  drivingMode = false,
  isHeadlightsOn = false,
  turnSignal = 'off',
  onToggleTurnSignal,
  onHorn,
  onToggleHeadlights,
  onDismount,
}) => {
  const { showTouchControls, isMobileLandscape } = useViewportMode();
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [steerLeftHeld, setSteerLeftHeld] = useState(false);
  const [steerRightHeld, setSteerRightHeld] = useState(false);
  const [gasHeld, setGasHeld] = useState(false);
  const [brakeHeld, setBrakeHeld] = useState(false);

  const joyTouchId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });

  const camTouchId = useRef<number | null>(null);
  const lastCamPos = useRef({ x: 0, y: 0 });

  const maxRadius = isMobileLandscape ? 25 : 30;

  useEffect(() => {
    if (!showTouchControls) return;
    inputRef.current.driveSteer = (steerRightHeld ? 1 : 0) - (steerLeftHeld ? 1 : 0);
  }, [inputRef, showTouchControls, steerLeftHeld, steerRightHeld]);

  useEffect(() => {
    if (!showTouchControls) return;
    inputRef.current.driveThrottle = gasHeld ? 1 : 0;
  }, [gasHeld, inputRef, showTouchControls]);

  useEffect(() => {
    if (!showTouchControls) return;
    inputRef.current.driveBrake = brakeHeld ? 1 : 0;
  }, [brakeHeld, inputRef, showTouchControls]);

  useEffect(() => {
    if (!drivingMode) {
      setSteerLeftHeld(false);
      setSteerRightHeld(false);
      setGasHeld(false);
      setBrakeHeld(false);
      inputRef.current.driveSteer = 0;
      inputRef.current.driveThrottle = 0;
      inputRef.current.driveBrake = 0;
    }
  }, [drivingMode, inputRef]);

  if (!showTouchControls) return null;

  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joyTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    joyTouchId.current = touch.identifier;
    joyCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== joyTouchId.current) continue;
      const dx = touch.clientX - joyCenter.current.x;
      const dy = touch.clientY - joyCenter.current.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * clamped;
      const ky = Math.sin(angle) * clamped;

      setKnob({ x: kx, y: ky });
      inputRef.current.moveX = kx / maxRadius;
      inputRef.current.moveY = ky / maxRadius;
    }
  };

  const handleJoyEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setKnob({ x: 0, y: 0 });
        inputRef.current.moveX = 0;
        inputRef.current.moveY = 0;
      }
    }
  };

  const handleCamStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (camTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    camTouchId.current = touch.identifier;
    lastCamPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleCamMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== camTouchId.current) continue;
      const dx = touch.clientX - lastCamPos.current.x;
      const dy = touch.clientY - lastCamPos.current.y;
      lastCamPos.current = { x: touch.clientX, y: touch.clientY };
      inputRef.current.camDeltaYaw += dx * 0.007;
      inputRef.current.camDeltaPitch += dy * 0.005;
    }
  };

  const handleCamEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === camTouchId.current) {
        camTouchId.current = null;
      }
    }
  };

  const dirThreshold = 8;
  const activeUp = knob.y < -dirThreshold;
  const activeDown = knob.y > dirThreshold;
  const activeLeft = knob.x < -dirThreshold;
  const activeRight = knob.x > dirThreshold;

  return (
    <>
      {/* Area Geser Kamera Kanan */}
      <div
        onTouchStart={handleCamStart}
        onTouchMove={handleCamMove}
        onTouchEnd={handleCamEnd}
        onTouchCancel={handleCamEnd}
        className={`fixed right-0 bottom-0 w-1/2 z-10 touch-none ${
          isMobileLandscape ? 'top-14' : 'top-16'
        }`}
        aria-label="Geser untuk memutar kamera"
      />

      {/* Tombol Zoom Cepat HP (disembunyikan saat Mode Drone karena sudah ada kontrol ketinggian) */}
      {!hideZoom && (
        <div
          className={`fixed right-2.5 z-20 flex gap-1.5 ${
            isMobileLandscape ? 'top-[58px] flex-row-reverse' : 'top-[68px] flex-col'
          }`}
        >
          <button
            type="button"
            onClick={() => onZoomStep(-1.5)}
            className={`${
              isMobileLandscape ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
            } bg-[#161E38]/80 backdrop-blur-md border border-[#F5EFE0]/30 text-[#FFFDF8] flex items-center justify-center shadow-lg active:scale-95 transition-transform`}
            aria-label="Perdekat kamera"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="10" y1="4" x2="10" y2="16" />
              <line x1="4" y1="10" x2="16" y2="10" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onZoomStep(1.5)}
            className={`${
              isMobileLandscape ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
            } bg-[#161E38]/80 backdrop-blur-md border border-[#F5EFE0]/30 text-[#FFFDF8] flex items-center justify-center shadow-lg active:scale-95 transition-transform`}
            aria-label="Perjauh kamera"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="10" x2="16" y2="10" />
            </svg>
          </button>
        </div>
      )}

      {drivingMode ? (
        <>
          {/* Kontrol Kemudi Kiri-Kanan + Sein Saat Mengemudi */}
          <div
            className={`fixed z-20 flex flex-col items-start gap-1.5 touch-none select-none ${
              isMobileLandscape ? 'left-3 bottom-3' : 'left-3.5 bottom-5'
            }`}
          >
            {onToggleTurnSignal && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggleTurnSignal('left')}
                  className={`h-8 px-2.5 rounded-xl border text-[10px] font-black shadow-md ${
                    turnSignal === 'left' || turnSignal === 'hazard'
                      ? 'bg-amber-400 border-white text-slate-950 animate-pulse'
                      : 'bg-[#161E38]/80 border-white/35 text-slate-200'
                  }`}
                  aria-label="Sein kiri"
                >
                  ◀ Sein
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTurnSignal('right')}
                  className={`h-8 px-2.5 rounded-xl border text-[10px] font-black shadow-md ${
                    turnSignal === 'right' || turnSignal === 'hazard'
                      ? 'bg-amber-400 border-white text-slate-950 animate-pulse'
                      : 'bg-[#161E38]/80 border-white/35 text-slate-200'
                  }`}
                  aria-label="Sein kanan"
                >
                  Sein ▶
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  setSteerLeftHeld(true);
                }}
                onTouchEnd={() => setSteerLeftHeld(false)}
                onTouchCancel={() => setSteerLeftHeld(false)}
                className={`${
                  isMobileLandscape ? 'h-14 w-14' : 'h-16 w-16'
                } rounded-2xl border-2 font-black text-white shadow-xl backdrop-blur-sm transition-transform flex flex-col items-center justify-center ${
                  steerLeftHeld
                    ? 'bg-[#E5B84B] border-white scale-95 text-[#161E38]'
                    : 'bg-[#161E38]/75 border-white/50'
                }`}
                aria-label="Belok kiri"
              >
                <span className="text-lg leading-none">◀</span>
                <span className="text-[10px] mt-0.5">Kiri</span>
              </button>
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  setSteerRightHeld(true);
                }}
                onTouchEnd={() => setSteerRightHeld(false)}
                onTouchCancel={() => setSteerRightHeld(false)}
                className={`${
                  isMobileLandscape ? 'h-14 w-14' : 'h-16 w-16'
                } rounded-2xl border-2 font-black text-white shadow-xl backdrop-blur-sm transition-transform flex flex-col items-center justify-center ${
                  steerRightHeld
                    ? 'bg-[#E5B84B] border-white scale-95 text-[#161E38]'
                    : 'bg-[#161E38]/75 border-white/50'
                }`}
                aria-label="Belok kanan"
              >
                <span className="text-lg leading-none">▶</span>
                <span className="text-[10px] mt-0.5">Kanan</span>
              </button>
            </div>
          </div>

          {/* Pedal Gas, Rem, Klakson, Lampu & Turun di Kanan */}
          <div
            className={`fixed z-20 flex flex-col items-end gap-2 touch-none select-none ${
              isMobileLandscape ? 'right-3 bottom-3' : 'right-3.5 bottom-5'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {onHorn && (
                <button
                  type="button"
                  onClick={onHorn}
                  className="h-10 w-10 rounded-xl bg-[#161E38]/80 border border-white/40 text-amber-300 flex items-center justify-center shadow-lg active:scale-95"
                  aria-label="Klakson"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
              {onToggleHeadlights && (
                <button
                  type="button"
                  onClick={onToggleHeadlights}
                  className={`h-10 w-10 rounded-xl border flex items-center justify-center shadow-lg active:scale-95 ${
                    isHeadlightsOn
                      ? 'bg-amber-400 border-white text-slate-950'
                      : 'bg-[#161E38]/80 border-white/40 text-slate-200'
                  }`}
                  aria-label="Lampu depan"
                >
                  <Lightbulb className="h-4 w-4" />
                </button>
              )}
              {onDismount && (
                <button
                  type="button"
                  onClick={onDismount}
                  className="h-10 px-3 rounded-xl bg-[#EC7C70] border-2 border-white text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95"
                  aria-label="Turun dan parkir"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Parkir</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  setBrakeHeld(true);
                }}
                onTouchEnd={() => setBrakeHeld(false)}
                onTouchCancel={() => setBrakeHeld(false)}
                className={`${
                  isMobileLandscape ? 'h-14 w-14' : 'h-16 w-16'
                } rounded-2xl border-2 font-black text-white shadow-xl backdrop-blur-sm transition-transform flex flex-col items-center justify-center ${
                  brakeHeld
                    ? 'bg-rose-500 border-white scale-95'
                    : 'bg-rose-900/75 border-rose-200/50'
                }`}
                aria-label="Rem dan mundur"
              >
                <Fuel className="h-4 w-4 hidden" />
                <span className="text-xs font-extrabold">REM</span>
                <span className="text-[9px] opacity-85">Mundur</span>
              </button>
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  setGasHeld(true);
                }}
                onTouchEnd={() => setGasHeld(false)}
                onTouchCancel={() => setGasHeld(false)}
                className={`${
                  isMobileLandscape ? 'h-16 w-16' : 'h-[72px] w-[72px]'
                } rounded-2xl border-2 font-black text-white shadow-xl backdrop-blur-sm transition-transform flex flex-col items-center justify-center ${
                  gasHeld
                    ? 'bg-emerald-500 border-white scale-95 text-slate-950'
                    : 'bg-emerald-700/80 border-emerald-200/60'
                }`}
                aria-label="Gas maju"
              >
                <Car className="h-4 w-4 mb-0.5" />
                <span className="text-xs font-extrabold">GAS</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Joystick Virtual Kiri saat berjalan kaki */
        <div
          onTouchStart={handleJoyStart}
          onTouchMove={handleJoyMove}
          onTouchEnd={handleJoyEnd}
          onTouchCancel={handleJoyEnd}
          className={`fixed z-20 rounded-full bg-[#161E38]/45 backdrop-blur-sm border-2 border-white/55 flex items-center justify-center touch-none shadow-xl select-none ${
            isMobileLandscape
              ? 'left-3.5 bottom-3 h-[100px] w-[100px]'
              : 'left-4 bottom-5 h-[116px] w-[116px]'
          }`}
          aria-label="Joystick gerak"
        >
          <span
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 transition-colors ${
              isMobileLandscape ? 'top-1.5' : 'top-2'
            } ${activeUp ? 'text-[#F7D166]' : 'text-white/75'}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
              <path d="M6 2L11 9H1L6 2Z" />
            </svg>
          </span>
          <span
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 transition-colors ${
              isMobileLandscape ? 'bottom-1.5' : 'bottom-2'
            } ${activeDown ? 'text-[#F7D166]' : 'text-white/75'}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
              <path d="M6 10L1 3H11L6 10Z" />
            </svg>
          </span>
          <span
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 transition-colors ${
              isMobileLandscape ? 'left-1.5' : 'left-2'
            } ${activeLeft ? 'text-[#F7D166]' : 'text-white/75'}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
              <path d="M2 6L9 1V11L2 6Z" />
            </svg>
          </span>
          <span
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 transition-colors ${
              isMobileLandscape ? 'right-1.5' : 'right-2'
            } ${activeRight ? 'text-[#F7D166]' : 'text-white/75'}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
              <path d="M10 6L3 11V1L10 6Z" />
            </svg>
          </span>
          <div
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
            className={`${
              isMobileLandscape ? 'h-10 w-10' : 'h-11 w-11'
            } rounded-full bg-[#F5EFE0] border-2 border-white shadow-lg`}
          />
        </div>
      )}
    </>
  );
};
