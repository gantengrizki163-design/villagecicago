import React, { useCallback, useEffect, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Car, Package, Search, ShoppingBag, Store, Tag, X } from 'lucide-react';
import {
  callBuyMarketListing,
  callCancelMarketListing,
  callCreateMarketListing,
  callListVehicleForSale,
  callTransferVehicle,
  fetchMarketListingsPaginated,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { localSimulation } from '../firebase/localSimulation';
import { computeVehicleMarketValueClient, getDefaultVehicleConfig } from '../firebase/vehicleConfigCache';
import type {
  BusinessDoc,
  CharacterDoc,
  InventoryItemDoc,
  MarketListingDoc,
  MarketStatDoc,
  TaxConfigDoc,
  VehicleDoc,
  VehicleListingDoc,
} from '../types/game';

interface MarketplaceModalProps {
  open: boolean;
  character: CharacterDoc;
  inventory: InventoryItemDoc[];
  localListings: MarketListingDoc[];
  marketStats: MarketStatDoc[];
  taxConfig: TaxConfigDoc;
  vehicles?: VehicleDoc[];
  vehicleListings?: VehicleListingDoc[];
  businesses?: BusinessDoc[];
  serverNowMs?: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type MarketTab = 'browse' | 'vehicles' | 'sell' | 'mine';

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({
  open,
  character,
  inventory,
  localListings,
  marketStats,
  taxConfig,
  vehicles = [],
  vehicleListings = [],
  businesses = [],
  serverNowMs,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<MarketTab>('browse');
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');

  const [fsListings, setFsListings] = useState<MarketListingDoc[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [buyQtyMap, setBuyQtyMap] = useState<Record<string, number>>({});

  // Sell form
  const sellableInv = inventory.filter((i) => i.quantity > 0);
  const [sellItemId, setSellItemId] = useState('');
  const [sellQty, setSellQty] = useState('1');
  const [sellUnitPrice, setSellUnitPrice] = useState('12000');
  const [sellArea, setSellArea] = useState('pasar');

  // Vehicle P2P filter & sell state
  const [vehCategoryFilter, setVehCategoryFilter] = useState<'all' | 'motor' | 'mobil'>('all');
  const [sellVehId, setSellVehId] = useState('');
  const [sellVehPrice, setSellVehPrice] = useState('');
  const [sellVehBizId, setSellVehBizId] = useState('');

  const useLocal = localSimulation.isActive();
  const vehicleBundle = getDefaultVehicleConfig();
  const nowMs = serverNowMs ?? Date.now();

  const loadListings = useCallback(
    async (reset = true) => {
      if (useLocal) return;
      setLoading(true);
      try {
        const res = await fetchMarketListingsPaginated({
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          areaTag: categoryFilter === 'all' && areaFilter !== 'all' ? areaFilter : undefined,
          pageSize: 8,
          cursor: reset ? null : cursor,
        });
        setFsListings((prev) => (reset ? res.listings : [...prev, ...res.listings]));
        setCursor(res.lastDoc);
        setHasMore(res.hasMore);
      } catch {
        // Fallback ke localListings
      } finally {
        setLoading(false);
      }
    },
    [useLocal, categoryFilter, areaFilter, cursor]
  );

  useEffect(() => {
    if (open && tab === 'browse' && !useLocal) {
      void loadListings(true);
    }
  }, [open, tab, useLocal, categoryFilter, areaFilter]);

  useEffect(() => {
    if (sellableInv.length > 0 && !sellableInv.some((i) => i.itemId === sellItemId)) {
      const first = sellableInv[0];
      setSellItemId(first.itemId);
      const stat = marketStats.find((s) => s.itemId === first.itemId);
      if (stat) setSellUnitPrice(String(stat.currentPrice));
    }
  }, [sellableInv, sellItemId, marketStats]);

  const sellableVehicles = vehicles.filter((v) => v.status === 'parked' && !v.leaseId);
  const myDealerBusinesses = businesses.filter(
    (b) => b.ownerId === character.uid && b.status === 'active' && b.type === 'dealer'
  );

  useEffect(() => {
    if (sellableVehicles.length > 0 && !sellableVehicles.some((v) => v.id === sellVehId)) {
      const first = sellableVehicles[0];
      setSellVehId(first.id);
      const val = computeVehicleMarketValueClient(first, nowMs, vehicleBundle.vehicles);
      setSellVehPrice(String(val));
    }
  }, [sellableVehicles, sellVehId, nowMs, vehicleBundle.vehicles]);

  if (!open) return null;

  const sourceList = useLocal || fsListings.length === 0 ? localListings : fsListings;
  const maxP = Number(maxPrice) > 0 ? Number(maxPrice) : Infinity;
  const qLower = searchText.trim().toLowerCase();

  const filteredBrowse = sourceList.filter((l) => {
    if (l.status !== 'active') return false;
    if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
    if (areaFilter !== 'all' && l.areaTag !== areaFilter) return false;
    if (l.unitPrice > maxP) return false;
    if (qLower && !l.itemName.toLowerCase().includes(qLower) && !l.sellerName.toLowerCase().includes(qLower)) {
      return false;
    }
    return true;
  });

  const myListings = sourceList.filter((l) => l.sellerId === character.uid && l.status === 'active');
  const activeVehicleListings = vehicleListings.filter((l) => l.status === 'active');
  const filteredVehicles = activeVehicleListings.filter((l) => {
    if (vehCategoryFilter !== 'all' && l.category !== vehCategoryFilter) return false;
    if (
      qLower &&
      !l.vehicleName.toLowerCase().includes(qLower) &&
      !l.plateNumber.toLowerCase().includes(qLower) &&
      !l.ownerName.toLowerCase().includes(qLower)
    ) {
      return false;
    }
    return true;
  });
  const selectedSellVehicle = sellableVehicles.find((v) => v.id === sellVehId) ?? null;
  const selectedVehVal = selectedSellVehicle
    ? computeVehicleMarketValueClient(selectedSellVehicle, nowMs, vehicleBundle.vehicles)
    : 0;
  const selectedVehMin = Math.round(selectedVehVal * vehicleBundle.dealer.marketplace.minPriceRatio);
  const selectedVehMax = Math.round(selectedVehVal * vehicleBundle.dealer.marketplace.maxPriceRatio);
  const slotsFull = vehicles.length >= vehicleBundle.vehicles.maxOwnedVehiclesPerPlayer;

  const handleBuy = async (listing: MarketListingDoc) => {
    const qty = Math.max(1, Math.min(listing.qty, buyQtyMap[listing.id] ?? listing.qty));
    setBusy(true);
    try {
      const res = await callBuyMarketListing(listing.id, qty);
      onNotify(`Transaksi escrow selesai! Membeli ${res.buyQty}x ${listing.itemName} (${formatRupiah(res.gross)}).`);
      if (!useLocal) void loadListings(true);
    } catch (err) {
      onNotify((err as Error)?.message || 'Pembelian marketplace gagal.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellItemId) return onNotify('Pilih barang dari inventaris terlebih dahulu.');
    const q = Math.max(1, Math.floor(Number(sellQty) || 1));
    const p = Math.floor(Number(sellUnitPrice) || 0);
    setBusy(true);
    try {
      await callCreateMarketListing(sellItemId, q, p, sellArea);
      onNotify('Listing barang berhasil diterbitkan ke escrow marketplace!');
      setTab('browse');
      if (!useLocal) void loadListings(true);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menerbitkan listing.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (listingId: string) => {
    setBusy(true);
    try {
      await callCancelMarketListing(listingId);
      onNotify('Listing dibatalkan. Barang dikembalikan dari escrow ke inventaris.');
      if (!useLocal) void loadListings(true);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membatalkan listing.');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyVehicle = async (lst: VehicleListingDoc) => {
    setBusy(true);
    try {
      await callTransferVehicle(lst.id);
      onNotify(`Berhasil membeli & balik nama ${lst.vehicleName} (${lst.plateNumber})!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli kendaraan P2P.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelVehicleListing = async (listingId: string) => {
    setBusy(true);
    try {
      await callListVehicleForSale({ action: 'cancel', listingId });
      onNotify('Iklan kendaraan dibatalkan dan dikembalikan ke garasi.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membatalkan iklan kendaraan.');
    } finally {
      setBusy(false);
    }
  };

  const handleListVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSellVehicle) return onNotify('Pilih kendaraan terparkir bebas leasing.');
    const askPrice = Math.round(Number(sellVehPrice) || 0);
    setBusy(true);
    try {
      await callListVehicleForSale({
        action: 'create',
        vehicleId: selectedSellVehicle.id,
        price: askPrice,
        businessId: sellVehBizId || undefined,
      });
      onNotify(`${selectedSellVehicle.name} berhasil dipajang di Bursa Kendaraan P2P!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memasang iklan kendaraan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Marketplace Warga Cicalengka</h2>
              <p className="text-[11px] text-slate-400">
                Jual-beli antar pemain aman via Escrow · Biaya transaksi {(taxConfig.marketplaceFeeRate * 100).toFixed(0)}% · Dompet: {formatRupiah(character.money)}
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

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900 px-3 pt-1.5 gap-1 overflow-x-auto">
          {[
            { id: 'browse' as MarketTab, label: 'Cari Barang' },
            { id: 'vehicles' as MarketTab, label: `Kendaraan (${activeVehicleListings.length})` },
            { id: 'sell' as MarketTab, label: 'Jual dari Tas' },
            { id: 'mine' as MarketTab, label: `Lapak Saya (${myListings.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                tab === t.id
                  ? 'border-amber-400 bg-slate-800/80 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'browse' && (
            <>
              {/* Filter Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Cari barang/penjual"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="food">Makanan &amp; Minuman</option>
                  <option value="raw">Bahan Baku</option>
                  <option value="goods">Sembako / Umum</option>
                  <option value="bengkel">Suku Cadang</option>
                  <option value="furniture">Furnitur</option>
                </select>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">Semua Lokasi</option>
                  <option value="pasar">Area Pasar</option>
                  <option value="stasiun">Dekat Stasiun</option>
                  <option value="alun_alun">Alun-Alun</option>
                  <option value="kampung">Kampung</option>
                </select>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Maks Rp/unit"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
                />
              </div>

              {loading && filteredBrowse.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Memuat listing marketplace...</p>
              ) : filteredBrowse.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center text-xs text-slate-400">
                  Belum ada barang aktif yang sesuai filter saat ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBrowse.map((item) => {
                    const qty = Math.max(1, Math.min(item.qty, buyQtyMap[item.id] ?? item.qty));
                    const isMine = item.sellerId === character.uid;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-amber-300">
                            <Package className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{item.itemName}</div>
                            <div className="text-[11px] text-slate-400">
                              Penjual: {item.sellerName} · Lokasi: {item.areaTag} · Stok: <strong className="font-mono text-slate-200">{item.qty}</strong>
                            </div>
                            <div className="font-mono text-[11px] font-bold text-emerald-300 mt-0.5">
                              {formatRupiah(item.unitPrice)} / unit
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isMine ? (
                            <>
                              <input
                                type="number"
                                min={1}
                                max={item.qty}
                                value={qty}
                                onChange={(e) =>
                                  setBuyQtyMap((prev) => ({
                                    ...prev,
                                    [item.id]: Math.max(1, Math.min(item.qty, Number(e.target.value) || 1)),
                                  }))
                                }
                                className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-xs text-white"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleBuy(item)}
                                className="rounded-lg bg-emerald-500 px-3 py-1.5 font-mono text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                              >
                                Beli ({formatRupiah(item.unitPrice * qty)})
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleCancel(item.id)}
                              className="rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-1.5 text-[11px] font-bold text-rose-300"
                            >
                              Tarik Listing
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {hasMore && !useLocal && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void loadListings(false)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      {loading ? 'Memuat...' : 'Muat Listing Berikutnya'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'vehicles' && (
            <div className="space-y-3">
              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Cari model, plat D, atau penjual"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <select
                  value={vehCategoryFilter}
                  onChange={(e) => setVehCategoryFilter(e.target.value as 'all' | 'motor' | 'mobil')}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">Semua Kendaraan (Motor &amp; Mobil)</option>
                  <option value="motor">Sepeda Motor</option>
                  <option value="mobil">Mobil / Niaga</option>
                </select>
              </div>

              {filteredVehicles.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center text-xs text-slate-400">
                  Belum ada kendaraan warga yang sedang dijual di Marketplace P2P.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredVehicles.map((lst) => {
                    const isMine = lst.ownerId === character.uid;
                    const transferTax = Math.round(
                      lst.price * vehicleBundle.dealer.marketplace.titleTransferTaxRate
                    );
                    const dealerBiz = lst.sellerBusinessId
                      ? businesses.find((b) => b.id === lst.sellerBusinessId)
                      : null;
                    return (
                      <div
                        key={lst.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sky-300">
                            <Car className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-white/30 shrink-0"
                                style={{ backgroundColor: lst.color }}
                              />
                              <span className="font-bold text-white truncate">{lst.vehicleName}</span>
                              <span className="font-mono text-[11px] font-bold text-amber-300">
                                {lst.plateNumber}
                              </span>
                              {lst.sellerBusinessId && (
                                <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                                  <Store className="h-2.5 w-2.5" />
                                  {dealerBiz ? dealerBiz.name : 'Dealer Pemain'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                              Penjual: {lst.ownerName} · Kondisi {Math.round(lst.condition)}% · Odo {lst.odometerKm.toFixed(1)} km
                            </div>
                            <div className="font-mono text-[11px] font-bold text-emerald-300 mt-0.5">
                              {formatRupiah(lst.price)}{' '}
                              <span className="text-slate-400 font-normal">
                                (+Balik nama 3%: {formatRupiah(transferTax)})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isMine ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleCancelVehicleListing(lst.id)}
                              className="rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-1.5 text-[11px] font-bold text-rose-300"
                            >
                              Tarik Iklan
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || slotsFull}
                              onClick={() => void handleBuyVehicle(lst)}
                              className="rounded-lg bg-sky-500 px-3 py-1.5 font-mono text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                            >
                              {slotsFull
                                ? 'Garasi Penuh'
                                : `Beli (${formatRupiah(lst.price + transferTax)})`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Form jual kendaraan milik sendiri */}
              <form
                onSubmit={(e) => void handleListVehicle(e)}
                className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"
              >
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                  <Tag className="h-3.5 w-3.5" />
                  Pasang Jual Kendaraan (Escrow &amp; Balik Nama)
                </h3>
                {sellableVehicles.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Tidak ada unit kendaraan terparkir bebas leasing yang siap dijual saat ini.
                  </p>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">Unit Kendaraan</label>
                        <select
                          value={sellVehId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSellVehId(id);
                            const v = sellableVehicles.find((item) => item.id === id);
                            if (v) {
                              setSellVehPrice(
                                String(computeVehicleMarketValueClient(v, nowMs, vehicleBundle.vehicles))
                              );
                            }
                          }}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                        >
                          {sellableVehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.plateNumber})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Harga Jual ({formatRupiah(selectedVehMin)} – {formatRupiah(selectedVehMax)})
                        </label>
                        <input
                          type="number"
                          min={selectedVehMin}
                          max={selectedVehMax}
                          step={1000}
                          value={sellVehPrice}
                          onChange={(e) => setSellVehPrice(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                        />
                      </div>
                    </div>
                    {myDealerBusinesses.length > 0 && (
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Etalase Dealer Usaha (Opsional — hasil jual masuk Kas Bisnis)
                        </label>
                        <select
                          value={sellVehBizId}
                          onChange={(e) => setSellVehBizId(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="">Penjualan Pribadi (masuk dompet)</option>
                          {myDealerBusinesses.map((b) => (
                            <option key={b.id} value={b.id}>
                              Dealer {b.name} (masuk kas usaha)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                    >
                      {busy
                        ? 'Memproses...'
                        : `Iklankan Kendaraan (Biaya ${formatRupiah(vehicleBundle.dealer.marketplace.listingFee)})`}
                    </button>
                  </>
                )}
              </form>
            </div>
          )}

          {tab === 'sell' && (
            <form onSubmit={(e) => void handleCreateListing(e)} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Tag className="h-4 w-4" />
                Pasang Barang di Marketplace (Escrow)
              </h3>
              {sellableInv.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Inventaris tas kamu kosong. Beli makanan, furnitur, atau barang bisnis terlebih dahulu.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Pilih Barang di Tas</label>
                    <select
                      value={sellItemId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSellItemId(id);
                        const stat = marketStats.find((s) => s.itemId === id);
                        if (stat) setSellUnitPrice(String(stat.currentPrice));
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    >
                      {sellableInv.map((i) => (
                        <option key={i.itemId} value={i.itemId}>
                          {i.name} (Tersedia: {i.quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Jumlah</label>
                      <input
                        type="number"
                        min={1}
                        max={sellableInv.find((i) => i.itemId === sellItemId)?.quantity || 100}
                        value={sellQty}
                        onChange={(e) => setSellQty(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Harga / unit</label>
                      <input
                        type="number"
                        min={500}
                        step={500}
                        value={sellUnitPrice}
                        onChange={(e) => setSellUnitPrice(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Lokasi</label>
                      <select
                        value={sellArea}
                        onChange={(e) => setSellArea(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="pasar">Pasar</option>
                        <option value="stasiun">Stasiun</option>
                        <option value="alun_alun">Alun-Alun</option>
                        <option value="kampung">Kampung</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Barang ditahan aman di sistem escrow dan harga dibatasi batas wajar terhadap harga pasar untuk mencegah arbitrase.
                  </p>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {busy ? 'Memasang...' : 'Terbitkan ke Marketplace'}
                  </button>
                </>
              )}
            </form>
          )}

          {tab === 'mine' && (
            <div className="space-y-2">
              {myListings.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Kamu tidak memiliki listing marketplace aktif.
                </p>
              ) : (
                myListings.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {l.qty}x {l.itemName}
                      </div>
                      <div className="font-mono text-[11px] text-emerald-300">
                        {formatRupiah(l.unitPrice)} / unit · Total {formatRupiah(l.price)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancel(l.id)}
                      className="rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/30"
                    >
                      Batalkan
                    </button>
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
