import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import { callSendChat } from '../firebase/api';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { localSimulation } from '../firebase/localSimulation';
import type { ChatLogDoc } from '../types/game';
import { ActionTileIcon } from './GameIcons';
import { useViewportMode } from './useViewportMode';

interface ChatBoxProps {
  isAuthenticated: boolean;
  characterName: string;
  drivingMode?: boolean;
  onLocalBubble?: (msg: string) => void;
  onNotify: (msg: string) => void;
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return typeof val === 'number' ? val : Date.now();
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  isAuthenticated,
  characterName,
  drivingMode = false,
  onLocalBubble,
  onNotify,
}) => {
  const { isCompactHud, isMobileLandscape, showTouchControls } = useViewportMode();
  const [collapsed, setCollapsed] = useState(true);
  const [channel, setChannel] = useState<'local' | 'global'>('local');
  const [messages, setMessages] = useState<ChatLogDoc[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const path = 'chat_logs';
    const q = query(
      collection(db, path),
      where('channel', '==', 'global'),
      limit(150)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: ChatLogDoc[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as ChatLogDoc) }))
          .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
          .slice(-50);
        setMessages(rows);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          onNotify((wrapped as Error).message.slice(0, 140));
        }
      }
    );

    return () => unsub();
  }, [isAuthenticated, onNotify]);

  useEffect(() => {
    if (!collapsed) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await callSendChat(channel, trimmed);
      if (channel === 'local') {
        onLocalBubble?.(res.cleanMessage);
      } else if (localSimulation.isActive()) {
        setMessages((prev) => [
          ...prev.slice(-49),
          {
            id: `local_${Date.now()}`,
            senderUid: 'self',
            senderName: characterName,
            message: res.cleanMessage,
            channel: 'global',
            createdAt: Date.now(),
          },
        ]);
      }
      setInput('');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  };

  const compactLayout = isCompactHud || showTouchControls;

  const collapsedWrapperClass = isMobileLandscape
    ? 'fixed top-[58px] left-2.5 z-20'
    : compactLayout
      ? drivingMode
        ? 'fixed bottom-[248px] left-3 z-20'
        : 'fixed bottom-[148px] left-4 z-20'
      : 'fixed bottom-3 left-3 z-20';

  const expandedWrapperClass = isMobileLandscape
    ? 'fixed top-[58px] left-2.5 z-30 w-[min(320px,calc(100vw-1.5rem))]'
    : compactLayout
      ? 'fixed top-16 left-2 right-2 mx-auto z-30 max-w-sm'
      : 'fixed bottom-3 left-3 z-30 w-full max-w-sm';

  return (
    <>
      {collapsed ? (
        <div className={collapsedWrapperClass}>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className={`${
              isMobileLandscape ? 'h-9 px-2.5 rounded-xl' : 'min-h-[42px] px-3 py-2 rounded-2xl'
            } flex items-center gap-1.5 border border-[#F5EFE0]/25 bg-[#161E38]/80 backdrop-blur-md text-xs font-semibold text-[#FFFDF8] hover:bg-[#161E38] shadow-xl active:scale-95 transition-transform`}
            aria-label="Buka Chat Warga"
          >
            <ActionTileIcon kind="chat" className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span>
              {compactLayout ? 'Chat' : `Chat Warga (${channel === 'local' ? 'Lokal / Kepala' : 'Umum'})`}
            </span>
            <ChevronUp className="h-3.5 w-3.5 text-slate-300" />
          </button>
        </div>
      ) : (
        <div className={expandedWrapperClass}>
          <div className="rounded-2xl border border-[#F5EFE0]/25 bg-[#161E38]/92 backdrop-blur-md shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#FFFDF8] hover:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <ActionTileIcon kind="chat" className="h-5 w-5 shrink-0" />
                Chat Warga ({channel === 'local' ? 'Lokal / Kepala' : 'Umum'})
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>

            <div className="border-t border-slate-800 p-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => setChannel('local')}
                  className={`rounded-md py-1 text-[11px] font-semibold ${
                    channel === 'local' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  Lokal (Radius)
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('global')}
                  className={`rounded-md py-1 text-[11px] font-semibold ${
                    channel === 'global' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  Umum (50)
                </button>
              </div>

              {channel === 'global' ? (
                <div
                  className={`overflow-y-auto space-y-1 pr-1 text-xs ${
                    isMobileLandscape ? 'h-24' : 'h-32 sm:h-36'
                  }`}
                >
                  {messages.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-6">
                      Belum ada obrolan umum. Sapa warga Cicalengka!
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className="leading-snug break-words">
                        <span className="font-semibold text-emerald-300">{m.senderName}: </span>
                        <span className="text-slate-200">{m.message}</span>
                      </div>
                    ))
                  )}
                  <div ref={listEndRef} />
                </div>
              ) : (
                <div className="rounded-lg bg-slate-950/70 px-2.5 py-2 text-[11px] text-slate-400">
                  Pesan lokal muncul sebagai gelembung di atas kepala karaktermu untuk pemain dalam radius 35m.
                </div>
              )}

              <form onSubmit={handleSend} className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={160}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={channel === 'local' ? 'Ngobrol ka warga deukeut...' : 'Tulis chat umum...'}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  aria-label="Kirim pesan"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
