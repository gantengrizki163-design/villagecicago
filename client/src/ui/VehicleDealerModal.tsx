import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bike,
  Car,
  Check,
  CreditCard,
  Fuel,
  Gauge,
  Navigation,
  Play,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  callBuyVehicle,
  callBuyVehicleOnCredit,
  callListVehicleForSale,
  callTestDriveStart,
  callTradeInVehicle,
  callTransferVehicle,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import {
  computeVehicleLeaseQuoteClient,
  computeVehicleMarketValueClient,
  getDefaultVehicleConfig,
  getVehicleModelById,
} from '../firebase/vehicleConfigCache';
import type {
  BankAccountDoc,
  BusinessDoc,
  CharacterDoc,
  VehicleDoc,
  VehicleListingDoc,
  VehicleModelConfig,
} from '../types/game';
import { VehiclePreview3D } from '../components/VehiclePreview3D';
import { findLotPlacement } from '../world3d/layout/layoutHelpers';
import { getTabSessionId } from '../world3d/vehicles/vehicleMultiplayer';
import { distance2D, INTERACT_RADIUS_METERS } from '../world3d/worldConstants';

interface VehicleDealerModalProps {
  open: boolean;
  initialDealerId?: string | null;
  character: CharacterDoc;
  bankAccount: BankAccountDoc | null;
  vehicles: VehicleDoc[];
  vehicleListings: VehicleListingDoc[];
  businesses?: BusinessDoc[];
  playerPos: { x: number; z: number };
  serverNowMs?: number;
  onGuideToDealer?: (dealerId: string) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type DealerPurchaseMode = 'cash' | 'bank' | 'credit' | 'trade_in';

export const VehicleDealerModal: React.FC<VehicleDealerModalProps> = ({
  open,
  initialDealerId,
  character,
  bankAccount,
  vehicles,
  vehicleListings,
  businesses = [],
  playerPos,
  serverNowMs,
  onGuideToDealer,
  onClose,
  onNotify,
}) => {
  const bundle = getDefaultVehicleConfig();
  const dealers = bundle.dealer.dealers;
  const nowMs = serverNowMs ?? Date.now();

  const [activeTab, setActiveTab] = useState<string>(initialDealerId || dealers[0]?.id || 'dealer_motor_baru');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [purchaseMode, setPurchaseMode] = useState<DealerPurchaseMode>('cash');
  const [downPaymentRate, setDownPaymentRate] = useState<number>(0.3);
  const [termCycles, setTermCycles] = useState<number>(bundle.dealer.leasing.tenors[1]?.termCycles ?? 6);
  const [tradeInVehicleId, setTradeInVehicleId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (
      initialDealerId === 'bursa_p2p' ||
      (initialDealerId && dealers.some((d) => d.id === initialDealerId))
    ) {
      setActiveTab(initialDealerId);
    } else if (dealers[0]) {
      setActiveTab(dealers[0].id);
    }
    setPurchaseMode('cash');
  }, [open, initialDealerId, dealers]);

  const activeDealer = useMemo(
    () => dealers.find((d) => d.id === activeTab) ?? null,
    [dealers, activeTab]
  );

  const dealerModels = useMemo<VehicleModelConfig[]>(() => {
    if (!activeDealer) return [];
    return activeDealer.modelIds
      .map((id) => getVehicleModelById(id, bundle.vehicles))
      .filter((m): m is VehicleModelConfig => Boolean(m && m.sellable));
  }, [activeDealer, bundle.vehicles]);

  useEffect(() => {
    if (dealerModels.length === 0) return;
    const stillValid = dealerModels.some((m) => m.id === selectedModelId);
    const chosen = stillValid ? dealerModels.find((m) => m.id === selectedModelId)! : dealerModels[0];
    if (!stillValid) {
      setSelectedModelId(chosen.id);
    }
    if (!chosen.colors.includes(selectedColor)) {
      setSelectedColor(chosen.colors[0] || '#1E293B');
    }
  }, [dealerModels, selectedModelId, selectedColor]);

