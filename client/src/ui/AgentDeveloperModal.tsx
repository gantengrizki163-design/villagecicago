import React, { useMemo, useState } from 'react';
import {
  Armchair,
  BadgeCheck,
  Briefcase,
  Building,
  CheckCircle2,
  Hammer,
  Handshake,
  PaintBucket,
  X,
} from 'lucide-react';
import {
  callBecomeAgent,
  callBuyFurnitureSet,
  callCloseDeal,
  callCompleteRenovation,
  callCreateClientRequest,
  callCreateDevelopmentProject,
  callStartRenovation,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { computeLazyWantedClient } from '../firebase/phase6ConfigCache';
import type {
  AgentClientRequestDoc,
  AreaTag,
  BankAccountDoc,
  CharacterDoc,
  ConstructionConfigDoc,
  DevelopmentProjectDoc,
  InventoryItemDoc,
  LandPlotDoc,
  LawConfigDoc,
  PropertyDoc,
  PropertyListingDoc,
  PropertyType,
  RenovationDoc,
} from '../types/game';
import { distance2D, FURNITURE_CATALOG, INTERACT_RADIUS_METERS, TOKO_MEBEL_POS } from '../world3d/worldConstants';

interface AgentDeveloperModalProps {
  open: boolean;
  initialTab?: 'agent' | 'developer' | 'furniture_sets';
  character: CharacterDoc;
  bankAccount: BankAccountDoc | null;
  constructionConfig: ConstructionConfigDoc;
  lawConfig: LawConfigDoc;
  dayDurationMs: number;
  listings: PropertyListingDoc[];
  properties: PropertyDoc[];
  landPlots: LandPlotDoc[];
  agentClients: AgentClientRequestDoc[];
  devProjects: DevelopmentProjectDoc[];
  renovations: RenovationDoc[];
  inventory: InventoryItemDoc[];
  playerPos: { x: number; z: number };
  serverNowMs: number;
  onGuideToTokoMebel?: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type ModalTab = 'agent' | 'developer' | 'furniture_sets';

export const AgentDeveloperModal: React.FC<AgentDeveloperModalProps> = ({
  open,
  initialTab = 'agent',
  character,
  bankAccount,
  constructionConfig,
  lawConfig,
  dayDurationMs,
  listings,
  properties,
  landPlots,
  agentClients,
  devProjects,
  renovations,
  inventory,
  playerPos,
  serverNowMs,
  onGuideToTokoMebel,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<ModalTab>(initialTab);
  const [payFrom, setPayFrom] = useState<'wallet' | 'bank'>('wallet');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Agen form
  const [desiredArea, setDesiredArea] = useState<AreaTag | 'any'>('any');
  const [desiredType, setDesiredType] = useState<PropertyType | 'any'>('any');
  const [desiredKind, setDesiredKind] = useState<'sale' | 'rent'>('sale');
  const [selectedListingByClient, setSelectedListingByClient] = useState<Record<string, string>>({});

  // Developer & Renovasi form
  const [devProjectName, setDevProjectName] = useState('Cluster Cicalengka Asri');
  const [renoPropId, setRenoPropId] = useState('');
  const [renoType, setRenoType] = useState<'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage'>(
    'add_room'
  );

  React.useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const wantedLevel = useMemo(
    () =>
      computeLazyWantedClient(
        character.wantedLevel,
        character.wantedUpdatedAtMs,
        serverNowMs,
        lawConfig,
        dayDurationMs
      ),
    [character.wantedLevel, character.wantedUpdatedAtMs, serverNowMs, lawConfig, dayDurationMs]
  );

  const ownedProperties = useMemo(
    () => properties.filter((p) => p.ownerId === character.uid),
    [properties, character.uid]
  );

  const invQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of inventory) {
      map[item.itemId] = (map[item.itemId] || 0) + Number(item.quantity || 0);
    }
    return map;
  }, [inventory]);

  if (!open) return null;

  const settings = constructionConfig.agentSettings;
  const kom = character.skills?.komunikasi ?? 1;
  const hit = character.skills?.hitung ?? 1;
  const rep = character.reputation ?? 50;
  const meetsLicenseReq =
    kom >= settings.minKomunikasi &&
    hit >= settings.minHitung &&
    rep >= settings.minReputation &&
    wantedLevel === 0;

  const nearTokoMebel =
    (character.currentZone || 'cicalengka') === 'cicalengka' &&
    distance2D(playerPos.x, playerPos.z, TOKO_MEBEL_POS.x, TOKO_MEBEL_POS.z) <= INTERACT_RADIUS_METERS;

  const activeRenoPropId = renoPropId || ownedProperties[0]?.id || '';
  const selectedReno = constructionConfig.renovations[renoType];
  const renoMissing = Object.entries(selectedReno.materials).filter(
    ([matId, req]) => (invQtyMap[matId] || 0) < req
  );

  const handleBecomeAgent = async () => {
    setBusyId('license');
    try {
      await callBecomeAgent(payFrom);
      onNotify('Selamat! Lisensi Agen Properti Priangan resmi aktif.');
    } catch (err) {
      onNotify((err as Error)?.message || 'Belum memenuhi syarat lisensi agen.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateClient = async () => {
    setBusyId('new_client');
    try {
      const res = await callCreateClientRequest({ desiredArea, desiredType, desiredKind });
      onNotify(`Klien baru terdaftar: ${res.clientName}! Cocokkan dengan listing di bawah.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal mencari klien baru.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCloseDeal = async (client: AgentClientRequestDoc, listingId: string) => {
    setBusyId(`deal_${client.id}`);
    try {
      const res = await callCloseDeal(client.id, listingId);
      onNotify(`Transaksi sukses dengan ${client.clientName}! Komisi: +${formatRupiah(res.commissionEarned)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menutup transaksi agen.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateDevProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devProjectName.trim()) return;
    setBusyId('dev_project');
    try {
      const myPlotIds = landPlots.filter((p) => p.ownerId === character.uid).map((p) => p.id);
      await callCreateDevelopmentProject(devProjectName.trim(), myPlotIds.slice(0, 4));
      onNotify(`Proyek developer "${devProjectName.trim()}" berhasil didaftarkan!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membuat proyek developer.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStartRenovation = async () => {
    if (!activeRenoPropId) return;
    setBusyId('start_reno');
    try {
      await callStartRenovation({
        propertyId: activeRenoPropId,
        renovationType: renoType,
        payFrom,
      });
      onNotify(`Renovasi "${selectedReno.label}" dimulai!`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memulai renovasi besar.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCompleteRenovation = async (renoId: string) => {
    setBusyId(`done_reno_${renoId}`);
    try {
      const res = await callCompleteRenovation(renoId);
      onNotify(`Renovasi selesai! Nilai properti bertambah +${formatRupiah(res.valueBoost)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Renovasi masih dikerjakan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBuyBundle = async (setId: string) => {
    setBusyId(`bundle_${setId}`);
    try {
      const res = await callBuyFurnitureSet(setId, payFrom);
      onNotify(`${res.setName} dibeli (${formatRupiah(res.bundlePrice)})! Cek gudang furniturmu.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal membeli paket mebel.');
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 border border-teal-500/30">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Agen Properti, Developer &amp; Renovasi
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {character.isPropertyAgent
                  ? `Agen Berlisensi · Transaksi: ${character.agentStats?.dealsClosed ?? 0} · Komisi ${formatRupiah(character.agentStats?.totalCommission ?? 0)}`
                  : 'Karier Agen Properti, Proyek Developer & Renovasi Besar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            aria-label="Tutup panel agen properti"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs + Payment Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 pt-2 shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'agent' as ModalTab, label: 'Agen Properti' },
              { id: 'developer' as ModalTab, label: 'Developer & Renovasi' },
              { id: 'furniture_sets' as ModalTab, label: 'Paket Mebel' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  tab === item.id
                    ? 'border-teal-400 bg-slate-800/80 text-teal-200'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pb-1.5 text-[11px]">
            <span className="text-slate-400">Dana:</span>
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
          {tab === 'agent' && (
            <div className="space-y-4">
              {!character.isPropertyAgent ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <BadgeCheck className="h-4 w-4 text-teal-400" />
                    <span>Daftar Lisensi Agen Properti Priangan</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className={kom >= settings.minKomunikasi ? 'text-emerald-300' : 'text-rose-300'}>
                      • Komunikasi: {kom}/{settings.minKomunikasi}
                    </div>
                    <div className={hit >= settings.minHitung ? 'text-emerald-300' : 'text-rose-300'}>
                      • Hitung: {hit}/{settings.minHitung}
                    </div>
                    <div className={rep >= settings.minReputation ? 'text-emerald-300' : 'text-rose-300'}>
                      • Reputasi: {rep}/{settings.minReputation}
                    </div>
                    <div className={wantedLevel === 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      • Status Wanted: {wantedLevel === 0 ? 'Bersih' : `${wantedLevel}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!meetsLicenseReq || busyId !== null}
                    onClick={() => void handleBecomeAgent()}
                    className="w-full min-h-[44px] rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    {busyId === 'license'
                      ? 'Mendaftar...'
                      : `Aktifkan Lisensi Agen (${formatRupiah(settings.licenseFee)})`}
                  </button>
                </div>
              ) : (
                <>
                  {/* Terima Klien Baru */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-white">
                      Cari Klien Pembeli / Penyewa Properti (Komisi {Math.round(settings.baseCommissionRate * 100)}%)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={desiredArea}
                        onChange={(e) => setDesiredArea(e.target.value as AreaTag | 'any')}
                        className="min-h-[38px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        <option value="any">Semua Area</option>
                        <option value="stasiun">Stasiun</option>
                        <option value="alun_alun">Alun-Alun</option>
                        <option value="pasar">Pasar</option>
                        <option value="perumahan">Perumahan</option>
                        <option value="kampung">Kampung</option>
                      </select>
                      <select
                        value={desiredType}
                        onChange={(e) => setDesiredType(e.target.value as PropertyType | 'any')}
                        className="min-h-[38px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        <option value="any">Semua Tipe</option>
                        <option value="rumah">Rumah</option>
                        <option value="kontrakan">Kontrakan</option>
                        <option value="kos">Kos</option>
                        <option value="ruko">Ruko</option>
                      </select>
                      <select
                        value={desiredKind}
                        onChange={(e) => setDesiredKind(e.target.value as 'sale' | 'rent')}
                        className="min-h-[38px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        <option value="sale">Beli</option>
                        <option value="rent">Sewa</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void handleCreateClient()}
                      className="w-full min-h-[42px] rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400"
                    >
                      {busyId === 'new_client' ? 'Mencari Klien...' : 'Terima Permintaan Klien Baru'}
                    </button>
                  </div>

                  {/* Daftar Klien */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Klien Aktif &amp; Closing Transaksi
                    </h3>
                    {agentClients.filter((c) => c.status === 'open').length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                        Belum ada permintaan klien terbuka.
                      </div>
                    ) : (
                      agentClients
                        .filter((c) => c.status === 'open')
                        .map((client) => {
                          const matches = listings.filter(
                            (lst) =>
                              lst.status === 'active' &&
                              lst.kind === client.desiredKind &&
                              lst.price <= client.maxBudget &&
                              (client.desiredArea === 'any' || lst.areaTag === client.desiredArea) &&
                              (client.desiredType === 'any' || lst.propertyType === client.desiredType)
                          );
                          const chosenListingId =
                            selectedListingByClient[client.id] || matches[0]?.id || '';

                          return (
                            <div
                              key={client.id}
                              className="rounded-xl border border-slate-800 bg-slate-950/85 p-3 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-bold text-white">{client.clientName}</div>
                                  <div className="text-[11px] text-slate-400">
                                    Cari {client.desiredKind === 'sale' ? 'Beli' : 'Sewa'} ·{' '}
                                    {client.desiredType} di {client.desiredArea}
                                  </div>
                                </div>
                                <div className="font-mono tabular-nums text-xs font-bold text-emerald-300">
                                  Maks {formatRupiah(client.maxBudget)}
                                </div>
                              </div>

                              {matches.length === 0 ? (
                                <p className="text-[11px] text-amber-300">
                                  Belum ada listing aktif yang cocok dengan bujet &amp; kriteria klien ini.
                                </p>
                              ) : (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <select
                                    value={chosenListingId}
                                    onChange={(e) =>
                                      setSelectedListingByClient((prev) => ({
                                        ...prev,
                                        [client.id]: e.target.value,
                                      }))
                                    }
                                    className="flex-1 min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                                  >
                                    {matches.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.propertyName} ({formatRupiah(m.price)})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={!chosenListingId || busyId !== null}
                                    onClick={() => void handleCloseDeal(client, chosenListingId)}
                                    className="min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 shrink-0"
                                  >
                                    <Handshake className="h-4 w-4" />
                                    <span>Tutup Deal</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'developer' && (
            <div className="space-y-4">
              {/* Proyek Developer */}
              <form
                onSubmit={(e) => void handleCreateDevProject(e)}
                className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-amber-400" />
                    <span>Proyek Developer / Perumahan</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Modal min {formatRupiah(settings.developerMinCapital)}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={devProjectName}
                    onChange={(e) => setDevProjectName(e.target.value)}
                    placeholder="Nama perumahan / cluster..."
                    className="flex-1 min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    type="submit"
                    disabled={busyId !== null}
                    className="min-h-[42px] rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shrink-0"
                  >
                    Buat Proyek
                  </button>
                </div>

                {devProjects.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {devProjects.map((dp) => (
                      <div
                        key={dp.id}
                        className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <div className="font-bold text-white">{dp.name}</div>
                          <div className="text-slate-400 font-mono">
                            {dp.plotIds.length} kavling · {dp.propertyIds.length} unit selesai
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-amber-300 font-bold">
                          Modal {formatRupiah(dp.totalCapitalSpent)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </form>

              {/* Renovasi Besar Properti */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <PaintBucket className="h-4 w-4 text-sky-400" />
                  <span>Renovasi Besar Properti Pribadi</span>
                </div>

                {ownedProperties.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Kamu belum memiliki properti untuk direnovasi.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={activeRenoPropId}
                        onChange={(e) => setRenoPropId(e.target.value)}
                        className="min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        {ownedProperties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.rooms} kmr)
                          </option>
                        ))}
                      </select>
                      <select
                        value={renoType}
                        onChange={(e) =>
                          setRenoType(
                            e.target.value as 'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage'
                          )
                        }
                        className="min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        {Object.values(constructionConfig.renovations).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label} ({formatRupiah(r.cost)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between font-mono tabular-nums">
                        <span className="text-slate-300">
                          Biaya: <strong className="text-amber-300">{formatRupiah(selectedReno.cost)}</strong>
                        </span>
                        <span className="text-emerald-300 font-bold">
                          Nilai +{formatRupiah(selectedReno.valueBoost)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selectedReno.materials).map(([matId, req]) => {
                          const have = invQtyMap[matId] || 0;
                          return (
                            <span
                              key={matId}
                              className={`font-mono ${have >= req ? 'text-emerald-300' : 'text-rose-300'}`}
                            >
                              {matId}: {have}/{req}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={renoMissing.length > 0 || busyId !== null}
                      onClick={() => void handleStartRenovation()}
                      className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      <Hammer className="h-4 w-4" />
                      <span>Mulai Renovasi ({formatRupiah(selectedReno.cost)})</span>
                    </button>
                  </>
                )}

                {renovations.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {renovations.map((r) => {
                      const remSec = Math.max(0, Math.ceil((r.completesAtMs - serverNowMs) / 1000));
                      const done = r.status === 'completed';
                      return (
                        <div
                          key={r.id}
                          className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{r.label}</div>
                            <div className="text-[11px] text-slate-400">
                              {r.propertyName || r.propertyId} ·{' '}
                              {done ? 'Selesai' : remSec > 0 ? `Sisa ${remSec}d` : 'Siap diselesaikan!'}
                            </div>
                          </div>
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => void handleCompleteRenovation(r.id)}
                              className="min-h-[38px] rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                            >
                              Selesaikan
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'furniture_sets' && (
            <div className="space-y-3">
              {!nearTokoMebel && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/35 p-3 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Kunjungi <strong>Toko Mebel Cicalengka</strong> ({TOKO_MEBEL_POS.x}, {TOKO_MEBEL_POS.z}) untuk membeli paket bundel mebel hemat.
                  </span>
                  {onGuideToTokoMebel && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGuideToTokoMebel();
                      }}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400"
                    >
                      Arahkan ke Toko Mebel
                    </button>
                  )}
                </div>
              )}

              {constructionConfig.furnitureSets.map((set) => {
                const saving = Math.max(0, set.normalPrice - set.bundlePrice);
                const itemNames = set.itemIds
                  .map((id) => FURNITURE_CATALOG.find((f) => f.id === id)?.name || id)
                  .join(', ');
                return (
                  <div
                    key={set.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/85 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Armchair className="h-4 w-4 text-amber-400 shrink-0" />
                          <span>{set.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">Isi: {itemNames}</p>
                        <div className="mt-1 text-[11px] text-emerald-300 font-mono tabular-nums">
                          Hemat {formatRupiah(saving)} · +{set.bonusMood} Mood · +{formatRupiah(set.bonusValue)} Nilai Rumah
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-xs font-bold text-amber-300">
                          {formatRupiah(set.bundlePrice)}
                        </div>
                        <div className="text-[10px] text-slate-500 line-through">
                          {formatRupiah(set.normalPrice)}
                        </div>
                      </div>
                    </div>

                    {!nearTokoMebel && onGuideToTokoMebel ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onGuideToTokoMebel();
                        }}
                        className="w-full min-h-[42px] rounded-xl border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                      >
                        Arahkan ke Toko Mebel ({formatRupiah(set.bundlePrice)})
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!nearTokoMebel || busyId !== null}
                        onClick={() => void handleBuyBundle(set.id)}
                        className="w-full min-h-[42px] rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        {busyId === `bundle_${set.id}`
                          ? 'Membeli...'
                          : `Beli Paket (${formatRupiah(set.bundlePrice)})`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
