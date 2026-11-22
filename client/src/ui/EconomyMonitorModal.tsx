import React, { useState } from 'react';
import { BarChart2, Flame, Landmark, RefreshCw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { callUpdateMarketStats } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type { MarketStatDoc, TaxConfigDoc, TreasuryStateDoc } from '../types/game';

interface EconomyMonitorModalProps {
  open: boolean;
  marketStats: MarketStatDoc[];
  treasury: TreasuryStateDoc;
  taxConfig: TaxConfigDoc;
  serverNowMs: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const EconomyMonitorModal: React.FC<EconomyMonitorModalProps> = ({
  open,
  marketStats,
  treasury,
  taxConfig,
  serverNowMs,
  onClose,
  onNotify,
}) => {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const eventRemainMin = Math.max(0, Math.ceil((treasury.activeEventUntilMs - serverNowMs) / 60_000));

  const handleRefreshMacro = async () => {
    setBusy(true);
    try {
      const res = await callUpdateMarketStats();
      if (res.skippedCooldown) {
        onNotify('Harga pasar baru saja disegarkan (cooldown batch aktif untuk hemat kuota).');
      } else {
        onNotify('Harga pasar dinamis & indeks inflasi berhasil diperbarui!');
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyegarkan data pasar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Pantauan Ekonomi &amp; Kas Daerah</h2>
              <p className="text-[11px] text-slate-400">
                Harga Dinamis Supply-Demand · Inflasi Terkendali · Kas Negara Transparan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRefreshMacro()}
              className="flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              Update Harga
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Macro Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Landmark className="h-3 w-3 text-emerald-400" />
                Saldo Kas Negara
              </div>
              <div className="font-mono text-sm font-bold text-emerald-300 mt-0.5">
                {formatRupiah(treasury.balance)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[10px] text-slate-400">Total Pajak Terkumpul</div>
              <div className="font-mono text-sm font-bold text-amber-300 mt-0.5">
                {formatRupiah(treasury.totalTaxCollected)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[10px] text-slate-400">Indeks Inflasi / Harga</div>
              <div className="font-mono text-sm font-bold text-sky-300 mt-0.5">
                {treasury.inflationIndex.toFixed(3)}x · {(treasury.avgMarketPriceIndex ?? 1).toFixed(2)}x
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[10px] text-slate-400">Est. Uang Beredar</div>
              <div className="font-mono text-sm font-bold text-white mt-0.5">
                {formatRupiah(treasury.estimatedMoneySupply || 0)}
              </div>
            </div>
          </div>

          {/* Active Economic Event + Tax Breakdown */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Flame className="h-4 w-4" />
                  Event Ekonomi Berjalan
                </span>
                <span className="font-mono text-[10px] text-slate-300">Sisa ~{eventRemainMin}m</span>
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {treasury.activeEventLabel || treasury.activeEventId}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Memengaruhi pengali harga pasar komoditas sesuai musim &amp; jadwal kota.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-1">
              <div className="font-bold text-slate-200 mb-1">Rincian Tarif &amp; Penerimaan Pajak</div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>PPh Gaji ({(taxConfig.incomeTaxRate * 100).toFixed(0)}%)</span>
                <span className="font-mono text-slate-200">{formatRupiah(treasury.incomeTaxTotal || 0)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>PPN &amp; Laba Bisnis ({(taxConfig.businessSalesVatRate * 100).toFixed(0)}% / {(taxConfig.businessProfitTaxRate * 100).toFixed(0)}%)</span>
                <span className="font-mono text-slate-200">{formatRupiah(treasury.businessTaxTotal || 0)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Properti &amp; Sewa ({(taxConfig.propertySaleTaxRate * 100).toFixed(1)}% / {(taxConfig.propertyRentalTaxRate * 100).toFixed(0)}%)</span>
                <span className="font-mono text-slate-200">{formatRupiah(treasury.propertyTaxTotal || 0)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Fee Marketplace &amp; Lelang ({(taxConfig.marketplaceFeeRate * 100).toFixed(0)}% / {(taxConfig.auctionFeeRate * 100).toFixed(0)}%)</span>
                <span className="font-mono text-slate-200">
                  {formatRupiah((treasury.marketFeeTotal || 0) + (treasury.auctionFeeTotal || 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Commodity Market Price Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Komoditas / Produk</th>
                  <th className="px-3 py-2 text-right">Harga Dasar</th>
                  <th className="px-3 py-2 text-right">Harga Pasar</th>
                  <th className="px-3 py-2 text-right">Grosir</th>
                  <th className="px-3 py-2 text-right">Supply / Demand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono text-[11px]">
                {marketStats.map((st) => {
                  const pct = Math.round(((st.currentPrice - st.basePrice) / Math.max(1, st.basePrice)) * 100);
                  return (
                    <tr key={st.itemId} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-sans font-semibold text-white">
                        {st.name}
                        <span className="ml-1.5 text-[10px] font-normal text-slate-400">({st.category})</span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">{formatRupiah(st.basePrice)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-bold text-white">{formatRupiah(st.currentPrice)}</span>
                        {pct !== 0 && (
                          <span className={`ml-1 inline-flex items-center text-[10px] ${pct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-teal-300">
                        {formatRupiah(st.wholesalePrice ?? Math.round(st.basePrice * 0.78))}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">
                        {st.supply} / {st.demand}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
