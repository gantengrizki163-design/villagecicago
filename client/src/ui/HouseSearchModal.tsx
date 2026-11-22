import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Building2, ChevronRight, Filter, Home, MapPin, Navigation, Search, X } from 'lucide-react';
import { fetchListingsPaginated } from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import { localSimulation } from '../firebase/localSimulation';
import type {
  AreaTag,
  ListingKind,
  PropertyDoc,
  PropertyListingDoc,
  PropertyType,
} from '../types/game';
import { getLayoutRails, getLayoutRoads, LAYOUT_DATA } from '../world3d/layout/layoutHelpers';
import {
  ALUN_ALUN_POS,
  distance2D,
  INITIAL_LISTINGS_DATA,
  INITIAL_PROPERTIES_DATA,
  PASAR_POS,
  PENAMPUNGAN_POS,
  TICKET_BOOTH_POS,
  TOKO_MEBEL_POS,
} from '../world3d/worldConstants';

interface HouseSearchModalProps {
  open: boolean;
  playerPos: { x: number; z: number };
  properties: PropertyDoc[];
  localListings: PropertyListingDoc[];
  onSelectProperty: (property: PropertyDoc, listing?: PropertyListingDoc) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const AREA_LABELS: Record<AreaTag | 'all', string> = {
  all: 'Semua Zona',
  stasiun: 'Dekat Stasiun',
  pasar: 'Area Pasar',
  kampung: 'Kampung Babakan',
  perumahan: 'Perumahan Griya',
  alun_alun: 'Alun-Alun',
};

const TYPE_LABELS: Record<PropertyType | 'all', string> = {
  all: 'Semua Tipe',
  kos: 'Kos',
  kontrakan: 'Kontrakan',
  apartemen: 'Apartemen Mini',
  ruko: 'Ruko Niaga',
  rumah: 'Rumah Tapak',
  lapak_pasar: 'Lapak Pasar',
};

const PAGE_SIZE = 6;

export const HouseSearchModal: React.FC<HouseSearchModalProps> = ({
  open,
  playerPos,
  properties,
  localListings,
  onSelectProperty,
  onClose,
  onNotify,
}) => {
  const [kind, setKind] = useState<ListingKind | 'all'>('all');
  const [propertyType, setPropertyType] = useState<PropertyType | 'all'>('all');
  const [areaTag, setAreaTag] = useState<AreaTag | 'all'>('all');
  const [stationTier, setStationTier] = useState<'all' | 'dekat' | 'sedang' | 'jauh'>('all');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minRooms, setMinRooms] = useState<number>(1);
  const [minCondition, setMinCondition] = useState<number>(0);

  const [fsResults, setFsResults] = useState<PropertyListingDoc[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreFs, setHasMoreFs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localPage, setLocalPage] = useState(1);
  const [selectedMapListingId, setSelectedMapListingId] = useState<string | null>(null);

  const useLocal = localSimulation.isActive();

  const propertyById = useMemo(() => {
    const map = new Map<string, PropertyDoc>();
    for (const p of INITIAL_PROPERTIES_DATA) map.set(p.id, p);
    for (const p of properties) map.set(p.id, p);
    return map;
  }, [properties]);

  const loadFirestorePage = useCallback(
    async (reset: boolean, nextCursor: QueryDocumentSnapshot<DocumentData> | null) => {
      setLoading(true);
      try {
        const res = await fetchListingsPaginated({
          kind,
          propertyType,
          areaTag,
          stationTier,
          pageSize: PAGE_SIZE,
          cursor: reset ? null : nextCursor,
        });
        if (reset && res.listings.length === 0 && kind === 'all' && propertyType === 'all' && areaTag === 'all' && stationTier === 'all') {
          // Jika koleksi belum diseed di Firestore, tampilkan katalog referensi awal agar peta tetap berguna
          setFsResults(INITIAL_LISTINGS_DATA.slice(0, PAGE_SIZE));
          setHasMoreFs(false);
          setCursor(null);
        } else {
          setFsResults((prev) => (reset ? res.listings : [...prev, ...res.listings]));
          setCursor(res.lastDoc);
          setHasMoreFs(res.hasMore);
        }
      } catch (err) {
        onNotify((err as Error)?.message || 'Gagal memuat listing properti.');
      } finally {
        setLoading(false);
      }
    },
    [kind, propertyType, areaTag, stationTier, onNotify]
  );

