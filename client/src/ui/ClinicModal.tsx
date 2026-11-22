import React, { useEffect, useState } from 'react';
import { HeartPulse, Timer, X } from 'lucide-react';
import { callClaimClinic, callVisitClinic } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type { CharacterDoc, ClinicConfigItem } from '../types/game';
import { getNearestValidDestination } from '../world3d/interactions/registry';

interface ClinicModalProps {
  open: boolean;
  character: CharacterDoc;
  clinics: ClinicConfigItem[];
  initialClinicId?: string | null;
  playerPos?: { x: number; z: number };
  serverNowMs: number;
  onGuideToClinic?: (clinicId: string) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const ClinicModal: React.FC<ClinicModalProps> = ({
  open,
  character,
  clinics,
  initialClinicId,
  playerPos,
  serverNowMs,
  onGuideToClinic,
  onClose,
  onNotify,
}) => {
  const [selectedId, setSelectedId] = useState<string>('puskesmas');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialClinicId) {
      setSelectedId(initialClinicId);
    }
  }, [open, initialClinicId]);

  if (!open) return null;

  const activeClinic = character.activeClinic;
  const remainSec = activeClinic
    ? Math.max(0, Math.ceil((activeClinic.completesAtMs - serverNowMs) / 1000))
    : 0;
  const clinic = clinics.find((c) => c.id === selectedId) || clinics[0];
  const nearSelectedClinic =
    !playerPos || !clinic
      ? true
      : getNearestValidDestination('clinic', playerPos, {
          character,
          targetClinicId: clinic.id,
        }).inRange;

  const handleVisit = async (packageId: string, pkgName: string) => {
    if (!clinic) return;
    setBusyKey(packageId);
    try {
      await callVisitClinic(clinic.id, packageId);
      onNotify(`Terdaftar untuk ${pkgName} di ${clinic.name}. Tunggu antrean selesai.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mendaftar di klinik.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleClaim = async () => {
    setBusyKey('claim');
    try {
      const res = await callClaimClinic();
      onNotify(`Perawatan selesai! Kesehatan kini ${Math.round(res.health ?? 100)}%.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Belum bisa klaim perawatan.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl border border-rose-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-rose-400" />
            <div>
              <h2 className="text-base font-bold text-white">Layanan Kesehatan Cicalengka</h2>
              <p className="text-[11px] text-slate-400">
                Saldo: <span className="text-emerald-300 font-semibold">{formatRupiah(character.money)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup klinik"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Antrean Klinik Aktif */}
        {activeClinic && (
          <div className="mt-3 rounded-xl border border-emerald-500/50 bg-emerald-950/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-300">
                {activeClinic.packageName} — {activeClinic.clinicName}
              </span>
              <span className="flex items-center gap-1 font-mono text-amber-300">
                <Timer className="h-3.5 w-3.5" />
                {remainSec > 0 ? `${remainSec}s` : 'Siap!'}
              </span>
            </div>
            <button
              type="button"
              disabled={remainSec > 0 || busyKey !== null}
              onClick={() => void handleClaim()}
              className="w-full rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400"
            >
              {busyKey === 'claim'
                ? 'Memproses...'
                : remainSec > 0
                  ? `Menunggu antrean (${remainSec} detik)`
                  : `Selesaikan & Pulihkan +${activeClinic.healthRestore}% Sehat`}
            </button>
          </div>
        )}

        {/* Pilihan Puskesmas vs Klinik Swasta */}
        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-950 p-1">
          {clinics.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`rounded-lg py-2 px-2 text-xs font-bold ${
                clinic?.id === c.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {clinic && (
          <div className="mt-3 space-y-2.5">
            <p className="text-[11px] text-slate-400">{clinic.description}</p>
            {!nearSelectedClinic && onGuideToClinic && !activeClinic && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/35 p-2.5 text-[11px] text-amber-200 flex flex-wrap items-center justify-between gap-2">
                <span>Kamu sedang berada di luar jangkauan {clinic.name}.</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGuideToClinic(clinic.id);
                  }}
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
                >
                  Arahkan ke Sini
                </button>
              </div>
            )}
            {clinic.packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
              >
                <div>
                  <div className="text-xs font-bold text-white">{pkg.name}</div>
                  <div className="text-[11px] text-slate-400">
                    +{pkg.healthRestore}% Kesehatan · +{pkg.moodRestore} Mood · Antre {pkg.waitSec}d
                  </div>
                </div>
                {!nearSelectedClinic && onGuideToClinic && !activeClinic ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGuideToClinic(clinic.id);
                    }}
                    className="shrink-0 rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                  >
                    Arahkan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(activeClinic) || character.money < pkg.cost || busyKey !== null}
                    onClick={() => void handleVisit(pkg.id, pkg.name)}
                    className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    {busyKey === pkg.id ? '...' : formatRupiah(pkg.cost)}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
