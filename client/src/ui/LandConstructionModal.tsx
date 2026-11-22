import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileBadge2,
  Hammer,
  HardHat,
  Landmark,
  MapPinned,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  callAdvanceConstruction,
  callApplyPermit,
  callBuyLand,
  callCompleteConstruction,
  callStartConstruction,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { computeLandPlotPriceClient } from '../firebase/phase6ConfigCache';
import type {
  BankAccountDoc,
  CharacterDoc,
  ConstructionConfigDoc,
  ConstructionDoc,
  DevelopmentProjectDoc,
  InventoryItemDoc,
  LandConfigDoc,
  LandPlotDoc,
} from '../types/game';
import { distance2D, INTERACT_RADIUS_METERS } from '../world3d/worldConstants';

interface LandConstructionModalProps {
  open: boolean;
  initialTab?: 'land' | 'build' | 'active';
  initialPlotId?: string | null;
  character: CharacterDoc;
  bankAccount: BankAccountDoc | null;
  landPlots: LandPlotDoc[];
  constructions: ConstructionDoc[];
  devProjects: DevelopmentProjectDoc[];
  inventory: InventoryItemDoc[];
  landConfig: LandConfigDoc;
  constructionConfig: ConstructionConfigDoc;
  playerPos: { x: number; z: number };
  serverNowMs: number;
  nearKantorDesa?: boolean;
  onGuideToPlot?: (plot: LandPlotDoc) => void;
  onGuideToImbDesk?: (plot: LandPlotDoc) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type ModalTab = 'land' | 'build' | 'active';

const MATERIAL_LABELS: Record<string, string> = {
  semen_sak: 'Semen (Sak)',
  bata_merah: 'Bata Merah',
  kayu_balok: 'Kayu Balok',
  genteng_pak: 'Genteng (Pak)',
  cat_tembok: 'Cat Tembok',
};

export const LandConstructionModal: React.FC<LandConstructionModalProps> = ({
  open,
  initialTab = 'land',
  initialPlotId = null,
  character,
  bankAccount,
  landPlots,
  constructions,
  devProjects,
  inventory,
  landConfig,
  constructionConfig,
  playerPos,
  serverNowMs,
  nearKantorDesa = true,
  onGuideToPlot,
  onGuideToImbDesk,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<ModalTab>(initialTab);
  const [landFilter, setLandFilter] = useState<'all' | 'available' | 'mine'>('all');
  const [payFrom, setPayFrom] = useState<'wallet' | 'bank'>('wallet');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [blueprintId, setBlueprintId] = useState<'kecil' | 'sedang' | 'besar'>('kecil');
  const [contractorType, setContractorType] = useState<'npc' | 'player'>('npc');
  const [selectedDevProjectId, setSelectedDevProjectId] = useState<string>('');
  const [claimNames, setClaimNames] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
      if (initialPlotId) setSelectedPlotId(initialPlotId);
    }
  }, [open, initialTab, initialPlotId]);

  const invQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of inventory) {
      map[item.itemId] = (map[item.itemId] || 0) + Number(item.quantity || 0);
    }
    return map;
  }, [inventory]);

  const myPlots = useMemo(
    () => landPlots.filter((p) => p.ownerId === character.uid),
    [landPlots, character.uid]
  );

  const readyToBuildPlots = useMemo(
    () =>
      myPlots.filter((p) => {
        const imb = p.imbStatus || p.permitStatus || 'none';
        const built = p.builtPropertyId || p.propertyId;
        return imb === 'approved' && !p.constructionId && !built;
      }),
    [myPlots]
  );

  const myConstructions = useMemo(
    () => constructions.filter((c) => c.ownerId === character.uid),
    [constructions, character.uid]
  );

  if (!open) return null;

  const filteredPlots = landPlots.filter((p) => {
    if (landFilter === 'available') return !p.ownerId || p.ownerId === 'npc_pemdes_cicalengka' || p.status === 'available';
    if (landFilter === 'mine') return p.ownerId === character.uid;
    return true;
  });

  const buildPlot =
    readyToBuildPlots.find((p) => p.id === selectedPlotId) || readyToBuildPlots[0] || null;
  const blueprint = constructionConfig.blueprints[blueprintId];
  const laborMultiplier = constructionConfig.contractorFeeRate[contractorType] ?? 1;
  const estimatedLaborCost = Math.round(blueprint.laborCost * laborMultiplier);

  const missingMaterials = Object.entries(blueprint.materials).filter(
    ([matId, reqQty]) => (invQtyMap[matId] || 0) < reqQty
  );

  const handleBuyLand = async (plot: LandPlotDoc) => {
    setBusyId(`buy_${plot.id}`);
    try {
      const res = await callBuyLand(plot.id, payFrom, selectedDevProjectId || undefined);
      onNotify(`Berhasil membeli ${plot.name} (${formatRupiah(res.totalCost)})! Sertifikat SHM diterbitkan.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli kavling tanah.');
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyPermit = async (plot: LandPlotDoc) => {
    setBusyId(`imb_${plot.id}`);
    try {
      const res = await callApplyPermit(plot.id, payFrom);
      if (res.permitStatus === 'approved') {
        onNotify(`IMB untuk ${plot.name} telah TERBIT! Silakan mulai pembangunan.`);
      } else {
        onNotify(`Pengajuan IMB ${plot.name} diproses Kantor Desa!`);
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengurus IMB.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStartConstruction = async () => {
    if (!buildPlot) return;
    setBusyId('start_build');
    try {
      const res = await callStartConstruction({
        plotId: buildPlot.id,
        blueprintId,
        contractorType,
        payFrom,
        devProjectId: selectedDevProjectId || undefined,
      });
      onNotify(
        `Konstruksi ${blueprint.name} dimulai di ${buildPlot.name}! Tahap awal: ${res.phase}.`
      );
      setTab('active');
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memulai pembangunan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdvance = async (conId: string) => {
    setBusyId(`adv_${conId}`);
    try {
      const res = await callAdvanceConstruction(conId);
      if (res.phase === 'selesai') {
        onNotify('Pembangunan selesai 100%! Terbitkan SHM & klaim properti barumu.');
      } else if (res.advanced) {
        onNotify(`Tahap konstruksi naik ke: ${res.phase.toUpperCase()}!`);
      } else {
        onNotify(`Masih mengerjakan ${res.phase} (sisa ${res.remainingSec} detik).`);
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menyegarkan progres konstruksi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (con: ConstructionDoc) => {
    setBusyId(`done_${con.id}`);
    try {
      const customName = claimNames[con.id]?.trim();
      const res = await callCompleteConstruction(con.id, customName || undefined);
      onNotify(
        `Selamat! ${res.propertyName} resmi berdiri dengan sertifikat ${res.certificateId}.`
      );
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mengklaim properti selesai dibangun.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <HardHat className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Kavling Tanah, IMB &amp; Pembangunan 3D
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Milik Anda: {myPlots.length}/{landConfig.maxLandsPerPlayer} kavling · Dompet{' '}
                <span className="font-mono tabular-nums text-emerald-300">
                  {formatRupiah(character.money)}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            aria-label="Tutup panel tanah dan konstruksi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs + Payment Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 pt-2 shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'land' as ModalTab, label: 'Kavling & IMB' },
              { id: 'build' as ModalTab, label: `Bangun (${readyToBuildPlots.length})` },
              { id: 'active' as ModalTab, label: `Proyek (${myConstructions.length})` },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  tab === item.id
                    ? 'border-amber-400 bg-slate-800/80 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pb-1.5 text-[11px]">
            <span className="text-slate-400">Bayar:</span>
            <button
              type="button"
              onClick={() => setPayFrom('wallet')}
              className={`rounded-md px-2 py-1 font-semibold ${
                payFrom === 'wallet' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Dompet
            </button>
            <button
              type="button"
              disabled={!bankAccount}
              onClick={() => setPayFrom('bank')}
              className={`rounded-md px-2 py-1 font-semibold disabled:opacity-40 ${
                payFrom === 'bank' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Bank
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'land' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1 text-[11px] font-semibold">
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'available', label: 'Tersedia' },
                      { id: 'mine', label: `Milik Saya (${myPlots.length})` },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLandFilter(f.id)}
                      className={`rounded-lg px-2.5 py-1 ${
                        landFilter === f.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {devProjects.length > 0 && (
                  <select
                    value={selectedDevProjectId}
                    onChange={(e) => setSelectedDevProjectId(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-200"
                  >
                    <option value="">Beli Pribadi (Non-Developer)</option>
                    {devProjects.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        Proyek: {dp.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2.5">
                {filteredPlots.map((plot) => {
                  const isMine = plot.ownerId === character.uid;
                  const isAvailable =
                    !plot.ownerId ||
                    plot.ownerId === 'npc_pemdes_cicalengka' ||
                    plot.status === 'available';
                  const price = computeLandPlotPriceClient(plot, landConfig);
                  const imb = plot.imbStatus || plot.permitStatus || 'none';
                  const readyAt = plot.permitReadyAtMs ?? plot.imbReadyAtMs ?? 0;
                  const imbRemSec = Math.max(0, Math.ceil((readyAt - serverNowMs) / 1000));
                  const dist = Math.round(
                    distance2D(playerPos.x, playerPos.z, plot.position.x, plot.position.z)
                  );
                  const plotRadius = Math.max(
                    INTERACT_RADIUS_METERS,
                    Math.max(plot.size.width, plot.size.depth) / 2 + 4.5
                  );
                  const isNearPlot = dist <= plotRadius;
                  const canBuyAtLocation = isNearPlot || nearKantorDesa;
                  const canImbAtLocation = nearKantorDesa || isNearPlot;
                  const isHighlighted = initialPlotId === plot.id;

                  return (
                    <div
                      key={plot.id}
                      className={`rounded-xl border p-3 space-y-2 ${
                        isHighlighted
                          ? 'border-amber-400 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-950/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <MapPinned className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{plot.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {plot.size.width}x{plot.size.depth}m · Akses {plot.roadAccess} · Zona{' '}
                            {plot.zoning} · <span className="font-mono">{dist}m</span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            Pemilik: <strong>{isMine ? 'Anda' : plot.ownerName || 'Pemdes'}</strong>
                            {plot.certificateId ? ` · ${plot.certificateId}` : ''}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums text-xs font-bold text-emerald-300 shrink-0">
                          {formatRupiah(price)}
                        </div>
                      </div>

                      {isAvailable && (
                        !canBuyAtLocation && onGuideToPlot ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => {
                              onClose();
                              onGuideToPlot(plot);
                            }}
                            className="w-full min-h-[42px] rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-45"
                          >
                            Arahkan ke Kavling / Kantor Desa ({dist}m)
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void handleBuyLand(plot)}
                            className="w-full min-h-[42px] rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-45"
                          >
                            {busyId === `buy_${plot.id}` ? 'Membeli...' : `Beli Kavling (${formatRupiah(price)})`}
                          </button>
                        )
                      )}

                      {isMine && !(plot.builtPropertyId || plot.propertyId) && !plot.constructionId && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-slate-300">
                            IMB:{' '}
                            <strong
                              className={
                                imb === 'approved'
                                  ? 'text-emerald-300'
                                  : imb === 'pending'
                                    ? 'text-amber-300'
                                    : 'text-slate-400'
                              }
                            >
                              {imb === 'approved'
                                ? 'Terbit (Siap Bangun)'
                                : imb === 'pending'
                                  ? imbRemSec > 0
                                    ? `Diproses (${imbRemSec}d)`
                                    : 'Siap Diterbitkan!'
                                  : 'Belum Ada'}
                            </strong>
                          </span>
                          {imb === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlotId(plot.id);
                                setTab('build');
                              }}
                              className="min-h-[38px] rounded-xl bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                            >
                              Pilih Desain Bangunan
                            </button>
                          ) : !canImbAtLocation && onGuideToImbDesk ? (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => {
                                onClose();
                                onGuideToImbDesk(plot);
                              }}
                              className="min-h-[38px] rounded-xl border border-sky-500/50 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-45"
                            >
                              Arahkan ke Kantor Desa
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => void handleApplyPermit(plot)}
                              className="min-h-[38px] rounded-xl border border-sky-500/50 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-45"
                            >
                              {imb === 'pending'
                                ? 'Cek Terbit IMB'
                                : `Ajukan IMB (${formatRupiah(landConfig.imbFeeBase)})`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'build' && (
            <div className="space-y-4">
              {readyToBuildPlots.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 text-xs text-slate-300 space-y-2">
                  <p>
                    Belum ada kavling milik Anda yang siap dibangun. Pastikan kamu sudah membeli kavling dan mengurus IMB hingga berstatus <strong>Terbit</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('land')}
                    className="min-h-[40px] rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                  >
                    Lihat Daftar Kavling &amp; IMB
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Kavling Siap Bangun (IMB Terbit)
                    </label>
                    <select
                      value={buildPlot?.id || ''}
                      onChange={(e) => setSelectedPlotId(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      {readyToBuildPlots.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.size.width}x{p.size.depth}m)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pilih Cetak Biru */}
                  <div className="space-y-2">
                    <label className="block text-[11px] text-slate-300">Pilih Cetak Biru Bangunan</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(['kecil', 'sedang', 'besar'] as const).map((bpKey) => {
                        const bp = constructionConfig.blueprints[bpKey];
                        const active = blueprintId === bpKey;
                        return (
                          <button
                            key={bpKey}
                            type="button"
                            onClick={() => setBlueprintId(bpKey)}
                            className={`text-left rounded-xl border p-3 transition ${
                              active
                                ? 'border-amber-400 bg-amber-950/25'
                                : 'border-slate-800 bg-slate-950/70'
                            }`}
                          >
                            <div className="text-xs font-bold text-white">{bp.name}</div>
                            <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                              {bp.rooms} Kamar · Nilai ~{formatRupiah(bp.estimatedMarketValue)}
                            </div>
                            <div className="mt-1 text-[11px] font-bold font-mono text-amber-300">
                              Jasa {formatRupiah(bp.laborCost)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kontraktor */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setContractorType('npc')}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold ${
                        contractorType === 'npc'
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      Mandor NPC (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setContractorType('player')}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold ${
                        contractorType === 'player'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      Swakelola / Kontraktor (Hemat 15%)
                    </button>
                  </div>

                  {/* Daftar Material Bangunan */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Kebutuhan Material Konstruksi</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        Biaya Jasa: {formatRupiah(estimatedLaborCost)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      {Object.entries(blueprint.materials).map(([matId, reqQty]) => {
                        const have = invQtyMap[matId] || 0;
                        const enough = have >= reqQty;
                        return (
                          <div
                            key={matId}
                            className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 ${
                              enough
                                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                                : 'border-rose-500/30 bg-rose-950/20 text-rose-200'
                            }`}
                          >
                            <span>{MATERIAL_LABELS[matId] || matId}</span>
                            <span className="font-mono tabular-nums font-bold">
                              {have} / {reqQty}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {missingMaterials.length > 0 && (
                      <p className="text-[11px] text-amber-300">
                        Material kurang! Beli semen, bata, kayu, genteng, dan cat di Pasar Grosir atau Toko Bangunan.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={missingMaterials.length > 0 || busyId !== null}
                    onClick={() => void handleStartConstruction()}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    <Hammer className="h-4 w-4" />
                    <span>
                      {busyId === 'start_build'
                        ? 'Memulai Proyek...'
                        : `Mulai Bangun (${formatRupiah(estimatedLaborCost)})`}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'active' && (
            <div className="space-y-3">
              {myConstructions.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 text-center text-xs text-slate-400">
                  Belum ada proyek pembangunan yang sedang berjalan atau menunggu klaim SHM.
                </div>
              ) : (
                myConstructions.map((con) => {
                  const isFinishedPhase = con.phase === 'selesai';
                  const isClaimed = con.status === 'completed' || con.status === 'claimed' || Boolean(con.builtPropertyId || con.propertyId);
                  const phaseEndMs = con.phaseEndsAtMs ?? con.phaseStartedAtMs + con.phaseDurationMs;
                  const remSec = Math.max(0, Math.ceil((phaseEndMs - serverNowMs) / 1000));
                  const pct = isFinishedPhase ? 100 : Math.min(95, (con.phaseIndex + 1) * 25);

                  return (
                    <div
                      key={con.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/85 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Landmark className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>
                              {con.blueprintName || constructionConfig.blueprints[con.blueprintId]?.name || con.plotId}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Kavling: {con.plotName || con.plotId} · Tahap:{' '}
                            <strong className="text-amber-300 uppercase">{con.phase}</strong>
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-xs font-bold text-emerald-300">
                          {pct}%
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-amber-400 transition-all"
                        />
                      </div>

                      {!isClaimed && !isFinishedPhase && (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="font-mono tabular-nums text-[11px] text-slate-300">
                            {remSec > 0 ? `Estimasi tahap ini: ${remSec}d` : 'Tahap siap dilanjutkan!'}
                          </span>
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void handleAdvance(con.id)}
                            className="min-h-[40px] flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-45"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>{busyId === `adv_${con.id}` ? '...' : 'Lanjutkan Tahap'}</span>
                          </button>
                        </div>
                      )}

                      {!isClaimed && isFinishedPhase && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={claimNames[con.id] || ''}
                            onChange={(e) =>
                              setClaimNames((prev) => ({ ...prev, [con.id]: e.target.value }))
                            }
                            placeholder="Nama properti baru (opsional)..."
                            className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                          />
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void handleComplete(con)}
                            className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                          >
                            <FileBadge2 className="h-4 w-4" />
                            <span>
                              {busyId === `done_${con.id}`
                                ? 'Menerbitkan SHM...'
                                : 'Terbitkan SHM & Klaim Properti'}
                            </span>
                          </button>
                        </div>
                      )}

                      {isClaimed && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Selesai &amp; Resmi Berdiri! Cek daftar propertimu di menu Hunian.</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