  useEffect(() => {
    if (!open) return;
    if (useLocal) {
      setLocalPage(1);
      return;
    }
    void loadFirestorePage(true, null);
  }, [open, useLocal, kind, propertyType, areaTag, stationTier, loadFirestorePage]);

  const enrichedLocalListings = useMemo(() => {
    const src = localListings.length > 0 ? localListings : INITIAL_LISTINGS_DATA;
    return src.filter((l) => l.status === 'active');
  }, [localListings]);

  const filteredListings = useMemo(() => {
    const source = useLocal ? enrichedLocalListings : fsResults;
    const maxP = Number(maxPrice) > 0 ? Number(maxPrice) : Infinity;

    return source
      .filter((l) => {
        if (kind !== 'all' && l.kind !== kind) return false;
        if (propertyType !== 'all' && l.propertyType !== propertyType) return false;
        if (areaTag !== 'all' && l.areaTag !== areaTag) return false;
        const prop = propertyById.get(l.propertyId);
        const stDist =
          l.stationDistanceMeters ??
          (prop
            ? Math.round(distance2D(prop.position.x, prop.position.z, TICKET_BOOTH_POS.cicalengka.x, TICKET_BOOTH_POS.cicalengka.z))
            : 60);
        const computedTier = l.stationDistanceTier ?? (stDist <= 38 ? 'dekat' : stDist <= 75 ? 'sedang' : 'jauh');
        if (stationTier !== 'all' && computedTier !== stationTier) return false;
        if (l.price > maxP) return false;
        if ((l.rooms || 1) < minRooms) return false;
        if ((l.condition || 0) < minCondition) return false;
        return true;
      })
      .sort((a, b) => a.price - b.price);
  }, [useLocal, enrichedLocalListings, fsResults, kind, propertyType, areaTag, stationTier, maxPrice, minRooms, minCondition, propertyById]);

  const minimapRoads = useMemo(() => getLayoutRoads(), []);
  const minimapRails = useMemo(() => getLayoutRails(), []);

  const visibleListings = useLocal
    ? filteredListings.slice(0, localPage * PAGE_SIZE)
    : filteredListings;
  const canLoadMore = useLocal ? visibleListings.length < filteredListings.length : hasMoreFs;

  if (!open) return null;

  const worldHalf = LAYOUT_DATA.rules.worldHalfSize;
  const toSvgCoord = (x: number, z: number) => ({
    cx: ((x + worldHalf) / (worldHalf * 2)) * 200,
    cy: ((z + worldHalf) / (worldHalf * 2)) * 200,
  });
  const toSvgSize = (w: number, d: number) => ({
    width: (w / (worldHalf * 2)) * 200,
    height: (d / (worldHalf * 2)) * 200,
  });

  const playerSvg = toSvgCoord(playerPos.x, playerPos.z);

