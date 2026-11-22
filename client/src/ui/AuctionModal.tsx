import React, { useEffect, useState } from 'react';
import { Clock, Gavel, ShieldAlert, X } from 'lucide-react';
import { callCreateAuction, callPlaceBid, callSettleAuction } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type {
  AuctionDoc,
  AuctionSubjectType,
  BankAccountDoc,
  BusinessDoc,
  CharacterDoc,
  InventoryItemDoc,
  PropertyDoc,
  TaxConfigDoc,
} from '../types/game';

interface AuctionModalProps {
  open: boolean;
  character: CharacterDoc;
  bankAccount: BankAccountDoc | null;
  auctions: AuctionDoc[];
  inventory: InventoryItemDoc[];
  properties: PropertyDoc[];
  myBusinesses: BusinessDoc[];
  taxConfig: TaxConfigDoc;
  serverNowMs: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type AucTab = 'browse' | 'create';

export const AuctionModal: React.FC<AuctionModalProps> = ({
  open,
  character,
  bankAccount,
  auctions,
  inventory,
  properties,
  myBusinesses,
  taxConfig,
  serverNowMs,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<AucTab>('browse');
  const [filterType, setFilterType] = useState<AuctionSubjectType | 'all'>('all');
  const [bidSource, setBidSource] = useState<'wallet' | 'bank'>('wallet');
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Create auction state
  const [subjectType, setSubjectType] = useState<AuctionSubjectType>('item');
  const [subjectId, setSubjectId] = useState('');
  const [qty, setQty] = useState('1');
  const [startPrice, setStartPrice] = useState('20000');
  const [minIncrement, setMinIncrement] = useState('5000');
  const [durationMin, setDurationMin] = useState('15');

  const eligibleProps = properties.filter(
    (p) => p.ownerId === character.uid && !p.activeListingId && !p.activeLeaseId && !p.activeBusinessId && !p.activeAuctionId
  );
  const eligibleBiz = myBusinesses.filter((b) => b.status === 'active' && !b.activeAuctionId);
  const eligibleItems = inventory.filter((i) => i.quantity > 0);

  useEffect(() => {
    if (subjectType === 'item') {
      setSubjectId(eligibleItems[0]?.itemId || '');
    } else if (subjectType === 'property') {
      setSubjectId(eligibleProps[0]?.id || '');
    } else {
      setSubjectId(eligibleBiz[0]?.id || '');
    }
  }, [subjectType, eligibleItems.length, eligibleProps.length, eligibleBiz.length]);

  if (!open) return null;

  const visibleAuctions = auctions.filter((a) => {
    if (filterType !== 'all' && a.subjectType !== filterType) return false;
    return true;
  });

  const handlePlaceBid = async (auc: AuctionDoc, minRequired: number) => {
    const amt = Math.floor(Number(bidInputs[auc.id] || minRequired));
    setBusy(true);
    try {
      const res = await callPlaceBid(auc.id, amt, bidSource);
      onNotify(
        res.antiSnipeExtended
          ? `Bid ${formatRupiah(res.currentBid)} masuk! Anti-sniping aktif: waktu diperpanjang.`
          : `Bid ${formatRupiah(res.currentBid)} berhasil ditahan sebagai penawar tertinggi!`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memasang bid.');
    } finally {
      setBusy(false);
    }
  };

  const handleSettle = async (auc: AuctionDoc, cancel = false) => {
    setBusy(true);
    try {
      await callSettleAuction(auc.id, cancel);
      onNotify(cancel ? 'Lelang dibatalkan.' : 'Penutupan lelang & perpindahan aset selesai!');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyelesaikan lelang.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return onNotify('Pilih objek/aset yang akan dilelang.');
    setBusy(true);
    try {
      await callCreateAuction({
        subjectType,
        subjectId,
        qty: subjectType === 'item' ? Math.max(1, Number(qty) || 1) : undefined,
        startPrice: Math.floor(Number(startPrice) || 10000),
        minIncrement: Math.floor(Number(minIncrement) || 5000),
        durationMinutes: Math.max(5, Number(durationMin) || 15),
      });
      onNotify('Lelang resmi dibuka di Balai Lelang Cicalengka!');
      setTab('browse');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membuka lelang.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Balai Lelang &amp; Escrow</h2>
              <p className="text-[11px] text-slate-400">
                Dana bid ditahan aman (anti-bid palsu) · Anti-sniping +90d · Fee {(taxConfig.auctionFeeRate * 100).toFixed(0)}%
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

        {/* Tab & Source Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTab('browse')}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                tab === 'browse' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Daftar Lelang ({auctions.filter((a) => a.status === 'active').length})
            </button>
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                tab === 'create' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              + Buat Lelang
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Dana Bid:</span>
            <button
              type="button"
              onClick={() => setBidSource('wallet')}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                bidSource === 'wallet' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Dompet ({formatRupiah(character.money)})
            </button>
            {bankAccount && (
              <button
                type="button"
                onClick={() => setBidSource('bank')}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  bidSource === 'bank' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Giro ({formatRupiah(bankAccount.balance)})
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'browse' ? (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(['all', 'item', 'property', 'business'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                      filterType === t
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {t === 'all' ? 'Semua' : t === 'item' ? 'Barang' : t === 'property' ? 'Properti' : 'Bisnis'}
                  </button>
                ))}
              </div>

              {visibleAuctions.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
                  Belum ada lelang aktif. Kamu bisa melelang barang langka, properti SHM, atau bisnis milikmu di tab Buat Lelang.
                </div>
              ) : (
                visibleAuctions.map((auc) => {
                  const remainSec = Math.max(0, Math.ceil((auc.endsAtMs - serverNowMs) / 1000));
                  const expired = remainSec <= 0;
                  const minRequired =
                    auc.bidCount === 0 ? auc.startPrice : auc.currentBid + auc.minIncrement;
                  const title = String(
                    auc.subject?.name || auc.subject?.itemName || auc.subjectId
                  );
                  const isMine = auc.sellerId === character.uid;
                  const isLeading = auc.currentBidderId === character.uid;

                  return (
                    <div
                      key={auc.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                              {auc.subjectType}
                            </span>
                            <h3 className="text-xs sm:text-sm font-bold text-white">{title}</h3>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Penjual: {auc.sellerName} · Total Bid: {auc.bidCount}x
                            {auc.currentBidderName ? ` · Tertinggi: ${auc.currentBidderName}` : ''}
                          </p>
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-xs font-bold text-emerald-300">
                            {auc.bidCount > 0 ? formatRupiah(auc.currentBid) : formatRupiah(auc.startPrice)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 text-[10px] ${remainSec <= 60 && auc.status === 'active' ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                            <Clock className="h-3 w-3" />
                            {auc.status !== 'active'
                              ? auc.status.toUpperCase()
                              : expired
                                ? 'Waktu Habis'
                                : `${Math.floor(remainSec / 60)}m ${remainSec % 60}d`}
                          </div>
                        </div>
                      </div>

                      {auc.status === 'active' && (
                        <>
                          {expired ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSettle(auc, false)}
                              className="w-full rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                            >
                              Tutup &amp; Serahkan Hasil Lelang (Lazy Settle)
                            </button>
                          ) : isMine ? (
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Kamu penjual lelang ini.</span>
                              {auc.bidCount === 0 && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleSettle(auc, true)}
                                  className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-semibold text-rose-300"
                                >
                                  Batalkan (Belum Ada Bid)
                                </button>
                              )}
                            </div>
                          ) : isLeading ? (
                            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
                              Kamu memegang tawaran tertinggi saat ini ({formatRupiah(auc.currentBid)}).
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min={minRequired}
                                step={auc.minIncrement}
                                value={bidInputs[auc.id] ?? String(minRequired)}
                                onChange={(e) =>
                                  setBidInputs((prev) => ({ ...prev, [auc.id]: e.target.value }))
                                }
                                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                              />
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handlePlaceBid(auc, minRequired)}
                                className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                              >
                                Tawar Min {formatRupiah(minRequired)}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Jenis Aset</label>
                  <select
                    value={subjectType}
                    onChange={(e) => setSubjectType(e.target.value as AuctionSubjectType)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    <option value="item">Barang Inventaris</option>
                    <option value="property">Properti SHM</option>
                    <option value="business">Bisnis Aktif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Pilih Aset</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    {subjectType === 'item' &&
                      (eligibleItems.length === 0 ? (
                        <option value="">Tas kosong</option>
                      ) : (
                        eligibleItems.map((i) => (
                          <option key={i.itemId} value={i.itemId}>
                            {i.name} (x{i.quantity})
                          </option>
                        ))
                      ))}
                    {subjectType === 'property' &&
                      (eligibleProps.length === 0 ? (
                        <option value="">Tidak ada properti bebas</option>
                      ) : (
                        eligibleProps.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.areaTag})
                          </option>
                        ))
                      ))}
                    {subjectType === 'business' &&
                      (eligibleBiz.length === 0 ? (
                        <option value="">Tidak ada bisnis bebas</option>
                      ) : (
                        eligibleBiz.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} (Kas {formatRupiah(b.cash)})
                          </option>
                        ))
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {subjectType === 'item' && (
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Jumlah</label>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Harga Awal</label>
                  <input
                    type="number"
                    min={5000}
                    step={5000}
                    value={startPrice}
                    onChange={(e) => setStartPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Min Naik Bid</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={minIncrement}
                    onChange={(e) => setMinIncrement(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Durasi (menit)</label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                Aset dikunci di escrow selama lelang aktif. Tawaran di 60 detik terakhir otomatis memperpanjang durasi (+90 detik).
              </div>

              <button
                type="submit"
                disabled={busy || !subjectId}
                className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? 'Membuka Lelang...' : 'Mulai Lelang'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
