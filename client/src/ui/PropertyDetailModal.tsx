import React, { useState } from 'react';
import {
  BadgeCheck,
  Clock,
  DoorOpen,
  Eye,
  Handshake,
  Home,
  KeyRound,
  ShoppingBag,
  Sparkles,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import {
  callBuyProperty,
  callCreateLease,
  callEnterProperty,
  callMakeOffer,
  callRepairProperty,
  callRequestViewing,
  callSetViewingSchedule,
  callGrantGuestAccess,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type {
  CharacterDoc,
  HousingConfigDoc,
  OfferDoc,
  PropertyDoc,
  PropertyListingDoc,
} from '../types/game';
import { distance2D, INTERACT_RADIUS_METERS } from '../world3d/worldConstants';

interface PropertyDetailModalProps {
  open: boolean;
  property: PropertyDoc | null;
  listing: PropertyListingDoc | null;
  character: CharacterDoc;
  housingConfig: HousingConfigDoc;
  playerPos: { x: number; z: number };
  acceptedOffer: OfferDoc | null;
  onEnterInterior: (property: PropertyDoc, mode: 'resident' | 'preview') => void;
  onGuideToProperty?: (property: PropertyDoc, action: 'property_enter' | 'property_survey') => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  open,
  property,
  listing,
  character,
  housingConfig,
  playerPos,
  acceptedOffer,
  onEnterInterior,
  onGuideToProperty,
  onClose,
  onNotify,
}) => {
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [guestName, setGuestName] = useState('');
  const [schedOpen24, setSchedOpen24] = useState(
    property?.viewingSchedule?.open24h ?? property?.viewingSchedule?.allowAllHours ?? true
  );
  const [schedStart, setSchedStart] = useState(property?.viewingSchedule?.startHour ?? 7);
  const [schedEnd, setSchedEnd] = useState(property?.viewingSchedule?.endHour ?? 21);

  if (!open || !property) return null;

  const isOwner = property.ownerId === character.uid;
  const isCurrentHome = character.currentHomeId === property.id;
  const dist = Math.round(
    distance2D(playerPos.x, playerPos.z, property.position.x, property.position.z)
  );
  const effectiveRadius = Math.max(
    INTERACT_RADIUS_METERS,
    Math.max(property.size?.width ?? 6, property.size?.depth ?? 6) / 2 + 4.8
  );
  const isNear = dist <= effectiveRadius;

  const activeListing = listing && listing.status === 'active' ? listing : null;
  const starter = housingConfig.livingAndSleep.starterOption;
  const starterUsed = Boolean(character.starterHousingClaimed || character.starterHousingUsed);
  const canUseStarter = property.id === starter.propertyId && !starterUsed && !character.activeLeaseId && !isOwner;

  const ls = housingConfig.leaseSettings;
  const baseRent = acceptedOffer?.kind === 'rent' ? acceptedOffer.amount : activeListing?.kind === 'rent' ? activeListing.price : property.baseRent;
  const periodRent =
    period === 'monthly'
      ? Math.round((baseRent * 4 * ls.monthlyRentDiscount) / 500) * 500
      : baseRent;
  const deposit = activeListing?.kind === 'rent' ? activeListing.deposit : property.baseDeposit;
  const totalLeaseUpfront = periodRent + deposit;

  const salePrice = acceptedOffer?.kind === 'sale' ? acceptedOffer.amount : activeListing?.kind === 'sale' ? activeListing.price : property.baseValue;
  const transferTax = Math.round(salePrice * ls.saleTransferTaxRate);
  const totalSaleCost = salePrice + transferTax;

  const missingCond = Math.max(0, Math.round(100 - property.condition));
  const repairCost = missingCond * housingConfig.valuationFormula.repairCostPerPoint;

  const vf = housingConfig.valuationFormula;
  const estVal =
    property.estimatedValue ??
    Math.round(
      (property.baseValue *
        ((vf.areaMultipliers as Record<string, number>)[property.areaTag] ?? 1) *
        (vf.conditionMinFactor + (property.condition / 100) * vf.conditionWeight)) /
        1000
    ) * 1000;

  const handleSurvey = async () => {
    setBusy(true);
    try {
      const res = await callRequestViewing(property.id);
      onClose();
      onEnterInterior(res.property, res.viewingOnly ? 'preview' : 'resident');
      onNotify(`Mode Survei dibuka: memeriksa interior ${property.name} (kondisi ${Math.round(res.property.condition)}%).`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memulai survei lokasi.');
    } finally {
      setBusy(false);
    }
  };

  const handleEnter = async () => {
    setBusy(true);
    try {
      const res = await callEnterProperty(property.id);
      onClose();
      onEnterInterior(res.property, 'resident');
      onNotify(`Masuk ke ${property.name} (akses: ${res.role}).`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Pintu terkunci.');
    } finally {
      setBusy(false);
    }
  };

  const handleLease = async (useStarter = false) => {
    setBusy(true);
    try {
      const res = await callCreateLease(
        property.id,
        useStarter ? 'weekly' : period,
        !useStarter && acceptedOffer?.kind === 'rent' ? acceptedOffer.id : undefined,
        useStarter
      );
      onNotify(
        useStarter
          ? `Selamat! Bantuan Kos Murah aktif di ${property.name} (${formatRupiah(res.totalUpfront)}).`
          : `Kontrak sewa ${property.name} aktif! Total dibayar: ${formatRupiah(res.totalUpfront)}.`
      );
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyewa properti.');
    } finally {
      setBusy(false);
    }
  };

  const handleBuy = async () => {
    setBusy(true);
    try {
      const res = await callBuyProperty(
        property.id,
        acceptedOffer?.kind === 'sale' ? acceptedOffer.id : undefined
      );
      onNotify(`Selamat! Kamu sah memiliki ${property.name} (Sertifikat ${res.certificateId}).`);
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli properti.');
    } finally {
      setBusy(false);
    }
  };

  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListing) return;
    const amt = Number(offerAmount);
    if (!Number.isFinite(amt) || amt < 10_000) {
      onNotify('Masukkan nominal tawaran minimal Rp 10.000.');
      return;
    }
    setBusy(true);
    try {
      const res = await callMakeOffer(activeListing.id, amt, offerNote);
      onNotify(
        res.note ||
          (res.status === 'accepted'
            ? 'Tawaran diterima!'
            : res.status === 'countered'
              ? `Counter-offer: ${formatRupiah(res.counterAmount || 0)}`
              : 'Tawaran dikirim ke pemilik properti.')
      );
      setOfferOpen(false);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengajukan tawaran.');
    } finally {
      setBusy(false);
    }
  };

  const handleGrantGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    setBusy(true);
    try {
      const res = await callGrantGuestAccess(property.id, guestName.trim(), 4);
      onNotify(`Izin tamu 4 jam diberikan kepada ${res.guestName}.`);
      setGuestName('');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengundang tamu.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSchedule = async () => {
    setBusy(true);
    try {
      await callSetViewingSchedule(property.id, schedOpen24, schedStart, schedEnd);
      onNotify('Jadwal survei properti diperbarui.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyimpan jadwal survei.');
    } finally {
      setBusy(false);
    }
  };

  const handleRepair = async () => {
    setBusy(true);
    try {
      const res = await callRepairProperty(property.id);
      onNotify(`Renovasi selesai! Kondisi ${property.name} kini 100% (biaya ${formatRupiah(res.cost)}).`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal merenovasi properti.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                {property.type} · {property.areaTag}
              </span>
              {isOwner && (
                <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                  MILIKMU
                </span>
              )}
              {isCurrentHome && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  TEMPAT TINGGALMU
                </span>
              )}
            </div>
            <h2 className="mt-1 text-base font-bold text-white">{property.name}</h2>
            <p className="text-[11px] text-slate-400">
              Pemilik: {property.ownerName} · Jarak darimu: <strong className={isNear ? 'text-emerald-300' : 'text-amber-300'}>{dist}m</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup detail properti"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-3 overflow-y-auto pr-1 space-y-3 text-xs">
          {/* Spesifikasi & Nilai */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div>
              <div className="text-[10px] text-slate-500">Kamar &amp; Ukuran Interior</div>
              <div className="font-bold text-white">
                {property.rooms} Kamar ({property.layout?.gridCols ?? 6}x{property.layout?.gridRows ?? 6} grid)
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Estimasi Nilai Pasar</div>
              <div className="font-bold text-emerald-300">{formatRupiah(estVal)}</div>
            </div>
            <div className="col-span-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Kondisi Bangunan</span>
                <span className="font-bold text-white">{Math.round(property.condition)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.round(property.condition))}%` }}
                  className={`h-full ${property.condition >= 75 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                />
              </div>
            </div>
            <div className="col-span-2 flex flex-wrap gap-1.5 pt-1">
              <span className={`rounded px-2 py-0.5 text-[10px] ${property.facilities.electricity ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                {property.facilities.electricity ? 'Listrik PLN' : 'Tanpa Listrik'}
              </span>
              <span className={`rounded px-2 py-0.5 text-[10px] ${property.facilities.water ? 'bg-sky-500/15 text-sky-300' : 'bg-slate-800 text-slate-500'}`}>
                {property.facilities.water ? 'Air PDAM' : 'Tanpa PDAM'}
              </span>
              <span className={`rounded px-2 py-0.5 text-[10px] ${property.facilities.internet ? 'bg-violet-500/15 text-violet-300' : 'bg-slate-800 text-slate-500'}`}>
                {property.facilities.internet ? 'Wi-Fi' : 'Non-WiFi'}
              </span>
              <span className={`rounded px-2 py-0.5 text-[10px] ${property.facilities.ac ? 'bg-cyan-500/15 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>
                {property.facilities.ac ? 'Ber-AC' : 'Non-AC'}
              </span>
            </div>
          </div>

          {!isNear && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
              Mendekatlah ke bangunan 3D <strong>{property.name}</strong> (koordinat x:{property.position.x}, z:{property.position.z}) untuk membuka pintu atau survei interior.
            </div>
          )}

          {/* Tombol Masuk & Survei */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || (!isNear && !onGuideToProperty)}
              onClick={() => {
                if (!isNear && onGuideToProperty) {
                  onClose();
                  onGuideToProperty(property, 'property_enter');
                } else {
                  void handleEnter();
                }
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 font-bold ${
                !isNear && onGuideToProperty
                  ? 'border border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500'
              }`}
            >
              <DoorOpen className="h-4 w-4" />
              <span>{!isNear && onGuideToProperty ? 'Arahkan untuk Masuk' : 'Masuk Rumah (Kunci)'}</span>
            </button>
            <button
              type="button"
              disabled={busy || (!isNear && !onGuideToProperty)}
              onClick={() => {
                if (!isNear && onGuideToProperty) {
                  onClose();
                  onGuideToProperty(property, 'property_survey');
                } else {
                  void handleSurvey();
                }
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/50 bg-sky-500/15 py-2.5 px-3 font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              <span>{!isNear && onGuideToProperty ? 'Arahkan untuk Survei' : 'Survei Interior (Preview)'}</span>
            </button>
          </div>

          {/* Bantuan Awal Kos Murah */}
          {canUseStarter && (
            <div className="rounded-xl border border-emerald-500/60 bg-emerald-950/35 p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <Sparkles className="h-4 w-4" />
                <span>{starter.label}</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Program subsidi warga baru: sewa minggu pertama cukup <strong>{formatRupiah(starter.firstCycleRent)}</strong> tanpa uang deposit!
              </p>
              <button
                type="button"
                disabled={busy || character.money < starter.firstCycleRent}
                onClick={() => void handleLease(true)}
                className="w-full rounded-xl bg-emerald-500 py-2 font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500"
              >
                Ambil Bantuan Kos Murah ({formatRupiah(starter.firstCycleRent)})
              </button>
            </div>
          )}

          {/* Transaksi Sewa / Beli jika ada listing aktif atau tawaran disetujui */}
          {!isOwner && !property.activeLeaseId && (activeListing || acceptedOffer) && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2.5">
              {acceptedOffer && (
                <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/40 p-2 text-[11px] text-emerald-200 flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    Tawaran disetujui di harga <strong>{formatRupiah(acceptedOffer.amount)}</strong>! Gunakan untuk transaksi di bawah.
                  </span>
                </div>
              )}

              {(activeListing?.kind === 'rent' || acceptedOffer?.kind === 'rent') && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-300">Sewa Hunian</span>
                    <div className="flex rounded-lg bg-slate-900 p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPeriod('weekly')}
                        className={`rounded px-2 py-1 font-semibold ${period === 'weekly' ? 'bg-teal-500 text-slate-950' : 'text-slate-400'}`}
                      >
                        Mingguan
                      </button>
                      <button
                        type="button"
                        onClick={() => setPeriod('monthly')}
                        className={`rounded px-2 py-1 font-semibold ${period === 'monthly' ? 'bg-teal-500 text-slate-950' : 'text-slate-400'}`}
                      >
                        Bulanan (-10%)
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Sewa {period === 'monthly' ? '1 Bulan (4 minggu)' : '1 Minggu'}</span>
                      <span className="font-semibold">{formatRupiah(periodRent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uang Deposit (dikembalikan saat keluar)</span>
                      <span className="font-semibold">{formatRupiah(deposit)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 text-emerald-300 font-bold">
                      <span>Total Awal</span>
                      <span>{formatRupiah(totalLeaseUpfront)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || Boolean(character.activeLeaseId) || character.money < totalLeaseUpfront}
                    onClick={() => void handleLease(false)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-500 py-2 font-bold text-slate-950 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>
                      {character.activeLeaseId
                        ? 'Akhiri kontrak lama dulu'
                        : `Sewa Sekarang (${formatRupiah(totalLeaseUpfront)})`}
                    </span>
                  </button>
                </>
              )}

              {(activeListing?.kind === 'sale' || acceptedOffer?.kind === 'sale') && (
                <>
                  <div className="font-bold text-amber-300">Beli Tunai (Hak Milik SHM)</div>
                  <div className="text-[11px] text-slate-300 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Harga Properti</span>
                      <span className="font-semibold">{formatRupiah(salePrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bea Balik Nama (2,5%)</span>
                      <span className="font-semibold">{formatRupiah(transferTax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 text-amber-300 font-bold">
                      <span>Total Tunai</span>
                      <span>{formatRupiah(totalSaleCost)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || character.money < totalSaleCost}
                    onClick={() => void handleBuy()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Beli Tunai ({formatRupiah(totalSaleCost)})</span>
                  </button>
                </>
              )}

              {/* Tombol Ajukan Penawaran */}
              {activeListing && !acceptedOffer && (
                <div className="pt-1 border-t border-slate-800">
                  {!offerOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOfferAmount(String(Math.round((activeListing.price * 0.92) / 1000) * 1000));
                        setOfferOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-2 text-slate-200 font-semibold hover:bg-slate-800"
                    >
                      <Handshake className="h-4 w-4 text-amber-300" />
                      <span>Tawar Harga ({activeListing.ownerType === 'npc' ? 'Respons Agen Otomatis' : 'Ke Pemilik'})</span>
                    </button>
                  ) : (
                    <form onSubmit={(e) => void handleMakeOffer(e)} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={offerAmount}
                          onChange={(e) => setOfferAmount(e.target.value)}
                          placeholder="Nominal tawaran"
                          className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                        />
                        <input
                          type="text"
                          value={offerNote}
                          onChange={(e) => setOfferNote(e.target.value)}
                          placeholder="Catatan singkat (opsional)"
                          className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOfferOpen(false)}
                          className="w-1/3 rounded-lg border border-slate-700 py-1.5 text-slate-300"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className="w-2/3 rounded-lg bg-amber-500 py-1.5 font-bold text-slate-950 hover:bg-amber-400"
                        >
                          Kirim Tawaran
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Kontrol Penghuni: Undang Tamu & Renovasi */}
          {(isOwner || isCurrentHome) && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2.5">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-emerald-400" /> Akses Tamu &amp; Perawatan
              </div>

              <form onSubmit={(e) => void handleGrantGuest(e)} className="flex gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Nama pemain tamu (4 jam)..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={busy || guestName.trim().length < 3}
                  className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Undang</span>
                </button>
              </form>

              {missingCond > 0 && (
                <button
                  type="button"
                  disabled={busy || character.money < repairCost}
                  onClick={() => void handleRepair()}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 py-1.5 font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Renovasi ke 100% ({formatRupiah(repairCost)})</span>
                </button>
              )}
            </div>
          )}

          {/* Kontrol Jam Survei Pemilik */}
          {isOwner && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-sky-400" /> Jadwal Survei Pengunjung
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={schedOpen24}
                  onChange={(e) => setSchedOpen24(e.target.checked)}
                />
                <span>Buka survei 24 jam</span>
              </label>
              {!schedOpen24 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span>Jam:</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={schedStart}
                    onChange={(e) => setSchedStart(Number(e.target.value))}
                    className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  />
                  <span>s/d</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={schedEnd}
                    onChange={(e) => setSchedEnd(Number(e.target.value))}
                    className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  />
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSaveSchedule()}
                className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
              >
                Simpan Jadwal Survei
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
