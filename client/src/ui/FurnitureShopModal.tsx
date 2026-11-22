import React, { useState } from 'react';
import { Armchair, PackageOpen, ShoppingBag, Utensils, X } from 'lucide-react';
import { callBuyFurniture, callEatFromInventory } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import type { CharacterDoc, InventoryItemDoc } from '../types/game';
import { distance2D, FURNITURE_CATALOG, TOKO_MEBEL_POS } from '../world3d/worldConstants';

interface FurnitureShopModalProps {
  open: boolean;
  initialTab?: 'shop' | 'inventory';
  character: CharacterDoc;
  inventory: InventoryItemDoc[];
  playerPos: { x: number; z: number };
  insidePropertyId: string | null;
  onOpenFurnitureSets?: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const FurnitureShopModal: React.FC<FurnitureShopModalProps> = ({
  open,
  initialTab = 'shop',
  character,
  inventory,
  playerPos,
  insidePropertyId,
  onOpenFurnitureSets,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<'shop' | 'inventory'>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const nearShop =
    (character.currentZone || 'cicalengka') === 'cicalengka' &&
    distance2D(playerPos.x, playerPos.z, TOKO_MEBEL_POS.x, TOKO_MEBEL_POS.z) <= 13;

  const furnitureItems = inventory.filter((i) => i.category === 'furniture' && i.quantity > 0);
  const foodItems = inventory.filter((i) => i.category === 'food' && i.quantity > 0);

  const handleBuyFurniture = async (furnitureId: string, name: string, price: number) => {
    setBusyId(furnitureId);
    try {
      await callBuyFurniture(furnitureId, 1);
      onNotify(`Berhasil membeli ${name} (${formatRupiah(price)})! Simpan di rumah lewat Mode Dekorasi.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli furnitur.');
    } finally {
      setBusyId(null);
    }
  };

  const handleEat = async (item: InventoryItemDoc) => {
    setBusyId(item.itemId);
    try {
      await callEatFromInventory(item.itemId, insidePropertyId || undefined);
      onNotify(`Nikmat! ${item.name} dimakan dari penyimpanan rumah.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal makan dari inventori.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl max-h-[88dvh] flex flex-col rounded-2xl border border-amber-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Armchair className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">Toko Mebel &amp; Gudang Barang</h2>
              <p className="text-[11px] text-slate-400">
                Saldo: <strong className="text-emerald-300">{formatRupiah(character.money)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup toko mebel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('shop')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 ${
              tab === 'shop' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Katalog Toko Mebel</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('inventory')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 ${
              tab === 'inventory' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            <PackageOpen className="h-3.5 w-3.5" />
            <span>Gudang &amp; Bekal ({inventory.length})</span>
          </button>
        </div>

        <div className="mt-3 overflow-y-auto pr-1 space-y-2.5 text-xs">
          {tab === 'shop' && (
            <>
              {!nearShop && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
                  Kunjungi bangunan <strong>Toko Mebel Cicalengka</strong> (Jalan Raya sisi utara Alun-Alun, x:{TOKO_MEBEL_POS.x}, z:{TOKO_MEBEL_POS.z}) untuk membeli furnitur.
                </div>
              )}
              {onOpenFurnitureSets && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFurnitureSets();
                  }}
                  className="w-full min-h-[42px] rounded-xl border border-teal-500/40 bg-teal-500/15 px-3 py-2 text-xs font-bold text-teal-200 hover:bg-teal-500/25 flex items-center justify-between"
                >
                  <span>Paket Mebel Hemat (Bundel Rumah Lengkap)</span>
                  <span className="text-[11px] text-amber-300">Buka →</span>
                </button>
              )}
              {FURNITURE_CATALOG.map((item) => {
                const affordable = character.money >= item.price;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white">
                        {item.name}{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          ({item.size.w}x{item.size.d} ubin)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{item.description}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                        {item.recoveryBonus > 0 && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                            +{Math.round(item.recoveryBonus * 100)}% Tidur
                          </span>
                        )}
                        <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-300">
                          +{item.moodBonus} Mood
                        </span>
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                          +{formatRupiah(item.valueBonus)} Nilai Rumah
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!nearShop || !affordable || busyId !== null}
                      onClick={() => void handleBuyFurniture(item.id, item.name, item.price)}
                      className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      {busyId === item.id ? '...' : formatRupiah(item.price)}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {tab === 'inventory' && (
            <div className="space-y-3">
              <div>
                <div className="font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5" /> Bekal Makanan &amp; Minuman
                </div>
                {foodItems.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Stok bekal kosong. Belanja di Warung Teh Neng untuk mengisi stok makanan rumah.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {foodItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {item.name} <span className="text-emerald-300">x{item.quantity}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Bonus kulkas/kompor otomatis aktif bila dimakan di rumah.
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void handleEat(item)}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                        >
                          Makan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-2.5">
                <div className="font-bold text-sky-300 mb-1.5 flex items-center gap-1.5">
                  <Armchair className="h-3.5 w-3.5" /> Gudang Furnitur
                </div>
                {furnitureItems.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Belum ada furnitur di gudang (atau semua sudah terpasang di rumah).
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {furnitureItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between"
                      >
                        <span className="font-semibold text-white">{item.name}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-bold text-amber-300">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
