import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Handshake, Users, X, XCircle } from 'lucide-react';
import { callAcceptRoommate, callRespondOffer } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type { CharacterDoc, LeaseDoc, OfferDoc, PropertyDoc } from '../types/game';

interface OffersModalProps {
  open: boolean;
  character: CharacterDoc;
  offers: OfferDoc[];
  leases: LeaseDoc[];
  properties: PropertyDoc[];
  serverNowMs: number;
  onProceedToProperty: (prop: PropertyDoc) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const OffersModal: React.FC<OffersModalProps> = ({
  open,
  character,
  offers,
  leases,
  properties,
  serverNowMs,
  onProceedToProperty,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<'incoming' | 'outgoing' | 'invites'>('outgoing');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterInput, setCounterInput] = useState('');

  if (!open) return null;

  const incomingOffers = offers
    .filter((o) => o.ownerId === character.uid)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  const outgoingOffers = offers
    .filter((o) => o.buyerId === character.uid)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  const roommateInvites = leases.filter(
    (l) =>
      l.status === 'active' &&
      (l.pendingInviteUids?.includes(character.uid) ||
        l.pendingInvites?.some((p) => p.uid === character.uid))
  );

  const handleRespond = async (
    offerId: string,
    action: 'accept' | 'reject' | 'counter' | 'accept_counter',
    counterVal?: number
  ) => {
    setBusyId(offerId);
    try {
      await callRespondOffer(offerId, action, counterVal);
      if (action === 'accept' || action === 'accept_counter') {
        onNotify('Penawaran disetujui! Lanjutkan ke kontrak sewa atau pembelian.');
      } else if (action === 'reject') {
        onNotify('Penawaran ditolak.');
      } else {
        onNotify(`Counter-offer ${formatRupiah(counterVal || 0)} dikirim.`);
      }
      setCounterOfferId(null);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal merespons penawaran.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAcceptInvite = async (leaseId: string) => {
    setBusyId(leaseId);
    try {
      const res = await callAcceptRoommate(leaseId);
      onNotify(`Berhasil bergabung sebagai roommate (porsi sewa ${res.sharePercent}%)!`);
      onClose();
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menerima undangan roommate.');
    } finally {
      setBusyId(null);
    }
  };

  const renderStatusBadge = (offer: OfferDoc) => {
    const expired = serverNowMs > offer.expiresAtMs && (offer.status === 'pending' || offer.status === 'countered');
    const st = expired ? 'expired' : offer.status;
    const styles: Record<string, string> = {
      pending: 'bg-sky-500/20 text-sky-300',
      countered: 'bg-amber-500/20 text-amber-300',
      accepted: 'bg-emerald-500/20 text-emerald-300',
      rejected: 'bg-rose-500/20 text-rose-300',
      expired: 'bg-slate-700 text-slate-400',
      completed: 'bg-slate-700 text-emerald-300',
    };
    const labels: Record<string, string> = {
      pending: 'Menunggu',
      countered: 'Counter-Offer',
      accepted: 'Disetujui',
      rejected: 'Ditolak',
      expired: 'Kedaluwarsa',
      completed: 'Selesai',
    };
    return (
      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${styles[st] ?? 'bg-slate-800 text-slate-300'}`}>
        {labels[st] ?? st}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl border border-amber-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">Tawaran &amp; Undangan Hunian</h2>
              <p className="text-[11px] text-slate-400">
                Negosiasi sewa/beli dan undangan roommate yang masuk.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup tawaran"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-950 p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setTab('outgoing')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 ${
              tab === 'outgoing' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Keluar ({outgoingOffers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('incoming')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 ${
              tab === 'incoming' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>Masuk ({incomingOffers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('invites')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 ${
              tab === 'invites' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Roommate ({roommateInvites.length})</span>
          </button>
        </div>

        <div className="mt-3 overflow-y-auto pr-1 space-y-2.5 text-xs">
          {tab === 'outgoing' && (
            <>
              {outgoingOffers.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  Belum ada penawaran yang kamu ajukan.
                </div>
              ) : (
                outgoingOffers.map((o) => {
                  const expired = serverNowMs > o.expiresAtMs;
                  const prop = properties.find((p) => p.id === o.propertyId);
                  return (
                    <div
                      key={o.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white">{o.propertyName}</div>
                          <div className="text-[11px] text-slate-400">
                            {o.kind === 'rent' ? 'Tawaran Sewa' : 'Tawaran Beli'}:{' '}
                            <strong className="text-emerald-300">{formatRupiah(o.amount)}</strong>{' '}
                            (Harga awal {formatRupiah(o.askingPrice)})
                          </div>
                        </div>
                        {renderStatusBadge(o)}
                      </div>

                      {o.note && <p className="text-[11px] text-slate-300 italic">&ldquo;{o.note}&rdquo;</p>}

                      {o.status === 'countered' && o.counterAmount && !expired && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 p-2">
                          <span className="text-[11px] text-amber-200">
                            Counter-offer: <strong>{formatRupiah(o.counterAmount)}</strong>
                          </span>
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void handleRespond(o.id, 'accept_counter')}
                            className="rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                          >
                            Setujui
                          </button>
                        </div>
                      )}

                      {o.status === 'accepted' && !expired && prop && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onProceedToProperty(prop);
                          }}
                          className="w-full rounded-lg bg-emerald-500 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                        >
                          Lanjutkan ke {o.kind === 'rent' ? 'Kontrak Sewa' : 'Pembelian Tunai'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'incoming' && (
            <>
              {incomingOffers.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  Belum ada tawaran masuk untuk properti milikmu.
                </div>
              ) : (
                incomingOffers.map((o) => {
                  const expired = serverNowMs > o.expiresAtMs;
                  const canAct = (o.status === 'pending' || o.status === 'countered') && !expired;
                  return (
                    <div
                      key={o.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white">{o.propertyName}</div>
                          <div className="text-[11px] text-slate-400">
                            Dari: <strong className="text-white">{o.buyerName}</strong> · Tawaran:{' '}
                            <strong className="text-emerald-300">{formatRupiah(o.amount)}</strong>
                          </div>
                        </div>
                        {renderStatusBadge(o)}
                      </div>

                      {o.note && <p className="text-[11px] text-slate-300">&ldquo;{o.note}&rdquo;</p>}

                      {canAct && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void handleRespond(o.id, 'accept')}
                            className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                          >
                            <Check className="h-3.5 w-3.5" /> Terima
                          </button>
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void handleRespond(o.id, 'reject')}
                            className="flex items-center gap-1 rounded-lg bg-rose-950 border border-rose-500/40 px-3 py-1.5 font-semibold text-rose-200 hover:bg-rose-900"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Tolak
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCounterOfferId(counterOfferId === o.id ? null : o.id);
                              setCounterInput(String(Math.round(((o.amount + o.askingPrice) / 2) / 1000) * 1000));
                            }}
                            className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-200"
                          >
                            Counter
                          </button>
                        </div>
                      )}

                      {counterOfferId === o.id && (
                        <div className="flex gap-2 pt-1">
                          <input
                            type="number"
                            value={counterInput}
                            onChange={(e) => setCounterInput(e.target.value)}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-white"
                          />
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void handleRespond(o.id, 'counter', Number(counterInput))}
                            className="rounded-lg bg-amber-500 px-3 py-1 font-bold text-slate-950"
                          >
                            Kirim
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'invites' && (
            <>
              {roommateInvites.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  Tidak ada undangan roommate saat ini.
                </div>
              ) : (
                roommateInvites.map((lease) => {
                  const inv = lease.pendingInvites?.find((p) => p.uid === character.uid);
                  return (
                    <div
                      key={lease.id}
                      className="rounded-xl border border-sky-500/40 bg-slate-950 p-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-white">{lease.propertyName}</div>
                        <div className="text-[11px] text-slate-400">
                          Porsi sewa &amp; utilitas: <strong className="text-sky-300">{inv?.sharePercent ?? 50}%</strong> · Total sewa {formatRupiah(lease.rent)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === lease.id}
                        onClick={() => void handleAcceptInvite(lease.id)}
                        className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 font-bold text-slate-950 hover:bg-sky-400"
                      >
                        Gabung
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