  const selectedModel = useMemo(
    () => dealerModels.find((m) => m.id === selectedModelId) ?? dealerModels[0] ?? null,
    [dealerModels, selectedModelId]
  );

  const eligibleTradeIns = useMemo(() => {
    const minCond = bundle.dealer.tradeIn.minConditionAccepted;
    const maxOdo = bundle.dealer.tradeIn.maxOdometerKmAccepted;
    return vehicles.filter(
      (v) =>
        v.status === 'parked' &&
        !v.leaseId &&
        v.condition >= minCond &&
        v.odometerKm <= maxOdo
    );
  }, [vehicles, bundle.dealer.tradeIn]);

  useEffect(() => {
    if (eligibleTradeIns.length === 0) {
      setTradeInVehicleId('');
    } else if (!eligibleTradeIns.some((v) => v.id === tradeInVehicleId)) {
      setTradeInVehicleId(eligibleTradeIns[0].id);
    }
  }, [eligibleTradeIns, tradeInVehicleId]);

  if (!open) return null;

  const isBursaTab = activeTab === 'bursa_p2p';
  const maxOwned = bundle.vehicles.maxOwnedVehiclesPerPlayer;
  const slotsFull = vehicles.length >= maxOwned;
  const adminFee = bundle.vehicles.stnkAdminFee;
  const hasBank = Boolean(bankAccount || character.bankAccount?.accountNumber);
  const creditScore = bankAccount?.creditScore ?? character.creditScore ?? 70;
  const completedShifts =
    character.currentJob?.shiftsCompleted ?? character.completedShifts ?? 0;

  const getModelPrice = (m: VehicleModelConfig, isUsed: boolean) =>
    isUsed
      ? Math.round(((m.usedPriceMin + m.usedPriceMax) / 2) / 500) * 500
      : m.newPrice;

  const selectedPrice =
    activeDealer && selectedModel ? getModelPrice(selectedModel, activeDealer.isUsed) : 0;

  const leaseQuote =
    selectedPrice > 0
      ? computeVehicleLeaseQuoteClient(
          selectedPrice,
          downPaymentRate,
          termCycles,
          bundle.dealer,
          bundle.vehicles
        )
      : null;

  const selectedTradeInVehicle =
    eligibleTradeIns.find((v) => v.id === tradeInVehicleId) ?? null;
  const estimatedTradeInCredit = selectedTradeInVehicle
    ? Math.round(
        (computeVehicleMarketValueClient(selectedTradeInVehicle, nowMs, bundle.vehicles) *
          bundle.dealer.tradeIn.valuationRatio) /
          500
      ) * 500
    : 0;
  const tradeInNetCost = Math.max(adminFee, selectedPrice + adminFee - estimatedTradeInCredit);

  const dealerPlacement = activeDealer ? findLotPlacement(activeDealer.lotId) : null;
  const distToSelectedDealer = dealerPlacement
    ? Math.round(distance2D(playerPos.x, playerPos.z, dealerPlacement.door.x, dealerPlacement.door.z))
    : null;
  const isAtSelectedDealer =
    (character.currentZone || 'cicalengka') === 'cicalengka' &&
    distToSelectedDealer !== null &&
    distToSelectedDealer <= INTERACT_RADIUS_METERS + 6;

  const activeListings = vehicleListings.filter((l) => l.status === 'active');

