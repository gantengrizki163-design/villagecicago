import React, { useEffect, useState } from 'react';
import { PackagePlus, TrendingDown, TrendingUp, Truck, X } from 'lucide-react';
import { callBuyStock } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { computeBestVehicleCargoBonus } from '../firebase/vehicleConfigCache';
import type {
  BusinessDoc,
  CharacterDoc,
  MarketStatDoc,
  ProductsConfigDoc,
  VehicleDoc,
} from '../types/game';

interface WholesaleMarketModalProps {
  open: boolean;
  initialBusinessId?: string | null;
  character: CharacterDoc;
  myBusinesses: BusinessDoc[];
  marketStats: MarketStatDoc[];
  productsConfig: ProductsConfigDoc;
  vehicles?: VehicleDoc[];
  onOpenCreateBusiness: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const WholesaleMarketModal: React.FC<WholesaleMarketModalProps> = ({
  open,
  initialBusinessId,
  character,
  myBusinesses,
  marketStats,
  productsConfig,
  vehicles = [],
  onOpenCreateBusiness,
  onClose,
  onNotify,
}) => {
  const activeBusinesses = myBusinesses.filter((b) => b.status === 'active');
  const [selectedBizId, setSelectedBizId] = useState('');
  const [payFrom, setPayFrom] = useState<'business' | 'wallet'>('business');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const cargo = computeBestVehicleCargoBonus(vehicles);
  const maxQty = cargo.maxWholesaleQty;

  useEffect(() => {
    if (!open) return;
    if (initialBusinessId && activeBusinesses.some((b) => b.id === initialBusinessId)) {
      setSelectedBizId(initialBusinessId);
    } else if (activeBusinesses.length > 0 && !activeBusinesses.some((b) => b.id === selectedBizId)) {
      setSelectedBizId(activeBusinesses[0].id);
    }
  }, [open, initialBusinessId, activeBusinesses.length]);

  if (!open) return null;

  const selectedBiz = activeBusinesses.find((b) => b.id === selectedBizId) || activeBusinesses[0] || null;

  const filteredProducts = productsConfig.products.filter((p) => {
    if (selectedBiz && !p.businessTypes.includes(selectedBiz.type)) return false;
    if (supplierFilter !== 'all' && p.supplierId !== supplierFilter) return false;
    return p.supplierId !== null || selectedBiz;
  });

  const handleBuyWholesale = async (itemId: string) => {
    if (!selectedBiz) return onNotify('Buka bisnis terlebih dahulu sebelum kulakan di Pasar Grosir.');
    const qty = Math.max(1, Math.min(maxQty, Math.floor(qtyMap[itemId] ?? 10)));
    setBusy(true);
    try {
      const res = await callBuyStock(selectedBiz.id, itemId, qty, payFrom);
      onNotify(`Kulakan +${res.qty} stok selesai! Biaya ${formatRupiah(res.totalCost)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli stok grosir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Pasar Grosir Cicalengka</h2>
              <p className="text-[11px] text-slate-400">
                Harga supplier mengikuti harga pasar dinamis · Dompet: {formatRupiah(character.money)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Business & Payment Controls */}
        <div className="grid sm:grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2.5 text-xs">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Tujuan Usaha</label>
            <select
              value={selectedBiz?.id || ''}
              onChange={(e) => setSelectedBizId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
            >
              {activeBusinesses.length === 0 ? (
                <option value="">Belum ada usaha aktif</option>
              ) : (
                activeBusinesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (Kas {formatRupiah(b.cash)})
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Filter Supplier</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="all">Semua Supplier</option>
              {productsConfig.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Sumber Pembayaran</label>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setPayFrom('business')}
                className={`rounded py-1 text-[11px] font-semibold ${
                  payFrom === 'business' ? 'bg-teal-600 text-white' : 'text-slate-400'
                }`}
              >
                Kas Bisnis
              </button>
              <button
                type="button"
                onClick={() => setPayFrom('wallet')}
                className={`rounded py-1 text-[11px] font-semibold ${
                  payFrom === 'wallet' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                Dompet
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Truck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            {cargo.bestVehicle ? (
              <span>
                Armada angkut: <strong className="text-white">{cargo.bestVehicle.name}</strong> (+
                <span className="font-mono text-emerald-300">{cargo.trunkCapacity}</span> bagasi)
              </span>
            ) : (
              <span>Angkut jalan kaki (miliki Pickup/Truk Kecil/Box Kurir untuk kapasitas lebih besar)</span>
            )}
          </div>
          <span className="font-mono font-bold text-teal-300 shrink-0">
            Maks {maxQty} unit/beli
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {!selectedBiz ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center space-y-3">
              <p className="text-xs text-slate-300">
                Kamu belum memiliki usaha aktif untuk menerima barang grosir.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateBusiness();
                }}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                Buka Usaha di Kantor Desa
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Tidak ada produk grosir untuk filter ini.
            </p>
          ) : (
            filteredProducts.map((prod) => {
              const stat = marketStats.find((s) => s.itemId === prod.id);
              const unitWholesale = stat?.wholesalePrice ?? prod.wholesalePrice;
              const diffPct = Math.round(((unitWholesale - prod.wholesalePrice) / prod.wholesalePrice) * 100);
              const qty = Math.max(1, Math.min(maxQty, Math.floor(qtyMap[prod.id] ?? 10)));
              const presets = maxQty >= 100 ? [10, 25, 50, maxQty] : maxQty >= 60 ? [10, 25, maxQty] : [5, 10, 20];

              return (
                <div
                  key={prod.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{prod.name}</span>
                      {diffPct !== 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold ${
                            diffPct > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {diffPct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      Grosir: <strong className="text-teal-300">{formatRupiah(unitWholesale)}</strong> · Saran Jual:{' '}
                      {formatRupiah(prod.suggestedRetail)} ·{' '}
                      {prod.shelfLifeGameDays > 0 ? `Basi ${prod.shelfLifeGameDays} hari` : 'Tahan lama'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQtyMap((prev) => ({ ...prev, [prod.id]: preset }))}
                        className={`rounded-md px-2 py-1 font-mono text-[11px] border ${
                          qty === preset
                            ? 'border-teal-400 bg-teal-500/20 text-teal-200'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={maxQty}
                      value={qty}
                      onChange={(e) =>
                        setQtyMap((prev) => ({
                          ...prev,
                          [prod.id]: Math.max(1, Math.min(maxQty, Math.floor(Number(e.target.value) || 1))),
                        }))
                      }
                      className="w-14 rounded-md border border-slate-700 bg-slate-900 px-1.5 py-1 text-center font-mono text-[11px] text-white"
                      aria-label={`Jumlah beli ${prod.name}`}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleBuyWholesale(prod.id)}
                      className="rounded-lg bg-teal-500 px-3 py-1.5 font-mono text-[11px] font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
                    >
                      Beli ({formatRupiah(unitWholesale * qty)})
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