  const openListingProperty = (l: PropertyListingDoc) => {
    const prop = propertyById.get(l.propertyId);
    if (prop) {
      onSelectProperty(prop, l);
    } else {
      onNotify('Data detail properti sedang dimuat.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-2.5 sm:p-4">
      <div className="w-full max-w-4xl max-h-[90dvh] flex flex-col rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 sm:p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Cari Rumah &amp; Properti Cicalengka</h2>
              <p className="text-[11px] text-slate-400">
                Filter hunian dari agen NPC maupun pemilik pemain lain, cek peta &amp; dekati untuk survei.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup cari rumah"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <Filter className="h-3.5 w-3.5 text-amber-400" />
            <span>Filter Pencarian</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ListingKind | 'all')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            >
              <option value="all">Sewa &amp; Beli</option>
              <option value="rent">Disewa Saja</option>
              <option value="sale">Dijual Saja</option>
            </select>

            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType | 'all')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            >
              {(Object.keys(TYPE_LABELS) as Array<PropertyType | 'all'>).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            <select
              value={areaTag}
              onChange={(e) => setAreaTag(e.target.value as AreaTag | 'all')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            >
              {(Object.keys(AREA_LABELS) as Array<AreaTag | 'all'>).map((a) => (
                <option key={a} value={a}>
                  {AREA_LABELS[a]}
                </option>
              ))}
            </select>

            <select
              value={stationTier}
              onChange={(e) => setStationTier(e.target.value as 'all' | 'dekat' | 'sedang' | 'jauh')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            >
              <option value="all">Jarak Stasiun</option>
              <option value="dekat">Dekat (&le;38m)</option>
              <option value="sedang">Sedang (&le;75m)</option>
              <option value="jauh">Tenang (&gt;75m)</option>
            </select>

            <input
              type="number"
              placeholder="Maks Harga (Rp)"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 placeholder:text-slate-500"
            />

            <select
              value={minRooms}
              onChange={(e) => setMinRooms(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            >
              <option value={1}>Min 1 Kamar</option>
              <option value={2}>Min 2 Kamar</option>
              <option value={3}>Min 3 Kamar</option>
              <option value={4}>Min 4 Kamar</option>
            </select>

            <select
              value={minCondition}
              onChange={(e) => setMinCondition(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            >
              <option value={0}>Semua Kondisi</option>
              <option value={70}>Kondisi &ge;70%</option>
              <option value={85}>Kondisi &ge;85%</option>
              <option value={95}>Prima &ge;95%</option>
            </select>
          </div>
        </div>

        {/* Main Content: Minimap + Listing List */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 flex-1 overflow-hidden">
          {/* Minimap Peta Hunian */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-sky-400" /> Peta Listing Cicalengka
              </span>
              <div className="flex items-center gap-2 text-[10px] font-normal text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-teal-400" /> Sewa
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Jual
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-400" /> Kamu
                </span>
              </div>
            </div>

            <div className="relative flex-1 min-h-[190px] rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Rel Kereta dari cicalengka.layout.json */}
                {minimapRails.map((rail) => {
                  const pt = toSvgCoord(rail.ballast.minX, rail.ballast.minZ);
                  const sz = toSvgSize(rail.ballast.width, rail.ballast.depth);
                  return (
                    <rect
                      key={rail.railId}
                      x={pt.cx}
                      y={pt.cy}
                      width={sz.width}
                      height={sz.height}
                      fill="#78350f"
                      opacity="0.8"
                    />
                  );
                })}

                {/* Jaringan Jalan Ortogonal dari cicalengka.layout.json */}
                {minimapRoads.map((rg, idx) => {
                  const pt = toSvgCoord(rg.asphalt.minX, rg.asphalt.minZ);
                  const sz = toSvgSize(rg.asphalt.width, rg.asphalt.depth);
                  return (
                    <rect
                      key={`${rg.roadId}-${idx}`}
                      x={pt.cx}
                      y={pt.cy}
                      width={sz.width}
                      height={sz.height}
                      fill={rg.hierarchy === 'arteri' ? '#475569' : '#334155'}
                    />
                  );
                })}

                {/* Alun-Alun dari layout JSON */}
                {(() => {
                  const p = LAYOUT_DATA.plaza;
                  const topLeft = toSvgCoord(p.center.x - p.width / 2, p.center.z - p.depth / 2);
                  const sz = toSvgSize(p.width, p.depth);
                  return (
                    <rect
                      x={topLeft.cx}
                      y={topLeft.cy}
                      width={sz.width}
                      height={sz.height}
                      rx="2"
                      fill="#166534"
                      opacity="0.7"
                    />
                  );
                })()}

                {/* Landmark penting */}
                {[
                  { label: 'Stasiun', ...TICKET_BOOTH_POS.cicalengka, color: '#38bdf8' },
                  { label: 'Alun2', ...ALUN_ALUN_POS, color: '#a3e635' },
                  { label: 'Pasar', ...PASAR_POS, color: '#fb923c' },
                  { ...TOKO_MEBEL_POS, label: 'Mebel', color: '#facc15' },
                  { ...PENAMPUNGAN_POS, label: 'Tampung', color: '#94a3b8' },
                ].map((lm) => {
                  const pt = toSvgCoord(lm.x, lm.z);
                  return (
                    <g key={lm.label}>
                      <rect x={pt.cx - 3} y={pt.cy - 3} width="6" height="6" rx="1" fill={lm.color} opacity="0.8" />
                      <text x={pt.cx} y={pt.cy - 5} fontSize="5" fill="#cbd5e1" textAnchor="middle">
                        {lm.label}
                      </text>
                    </g>
                  );
                })}

                {/* Penanda Listing Aktif */}
                {filteredListings.map((l) => {
                  const prop = propertyById.get(l.propertyId);
                  const pos = l.position ?? prop?.position;
                  if (!pos) return null;
                  const pt = toSvgCoord(pos.x, pos.z);
                  const selected = selectedMapListingId === l.id;
                  return (
                    <g
                      key={l.id}
                      onClick={() => setSelectedMapListingId(l.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.cx}
                        cy={pt.cy}
                        r={selected ? 5.5 : 3.8}
                        fill={l.kind === 'rent' ? '#14b8a6' : '#f59e0b'}
                        stroke="#ffffff"
                        strokeWidth={selected ? 1.5 : 0.7}
                      />
                    </g>
                  );
                })}

                {/* Posisi Pemain */}
                <circle
                  cx={playerSvg.cx}
                  cy={playerSvg.cy}
                  r="4.5"
                  fill="#0ea5e9"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </svg>
            </div>

            {/* Pin Info Singkat */}
            {selectedMapListingId && (() => {
              const sel = filteredListings.find((x) => x.id === selectedMapListingId);
              if (!sel) return null;
              const prop = propertyById.get(sel.propertyId);
              const dist = prop
                ? Math.round(distance2D(playerPos.x, playerPos.z, prop.position.x, prop.position.z))
                : null;
              return (
                <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900 p-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{sel.propertyName}</div>
                    <div className="text-[10px] text-slate-400">
                      {sel.kind === 'rent' ? 'Sewa' : 'Jual'} {formatRupiah(sel.price)}
                      {dist !== null ? ` · ${dist}m darimu` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openListingProperty(sel)}
                    className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    Detail
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Daftar Listing Terpaginasi */}
          <div className="lg:col-span-7 overflow-y-auto pr-1 space-y-2">
            {loading && visibleListings.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">Memuat daftar properti...</div>
            ) : visibleListings.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Tidak ada listing properti yang cocok dengan filter ini.
              </div>
            ) : (
              visibleListings.map((l) => {
                const prop = propertyById.get(l.propertyId);
                const distFromMe = prop
                  ? Math.round(distance2D(playerPos.x, playerPos.z, prop.position.x, prop.position.z))
                  : null;
                const stationDist =
                  l.stationDistanceMeters ??
                  (prop
                    ? Math.round(
                        distance2D(
                          prop.position.x,
                          prop.position.z,
                          TICKET_BOOTH_POS.cicalengka.x,
                          TICKET_BOOTH_POS.cicalengka.z
                        )
                      )
                    : 60);

                return (
                  <div
                    key={l.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-700 transition"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            l.kind === 'rent'
                              ? 'bg-teal-500/20 text-teal-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {l.kind === 'rent' ? 'Disewa' : 'Dijual'}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                          {TYPE_LABELS[l.propertyType]}
                        </span>
                        <span className="text-xs font-bold text-white truncate">{l.propertyName}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3 text-slate-500" /> {l.rooms} Kamar
                        </span>
                        <span>Kondisi {Math.round(l.condition)}%</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-slate-500" /> {AREA_LABELS[l.areaTag]}
                        </span>
                        <span>{stationDist}m ke Stasiun</span>
                        {distFromMe !== null && (
                          <span className="flex items-center gap-0.5 text-sky-300">
                            <Navigation className="h-3 w-3" /> {distFromMe}m darimu
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500">
                        Pemilik: {l.ownerName} ({l.ownerType === 'npc' ? 'Agen/NPC' : 'Pemain'}) ·{' '}
                        {l.kind === 'rent' ? `Deposit ${formatRupiah(l.deposit)}` : 'Hak Milik Tunai'}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-emerald-300">
                          {formatRupiah(l.price)}
                        </div>
                        {l.kind === 'rent' && <div className="text-[10px] text-slate-500">/ minggu</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => openListingProperty(l)}
                        className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95"
                      >
                        <span>Lihat</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {canLoadMore && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (useLocal) setLocalPage((p) => p + 1);
                  else void loadFirestorePage(false, cursor);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? 'Memuat...' : 'Muat Listing Lainnya'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
