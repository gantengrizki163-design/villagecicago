import React, { useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Bike,
  Car,
  CreditCard,
  FileCheck2,
  Fuel,
  Home,
  Navigation,
  ShieldCheck,
  Store,
  Tag,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  callListVehicleForSale,
  callParkVehicle,
  callRetrieveVehicle,
  callSellVehicle,
  callTransferVehicle,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import {
  computeLazyStnkStatusClient,
  computeVehicleMarketValueClient,
  getDefaultVehicleConfig,
  getVehicleModelById,
} from '../firebase/vehicleConfigCache';
import {
  formatRemainingCompact,
  formatVehicleParkedLabel,
  formatVehicleStatusLabel,
  type VehicleNotificationItem,
} from '../firebase/vehicleNotifications';
import type {
  BusinessDoc,
  CharacterDoc,
  DriverLicenseDoc,
  PropertyDoc,
  VehicleDoc,
  VehicleLeaseDoc,
  VehicleListingDoc,
} from '../types/game';

interface VehicleGarageModalProps {
  open: boolean;
  character: CharacterDoc;
  vehicles: VehicleDoc[];
  vehicleLeases: VehicleLeaseDoc[];
  vehicleListings: VehicleListingDoc[];
  properties: PropertyDoc[];
  businesses?: BusinessDoc[];
  driverLicense: DriverLicenseDoc | null;
  serverNowMs: number;
  notifications?: VehicleNotificationItem[];
  onGuideToFacility: (menu: 'dealer' | 'spbu' | 'workshop' | 'samsat_sim') => void;
  onGuideToVehicle?: (vehicle: VehicleDoc) => void;
  onOpenBills?: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const TOW_SPOTS = [
  { id: 'alun_alun', label: 'Alun-Alun' },
  { id: 'stasiun', label: 'Stasiun' },
  { id: 'pasar', label: 'Pasar' },
  { id: 'bank', label: 'Bank Priangan' },
] as const;

export const VehicleGarageModal: React.FC<VehicleGarageModalProps> = ({
  open,
  character,
  vehicles,
  vehicleLeases,
  vehicleListings,
  properties,
  businesses = [],
  driverLicense,
  serverNowMs,
  notifications = [],
  onGuideToFacility,
  onGuideToVehicle,
  onOpenBills,
  onClose,
  onNotify,
}) => {
  const bundle = getDefaultVehicleConfig();
  const [tab, setTab] = useState<'garage' | 'leasing' | 'bursa'>('garage');
  const [towSpot, setTowSpot] = useState<string>('alun_alun');
  const [confirmSellId, setConfirmSellId] = useState<string | null>(null);
  const [listingDraft, setListingDraft] = useState<{
    vehicleId: string;
    price: string;
    businessId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const myDealerBusinesses = businesses.filter(
    (b) => b.ownerId === character.uid && b.status === 'active' && b.type === 'dealer'
  );

  const maxOwned = bundle.vehicles.maxOwnedVehiclesPerPlayer;
  const simCActive = Boolean(
    driverLicense?.simC?.active && driverLicense.simC.expiresAtMs > serverNowMs
  );
  const simAActive = Boolean(
    driverLicense?.simA?.active && driverLicense.simA.expiresAtMs > serverNowMs
  );
  const garageProperties = properties.filter(
    (p) => p.ownerId === character.uid && Boolean(p.hasGarage)
  );
  const activeListings = vehicleListings.filter((l) => l.status === 'active');

  const handleStoreInHomeGarage = async (vehicle: VehicleDoc) => {
    const prop = garageProperties[0];
    if (!prop || busy) return;
    setBusy(true);
    try {
      await callParkVehicle({
        vehicleId: vehicle.id,
        x: prop.position.x,
        y: 0.35,
        z: prop.position.z + 3.5,
        rotY: 0,
        parkedType: 'garage',
        garagePropertyId: prop.id,
      });
      onNotify(`${vehicle.name} diparkir aman ke garasi ${prop.name}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyimpan kendaraan ke garasi rumah.');
    } finally {
      setBusy(false);
    }
  };

  const handleRetrieveToSpot = async (vehicle: VehicleDoc) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callRetrieveVehicle(vehicle.id, towSpot);
      const spotLabel = TOW_SPOTS.find((s) => s.id === towSpot)?.label || towSpot;
      onNotify(`${vehicle.name} dipindahkan ke Parkir ${spotLabel} (${formatRupiah(res.fee)}).`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menderek/menebus kendaraan.');
    } finally {
      setBusy(false);
    }
  };

  const handleSellQuick = async (vehicle: VehicleDoc) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callSellVehicle(vehicle.id);
      setConfirmSellId(null);
      onNotify(`${vehicle.name} terjual cepat. Bersih diterima: ${formatRupiah(res.netCash)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menjual kendaraan.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateListing = async (vehicle: VehicleDoc) => {
    if (!listingDraft || busy) return;
    const askPrice = Math.round(Number(listingDraft.price) || 0);
    setBusy(true);
    try {
      await callListVehicleForSale({
        action: 'create',
        vehicleId: vehicle.id,
        price: askPrice,
        businessId: listingDraft.businessId || undefined,
      });
      setListingDraft(null);
      onNotify(`${vehicle.name} berhasil diiklankan di Bursa P2P seharga ${formatRupiah(askPrice)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memasang listing kendaraan.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await callListVehicleForSale({ action: 'cancel', listingId });
      onNotify('Iklan kendaraan dibatalkan.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membatalkan iklan.');
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
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli kendaraan P2P.');
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
              <span className="truncate">Garasi Kendaraan, SIM &amp; Leasing</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              Slot {vehicles.length}/{maxOwned} · SIM C: {simCActive ? 'Aktif' : 'Belum'} · SIM A:{' '}
              {simAActive ? 'Aktif' : 'Belum'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white shrink-0 cursor-pointer"
            aria-label="Tutup garasi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Nav Strip + Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/50 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTab('garage')}
              className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
                tab === 'garage'
                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              Garasi Saya ({vehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('leasing')}
              className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
                tab === 'leasing'
                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              Leasing ({vehicleLeases.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('bursa')}
              className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap cursor-pointer ${
                tab === 'bursa'
                  ? 'bg-sky-500 border-sky-400 text-slate-950'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              Bursa P2P ({activeListings.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                onClose();
                onGuideToFacility('dealer');
              }}
              className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-amber-300 hover:bg-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Car className="h-3 w-3" /> Dealer
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onGuideToFacility('spbu');
              }}
              className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-rose-300 hover:bg-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Fuel className="h-3 w-3" /> SPBU
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onGuideToFacility('workshop');
              }}
              className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-sky-300 hover:bg-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Wrench className="h-3 w-3" /> Bengkel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onGuideToFacility('samsat_sim');
              }}
              className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-emerald-300 hover:bg-slate-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <FileCheck2 className="h-3 w-3" /> Samsat/SIM
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {tab === 'garage' && (
            <>
              {notifications.length > 0 && (
                <div className="rounded-2xl border border-amber-500/45 bg-amber-950/25 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-200">
                    <span className="flex items-center gap-1.5">
                      <BellRing className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>Peringatan Kendaraan ({notifications.length})</span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                          notif.severity === 'critical'
                            ? 'border-rose-500/50 bg-rose-950/35 text-rose-100'
                            : 'border-amber-500/35 bg-slate-900/80 text-amber-100'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold">{notif.title}</div>
                          <div className="text-[11px] opacity-85">{notif.detail}</div>
                        </div>
                        {notif.actionTarget !== 'garage' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (notif.actionTarget === 'bills') {
                                onClose();
                                onOpenBills?.();
                              } else if (
                                notif.actionTarget === 'spbu' ||
                                notif.actionTarget === 'samsat_sim'
                              ) {
                                onClose();
                                onGuideToFacility(notif.actionTarget);
                              }
                            }}
                            className="min-h-[30px] px-2.5 rounded-lg bg-amber-400 text-[11px] font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap cursor-pointer"
                          >
                            {notif.actionLabel}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2 text-xs text-slate-300">
                <span>Tujuan derek / penebusan cepat:</span>
                <select
                  value={towSpot}
                  onChange={(e) => setTowSpot(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                >
                  {TOW_SPOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      Parkir {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {vehicles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3">
                  <p className="text-sm text-slate-400">
                    Garasi masih kosong. Kunjungi Dealer Motor atau Showroom Mobil untuk membeli kendaraan pertamamu.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGuideToFacility('dealer');
                    }}
                    className="min-h-[40px] px-4 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
                  >
                    Arahkan ke Dealer Terdekat
                  </button>
                </div>
              ) : (
                vehicles.map((v) => {
                  const model = getVehicleModelById(v.modelId, bundle.vehicles);
                  const marketVal = computeVehicleMarketValueClient(v, serverNowMs, bundle.vehicles);
                  const quickSellPayout = Math.round((marketVal * 0.68) / 500) * 500;
                  const minListPrice = Math.round(marketVal * bundle.dealer.marketplace.minPriceRatio);
                  const maxListPrice = Math.round(marketVal * bundle.dealer.marketplace.maxPriceRatio);
                  const stnk = computeLazyStnkStatusClient(v, serverNowMs, bundle.vehicles);
                  const stnkRemainMs = v.stnkExpiresAtMs - serverNowMs;
                  const fuelCap = model?.tankCapacity ?? v.fuelCapacity ?? 10;
                  const fuelPct = Math.max(0, Math.min(100, Math.round((v.fuel / Math.max(0.1, fuelCap)) * 100)));
                  const isDrafting = listingDraft?.vehicleId === v.id;
                  const isImpoundedOrStolen = v.status === 'impounded' || v.status === 'stolen';
                  const impoundFine = v.impoundFine ?? bundle.vehicles.impoundRecoveryBaseFee;

                  return (
                    <div
                      key={v.id}
                      className={`rounded-2xl border p-4 space-y-3 ${
                        isImpoundedOrStolen
                          ? 'border-rose-500/60 bg-rose-950/20'
                          : 'border-slate-800 bg-slate-950/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {v.category === 'motor' ? (
                              <Bike className="h-4 w-4 text-amber-400 shrink-0" />
                            ) : (
                              <Car className="h-4 w-4 text-sky-400 shrink-0" />
                            )}
                            <span
                              className="h-3 w-3 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: v.color }}
                            />
                            <h3 className="font-bold text-sm text-white truncate">{v.name}</h3>
                            <span className="text-xs font-mono font-bold text-amber-300">
                              {v.plateNumber}
                            </span>
                            {v.hasInsurance && (
                              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                <ShieldCheck className="h-2.5 w-2.5" />
                                Asuransi
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                            {formatVehicleStatusLabel(v.status)} · {formatVehicleParkedLabel(v.parkedType)} (
                            {Math.round(v.parkedPos.x)}, {Math.round(v.parkedPos.z)}) · Odo{' '}
                            {v.odometerKm.toFixed(1)} km
                          </p>
                          <p className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                            STNK:{' '}
                            <span className={stnk.isExpired ? 'font-bold text-rose-300' : 'text-emerald-300'}>
                              {stnk.isExpired
                                ? stnk.inGracePeriod
                                  ? 'Lewat Tanggal (Tenggang)'
                                  : `Mati (${formatRupiah(stnk.totalDue)})`
                                : `Aktif (${formatRemainingCompact(stnkRemainMs)})`}
                            </span>
                            {v.leaseId ? ' · Kredit Leasing' : ''}
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-[11px] text-slate-400">Nilai Pasar</div>
                          <div className="text-sm font-bold text-emerald-300">
                            {formatRupiah(marketVal)}
                          </div>
                        </div>
                      </div>

                      {isImpoundedOrStolen && (
                        <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">
                              {v.status === 'stolen' ? 'Kendaraan Hilang / Dicuri' : 'Kendaraan Diderek / Disita'}
                            </div>
                            <div className="text-[11px] text-rose-200">
                              {v.impoundReason || 'Parkir liar / penindakan petugas.'} · Tebus ke{' '}
                              {TOW_SPOTS.find((s) => s.id === towSpot)?.label || towSpot}:{' '}
                              <span className="font-mono font-bold">{formatRupiah(impoundFine)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Meters */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span>{v.isElectric ? 'Baterai' : 'BBM'}</span>
                            <span className="font-mono tabular-nums text-white">{fuelPct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${fuelPct <= 20 ? 'bg-rose-500' : 'bg-amber-400'}`}
                              style={{ width: `${fuelPct}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span>Kondisi Mesin</span>
                            <span className="font-mono tabular-nums text-white">
                              {Math.round(v.condition)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                v.condition <= 35 ? 'bg-rose-500' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, v.condition))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {v.status === 'parked' && onGuideToVehicle && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              onClose();
                              onGuideToVehicle(v);
                            }}
                            className="min-h-[36px] px-3 rounded-xl bg-amber-500/20 border border-amber-400/50 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>Arahkan ke Unit</span>
                          </button>
                        )}

                        {v.status === 'parked' && garageProperties.length > 0 && v.parkedType !== 'garage' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleStoreInHomeGarage(v)}
                            className="min-h-[36px] px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Home className="h-3.5 w-3.5" />
                            <span>Simpan ke Garasi Rumah</span>
                          </button>
                        )}

                        {v.status !== 'driving' && v.status !== 'listed' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRetrieveToSpot(v)}
                            className="min-h-[36px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-200 hover:bg-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>{isImpoundedOrStolen ? `Tebus (${formatRupiah(impoundFine)})` : 'Derek ke Parkir'}</span>
                          </button>
                        )}

                        {v.status === 'listed' && v.activeListingId ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleCancelListing(v.activeListingId!)}
                            className="min-h-[36px] px-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 whitespace-nowrap cursor-pointer"
                          >
                            Tarik Iklan P2P
                          </button>
                        ) : (
                          v.status === 'parked' &&
                          !v.leaseId && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setListingDraft(
                                  isDrafting ? null : { vehicleId: v.id, price: String(marketVal), businessId: '' }
                                )
                              }
                              className="min-h-[36px] px-3 rounded-xl bg-sky-500/20 border border-sky-400/50 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Tag className="h-3.5 w-3.5" />
                              <span>Iklan P2P</span>
                            </button>
                          )
                        )}

                        {v.status !== 'driving' && v.status !== 'listed' && (
                          confirmSellId === v.id ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSellQuick(v)}
                              className="min-h-[36px] px-3 rounded-xl bg-rose-500 text-xs font-bold text-white hover:bg-rose-400 whitespace-nowrap cursor-pointer"
                            >
                              Konfirmasi Jual ({formatRupiah(quickSellPayout)})
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setConfirmSellId(v.id)}
                              className="min-h-[36px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-rose-300 hover:bg-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Jual Cepat</span>
                            </button>
                          )
                        )}
                      </div>

                      {isDrafting && listingDraft && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                          <input
                            type="number"
                            value={listingDraft.price}
                            onChange={(e) =>
                              setListingDraft({
                                vehicleId: v.id,
                                price: e.target.value,
                                businessId: listingDraft.businessId,
                              })
                            }
                            className="flex-1 min-w-[130px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-white"
                            placeholder={`${minListPrice} - ${maxListPrice}`}
                          />
                          {myDealerBusinesses.length > 0 && (
                            <select
                              value={listingDraft.businessId}
                              onChange={(e) =>
                                setListingDraft({
                                  vehicleId: v.id,
                                  price: listingDraft.price,
                                  businessId: e.target.value,
                                })
                              }
                              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                            >
                              <option value="">Pribadi (Dompet)</option>
                              {myDealerBusinesses.map((b) => (
                                <option key={b.id} value={b.id}>
                                  Showroom {b.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({formatRupiah(minListPrice)} – {formatRupiah(maxListPrice)})
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleCreateListing(v)}
                            className="min-h-[34px] px-3 rounded-lg bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 whitespace-nowrap cursor-pointer"
                          >
                            Pasang ({formatRupiah(bundle.dealer.marketplace.listingFee)})
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'leasing' && (
            <div className="space-y-3">
              {vehicleLeases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
                  Kamu tidak memiliki kontrak kredit/leasing kendaraan.
                </div>
              ) : (
                vehicleLeases.map((ls) => {
                  const dueRemainMs = ls.nextDueAtMs - serverNowMs;
                  const isDue = ls.status === 'active' && (ls.missedCount > 0 || dueRemainMs <= 0);
                  return (
                    <div
                      key={ls.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-amber-400" />
                          <span className="font-bold text-sm text-white">{ls.vehicleName}</span>
                          <span
                            className={`text-xs font-semibold uppercase ${
                              ls.status === 'paid'
                                ? 'text-emerald-300'
                                : ls.status === 'repossessed'
                                  ? 'text-rose-400'
                                  : 'text-amber-300'
                            }`}
                          >
                            {ls.status === 'paid' ? 'Lunas' : ls.status === 'repossessed' ? 'Ditarik' : 'Aktif'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                          Cicilan {ls.paidCycles}/{ls.termCycles} · {formatRupiah(ls.installment)}/siklus · Tunggakan {ls.missedCount}x
                        </p>
                        {ls.status === 'active' && (
                          <p className={`mt-0.5 text-[11px] font-mono tabular-nums ${isDue ? 'font-bold text-rose-300' : 'text-slate-400'}`}>
                            {isDue
                              ? 'Jatuh tempo / menunggak — segera bayar di Tagihan!'
                              : `Jatuh tempo berikut dalam ${formatRemainingCompact(dueRemainMs)}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-[11px] text-slate-400">Sisa Kewajiban</div>
                          <div className="text-sm font-bold text-rose-300">
                            {formatRupiah(ls.remaining)}
                          </div>
                        </div>
                        {onOpenBills && ls.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenBills();
                            }}
                            className="min-h-[36px] px-3 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 whitespace-nowrap cursor-pointer"
                          >
                            Bayar Cicilan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <p className="text-xs text-slate-400">
                Tagihan cicilan leasing yang jatuh tempo otomatis muncul di menu Tagihan &amp; Profil.
              </p>
            </div>
          )}

          {tab === 'bursa' && (
            <div className="space-y-3">
              {activeListings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
                  Belum ada iklan kendaraan dari warga lain saat ini.
                </div>
              ) : (
                activeListings.map((lst) => {
                  const isMine = lst.ownerId === character.uid;
                  const tax = Math.round(lst.price * bundle.dealer.marketplace.titleTransferTaxRate);
                  return (
                    <div
                      key={lst.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-bold text-sm text-white">
                          <span>
                            {lst.vehicleName} ({lst.plateNumber})
                          </span>
                          {lst.sellerBusinessId && (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                              <Store className="h-2.5 w-2.5" />
                              {businesses.find((b) => b.id === lst.sellerBusinessId)?.name || 'Dealer Pemain'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono tabular-nums">
                          Penjual: {lst.ownerName} · Kondisi {Math.round(lst.condition)}% · Odo {lst.odometerKm.toFixed(1)} km
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-sm font-bold text-emerald-300">
                            {formatRupiah(lst.price)}
                          </div>
                          <div className="text-[11px] text-slate-400">+Balik nama {formatRupiah(tax)}</div>
                        </div>
                        {isMine ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleCancelListing(lst.id)}
                            className="min-h-[38px] px-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-semibold text-rose-200 whitespace-nowrap cursor-pointer"
                          >
                            Batalkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || vehicles.length >= maxOwned}
                            onClick={() => void handleBuyListing(lst)}
                            className="min-h-[38px] px-3.5 rounded-xl bg-sky-500 text-xs font-bold text-slate-950 hover:bg-sky-400 whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            {vehicles.length >= maxOwned ? 'Garasi Penuh' : 'Beli & Balik Nama'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
