import React, { useState } from 'react';
import { Car, DoorOpen, ShoppingBag, ShoppingCart, Store, Utensils, Wrench, X } from 'lucide-react';
import { callBuyFromBusiness } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type {
  BusinessDoc,
  BusinessStockDoc,
  CharacterDoc,
  ProductsConfigDoc,
} from '../types/game';
import { ActionTileIcon, FoodIcon } from './GameIcons';

interface BusinessShopModalProps {
  open: boolean;
  business: BusinessDoc | null;
  stock: BusinessStockDoc[];
  character: CharacterDoc;
  productsConfig: ProductsConfigDoc;
  inside3D: boolean;
  onEnter3D: (biz: BusinessDoc) => void;
  onOpenManage: (biz: BusinessDoc) => void;
  onOpenWorkshop?: (businessId: string) => void;
  onOpenDealerBursa?: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const BusinessShopModal: React.FC<BusinessShopModalProps> = ({
  open,
  business,
  stock,
  character,
  productsConfig,
  inside3D,
  onEnter3D,
  onOpenManage,
  onOpenWorkshop,
  onOpenDealerBursa,
  onClose,
  onNotify,
}) => {
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  if (!open || !business) return null;

  const isOwner = business.ownerId === character.uid;
  const sellable = stock.filter((s) => s.qty > 0);

  const handleBuy = async (item: BusinessStockDoc, consumeNow: boolean) => {
    const qty = Math.max(1, Math.min(item.qty, qtyMap[item.itemId] ?? 1));
    setBusy(true);
    try {
      await callBuyFromBusiness(business.id, item.itemId, qty, consumeNow);
      onNotify(
        consumeNow
          ? `Membeli & langsung menikmati ${qty}x ${item.name}!`
          : `Membeli ${qty}x ${item.name} masuk ke tas/inventaris.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal berbelanja di toko ini.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">{business.name}</h2>
              <p className="text-[11px] text-slate-400">
                Pemilik: {business.ownerName || 'Warga'} ·{' '}
                <span className={business.isOpen ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {business.isOpen ? 'BUKA' : 'TUTUP'}
                </span>{' '}
                · Dompet: <span className="font-mono text-emerald-300">{formatRupiah(character.money)}</span>
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs">
          <span className="text-slate-300">Etalase &amp; Kasir Pelanggan</span>
          <div className="flex gap-2">
            {!inside3D && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEnter3D(business);
                }}
                className="flex items-center gap-1 rounded-lg border border-sky-500/50 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Masuk Interior 3D
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenManage(business);
                }}
                className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
              >
                Panel Pemilik
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {business.isOpen && business.type === 'bengkel' && onOpenWorkshop && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/40 bg-sky-950/40 p-3 text-xs">
              <div>
                <div className="font-bold text-sky-200 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4" />
                  Layanan Bengkel Kendaraan Aktif
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Servis mesin, ganti oli, cat ulang bodi, &amp; pasang aksesori (omzet masuk ke bengkel ini).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWorkshop(business.id);
                }}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400"
              >
                Servis Kendaraan di Sini
              </button>
            </div>
          )}

          {business.isOpen && business.type === 'dealer' && onOpenDealerBursa && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-950/35 p-3 text-xs">
              <div>
                <div className="font-bold text-amber-200 flex items-center gap-1.5">
                  <Car className="h-4 w-4" />
                  Showroom &amp; Bursa Kendaraan Warga
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Lihat unit motor &amp; mobil pajangan showroom ini di Bursa P2P.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDealerBursa();
                }}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
              >
                Lihat Bursa Kendaraan
              </button>
            </div>
          )}

          {!business.isOpen ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-center text-xs text-rose-200">
              Toko ini sedang TUTUP. Kembali lagi saat jam operasional berlangsung.
            </div>
          ) : sellable.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
              Etalase barang masih kosong. Pemilik belum mengisi produk rak toko.
            </div>
          ) : (
            sellable.map((item) => {
              const meta = productsConfig.products.find((p) => p.id === item.itemId);
              const isEdible = Boolean(meta?.hungerRestore || meta?.thirstRestore);
              const qty = Math.max(1, Math.min(item.qty, qtyMap[item.itemId] ?? 1));
              return (
                <div
                  key={item.itemId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    {isEdible ||
                    item.itemId.includes('kopi') ||
                    item.itemId.includes('teh') ||
                    item.itemId.includes('nasi') ||
                    item.itemId.includes('mie') ? (
                      <FoodIcon itemId={item.itemId} className="h-10 w-10 shrink-0" />
                    ) : (
                      <ActionTileIcon kind="buy" className="h-10 w-10 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">{item.name}</div>
                      <div className="font-mono text-[11px] text-emerald-300">
                        {formatRupiah(item.sellPrice)} · Tersedia {item.qty}
                      </div>
                      {isEdible && (
                        <div className="text-[10px] text-amber-300">
                          Lapar +{meta?.hungerRestore || 0} · Haus +{meta?.thirstRestore || 0}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={item.qty}
                      value={qty}
                      onChange={(e) =>
                        setQtyMap((prev) => ({
                          ...prev,
                          [item.itemId]: Math.max(1, Math.min(item.qty, Number(e.target.value) || 1)),
                        }))
                      }
                      className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-xs text-white"
                    />
                    {isEdible && (
                      <button
                        type="button"
                        disabled={busy || isOwner}
                        onClick={() => void handleBuy(item, true)}
                        className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                      >
                        <Utensils className="h-3 w-3" />
                        Makan
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || isOwner}
                      onClick={() => void handleBuy(item, false)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Beli ({formatRupiah(item.sellPrice * qty)})
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {isOwner && (
            <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1 pt-1">
              <ShoppingBag className="h-3 w-3" />
              Pemilik tidak dapat membeli dari tokonya sendiri (anti-arbitrase).
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
