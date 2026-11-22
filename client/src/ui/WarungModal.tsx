import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Utensils, X } from 'lucide-react';
import { callBuyFood } from '../firebase/api';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { formatRupiah } from '../firebase/gameTime';
import { localSimulation, PREVIEW_SHOP_MENU } from '../firebase/localSimulation';
import type { ShopMenuItem } from '../types/game';
import { FoodIcon } from './GameIcons';

interface WarungModalProps {
  open: boolean;
  money: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const WarungModal: React.FC<WarungModalProps> = ({
  open,
  money,
  onClose,
  onNotify,
}) => {
  const [items, setItems] = useState<ShopMenuItem[]>(PREVIEW_SHOP_MENU);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (localSimulation.isActive()) {
      setItems(PREVIEW_SHOP_MENU);
      return;
    }

    const path = 'shop_menu';
    const q = query(collection(db, path), where('available', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ShopMenuItem);
        if (list.length > 0) {
          list.sort((a, b) => a.price - b.price);
          setItems(list);
        } else {
          setItems(PREVIEW_SHOP_MENU);
        }
      },
      (err) => {
        setItems(PREVIEW_SHOP_MENU);
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          onNotify((wrapped as Error).message.slice(0, 140));
        }
      }
    );
    return () => unsub();
  }, [open, onNotify]);

  if (!open) return null;

  const handleBuy = async (item: ShopMenuItem) => {
    if (buyingId) return;
    setBuyingId(item.id);
    try {
      const res = await callBuyFood(item.id);
      onNotify(`Nuhun! ${res.itemName} dinikmati. Mood +8! Saldo: ${formatRupiah(res.money)}`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli makanan.');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-2xl border border-amber-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">Warung Teh Neng</h2>
              <p className="text-[11px] text-slate-400">
                Saldo Anda: <span className="text-emerald-300 font-semibold">{formatRupiah(money)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup menu warung"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
          {items.map((item) => {
            const affordable = money >= item.price;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FoodIcon itemId={item.id} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{item.name}</div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{item.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                    {item.hungerRestore > 0 && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                        +{item.hungerRestore} Lapar
                      </span>
                    )}
                    {item.thirstRestore > 0 && (
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                        +{item.thirstRestore} Haus
                      </span>
                    )}
                    {item.energyRestore > 0 && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                        +{item.energyRestore} Energi
                      </span>
                    )}
                    <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-300">
                      +8 Mood
                    </span>
                  </div>
                </div>
                </div>
                <button
                  type="button"
                  disabled={!affordable || buyingId !== null}
                  onClick={() => void handleBuy(item)}
                  className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {buyingId === item.id ? '...' : formatRupiah(item.price)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
