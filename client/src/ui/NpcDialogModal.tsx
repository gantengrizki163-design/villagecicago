import React, { useCallback, useEffect, useState } from 'react';
import {
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import {
  callAcceptQuest,
  callCompleteQuest,
  callExecuteNpcAction,
  callGetNpcOptions,
  callTalkToNpc,
  type NpcOptionItem,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import {
  computeClientNpcPose,
  DEFAULT_NPCS_CONFIG,
  formatNpcActivityLabel,
  type NpcsConfigBundle,
} from '../firebase/npcDeterminism';
import type { CharacterDoc, Phase6AiConfigDoc, PlayerQuestLogDoc } from '../types/game';

interface ChatLine {
  id: string;
  sender: 'player' | 'npc' | 'system';
  text: string;
  sourceLabel?: string;
}

interface NpcDialogModalProps {
  open: boolean;
  npcId: string | null;
  character: CharacterDoc;
  npcsConfig?: NpcsConfigBundle;
  aiConfig: Phase6AiConfigDoc;
  questLogs: PlayerQuestLogDoc[];
  playerPos: { x: number; z: number };
  serverNowMs: number;
  onNavigateHint?: (uiHint: string) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const NpcDialogModal: React.FC<NpcDialogModalProps> = ({
  open,
  npcId,
  character,
  npcsConfig = DEFAULT_NPCS_CONFIG,
  aiConfig,
  questLogs,
  playerPos,
  serverNowMs,
  onNavigateHint,
  onClose,
  onNotify,
}) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [npcMeta, setNpcMeta] = useState<{
    name: string;
    role: string;
    personality: string;
    activity: string;
    zoneTag: string;
    isSleeping: boolean;
    affinity: number;
    summary: string;
    mood: string;
    options: NpcOptionItem[];
  } | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [remainingCalls, setRemainingCalls] = useState<number>(aiConfig.dailyCallsLimit);

  const loadNpcContext = useCallback(async () => {
    if (!npcId) return;
    setLoading(true);
    try {
      const def = npcsConfig.npcs.find((n) => n.id === npcId);
      const localPose = def
        ? computeClientNpcPose(def, serverNowMs, playerPos, npcsConfig.lodActiveRadiusMeters)
        : null;

      const res = await callGetNpcOptions(npcId);
      setNpcMeta({
        name: res.name || localPose?.name || 'Warga Cicalengka',
        role: res.role || localPose?.role || 'warga',
        personality: res.personality || localPose?.personality || 'Ramah dan suka membantu',
        activity: res.activity || localPose?.activity || 'kerja',
        zoneTag: res.zoneTag || localPose?.zoneTag || 'alun_alun',
        isSleeping: res.isSleeping ?? localPose?.isSleeping ?? false,
        affinity: res.affinity ?? 50,
        summary: res.summary || '',
        mood: res.mood || 'netral',
        options: Array.isArray(res.options) ? res.options : [],
      });
    } catch {
      const def = npcsConfig.npcs.find((n) => n.id === npcId);
      if (def) {
        const pose = computeClientNpcPose(def, serverNowMs, playerPos, npcsConfig.lodActiveRadiusMeters);
        setNpcMeta({
          name: def.name,
          role: def.role,
          personality: def.personality,
          activity: pose.activity,
          zoneTag: pose.zoneTag,
          isSleeping: pose.isSleeping,
          affinity: 50,
          summary: '',
          mood: 'netral',
          options: [
            { actionId: 'greet', label: 'Sapa Ramah', category: 'social' },
            { actionId: 'ask_rumor', label: 'Tanya Kabar Sekitar', category: 'social' },
          ],
        });
      }
    } finally {
      setLoading(false);
    }
  }, [npcId, npcsConfig, playerPos, serverNowMs]);

  useEffect(() => {
    if (open && npcId) {
      setMessages([]);
      setDraft('');
      setRemainingCalls(aiConfig.dailyCallsLimit);
      void loadNpcContext();
    }
  }, [open, npcId, aiConfig.dailyCallsLimit, loadNpcContext]);

  if (!open || !npcId) return null;

  const activeQuestWithNpc = questLogs.find(
    (q) => q.npcId === npcId && q.status === 'active'
  );

  const handleQuickOption = async (opt: NpcOptionItem) => {
    if (opt.uiHint && onNavigateHint) {
      onClose();
      onNavigateHint(opt.uiHint);
      return;
    }

    setBusyActionId(opt.actionId + (opt.questId || opt.itemId || ''));
    try {
      if (opt.actionId === 'accept_quest' && opt.questId) {
        const res = await callAcceptQuest(opt.questId);
        setMessages((prev) => [
          ...prev,
          { id: `sys_${Date.now()}`, sender: 'system', text: `Tugas diterima: ${res.title}` },
        ]);
        onNotify(`Tugas diterima: ${res.title}`);
        await loadNpcContext();
        return;
      }

      if (opt.actionId === 'complete_quest' && (opt.questId || activeQuestWithNpc)) {
        const res = await callCompleteQuest({
          logId: activeQuestWithNpc?.id,
          questId: opt.questId || activeQuestWithNpc?.questId,
        });
        const rewardMsg = `Tugas selesai! +${formatRupiah(res.rewardMoney)} & +${res.rewardRep} Reputasi.`;
        setMessages((prev) => [
          ...prev,
          { id: `sys_${Date.now()}`, sender: 'system', text: rewardMsg },
        ]);
        onNotify(rewardMsg);
        await loadNpcContext();
        return;
      }

      const res = await callExecuteNpcAction({
        npcId,
        actionId: opt.actionId,
        itemId: opt.itemId,
      });

      if (res.uiHint && onNavigateHint) {
        onClose();
        onNavigateHint(res.uiHint);
        return;
      }

      if (typeof res.affinity === 'number') {
        setNpcMeta((prev) => (prev ? { ...prev, affinity: res.affinity! } : prev));
      }
      if (res.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: `npc_${Date.now()}`,
            sender: 'npc',
            text: res.message!,
            sourceLabel: 'Interaksi Terstruktur',
          },
        ]);
      } else if (res.itemName) {
        const buyMsg = `Membeli ${res.itemName} seharga ${formatRupiah(res.pricePaid || 0)}.`;
        setMessages((prev) => [
          ...prev,
          { id: `sys_${Date.now()}`, sender: 'system', text: buyMsg },
        ]);
        onNotify(buyMsg);
      }
      await loadNpcContext();
    } catch (err) {
      onNotify((err as Error)?.message || 'Interaksi NPC gagal.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSendAiDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim().slice(0, aiConfig.maxInputChars);
    if (!clean || sending) return;

    setMessages((prev) => [
      ...prev,
      { id: `p_${Date.now()}`, sender: 'player', text: clean },
    ]);
    setDraft('');
    setSending(true);
    try {
      const res = await callTalkToNpc(npcId, clean);
      setRemainingCalls(res.remainingCalls);
      setNpcMeta((prev) => (prev ? { ...prev, affinity: res.affinity } : prev));
      const sourceText =
        res.source === 'gemini'
          ? 'Gemini AI'
          : res.source === 'faq_cache'
            ? 'Jawaban Cepat'
            : res.source === 'moderation'
              ? 'Moderasi'
              : 'Respon Warga';
      setMessages((prev) => [
        ...prev,
        {
          id: `n_${Date.now()}`,
          sender: 'npc',
          text: res.reply,
          sourceLabel: sourceText,
        },
      ]);
    } catch (err) {
      onNotify((err as Error)?.message || 'NPC belum bisa membalas saat ini.');
    } finally {
      setSending(false);
    }
  };

  const handleReportLastReply = async (replyText: string) => {
    try {
      await callExecuteNpcAction({
        npcId,
        actionId: 'report_ai_reply',
        reason: replyText.slice(0, 120),
      });
      onNotify('Balasan AI dilaporkan untuk tinjauan moderasi.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal melaporkan balasan.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 border border-teal-500/30">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {npcMeta?.name || 'Memuat Warga...'}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {npcMeta ? `${npcMeta.role.replace(/_/g, ' ')} · ${formatNpcActivityLabel(npcMeta.activity)}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            aria-label="Tutup dialog NPC"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Affinity & Kuota Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-[11px] shrink-0">
          <div className="flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-slate-300">Kedekatan:</span>
            <span className="font-mono tabular-nums font-bold text-rose-300">
              {npcMeta?.affinity ?? 50}/100
            </span>
            <span className="text-slate-500">({npcMeta?.mood || 'netral'})</span>
          </div>
          <div className="font-mono tabular-nums text-slate-400">
            Kuota Dialog AI: <strong className="text-sky-300">{remainingCalls}</strong>/{aiConfig.dailyCallsLimit}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              <span>Menyapa warga Cicalengka...</span>
            </div>
          ) : (
            <>
              {npcMeta && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
                  <div className="text-slate-300">{npcMeta.personality}</div>
                  {npcMeta.summary && (
                    <div className="text-[11px] text-teal-300">
                      Ingatan terakhir: {npcMeta.summary}
                    </div>
                  )}
                </div>
              )}

              {/* Opsi Aksi Terstruktur */}
              {npcMeta && npcMeta.options.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Pilihan Cepat
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {npcMeta.options.map((opt) => {
                      const key = opt.actionId + (opt.questId || opt.itemId || '');
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={busyActionId !== null || npcMeta.isSleeping}
                          onClick={() => void handleQuickOption(opt)}
                          className="min-h-[42px] flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/75 px-3 py-2 text-left text-xs font-semibold text-slate-100 hover:border-teal-400/60 hover:bg-slate-800 disabled:opacity-45"
                        >
                          <span className="flex items-center gap-1.5 min-w-0 truncate">
                            {opt.category === 'trade' ? (
                              <ShoppingBag className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                            ) : opt.category === 'quest' ? (
                              <Sparkles className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                            ) : (
                              <MessageCircle className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                            )}
                            <span className="truncate">{opt.label}</span>
                          </span>
                          {typeof opt.price === 'number' && opt.price > 0 && (
                            <span className="font-mono tabular-nums text-[11px] text-amber-300 shrink-0">
                              {formatRupiah(opt.price)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Riwayat Percakapan */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-h-[150px]">
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    Mulai obrolan bebas dengan {npcMeta?.name || 'warga ini'} atau gunakan pilihan cepat di atas.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.sender === 'player'
                          ? 'items-end'
                          : m.sender === 'system'
                            ? 'items-center'
                            : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-xl px-3 py-2 text-xs ${
                          m.sender === 'player'
                            ? 'bg-sky-600 text-white'
                            : m.sender === 'system'
                              ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-200'
                              : 'bg-slate-800 text-slate-100 border border-slate-700'
                        }`}
                      >
                        <div>{m.text}</div>
                        {m.sender === 'npc' && (
                          <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-slate-400">
                            <span>{m.sourceLabel}</span>
                            <button
                              type="button"
                              onClick={() => void handleReportLastReply(m.text)}
                              className="inline-flex items-center gap-0.5 text-slate-400 hover:text-rose-300"
                              title="Laporkan respon tidak pantas"
                            >
                              <Flag className="h-2.5 w-2.5" />
                              Laporkan
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Input Chat AI */}
        <form
          onSubmit={(e) => void handleSendAiDialog(e)}
          className="border-t border-slate-800 bg-slate-950/80 p-3 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            maxLength={aiConfig.maxInputChars}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending || Boolean(npcMeta?.isSleeping)}
            placeholder={
              npcMeta?.isSleeping
                ? 'Warga ini sedang beristirahat...'
                : `Tulis pesan ke ${npcMeta?.name || 'NPC'} (maks ${aiConfig.maxInputChars} huruf)...`
            }
            className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim() || Boolean(npcMeta?.isSleeping)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-45"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </form>
      </div>
    </div>
  );
};