  const handleTestDrive = async () => {
    if (!activeDealer || !selectedModel || busy) return;
    setBusy(true);
    try {
      await callTestDriveStart({
        action: 'start',
        dealerId: activeDealer.id,
        modelId: selectedModel.id,
        color: selectedColor || selectedModel.colors[0],
        sessionId: getTabSessionId(),
      });
      onNotify(
        `Test drive ${selectedModel.name} dimulai (${bundle.dealer.testDrive.durationSec} detik)! Gunakan WASD/Joystick.`
      );
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memulai test drive.');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyCashOrBank = async (useBank: boolean) => {
    if (!activeDealer || !selectedModel || busy) return;
    setBusy(true);
    try {
      const res = await callBuyVehicle({
        dealerId: activeDealer.id,
        modelId: selectedModel.id,
        color: selectedColor || selectedModel.colors[0],
        isUsed: activeDealer.isUsed,
        useBank,
      });
      onNotify(
        `Berhasil membeli ${selectedModel.name} (${res.vehicle?.plateNumber || 'Plat D'})!`
      );
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli kendaraan.');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyCredit = async () => {
    if (!activeDealer || !selectedModel || busy) return;
    setBusy(true);
    try {
      const res = await callBuyVehicleOnCredit({
        dealerId: activeDealer.id,
        modelId: selectedModel.id,
        color: selectedColor || selectedModel.colors[0],
        downPaymentRate,
        termCycles,
      });
      onNotify(
        `Kredit ${selectedModel.name} disetujui (${res.vehicle?.plateNumber || 'Plat D'})! Cicilan ${formatRupiah(res.lease?.installment ?? leaseQuote?.installment ?? 0)}/siklus.`
      );
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Pengajuan leasing kendaraan ditolak.');
    } finally {
      setBusy(false);
    }
  };

  const handleTradeIn = async () => {
    if (!activeDealer || !selectedModel || !selectedTradeInVehicle || busy) return;
    setBusy(true);
    try {
      const res = await callTradeInVehicle({
        tradeInVehicleId: selectedTradeInVehicle.id,
        dealerId: activeDealer.id,
        targetModelId: selectedModel.id,
        color: selectedColor || selectedModel.colors[0],
      });
      onNotify(
        `Tukar tambah sukses! Unit baru ${selectedModel.name} (${res.newVehicle?.plateNumber || 'Plat D'}) siap di halaman dealer.`
      );
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal melakukan tukar tambah.');
    } finally {
      setBusy(false);
    }
  };

  const handleBuyListing = async (listing: VehicleListingDoc) => {
    if (busy) return;
    setBusy(true);
    try {
      await callTransferVehicle(listing.id);
      onNotify(`Berhasil membeli & balik nama ${listing.vehicleName} (${listing.plateNumber})!`);
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli kendaraan P2P.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelListing = async (listing: VehicleListingDoc) => {
    if (busy) return;
    setBusy(true);
    try {
      await callListVehicleForSale({ action: 'cancel', listingId: listing.id });
      onNotify(`Listing ${listing.vehicleName} dibatalkan dan kembali ke garasi.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membatalkan listing.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Car className="h-5 w-5 text-amber-400 shrink-0" />
              <span className="truncate">Dealer, Showroom &amp; Bursa Kendaraan</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              Tunai {formatRupiah(character.money)} · Slot Garasi {vehicles.length}/{maxOwned}
              {hasBank && bankAccount ? ` · Bank ${formatRupiah(bankAccount.balance)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white shrink-0 cursor-pointer"
            aria-label="Tutup dealer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dealer Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-950/50 px-4 py-2.5 sm:px-5">
          {dealers.map((d) => {
            const active = activeTab === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveTab(d.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500 border-amber-400 text-slate-950'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {d.category === 'motor' ? (
                  <Bike className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Car className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {d.kind === 'motor_new'
                    ? 'Motor Baru'
                    : d.kind === 'motor_used'
                      ? 'Motor Bekas'
                      : d.kind === 'mobil_new'
                        ? 'Mobil Baru'
                        : 'Mobil Bekas'}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveTab('bursa_p2p')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
              isBursaTab
                ? 'bg-sky-500 border-sky-400 text-slate-950'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span>Bursa P2P ({activeListings.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isBursaTab ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                Beli unit bekas langsung dari sesama warga Cicalengka dengan escrow aman &amp; pajak balik nama{' '}
                <span className="font-mono font-bold text-amber-300">
                  {Math.round(bundle.dealer.marketplace.titleTransferTaxRate * 100)}%
                </span>
                . Untuk menjual kendaraanmu ke Bursa, buka menu Garasi Saya.
              </div>
              {activeListings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
                  Belum ada kendaraan warga yang sedang diiklankan di Bursa P2P.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeListings.map((lst) => {
                    const isMine = lst.ownerId === character.uid;
                    const transferTax = Math.round(
                      lst.price * bundle.dealer.marketplace.titleTransferTaxRate
                    );
                    const totalBuyer = lst.price + transferTax;
                    return (
                      <div
                        key={lst.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-white/30 shrink-0"
                                style={{ backgroundColor: lst.color }}
                              />
                              <h3 className="font-bold text-sm text-white truncate">
                                {lst.vehicleName}
                              </h3>
                              {lst.sellerBusinessId && (
                                <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                                  <Store className="h-2.5 w-2.5" />
                                  {businesses.find((b) => b.id === lst.sellerBusinessId)?.name ||
                                    'Dealer Pemain'}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                              {lst.plateNumber} · Penjual: {lst.ownerName} · Kondisi {Math.round(lst.condition)}% · Odo {lst.odometerKm.toFixed(1)} km
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-emerald-300 font-mono tabular-nums">
                              {formatRupiah(lst.price)}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                              +Balik nama {formatRupiah(transferTax)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                          <span className="text-xs font-semibold text-slate-300 font-mono tabular-nums">
                            Total: {formatRupiah(totalBuyer)}
                          </span>
                          {isMine ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleCancelListing(lst)}
                              className="min-h-[38px] px-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              Tarik Iklan
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || slotsFull}
                              onClick={() => void handleBuyListing(lst)}
                              className="min-h-[38px] px-3.5 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              {slotsFull ? 'Garasi Penuh' : 'Beli & Balik Nama'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeDealer ? (
            <div className="space-y-4">
              {/* Dealer banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">{activeDealer.name}</div>
                  <div className="text-xs text-slate-400">
                    {activeDealer.isUsed
                      ? 'Unit seken terawat (kondisi 78-80%), harga hemat, siap tukar tambah.'
                      : 'Unit gres pabrik 100%, garansi kondisi prima, tersedia tunai & leasing Bank Priangan.'}
                  </div>
                </div>
                {!isAtSelectedDealer && onGuideToDealer && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGuideToDealer(activeDealer.id);
                    }}
                    className="min-h-[36px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 hover:bg-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>
                      Arahkan ({distToSelectedDealer ?? '?'}m)
                    </span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Catalog List */}
                <div className="lg:col-span-7 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {dealerModels.map((m) => {
                    const price = getModelPrice(m, activeDealer.isUsed);
                    const isSelected = selectedModel?.id === m.id;
                    const kmh = Math.round(m.maxSpeedMps * 3.6);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(m.id);
                          if (!m.colors.includes(selectedColor)) {
                            setSelectedColor(m.colors[0] || '#1E293B');
                          }
                        }}
                        className={`w-full text-left rounded-2xl border p-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-amber-400/70'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {m.category === 'motor' ? (
                                <Bike className="h-4 w-4 text-amber-400 shrink-0" />
                              ) : (
                                <Car className="h-4 w-4 text-sky-400 shrink-0" />
                              )}
                              <span className="font-bold text-sm text-white truncate">
                                {m.name}
                              </span>
                              {m.isElectric && (
                                <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                              {m.brand} · Maks {kmh} km/j · {m.seats} kursi · Bagasi {m.trunkCapacity} · SIM {m.requiredSim || (m.category === 'motor' ? 'C' : 'A')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-emerald-300 font-mono tabular-nums">
                              {formatRupiah(price)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                              Pajak {formatRupiah(m.annualTax)}/th
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Purchase & Config Panel */}
                {selectedModel && (
                  <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-amber-300">
                            {selectedModel.brand}
                          </div>
                          <h3 className="text-base font-bold text-white">{selectedModel.name}</h3>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleTestDrive()}
                          className="min-h-[38px] px-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-xs font-bold text-sky-200 hover:bg-sky-500/30 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Test Drive 2m</span>
                        </button>
                      </div>

                      {/* Pratinjau 3D Interaktif */}
                      <div className="mt-3">
                        <VehiclePreview3D
                          modelId={selectedModel.id}
                          color={selectedColor}
                          heightClass="h-44 sm:h-48"
                          caption={`${selectedModel.brand} ${selectedModel.name}`}
                        />
                      </div>

                      {/* Specs strip lengkap */}
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                            <Gauge className="h-3 w-3" /> Kecepatan
                          </div>
                          <div className="mt-0.5 text-xs font-bold text-white font-mono tabular-nums">
                            {Math.round(selectedModel.maxSpeedMps * 3.6)} km/j
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                            {selectedModel.isElectric ? (
                              <Zap className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Fuel className="h-3 w-3 text-amber-400" />
                            )}{' '}
                            {selectedModel.isElectric ? 'Baterai' : 'Tangki'}
                          </div>
                          <div className="mt-0.5 text-xs font-bold text-white font-mono tabular-nums">
                            {selectedModel.tankCapacity}
                            {selectedModel.isElectric ? '%' : 'L'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                          <div className="text-[10px] text-slate-400">Kursi / Bagasi</div>
                          <div className="mt-0.5 text-xs font-bold text-white font-mono tabular-nums">
                            {selectedModel.seats} / {selectedModel.trunkCapacity}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                          <div className="text-[10px] text-slate-400">Aksel / Hdl</div>
                          <div className="mt-0.5 text-[11px] font-bold text-white font-mono tabular-nums">
                            {selectedModel.acceleration.toFixed(1)} · {Math.round(selectedModel.handling * 100)}%
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                          <div className="text-[10px] text-slate-400">Konsumsi</div>
                          <div className="mt-0.5 text-[11px] font-bold text-white font-mono tabular-nums">
                            {selectedModel.isElectric
                              ? `${selectedModel.consumptionPerKm}%/km`
                              : `${Math.round(1 / Math.max(0.005, selectedModel.consumptionPerKm))} km/L`}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                          <div className="text-[10px] text-slate-400">SIM / Pajak</div>
                          <div className="mt-0.5 text-[11px] font-bold text-white font-mono tabular-nums">
                            {selectedModel.requiredSim || 'C'} · {formatRupiah(selectedModel.annualTax)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
                        Biaya servis dasar: {formatRupiah(selectedModel.serviceCostBase)}
                      </div>
                    </div>

                    {/* Color Picker */}
                    <div>
                      <div className="text-xs font-semibold text-slate-300 mb-1.5">
                        Pilih Warna Cat
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedModel.colors.map((hex) => {
                          const picked = hex.toUpperCase() === selectedColor.toUpperCase();
                          return (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => setSelectedColor(hex)}
                              className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
                                picked
                                  ? 'border-amber-400 scale-110'
                                  : 'border-slate-600 hover:border-slate-400'
                              }`}
                              style={{ backgroundColor: hex }}
                              aria-label={`Pilih warna ${hex}`}
                            >
                              {picked && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payment Method Tabs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'cash', label: 'Tunai', icon: Wallet },
                          { id: 'bank', label: 'Bank', icon: CreditCard },
                          { id: 'credit', label: 'Kredit', icon: ShieldCheck },
                          { id: 'trade_in', label: 'Tukar', icon: ArrowLeftRight },
                        ] as const
                      ).map((pm) => {
                        const Icon = pm.icon;
                        const active = purchaseMode === pm.id;
                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setPurchaseMode(pm.id)}
                            className={`min-h-[38px] px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                              active
                                ? 'bg-amber-500 border-amber-400 text-slate-950'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{pm.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Payment Details */}
                    {(purchaseMode === 'cash' || purchaseMode === 'bank') && (
                      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-slate-300">
                            <span>Harga Unit ({activeDealer.isUsed ? 'Bekas' : 'Baru'})</span>
                            <span className="font-mono tabular-nums">{formatRupiah(selectedPrice)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Admin STNK &amp; Plat D</span>
                            <span className="font-mono tabular-nums">{formatRupiah(adminFee)}</span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-slate-800 font-bold text-white">
                            <span>Total Bayar</span>
                            <span className="font-mono tabular-nums text-emerald-300">
                              {formatRupiah(selectedPrice + adminFee)}
                            </span>
                          </div>
                        </div>
                        {purchaseMode === 'bank' && !hasBank && (
                          <p className="text-[11px] text-amber-300">
                            Buka rekening Bank Priangan terlebih dahulu untuk bayar lewat saldo bank.
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={
                            busy ||
                            slotsFull ||
                            (purchaseMode === 'bank' && !hasBank)
                          }
                          onClick={() => void handleBuyCashOrBank(purchaseMode === 'bank')}
                          className="w-full min-h-[42px] rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer disabled:opacity-50"
                        >
                          {slotsFull
                            ? `Garasi Penuh (${maxOwned}/${maxOwned})`
                            : purchaseMode === 'bank'
                              ? 'Beli via Rekening Bank'
                              : 'Beli Tunai Sekarang'}
                        </button>
                      </div>
                    )}

                    {purchaseMode === 'credit' && (
                      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                              <span>Uang Muka (DP)</span>
                              <span className="font-mono font-bold text-amber-300">
                                {Math.round(downPaymentRate * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={bundle.dealer.leasing.minDownPaymentRate}
                              max={bundle.dealer.leasing.maxDownPaymentRate}
                              step={0.05}
                              value={downPaymentRate}
                              onChange={(e) => setDownPaymentRate(Number(e.target.value))}
                              className="w-full accent-amber-400"
                            />
                          </div>

                          <div>
                            <div className="text-xs text-slate-300 mb-1">Tenor Cicilan</div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {bundle.dealer.leasing.tenors.map((t) => (
                                <button
                                  key={t.termCycles}
                                  type="button"
                                  onClick={() => setTermCycles(t.termCycles)}
                                  className={`min-h-[34px] rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                    termCycles === t.termCycles
                                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {t.termCycles} Siklus ({Math.round(t.interestRatePerTerm * 100)}%)
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {leaseQuote && (
                          <div className="space-y-1 text-xs border-t border-slate-800 pt-2">
                            <div className="flex justify-between text-slate-300">
                              <span>DP + Admin STNK</span>
                              <span className="font-mono tabular-nums font-bold text-white">
                                {formatRupiah(leaseQuote.upfrontTotal)}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                              <span>Cicilan ({leaseQuote.termCycles}x)</span>
                              <span className="font-mono tabular-nums font-bold text-amber-300">
                                {formatRupiah(leaseQuote.installment)}/siklus
                              </span>
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 font-mono">
                          Syarat: Skor kredit &ge;{bundle.dealer.leasing.minCreditScore} (kamu {creditScore}) · Shift &ge;{bundle.dealer.leasing.minCompletedShifts} (kamu {completedShifts})
                        </p>

                        <button
                          type="button"
                          disabled={busy || slotsFull}
                          onClick={() => void handleBuyCredit()}
                          className="w-full min-h-[42px] rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer disabled:opacity-50"
                        >
                          {slotsFull ? `Garasi Penuh (${maxOwned}/${maxOwned})` : 'Ajukan Kredit / Leasing'}
                        </button>
                      </div>
                    )}

                    {purchaseMode === 'trade_in' && (
                      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        {eligibleTradeIns.length === 0 ? (
                          <div className="text-xs text-slate-400">
                            Tidak ada kendaraan yang memenuhi syarat tukar tambah (harus terparkir, bebas leasing, kondisi &ge;{bundle.dealer.tradeIn.minConditionAccepted}%).
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs text-slate-300 mb-1">
                                Pilih Kendaraan Lama
                              </label>
                              <select
                                value={tradeInVehicleId}
                                onChange={(e) => setTradeInVehicleId(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                              >
                                {eligibleTradeIns.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name} ({v.plateNumber}) · Kond {Math.round(v.condition)}%
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between text-slate-300">
                                <span>Taksiran Tukar Tambah</span>
                                <span className="font-mono tabular-nums text-emerald-300">
                                  -{formatRupiah(estimatedTradeInCredit)}
                                </span>
                              </div>
                              <div className="flex justify-between font-bold text-white border-t border-slate-800 pt-1.5">
                                <span>Selisih Tambah + Admin</span>
                                <span className="font-mono tabular-nums text-amber-300">
                                  {formatRupiah(tradeInNetCost)}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={busy || !selectedTradeInVehicle}
                              onClick={() => void handleTradeIn()}
                              className="w-full min-h-[42px] rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Proses Tukar Tambah</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
