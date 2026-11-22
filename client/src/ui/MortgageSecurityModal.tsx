import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  FileCheck2,
  Home,
  Landmark,
  Lock,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import {
  callApplyMortgage,
  callBuyInsurance,
  callEarlyRepay,
  callFileClaim,
  callForeclose,
  callHireGuard,
  callInstallSecurity,
  callPayMortgage,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import {
  computeLazyWantedClient,
  computeMortgageQuoteClient,
} from '../firebase/phase6ConfigCache';
import type {
  BankAccountDoc,
  BusinessDoc,
  CharacterDoc,
  CrimeRecordDoc,
  InsuranceClaimDoc,
  InsurancePolicyDoc,
  LawConfigDoc,
  MortgageConfigDoc,
  MortgageDoc,
  OfferDoc,
  PropertyDoc,
  PropertyListingDoc,
  SecurityInstallDoc,
  SecurityModuleId,
} from '../types/game';

interface MortgageSecurityModalProps {
  open: boolean;
  initialTab?: 'mortgage' | 'security' | 'insurance';
  character: CharacterDoc;
  bankAccount: BankAccountDoc | null;
  mortgages: MortgageDoc[];
  mortgageConfig: MortgageConfigDoc;
  lawConfig: LawConfigDoc;
  dayDurationMs: number;
  properties: PropertyDoc[];
  listings: PropertyListingDoc[];
  offers: OfferDoc[];
  businesses: BusinessDoc[];
  securityInstalls: SecurityInstallDoc[];
  insurancePolicies: InsurancePolicyDoc[];
  insuranceClaims: InsuranceClaimDoc[];
  crimeRecords: CrimeRecordDoc[];
  serverNowMs: number;
  nearMortgageDesk?: boolean;
  onGuideToMortgageDesk?: () => void;
  onOpenBank?: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type ModalTab = 'mortgage' | 'security' | 'insurance';

const MATERIAL_NAMES: Record<SecurityModuleId, string> = {
  lock: 'Gembok Baja Ganda',
  alarm: 'Alarm Anti-Maling',
  cctv: 'Kamera CCTV Pintar',
  guard: 'Satpam Hansip NPC',
};

export const MortgageSecurityModal: React.FC<MortgageSecurityModalProps> = ({
  open,
  initialTab = 'mortgage',
  character,
  bankAccount,
  mortgages,
  mortgageConfig,
  lawConfig,
  dayDurationMs,
  properties,
  listings,
  offers,
  businesses,
  securityInstalls,
  insurancePolicies,
  insuranceClaims,
  crimeRecords,
  serverNowMs,
  nearMortgageDesk = true,
  onGuideToMortgageDesk,
  onOpenBank,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<ModalTab>(initialTab);
  const [payFrom, setPayFrom] = useState<'wallet' | 'bank'>('bank');
  const [busyId, setBusyId] = useState<string | null>(null);

  // KPR form
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [dpRate, setDpRate] = useState<number>(mortgageConfig.minDownPaymentRate);
  const [termCycles, setTermCycles] = useState<number>(
    mortgageConfig.tenors[1]?.termCycles ?? mortgageConfig.tenors[0]?.termCycles ?? 8
  );

  // Keamanan form
  const [secPropId, setSecPropId] = useState<string>('');
  const [guardNameInput, setGuardNameInput] = useState('Mang Ujang Hansip');

  // Asuransi form
  const [insSubjectKey, setInsSubjectKey] = useState<string>('');
  const [claimPolicyId, setClaimPolicyId] = useState<string>('');
  const [claimRecordId, setClaimRecordId] = useState<string>('');

  React.useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

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

  const saleCandidates = useMemo(() => {
    const map = new Map<
      string,
      { propertyId: string; name: string; price: number; offerId?: string; areaTag: string }
    >();
    for (const lst of listings) {
      if (lst.status !== 'active' || lst.kind !== 'sale' || lst.ownerId === character.uid) continue;
      map.set(lst.propertyId, {
        propertyId: lst.propertyId,
        name: lst.propertyName,
        price: lst.price,
        areaTag: lst.areaTag,
      });
    }
    for (const off of offers) {
      if (
        off.buyerId === character.uid &&
        off.kind === 'sale' &&
        off.status === 'accepted' &&
        serverNowMs <= off.expiresAtMs
      ) {
        map.set(off.propertyId, {
          propertyId: off.propertyId,
          name: off.propertyName,
          price: off.amount,
          offerId: off.id,
          areaTag: 'negosiasi',
        });
      }
    }
    return Array.from(map.values());
  }, [listings, offers, character.uid, serverNowMs]);

  const ownedProperties = useMemo(
    () => properties.filter((p) => p.ownerId === character.uid),
    [properties, character.uid]
  );

  const myBusinesses = useMemo(
    () => businesses.filter((b) => b.ownerId === character.uid && b.status === 'active'),
    [businesses, character.uid]
  );

  const activeSecPropId = secPropId || ownedProperties[0]?.id || '';
  const activeSecurity = securityInstalls.find((s) => s.propertyId === activeSecPropId);

  const insuranceSubjects = useMemo(() => {
    const list: Array<{ key: string; type: 'property' | 'business'; id: string; name: string }> =
      [];
    for (const p of ownedProperties) {
      list.push({ key: `property:${p.id}`, type: 'property', id: p.id, name: `Properti: ${p.name}` });
    }
    for (const b of myBusinesses) {
      list.push({ key: `business:${b.id}`, type: 'business', id: b.id, name: `Bisnis: ${b.name}` });
    }
    return list;
  }, [ownedProperties, myBusinesses]);

  const activeInsKey = insSubjectKey || insuranceSubjects[0]?.key || '';
  const selectedInsSubject = insuranceSubjects.find((s) => s.key === activeInsKey) || null;

  if (!open) return null;

  const activeSaleTarget =
    saleCandidates.find((c) => c.propertyId === selectedPropertyId) || saleCandidates[0] || null;
  const quote = activeSaleTarget
    ? computeMortgageQuoteClient(activeSaleTarget.price, dpRate, termCycles, mortgageConfig)
    : null;

  const creditScore = bankAccount?.creditScore ?? character.creditScore ?? 65;
  const reputation = character.reputation ?? 50;
  const shifts = character.completedShifts ?? 0;
  const activeMortgages = mortgages.filter((m) => m.status === 'active');

  const kprEligible =
    Boolean(bankAccount) &&
    creditScore >= mortgageConfig.minCreditScore &&
    reputation >= mortgageConfig.minReputation &&
    wantedLevel <= mortgageConfig.maxWantedLevelAllowed &&
    shifts >= mortgageConfig.minCompletedShifts &&
    activeMortgages.length < mortgageConfig.maxActiveMortgages;

  const handleApplyMortgage = async () => {
    if (!activeSaleTarget) return;
    setBusyId('apply_kpr');
    try {
      const res = await callApplyMortgage({
        propertyId: activeSaleTarget.propertyId,
        offerId: activeSaleTarget.offerId,
        downPaymentRate: dpRate,
        termCycles,
        payFrom,
      });
      onNotify(
        `KPR Disetujui! Properti ${activeSaleTarget.name} resmi milikmu. Cicilan ${formatRupiah(res.installment)}/siklus.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Pengajuan KPR gagal.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePayMortgage = async (mortgageId: string, cycles = 1) => {
    setBusyId(`pay_${mortgageId}_${cycles}`);
    try {
      const res = await callPayMortgage(mortgageId, payFrom, cycles);
      onNotify(
        res.status === 'paid'
          ? 'Selamat! KPR Properti telah LUNAS sepenuhnya!'
          : `Cicilan ${formatRupiah(res.paid)} lunas. Sisa pokok: ${formatRupiah(res.remaining)}.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membayar cicilan KPR.');
    } finally {
      setBusyId(null);
    }
  };

  const handleEarlyRepay = async (mortgageId: string) => {
    setBusyId(`repay_${mortgageId}`);
    try {
      const res = await callEarlyRepay(mortgageId, payFrom);
      onNotify(`Pelunasan dipercepat berhasil (${formatRupiah(res.totalPaid)}). Properti bebas agunan!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal melunasi KPR.');
    } finally {
      setBusyId(null);
    }
  };

  const handleForeclose = async (mortgageId: string) => {
    setBusyId(`foreclose_${mortgageId}`);
    try {
      await callForeclose(mortgageId);
      onNotify('KPR disita (foreclosure) karena menunggak berat; properti dilelang oleh Bank Priangan.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memproses sita agunan KPR.');
    } finally {
      setBusyId(null);
    }
  };

  const handleInstallSecurity = async (moduleId: 'lock' | 'alarm' | 'cctv') => {
    if (!activeSecPropId) return;
    setBusyId(`sec_${moduleId}`);
    try {
      const res = await callInstallSecurity(activeSecPropId, moduleId);
      onNotify(
        `${MATERIAL_NAMES[moduleId]} terpasang! Skor proteksi: ${res.protectionScore}% · Biaya: ${formatRupiah(res.monthlyCost)}/siklus.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memasang modul keamanan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleGuard = async (action: 'hire' | 'dismiss') => {
    if (!activeSecPropId) return;
    setBusyId(`guard_${action}`);
    try {
      const res = await callHireGuard(activeSecPropId, action, guardNameInput.trim() || 'Satpam Hansip');
      onNotify(
        action === 'hire'
          ? `Satpam Hansip disewa! Skor proteksi properti: ${res.protectionScore}%.`
          : `Kontrak satpam dihentikan. Skor proteksi: ${res.protectionScore}%.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengatur satpam properti.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBuyInsurance = async (planId: 'basic' | 'premium') => {
    if (!selectedInsSubject) return;
    setBusyId(`ins_${planId}`);
    try {
      await callBuyInsurance(selectedInsSubject.type, selectedInsSubject.id, planId);
      onNotify(`Polis asuransi ${planId.toUpperCase()} aktif untuk ${selectedInsSubject.name}!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli polis asuransi.');
    } finally {
      setBusyId(null);
    }
  };

  const activePolicies = insurancePolicies.filter((p) => p.status === 'active');
  const claimableRecords = crimeRecords.filter(
    (r) => !r.insuranceClaimed && (r.targetType === 'property' || r.targetType === 'business')
  );

  const handleFileClaim = async () => {
    const pid = claimPolicyId || activePolicies[0]?.id;
    const rid = claimRecordId || claimableRecords[0]?.id;
    if (!pid || !rid) {
      onNotify('Pilih polis aktif dan catatan kerugian kriminal terlebih dahulu.');
      return;
    }
    setBusyId('claim_ins');
    try {
      const res = await callFileClaim(pid, rid);
      onNotify(`Klaim asuransi cair! Dana penggantian: +${formatRupiah(res.payoutAmount)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengajukan klaim asuransi.');
    } finally {
      setBusyId(null);
    }
  };

  const secScore = activeSecurity?.protectionScore ?? activeSecurity?.totalProtection ?? 0;
  const secMonthly = activeSecurity?.monthlyCost ?? activeSecurity?.monthlyFee ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                KPR Bank Priangan, Keamanan &amp; Asuransi
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Dompet{' '}
                <span className="font-mono tabular-nums text-emerald-300">
                  {formatRupiah(character.money)}
                </span>{' '}
                · Giro{' '}
                <span className="font-mono tabular-nums text-sky-300">
                  {bankAccount ? formatRupiah(bankAccount.balance) : 'Belum Ada'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            aria-label="Tutup panel KPR dan keamanan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs + Payment Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 pt-2 shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'mortgage' as ModalTab, label: `KPR (${activeMortgages.length})` },
              { id: 'security' as ModalTab, label: 'Keamanan Properti' },
              { id: 'insurance' as ModalTab, label: `Asuransi (${activePolicies.length})` },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  tab === item.id
                    ? 'border-amber-400 bg-slate-800/80 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'mortgage' && (
            <div className="flex items-center gap-1 pb-1.5 text-[11px]">
              <span className="text-slate-400">Dana:</span>
              <button
                type="button"
                onClick={() => setPayFrom('bank')}
                disabled={!bankAccount}
                className={`rounded-md px-2 py-1 font-semibold disabled:opacity-40 ${
                  payFrom === 'bank' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Bank
              </button>
              <button
                type="button"
                onClick={() => setPayFrom('wallet')}
                className={`rounded-md px-2 py-1 font-semibold ${
                  payFrom === 'wallet' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Dompet
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'mortgage' && (
            <div className="space-y-4">
              {/* Kelayakan KPR */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Syarat Kelayakan KPR Bank Priangan</span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      kprEligible ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {kprEligible ? 'Memenuhi Syarat' : 'Perlu Dilengkapi'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                  <div className={bankAccount ? 'text-emerald-300' : 'text-rose-300'}>
                    • Rekening Bank: {bankAccount ? 'Aktif' : 'Belum'}
                  </div>
                  <div className={creditScore >= mortgageConfig.minCreditScore ? 'text-emerald-300' : 'text-rose-300'}>
                    • Skor Kredit: {creditScore}/{mortgageConfig.minCreditScore}
                  </div>
                  <div className={reputation >= mortgageConfig.minReputation ? 'text-emerald-300' : 'text-rose-300'}>
                    • Reputasi: {reputation}/{mortgageConfig.minReputation}
                  </div>
                  <div className={wantedLevel <= mortgageConfig.maxWantedLevelAllowed ? 'text-emerald-300' : 'text-rose-300'}>
                    • Wanted: {wantedLevel}/{mortgageConfig.maxWantedLevelAllowed}
                  </div>
                  <div className={shifts >= mortgageConfig.minCompletedShifts ? 'text-emerald-300' : 'text-rose-300'}>
                    • Shift Kerja: {shifts}/{mortgageConfig.minCompletedShifts}
                  </div>
                </div>
                {!bankAccount && onOpenBank && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBank();
                    }}
                    className="mt-1 rounded-lg bg-sky-500/20 border border-sky-500/40 px-3 py-1.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/30"
                  >
                    Buka Rekening Bank Dulu
                  </button>
                )}
              </div>

              {/* Ajukan KPR Baru */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/35 p-3.5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Simulasi &amp; Pengajuan KPR Baru
                </h3>

                {saleCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Saat ini belum ada properti dijual yang tersedia untuk KPR.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">
                        Pilih Properti Dijual / Tawaran Disetujui
                      </label>
                      <select
                        value={activeSaleTarget?.propertyId || ''}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                      >
                        {saleCandidates.map((c) => (
                          <option key={c.propertyId} value={c.propertyId}>
                            {c.name} — {formatRupiah(c.price)} {c.offerId ? '(Nego Disetujui)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Uang Muka / DP ({Math.round(dpRate * 100)}%)
                        </label>
                        <input
                          type="range"
                          min={Math.round(mortgageConfig.minDownPaymentRate * 100)}
                          max={Math.round(mortgageConfig.maxDownPaymentRate * 100)}
                          step={5}
                          value={Math.round(dpRate * 100)}
                          onChange={(e) => setDpRate(Number(e.target.value) / 100)}
                          className="w-full accent-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">Tenor Cicilan</label>
                        <div className="grid grid-cols-3 gap-1">
                          {mortgageConfig.tenors.map((t) => (
                            <button
                              key={t.termCycles}
                              type="button"
                              onClick={() => setTermCycles(t.termCycles)}
                              className={`min-h-[36px] rounded-lg border px-2 py-1 text-[11px] font-bold font-mono ${
                                termCycles === t.termCycles
                                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                                  : 'border-slate-700 bg-slate-950 text-slate-400'
                              }`}
                            >
                              {t.termCycles}x ({(t.interestRatePerTerm * 100).toFixed(0)}%)
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {quote && (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                        <div>
                          <div className="text-[10px] font-sans text-slate-400">Uang Muka (DP)</div>
                          <div className="font-bold text-white">{formatRupiah(quote.downPayment)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-sans text-slate-400">BPHTB (2,5%)</div>
                          <div className="font-bold text-amber-300">{formatRupiah(quote.transferTax)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-sans text-slate-400">Total Bayar Awal</div>
                          <div className="font-bold text-emerald-300">{formatRupiah(quote.upfrontTotal)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-sans text-slate-400">Cicilan / Siklus</div>
                          <div className="font-bold text-sky-300">
                            {formatRupiah(quote.installment)} ({quote.termCycles}x)
                          </div>
                        </div>
                      </div>
                    )}

                    {!nearMortgageDesk && onGuideToMortgageDesk ? (
                      <button
                        type="button"
                        disabled={!kprEligible || !quote || busyId !== null}
                        onClick={() => {
                          onClose();
                          onGuideToMortgageDesk();
                        }}
                        className="w-full min-h-[44px] rounded-xl border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        Arahkan ke Bank / Kantor Agen untuk Akad KPR
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!kprEligible || !quote || busyId !== null}
                        onClick={() => void handleApplyMortgage()}
                        className="w-full min-h-[44px] rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        {busyId === 'apply_kpr' ? 'Memproses Akad KPR...' : 'Ajukan & Akad KPR'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Daftar KPR Aktif */}
              {mortgages.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Riwayat &amp; Cicilan KPR Anda
                  </h3>
                  {mortgages.map((m) => {
                    const inst = m.installment ?? m.installmentAmount ?? 0;
                    const rem = m.remaining ?? m.remainingPrincipal ?? 0;
                    const canForeclose =
                      m.status === 'active' &&
                      (m.missedCount >= mortgageConfig.maxMissedBeforeForeclosure ||
                        serverNowMs > m.nextDueAtMs + mortgageConfig.gracePeriodMs);

                    return (
                      <div
                        key={m.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Home className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              <span>{m.propertyName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                              Cicilan {m.paidCycles}/{m.termCycles}x · Telat {m.missedCount}/
                              {mortgageConfig.maxMissedBeforeForeclosure}
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums text-xs font-bold">
                            {m.status === 'paid' ? (
                              <span className="text-emerald-300">LUNAS</span>
                            ) : m.status === 'foreclosed' ? (
                              <span className="text-rose-400">DISITA</span>
                            ) : (
                              <span className="text-amber-300">Sisa {formatRupiah(rem)}</span>
                            )}
                          </div>
                        </div>

                        {m.status === 'active' && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => void handlePayMortgage(m.id, 1)}
                              className="min-h-[40px] rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-45"
                            >
                              Bayar 1x ({formatRupiah(inst)})
                            </button>
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => void handleEarlyRepay(m.id)}
                              className="min-h-[40px] rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-45"
                            >
                              Lunasi Cepat
                            </button>
                            {canForeclose && (
                              <button
                                type="button"
                                disabled={busyId !== null}
                                onClick={() => void handleForeclose(m.id)}
                                className="min-h-[40px] rounded-lg border border-rose-500/50 bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25 disabled:opacity-45"
                              >
                                Sita Lelang
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              {ownedProperties.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 text-xs text-slate-400">
                  Kamu belum memiliki properti pribadi. Beli atau bangun properti terlebih dahulu untuk memasang sistem keamanan.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Pilih Properti Anda</label>
                    <select
                      value={activeSecPropId}
                      onChange={(e) => setSecPropId(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    >
                      {ownedProperties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.areaTag})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ringkasan Proteksi */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Tingkat Keamanan Properti
                      </span>
                      <span className="font-mono tabular-nums font-bold text-emerald-300">
                        {secScore}% · Biaya {formatRupiah(secMonthly)}/siklus
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        style={{ width: `${Math.min(100, secScore)}%` }}
                        className="h-full bg-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Modul Lock / Alarm / CCTV */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(['lock', 'alarm', 'cctv'] as const).map((modId) => {
                      const cfg = lawConfig.securityModules[modId];
                      const installed = Boolean(activeSecurity?.modules?.[modId]);
                      const Icon = modId === 'lock' ? Lock : modId === 'alarm' ? AlertTriangle : Camera;
                      return (
                        <div
                          key={modId}
                          className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                              <Icon className="h-4 w-4 text-sky-400 shrink-0" />
                              <span>{cfg.label}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                              +{cfg.protection}% proteksi · +{formatRupiah(cfg.monthlyCost)}/siklus
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={installed || busyId !== null}
                            onClick={() => void handleInstallSecurity(modId)}
                            className={`min-h-[40px] w-full rounded-xl px-3 py-1.5 text-xs font-bold ${
                              installed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-45'
                            }`}
                          >
                            {installed ? 'Terpasang' : `Pasang (${formatRupiah(cfg.installCost)})`}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Satpam Hansip NPC */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <UserCheck className="h-4 w-4 text-amber-300" />
                        <span>{lawConfig.securityModules.guard.label}</span>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-amber-300">
                        +{lawConfig.securityModules.guard.protection}% · {formatRupiah(lawConfig.securityModules.guard.monthlyCost)}/siklus
                      </span>
                    </div>

                    {activeSecurity?.modules?.guard ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-emerald-300">
                          Aktif berjaga: <strong>{activeSecurity.guardName || 'Satpam Hansip'}</strong>
                        </span>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void handleGuard('dismiss')}
                          className="min-h-[38px] rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
                        >
                          Berhentikan
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={guardNameInput}
                          onChange={(e) => setGuardNameInput(e.target.value)}
                          placeholder="Nama Satpam Hansip..."
                          className="flex-1 min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void handleGuard('hire')}
                          className="min-h-[42px] rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                        >
                          Sewa ({formatRupiah(lawConfig.securityModules.guard.installCost)})
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'insurance' && (
            <div className="space-y-4">
              {insuranceSubjects.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 text-xs text-slate-400">
                  Kamu perlu memiliki properti atau bisnis aktif untuk membeli polis asuransi perlindungan kerugian.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5 space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Objek Pertanggungan
                    </label>
                    <select
                      value={activeInsKey}
                      onChange={(e) => setInsSubjectKey(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    >
                      {insuranceSubjects.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(['basic', 'premium'] as const).map((planId) => {
                      const plan = lawConfig.insurancePlans[planId];
                      return (
                        <div
                          key={planId}
                          className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-sky-400" />
                              {plan.label}
                            </span>
                            <span className="font-mono tabular-nums text-amber-300">
                              {formatRupiah(plan.premiumPerCycle)}/siklus
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums space-y-0.5">
                            <div>Plafon: {formatRupiah(plan.coverageAmount)}</div>
                            <div>Risiko Sendiri: {Math.round(plan.deductibleRate * 100)}%</div>
                            <div>Maks Klaim: {plan.maxClaimsPerCycle}x/siklus</div>
                          </div>
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void handleBuyInsurance(planId)}
                            className="min-h-[40px] w-full rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-45"
                          >
                            Aktifkan {plan.label}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Polis Aktif & Klaim */}
              {activePolicies.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Polis Asuransi Aktif
                  </h3>
                  {activePolicies.map((pol) => (
                    <div
                      key={pol.id}
                      className="rounded-xl border border-emerald-500/35 bg-slate-950/80 p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span>
                            {pol.subjectName || pol.propertyName || pol.subjectId} ({pol.planLabel || pol.planId})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          Plafon {formatRupiah(pol.coverageAmount)} · Terpakai{' '}
                          {pol.claimsThisCycle ?? pol.claimsUsed ?? 0}/{pol.maxClaimsPerCycle}
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-amber-300 font-bold">
                        {formatRupiah(pol.premiumPerCycle)}/siklus
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Ajukan Klaim */}
              {activePolicies.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <FileCheck2 className="h-4 w-4 text-emerald-400" />
                    <span>Ajukan Klaim Kerugian Pencurian / Kerusakan</span>
                  </div>
                  {claimableRecords.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      Belum ada insiden kriminal terhadap properti/bisnis yang perlu diklaim.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={claimPolicyId || activePolicies[0]?.id || ''}
                          onChange={(e) => setClaimPolicyId(e.target.value)}
                          className="min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                        >
                          {activePolicies.map((pol) => (
                            <option key={pol.id} value={pol.id}>
                              {pol.subjectName || pol.subjectId} ({pol.planId})
                            </option>
                          ))}
                        </select>
                        <select
                          value={claimRecordId || claimableRecords[0]?.id || ''}
                          onChange={(e) => setClaimRecordId(e.target.value)}
                          className="min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                        >
                          {claimableRecords.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.offenseTitle} — {r.targetId || 'Insiden'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void handleFileClaim()}
                        className="w-full min-h-[42px] rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        Ajukan Pencairan Klaim
                      </button>
                    </>
                  )}
                </div>
              )}

              {insuranceClaims.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Riwayat Klaim ({insuranceClaims.length})
                  </div>
                  {insuranceClaims.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-300">Klaim #{c.crimeRecordId.slice(0, 8)}</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-300">
                        +{formatRupiah(c.payoutAmount)} ({c.status})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
