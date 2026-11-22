import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Droplets,
  History,
  Home,
  Landmark,
  Receipt,
  ShieldCheck,
  UserCheck,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { callGetBills, callPayBill } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type {
  BillDoc,
  CharacterDoc,
  LeaseDoc,
  PropertyDoc,
  SkillKey,
  TransactionDoc,
} from '../types/game';
import { StatusTileIcon } from './GameIcons';

interface ProfileFinanceModalProps {
  open: boolean;
  initialTab: 'profile' | 'bills' | 'tx';
  character: CharacterDoc;
  bills: BillDoc[];
  transactions: TransactionDoc[];
  homeProperty?: PropertyDoc | null;
  activeLease?: LeaseDoc | null;
  serverNowMs: number;
  onBillsUpdated: (bills: BillDoc[]) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const SKILL_LABELS: Record<SkillKey, string> = {
  komunikasi: 'Komunikasi',
  fisik: 'Fisik & Stamina',
  hitung: 'Hitung-Hitungan',
  teknis: 'Teknis Mesin',
};

const BILL_META: Record<
  BillDoc['billType'],
  { label: string; badgeClass: string; Icon: React.FC<{ className?: string }> }
> = {
  rent: {
    label: 'Sewa',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    Icon: Home,
  },
  electricity: {
    label: 'Listrik',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Icon: Zap,
  },
  water: {
    label: 'Air PDAM',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    Icon: Droplets,
  },
  internet: {
    label: 'Internet',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    Icon: Wifi,
  },
  property_tax: {
    label: 'PBB',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Icon: Landmark,
  },
  loan_installment: {
    label: 'Cicilan Bank',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    Icon: Landmark,
  },
  mortgage_installment: {
    label: 'Cicilan KPR',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    Icon: Home,
  },
  security_fee: {
    label: 'Keamanan Rumah',
    badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    Icon: ShieldCheck,
  },
  insurance_premium: {
    label: 'Premi Asuransi',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    Icon: ShieldCheck,
  },
  vehicle_tax: {
    label: 'Pajak STNK',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Icon: Receipt,
  },
  vehicle_lease_installment: {
    label: 'Cicilan Kendaraan',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    Icon: Landmark,
  },
  vehicle_ticket_fine: {
    label: 'Denda Tilang',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    Icon: AlertTriangle,
  },
};

export const ProfileFinanceModal: React.FC<ProfileFinanceModalProps> = ({
  open,
  initialTab,
  character,
  bills,
  transactions,
  homeProperty,
  activeLease,
  serverNowMs,
  onBillsUpdated,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<'profile' | 'bills' | 'tx'>(initialTab);
  const [loadingBills, setLoadingBills] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || tab !== 'bills') return;
    let mounted = true;
    setLoadingBills(true);
    void callGetBills()
      .then((res) => {
        if (mounted && Array.isArray(res.bills)) {
          onBillsUpdated(res.bills as BillDoc[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingBills(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, tab, onBillsUpdated]);

  if (!open) return null;

  const skills = character.skills || { komunikasi: 0, fisik: 0, hitung: 0, teknis: 0 };

  const handlePayBill = async (bill: BillDoc) => {
    setPayingId(bill.id);
    try {
      const res = await callPayBill(bill.id);
      onNotify(`Tagihan ${res.title || bill.title} lunas (${formatRupiah(res.totalDue ?? bill.totalDue)})!`);
      const refreshed = await callGetBills().catch(() => null);
      if (refreshed && Array.isArray(refreshed.bills)) {
        onBillsUpdated(refreshed.bills as BillDoc[]);
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membayar tagihan.');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <StatusTileIcon kind="money" className="h-8 w-8 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">Profil, Tagihan &amp; Keuangan</h2>
              <p className="text-[11px] text-slate-400">
                Saldo: <span className="font-semibold text-emerald-300">{formatRupiah(character.money)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup profil"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold ${
              tab === 'profile' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" /> Skill
          </button>
          <button
            type="button"
            onClick={() => setTab('bills')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold ${
              tab === 'bills' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" /> Tagihan
          </button>
          <button
            type="button"
            onClick={() => setTab('tx')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold ${
              tab === 'tx' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <History className="h-3.5 w-3.5" /> Riwayat
          </button>
        </div>

        <div className="mt-3 overflow-y-auto pr-1 space-y-3">
          {tab === 'profile' && (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Award className="h-4 w-4" /> Kemampuan (Skill)
                </div>
                {(Object.keys(SKILL_LABELS) as SkillKey[]).map((key) => {
                  const val = Math.min(100, skills[key] || 0);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                        <span>{SKILL_LABELS[key]}</span>
                        <span className="font-mono font-bold">{val} / 100</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div style={{ width: `${val}%` }} className="h-full bg-emerald-400" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-sky-300">
                    <Home className="h-4 w-4" /> Alamat Hunian &amp; Status Tinggal
                  </div>
                  {character.homeless ? (
                    <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      Tanpa Rumah
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      Memiliki Hunian
                    </span>
                  )}
                </div>

                {homeProperty && !character.homeless ? (
                  <div className="space-y-0.5 text-slate-300">
                    <div className="font-semibold text-white">{homeProperty.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Tipe: <span className="uppercase">{homeProperty.type}</span> · Area{' '}
                      <span className="capitalize">{homeProperty.areaTag.replace('_', ' ')}</span> · Kondisi{' '}
                      {Math.round(homeProperty.condition)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-rose-300/90">
                    Belum menempati rumah tetap. Energi, kebersihan, dan mood menurun lebih cepat saat tidur di jalan.
                  </div>
                )}

                <div className="pt-1 border-t border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Reputasi Warga
                    </span>
                    <span className="font-mono font-bold text-white">
                      {Math.round(character.reputation ?? 60)} / 100
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, character.reputation ?? 60))}%` }}
                      className="h-full bg-sky-400"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Titik respawn pingsan/login:{' '}
                    <span className="text-slate-300 font-semibold">
                      {character.respawnAtHome !== false && !character.homeless && homeProperty
                        ? `Rumah (${homeProperty.name})`
                        : 'Klinik / Stasiun Cicalengka'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-1">
                <div className="font-bold text-white">Karier &amp; Riwayat</div>
                {character.currentJob ? (
                  <>
                    <div className="text-emerald-300">
                      {character.currentJob.title} · {character.currentJob.rankTitle}
                    </div>
                    <div className="text-slate-400">
                      {character.currentJob.employer} · {character.currentJob.shiftsCompleted} shift selesai (
                      {character.currentJob.totalWorkSeconds} detik kerja)
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400">Belum bekerja. Lamar pekerjaan di menu Kerja.</div>
                )}
                <div className="text-slate-500 text-[11px]">
                  Riwayat pingsan dirawat darurat: {character.faintedCount ?? 0} kali
                </div>
              </div>
            </>
          )}

          {tab === 'bills' && (
            <div className="space-y-2">
              {activeLease &&
                ((activeLease.missedPeriods ?? activeLease.missedPeriodsCount ?? 0) > 0 ||
                  Boolean(activeLease.evictionWarningAtMs)) && (
                  <div className="rounded-xl border border-rose-500/60 bg-rose-950/30 p-3 flex items-start gap-2 text-xs text-rose-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-300">Peringatan Tunggakan Sewa!</div>
                      <div className="text-[11px] text-rose-200/90">
                        Tunggakan periode ke-{activeLease.missedPeriods ?? activeLease.missedPeriodsCount ?? 1}. Segera bayar tagihan sewa sebelum pengusiran otomatis (furnitur akan dipindah ke gudang).
                      </div>
                    </div>
                  </div>
                )}

              {loadingBills && (
                <div className="text-center text-xs text-slate-400 py-3">Memeriksa tagihan terbaru...</div>
              )}
              {bills.length === 0 && !loadingBills ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  Belum ada tagihan periode ini.
                </div>
              ) : (
                bills.map((b) => {
                  const isPaid = b.status === 'paid';
                  const overdue = !isPaid && serverNowMs > b.dueAtMs;
                  const meta = BILL_META[b.billType] ?? BILL_META.electricity;
                  const MetaIcon = meta.Icon;
                  return (
                    <div
                      key={b.id}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                        isPaid
                          ? 'border-slate-800 bg-slate-950/50 opacity-75'
                          : overdue
                            ? 'border-rose-500/60 bg-rose-950/20'
                            : 'border-amber-500/40 bg-slate-950'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                          >
                            <MetaIcon className="h-2.5 w-2.5" />
                            {meta.label}
                          </span>
                          <div className="text-xs font-bold text-white truncate">{b.title}</div>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Pokok {formatRupiah(b.baseAmount)}
                          {b.lateFee > 0 && (
                            <span className="text-rose-400 font-semibold">
                              {' '}
                              + Denda {formatRupiah(b.lateFee)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isPaid
                            ? 'Status: Lunas'
                            : overdue
                              ? 'Terlambat! Segera lunasi agar denda berhenti.'
                              : `Jatuh tempo dalam ${Math.max(0, Math.ceil((b.dueAtMs - serverNowMs) / 60000))} menit`}
                        </div>
                      </div>
                      {isPaid ? (
                        <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                          LUNAS
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={character.money < b.totalDue || payingId !== null}
                          onClick={() => void handlePayBill(b)}
                          className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500"
                        >
                          {payingId === b.id ? '...' : `Bayar ${formatRupiah(b.totalDue)}`}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'tx' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">Belum ada riwayat transaksi.</div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{tx.description}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(tx.createdAtMs).toLocaleTimeString('id-ID')} · Saldo:{' '}
                        {formatRupiah(tx.balanceAfter)}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-bold font-mono ${
                        tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatRupiah(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
