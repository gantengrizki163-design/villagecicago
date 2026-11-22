import React, { useEffect, useMemo, useState } from 'react';
import { Check, Droplet, Paintbrush, PackagePlus, Store, Wrench, X } from 'lucide-react';
import { VehiclePreview3D } from '../components/VehiclePreview3D';
import { callServiceVehicle } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { getDefaultVehicleConfig, getVehicleModelById } from '../firebase/vehicleConfigCache';
import type { BusinessDoc, CharacterDoc, VehicleDoc } from '../types/game';

interface WorkshopModalProps {
  open: boolean;
  initialBusinessId?: string | null;
  character: CharacterDoc;
  vehicles: VehicleDoc[];
  businesses: BusinessDoc[];
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const CUSTOM_PAINT_SWATCHES = [
  '#DC2626',
  '#2563EB',
  '#16A34A',
  '#F59E0B',
  '#0F172A',
  '#F8FAFC',
  '#7C3AED',
  '#0D9488',
];

export const WorkshopModal: React.FC<WorkshopModalProps> = ({
  open,
  initialBusinessId,
  character,
  vehicles,
  businesses,
  onClose,
  onNotify,
}) => {
  const cfg = getDefaultVehicleConfig().vehicles;
  const playerWorkshops = useMemo(
    () => businesses.filter((b) => b.status === 'active' && b.type === 'bengkel'),
    [businesses]
  );

  const [selectedBizId, setSelectedBizId] = useState<string>('npc');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#DC2626');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialBusinessId && playerWorkshops.some((b) => b.id === initialBusinessId)) {
      setSelectedBizId(initialBusinessId);
    } else {
      setSelectedBizId('npc');
    }
    if (vehicles.length > 0 && !vehicles.some((v) => v.id === selectedVehicleId)) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [open, initialBusinessId, playerWorkshops, vehicles, selectedVehicleId]);

  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null;
  const activeModel = activeVehicle ? getVehicleModelById(activeVehicle.modelId, cfg) : null;

  useEffect(() => {
    if (activeVehicle) {
      setSelectedColor(activeVehicle.color || '#DC2626');
    }
  }, [activeVehicle?.id]);

  if (!open) return null;

  const missingCond = activeVehicle ? Math.max(0, 100 - activeVehicle.condition) : 0;
  const repairCost = activeModel
    ? Math.max(
        activeModel.serviceCostBase,
        Math.round((missingCond * cfg.maintenanceSettings.repairPerConditionPoint) / 500) * 500
      )
    : 15000;
  const oilCost = activeModel
    ? Math.max(cfg.maintenanceSettings.oilChangeCostBase, Math.round(activeModel.serviceCostBase * 0.7))
    : cfg.maintenanceSettings.oilChangeCostBase;
  const repaintCost = cfg.maintenanceSettings.repaintCost;

  const availableColors = Array.from(
    new Set([...(activeModel?.colors || []), ...CUSTOM_PAINT_SWATCHES])
  );
  const matchingAccessories = activeModel
    ? cfg.accessories.filter((a) => a.category === 'all' || a.category === activeModel.category)
    : [];

  const handleService = async (
    serviceType: 'repair' | 'oil_change' | 'paint' | 'accessory',
    extra?: { color?: string; accessoryId?: string }
  ) => {
    if (!activeVehicle || busy) return;
    setBusy(true);
    try {
      const res = await callServiceVehicle({
        vehicleId: activeVehicle.id,
        serviceType,
        color: extra?.color,
        accessoryId: extra?.accessoryId,
        businessId: selectedBizId !== 'npc' ? selectedBizId : undefined,
      });
      onNotify(`${res.details} selesai (${formatRupiah(res.cost)})!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memproses layanan bengkel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="h-5 w-5 text-sky-400 shrink-0" />
              <span className="truncate">Bengkel Servis, Cat &amp; Modifikasi</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              Tunai {formatRupiah(character.money)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white shrink-0 cursor-pointer"
            aria-label="Tutup bengkel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Provider Bengkel */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1.5">Pilih Lokasi Bengkel</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedBizId('npc')}
                className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  selectedBizId === 'npc'
                    ? 'bg-sky-500 border-sky-400 text-slate-950'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Bengkel Resmi Priangan</span>
              </button>
              {playerWorkshops.map((biz) => (
                <button
                  key={biz.id}
                  type="button"
                  onClick={() => setSelectedBizId(biz.id)}
                  className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    selectedBizId === biz.id
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>{biz.name}</span>
                </button>
              ))}
            </div>
          </div>

          {!activeVehicle ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
              Kamu belum memiliki kendaraan untuk diservis.
            </div>
          ) : (
            <>
              {/* Vehicle Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {vehicles.map((v) => {
                  const picked = v.id === activeVehicle.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVehicleId(v.id)}
                      className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                        picked
                          ? 'bg-slate-800 border-sky-400/70'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border border-white/30 shrink-0"
                          style={{ backgroundColor: v.color }}
                        />
                        <span className="font-bold text-xs text-white truncate">{v.name}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                        {v.plateNumber} · Kondisi {Math.round(v.condition)}%
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Pratinjau 3D Langsung Cat & Aksesori */}
              <VehiclePreview3D
                modelId={activeVehicle.modelId}
                color={selectedColor}
                accessories={activeVehicle.accessories || []}
                heightClass="h-44 sm:h-48"
                caption={`${activeVehicle.name} (${activeVehicle.plateNumber})`}
              />

              {/* Condition Bar */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Kesehatan Mesin &amp; Bodi ({activeVehicle.name})
                  </span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {Math.round(activeVehicle.condition)}% · Odo {activeVehicle.odometerKm.toFixed(1)} km
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      activeVehicle.condition <= 35
                        ? 'bg-rose-500'
                        : activeVehicle.condition <= 70
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, activeVehicle.condition))}%` }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={busy || missingCond <= 1}
                    onClick={() => void handleService('repair')}
                    className="min-h-[42px] rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 flex items-center justify-between gap-2 cursor-pointer disabled:opacity-45"
                  >
                    <span className="flex items-center gap-1.5">
                      <Wrench className="h-4 w-4" />
                      <span>Servis Penuh (100%)</span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {missingCond <= 1 ? 'Prima' : formatRupiah(repairCost)}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleService('oil_change')}
                    className="min-h-[42px] rounded-xl bg-sky-500/20 border border-sky-400/50 px-3.5 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30 flex items-center justify-between gap-2 cursor-pointer disabled:opacity-45"
                  >
                    <span className="flex items-center gap-1.5">
                      <Droplet className="h-4 w-4" />
                      <span>Ganti Oli (+18%)</span>
                    </span>
                    <span className="font-mono tabular-nums">{formatRupiah(oilCost)}</span>
                  </button>
                </div>
              </div>

              {/* Paint */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Paintbrush className="h-4 w-4 text-amber-400" />
                    <span>Cat Ulang Bodi</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                    {formatRupiah(repaintCost)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((hex) => {
                      const picked = hex.toUpperCase() === selectedColor.toUpperCase();
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setSelectedColor(hex)}
                          className={`h-8 w-8 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                            picked ? 'border-amber-400 scale-110' : 'border-slate-600'
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Warna cat ${hex}`}
                        >
                          {picked && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleService('paint', { color: selectedColor })}
                    className="min-h-[38px] px-4 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    Cat Sekarang
                  </button>
                </div>
              </div>

              {/* Accessories */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <PackagePlus className="h-4 w-4 text-emerald-400" />
                  <span>Aksesori &amp; Upgrade</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matchingAccessories.map((acc) => {
                    const installed = (activeVehicle.accessories || []).includes(acc.id);
                    return (
                      <div
                        key={acc.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{acc.label}</div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {formatRupiah(acc.cost)}
                            {acc.trunkBonus > 0 ? ` · +${acc.trunkBonus} Bagasi` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy || installed}
                          onClick={() => void handleService('accessory', { accessoryId: acc.id })}
                          className={`min-h-[34px] px-3 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                            installed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {installed ? 'Terpasang' : 'Pasang'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
