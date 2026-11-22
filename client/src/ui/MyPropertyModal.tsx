import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  DoorOpen,
  Home,
  KeyRound,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Tag,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  callCancelListing,
  callCreateListing,
  callInviteRoommate,
  callLeaveRoommate,
  callRepairProperty,
  callSetHomePreferences,
  callTerminateLease,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type {
  CharacterDoc,
  HousingConfigDoc,
  LeaseDoc,
  ListingKind,
  PropertyDoc,
  PropertyListingDoc,
  TransactionDoc,
} from '../types/game';

interface MyPropertyModalProps {
  open: boolean;
  character: CharacterDoc;
  properties: PropertyDoc[];
  listings: PropertyListingDoc[];
  leases: LeaseDoc[];
  transactions: TransactionDoc[];
  housingConfig: HousingConfigDoc;
  serverNowMs: number;
  onInspectProperty: (prop: PropertyDoc) => void;
  onOpenSearch: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const MyPropertyModal: React.FC<MyPropertyModalProps> = ({
  open,
  character,
  properties,
  listings,
  leases,
  transactions,
  housingConfig,
  serverNowMs,
  onInspectProperty,
  onOpenSearch,
  onClose,
  onNotify,
}) => {
  const [busy, setBusy] = useState(false);
  const [roommateName, setRoommateName] = useState('');
  const [roommateShare, setRoommateShare] = useState(50);
  const [listingTargetId, setListingTargetId] = useState<string | null>(null);
  const [listingKind, setListingKind] = useState<ListingKind>('rent');
  const [listingPrice, setListingPrice] = useState('');
  const [listingDeposit, setListingDeposit] = useState('');

  if (!open) return null;

  const ownedProperties = properties.filter((p) => p.ownerId === character.uid);
  const activeLease = leases.find(
    (l) =>
      l.status === 'active' &&
      (l.id === character.activeLeaseId ||
        l.tenantId === character.uid ||
        l.roommateIds.includes(character.uid))
  );
  const currentHomeProp = character.currentHomeId
    ? properties.find((p) => p.id === character.currentHomeId) ?? null
    : null;

  const landlordIncome = transactions
    .filter((t) => t.category === 'sewa_properti' || t.category === 'jual_properti')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleToggleRespawn = async () => {
    setBusy(true);
    try {
      const next = !character.respawnAtHome;
      await callSetHomePreferences(next);
      onNotify(
        next
          ? 'Titik respawn & login diatur ke rumah aktif.'
          : 'Titik respawn kembali ke Stasiun/Puskesmas.'
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memperbarui preferensi respawn.');
    } finally {
      setBusy(false);
    }
  };

  const handleInviteRoommate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLease) return;
    setBusy(true);
    try {
      const res = await callInviteRoommate(activeLease.id, roommateName.trim(), roommateShare);
      onNotify(`Undangan roommate (${res.sharePercent}% sewa) dikirim ke ${res.targetName}.`);
      setRoommateName('');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengundang roommate.');
    } finally {
      setBusy(false);
    }
  };

