import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Gavel,
  HandCoins,
  Lock,
  Scale,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react';
import {
  callAttemptCrime,
  callFileAppeal,
  callPayBail,
  callPayFine,
  callReportCrime,
  callServeSentence,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { computeLazyWantedClient } from '../firebase/phase6ConfigCache';
import type {
  BankAccountDoc,
  BusinessDoc,
  CharacterDoc,
  CrimeRecordDoc,
  LawConfigDoc,
  PropertyDoc,
  RTDBPlayer,
  SentenceDoc,
} from '../types/game';
import { distance2D } from '../world3d/worldConstants';

interface LawJusticeModalProps {
  open: boolean;
  character: CharacterDoc;
  bankAccount: BankAccountDoc | null;
  crimeRecords: CrimeRecordDoc[];
  sentence: SentenceDoc | null;
  lawConfig: LawConfigDoc;
  dayDurationMs: number;
  serverNowMs: number;
  playerPos: { x: number; z: number };
  properties: PropertyDoc[];
  businesses: BusinessDoc[];
  remotePlayers: RTDBPlayer[];
  isNight: boolean;
  onOpenPoliceHub?: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type LawTab = 'record' | 'crime' | 'jail' | 'report';

export const LawJusticeModal: React.FC<LawJusticeModalProps> = ({
  open,
  character,
  bankAccount,
  crimeRecords,
  sentence,
  lawConfig,
  dayDurationMs,
  serverNowMs,
  playerPos,
  properties,
  businesses,
  remotePlayers,
  isNight,
  onOpenPoliceHub,
  onClose,
  onNotify,
}) => {
  const activeSentenceEndsMs =
    sentence?.status === 'serving'
      ? sentence.endAtMs
      : character.sentence?.active
        ? character.sentence.endAtMs ?? character.sentence.endsAtMs ?? 0
        : 0;
  const isJailed =
    Boolean(sentence?.status === 'serving' || character.sentence?.active) &&
    activeSentenceEndsMs > 0;

  const [tab, setTab] = useState<LawTab>(() => (isJailed ? 'jail' : 'record'));
  const [payFrom, setPayFrom] = useState<'wallet' | 'bank'>('wallet');
  const [busy, setBusy] = useState(false);

  // Aksi kriminal form
  const [selectedOffenseId, setSelectedOffenseId] = useState<string>(
    () => lawConfig.offenses[0]?.id ?? 'pickpocket_npc'
  );
  const [crimeTargetId, setCrimeTargetId] = useState<string>('');

  // Lapor & Jaminan teman
  const [reportTargetName, setReportTargetName] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [bailFriendName, setBailFriendName] = useState('');

  React.useEffect(() => {
    if (open) {
      setTab(isJailed ? 'jail' : 'record');
    }
  }, [open, isJailed]);

  const wantedLevel = useMemo(
    () =>
      computeLazyWantedClient(
        character.wantedLevel,
        character.wantedUpdatedAtMs,
        serverNowMs,
        lawConfig,
        dayDurationMs
      ),
    [character.wantedLevel, character.wantedUpdatedAtMs, serverNowMs, lawConfig, dayDurationMs]
  );

  const nearbyCctv = useMemo(() => {
    return lawConfig.cctvZones.find(
      (z) => distance2D(playerPos.x, playerPos.z, z.x, z.z) <= z.radius
    );
  }, [lawConfig.cctvZones, playerPos.x, playerPos.z]);

  const nearbyCrimeTarget = useMemo(() => {
    const offense = lawConfig.offenses.find((o) => o.id === selectedOffenseId);
    if (!offense) return { targetType: 'public', targetId: 'public_area', label: 'Area Umum' };

    if (offense.targetTypes.includes('property')) {
      const prop = properties
        .filter((p) => p.ownerId !== character.uid)
        .sort(
          (a, b) =>
            distance2D(playerPos.x, playerPos.z, a.position.x, a.position.z) -
            distance2D(playerPos.x, playerPos.z, b.position.x, b.position.z)
        )[0];
      if (prop) {
        return { targetType: 'property', targetId: prop.id, label: prop.name };
      }
    }
    if (offense.targetTypes.includes('business')) {
      const biz = businesses
        .filter((b) => b.ownerId !== character.uid && b.status === 'active' && b.position)
        .sort(
          (a, b) =>
            distance2D(playerPos.x, playerPos.z, a.position!.x, a.position!.z) -
            distance2D(playerPos.x, playerPos.z, b.position!.x, b.position!.z)
        )[0];
      if (biz) {
        return { targetType: 'business', targetId: biz.id, label: biz.name };
      }
    }
    if (offense.targetTypes.includes('player')) {
      const rp = remotePlayers
        .filter((p) => p.uid !== character.uid)
        .sort(
          (a, b) =>
            distance2D(playerPos.x, playerPos.z, a.x, a.z) -
            distance2D(playerPos.x, playerPos.z, b.x, b.z)
        )[0];
      if (rp) {
        return { targetType: 'player', targetId: rp.uid, label: rp.name };
      }
    }
    return {
      targetType: offense.targetTypes[0] || 'npc',
      targetId: crimeTargetId.trim() || 'warga_sekitar',
      label: offense.targetTypes[0] === 'npc' ? 'Warga Sekitar' : 'Area Cicalengka',
    };
  }, [
    lawConfig.offenses,
    selectedOffenseId,
    properties,
    businesses,
    remotePlayers,
    character.uid,
    playerPos.x,
    playerPos.z,
    crimeTargetId,
  ]);

  if (!open) return null;

  const myRecords = crimeRecords.filter(
    (r) => r.characterId === character.uid || r.uid === character.uid
  );
  const activeFineRecords = myRecords.filter(
    (r) =>
      r.status !== 'paid' &&
      r.status !== 'resolved' &&
      r.status !== 'expired' &&
      Number(r.fine || r.fineAmount || 0) > 0
  );

  const remainingJailSec = Math.max(0, Math.ceil((activeSentenceEndsMs - serverNowMs) / 1000));
  const jailMinutes = Math.floor(remainingJailSec / 60);
  const jailSecs = remainingJailSec % 60;
  const selfBailAmount =
    sentence?.bailAmount ??
    character.sentence?.bailAmount ??
    Math.round(
      Math.max(15000, Number(sentence?.fineAmount ?? character.sentence?.fineAmount ?? 25000)) *
        lawConfig.bailMultiplierOfFine
    );
  const appealUsed = Boolean(sentence?.appealFiled || character.sentence?.appealUsed);
  const isPolice = character.currentJob?.jobId === 'polisi';

  const handlePayFine = async (recordId: string) => {
    setBusy(true);
    try {
      const res = await callPayFine(recordId, payFrom);
      onNotify(`Denda ${formatRupiah(res.fine)} lunas! Skor buronan menurun.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membayar denda.');
    } finally {
      setBusy(false);
    }
  };

  const handleAttemptCrime = async () => {
    setBusy(true);
    try {
      const res = await callAttemptCrime({
        offenseId: selectedOffenseId,
        targetType: nearbyCrimeTarget.targetType,
        targetId: nearbyCrimeTarget.targetId,
        x: Math.round(playerPos.x * 10) / 10,
        z: Math.round(playerPos.z * 10) / 10,
      });
      if (res.caught) {
        onNotify(
          `Tertangkap basah saat ${res.offenseTitle}! Wanted +${Math.round(res.wantedLevel)} (Risiko ${Math.round(res.catchChance * 100)}%).`
        );
      } else {
        onNotify(
          `Aksi ${res.offenseTitle} berhasil! Hasil: +${formatRupiah(res.reward)} · Wanted: ${res.wantedLevel}.`
        );
      }
      setTab('record');
    } catch (err) {
      onNotify((err as Error)?.message || 'Aksi kriminal gagal dijalankan.');
    } finally {
      setBusy(false);
    }
  };

  const handleJailWork = async () => {
    setBusy(true);
    try {
      const res = await callServeSentence('work');
      if (res.released) {
        onNotify('Masa tahanan selesai! Kamu dibebaskan dari Polsek Cicalengka.');
      } else {
        onNotify(
          `Kerja sosial tahanan selesai! Sisa masa tahanan: ${Math.max(0, Math.round(res.remainingSec || 0))} detik.`
        );
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Kerja tahanan sedang cooldown.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckRelease = async () => {
    setBusy(true);
    try {
      const res = await callServeSentence('check');
      if (res.released) {
        onNotify('Bebas! Masa hukuman telah berakhir.');
      } else {
        onNotify(`Sisa masa tahanan: ${Math.max(0, Math.round(res.remainingSec || 0))} detik.`);
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memeriksa status tahanan.');
    } finally {
      setBusy(false);
    }
  };

  const handleAppeal = async () => {
    setBusy(true);
    try {
      const res = await callFileAppeal();
      if (res.accepted) {
        onNotify(
          `Banding dikabulkan! Hukuman dipotong ${res.cutSec} detik (sisa ${res.remainingSec} detik).`
        );
      } else {
        onNotify('Banding ditolak hakim. Biaya administrasi tetap terpotong.');
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengajukan banding.');
    } finally {
      setBusy(false);
    }
  };

  const handlePayBail = async (forSelf: boolean) => {
    if (!forSelf && !bailFriendName.trim()) {
      onNotify('Masukkan nama warga yang ingin ditebus jaminannya.');
      return;
    }
    setBusy(true);
    try {
      const res = await callPayBail({
        targetUid: forSelf ? character.uid : undefined,
        targetName: forSelf ? undefined : bailFriendName.trim(),
        paymentSource: payFrom,
      });
      onNotify(
        `Jaminan ${formatRupiah(res.bailAmount)} dibayar! ${res.releasedName} bebas dari tahanan.`
      );
      if (!forSelf) setBailFriendName('');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membayar uang jaminan.');
    } finally {
      setBusy(false);
    }
  };

  const handleReportCrime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetName.trim()) {
      onNotify('Masukkan nama warga atau ID kasus yang dilaporkan.');
      return;
    }
    const matchedPlayer = remotePlayers.find(
      (p) => p.name.toLowerCase() === reportTargetName.trim().toLowerCase()
    );
    setBusy(true);
    try {
      const res = await callReportCrime({
        targetUid: matchedPlayer?.uid,
        recordId: matchedPlayer ? undefined : reportTargetName.trim(),
        note: reportNote.trim() || 'Laporan warga ke Polsek Cicalengka',
      });
      onNotify(res.message || 'Laporan kriminal diterima Polsek Cicalengka.');
      setReportTargetName('');
      setReportNote('');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengirim laporan ke polisi.');
    } finally {
      setBusy(false);
    }
  };

  const selectedOffense =
    lawConfig.offenses.find((o) => o.id === selectedOffenseId) ?? lawConfig.offenses[0];

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <Scale className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Polsek &amp; Catatan Hukum Cicalengka
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Reputasi {character.reputation ?? 50}/100 · Dompet{' '}
                <span className="font-mono tabular-nums text-emerald-300">
                  {formatRupiah(character.money)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isPolice && onOpenPoliceHub && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPoliceHub();
                }}
                className="min-h-[36px] rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25"
              >
                Panel Polisi
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
              aria-label="Tutup panel hukum"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status Wanted Strip */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2.5 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Status Buronan</div>
            <div
              className={`font-mono tabular-nums text-xs sm:text-sm font-bold ${
                wantedLevel >= 40
                  ? 'text-rose-400'
                  : wantedLevel > 0
                    ? 'text-amber-300'
                    : 'text-emerald-300'
              }`}
            >
              {wantedLevel > 0 ? `Wanted ${wantedLevel}/${lawConfig.wantedMax}` : 'Bersih (0)'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Denda Aktif</div>
            <div className="font-mono tabular-nums text-xs sm:text-sm font-bold text-amber-300">
              {activeFineRecords.length} perkara
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Status Tahanan</div>
            <div
              className={`font-mono tabular-nums text-xs sm:text-sm font-bold ${
                isJailed ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {isJailed
                ? `${String(jailMinutes).padStart(2, '0')}:${String(jailSecs).padStart(2, '0')}`
                : 'Bebas'}
            </div>
          </div>
        </div>

        {/* Sumber Dana & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 pt-2 shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'record' as LawTab, label: 'SKCK & Denda' },
              { id: 'jail' as LawTab, label: isJailed ? 'Tahanan Aktif!' : 'Penjara & Jaminan' },
              { id: 'crime' as LawTab, label: 'Aksi Berisiko' },
              { id: 'report' as LawTab, label: 'Lapor Polisi' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  tab === item.id
                    ? 'border-rose-400 bg-slate-800/80 text-rose-200'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pb-1.5 text-[11px]">
            <span className="text-slate-400">Bayar via:</span>
            <button
              type="button"
              onClick={() => setPayFrom('wallet')}
              className={`rounded-md px-2 py-1 font-semibold ${
                payFrom === 'wallet'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              Dompet
            </button>
            <button
              type="button"
              disabled={!bankAccount}
              onClick={() => setPayFrom('bank')}
              className={`rounded-md px-2 py-1 font-semibold disabled:opacity-40 ${
                payFrom === 'bank' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Bank
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'record' && (
            <div className="space-y-3">
              {wantedLevel > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/35 p-3 text-xs text-amber-200">
                  Skor buronan turun otomatis seiring waktu (-{lawConfig.wantedDecayPerGameHour}/jam game), namun menurunkan kelayakan KPR dan melamar pekerjaan formal.
                </div>
              )}

              {myRecords.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center text-xs text-emerald-200">
                  Catatan kriminal bersih (SKCK Baik). Tidak ada pelanggaran hukum tercatat.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myRecords.map((rec) => {
                    const fineAmt = Number(rec.fine ?? rec.fineAmount ?? 0);
                    const unpaid =
                      rec.status !== 'paid' &&
                      rec.status !== 'resolved' &&
                      rec.status !== 'expired' &&
                      fineAmt > 0;
                    return (
                      <div
                        key={rec.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-white">{rec.offenseTitle}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Tingkat {rec.severity} · Status:{' '}
                              <span className="font-semibold text-slate-200">{rec.status}</span>
                              {rec.cctvLabel ? ` · Rekaman ${rec.cctvLabel}` : ''}
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums text-xs font-bold text-amber-300 shrink-0">
                            {formatRupiah(fineAmt)}
                          </div>
                        </div>

                        {unpaid && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handlePayFine(rec.id)}
                            className="w-full min-h-[44px] rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                          >
                            {busy
                              ? 'Memproses...'
                              : `Bayar Denda ${formatRupiah(fineAmt)} (${payFrom === 'bank' ? 'Giro Bank' : 'Dompet'})`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'jail' && (
            <div className="space-y-4">
              {isJailed ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-rose-400 shrink-0" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Sedang Menjalani Tahanan</h3>
                        <p className="text-xs text-rose-200">
                          {sentence?.reason ||
                            character.sentence?.reason ||
                            character.sentence?.offenseTitle ||
                            'Pelanggaran ketertiban umum'}
                        </p>
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-lg font-bold text-rose-300">
                      {String(jailMinutes).padStart(2, '0')}:{String(jailSecs).padStart(2, '0')}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleJailWork()}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <HandCoins className="h-4 w-4" />
                      <span>
                        Kerja Tahanan (-{lawConfig.prisonWorkSentenceCutSec}d · +{formatRupiah(lawConfig.prisonWorkPay)})
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCheckRelease()}
                      className="min-h-[44px] rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      Cek Bebas Otomatis
                    </button>

                    <button
                      type="button"
                      disabled={busy || appealUsed}
                      onClick={() => void handleAppeal()}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 disabled:opacity-45"
                    >
                      <Gavel className="h-4 w-4" />
                      <span>
                        {appealUsed
                          ? 'Banding Sudah Diajukan'
                          : `Ajukan Banding (${formatRupiah(lawConfig.appealFee)})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePayBail(true)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                    >
                      <Banknote className="h-4 w-4" />
                      <span>Tebus Jaminan ({formatRupiah(selfBailAmount)})</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                  Kamu tidak sedang ditahan. Area sel Polsek Cicalengka berada di sebelah Kantor Polsek.
                </div>
              )}

              {/* Tebus Jaminan Teman */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Bayar Jaminan Teman / Kerabat
                </h3>
                <p className="text-[11px] text-slate-400">
                  Masukkan nama warga yang sedang menjalani masa tahanan di Polsek untuk membebaskannya dengan uang jaminan.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={bailFriendName}
                    onChange={(e) => setBailFriendName(e.target.value)}
                    placeholder="Nama karakter tahanan..."
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePayBail(false)}
                    className="min-h-[44px] rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50 shrink-0"
                  >
                    Bayar Jaminan
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'crime' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-[11px] text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  Simulasi Risiko Hukum di Lokasi Saat Ini
                </div>
                <div>
                  Waktu: <strong>{isNight ? 'Malam Hari (lebih sulit terdeteksi)' : 'Siang Hari (banyak saksi)'}</strong>
                  {nearbyCctv ? ` · Terpantau ${nearbyCctv.label}!` : ' · Bebas CCTV utama'}
                </div>
                <div>
                  Target terdekat: <strong>{nearbyCrimeTarget.label}</strong>
                </div>
              </div>

              {isJailed && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
                  Tidak dapat melakukan aksi ilegal saat sedang ditahan di sel Polsek.
                </div>
              )}

              <div className="space-y-2">
                {lawConfig.offenses.map((off) => {
                  const selected = selectedOffenseId === off.id;
                  return (
                    <button
                      key={off.id}
                      type="button"
                      onClick={() => setSelectedOffenseId(off.id)}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        selected
                          ? 'border-rose-400 bg-rose-950/25'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{off.title}</span>
                        <span className="font-mono tabular-nums text-[11px] font-semibold text-emerald-300">
                          {off.rewardMax > 0
                            ? `${formatRupiah(off.rewardMin)}–${formatRupiah(off.rewardMax)}`
                            : 'Non-materi'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 font-mono tabular-nums">
                        <span>Tingkat {off.severity}</span>
                        <span>Denda {formatRupiah(off.fine)}</span>
                        <span>Tahanan {Math.round(off.sentenceSec / 60)}m</span>
                        <span>Wanted +{off.wantedDelta}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedOffense && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      ID / Keterangan Target (Opsional — default otomatis target terdekat)
                    </label>
                    <input
                      type="text"
                      value={crimeTargetId}
                      onChange={(e) => setCrimeTargetId(e.target.value)}
                      placeholder={nearbyCrimeTarget.targetId}
                      className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || isJailed}
                    onClick={() => void handleAttemptCrime()}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-45"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>
                      {busy ? 'Menjalankan...' : `Lakukan ${selectedOffense.title}`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'report' && (
            <form
              onSubmit={(e) => void handleReportCrime(e)}
              className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Siren className="h-4 w-4 text-sky-400" />
                <span>Buat Laporan Kriminal ke Polsek Cicalengka</span>
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">
                  Nama Pelaku / ID Catatan Kriminal
                </label>
                <input
                  type="text"
                  value={reportTargetName}
                  onChange={(e) => setReportTargetName(e.target.value)}
                  placeholder="Contoh: Budi atau id perkara..."
                  className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Kronologi Singkat</label>
                <textarea
                  rows={2}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Kejadian terlihat di sekitar Alun-Alun atau Pasar..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
              >
                {busy ? 'Mengirim Laporan...' : 'Kirim Laporan Warga'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
