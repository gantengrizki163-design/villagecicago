import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Landmark,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  callApplyLoan,
  callDeposit,
  callGetAccountSummary,
  callOpenAccount,
  callRepayLoan,
  callTransfer,
  callWithdraw,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { BANK_POS } from '../world3d/worldConstants';
import type {
  BankAccountDoc,
  BankConfigDoc,
  CharacterDoc,
  LedgerEntryDoc,
  LoanDoc,
} from '../types/game';

interface BankModalProps {
  open: boolean;
  initialMode?: 'bank' | 'atm';
  character: CharacterDoc;
  bankAccount: BankAccountDoc | null;
  loans: LoanDoc[];
  bankConfig: BankConfigDoc;
  nearBank: boolean;
  nearAtm: boolean;
  onOpenMortgage?: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type BankTab = 'account' | 'transfer' | 'loans';

export const BankModal: React.FC<BankModalProps> = ({
  open,
  initialMode = 'bank',
  character,
  bankAccount,
  loans,
  bankConfig,
  nearBank,
  nearAtm,
  onOpenMortgage,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<BankTab>('account');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [summaryAcc, setSummaryAcc] = useState<(BankAccountDoc & { interestJustCredited?: number }) | null>(
    bankAccount
  );
  const [summaryLoans, setSummaryLoans] = useState<LoanDoc[]>(loans);
  const [recentLedger, setRecentLedger] = useState<LedgerEntryDoc[]>([]);

  // Form states
  const [initialDeposit, setInitialDeposit] = useState('25000');
  const [txAmount, setTxAmount] = useState('50000');
  const [txBucket, setTxBucket] = useState<'balance' | 'savings'>('balance');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmount, setTransferAmount] = useState('25000');
  const [loanAmount, setLoanAmount] = useState('100000');

  useEffect(() => {
    setSummaryAcc(bankAccount);
  }, [bankAccount]);

  useEffect(() => {
    setSummaryLoans(loans);
  }, [loans]);

  const loadSummary = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await callGetAccountSummary();
      if (res.account) setSummaryAcc(res.account);
      if (Array.isArray(res.loans)) setSummaryLoans(res.loans);
      if (Array.isArray(res.recentLedger)) setRecentLedger(res.recentLedger);
      if (res.account?.interestJustCredited && res.account.interestJustCredited > 0) {
        onNotify(`Bunga tabungan cair otomatis: +${formatRupiah(res.account.interestJustCredited)}!`);
      }
    } catch {
      // Gunakan data snapshot lokal jika emulator/cloud functions belum sinkron
    } finally {
      setRefreshing(false);
    }
  }, [onNotify]);

  useEffect(() => {
    if (open) {
      setTab('account');
      void loadSummary();
    }
  }, [open, loadSummary]);

  if (!open) return null;

  const activeAccount = summaryAcc || bankAccount;
  const creditScore = activeAccount?.creditScore ?? character.creditScore ?? bankConfig.creditScore.defaultScore;
  const loanTier =
    bankConfig.loan.tiers.find((t) => creditScore >= t.minScore && creditScore <= t.maxScore) ?? null;
  const canDepositWithdraw = nearBank || nearAtm;

  const numericTransfer = Math.max(0, Math.floor(Number(transferAmount) || 0));
  const estAdminFee =
    numericTransfer >= bankConfig.minTransferAmount
      ? Math.min(
          bankConfig.transferAdminFeeMax,
          bankConfig.transferAdminFeeFlat + Math.round(numericTransfer * bankConfig.transferAdminFeeRate)
        )
      : bankConfig.transferAdminFeeFlat;

  const handleOpenAccount = async () => {
    setBusy(true);
    try {
      const dep = Math.max(0, Math.floor(Number(initialDeposit) || 0));
      const res = await callOpenAccount(dep);
      onNotify(`Rekening ${res.accountNumber} berhasil dibuka! Saldo awal: ${formatRupiah(res.balance)}.`);
      await loadSummary();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membuka rekening.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeposit = async () => {
    const amt = Math.floor(Number(txAmount) || 0);
    if (amt <= 0) return onNotify('Masukkan nominal setor yang valid.');
    setBusy(true);
    try {
      const res = await callDeposit(amt, txBucket);
      onNotify(
        `Setor ${formatRupiah(amt)} ke ${txBucket === 'savings' ? 'Tabungan' : 'Rekening Giro'} berhasil!`
      );
      if (res.interestCredited > 0) {
        onNotify(`Bunga tabungan dikreditkan: +${formatRupiah(res.interestCredited)}.`);
      }
      await loadSummary();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal setor tunai.');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    const amt = Math.floor(Number(txAmount) || 0);
    if (amt <= 0) return onNotify('Masukkan nominal tarik yang valid.');
    setBusy(true);
    try {
      await callWithdraw(amt, txBucket);
      onNotify(`Tarik tunai ${formatRupiah(amt)} berhasil masuk ke dompet.`);
      await loadSummary();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal tarik tunai.');
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget.trim()) return onNotify('Isi nama karakter tujuan transfer.');
    setBusy(true);
    try {
      const res = await callTransfer(transferTarget.trim(), numericTransfer);
      onNotify(
        `Transfer ${formatRupiah(res.amount)} ke ${res.targetName} sukses (Admin: ${formatRupiah(res.adminFee)}).`
      );
      setTransferTarget('');
      await loadSummary();
    } catch (err) {
      onNotify((err as Error)?.message || 'Transfer gagal.');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyLoan = async () => {
    const amt = Math.floor(Number(loanAmount) || 0);
    if (amt <= 0) return onNotify('Masukkan nominal pinjaman.');
    setBusy(true);
    try {
      const res = await callApplyLoan(amt);
      onNotify(
        `Pinjaman cair ${formatRupiah(res.principal)} ke Giro! Cicilan ${formatRupiah(res.installment)} (${res.termCycles}x).`
      );
      await loadSummary();
    } catch (err) {
      onNotify((err as Error)?.message || 'Pengajuan pinjaman ditolak.');
    } finally {
      setBusy(false);
    }
  };

  const handleRepayLoan = async (loanId: string, payFull: boolean, source: 'bank' | 'wallet') => {
    setBusy(true);
    try {
      const res = await callRepayLoan(loanId, payFull, source);
      onNotify(
        res.status === 'paid'
          ? `Pinjaman lunas! Skor kredit meningkat menjadi ${res.creditScore}.`
          : `Cicilan ${formatRupiah(res.paid)} lunas. Sisa: ${formatRupiah(res.remaining)}.`
      );
      await loadSummary();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membayar cicilan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {initialMode === 'atm' ? <CreditCard className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {initialMode === 'atm' ? 'ATM 24 Jam · Bank Priangan' : 'Bank Priangan Cicalengka'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeAccount
                  ? `No. Rek: ${activeAccount.accountNumber} · Skor Kredit ${creditScore}/100`
                  : 'Layanan Perbankan, Tabungan, Transfer & Kredit Usaha'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenMortgage && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMortgage();
                }}
                className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
              >
                KPR Properti
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadSummary()}
              disabled={refreshing}
              className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
              title="Segarkan bunga & mutasi"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Balance Strip */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Dompet Tunai</div>
            <div className="font-mono text-xs sm:text-sm font-bold text-emerald-300">
              {formatRupiah(character.money)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Rekening Giro</div>
            <div className="font-mono text-xs sm:text-sm font-bold text-sky-300">
              {activeAccount ? formatRupiah(activeAccount.balance) : 'Belum Ada'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Tabungan ({(bankConfig.savingsDailyInterestRate * 100).toFixed(1)}%/hr)</div>
            <div className="font-mono text-xs sm:text-sm font-bold text-amber-300">
              {activeAccount ? formatRupiah(activeAccount.savings) : 'Rp 0'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        {activeAccount && (
          <div className="flex border-b border-slate-800 bg-slate-900/90 px-3 pt-2 gap-1 overflow-x-auto">
            {[
              { id: 'account' as BankTab, label: 'Setor / Tarik & Ledger', icon: PiggyBank },
              { id: 'transfer' as BankTab, label: 'Transfer P2P', icon: ArrowLeftRight },
              { id: 'loans' as BankTab, label: 'Pinjaman & Skor Kredit', icon: TrendingUp },
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-semibold border-b-2 transition ${
                    active
                      ? 'border-amber-400 bg-slate-800/80 text-amber-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeAccount ? (
            <div className="rounded-xl border border-slate-700/80 bg-slate-800/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-white">Buka Rekening Bank Priangan</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Pisahkan uang aman dari dompet tunai, nikmati bunga tabungan harian otomatis, transfer antar warga, dan akses pinjaman modal bisnis.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
                  <span className="text-slate-400">Biaya Pembukaan Rekening</span>
                  <div className="font-mono font-bold text-amber-300 mt-0.5">
                    {formatRupiah(bankConfig.openAccountFee)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
                  <span className="text-slate-400">Skor Kredit Awal</span>
                  <div className="font-mono font-bold text-emerald-300 mt-0.5">
                    {creditScore} / 100
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Setoran Awal ke Giro (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              {!nearBank && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                  Kunjungi gedung <strong>Bank Priangan Cicalengka</strong> ({BANK_POS.x}, {BANK_POS.z}) di peta 3D untuk verifikasi pembukaan rekening.
                </div>
              )}

              <button
                type="button"
                disabled={busy || !nearBank}
                onClick={() => void handleOpenAccount()}
                className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? 'Memproses...' : 'Buka Rekening Sekarang'}
              </button>
            </div>
          ) : (
            <>
              {tab === 'account' && (
                <div className="space-y-4">
                  {/* Setor / Tarik Box */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Setor &amp; Tarik Tunai
                      </h3>
                      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                        <button
                          type="button"
                          onClick={() => setTxBucket('balance')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            txBucket === 'balance'
                              ? 'bg-sky-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Rekening Giro
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxBucket('savings')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            txBucket === 'savings'
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Tabungan Berbunga
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[10000, 25000, 50000, 100000, 250000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTxAmount(String(val))}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-200 hover:border-sky-400"
                        >
                          {formatRupiah(val)}
                        </button>
                      ))}
                    </div>

                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      placeholder="Nominal Rp"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-sky-400 focus:outline-none"
                    />

                    {!canDepositWithdraw && (
                      <p className="text-[11px] text-amber-300">
                        Dekati Bank Priangan atau ATM 24 Jam di peta untuk melakukan setor/tarik fisik.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy || !canDepositWithdraw}
                        onClick={() => void handleDeposit()}
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Setor ke {txBucket === 'savings' ? 'Tabungan' : 'Giro'}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canDepositWithdraw}
                        onClick={() => void handleWithdraw()}
                        className="rounded-xl border border-sky-500/60 bg-sky-500/20 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
                      >
                        Tarik ke Dompet
                      </button>
                    </div>
                  </div>

                  {/* Mutasi Ledger Bank Terbaru */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-200">Catatan Ledger Bank Terbaru</h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        Total Bunga: {formatRupiah(activeAccount.totalInterestEarned || 0)}
                      </span>
                    </div>
                    {recentLedger.length === 0 ? (
                      <p className="py-3 text-center text-xs text-slate-500">
                        Belum ada mutasi ledger tercatat pada sesi ini.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-800/80">
                        {recentLedger.slice(0, 6).map((entry) => {
                          const isCredit = entry.to === character.uid;
                          return (
                            <div key={entry.id} className="flex items-center justify-between py-2 text-xs">
                              <div className="min-w-0 pr-2">
                                <div className="truncate font-medium text-slate-200">{entry.reason}</div>
                                <div className="font-mono text-[10px] text-slate-500">
                                  Ref: {entry.refId}
                                </div>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <div className={isCredit ? 'font-bold text-emerald-400' : 'font-bold text-rose-300'}>
                                  {isCredit ? '+' : '-'}
                                  {formatRupiah(entry.amount)}
                                </div>
                                {entry.taxAmount ? (
                                  <div className="text-[10px] text-slate-400">
                                    Biaya/Pajak: {formatRupiah(entry.taxAmount)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'transfer' && (
                <form onSubmit={(e) => void handleTransfer(e)} className="space-y-3 rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Transfer Antar Pemain (via Rekening Giro)
                  </h3>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Nama Karakter Penerima</label>
                    <input
                      type="text"
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      placeholder="Contoh: BudiSantoso"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Nominal Transfer (Min {formatRupiah(bankConfig.minTransferAmount)})
                    </label>
                    <input
                      type="number"
                      min={bankConfig.minTransferAmount}
                      step={1000}
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
                    <span className="text-slate-400">Biaya Admin ({(bankConfig.transferAdminFeeRate * 100).toFixed(1)}%)</span>
                    <span className="font-mono font-semibold text-amber-300">{formatRupiah(estAdminFee)}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    {busy ? 'Mengirim Dana...' : `Kirim ${formatRupiah(numericTransfer)}`}
                  </button>
                </form>
              )}

              {tab === 'loans' && (
                <div className="space-y-4">
                  {/* Credit Score Breakdown */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Skor Kredit Warga
                      </span>
                      <span className="font-mono text-sm font-bold text-emerald-300">
                        {creditScore} / 100
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        style={{ width: `${Math.max(0, Math.min(100, creditScore))}%` }}
                        className={`h-full transition-all ${
                          creditScore >= 70
                            ? 'bg-emerald-500'
                            : creditScore >= 55
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <div className="text-slate-400">Plafon Kredit</div>
                        <div className="font-mono font-bold text-white">
                          {loanTier ? formatRupiah(loanTier.maxPrincipal) : 'Belum Layak'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <div className="text-slate-400">Bunga Pinjaman</div>
                        <div className="font-mono font-bold text-amber-300">
                          {loanTier ? `${(loanTier.flatInterestRate * 100).toFixed(0)}% flat` : '-'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <div className="text-slate-400">Tenor</div>
                        <div className="font-mono font-bold text-sky-300">
                          {loanTier ? `${loanTier.termCycles} cicilan` : '-'}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Bayar tagihan listrik/sewa dan cicilan tepat waktu (+{bankConfig.creditScore.onTimePaymentDelta} poin). Telat bayar dikenakan denda &amp; menurunkan skor ({bankConfig.creditScore.latePaymentDelta} poin).
                    </p>
                  </div>

                  {/* Active Loans */}
                  {summaryLoans.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Daftar Pinjaman Anda
                      </h4>
                      {summaryLoans.map((loan) => (
                        <div
                          key={loan.id}
                          className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <Banknote className="h-4 w-4 text-amber-400" />
                              Pokok {formatRupiah(loan.principal)}
                            </span>
                            <span
                              className={`font-mono text-[11px] font-bold ${
                                loan.status === 'paid'
                                  ? 'text-emerald-400'
                                  : loan.status === 'defaulted'
                                    ? 'text-rose-400'
                                    : 'text-amber-300'
                              }`}
                            >
                              {loan.status === 'paid' ? 'LUNAS' : `Sisa ${formatRupiah(loan.remaining)}`}
                            </span>
                          </div>
                          {loan.status !== 'paid' && (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                                <span>
                                  Cicilan: <strong className="font-mono text-slate-200">{formatRupiah(loan.installment)}</strong> ({loan.paidCycles || 0}/{loan.termCycles || 4}x)
                                </span>
                                <span className="font-mono">
                                  Jatuh tempo: {new Date(loan.nextDueAtMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleRepayLoan(loan.id, false, 'bank')}
                                  className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  Bayar Cicilan (Giro)
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleRepayLoan(loan.id, false, 'wallet')}
                                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                                >
                                  Bayar (Dompet)
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleRepayLoan(loan.id, true, 'bank')}
                                  className="rounded-lg bg-amber-500 px-2 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                                >
                                  Lunasi Penuh
                                </button>
                              </div>
                            </>
                          )}
                          {loan.status === 'paid' && (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Seluruh kewajiban pinjaman telah diselesaikan.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Apply New Loan */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-3.5 space-y-2.5">
                    <h4 className="text-xs font-bold text-white">Ajukan Kredit Usaha / Personal</h4>
                    <p className="text-[11px] text-slate-400">
                      Syarat: Skor kredit ≥ {bankConfig.loan.minCreditScore}, minimal {bankConfig.loan.minCompletedShifts} shift kerja selesai atau memiliki bisnis aktif, serta berada di Gedung Bank Priangan.
                    </p>
                    <input
                      type="number"
                      min={10000}
                      max={loanTier?.maxPrincipal ?? 900000}
                      step={10000}
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                    {!nearBank && (
                      <div className="text-[11px] text-amber-300">
                        Datangi meja Teller di Gedung Bank Priangan ({BANK_POS.x}, {BANK_POS.z}) untuk pencairan pinjaman baru.
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={busy || !loanTier || !nearBank}
                      onClick={() => void handleApplyLoan()}
                      className="w-full rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      {busy ? 'Memproses...' : 'Ajukan Pinjaman'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
