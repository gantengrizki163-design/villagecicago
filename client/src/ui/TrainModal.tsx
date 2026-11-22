import React, { useState } from 'react';
import { MapPin, TrainFront, X } from 'lucide-react';
import { callBuyTicket, callCompleteTrip } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { getDeterministicTrainState } from '../firebase/phase2ConfigCache';
import type { CharacterDoc, TrainScheduleConfig, ZoneId } from '../types/game';

interface TrainModalProps {
  open: boolean;
  character: CharacterDoc;
  schedule: TrainScheduleConfig;
  epochMs: number;
  serverNowMs: number;
  serverOffsetMs: number;
  nearStation: boolean;
  initialDestination?: ZoneId | null;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const TrainModal: React.FC<TrainModalProps> = ({
  open,
  character,
  schedule,
  epochMs,
  serverNowMs,
  serverOffsetMs,
  nearStation,
  initialDestination = null,
  onClose,
  onNotify,
}) => {
  const [busyZone, setBusyZone] = useState<string | null>(null);
  const trainState = getDeterministicTrainState(serverNowMs, schedule, epochMs);
  const currentZone = (character.currentZone || 'cicalengka') as ZoneId;
  const activeTrip = character.activeTrip;

  const handleBuyTicket = async (dest: ZoneId, label: string) => {
    setBusyZone(dest);
    try {
      await callBuyTicket(dest, serverOffsetMs);
      onNotify(`Naik kereta menuju ${label}!`);
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli tiket kereta.');
    } finally {
      setBusyZone(null);
    }
  };

  const handleCompleteTrip = async () => {
    setBusyZone('arrive');
    try {
      const res = await callCompleteTrip();
      onNotify(`Selamat datang di Stasiun ${String(res.currentZone || '').toUpperCase()}!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Kereta masih dalam perjalanan.');
    } finally {
      setBusyZone(null);
    }
  };

  // Overlay Perjalanan Kereta (aksi lain dikunci, Chat tetap bebas dipakai)
  if (activeTrip) {
    const totalMs = Math.max(1000, activeTrip.arrivesAtMs - activeTrip.departedAtMs);
    const elapsed = Math.max(0, serverNowMs - activeTrip.departedAtMs);
    const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
    const remainSec = Math.max(0, Math.ceil((activeTrip.arrivesAtMs - serverNowMs) / 1000));

    return (
      <div className="fixed inset-0 z-25 pointer-events-auto bg-slate-950/70 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-sky-500/50 bg-slate-900 p-5 shadow-2xl text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
            <TrainFront className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Dalam Perjalanan Kereta KRD</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTrip.fromZone.toUpperCase()} → {activeTrip.toLabel}
            </p>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <span>Progres Perjalanan</span>
              <span className="font-mono">{remainSec > 0 ? `${remainSec} detik lagi` : 'Tiba di Stasiun!'}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div style={{ width: `${pct}%` }} className="h-full bg-sky-400 transition-all duration-300" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Aksi lain dikunci selama perjalanan. Kamu tetap bisa membuka Chat Warga di bawah.
          </p>
          <button
            type="button"
            disabled={remainSec > 0 || busyZone !== null}
            onClick={() => void handleCompleteTrip()}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400"
          >
            {busyZone === 'arrive'
              ? 'Turun dari kereta...'
              : remainSec > 0
                ? `Tiba dalam ${remainSec} detik`
                : `Turun di Stasiun ${activeTrip.toLabel}`}
          </button>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl border border-sky-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrainFront className="h-5 w-5 text-sky-400" />
            <div>
              <h2 className="text-base font-bold text-white">Jadwal &amp; Tiket Kereta</h2>
              <p className="text-[11px] text-slate-400">
                Stasiun saat ini: <span className="text-sky-300 font-semibold uppercase">{currentZone}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup loket kereta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Jadwal Deterministik */}
        <div
          className={`mt-3 rounded-xl border p-3 text-xs ${
            trainState.boardingOpen
              ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200'
              : 'border-amber-500/50 bg-amber-950/25 text-amber-200'
          }`}
        >
          {trainState.boardingOpen ? (
            <div className="font-bold">
              Kereta berada di peron! Boarding terbuka ({trainState.boardingRemainSec} detik tersisa)
            </div>
          ) : (
            <div>
              Status kereta: <span className="font-bold uppercase">{trainState.phase}</span> · Tiba di peron
              dalam <span className="font-mono font-bold">{trainState.nextArrivalSec} detik</span>
            </div>
          )}
          {!nearStation && (
            <div className="mt-1 text-[11px] text-rose-300">
              Catatan: Mendekatlah ke peron/loket stasiun untuk membeli tiket kereta.
            </div>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {schedule.destinations.map((dest) => {
            const isHere = dest.id === currentZone;
            const isSuggested = Boolean(initialDestination && dest.id === initialDestination && !isHere);
            const disabled =
              isHere ||
              !nearStation ||
              !trainState.boardingOpen ||
              character.money < dest.ticketPrice ||
              Boolean(character.activeShift) ||
              busyZone !== null;

            return (
              <div
                key={dest.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  isSuggested
                    ? 'border-amber-400 bg-amber-950/25 ring-1 ring-amber-400/40'
                    : 'border-slate-800 bg-slate-950'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    <span>{dest.label}</span>
                    {isSuggested && (
                      <span className="rounded bg-amber-500/20 border border-amber-400/50 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                        Tujuan Kerja
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{dest.subtitle}</p>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Durasi perjalanan: {dest.travelDurationSec} detik
                  </div>
                </div>
                {isHere ? (
                  <span className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">
                    Lokasi Ini
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleBuyTicket(dest.id, dest.label)}
                    className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    {busyZone === dest.id ? '...' : formatRupiah(dest.ticketPrice)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
