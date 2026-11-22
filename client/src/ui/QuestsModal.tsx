import React, { useMemo, useState } from 'react';
import { CheckCircle2, Compass, ScrollText, Sparkles, X, XCircle } from 'lucide-react';
import { callAbandonQuest, callAcceptQuest, callCompleteQuest } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import {
  computeClientNpcPose,
  DEFAULT_NPCS_CONFIG,
  type NpcsConfigBundle,
} from '../firebase/npcDeterminism';
import type {
  CharacterDoc,
  PlayerQuestLogDoc,
  QuestTemplateDoc,
  QuestsConfigDoc,
} from '../types/game';
import { distance2D } from '../world3d/worldConstants';

interface QuestsModalProps {
  open: boolean;
  character: CharacterDoc;
  questsConfig: QuestsConfigDoc;
  questTemplates: QuestTemplateDoc[];
  questLogs: PlayerQuestLogDoc[];
  npcsConfig?: NpcsConfigBundle;
  playerPos: { x: number; z: number };
  serverNowMs: number;
  onTalkToNpc?: (npcId: string) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const QuestsModal: React.FC<QuestsModalProps> = ({
  open,
  character,
  questsConfig,
  questTemplates,
  questLogs,
  npcsConfig = DEFAULT_NPCS_CONFIG,
  playerPos,
  serverNowMs,
  onTalkToNpc,
  onClose,
  onNotify,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  const templates = useMemo(
    () => (questTemplates.length > 0 ? questTemplates : questsConfig.quests).filter((q) => q.active !== false),
    [questTemplates, questsConfig.quests]
  );

  if (!open) return null;

  const activeLogs = questLogs.filter((l) => l.status === 'active');
  const todayKey = new Date(serverNowMs).toISOString().slice(0, 10);
  const completedTodayLogs = questLogs.filter(
    (l) => l.status === 'completed' && (!l.dayKey || l.dayKey === todayKey)
  );
  const completedCountToday = Math.max(
    character.questLog?.completedToday ?? 0,
    completedTodayLogs.length
  );

  const getNpcDistance = (npcId: string) => {
    const def = npcsConfig.npcs.find((n) => n.id === npcId);
    if (!def) return 999;
    const pose = computeClientNpcPose(def, serverNowMs, playerPos, npcsConfig.lodActiveRadiusMeters);
    return { pose, dist: distance2D(playerPos.x, playerPos.z, pose.x, pose.z) };
  };

  const handleAccept = async (questId: string) => {
    setBusyId(`accept_${questId}`);
    try {
      const res = await callAcceptQuest(questId);
      onNotify(`Misi "${res.title}" diambil! Selesaikan sesuai petunjuk lokasi.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengambil tugas warga.');
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (log: PlayerQuestLogDoc) => {
    setBusyId(`complete_${log.id}`);
    try {
      const res = await callCompleteQuest({ logId: log.id, questId: log.questId });
      onNotify(
        `Tugas "${log.title}" selesai! +${formatRupiah(res.rewardMoney)} & +${res.rewardRep} Reputasi.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Belum memenuhi jarak atau syarat penyelesaian tugas.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAbandon = async (log: PlayerQuestLogDoc) => {
    setBusyId(`abandon_${log.id}`);
    try {
      await callAbandonQuest({ logId: log.id, questId: log.questId });
      onNotify(`Tugas "${log.title}" dibatalkan.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membatalkan tugas.');
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <ScrollText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Papan Tugas &amp; Misi Warga Cicalengka
              </h2>
              <p className="text-[11px] text-slate-400">
                Bantu warga sekitar Alun-Alun, Pasar, dan Kampung untuk uang &amp; reputasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            aria-label="Tutup panel tugas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Daily Limits Strip */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2.5 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Tugas Aktif</div>
            <div className="font-mono tabular-nums text-xs sm:text-sm font-bold text-sky-300">
              {activeLogs.length} / {questsConfig.maxActiveQuestsPerPlayer}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Selesai Hari Ini</div>
            <div className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-300">
              {completedCountToday} / {questsConfig.maxCompletedQuestsPerDay}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Batas Hadiah/Hari</div>
            <div className="font-mono tabular-nums text-xs sm:text-sm font-bold text-amber-300">
              {formatRupiah(questsConfig.maxDailyQuestMoneyCap)}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Quests */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Sedang Dikerjakan ({activeLogs.length})
            </h3>
            {activeLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                Belum ada misi aktif. Ambil tugas dari daftar warga di bawah.
              </div>
            ) : (
              activeLogs.map((log) => {
                const tpl = templates.find((t) => t.id === log.questId);
                const targetCoords =
                  tpl?.objective.targetPos ||
                  tpl?.objective.searchPos ||
                  tpl?.objective.checkpointPos ||
                  tpl?.objective.returnPos;
                const distToTarget = targetCoords
                  ? Math.round(distance2D(playerPos.x, playerPos.z, targetCoords.x, targetCoords.z))
                  : null;
                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-emerald-500/35 bg-slate-950/85 p-3 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">{log.title}</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{log.description}</div>
                        {tpl?.objective.targetLabel && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-sky-300">
                            <Compass className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Tujuan: {tpl.objective.targetLabel}
                              {distToTarget !== null ? ` (${distToTarget}m)` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right font-mono tabular-nums text-[11px] font-bold text-amber-300 shrink-0">
                        <div>+{formatRupiah(log.rewardMoney ?? tpl?.rewardMoney ?? 0)}</div>
                        <div className="text-emerald-300">+{log.rewardRep ?? tpl?.rewardRep ?? 0} Rep</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void handleComplete(log)}
                        className="min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-45"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{busyId === `complete_${log.id}` ? '...' : 'Selesaikan'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void handleAbandon(log)}
                        className="min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-45"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Batalkan</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Available Quests */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Daftar Misi Warga Tersedia
            </h3>
            {templates.map((q) => {
              const isActive = activeLogs.some((l) => l.questId === q.id);
              const doneToday = completedTodayLogs.filter((l) => l.questId === q.id).length;
              const limitReached = doneToday >= q.dailyLimit;
              const npcInfo = getNpcDistance(q.npcId);
              const dist = typeof npcInfo === 'number' ? npcInfo : Math.round(npcInfo.dist);

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                        <span className="truncate">{q.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">{q.description}</p>
                      <div className="mt-1 text-[11px] text-slate-400">
                        Pemberi: <strong className="text-slate-200">{q.npcName}</strong> · Jarak{' '}
                        <span className="font-mono tabular-nums text-sky-300">{dist}m</span>
                        {dist > 14 && ' (mendekat ≤ 14m untuk ambil)'}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums text-[11px] font-bold shrink-0">
                      <div className="text-amber-300">+{formatRupiah(q.rewardMoney)}</div>
                      <div className="text-emerald-300">+{q.rewardRep} Rep</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isActive || limitReached || busyId !== null}
                      onClick={() => void handleAccept(q.id)}
                      className="min-h-[40px] flex-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      {isActive
                        ? 'Sedang Dikerjakan'
                        : limitReached
                          ? 'Selesai Hari Ini'
                          : busyId === `accept_${q.id}`
                            ? 'Memproses...'
                            : 'Ambil Tugas'}
                    </button>
                    {onTalkToNpc && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onTalkToNpc(q.npcId);
                        }}
                        className="min-h-[40px] rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Temui {q.npcName.split(' ')[0]}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
