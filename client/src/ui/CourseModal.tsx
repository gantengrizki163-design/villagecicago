import React, { useState } from 'react';
import { GraduationCap, Timer, X } from 'lucide-react';
import { callClaimCourse, callEnrollCourse } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type { CharacterDoc, CourseConfigItem } from '../types/game';

interface CourseModalProps {
  open: boolean;
  character: CharacterDoc;
  courses: CourseConfigItem[];
  serverNowMs: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const CourseModal: React.FC<CourseModalProps> = ({
  open,
  character,
  courses,
  serverNowMs,
  onClose,
  onNotify,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) return null;

  const active = character.activeCourse;
  const remainSec = active ? Math.max(0, Math.ceil((active.completesAtMs - serverNowMs) / 1000)) : 0;

  const handleEnroll = async (course: CourseConfigItem) => {
    setBusyId(course.id);
    try {
      await callEnrollCourse(course.id);
      onNotify(`Mendaftar ${course.title}! Selesaikan dalam ${course.durationSec} detik.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mendaftar kursus.');
    } finally {
      setBusyId(null);
    }
  };

  const handleClaim = async () => {
    setBusyId('claim');
    try {
      await callClaimCourse();
      onNotify('Sertifikat kursus diklaim! Skill bertambah.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Kursus belum selesai.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl border border-violet-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-violet-400" />
            <div>
              <h2 className="text-base font-bold text-white">Balai Kursus Cicalengka</h2>
              <p className="text-[11px] text-slate-400">
                Tingkatkan skill untuk membuka pekerjaan gaji tinggi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup kursus"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {active && (
          <div className="mt-3 rounded-xl border border-violet-500/50 bg-violet-950/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-violet-200">{active.title}</span>
              <span className="flex items-center gap-1 font-mono text-amber-300">
                <Timer className="h-3.5 w-3.5" /> {remainSec > 0 ? `${remainSec}s` : 'Selesai!'}
              </span>
            </div>
            <button
              type="button"
              disabled={remainSec > 0 || busyId !== null}
              onClick={() => void handleClaim()}
              className="w-full rounded-xl bg-violet-400 py-2 text-xs font-bold text-slate-950 hover:bg-violet-300 disabled:bg-slate-800 disabled:text-slate-400"
            >
              {busyId === 'claim'
                ? 'Memproses...'
                : remainSec > 0
                  ? `Belajar (${remainSec} detik lagi)`
                  : `Klaim +${active.skillGain} Skill ${active.skillKey}`}
            </button>
          </div>
        )}

        <div className="mt-3 space-y-2.5">
          {courses.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">{c.title}</div>
                <p className="text-[11px] text-slate-400">{c.description}</p>
                <div className="mt-1 flex gap-1.5 text-[10px]">
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-violet-300 font-semibold uppercase">
                    +{c.skillGain} {c.skillKey}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                    Durasi {c.durationSec}s
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(active) || character.money < c.cost || busyId !== null}
                onClick={() => void handleEnroll(c)}
                className="shrink-0 rounded-xl bg-violet-500 px-3 py-2 text-xs font-bold text-white hover:bg-violet-400 disabled:bg-slate-800 disabled:text-slate-500"
              >
                {busyId === c.id ? '...' : formatRupiah(c.cost)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
