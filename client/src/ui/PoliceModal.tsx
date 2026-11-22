import React, { useState } from 'react';
import {
  BadgeAlert,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Shield,
  Siren,
  Unlock,
  X,
} from 'lucide-react';
import {
  callArrestPlayer,
  callIssueFine,
  callReleasePlayer,
  callReviewPoliceAction,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type {
  CharacterDoc,
  CrimeRecordDoc,
  LawConfigDoc,
  PoliceActionDoc,
  RTDBPlayer,
  SentenceDoc,
} from '../types/game';
import { distance2D } from '../world3d/worldConstants';

interface PoliceModalProps {
  open: boolean;
  character: CharacterDoc;
  lawConfig: LawConfigDoc;
  remotePlayers: RTDBPlayer[];
  crimeRecords: CrimeRecordDoc[];
  activeSentences: SentenceDoc[];
  policeActions: PoliceActionDoc[];
  playerPos: { x: number; z: number };
  serverNowMs: number;
  onOpenJobsModal: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type PoliceTab = 'patrol' | 'jail' | 'audit';

export const PoliceModal: React.FC<PoliceModalProps> = ({
  open,
  character,
  lawConfig,
  remotePlayers,
  crimeRecords,
  activeSentences,
  policeActions,
  playerPos,
  serverNowMs,
  onOpenJobsModal,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<PoliceTab>('patrol');
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) return null;

  const isPolice = character.currentJob?.jobId === 'polisi';
  const arrestRadius = lawConfig.policeEnforcement?.arrestRadiusMeters ?? 8;
  const suspendedUntilMs =
    character.policeOfficerStats?.suspendedUntilMs ??
    character.policeStats?.suspendedUntilMs ??
    0;
  const isSuspended = suspendedUntilMs > serverNowMs;
  const arrestsCount =
    character.policeOfficerStats?.arrestsCount ?? character.policeStats?.arrestsCount ?? 0;
  const finesCount =
    character.policeOfficerStats?.finesIssued ?? character.policeStats?.finesIssued ?? 0;
  const abuseStrikes =
    character.policeOfficerStats?.abuseStrikes ?? character.policeStats?.abuseStrikes ?? 0;

  const otherPlayers = remotePlayers
    .filter((p) => p.uid !== character.uid)
    .map((p) => ({
      player: p,
      distance: distance2D(playerPos.x, playerPos.z, p.x, p.z),
      openRecords: crimeRecords.filter(
        (r) =>
          (r.characterId === p.uid || r.uid === p.uid) &&
          r.status !== 'paid' &&
          r.status !== 'resolved' &&
          r.status !== 'expired'
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const openEvidenceRecords = crimeRecords.filter(
    (r) =>
      r.status !== 'paid' &&
      r.status !== 'resolved' &&
      r.status !== 'expired' &&
      (r.characterId !== character.uid && r.uid !== character.uid)
  );

  const handleArrest = async (targetUid: string, targetName: string) => {
    setBusyId(`arrest_${targetUid}`);
    try {
      const res = await callArrestPlayer(targetUid);
      onNotify(
        `Berhasil menangkap ${targetName}! Insentif tugas: +${formatRupiah(res.reward || lawConfig.policeEnforcement?.arrestReward || 18000)}.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || `Gagal menangkap ${targetName}.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleIssueFine = async (targetUid: string, recordId?: string, label?: string) => {
    setBusyId(`fine_${recordId || targetUid}`);
    try {
      const res = await callIssueFine(targetUid, recordId);
      onNotify(
        `Surat tilang/denda ${formatRupiah(res.fineAmount || 0)} diterbitkan untuk ${label || 'pelanggar'}.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menerbitkan surat denda.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRelease = async (targetUid: string) => {
    setBusyId(`release_${targetUid}`);
    try {
      await callReleasePlayer(targetUid, 'Pembebasan resmi oleh petugas piket');
      onNotify('Tahanan berhasil dibebaskan dari sel Polsek.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membebaskan tahanan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReviewAction = async (actionId: string) => {
    setBusyId(`review_${actionId}`);
    try {
      const res = await callReviewPoliceAction(actionId);
      onNotify(`Audit Propam selesai — status tindakan: ${res.status || 'valid'}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengajukan audit Propam.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Komando Patroli Polsek Cicalengka
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {isPolice
                  ? `${character.currentJob?.rankTitle || 'Petugas Patroli'} · Penangkapan butuh bukti sah & jarak ≤ ${arrestRadius}m`
                  : 'Khusus karakter yang aktif bertugas sebagai Polisi Cicalengka'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            aria-label="Tutup panel polisi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Strip Rekam Tugas */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2.5 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Penangkapan</div>
            <div className="font-mono tabular-nums text-xs sm:text-sm font-bold text-sky-300">
              {arrestsCount} kasus
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Tilang / Denda</div>
            <div className="font-mono tabular-nums text-xs sm:text-sm font-bold text-amber-300">
              {finesCount} surat
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Teguran Propam</div>
            <div
              className={`font-mono tabular-nums text-xs sm:text-sm font-bold ${
                abuseStrikes > 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}
            >
              {abuseStrikes} / {lawConfig.policeEnforcement?.abuseMaxStrikes ?? 3}
            </div>
          </div>
        </div>

        {!isPolice ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Briefcase className="h-4 w-4 text-sky-400" />
                <span>Belum Terdaftar sebagai Polisi</span>
              </div>
              <p className="text-xs text-slate-300">
                Untuk mengakses tugas penangkapan, penilangan, dan pengelolaan sel tahanan, melamar pekerjaan <strong>Polisi Cicalengka</strong> terlebih dahulu di daftar lowongan kerja.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenJobsModal();
                }}
                className="mt-2 min-h-[44px] w-full rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
              >
                Buka Lowongan Kerja Polisi
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/90 px-3 pt-2 gap-1 overflow-x-auto shrink-0">
              {[
                { id: 'patrol' as PoliceTab, label: 'Patroli & Penangkapan', icon: Siren },
                { id: 'jail' as PoliceTab, label: `Tahanan (${activeSentences.length})`, icon: Unlock },
                { id: 'audit' as PoliceTab, label: 'Audit Propam', icon: ClipboardCheck },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                      tab === item.id
                        ? 'border-sky-400 bg-slate-800/80 text-sky-200'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isSuspended && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-3 text-xs text-rose-200">
                  Lencana polisi sedang dibekukan sementara oleh Propam akibat penyalahgunaan wewenang.
                </div>
              )}

              {tab === 'patrol' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Pemain Online &amp; Status Bukti
                    </h3>
                    {otherPlayers.length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
                        Belum ada pemain lain yang aktif di sekitar zona saat ini.
                      </div>
                    ) : (
                      otherPlayers.map(({ player, distance, openRecords }) => {
                        const inRange = distance <= arrestRadius;
                        const hasEvidence = openRecords.length > 0;
                        return (
                          <div
                            key={player.uid}
                            className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{player.name}</span>
                                <span className="font-mono tabular-nums text-[11px] font-normal text-slate-400">
                                  ({Math.round(distance)}m)
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {hasEvidence
                                  ? `${openRecords.length} catatan bukti aktif (${openRecords[0].offenseTitle})`
                                  : 'Tidak ada bukti pelanggaran aktif'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={!inRange || !hasEvidence || isSuspended || busyId !== null}
                                onClick={() => void handleArrest(player.uid, player.name)}
                                className="min-h-[40px] rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                              >
                                {busyId === `arrest_${player.uid}` ? '...' : 'Tangkap'}
                              </button>
                              <button
                                type="button"
                                disabled={!inRange || !hasEvidence || isSuspended || busyId !== null}
                                onClick={() =>
                                  void handleIssueFine(
                                    player.uid,
                                    openRecords[0]?.id,
                                    player.name
                                  )
                                }
                                className="min-h-[40px] rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                              >
                                Denda
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Laporan bukti terbuka */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Berkas Laporan Kriminal Terbuka
                    </h3>
                    {openEvidenceRecords.length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                        Tidak ada laporan kriminal terbuka di wilayah Cicalengka.
                      </div>
                    ) : (
                      openEvidenceRecords.map((rec) => {
                        const targetUid = rec.characterId || rec.uid || '';
                        const targetLabel = rec.characterName || rec.playerName || targetUid;
                        return (
                          <div
                            key={rec.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {rec.offenseTitle} — {targetLabel}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                                Status: {rec.status} · Denda {formatRupiah(rec.fine ?? rec.fineAmount ?? 0)}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={isSuspended || busyId !== null || !targetUid}
                              onClick={() => void handleIssueFine(targetUid, rec.id, targetLabel)}
                              className="min-h-[40px] shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                            >
                              Tilang
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {tab === 'jail' && (
                <div className="space-y-2.5">
                  {activeSentences.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-center text-xs text-slate-400">
                      Sel tahanan Polsek Cicalengka saat ini kosong.
                    </div>
                  ) : (
                    activeSentences.map((s) => {
                      const remSec = Math.max(0, Math.ceil((s.endAtMs - serverNowMs) / 1000));
                      return (
                        <div
                          key={s.uid}
                          className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white">UID: {s.uid}</div>
                            <div className="text-[11px] text-slate-400">
                              {s.reason || 'Pelanggaran hukum'} · Sisa{' '}
                              <span className="font-mono tabular-nums text-amber-300">
                                {Math.floor(remSec / 60)}m {remSec % 60}d
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void handleRelease(s.uid)}
                            className="min-h-[40px] shrink-0 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-45"
                          >
                            Bebaskan
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {tab === 'audit' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-400">
                    Semua penangkapan dan penilangan tercatat transparan untuk mencegah penyalahgunaan wewenang.
                  </p>
                  {policeActions.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-center text-xs text-slate-400">
                      Belum ada log tindakan polisi yang tercatat.
                    </div>
                  ) : (
                    policeActions.map((act) => (
                      <div
                        key={act.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            {act.reviewStatus === 'abuse' ? (
                              <BadgeAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                            ) : act.reviewStatus === 'valid' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <FileWarning className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            )}
                            <span className="truncate">
                              {act.action.toUpperCase()} · {act.officerName || act.officerId} →{' '}
                              {act.targetName || act.targetId}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Bukti: {act.evidence || '-'} · Status:{' '}
                            <span className="font-semibold text-slate-200">
                              {act.reviewStatus || (act.reviewed ? 'valid' : 'belum diaudit')}
                            </span>
                          </div>
                        </div>
                        {!act.reviewed && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void handleReviewAction(act.id)}
                            className="min-h-[38px] shrink-0 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25"
                          >
                            Audit Propam
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
