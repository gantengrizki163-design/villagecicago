import React, { useState } from 'react';
import { Bike, Car, Fuel, X, Zap } from 'lucide-react';
import { callRefuelVehicle } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { getDefaultVehicleConfig, getVehicleModelById } from '../firebase/vehicleConfigCache';
import type { CharacterDoc, VehicleDoc } from '../types/game';

interface SpbuModalProps {
  open: boolean;
  character: CharacterDoc;
  vehicles: VehicleDoc[];
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const SpbuModal: React.FC<SpbuModalProps> = ({
  open,
  character,
  vehicles,
  onClose,
  onNotify,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const cfg = getDefaultVehicleConfig().vehicles;

  if (!open) return null;

  const handleRefuel = async (vehicle: VehicleDoc, ratio: number | 'full') => {
    if (busyId) return;
    const model = getVehicleModelById(vehicle.modelId, cfg);
    const cap = model?.tankCapacity ?? vehicle.fuelCapacity ?? 10;
    const needed = Math.max(0, cap - vehicle.fuel);
    if (needed <= 0.05) {
      onNotify(vehicle.isElectric ? 'Baterai sudah penuh.' : 'Tangki sudah penuh.');
      return;
    }
    const reqAmount =
      ratio === 'full' ? undefined : Math.min(needed, Math.max(0.5, cap * ratio));

    setBusyId(vehicle.id);
    try {
      const res = await callRefuelVehicle(vehicle.id, reqAmount);
      onNotify(
        `${vehicle.isElectric ? 'Isi daya' : 'Isi BBM'} ${vehicle.name} sukses (${formatRupiah(res.cost)}).`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengisi energi kendaraan.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Fuel className="h-5 w-5 text-rose-400 shrink-0" />
              <span className="truncate">SPBU &amp; Stasiun Cas EV Cicalengka</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              Tunai {formatRupiah(character.money)} · Bensin {formatRupiah(cfg.fuelPrices.bensinPerUnit)}/L · EV{' '}
              {formatRupiah(cfg.fuelPrices.electricPerPercent)}/%
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white shrink-0 cursor-pointer"
            aria-label="Tutup SPBU"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {vehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
              Kamu belum memiliki kendaraan. Kunjungi Dealer Motor atau Showroom Mobil terlebih dahulu.
            </div>
          ) : (
            vehicles.map((v) => {
              const model = getVehicleModelById(v.modelId, cfg);
              const isEv = Boolean(v.isElectric ?? model?.isElectric);
              const cap = model?.tankCapacity ?? v.fuelCapacity ?? 10;
              const pct = Math.max(0, Math.min(100, Math.round((v.fuel / Math.max(0.1, cap)) * 100)));
              const needed = Math.max(0, cap - v.fuel);
              const unitPrice = isEv ? cfg.fuelPrices.electricPerPercent : cfg.fuelPrices.bensinPerUnit;
              const fullCost = needed <= 0.05 ? 0 : Math.max(500, Math.round((needed * unitPrice) / 100) * 100);
              const isBusy = busyId === v.id;

              return (
                <div
                  key={v.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {v.category === 'motor' ? (
                          <Bike className="h-4 w-4 text-amber-400 shrink-0" />
                        ) : (
                          <Car className="h-4 w-4 text-sky-400 shrink-0" />
                        )}
                        <span className="font-bold text-sm text-white truncate">{v.name}</span>
                        {isEv && <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 font-mono tabular-nums">
                        {v.plateNumber} · {isEv ? 'Baterai' : 'Bensin'}: {v.fuel.toFixed(1)}/{cap}
                        {isEv ? '%' : 'L'} ({pct}%)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400">Estimasi Penuh</div>
                      <div className="text-sm font-bold text-amber-300 font-mono tabular-nums">
                        {fullCost > 0 ? formatRupiah(fullCost) : 'Penuh'}
                      </div>
                    </div>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct <= 20
                          ? 'bg-rose-500'
                          : isEv
                            ? 'bg-emerald-400'
                            : 'bg-amber-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy || needed <= 0.05}
                      onClick={() => void handleRefuel(v, 0.25)}
                      className="min-h-[38px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap cursor-pointer disabled:opacity-45"
                    >
                      +25%
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || needed <= 0.05}
                      onClick={() => void handleRefuel(v, 0.5)}
                      className="min-h-[38px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap cursor-pointer disabled:opacity-45"
                    >
                      +50%
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || needed <= 0.05}
                      onClick={() => void handleRefuel(v, 'full')}
                      className="flex-1 min-h-[38px] px-3.5 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap cursor-pointer disabled:opacity-45"
                    >
                      {needed <= 0.05
                        ? isEv
                          ? 'Baterai Sudah Penuh'
                          : 'Tangki Sudah Penuh'
                        : isEv
                          ? `Cas Penuh (${formatRupiah(fullCost)})`
                          : `Isi Penuh (${formatRupiah(fullCost)})`}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
