import React from 'react';
import { CloudRain, LogOut, X } from 'lucide-react';
import type { GraphicsQuality } from '../types/game';
import type { WeatherKind } from '../world3d/assets/WeatherEffects3D';

export type WeatherSetting = 'auto' | WeatherKind;

interface SettingsModalProps {
  open: boolean;
  quality: GraphicsQuality;
  weatherMode?: WeatherSetting;
  onChangeQuality: (q: GraphicsQuality) => void;
  onChangeWeatherMode?: (w: WeatherSetting) => void;
  onLogout: () => void;
  onClose: () => void;
}

const QUALITY_OPTIONS: { value: GraphicsQuality; label: string; desc: string }[] = [
  { value: 'low', label: 'Rendah', desc: 'Tanpa bayangan, ideal untuk HP hemat baterai (30+ FPS)' },
  { value: 'medium', label: 'Sedang', desc: 'Bayangan ringan, seimbang untuk mayoritas HP & laptop' },
  { value: 'high', label: 'Tinggi', desc: 'Bayangan tajam & resolusi tinggi' },
];

const WEATHER_OPTIONS: { value: WeatherSetting; label: string }[] = [
  { value: 'auto', label: 'Otomatis' },
  { value: 'cerah', label: 'Cerah' },
  { value: 'gerimis', label: 'Gerimis' },
  { value: 'hujan_deras', label: 'Hujan Deras' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  quality,
  weatherMode = 'auto',
  onChangeQuality,
  onChangeWeatherMode,
  onLogout,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white">Pengaturan</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup pengaturan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-300 mb-2">Kualitas Grafis 3D</div>
          <div className="space-y-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeQuality(opt.value)}
                className={`w-full rounded-xl border p-2.5 text-left transition ${
                  quality === opt.value
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold">{opt.label}</div>
                <div className="text-[11px] text-slate-400">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {onChangeWeatherMode && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
              <CloudRain className="h-3.5 w-3.5 text-sky-400" />
              <span>Atmosfer Cuaca Visual</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WEATHER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeWeatherMode(opt.value)}
                  className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                    weatherMode === opt.value
                      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-slate-950 border border-slate-800 p-3 text-[11px] text-slate-400 space-y-1">
          <div className="font-semibold text-slate-200">Panduan Kontrol:</div>
          <div>• Desktop: WASD/Panah jalan, drag mouse putar kamera, scroll zoom.</div>
          <div>• HP: Joystick kiri jalan, geser layar kanan putar kamera.</div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25"
        >
          <LogOut className="h-4 w-4" />
          Keluar Akun
        </button>
      </div>
    </div>
  );
};