  const handleTerminateLease = async () => {
    if (!activeLease) return;
    setBusy(true);
    try {
      const res = await callTerminateLease(activeLease.id);
      onNotify(
        `Kontrak diakhiri. Deposit dikembalikan ${formatRupiah(res.refund)} (potongan kerusakan ${formatRupiah(res.damageDeduction)}).`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengakhiri kontrak sewa.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveRoommate = async () => {
    if (!activeLease) return;
    setBusy(true);
    try {
      await callLeaveRoommate(activeLease.id);
      onNotify('Kamu telah keluar dari kontrak roommate.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal keluar dari roommate.');
    } finally {
      setBusy(false);
    }
  };

  const handleRepair = async (prop: PropertyDoc) => {
    setBusy(true);
    try {
      const res = await callRepairProperty(prop.id);
      onNotify(`Renovasi ${prop.name} selesai (${formatRupiah(res.cost)}).`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal merenovasi properti.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishListing = async (e: React.FormEvent, prop: PropertyDoc) => {
    e.preventDefault();
    const price = Number(listingPrice);
    const deposit = listingKind === 'rent' ? Number(listingDeposit || listingPrice) : 0;
    if (!Number.isFinite(price) || price < 10_000) {
      onNotify('Harga minimal Rp 10.000.');
      return;
    }
    setBusy(true);
    try {
      await callCreateListing(prop.id, listingKind, price, deposit);
      onNotify(`Listing ${listingKind === 'rent' ? 'sewa' : 'jual'} untuk ${prop.name} dipublikasikan!`);
      setListingTargetId(null);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memasang listing.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    setBusy(true);
    try {
      await callCancelListing(listingId);
      onNotify('Listing properti ditarik dari pasar.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menarik listing.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Hunian &amp; Properti Saya</h2>
              <p className="text-[11px] text-slate-400">
                Kelola tempat tinggal, kontrak sewa, roommate, dan aset kontrakan milikmu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup properti saya"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* Status Hunian Aktif */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Alamat Tinggal Saat Ini</span>
              </div>
              <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                  character.homeless
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {character.homeless ? 'Tanpa Rumah (Emperan/Penampungan)' : 'Memiliki Hunian'}
              </span>
            </div>

            {currentHomeProp ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-800 p-2.5">
                <div>
                  <div className="font-bold text-emerald-300">{currentHomeProp.name}</div>
                  <div className="text-[11px] text-slate-400">
                    Zona {currentHomeProp.areaTag} · Kondisi {Math.round(currentHomeProp.condition)}% · Furnitur {currentHomeProp.furniture.length} item
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInspectProperty(currentHomeProp);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <DoorOpen className="h-3.5 w-3.5" />
                  <span>Detail / Masuk</span>
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/25 p-2.5 space-y-2">
                <div className="flex items-center gap-1.5 text-rose-200 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <span>Kamu belum mempunyai tempat tinggal!</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Energi, kebersihan, &amp; mood turun lebih cepat di jalanan. Cari kos murah atau kunjungi Penampungan Sosial (19:00–07:00).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSearch();
                  }}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Cari Kos / Kontrakan
                </button>
              </div>
            )}

            <label className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300 cursor-pointer">
              <span>Jadikan rumah sebagai titik respawn saat pingsan</span>
              <input
                type="checkbox"
                disabled={busy}
                checked={Boolean(character.respawnAtHome)}
                onChange={() => void handleToggleRespawn()}
              />
            </label>
          </div>

          {/* Kontrak Sewa Aktif + Roommate */}
          {activeLease && (
            <div className="rounded-xl border border-teal-500/40 bg-slate-950 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-teal-300 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4" />
                  <span>Kontrak Sewa: {activeLease.propertyName}</span>
                </div>
                <span className="rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-200">
                  {activeLease.period === 'monthly' ? 'Bulanan' : 'Mingguan'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-900 p-2">
                  <div className="text-slate-500">Biaya Sewa</div>
                  <div className="font-bold text-white">{formatRupiah(activeLease.rent)}</div>
                </div>
                <div className="rounded-lg bg-slate-900 p-2">
                  <div className="text-slate-500">Deposit</div>
                  <div className="font-bold text-emerald-300">{formatRupiah(activeLease.deposit)}</div>
                </div>
                <div className="rounded-lg bg-slate-900 p-2">
                  <div className="text-slate-500">Tagihan Berikutnya</div>
                  <div className="font-bold text-amber-300">
                    {Math.max(0, Math.ceil((activeLease.nextDueAtMs - serverNowMs) / 60000))} mnt
                  </div>
                </div>
              </div>

              {(activeLease.missedPeriods ?? 0) > 0 && (
                <div className="rounded-lg border border-rose-500/50 bg-rose-950/35 p-2 text-[11px] text-rose-200">
                  Peringatan tunggakan: {activeLease.missedPeriods} periode belum lunas! Lunasi di tab Tagihan agar tidak diusir.
                </div>
              )}

              {/* Roommates */}
              <div className="space-y-2 border-t border-slate-800 pt-2.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-sky-400" />
                  <span>Roommate &amp; Bagi Sewa ({activeLease.roommates.length})</span>
                </div>
                {activeLease.roommates.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activeLease.roommates.map((rm) => (
                      <span
                        key={rm.uid}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-200"
                      >
                        {rm.name} ({rm.sharePercent}%)
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">Belum ada roommate.</p>
                )}

                {activeLease.tenantId === character.uid ? (
                  <form onSubmit={(e) => void handleInviteRoommate(e)} className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={roommateName}
                      onChange={(e) => setRoommateName(e.target.value)}
                      placeholder="Nama teman sekamar..."
                      className="flex-1 min-w-[140px] rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                    />
                    <select
                      value={roommateShare}
                      onChange={(e) => setRoommateShare(Number(e.target.value))}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-white"
                    >
                      <option value={30}>Bagi 30%</option>
                      <option value={40}>Bagi 40%</option>
                      <option value={50}>Bagi 50%</option>
                    </select>
                    <button
                      type="submit"
                      disabled={busy || roommateName.trim().length < 3}
                      className="rounded-lg bg-sky-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      Undang
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLeaveRoommate()}
                    className="flex items-center gap-1 rounded-lg bg-rose-950/70 border border-rose-500/40 px-3 py-1.5 font-semibold text-rose-200 hover:bg-rose-900"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Keluar dari Roommate</span>
                  </button>
                )}
              </div>

              {activeLease.tenantId === character.uid && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleTerminateLease()}
                  className="w-full rounded-xl border border-rose-500/40 bg-rose-950/40 py-2 font-bold text-rose-200 hover:bg-rose-900/60"
                >
                  Akhiri Kontrak Sewa &amp; Klaim Deposit
                </button>
              )}
            </div>
          )}

          {/* Properti Milik Sendiri (Juragan Kontrakan) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                <span>Aset Properti Milikku ({ownedProperties.length})</span>
              </div>
              {landlordIncome > 0 && (
                <span className="text-[11px] font-semibold text-emerald-300">
                  Pendapatan Properti: {formatRupiah(landlordIncome)}
                </span>
              )}
            </div>

            {ownedProperties.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                Kamu belum memiliki properti hak milik (SHM). Kumpulkan tabungan dari pekerjaan untuk membeli kos, ruko, atau rumah!
              </p>
            ) : (
              ownedProperties.map((prop) => {
                const activeList = listings.find(
                  (l) => l.id === prop.activeListingId && l.status === 'active'
                );
                const missing = Math.max(0, Math.round(100 - prop.condition));
                const repCost = missing * housingConfig.valuationFormula.repairCostPerPoint;
                const isComposing = listingTargetId === prop.id;

                return (
                  <div
                    key={prop.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{prop.name}</div>
                        <div className="text-[10px] text-slate-400">
                          SHM: {prop.certificateId || prop.certificateNo || 'Terdaftar'} · Kondisi{' '}
                          {Math.round(prop.condition)}% ·{' '}
                          {prop.activeLeaseId ? 'Sedang Disewa' : activeList ? `Listing ${activeList.kind === 'rent' ? 'Sewa' : 'Jual'}` : 'Kosong'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onInspectProperty(prop);
                        }}
                        className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        Buka Detail
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {missing > 0 && (
                        <button
                          type="button"
                          disabled={busy || character.money < repCost}
                          onClick={() => void handleRepair(prop)}
                          className="flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          <Wrench className="h-3 w-3" />
                          <span>Renovasi ({formatRupiah(repCost)})</span>
                        </button>
                      )}

                      {activeList ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleCancelListing(activeList.id)}
                          className="flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30"
                        >
                          <Tag className="h-3 w-3" />
                          <span>Tarik Listing ({formatRupiah(activeList.price)})</span>
                        </button>
                      ) : !prop.activeLeaseId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setListingTargetId(isComposing ? null : prop.id);
                            setListingKind('rent');
                            setListingPrice(String(prop.baseRent));
                            setListingDeposit(String(prop.baseDeposit));
                          }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/30"
                        >
                          <PlusCircle className="h-3 w-3" />
                          <span>Pasang Listing Sewa/Jual</span>
                        </button>
                      ) : null}
                    </div>

                    {isComposing && (
                      <form
                        onSubmit={(e) => void handlePublishListing(e, prop)}
                        className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 space-y-2"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={listingKind}
                            onChange={(e) => {
                              const k = e.target.value as ListingKind;
                              setListingKind(k);
                              setListingPrice(String(k === 'rent' ? prop.baseRent : prop.baseValue));
                            }}
                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                          >
                            <option value="rent">Disewakan</option>
                            <option value="sale">Dijual Tunai</option>
                          </select>
                          <input
                            type="number"
                            value={listingPrice}
                            onChange={(e) => setListingPrice(e.target.value)}
                            placeholder="Harga"
                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                          />
                          {listingKind === 'rent' ? (
                            <input
                              type="number"
                              value={listingDeposit}
                              onChange={(e) => setListingDeposit(e.target.value)}
                              placeholder="Deposit"
                              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                            />
                          ) : (
                            <div className="flex items-center text-[10px] text-slate-500 px-1">
                              Jual Tunai
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setListingTargetId(null)}
                            className="rounded px-2.5 py-1 text-slate-400 hover:bg-slate-800"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="rounded bg-emerald-500 px-3 py-1 font-bold text-slate-950 hover:bg-emerald-400"
                          >
                            Publikasikan
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
