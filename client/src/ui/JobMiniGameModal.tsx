import React, { useEffect, useState } from 'react';
import { Briefcase, Car, CheckCircle2, Hammer, PackageCheck, Timer, Truck, Users } from 'lucide-react';
import { callEndShift } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type { ActiveShiftInfo } from '../types/game';
import type { ActiveDriveVehicle } from '../world3d/vehicles/PlayerVehicleController';

interface JobMiniGameModalProps {
  activeShift: ActiveShiftInfo | null | undefined;
  serverNowMs: number;
  visitedCourierIds: string[];
  activeDriveVehicle?: ActiveDriveVehicle | null;
  onShiftFinished: () => void;
  onNotify: (msg: string) => void;
}

const ROUTE_SHIFT_TYPES = new Set(['kurir', 'ojek_online', 'sopir_angkot', 'sopir_logistik']);

export const JobMiniGameModal: React.FC<JobMiniGameModalProps> = ({
  activeShift,
  serverNowMs,
  visitedCourierIds,
  activeDriveVehicle = null,
  onShiftFinished,
  onNotify,
}) => {
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [needlePos, setNeedlePos] = useState(50);
  const [pabrikHits, setPabrikHits] = useState(0);
  const [pabrikTries, setPabrikTries] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const shiftId = activeShift?.shiftId;
  const prompt = activeShift?.taskPrompt || {};
  const type = String(prompt.type || '');

  useEffect(() => {
    setAnswers({});
    setPabrikHits(0);
    setPabrikTries(0);
  }, [shiftId]);

  useEffect(() => {
    if (type !== 'pabrik') return;
    let frameId = 0;
    const start = performance.now();
    const animate = (t: number) => {
      const val = 50 + Math.sin(((t - start) / 1000) * 3.8) * 46;
      setNeedlePos(val);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [type, shiftId]);

  if (!activeShift) return null;

  const elapsedMs = Math.max(0, serverNowMs - activeShift.startedAtMs);
  const remainSec = Math.max(0, Math.ceil((activeShift.minDurationMs - elapsedMs) / 1000));
  const canCompleteTime = remainSec === 0;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let submission: Record<string, unknown> = {};
      if (type === 'kasir' || type === 'pedagang' || type === 'guru') {
        const count =
          type === 'guru'
            ? ((prompt.questions as unknown[]) || []).length
            : ((prompt.rounds as unknown[]) || []).length;
        const arr = Array.from({ length: count }, (_, i) => Number(answers[i] ?? 0));
        submission = { answers: arr };
      } else if (ROUTE_SHIFT_TYPES.has(type)) {
        const isDriveValid = (() => {
          if (!activeDriveVehicle || activeDriveVehicle.mode === 'test_drive') return false;
          if (type === 'kurir') return activeDriveVehicle.category === 'motor';
          const reqCats = Array.isArray(prompt.requiredCategories)
            ? prompt.requiredCategories.map(String)
            : [];
          if (reqCats.length > 0 && !reqCats.includes(activeDriveVehicle.category)) return false;
          const allowedModels = Array.isArray(prompt.allowedModelIds)
            ? prompt.allowedModelIds.map(String)
            : [];
          if (allowedModels.length > 0 && !allowedModels.includes(activeDriveVehicle.modelId)) {
            return false;
          }
          return true;
        })();
        submission = {
          visitedIds: visitedCourierIds,
          ...(isDriveValid && activeDriveVehicle ? { vehicleId: activeDriveVehicle.vehicleId } : {}),
        };
      } else if (type === 'pabrik') {
        submission = { hits: pabrikHits };
      }

      const res = await callEndShift(submission);
      onShiftFinished();
      const bonusPart =
        res.vehicleBonusPay && res.vehicleBonusPay > 0
          ? ` (+Bonus Armada ${formatRupiah(res.vehicleBonusPay)})`
          : '';
      onNotify(
        `Shift selesai! Skor ${res.score ?? 100}% · Gaji +${formatRupiah(res.payEarned ?? 0)}${bonusPart} (${res.rankTitle || 'Karyawan'})`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyelesaikan shift.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mode Lapangan & Kendaraan: HUD mengambang agar pemain bebas berjalan/mengemudi mengikuti panah 3D
  if (ROUTE_SHIFT_TYPES.has(type)) {
    const targets =
      (prompt.targets as Array<{ id: string; label: string; boarded?: number; alighted?: number }>) || [];
    const visitedSet = new Set(visitedCourierIds);
    const doneCount = targets.filter((t) => visitedSet.has(t.id)).length;
    const isSequential = Boolean(prompt.sequential);
    const requiresVehicle = Boolean(prompt.requiresVehicle);
    const nextIdx = targets.findIndex((t) => !visitedSet.has(t.id));

    const driveMatches = (() => {
      if (!activeDriveVehicle || activeDriveVehicle.mode === 'test_drive') return false;
      if (type === 'kurir') return activeDriveVehicle.category === 'motor';
      const reqCats = Array.isArray(prompt.requiredCategories)
        ? prompt.requiredCategories.map(String)
        : [];
      if (reqCats.length > 0 && !reqCats.includes(activeDriveVehicle.category)) return false;
      const allowedModels = Array.isArray(prompt.allowedModelIds)
        ? prompt.allowedModelIds.map(String)
        : [];
      if (allowedModels.length > 0 && !allowedModels.includes(activeDriveVehicle.modelId)) return false;
      return true;
    })();

    const angkotPassengers =
      type === 'sopir_angkot'
        ? Math.max(
            0,
            targets.reduce((acc, t) => {
              if (!visitedSet.has(t.id)) return acc;
              return Math.max(0, Math.min(8, acc + (t.boarded ?? 2) - (t.alighted ?? 1)));
            }, 0)
          )
        : 0;

    const ShiftIcon =
      type === 'sopir_logistik' ? Truck : type === 'sopir_angkot' || type === 'ojek_online' ? Car : PackageCheck;
    const titleLabel =
      type === 'ojek_online'
        ? 'Order CikOjek'
        : type === 'sopir_angkot'
          ? 'Trayek Angkot'
          : type === 'sopir_logistik'
            ? 'Muatan Logistik'
            : 'Tugas Kurir';

    return (
      <div className="fixed top-20 sm:top-44 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-amber-400/60 bg-slate-900/95 p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShiftIcon className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-white">
              {titleLabel} ({doneCount}/{targets.length})
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-amber-300 font-mono">
            <Timer className="h-3 w-3" /> {remainSec > 0 ? `${remainSec}s` : 'Siap Klaim'}
          </span>
        </div>

        {(requiresVehicle || prompt.vehicleBonusLabel || type === 'sopir_angkot') && (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px]">
            {requiresVehicle ? (
              <span
                className={`rounded px-1.5 py-0.5 font-semibold ${
                  driveMatches
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {driveMatches && activeDriveVehicle
                  ? `Armada Aktif: ${activeDriveVehicle.name}`
                  : 'Naiki kendaraan kerja yang sesuai!'}
              </span>
            ) : (
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                {driveMatches
                  ? `Bonus Motor Aktif (${activeDriveVehicle?.name})`
                  : String(prompt.vehicleBonusLabel || 'Bisa jalan kaki / naik motor (+bonus)')}
              </span>
            )}
            {type === 'sopir_angkot' && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-200 font-semibold">
                <Users className="h-3 w-3" /> {angkotPassengers}/8 Penumpang
              </span>
            )}
          </div>
        )}

        <div className="mt-1.5 space-y-1">
          {targets.map((t, idx) => {
            const ok = visitedSet.has(t.id);
            const isCurrent = isSequential && idx === nextIdx;
            const isLockedFuture = isSequential && !ok && idx > nextIdx && nextIdx !== -1;
            return (
              <div
                key={t.id}
                className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] ${
                  ok
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isCurrent
                      ? 'bg-amber-500/20 border border-amber-400/50 text-amber-100 font-semibold'
                      : 'bg-slate-950 text-slate-400'
                }`}
              >
                <span className="truncate pr-2">
                  {isSequential ? `${idx + 1}. ` : ''}
                  {t.label}
                </span>
                <span className="shrink-0">
                  {ok ? 'Selesai' : isLockedFuture ? 'Menunggu' : 'Ikuti panah 3D'}
                </span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!canCompleteTime || submitting}
          onClick={() => void handleSubmit()}
          className="mt-2 w-full rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400"
        >
          {submitting
            ? 'Menghitung gaji...'
            : !canCompleteTime
              ? `Durasi minimal (${remainSec}d)`
              : `Selesaikan Shift (${doneCount}/${targets.length})`}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl border border-amber-500/50 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {String(prompt.title || activeShift.jobTitle)}
              </h2>
              <p className="text-[11px] text-slate-400">{String(prompt.instructions || '')}</p>
            </div>
          </div>
          <span className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-mono text-amber-300">
            {remainSec > 0 ? `${remainSec}s` : 'Siap'}
          </span>
        </div>

        {/* Kasir Minimarket */}
        {type === 'kasir' && (
          <div className="mt-4 space-y-3">
            {((prompt.rounds as Array<{ id: number; total: number; paid: number }>) || []).map(
              (r, idx) => (
                <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1.5">
                  <div className="text-xs font-semibold text-white">
                    Pelanggan #{idx + 1}: Belanja {formatRupiah(r.total)} · Bayar {formatRupiah(r.paid)}
                  </div>
                  <input
                    type="number"
                    placeholder="Masukkan kembalian (angka saja, misal 7500)"
                    value={answers[idx] ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )
            )}
          </div>
        )}

        {/* Pedagang Pasar */}
        {type === 'pedagang' && (
          <div className="mt-4 space-y-3">
            {(
              (prompt.rounds as Array<{
                id: number;
                itemName: string;
                unit: string;
                unitPrice: number;
                qty: number;
              }>) || []
            ).map((r, idx) => (
              <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1.5">
                <div className="text-xs font-semibold text-white">
                  Pembeli NPC #{idx + 1}: {r.qty} {r.unit} {r.itemName} (@ {formatRupiah(r.unitPrice)})
                </div>
                <input
                  type="number"
                  placeholder="Total harga pesanan (Rp)"
                  value={answers[idx] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}

        {/* Guru Honorer */}
        {type === 'guru' && (
          <div className="mt-4 space-y-3">
            {((prompt.questions as Array<{ id: number; q: string; options: string[] }>) || []).map(
              (q, idx) => (
                <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="text-xs font-semibold text-white">
                    {idx + 1}. {q.q}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {q.options.map((opt, optIdx) => {
                      const picked = Number(answers[idx]) === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [idx]: optIdx }))}
                          className={`rounded-lg border px-3 py-1.5 text-left text-xs ${
                            picked
                              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 font-semibold'
                              : 'border-slate-700 bg-slate-900 text-slate-300'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Buruh Pabrik (Ritme Timing Bar) */}
        {type === 'pabrik' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
              <div className="text-xs text-slate-300 mb-3">
                Tepat Sasaran: <span className="font-bold text-emerald-300">{pabrikHits}</span> / 10 (Percobaan:{' '}
                {pabrikTries}/10)
              </div>
              <div className="relative h-7 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                {/* Zona Hijau Tengah (36% - 64%) */}
                <div className="absolute top-0 bottom-0 left-[36%] right-[36%] bg-emerald-500/45 border-x border-emerald-400" />
                {/* Jarum Bergerak */}
                <div
                  style={{ left: `calc(${needlePos}% - 4px)` }}
                  className="absolute top-0 bottom-0 w-2 bg-amber-300 shadow"
                />
              </div>
              <button
                type="button"
                disabled={pabrikTries >= 10}
                onClick={() => {
                  const inGreen = needlePos >= 34 && needlePos <= 66;
                  setPabrikTries((t) => Math.min(10, t + 1));
                  if (inGreen) setPabrikHits((h) => Math.min(10, h + 1));
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400"
              >
                <Hammer className="h-4 w-4" />
                {pabrikTries >= 10 ? 'Target 10 Jahitan Selesai!' : 'Tekan Jahit Saat di Zona Hijau'}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!canCompleteTime || submitting}
          onClick={() => void handleSubmit()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400"
        >
          <CheckCircle2 className="h-4 w-4" />
          {submitting
            ? 'Menilai hasil kerja di server...'
            : !canCompleteTime
              ? `Tunggu durasi minimal (${remainSec} detik)`
              : 'Selesaikan Shift & Terima Gaji'}
        </button>
      </div>
    </div>
  );
};
