import React, { useState } from 'react';
import { Briefcase, Building2, Car, CheckCircle2, MapPin, ShieldCheck, X } from 'lucide-react';
import { callApplyJob, callHireEmployee, callResignJob, callStartShift } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { evaluateVehicleJobEligibilityClient } from '../firebase/vehicleConfigCache';
import type {
  BusinessDoc,
  BusinessJobPostDoc,
  CharacterDoc,
  JobConfigItem,
  PropertyDoc,
  SkillKey,
  VehicleDoc,
} from '../types/game';
import { getNearestValidDestination } from '../world3d/interactions/registry';

interface JobsModalProps {
  open: boolean;
  character: CharacterDoc;
  jobs: JobConfigItem[];
  vehicles?: VehicleDoc[];
  serverNowMs?: number;
  businessJobPosts?: BusinessJobPostDoc[];
  businesses?: BusinessDoc[];
  properties?: PropertyDoc[];
  playerPos?: { x: number; z: number };
  highlightJobId?: string | null;
  onGuideToJob?: (jobId: string) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const JobsModal: React.FC<JobsModalProps> = ({
  open,
  character,
  jobs,
  vehicles = [],
  serverNowMs = Date.now(),
  businessJobPosts = [],
  businesses = [],
  properties = [],
  playerPos,
  highlightJobId,
  onGuideToJob,
  onClose,
  onNotify,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) return null;

  const skills = character.skills || { komunikasi: 0, fisik: 0, hitung: 0, teknis: 0 };
  const currentJob = character.currentJob;
  const currentZone = character.currentZone || 'cicalengka';
  const openPosts = businessJobPosts.filter((p) => p.status === 'open' && p.slotsOpen > 0);

  const handleApply = async (job: JobConfigItem) => {
    setBusyId(job.id);
    try {
      await callApplyJob(job.id);
      onNotify(`Selamat! Kamu diterima sebagai ${job.title} di ${job.employer}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal melamar pekerjaan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyBizPost = async (post: BusinessJobPostDoc) => {
    setBusyId(post.id);
    try {
      await callHireEmployee({ postId: post.id });
      onNotify(`Diterima sebagai ${post.roleTitle} di ${post.businessName}!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal melamar ke usaha pemain.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStartShift = async () => {
    setBusyId('start_shift');
    try {
      const res = await callStartShift();
      if (res.fired) {
        onNotify('Kamu dipecat karena terlalu lama bolos shift! Lamar ulang pekerjaan.');
      } else {
        onNotify('Shift dimulai! Selesaikan tugas kerjamu.');
        onClose();
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memulai shift.');
    } finally {
      setBusyId(null);
    }
  };

  const handleResign = async () => {
    setBusyId('resign');
    try {
      await callResignJob();
      onNotify('Berhasil mengundurkan diri dari pekerjaan.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengundurkan diri.');
    } finally {
      setBusyId(null);
    }
  };

  const isAtJobLocation = (jobId: string): boolean => {
    if (!playerPos) return true;
    const lookup = getNearestValidDestination('jobs', playerPos, {
      character,
      jobs,
      businessJobPosts,
      businesses,
      properties,
      targetJobId: jobId,
    });
    return lookup.inRange;
  };

  const currentJobInRange = currentJob ? isAtJobLocation(currentJob.jobId) : false;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl border border-amber-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">Lowongan &amp; Pekerjaan</h2>
              <p className="text-[11px] text-slate-400">
                Zona sekarang: <span className="text-sky-300 font-semibold uppercase">{currentZone}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup panel kerja"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Pekerjaan Aktif */}
        {currentJob && (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-emerald-300">
                  Aktif: {currentJob.title} ({currentJob.rankTitle})
                </div>
                <div className="text-[11px] text-slate-300">
                  {currentJob.employer} · {currentJob.shiftsCompleted} shift ({currentJob.totalWorkSeconds}d kerja)
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!currentJobInRange && onGuideToJob && !character.activeShift ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGuideToJob(currentJob.jobId);
                    }}
                    className="rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                  >
                    Arahkan ke Tempat Kerja
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId !== null || Boolean(character.activeShift)}
                    onClick={() => void handleStartShift()}
                    className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {character.activeShift ? 'Shift Aktif' : busyId === 'start_shift' ? '...' : 'Mulai Shift'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId !== null || Boolean(character.activeShift)}
                  onClick={() => void handleResign()}
                  className="rounded-xl border border-rose-500/50 bg-rose-950/60 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/60 disabled:opacity-50"
                >
                  Resign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Daftar Lowongan */}
        <div className="mt-3 space-y-2.5 overflow-y-auto pr-1">
          {jobs.map((job) => {
            const isCurrent = currentJob?.jobId === job.id;
            const isHighlighted = highlightJobId === job.id;
            const meetsSkills = (Object.keys(job.requiredSkills) as SkillKey[]).every(
              (k) => (skills[k] || 0) >= (job.requiredSkills[k] || 0)
            );
            const vehElig = evaluateVehicleJobEligibilityClient(
              job,
              vehicles,
              character,
              serverNowMs
            );
            const meetsVehicle = !vehElig.requiresVehicle || !vehElig.errorReason;
            const canApply = meetsSkills && meetsVehicle;

            return (
              <div
                key={job.id}
                className={`rounded-xl border p-3 transition ${
                  isHighlighted
                    ? 'border-amber-400 bg-slate-950'
                    : isCurrent
                      ? 'border-emerald-500/60 bg-slate-950'
                      : 'border-slate-800 bg-slate-950/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-white">{job.title}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-sky-300 uppercase">
                        {job.zone}
                      </span>
                      {job.vehicleReq && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          <Car className="h-2.5 w-2.5" /> Kendaraan
                        </span>
                      )}
                      {isCurrent && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Pekerjaanmu
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                      {job.location.label}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300 font-semibold">
                        Gaji dasar {formatRupiah(job.basePay)}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                        -{job.energyCost} Energi · -{job.hygieneCost} Bersih
                      </span>
                      {(Object.keys(job.requiredSkills) as SkillKey[])
                        .filter((k) => job.requiredSkills[k] > 0)
                        .map((k) => {
                          const ok = (skills[k] || 0) >= job.requiredSkills[k];
                          return (
                            <span
                              key={k}
                              className={`rounded px-1.5 py-0.5 ${
                                ok
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-rose-500/15 text-rose-300'
                              }`}
                            >
                              {k} {skills[k] || 0}/{job.requiredSkills[k]}
                            </span>
                          );
                        })}
                    </div>

                    {(job.vehicleReq || job.vehicleBonusHint) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {job.vehicleReq ? (
                          <>
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${
                                vehElig.hasValidSim
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-rose-500/15 text-rose-300'
                              }`}
                            >
                              <ShieldCheck className="h-3 w-3" />
                              SIM {job.vehicleReq.requiredSim} {vehElig.hasValidSim ? 'Aktif' : 'Belum Punya'}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-medium ${
                                vehElig.operationalVehicles.length > 0
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-rose-500/15 text-rose-300'
                              }`}
                            >
                              {vehElig.preferredVehicle
                                ? `Unit: ${vehElig.preferredVehicle.name}`
                                : job.id === 'sopir_angkot'
                                  ? 'Butuh Angkot'
                                  : job.id === 'sopir_logistik'
                                    ? 'Butuh Pickup/Truk'
                                    : 'Butuh Motor'}
                            </span>
                            {vehElig.bonusLabel ? (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300 font-semibold">
                                {vehElig.bonusLabel}
                              </span>
                            ) : job.vehicleReq.bonusLabel ? (
                              <span className="text-slate-400">{job.vehicleReq.bonusLabel}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                            {vehElig.bonusLabel || job.vehicleBonusHint}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!isCurrent && (
                    !isAtJobLocation(job.id) && onGuideToJob && !currentJob && canApply ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onGuideToJob(job.id);
                        }}
                        className="shrink-0 rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                      >
                        Arahkan
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(currentJob) || !canApply || busyId !== null}
                        onClick={() => void handleApply(job)}
                        title={vehElig.errorReason || undefined}
                        className="shrink-0 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        {busyId === job.id ? '...' : currentJob ? 'Terikat' : 'Lamar'}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {openPosts.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                <Building2 className="h-3.5 w-3.5" />
                Lowongan Usaha Pemain ({openPosts.length})
              </div>
              {openPosts.map((post) => {
                const isOwnBiz = post.ownerId === character.uid;
                const isCurrent = currentJob?.jobId === `biz_${post.businessId}`;
                return (
                  <div
                    key={post.id}
                    className={`rounded-xl border p-3 ${
                      isCurrent ? 'border-emerald-500/60 bg-slate-950' : 'border-sky-500/30 bg-slate-950/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-white">{post.roleTitle}</span>
                          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300 uppercase">
                            {post.businessType}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Pekerjaanmu
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{post.businessName}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300 font-semibold">
                            Upah {formatRupiah(post.wagePerShift)} / shift
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                            Slot tersisa: {post.slotsOpen}
                          </span>
                        </div>
                      </div>

                      {!isCurrent && (
                        !isAtJobLocation(`biz_${post.businessId}`) && onGuideToJob && !isOwnBiz && !currentJob ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onGuideToJob(`biz_${post.businessId}`);
                            }}
                            className="shrink-0 rounded-xl border border-sky-400/60 bg-sky-500/20 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30"
                          >
                            Arahkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isOwnBiz || Boolean(currentJob) || busyId !== null}
                            onClick={() => void handleApplyBizPost(post)}
                            className="shrink-0 rounded-xl bg-sky-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-300 disabled:bg-slate-800 disabled:text-slate-500"
                          >
                            {busyId === post.id
                              ? '...'
                              : isOwnBiz
                                ? 'Usahamu'
                                : currentJob
                                  ? 'Terikat'
                                  : 'Lamar'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
