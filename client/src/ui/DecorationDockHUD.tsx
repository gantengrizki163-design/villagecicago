import React from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  PackageOpen,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import type { FurniturePlacement, InventoryItemDoc } from '../types/game';
import { FURNITURE_CATALOG } from '../world3d/worldConstants';
import { useViewportMode } from './useViewportMode';

interface DecorationDockHUDProps {
  propertyName: string;
  draftFurniture: FurniturePlacement[];
  inventory: InventoryItemDoc[];
  selectedInstanceId: string | null;
  pendingFurnitureId: string | null;
  pendingRotation: 0 | 90 | 180 | 270;
  saving: boolean;
  onSelectPendingFurniture: (furnitureId: string | null) => void;
  onRotate: () => void;
  onNudgeSelected: (dx: number, dz: number) => void;
  onRemoveSelected: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export const DecorationDockHUD: React.FC<DecorationDockHUDProps> = ({
  propertyName,
  draftFurniture,
  inventory,
  selectedInstanceId,
  pendingFurnitureId,
  pendingRotation,
  saving,
  onSelectPendingFurniture,
  onRotate,
  onNudgeSelected,
  onRemoveSelected,
  onCancel,
  onSave,
}) => {
  const { isMobileLandscape } = useViewportMode();
  const placedCounts = new Map<string, number>();
  for (const item of draftFurniture) {
    placedCounts.set(item.furnitureId, (placedCounts.get(item.furnitureId) ?? 0) + 1);
  }

  const furnitureInventory = inventory.filter((i) => i.category === 'furniture');
  const selectedItem = draftFurniture.find((f) => f.instanceId === selectedInstanceId) ?? null;
  const selectedMeta = selectedItem
    ? FURNITURE_CATALOG.find((c) => c.id === selectedItem.furnitureId)
    : pendingFurnitureId
      ? FURNITURE_CATALOG.find((c) => c.id === pendingFurnitureId)
      : null;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center px-2 ${
        isMobileLandscape ? 'bottom-1.5 gap-1' : 'bottom-2 gap-2'
      }`}
    >
      {/* Banner Info Mode Dekorasi */}
      <div
        className={`pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-900/95 text-xs text-slate-100 shadow-2xl max-w-[96vw] ${
          isMobileLandscape
            ? 'px-2.5 py-1.5 w-auto'
            : 'px-3 py-2 w-full sm:w-auto sm:min-w-[460px]'
        }`}
      >
        <div className="min-w-0">
          <span className="font-bold text-amber-300">Dekorasi:</span>{' '}
          <span className="font-semibold truncate">{propertyName}</span>
          {!isMobileLandscape && (
            <p className="text-[11px] text-slate-400">
              Ketuk ubin lantai untuk menaruh/geser. Geser layar untuk putar kamera.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className={`flex items-center gap-1 rounded-xl border border-slate-600 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 disabled:opacity-50 ${
              isMobileLandscape ? 'px-2.5 py-1' : 'px-3 py-1.5'
            }`}
          >
            <X className="h-3.5 w-3.5" />
            <span>Batal</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className={`flex items-center gap-1 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 ${
              isMobileLandscape ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{saving ? 'Menyimpan...' : isMobileLandscape ? 'Simpan' : 'Simpan Dekorasi'}</span>
          </button>
        </div>
      </div>

      {/* Kontrol Item Terpilih (Sentuh HP & Desktop) */}
      {(selectedItem || pendingFurnitureId) && (
        <div
          className={`pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-sky-500/40 bg-slate-900/95 text-xs text-slate-100 shadow-xl max-w-[96vw] ${
            isMobileLandscape ? 'px-2.5 py-1' : 'px-3 py-2'
          }`}
        >
          <span className="font-semibold text-sky-300 mr-0.5 truncate max-w-[160px]">
            {selectedMeta?.name || 'Furnitur'} ({selectedItem ? selectedItem.rot : pendingRotation}°)
          </span>

          <button
            type="button"
            onClick={onRotate}
            className={`flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 font-semibold hover:bg-slate-700 active:scale-95 ${
              isMobileLandscape ? 'px-2 py-1' : 'px-2.5 py-1.5'
            }`}
            title="Putar 90 derajat"
          >
            <RotateCw className="h-3.5 w-3.5 text-amber-300" />
            <span>Putar</span>
          </button>

          {selectedItem && (
            <>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onNudgeSelected(-1, 0)}
                  className={`${
                    isMobileLandscape ? 'h-8 w-8' : 'h-9 w-9 sm:h-8 sm:w-8'
                  } flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95`}
                  aria-label="Geser kiri"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNudgeSelected(0, -1)}
                  className={`${
                    isMobileLandscape ? 'h-8 w-8' : 'h-9 w-9 sm:h-8 sm:w-8'
                  } flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95`}
                  aria-label="Geser atas"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNudgeSelected(0, 1)}
                  className={`${
                    isMobileLandscape ? 'h-8 w-8' : 'h-9 w-9 sm:h-8 sm:w-8'
                  } flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95`}
                  aria-label="Geser bawah"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNudgeSelected(1, 0)}
                  className={`${
                    isMobileLandscape ? 'h-8 w-8' : 'h-9 w-9 sm:h-8 sm:w-8'
                  } flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95`}
                  aria-label="Geser kanan"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={onRemoveSelected}
                className={`flex items-center gap-1 rounded-lg bg-rose-950/80 border border-rose-500/40 font-semibold text-rose-200 hover:bg-rose-900 active:scale-95 ${
                  isMobileLandscape ? 'px-2 py-1' : 'px-2.5 py-1.5'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Angkat</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Daftar Furnitur dari Inventori */}
      <div
        className={`pointer-events-auto flex items-center gap-1.5 overflow-x-auto max-w-[96vw] rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl ${
          isMobileLandscape ? 'px-2 py-1.5' : 'px-2.5 py-2'
        }`}
      >
        <div className="flex items-center gap-1 px-1.5 text-[11px] font-semibold text-slate-400 shrink-0">
          <PackageOpen className="h-3.5 w-3.5 text-emerald-400" />
          <span>Gudang:</span>
        </div>
        {furnitureInventory.length === 0 ? (
          <span className="px-2 py-1 text-[11px] text-slate-400 whitespace-nowrap">
            Belum ada furnitur milikmu. Beli di Toko Mebel atau geser furnitur yang ada.
          </span>
        ) : (
          furnitureInventory.map((inv) => {
            const used = placedCounts.get(inv.itemId) ?? 0;
            const avail = Math.max(0, inv.quantity - used);
            const active = pendingFurnitureId === inv.itemId;
            return (
              <button
                key={inv.id}
                type="button"
                disabled={avail <= 0 && !active}
                onClick={() => onSelectPendingFurniture(active ? null : inv.itemId)}
                className={`shrink-0 rounded-xl border text-left text-[11px] transition ${
                  isMobileLandscape ? 'px-2 py-1' : 'px-2.5 py-1.5'
                } ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 font-bold'
                    : avail > 0
                      ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
                      : 'border-slate-800 bg-slate-900 text-slate-500 opacity-50'
                }`}
              >
                <div>{inv.name}</div>
                <div className="text-[10px] text-slate-400">Tersedia: {avail}</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
