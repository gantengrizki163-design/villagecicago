import React, { useState } from 'react';
import { AlertTriangle, Clock, Moon, Warehouse, X } from 'lucide-react';
import { callSleepAtHome } from '../firebase/api';
import type { GameClockInfo } from '../firebase/gameTime';
import { formatRupiah } from '../firebase/gameTime';
import type { CharacterDoc, HousingConfigDoc } from '../types/game';

interface HomelessSleepModalProps {
  open: boolean;
  mode: 'shelter' | 'emperan';
  spotId?: string;
  spotLabel: string;
  character: CharacterDoc;
  clock: GameClockInfo;
  housingConfig: HousingConfigDoc;
  onOpenSearch: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const HomelessSleepModal: React.FC<HomelessSleepModalProps> = ({
  open,
  mode,
  spotId,
  spotLabel,
  character,
  clock,
  housingConfig,
  onOpenSearch,
  onClose,
  onNotify,
}) => {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const hs = housingConfig.homelessSettings;
  const shelter = hs.shelter;
  const shelterOpen =
    shelter.openStartHour > shelter.openEndHour
      ? clock.hour >= shelter.openStartHour || clock.hour < shelter.openEndHour
      : clock.hour >= shelter.openStartHour && clock.hour < shelter.openEndHour;

  const handleStartSleep = async () => {
    setBusy(true);
    try {
      await callSleepAtHome('start', mode, undefined, spotId);
      onNotify(
        mode === 'shelter'
          ? `Beristirahat di ${shelter.label}...`
          : `Tidur darurat di ${spotLabel}...`
      );
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memulai istirahat.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-3 text-xs">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            {mode === 'shelter' ? (
              <Warehouse className="h-5 w-5 text-sky-400" />
            ) : (
              <Moon className="h-5 w-5 text-slate-300" />
            )}
            <div>
              <h2 className="text-base font-bold text-white">{spotLabel}</h2>
              <p className="text-[11px] text-slate-400">
                {mode === 'shelter' ? 'Tempat Singgah Sosial Malam Hari' : 'Tidur Darurat Tanpa Rumah'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup tidur darurat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {character.homeless && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 space-y-1.5 text-rose-200">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Kehidupan Keras Tanpa Hunian</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Tanpa rumah tetap, energi, kebersihan, &amp; mood turun jauh lebih cepat dan pemulihan tidur sangat terbatas.
            </p>
          </div>
        )}

        {mode === 'shelter' ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1.5 text-[11px] text-slate-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="h-3.5 w-3.5" /> Jam Buka:
              </span>
              <span className={`font-bold ${shelterOpen ? 'text-emerald-300' : 'text-rose-300'}`}>
                {shelter.openStartHour}:00 – 0{shelter.openEndHour}:00 ({shelterOpen ? 'BUKA' : 'TUTUP'})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Biaya Kebersihan:</span>
              <span className="font-bold text-white">
                {character.money >= shelter.fee ? formatRupiah(shelter.fee) : 'Gratis (Darurat)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Efek Tidur ({shelter.sleepDurationSec} detik):</span>
              <span className="text-sky-300">+{shelter.sleepEnergyRestore}% Energi, sedikit kumuh</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1.5 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Biaya:</span>
              <span className="font-bold text-emerald-300">Gratis (Emperan Terbuka)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Efek ({hs.emperanSleepDurationSec} detik):</span>
              <span className="text-amber-300">
                +{hs.emperanSleepEnergyRestore}% Energi, {hs.emperanSleepMoodDelta} Mood, {hs.emperanSleepHygieneDelta} Bersih
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={busy || (mode === 'shelter' && !shelterOpen)}
            onClick={() => void handleStartSleep()}
            className="w-full rounded-xl bg-sky-500 py-2.5 font-bold text-slate-950 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {busy
              ? 'Memproses...'
              : mode === 'shelter' && !shelterOpen
                ? `Penampungan Tutup (Buka ${shelter.openStartHour}:00)`
                : `Tidur di Sini (${mode === 'shelter' ? shelter.sleepDurationSec : hs.emperanSleepDurationSec}d)`}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSearch();
            }}
            className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2 font-semibold text-emerald-200 hover:bg-emerald-500/25"
          >
            Cari Kos Murah (Mulai Rp 15.000)
          </button>
        </div>
      </div>
    </div>
  );
};
