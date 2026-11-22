import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  Car,
  ChefHat,
  Megaphone,
  Package,
  Plus,
  Store,
  Tag,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import {
  callBuyStock,
  callCloseBusiness,
  callCreateBusiness,
  callDiscardStock,
  callFireEmployee,
  callHireEmployee,
  callListVehicleForSale,
  callPayWages,
  callPostBusinessJob,
  callProduceItem,
  callRunPromotion,
  callSellBusiness,
  callSetBusinessSettings,
  callSetPrice,
  callSettleNpcSales,
  callWithdrawBusinessProfit,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { computeVehicleMarketValueClient, getDefaultVehicleConfig } from '../firebase/vehicleConfigCache';
import { KANTOR_DESA_POS } from '../world3d/worldConstants';
import type {
  BusinessConfigDoc,
  BusinessDailyReportDoc,
  BusinessDoc,
  BusinessEmployeeDoc,
  BusinessStockDoc,
  BusinessType,
  CharacterDoc,
  ProductsConfigDoc,
  PropertyDoc,
  TaxConfigDoc,
  VehicleDoc,
  VehicleListingDoc,
} from '../types/game';

interface BusinessModalProps {
  open: boolean;
  initialView?: 'manage' | 'create' | 'craft';
  initialBusinessId?: string | null;
  character: CharacterDoc;
  myBusinesses: BusinessDoc[];
  properties: PropertyDoc[];
  stockByBiz: Record<string, BusinessStockDoc[]>;
  employeesByBiz: Record<string, BusinessEmployeeDoc[]>;
  reportsByBiz: Record<string, BusinessDailyReportDoc[]>;
  businessConfig: BusinessConfigDoc;
  productsConfig: ProductsConfigDoc;
  taxConfig: TaxConfigDoc;
  vehicles?: VehicleDoc[];
  vehicleListings?: VehicleListingDoc[];
  nearKantorDesa: boolean;
  serverNowMs: number;
  onGuideToKantorDesa?: () => void;
  onOpenWholesale: (businessId: string) => void;
  onOpenWorkshop?: (businessId: string) => void;
  onOpenDealerBursa?: () => void;
  onEnterBusiness3D: (business: BusinessDoc) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type BizTab = 'overview' | 'stock' | 'employees' | 'reports' | 'create';

export const BusinessModal: React.FC<BusinessModalProps> = ({
  open,
  initialView = 'manage',
  initialBusinessId,
  character,
  myBusinesses,
  properties,
  stockByBiz,
  employeesByBiz,
  reportsByBiz,
  businessConfig,
  productsConfig,
  taxConfig,
  vehicles = [],
  vehicleListings = [],
  nearKantorDesa,
  serverNowMs,
  onGuideToKantorDesa,
  onOpenWholesale,
  onOpenWorkshop,
  onOpenDealerBursa,
  onEnterBusiness3D,
  onClose,
  onNotify,
}) => {
  const activeBusinesses = myBusinesses.filter((b) => b.status !== 'closed');
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [tab, setTab] = useState<BizTab>('overview');
  const [busy, setBusy] = useState(false);

  // Create business state
  const [newType, setNewType] = useState<BusinessType>('warung');
  const [newName, setNewName] = useState('');
  const [newPropertyId, setNewPropertyId] = useState('');
  const [newCapital, setNewCapital] = useState('100000');

  // Management states
  const [withdrawAmt, setWithdrawAmt] = useState('25000');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [hirePlayerName, setHirePlayerName] = useState('');
  const [hireWage, setHireWage] = useState('30000');
  const [jobRole, setJobRole] = useState('Kasir & Pramusaji');
  const [dealerVehId, setDealerVehId] = useState('');
  const [dealerVehPrice, setDealerVehPrice] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initialView === 'create' || activeBusinesses.length === 0) {
      setTab('create');
    } else if (initialView === 'craft') {
      setTab('stock');
    } else {
      setTab('overview');
    }

    if (initialBusinessId && activeBusinesses.some((b) => b.id === initialBusinessId)) {
      setSelectedBizId(initialBusinessId);
    } else if (activeBusinesses.length > 0 && !activeBusinesses.some((b) => b.id === selectedBizId)) {
      setSelectedBizId(activeBusinesses[0].id);
    }
  }, [open, initialView, initialBusinessId, activeBusinesses.length]);

  const eligibleProperties = properties.filter((p) => {
    const allowed = businessConfig.businessTypes[newType]?.allowedPropertyTypes || [];
    const controlsProp = p.ownerId === character.uid || character.currentHomeId === p.id;
    return controlsProp && allowed.includes(p.type) && !p.activeBusinessId && !p.activeAuctionId;
  });

  useEffect(() => {
    if (eligibleProperties.length > 0 && !eligibleProperties.some((p) => p.id === newPropertyId)) {
      setNewPropertyId(eligibleProperties[0].id);
    }
  }, [newType, eligibleProperties, newPropertyId]);

  if (!open) return null;

  const currentBiz = activeBusinesses.find((b) => b.id === selectedBizId) || activeBusinesses[0] || null;
  const currentStocks = currentBiz ? stockByBiz[currentBiz.id] || [] : [];
  const currentEmployees = currentBiz ? employeesByBiz[currentBiz.id] || [] : [];
  const currentReports = currentBiz ? reportsByBiz[currentBiz.id] || [] : [];
  const typeRecipes = currentBiz
    ? productsConfig.recipes.filter((r) => r.businessTypes.includes(currentBiz.type))
    : [];

  const vehicleBundle = getDefaultVehicleConfig();
  const parkableOwnedVehicles = vehicles.filter((v) => v.status === 'parked' && !v.leaseId);
  const dealerShowroomListings = currentBiz
    ? vehicleListings.filter((l) => l.status === 'active' && l.sellerBusinessId === currentBiz.id)
    : [];
  const chosenDealerVeh =
    parkableOwnedVehicles.find((v) => v.id === dealerVehId) ?? parkableOwnedVehicles[0] ?? null;
  const chosenDealerVehVal = chosenDealerVeh
    ? computeVehicleMarketValueClient(chosenDealerVeh, serverNowMs, vehicleBundle.vehicles)
    : 0;
  const dealerMinPrice = Math.round(chosenDealerVehVal * vehicleBundle.dealer.marketplace.minPriceRatio);
  const dealerMaxPrice = Math.round(chosenDealerVehVal * vehicleBundle.dealer.marketplace.maxPriceRatio);

  const selectedTypeMeta = businessConfig.businessTypes[newType];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPropertyId) {
      return onNotify('Lengkapi nama usaha dan pilih lokasi ruko/lapak.');
    }
    setBusy(true);
    try {
      const cap = Math.floor(Number(newCapital) || selectedTypeMeta.minCapital);
      await callCreateBusiness(newType, newName.trim(), newPropertyId, cap);
      onNotify(`Selamat! Bisnis ${newName.trim()} resmi berdiri!`);
      setNewName('');
      setTab('overview');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membuka bisnis.');
    } finally {
      setBusy(false);
    }
  };

  const handleSettleNpc = async () => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      const res = await callSettleNpcSales(currentBiz.id);
      if ((res.salesCount || 0) > 0) {
        onNotify(
          `${res.salesCount} pelanggan NPC berbelanja! Omzet +${formatRupiah(res.revenue || 0)}.`
        );
      } else {
        onNotify('Belum ada transaksi NPC baru. Pastikan toko Buka & ada produk siap jual.');
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyinkronkan penjualan NPC.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleOpen = async () => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      await callSetBusinessSettings(currentBiz.id, { isOpen: !currentBiz.isOpen });
      onNotify(`Status ${currentBiz.name} diubah menjadi ${!currentBiz.isOpen ? 'BUKA' : 'TUTUP'}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengubah status buka/tutup.');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdrawProfit = async () => {
    if (!currentBiz) return;
    const amt = Math.floor(Number(withdrawAmt) || 0);
    setBusy(true);
    try {
      const res = await callWithdrawBusinessProfit(currentBiz.id, amt);
      onNotify(
        `Tarik laba berhasil! Diterima ${formatRupiah(res.netReceived)} (Pajak usaha: ${formatRupiah(res.tax)}).`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menarik laba.');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePrice = async (itemId: string, fallbackPrice: number) => {
    if (!currentBiz) return;
    const p = Math.floor(Number(priceEdits[itemId] ?? fallbackPrice));
    setBusy(true);
    try {
      const res = await callSetPrice(currentBiz.id, itemId, p);
      onNotify(`Harga jual diperbarui menjadi ${formatRupiah(res.sellPrice)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengubah harga.');
    } finally {
      setBusy(false);
    }
  };

  const handleProduce = async (recipeId: string) => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      const res = await callProduceItem(currentBiz.id, recipeId, 1);
      onNotify(`Produksi berhasil: +${res.producedQty} ${res.itemName}!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Bahan baku atau energi tidak cukup untuk produksi.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickRestock = async (itemId: string) => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      const res = await callBuyStock(currentBiz.id, itemId, 5, 'business');
      onNotify(`Tambah stok +5 (${formatRupiah(res.totalCost)}) dari kas bisnis.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli stok cepat.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async (itemId: string) => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      await callDiscardStock(currentBiz.id, itemId);
      onNotify('Stok kedaluwarsa/terpilih telah dibuang dari rak.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membuang stok.');
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = async (tierId: string) => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      await callRunPromotion(currentBiz.id, tierId);
      onNotify('Promosi aktif! Popularitas toko meningkat untuk menarik lebih banyak NPC.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Kas bisnis kurang untuk promosi.');
    } finally {
      setBusy(false);
    }
  };

  const handleHireNpc = async () => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      const res = await callHireEmployee({ businessId: currentBiz.id, mode: 'npc' });
      onNotify(`Berhasil merekrut asisten NPC: ${res.name || 'Staf Toko'}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal merekrut NPC.');
    } finally {
      setBusy(false);
    }
  };

  const handleHirePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBiz || !hirePlayerName.trim()) return;
    setBusy(true);
    try {
      await callHireEmployee({
        businessId: currentBiz.id,
        mode: 'player',
        targetName: hirePlayerName.trim(),
        roleTitle: jobRole,
        wagePerShift: Number(hireWage) || 25000,
      });
      onNotify(`Undangan staf dikirim/direkrut untuk ${hirePlayerName.trim()}.`);
      setHirePlayerName('');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal merekrut pemain.');
    } finally {
      setBusy(false);
    }
  };

  const handlePostJob = async () => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      await callPostBusinessJob(currentBiz.id, jobRole || 'Karyawan Bisnis', Number(hireWage) || 25000, 1);
      onNotify('Lowongan kerja bisnis dipublikasikan untuk seluruh warga Cicalengka!');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memasang lowongan.');
    } finally {
      setBusy(false);
    }
  };

  const handlePayWages = async () => {
    if (!currentBiz) return;
    setBusy(true);
    try {
      const res = await callPayWages(currentBiz.id);
      onNotify(`Gaji karyawan dibayarkan: ${formatRupiah(res.totalPaid || 0)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Kas bisnis tidak mencukupi untuk gaji.');
    } finally {
      setBusy(false);
    }
  };

  const handleListDealerVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBiz || !chosenDealerVeh || busy) return;
    const askPrice = Math.round(Number(dealerVehPrice || chosenDealerVehVal) || 0);
    setBusy(true);
    try {
      await callListVehicleForSale({
        action: 'create',
        vehicleId: chosenDealerVeh.id,
        price: askPrice,
        businessId: currentBiz.id,
      });
      setDealerVehPrice('');
      onNotify(`${chosenDealerVeh.name} dipajang di showroom ${currentBiz.name}!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memajang unit ke showroom dealer.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelDealerListing = async (listingId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await callListVehicleForSale({ action: 'cancel', listingId });
      onNotify('Unit ditarik dari showroom & dikembalikan ke garasi.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menarik unit dari showroom.');
    } finally {
      setBusy(false);
    }
  };

  const maxChartVal = Math.max(
    1,
    ...currentReports.slice(0, 7).map((r) => Math.max(r.revenue, r.stockCost + r.wageCost + r.taxPaid))
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {currentBiz ? currentBiz.name : 'Pusat Bisnis & Izin Usaha'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeBusinesses.length > 0
                  ? `${activeBusinesses.length}/${businessConfig.maxBusinessesPerPlayer} Usaha Aktif · Dompet: ${formatRupiah(character.money)}`
                  : 'Kantor Desa Cicalengka · Urus Izin & Kelola Usaha'}
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

        {/* Business Selector Bar */}
        {activeBusinesses.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-950/70 px-4 py-2">
            {activeBusinesses.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBizId(b.id);
                  if (tab === 'create') setTab('overview');
                }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  currentBiz?.id === b.id && tab !== 'create'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${b.isOpen ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                {b.name}
              </button>
            ))}
            {activeBusinesses.length < businessConfig.maxBusinessesPerPlayer && (
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  tab === 'create'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-700 bg-slate-900 text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Buka Usaha
              </button>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        {currentBiz && tab !== 'create' && (
          <div className="flex border-b border-slate-800 bg-slate-900 px-3 pt-1.5 gap-1 overflow-x-auto">
            {[
              { id: 'overview' as BizTab, label: 'Ringkasan & Promosi', icon: BriefcaseBusiness },
              { id: 'stock' as BizTab, label: 'Stok & Produksi', icon: Package },
              { id: 'employees' as BizTab, label: 'Karyawan', icon: Users },
              { id: 'reports' as BizTab, label: 'Laporan Laba/Rugi', icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? 'border-emerald-400 bg-slate-800/80 text-emerald-300'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'create' || !currentBiz ? (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-3 rounded-xl border border-slate-700/80 bg-slate-800/40 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Registrasi Usaha &amp; Izin Kantor Desa</h3>
                <span className="font-mono text-xs text-amber-300">
                  Izin: {formatRupiah(selectedTypeMeta.permitFee)}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Jenis Usaha</label>
                  <select
                    value={newType}
                    onChange={(e) => {
                      const t = e.target.value as BusinessType;
                      setNewType(t);
                      setNewCapital(String(businessConfig.businessTypes[t].minCapital));
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {Object.entries(businessConfig.businessTypes).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label} (Min Modal {formatRupiah(meta.minCapital)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Nama Toko / Usaha</label>
                  <input
                    type="text"
                    maxLength={32}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Misal: Warung Barokah Cicalengka"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Lokasi Ruko / Lapak (Milik/Sewa Anda)
                  </label>
                  <select
                    value={newPropertyId}
                    onChange={(e) => setNewPropertyId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {eligibleProperties.length === 0 ? (
                      <option value="">Belum ada ruko/lapak bebas</option>
                    ) : (
                      eligibleProperties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Modal Kas Awal (Min {formatRupiah(selectedTypeMeta.minCapital)})
                  </label>
                  <input
                    type="number"
                    min={selectedTypeMeta.minCapital}
                    step={10000}
                    value={newCapital}
                    onChange={(e) => setNewCapital(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {eligibleProperties.length === 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                  Sewa atau beli properti bertipe <strong>{selectedTypeMeta.allowedPropertyTypes.join(' / ')}</strong> lewat menu <strong>Cari Rumah / Properti</strong> terlebih dahulu.
                </div>
              )}

              {!nearKantorDesa && (
                <div className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-2 text-xs text-sky-200 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Pastikan karaktermu berada di dekat <strong>Kantor Desa Cicalengka</strong> ({KANTOR_DESA_POS.x}, {KANTOR_DESA_POS.z}) atau lokasi properti usaha untuk pengesahan izin.
                  </span>
                  {onGuideToKantorDesa && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGuideToKantorDesa();
                      }}
                      className="rounded-lg bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-sky-400"
                    >
                      Tunjukkan Arah ke Kantor Desa
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || eligibleProperties.length === 0}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy
                  ? 'Mengurus Izin...'
                  : `Buka Usaha (Total ${formatRupiah(
                      selectedTypeMeta.permitFee + (Number(newCapital) || selectedTypeMeta.minCapital)
                    )})`}
              </button>
            </form>
          ) : (
            <>
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                      <div className="text-[10px] text-slate-400">Kas Bisnis</div>
                      <div className="font-mono text-sm font-bold text-emerald-300">
                        {formatRupiah(currentBiz.cash)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                      <div className="text-[10px] text-slate-400">Popularitas</div>
                      <div className="font-mono text-sm font-bold text-amber-300">
                        {Math.round(currentBiz.popularity)} / 100
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                      <div className="text-[10px] text-slate-400">Status Toko</div>
                      <div className={`text-sm font-bold ${currentBiz.isOpen ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {currentBiz.isOpen ? 'BUKA' : 'TUTUP'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                      <div className="text-[10px] text-slate-400">Jam Operasional</div>
                      <div className="font-mono text-sm font-bold text-sky-300">
                        {String(currentBiz.hours?.openHour ?? 7).padStart(2, '0')}:00 -{' '}
                        {String(currentBiz.hours?.closeHour ?? 22).padStart(2, '0')}:00
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleToggleOpen()}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
                        currentBiz.isOpen
                          ? 'bg-rose-500/20 border border-rose-500/50 text-rose-200 hover:bg-rose-500/30'
                          : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      }`}
                    >
                      {currentBiz.isOpen ? 'Tutup Sementara' : 'Buka Toko Sekarang'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSettleNpc()}
                      className="rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
                    >
                      Tutup Buku &amp; Hitung Pelanggan NPC
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenWholesale(currentBiz.id);
                      }}
                      className="rounded-xl border border-teal-500/50 bg-teal-500/20 px-3.5 py-2 text-xs font-bold text-teal-200 hover:bg-teal-500/30"
                    >
                      Belanja Stok di Pasar Grosir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEnterBusiness3D(currentBiz);
                      }}
                      className="rounded-xl border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Masuk Interior Toko 3D
                    </button>
                  </div>

                  {/* Operasional Khusus Bengkel Pemain */}
                  {currentBiz.type === 'bengkel' && (
                    <div className="rounded-xl border border-sky-500/40 bg-sky-950/35 p-3.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-200">
                            <Wrench className="h-4 w-4" />
                            Layanan Bengkel Kendaraan Warga
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Warga dapat servis mesin, ganti oli, cat ulang, &amp; pasang aksesori di bengkel ini (omzet masuk ke Kas Bisnis, pajak 5%).
                          </p>
                        </div>
                        {onOpenWorkshop && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenWorkshop(currentBiz.id);
                            }}
                            className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
                          >
                            Buka Layanan Servis
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Operasional Khusus Showroom Dealer Pemain */}
                  {currentBiz.type === 'dealer' && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                            <Car className="h-4 w-4" />
                            Showroom Dealer Kendaraan ({dealerShowroomListings.length} Unit Dipajang)
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Hasil penjualan unit showroom otomatis masuk ke Kas Bisnis ({formatRupiah(currentBiz.cash)}).
                          </p>
                        </div>
                        {onOpenDealerBursa && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenDealerBursa();
                            }}
                            className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                          >
                            Buka Bursa P2P
                          </button>
                        )}
                      </div>

                      {dealerShowroomListings.length > 0 && (
                        <div className="space-y-1.5">
                          {dealerShowroomListings.map((lst) => (
                            <div
                              key={lst.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/75 px-3 py-2 text-xs"
                            >
                              <div>
                                <span className="font-bold text-white">{lst.vehicleName}</span>{' '}
                                <span className="font-mono text-amber-300">{lst.plateNumber}</span>
                                <div className="font-mono text-[10px] text-emerald-300">
                                  {formatRupiah(lst.price)} · Kondisi {Math.round(lst.condition)}%
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleCancelDealerListing(lst.id)}
                                className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-200"
                              >
                                Tarik Unit
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {parkableOwnedVehicles.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                          Belum ada kendaraan pribadi terparkir bebas leasing untuk dipajang di showroom.
                        </p>
                      ) : (
                        <form onSubmit={(e) => void handleListDealerVehicle(e)} className="grid sm:grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-1">Unit untuk Dipajang</label>
                            <select
                              value={chosenDealerVeh?.id || ''}
                              onChange={(e) => {
                                const nextId = e.target.value;
                                setDealerVehId(nextId);
                                const found = parkableOwnedVehicles.find((v) => v.id === nextId);
                                if (found) {
                                  setDealerVehPrice(
                                    String(
                                      computeVehicleMarketValueClient(found, serverNowMs, vehicleBundle.vehicles)
                                    )
                                  );
                                }
                              }}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                            >
                              {parkableOwnedVehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({v.plateNumber})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-1">
                              Harga ({formatRupiah(dealerMinPrice)}–{formatRupiah(dealerMaxPrice)})
                            </label>
                            <input
                              type="number"
                              min={dealerMinPrice}
                              max={dealerMaxPrice}
                              step={1000}
                              value={dealerVehPrice || String(chosenDealerVehVal)}
                              onChange={(e) => setDealerVehPrice(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={busy}
                            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            <Tag className="h-3.5 w-3.5" />
                            Pajang di Showroom
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Promosi */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <Megaphone className="h-4 w-4" />
                        Promosi &amp; Iklan (Boost Popularitas Sementara)
                      </span>
                      {Number(currentBiz.promoBoostUntilMs || 0) > serverNowMs && (
                        <span className="font-mono text-[11px] text-emerald-400">
                          Promo Aktif (+{currentBiz.promoBoostValue || 10} pop)
                        </span>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {businessConfig.promotions.map((promo) => (
                        <button
                          key={promo.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void handlePromote(promo.id)}
                          className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-left hover:border-amber-400 disabled:opacity-50"
                        >
                          <div className="text-xs font-bold text-white">{promo.label}</div>
                          <div className="font-mono text-[11px] text-amber-300 mt-0.5">
                            {formatRupiah(promo.cost)}
                          </div>
                          <div className="text-[10px] text-emerald-400">
                            +{promo.popularityBoost} Popularitas
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tarik Laba & Tutup Bisnis */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      Tarik Laba ke Dompet Pribadi (Pajak Laba {(taxConfig.businessProfitTaxRate * 100).toFixed(0)}%)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="number"
                        min={businessConfig.withdrawal.minWithdrawAmount}
                        step={5000}
                        value={withdrawAmt}
                        onChange={(e) => setWithdrawAmt(e.target.value)}
                        className="flex-1 min-w-[140px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleWithdrawProfit()}
                        className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Tarik Laba
                      </button>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                      <span>Sisakan saldo kas min {formatRupiah(businessConfig.withdrawal.minReserveCash)}.</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void callSellBusiness(currentBiz.id).then(() => onNotify('Bisnis dilikuidasi & dijual.'))}
                          className="text-amber-300 hover:underline"
                        >
                          Jual Bisnis
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void callCloseBusiness(currentBiz.id).then(() => onNotify('Bisnis ditutup permanen.'))}
                          className="text-rose-400 hover:underline"
                        >
                          Tutup Permanen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'stock' && (
                <div className="space-y-4">
                  {/* Inventaris Stok Toko */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Rak Stok &amp; Harga Jual ({currentStocks.length} item)
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenWholesale(currentBiz.id);
                      }}
                      className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-teal-400"
                    >
                      + Beli Grosir
                    </button>
                  </div>

                  {currentStocks.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                      Rak toko masih kosong. Belanja bahan baku atau produk di Pasar Grosir terlebih dahulu.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentStocks.map((st) => {
                        const expired = st.expiresAtMs > 0 && serverNowMs >= st.expiresAtMs;
                        const editVal = priceEdits[st.itemId] ?? String(st.sellPrice);
                        return (
                          <div
                            key={st.itemId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{st.name}</span>
                                <span className="font-mono text-[11px] font-bold text-emerald-300">
                                  Stok: {st.qty}
                                </span>
                                {expired && (
                                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                                    Kedaluwarsa
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">
                                Modal rata-rata: {formatRupiah(st.avgCost)} · Kategori: {st.category}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step={500}
                                value={editVal}
                                onChange={(e) =>
                                  setPriceEdits((prev) => ({ ...prev, [st.itemId]: e.target.value }))
                                }
                                className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-white"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleSavePrice(st.itemId, st.sellPrice)}
                                className="rounded-lg bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-sky-400"
                              >
                                Set
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleQuickRestock(st.itemId)}
                                className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300"
                              >
                                +5
                              </button>
                              {expired && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleDiscard(st.itemId)}
                                  className="rounded-lg border border-rose-500/50 bg-rose-500/15 p-1 text-rose-300"
                                  title="Buang stok busuk"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Resep Produksi */}
                  {typeRecipes.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <ChefHat className="h-4 w-4" />
                        Produksi / Pengolahan Bahan Baku
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {typeRecipes.map((rec) => {
                          const canCraft = rec.inputs.every(
                            (inp) => (currentStocks.find((s) => s.itemId === inp.itemId)?.qty ?? 0) >= inp.qty
                          );
                          return (
                            <div
                              key={rec.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate">
                                  {rec.name} (x{rec.outputQty})
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Bahan:{' '}
                                  {rec.inputs.map((i) => `${i.qty}x ${i.itemId}`).join(' + ')} · Energi -{rec.energyCost}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={busy || !canCraft}
                                onClick={() => void handleProduce(rec.id)}
                                className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                              >
                                Produksi
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'employees' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Karyawan Aktif ({currentEmployees.filter((e) => e.status === 'active').length}/
                      {businessConfig.businessTypes[currentBiz.type]?.maxEmployees || 2})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleHireNpc()}
                        className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Rekrut NPC ({formatRupiah(businessConfig.npcEmployee.wagePerGameDay)}/hr)
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePayWages()}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        Bayar Semua Gaji
                      </button>
                    </div>
                  </div>

                  {currentEmployees.filter((e) => e.status === 'active').length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                      Belum ada karyawan. Rekrut NPC atau buka lowongan untuk pemain lain agar kapasitas layanan meningkat.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentEmployees
                        .filter((e) => e.status === 'active')
                        .map((emp) => (
                          <div
                            key={emp.id}
                            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">
                                {emp.name}{' '}
                                <span className="text-[10px] font-normal text-sky-300">
                                  ({emp.isNpc ? 'NPC' : 'Pemain'} · {emp.roleTitle})
                                </span>
                              </div>
                              <div className="font-mono text-[11px] text-slate-400">
                                Gaji: {formatRupiah(emp.wagePerCycle)} · Tunggakan:{' '}
                                <span className={emp.unpaidWage > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                                  {formatRupiah(emp.unpaidWage)}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void callFireEmployee(currentBiz.id, emp.id)}
                              className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/30"
                            >
                              Pecat
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Lowongan & Rekrut Pemain */}
                  <form onSubmit={(e) => void handleHirePlayer(e)} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
                    <h4 className="text-xs font-bold text-white">Buka Lowongan / Rekrut Pemain Langsung</h4>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={jobRole}
                        onChange={(e) => setJobRole(e.target.value)}
                        placeholder="Jabatan"
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      />
                      <input
                        type="number"
                        min={businessConfig.playerEmployee.minWagePerShift}
                        max={businessConfig.playerEmployee.maxWagePerShift}
                        value={hireWage}
                        onChange={(e) => setHireWage(e.target.value)}
                        placeholder="Gaji/shift"
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                      />
                      <input
                        type="text"
                        value={hirePlayerName}
                        onChange={(e) => setHirePlayerName(e.target.value)}
                        placeholder="Nama pemain (opsional)"
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePostJob()}
                        className="rounded-lg border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                      >
                        Pasang Lowongan Publik
                      </button>
                      <button
                        type="submit"
                        disabled={busy || !hirePlayerName.trim()}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                      >
                        Rekrut Pemain Target
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {tab === 'reports' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Laporan Keuangan Harian &amp; Grafik Laba/Rugi
                    </h3>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSettleNpc()}
                      className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-sky-400"
                    >
                      Sinkronkan Omzet NPC
                    </button>
                  </div>

                  {currentReports.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                      Belum ada laporan harian. Tekan &ldquo;Sinkronkan Omzet NPC&rdquo; setelah memiliki stok dan membuka toko.
                    </div>
                  ) : (
                    <>
                      {/* Grafik Batang Sederhana Laba vs Biaya */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Grafik Perbandingan Omzet vs Biaya ({currentReports.slice(0, 7).length} hari)</span>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Omzet
                            </span>
                            <span className="flex items-center gap-1 text-rose-400">
                              <span className="h-2 w-2 rounded-sm bg-rose-500" /> Biaya/Pajak
                            </span>
                          </div>
                        </div>
                        <div className="flex items-end gap-2 h-28 pt-2 border-b border-slate-800">
                          {currentReports
                            .slice(0, 7)
                            .reverse()
                            .map((rep) => {
                              const revPct = Math.max(4, Math.round((rep.revenue / maxChartVal) * 100));
                              const costTotal = rep.stockCost + rep.wageCost + rep.taxPaid + rep.promoCost;
                              const costPct = Math.max(4, Math.round((costTotal / maxChartVal) * 100));
                              return (
                                <div key={rep.dayKey} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                                  <div className="flex items-end gap-1 h-full w-full justify-center">
                                    <div
                                      style={{ height: `${revPct}%` }}
                                      className="w-3 rounded-t bg-emerald-500/85"
                                      title={`Omzet: ${formatRupiah(rep.revenue)}`}
                                    />
                                    <div
                                      style={{ height: `${costPct}%` }}
                                      className="w-3 rounded-t bg-rose-500/80"
                                      title={`Biaya: ${formatRupiah(costTotal)}`}
                                    />
                                  </div>
                                  <span className="font-mono text-[9px] text-slate-400 truncate max-w-full">
                                    {rep.dayKey.replace(/^day_/, 'H')}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* Tabel Keuangan Harian */}
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-[10px] uppercase text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Periode</th>
                              <th className="px-3 py-2 text-right">Omzet</th>
                              <th className="px-3 py-2 text-right">Stok &amp; Gaji</th>
                              <th className="px-3 py-2 text-right">Pajak/Iklan</th>
                              <th className="px-3 py-2 text-right">Laba Bersih</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono text-[11px]">
                            {currentReports.slice(0, 10).map((rep) => (
                              <tr key={rep.dayKey} className="hover:bg-slate-800/40">
                                <td className="px-3 py-2 font-sans font-semibold text-white">
                                  {rep.dayKey}
                                  <div className="text-[10px] font-normal text-slate-400">
                                    NPC: {rep.npcSales} · Warga: {rep.playerSales}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right text-emerald-300">
                                  {formatRupiah(rep.revenue)}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-300">
                                  {formatRupiah(rep.stockCost + rep.wageCost)}
                                </td>
                                <td className="px-3 py-2 text-right text-amber-300">
                                  {formatRupiah(rep.taxPaid + rep.promoCost)}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-bold ${
                                    rep.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {formatRupiah(rep.netProfit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
