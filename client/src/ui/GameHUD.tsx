import React, { useEffect, useState } from 'react';
import {
  BarChart2,
  BedDouble,
  Briefcase,
  Car,
  Compass,
  FileCheck2,
  Fuel,
  Gavel,
  HardHat,
  Landmark,
  LayoutGrid,
  MapPin,
  Receipt,
  Scale,
  ScrollText,
  Shield,
  ShieldAlert,
  Store,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { GameClockInfo } from '../firebase/gameTime';
import { formatRupiah } from '../firebase/gameTime';
import type { CharacterDoc, ComputedStats, ZoneId } from '../types/game';
import type { InteractionMenuId } from '../world3d/interactions/registry';
import { ActionTileIcon, StatusTileIcon } from './GameIcons';
import { useViewportMode } from './useViewportMode';

export type HudMenuDistanceMap = Partial<
  Record<
    InteractionMenuId,
    { distanceMeters: number | null; inRange: boolean; requiresTrain: boolean }
  >
>;

interface GameHUDProps {
  character: CharacterDoc;
  stats: ComputedStats;
  clock: GameClockInfo;
  serverNowMs: number;
  onlineCount: number;
  unpaidBillsCount: number;
  housingNotifCount: number;
  businessNotifCount?: number;
  auctionNotifCount?: number;
  wantedLevel?: number;
  isJailed?: boolean;
  sentenceRemainingSec?: number;
  activeQuestsCount?: number;
  menuDistances?: HudMenuDistanceMap;
  onOpenJobs: () => void;
  onOpenProfileFinance: (tab?: 'profile' | 'bills' | 'tx') => void;
  onOpenTrain: () => void;
  onOpenCourses: () => void;
  onOpenClinic: () => void;
  onOpenHouseSearch: () => void;
  onOpenMyProperty: () => void;
  onOpenOffers: () => void;
  onOpenBank: () => void;
  onOpenBusiness: () => void;
  onOpenMarketplace: () => void;
  onOpenAuction: () => void;
  onOpenEconomy: () => void;
  onOpenLaw?: () => void;
  onOpenPolice?: () => void;
  onOpenQuests?: () => void;
  onOpenMortgageSecurity?: () => void;
  onOpenLandConstruction?: () => void;
  onOpenAgentDeveloper?: () => void;
  ownedVehiclesCount?: number;
  vehicleNotifCount?: number;
  onOpenVehiclesGarage?: () => void;
  onOpenDealer?: () => void;
  onOpenSpbu?: () => void;
  onOpenWorkshop?: () => void;
  onOpenSamsatSim?: () => void;
  onWakeSleep: () => void;
  onOpenSettings: () => void;
  canUseDrone?: boolean;
  anyModalOpen?: boolean;
  onToggleDrone?: () => void;
}

const ZONE_LABELS: Record<ZoneId, string> = {
  cicalengka: 'Cicalengka',
  rancaekek: 'Rancaekek',
  bandung: 'Bandung',
  nagreg: 'Nagreg',
};

export const GameHUD: React.FC<GameHUDProps> = ({
  character,
  stats,
  clock,
  serverNowMs,
  onlineCount,
  unpaidBillsCount,
  housingNotifCount,
  businessNotifCount = 0,
  auctionNotifCount = 0,
  wantedLevel = 0,
  isJailed = false,
  sentenceRemainingSec = 0,
  activeQuestsCount = 0,
  menuDistances,
  onOpenJobs,
  onOpenProfileFinance,
  onOpenTrain,
  onOpenCourses,
  onOpenClinic,
  onOpenHouseSearch,
  onOpenMyProperty,
  onOpenOffers,
  onOpenBank,
  onOpenBusiness,
  onOpenMarketplace,
  onOpenAuction,
  onOpenEconomy,
  onOpenLaw,
  onOpenPolice,
  onOpenQuests,
  onOpenMortgageSecurity,
  onOpenLandConstruction,
  onOpenAgentDeveloper,
  ownedVehiclesCount = 0,
  vehicleNotifCount = 0,
  onOpenVehiclesGarage,
  onOpenDealer,
  onOpenSpbu,
  onOpenWorkshop,
  onOpenSamsatSim,
  onWakeSleep,
  onOpenSettings,
  canUseDrone = true,
  anyModalOpen = false,
  onToggleDrone,
}) => {
  const { isCompactHud, isMobileLandscape } = useViewportMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPoliceOfficer = character.currentJob?.jobId === 'polisi';

  useEffect(() => {
    if (anyModalOpen) {
      setMenuOpen(false);
    }
  }, [anyModalOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (e.code === 'Escape' && menuOpen) {
        setMenuOpen(false);
      } else if (e.code === 'KeyM' && !isCompactHud && !anyModalOpen) {
        setMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, isCompactHud, anyModalOpen]);

  const zone = (character.currentZone || 'cicalengka') as ZoneId;
  const clinicWait = character.activeClinic
    ? Math.max(0, Math.ceil((character.activeClinic.completesAtMs - serverNowMs) / 1000))
    : 0;
  const courseWait = character.activeCourse
    ? Math.max(0, Math.ceil((character.activeCourse.completesAtMs - serverNowMs) / 1000))
    : 0;
  const sleepWait = character.activeSleep
    ? Math.max(0, Math.ceil((character.activeSleep.completesAtMs - serverNowMs) / 1000))
    : 0;

  const totalNotifCount =
    unpaidBillsCount +
    housingNotifCount +
    businessNotifCount +
    auctionNotifCount +
    vehicleNotifCount +
    (isJailed ? 1 : 0);

  const runMenuAction = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const getDistanceTag = (menuId: InteractionMenuId): string | undefined => {
    const info = menuDistances?.[menuId];
    if (!info || info.inRange) return undefined;
    if (info.requiresTrain) return 'di lokasi · Stasiun';
    if (info.distanceMeters !== null) return `di lokasi · ${info.distanceMeters}m`;
    return 'di lokasi';
  };

  const getDesktopDistanceTag = (
    menuId: InteractionMenuId
  ): { text: string; inRange: boolean } | undefined => {
    const info = menuDistances?.[menuId];
    if (!info) return undefined;
    if (info.inRange) return { text: 'Di Lokasi', inRange: true };
    if (info.requiresTrain) return { text: 'Stasiun', inRange: false };
    if (info.distanceMeters !== null) return { text: `${info.distanceMeters}m`, inRange: false };
    return { text: 'Lokasi', inRange: false };
  };

  const statusBanners = (
    <>
      {character.activeSleep && (
        <button
          type="button"
          onClick={onWakeSleep}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-[#7BC4EB]/70 bg-[#161E38]/92 px-3 py-1.5 text-[11px] font-bold text-[#FFFDF8] shadow-lg hover:bg-[#222C4D]"
        >
          <BedDouble className="h-3.5 w-3.5 text-[#7BC4EB] shrink-0" />
          <span>
            {sleepWait > 0
              ? `Tidur di ${character.activeSleep.label} (${sleepWait}d) — Klik untuk bangun lebih awal`
              : `Sudah cukup tidur di ${character.activeSleep.label}! Klik untuk bangun`}
          </span>
        </button>
      )}

      {character.activeClinic && (
        <button
          type="button"
          onClick={onOpenClinic}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-[#86C76D]/70 bg-[#161E38]/92 px-3 py-1 text-[11px] font-semibold text-[#86C76D] shadow-lg"
        >
          <ActionTileIcon kind="visit_clinic" className="h-4 w-4 shrink-0" />
          <span>
            {clinicWait > 0
              ? `Antrean ${character.activeClinic.clinicName}: ${clinicWait}d`
              : `Klinik siap diklaim! Klik untuk pulihkan kesehatan`}
          </span>
        </button>
      )}

      {character.activeCourse && (
        <button
          type="button"
          onClick={onOpenCourses}
          className="pointer-events-auto rounded-xl border border-[#F7D166]/60 bg-[#161E38]/92 px-3 py-1 text-[11px] font-semibold text-[#F7D166] shadow-lg"
        >
          {courseWait > 0
            ? `Kursus ${character.activeCourse.title}: ${courseWait}d`
            : `Kursus selesai! Klik untuk klaim +${character.activeCourse.skillGain} skill`}
        </button>
      )}

      {isJailed && onOpenLaw && (
        <button
          type="button"
          onClick={onOpenLaw}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-rose-400/80 bg-rose-950/92 px-3 py-1.5 text-[11px] font-bold text-rose-100 shadow-lg hover:bg-rose-900"
        >
          <Scale className="h-3.5 w-3.5 text-rose-300 shrink-0" />
          <span className="font-mono tabular-nums">
            Tahanan Polsek: {Math.floor(sentenceRemainingSec / 60)}:
            {String(sentenceRemainingSec % 60).padStart(2, '0')} — Klik untuk Kerja/Banding/Jaminan
          </span>
        </button>
      )}

      {!isJailed && wantedLevel > 0 && onOpenLaw && (
        <button
          type="button"
          onClick={onOpenLaw}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-amber-400/70 bg-[#161E38]/92 px-3 py-1 text-[11px] font-bold text-amber-300 shadow-lg"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span className="font-mono tabular-nums">
            Status Buronan (Wanted {Math.round(wantedLevel)}) — Klik untuk Bayar Denda
          </span>
        </button>
      )}

      {stats.isCritical && (
        <div className="pointer-events-auto rounded-xl border border-[#EC7C70]/80 bg-[#5C1F22]/92 px-3 py-1 text-[11px] font-semibold text-[#FFFDF8] shadow-lg">
          Status kritis! Kesehatan turun — segera makan, istirahat, mandi, atau ke Klinik!
        </div>
      )}
    </>
  );

  return (
    <>
      <div
        className={`pointer-events-none fixed left-2 right-2 sm:left-3 sm:right-3 z-20 flex flex-col ${
          isMobileLandscape ? 'top-1.5 gap-1' : 'top-2 gap-1.5'
        }`}
      >
        <div
          className={`flex justify-between ${
            isCompactHud ? 'items-stretch gap-1.5' : 'items-start gap-3'
          }`}
        >
          {/* Kiri: Profil, Uang, 6 Status Bertahan Hidup */}
          <div
            className={`pointer-events-auto min-w-0 rounded-2xl bg-[#161E38]/82 backdrop-blur-md border border-[#F5EFE0]/25 shadow-xl ${
              isMobileLandscape
                ? 'flex-1 max-w-[460px] px-2.5 py-1 flex flex-col justify-center'
                : isCompactHud
                  ? 'flex-1 px-2.5 py-1.5'
                  : 'w-[264px] md:w-[300px] lg:w-[344px] shrink-0 px-3 py-2'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className={`font-bold text-[#FFFDF8] truncate ${
                    isCompactHud ? 'text-[11px]' : 'text-xs'
                  }`}
                >
                  {character.name}
                </span>
                {(!isCompactHud || isMobileLandscape) && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-200 shrink-0">
                    <MapPin className="h-2.5 w-2.5 text-sky-300" />
                    {ZONE_LABELS[zone]}
                  </span>
                )}
                {character.homeless && !isCompactHud && (
                  <span className="text-[10px] font-bold text-[#EC7C70] shrink-0 hidden lg:inline">
                    · Tanpa Rumah
                  </span>
                )}
              </div>
              <span
                className={`flex items-center gap-1 font-bold text-[#FFFDF8] shrink-0 font-mono tabular-nums ${
                  isCompactHud ? 'text-[11px]' : 'text-xs'
                }`}
              >
                <StatusTileIcon
                  kind="money"
                  className={isCompactHud ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0'}
                />
                {formatRupiah(character.money)}
              </span>
            </div>

            <div
              className={
                isMobileLandscape
                  ? 'mt-1 grid grid-cols-6 gap-1.5'
                  : isCompactHud
                    ? 'mt-1 grid grid-cols-6 gap-1'
                    : 'mt-1.5 grid grid-cols-3 gap-x-2.5 gap-y-1.5'
              }
            >
              <StatBar
                icon={
                  <StatusTileIcon
                    kind="health"
                    className={isCompactHud ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  />
                }
                label="Sehat"
                value={stats.health}
                compact={isCompactHud}
                landscape={isMobileLandscape}
                trackClass="bg-[#2E4D6B]"
                colorClass={stats.health <= 25 ? 'bg-[#EC7C70]' : 'bg-[#4B96E8]'}
              />
              <StatBar
                icon={
                  <StatusTileIcon
                    kind="hunger"
                    className={isCompactHud ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  />
                }
                label="Lapar"
                value={stats.hunger}
                compact={isCompactHud}
                landscape={isMobileLandscape}
                trackClass="bg-[#52392B]"
                colorClass={stats.hunger <= 20 ? 'bg-[#EC7C70]' : 'bg-[#F39A68]'}
              />
              <StatBar
                icon={
                  <StatusTileIcon
                    kind="thirst"
                    className={isCompactHud ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  />
                }
                label="Haus"
                value={stats.thirst}
                compact={isCompactHud}
                landscape={isMobileLandscape}
                trackClass="bg-[#284B63]"
                colorClass={stats.thirst <= 20 ? 'bg-[#EC7C70]' : 'bg-[#5EB3D6]'}
              />
              <StatBar
                icon={
                  <StatusTileIcon
                    kind="energy"
                    className={isCompactHud ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  />
                }
                label="Energi"
                value={stats.energy}
                compact={isCompactHud}
                landscape={isMobileLandscape}
                trackClass="bg-[#2E5D38]"
                colorClass={stats.energy <= 20 ? 'bg-[#EC7C70]' : 'bg-[#56C25E]'}
              />
              <StatBar
                icon={
                  <StatusTileIcon
                    kind="hygiene"
                    className={isCompactHud ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  />
                }
                label="Bersih"
                value={stats.hygiene}
                compact={isCompactHud}
                landscape={isMobileLandscape}
                trackClass="bg-[#34546B]"
                colorClass={stats.hygiene <= 20 ? 'bg-[#EC7C70]' : 'bg-[#7BC4EB]'}
              />
              <StatBar
                icon={
                  <StatusTileIcon
                    kind="mood"
                    className={isCompactHud ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
                  />
                }
                label="Mood"
                value={stats.mood}
                compact={isCompactHud}
                landscape={isMobileLandscape}
                trackClass="bg-[#274F4D]"
                colorClass={stats.mood <= 25 ? 'bg-[#EC7C70]' : 'bg-[#F7D166]'}
              />
            </div>
          </div>

          {/* Tengah Desktop Lebar: Banner Status Aktif agar tidak menumpuk di sisi kiri/kanan */}
          {!isCompactHud && (
            <div className="hidden xl:flex flex-1 min-w-0 flex-wrap items-start justify-center gap-1.5 pt-0.5">
              {statusBanners}
            </div>
          )}

          {/* Kanan: Jam, Tombol Menu Kota, Drone & Pengaturan */}
          <div
            className={`pointer-events-auto flex items-center shrink-0 ${
              isCompactHud ? 'gap-1' : 'gap-1.5 ml-auto'
            }`}
          >
            <div
              className={`rounded-2xl bg-[#161E38]/82 backdrop-blur-md border border-[#F5EFE0]/25 shadow-xl flex items-center h-11 ${
                isCompactHud ? 'px-2 py-1 gap-1.5' : 'px-2.5 lg:px-3 py-1 gap-2'
              }`}
            >
              <StatusTileIcon
                kind="clock"
                className={isCompactHud ? 'h-6 w-6 shrink-0' : 'h-7 w-7 shrink-0'}
              />
              <div className="text-right leading-tight">
                <div
                  className={`flex items-center justify-end gap-1 font-bold text-[#FFFDF8] font-mono tabular-nums ${
                    isCompactHud ? 'text-[11px]' : 'text-xs'
                  }`}
                >
                  <span>{clock.formattedTime}</span>
                  {!isCompactHud && (
                    <span className="hidden lg:inline font-sans text-[10px] font-medium text-slate-300">
                      ({clock.phaseLabel})
                    </span>
                  )}
                </div>
                <div
                  className={`flex items-center justify-end text-slate-300 ${
                    isCompactHud ? 'gap-1.5 text-[9px]' : 'gap-2 text-[10px]'
                  }`}
                >
                  <span>H{clock.dayNumber}</span>
                  <span className="flex items-center gap-0.5 text-[#86C76D] font-semibold font-mono tabular-nums">
                    <Users className={isCompactHud ? 'h-2.5 w-2.5' : 'h-3 w-3'} /> {onlineCount}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className={`relative h-11 rounded-2xl backdrop-blur-md border flex items-center justify-center gap-1.5 shadow-xl active:scale-95 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCompactHud ? 'w-11' : 'px-3 text-xs font-semibold'
              } ${
                menuOpen
                  ? 'bg-[#3BA9A4] border-[#7ECBA1] text-[#161E38]'
                  : 'bg-[#161E38]/85 border-[#F5EFE0]/25 text-[#FFFDF8] hover:bg-[#161E38]'
              }`}
              aria-label={menuOpen ? 'Tutup menu kota' : 'Buka menu kota'}
              aria-expanded={menuOpen}
              title={isCompactHud ? 'Menu Kota' : 'Buka Menu Kota (Tombol M)'}
            >
              {menuOpen ? (
                <X className={isCompactHud ? 'h-5 w-5 shrink-0' : 'h-4 w-4 shrink-0'} />
              ) : (
                <LayoutGrid
                  className={`${isCompactHud ? 'h-5 w-5' : 'h-4 w-4'} ${
                    menuOpen ? 'text-[#161E38]' : 'text-[#F7D166]'
                  } shrink-0`}
                />
              )}
              {!isCompactHud && (
                <span>
                  Menu<span className="hidden lg:inline"> Kota</span>
                </span>
              )}
              {!menuOpen && totalNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EC7C70] border border-[#161E38] text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                  {totalNotifCount > 9 ? '9+' : totalNotifCount}
                </span>
              )}
            </button>

            {canUseDrone && onToggleDrone && (!isCompactHud || isMobileLandscape) && (
              <button
                type="button"
                onClick={onToggleDrone}
                className={`h-11 rounded-2xl bg-[#161E38]/82 backdrop-blur-md border border-[#7BC4EB]/50 flex items-center gap-1.5 font-semibold text-[#FFFDF8] hover:bg-[#161E38] shadow-xl whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                  isMobileLandscape ? 'px-2.5 text-[11px]' : 'px-2.5 lg:px-3 text-xs'
                }`}
                title="Lihat kota dari udara (Tombol V)"
                aria-label="Aktifkan Drone View Kota"
              >
                <Compass className="h-4 w-4 text-[#7BC4EB] shrink-0" />
                <span>
                  Drone<span className="hidden lg:inline"> Kota</span>
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenSettings}
              className="h-11 w-11 rounded-2xl bg-[#161E38]/82 backdrop-blur-md border border-[#F5EFE0]/25 flex items-center justify-center hover:bg-[#161E38] shadow-xl active:scale-95 shrink-0 cursor-pointer"
              aria-label="Pengaturan"
              title="Pengaturan"
            >
              <ActionTileIcon kind="settings" className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Banner Status Antrean Klinik / Kursus / Tidur Aktif (Mobile & Desktop < xl) */}
        <div
          className={`flex flex-wrap justify-center gap-1.5 ${
            isCompactHud ? '' : 'xl:hidden'
          }`}
        >
          {statusBanners}
        </div>
      </div>

      {/* Panel Menu Kota Desktop (Terorganisir 4 Kategori, Non-Overlapping) */}
      {menuOpen && !isCompactHud && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px]"
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Menu Kecamatan Cicalengka"
            className="fixed top-[64px] right-3 z-40 w-[min(740px,calc(100vw-1.5rem))] max-h-[calc(100dvh-82px)] overflow-y-auto rounded-2xl border border-[#F5EFE0]/25 bg-[#161E38]/96 backdrop-blur-md p-4 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-sky-300 shrink-0" />
                <h2 className="text-sm font-bold text-[#FFFDF8] truncate">
                  Menu {ZONE_LABELS[zone]}
                </h2>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  · Tekan Esc untuk menutup
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-300 hover:bg-white/20 hover:text-white cursor-pointer"
                aria-label="Tutup menu kota"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Kategori 1: Karier & Perjalanan */}
            <section>
              <h3 className="mb-2 text-[11px] font-semibold text-slate-400">
                Karier, Kursus &amp; Transportasi
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DesktopMenuTile
                  icon={<ActionTileIcon kind="work" className="h-5 w-5 shrink-0" />}
                  label={character.currentJob ? character.currentJob.title.split(' ')[0] : 'Kerja'}
                  distanceInfo={getDesktopDistanceTag('jobs')}
                  onClick={() => runMenuAction(onOpenJobs)}
                />
                <DesktopMenuTile
                  icon={<ActionTileIcon kind="apply_job" className="h-5 w-5 shrink-0" />}
                  label="Kursus"
                  distanceInfo={getDesktopDistanceTag('courses')}
                  onClick={() => runMenuAction(onOpenCourses)}
                />
                <DesktopMenuTile
                  icon={<ActionTileIcon kind="ride_train" className="h-5 w-5 shrink-0" />}
                  label="Kereta"
                  distanceInfo={getDesktopDistanceTag('train')}
                  onClick={() => runMenuAction(onOpenTrain)}
                />
              </div>
            </section>

            {/* Kategori Kendaraan & Lalu Lintas */}
            {(onOpenVehiclesGarage || onOpenDealer || onOpenSpbu || onOpenWorkshop || onOpenSamsatSim) && (
              <section className="border-t border-white/10 pt-3">
                <h3 className="mb-2 text-[11px] font-semibold text-slate-400">
                  Kendaraan, Dealer &amp; Samsat
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {onOpenVehiclesGarage && (
                    <DesktopMenuTile
                      icon={<Car className="h-4 w-4 text-amber-300 shrink-0" />}
                      label="Garasi & SIM"
                      badge={vehicleNotifCount > 0 ? vehicleNotifCount : ownedVehiclesCount}
                      badgeTone={
                        vehicleNotifCount > 0
                          ? 'bg-[#EC7C70] text-white'
                          : 'bg-amber-400 text-slate-950'
                      }
                      accentClass="bg-amber-500/20 border-amber-400/45 hover:bg-amber-500/30"
                      onClick={() => runMenuAction(onOpenVehiclesGarage)}
                    />
                  )}
                  {onOpenDealer && (
                    <DesktopMenuTile
                      icon={<Car className="h-4 w-4 text-sky-300 shrink-0" />}
                      label="Dealer & Showroom"
                      distanceInfo={getDesktopDistanceTag('dealer')}
                      onClick={() => runMenuAction(onOpenDealer)}
                    />
                  )}
                  {onOpenSpbu && (
                    <DesktopMenuTile
                      icon={<Fuel className="h-4 w-4 text-rose-300 shrink-0" />}
                      label="SPBU & Cas EV"
                      distanceInfo={getDesktopDistanceTag('spbu')}
                      onClick={() => runMenuAction(onOpenSpbu)}
                    />
                  )}
                  {onOpenWorkshop && (
                    <DesktopMenuTile
                      icon={<Wrench className="h-4 w-4 text-sky-300 shrink-0" />}
                      label="Bengkel"
                      distanceInfo={getDesktopDistanceTag('workshop')}
                      onClick={() => runMenuAction(onOpenWorkshop)}
                    />
                  )}
                  {onOpenSamsatSim && (
                    <DesktopMenuTile
                      icon={<FileCheck2 className="h-4 w-4 text-emerald-300 shrink-0" />}
                      label="Samsat & SIM"
                      distanceInfo={getDesktopDistanceTag('samsat_sim')}
                      onClick={() => runMenuAction(onOpenSamsatSim)}
                    />
                  )}
                </div>
              </section>
            )}

            {/* Kategori 2: Hunian & Properti */}
            <section className="border-t border-white/10 pt-3">
              <h3 className="mb-2 text-[11px] font-semibold text-slate-400">
                Hunian &amp; Properti
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DesktopMenuTile
                  icon={<ActionTileIcon kind="map" className="h-5 w-5 shrink-0" />}
                  label="Cari Rumah"
                  accentClass="bg-[#3BA9A4]/25 border-[#7ECBA1]/45 hover:bg-[#3BA9A4]/40"
                  onClick={() => runMenuAction(onOpenHouseSearch)}
                />
                <DesktopMenuTile
                  icon={<ActionTileIcon kind="enter_house" className="h-5 w-5 shrink-0" />}
                  label="Hunian Saya"
                  onClick={() => runMenuAction(onOpenMyProperty)}
                />
                <DesktopMenuTile
                  icon={<ActionTileIcon kind="trade" className="h-5 w-5 shrink-0" />}
                  label="Tawaran"
                  badge={housingNotifCount}
                  badgeTone="bg-[#F7D166] text-slate-950"
                  onClick={() => runMenuAction(onOpenOffers)}
                />
                {onOpenLandConstruction && (
                  <DesktopMenuTile
                    icon={<HardHat className="h-4 w-4 text-amber-300 shrink-0" />}
                    label="Kavling & Bangun"
                    onClick={() => runMenuAction(onOpenLandConstruction)}
                  />
                )}
                {onOpenMortgageSecurity && (
                  <DesktopMenuTile
                    icon={<ShieldAlert className="h-4 w-4 text-amber-300 shrink-0" />}
                    label="KPR & Keamanan"
                    onClick={() => runMenuAction(onOpenMortgageSecurity)}
                  />
                )}
                {onOpenAgentDeveloper && (
                  <DesktopMenuTile
                    icon={<Briefcase className="h-4 w-4 text-teal-300 shrink-0" />}
                    label="Agen Properti"
                    distanceInfo={getDesktopDistanceTag('agent_developer')}
                    onClick={() => runMenuAction(onOpenAgentDeveloper)}
                  />
                )}
              </div>
            </section>

            {/* Kategori 3: Keuangan, Bisnis & Pasar */}
            <section className="border-t border-white/10 pt-3">
              <h3 className="mb-2 text-[11px] font-semibold text-slate-400">
                Keuangan, Bisnis &amp; Perdagangan
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DesktopMenuTile
                  icon={<Receipt className="h-4 w-4 text-[#86C76D] shrink-0" />}
                  label="Tagihan & Profil"
                  badge={unpaidBillsCount}
                  badgeTone="bg-[#EC7C70] text-white"
                  onClick={() =>
                    runMenuAction(() =>
                      onOpenProfileFinance(unpaidBillsCount > 0 ? 'bills' : 'profile')
                    )
                  }
                />
                <DesktopMenuTile
                  icon={<Landmark className="h-4 w-4 text-[#7BC4EB] shrink-0" />}
                  label="Bank & ATM"
                  distanceInfo={getDesktopDistanceTag('bank')}
                  onClick={() => runMenuAction(onOpenBank)}
                />
                <DesktopMenuTile
                  icon={<Store className="h-4 w-4 text-[#F7D166] shrink-0" />}
                  label="Bisnis"
                  badge={businessNotifCount}
                  badgeTone="bg-[#EC7C70] text-white"
                  accentClass="bg-[#E06B3B]/25 border-[#F7D166]/45 hover:bg-[#E06B3B]/40"
                  distanceInfo={getDesktopDistanceTag('business')}
                  onClick={() => runMenuAction(onOpenBusiness)}
                />
                <DesktopMenuTile
                  icon={<ActionTileIcon kind="buy" className="h-5 w-5 shrink-0" />}
                  label="Pasar P2P"
                  onClick={() => runMenuAction(onOpenMarketplace)}
                />
                <DesktopMenuTile
                  icon={<Gavel className="h-4 w-4 text-[#F0958D] shrink-0" />}
                  label="Balai Lelang"
                  badge={auctionNotifCount}
                  badgeTone="bg-[#EC7C70] text-white"
                  distanceInfo={getDesktopDistanceTag('auction')}
                  onClick={() => runMenuAction(onOpenAuction)}
                />
                <DesktopMenuTile
                  icon={<BarChart2 className="h-4 w-4 text-[#7BC4EB] shrink-0" />}
                  label="Ekonomi"
                  onClick={() => runMenuAction(onOpenEconomy)}
                />
              </div>
            </section>

            {/* Kategori 4: Warga & Hukum */}
            {(onOpenQuests || onOpenLaw || (isPoliceOfficer && onOpenPolice)) && (
              <section className="border-t border-white/10 pt-3">
                <h3 className="mb-2 text-[11px] font-semibold text-slate-400">
                  Warga &amp; Hukum
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {onOpenQuests && (
                    <DesktopMenuTile
                      icon={<ScrollText className="h-4 w-4 text-emerald-300 shrink-0" />}
                      label="Quest Warga"
                      badge={activeQuestsCount}
                      badgeTone="bg-emerald-500 text-slate-950"
                      onClick={() => runMenuAction(onOpenQuests)}
                    />
                  )}
                  {onOpenLaw && (
                    <DesktopMenuTile
                      icon={<Scale className="h-4 w-4 text-rose-300 shrink-0" />}
                      label={
                        isJailed
                          ? 'Tahanan'
                          : wantedLevel > 0
                            ? `Wanted ${Math.round(wantedLevel)}`
                            : 'Hukum & Polsek'
                      }
                      badge={wantedLevel > 0 || isJailed ? 1 : 0}
                      badgeTone="bg-rose-500 text-white"
                      accentClass={
                        wantedLevel > 0 || isJailed
                          ? 'bg-rose-500/25 border-rose-400/55 hover:bg-rose-500/35'
                          : undefined
                      }
                      distanceInfo={isJailed ? undefined : getDesktopDistanceTag('law')}
                      onClick={() => runMenuAction(onOpenLaw)}
                    />
                  )}
                  {isPoliceOfficer && onOpenPolice && (
                    <DesktopMenuTile
                      icon={<Shield className="h-4 w-4 text-sky-300 shrink-0" />}
                      label="Tugas Polisi"
                      accentClass="bg-sky-500/20 border-sky-400/45 hover:bg-sky-500/35"
                      onClick={() => runMenuAction(onOpenPolice)}
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {/* Drawer Grid Menu Kota untuk Mobile (Portrait & Landscape) */}
      {menuOpen && isCompactHud && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px]"
            aria-hidden="true"
          />
          <div
            className={`fixed left-2 right-2 z-40 rounded-2xl border border-[#F5EFE0]/25 bg-[#161E38]/95 backdrop-blur-md shadow-2xl overflow-y-auto ${
              isMobileLandscape
                ? 'top-[54px] mx-auto max-w-2xl p-2.5 max-h-[calc(100dvh-64px)]'
                : 'top-[66px] p-3 max-h-[75dvh]'
            }`}
          >
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#FFFDF8]">
                <MapPin className="h-3.5 w-3.5 text-sky-300" />
                <span>Menu {ZONE_LABELS[zone]}</span>
                {character.homeless && (
                  <span className="text-[10px] font-semibold text-[#EC7C70]">· Tanpa Rumah</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-300 hover:text-white"
                aria-label="Tutup menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className={`grid gap-1.5 ${
                isMobileLandscape ? 'grid-cols-6' : 'grid-cols-3'
              }`}
            >
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<ActionTileIcon kind="work" className="h-5 w-5 shrink-0" />}
                label={character.currentJob ? character.currentJob.title.split(' ')[0] : 'Kerja'}
                locationHint={getDistanceTag('jobs')}
                inRangeDot={Boolean(menuDistances?.jobs?.inRange)}
                onClick={() => runMenuAction(onOpenJobs)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<Receipt className="h-4 w-4 text-[#86C76D] shrink-0" />}
                label="Tagihan"
                badge={unpaidBillsCount}
                badgeTone="bg-[#EC7C70] text-white"
                onClick={() =>
                  runMenuAction(() =>
                    onOpenProfileFinance(unpaidBillsCount > 0 ? 'bills' : 'profile')
                  )
                }
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<ActionTileIcon kind="ride_train" className="h-5 w-5 shrink-0" />}
                label="Kereta"
                locationHint={getDistanceTag('train')}
                inRangeDot={Boolean(menuDistances?.train?.inRange)}
                onClick={() => runMenuAction(onOpenTrain)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<ActionTileIcon kind="apply_job" className="h-5 w-5 shrink-0" />}
                label="Kursus"
                locationHint={getDistanceTag('courses')}
                inRangeDot={Boolean(menuDistances?.courses?.inRange)}
                onClick={() => runMenuAction(onOpenCourses)}
              />
              {onOpenVehiclesGarage && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<Car className="h-4 w-4 text-amber-300 shrink-0" />}
                  label="Garasi"
                  badge={vehicleNotifCount > 0 ? vehicleNotifCount : ownedVehiclesCount}
                  badgeTone={
                    vehicleNotifCount > 0
                      ? 'bg-[#EC7C70] text-white'
                      : 'bg-amber-400 text-slate-950'
                  }
                  accentClass="bg-amber-500/25 border-amber-400/50"
                  onClick={() => runMenuAction(onOpenVehiclesGarage)}
                />
              )}
              {onOpenDealer && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<Car className="h-4 w-4 text-sky-300 shrink-0" />}
                  label="Dealer"
                  locationHint={getDistanceTag('dealer')}
                  inRangeDot={Boolean(menuDistances?.dealer?.inRange)}
                  onClick={() => runMenuAction(onOpenDealer)}
                />
              )}
              {onOpenSpbu && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<Fuel className="h-4 w-4 text-rose-300 shrink-0" />}
                  label="SPBU"
                  locationHint={getDistanceTag('spbu')}
                  inRangeDot={Boolean(menuDistances?.spbu?.inRange)}
                  onClick={() => runMenuAction(onOpenSpbu)}
                />
              )}
              {onOpenWorkshop && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<Wrench className="h-4 w-4 text-sky-300 shrink-0" />}
                  label="Bengkel"
                  locationHint={getDistanceTag('workshop')}
                  inRangeDot={Boolean(menuDistances?.workshop?.inRange)}
                  onClick={() => runMenuAction(onOpenWorkshop)}
                />
              )}
              {onOpenSamsatSim && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<FileCheck2 className="h-4 w-4 text-emerald-300 shrink-0" />}
                  label="Samsat"
                  locationHint={getDistanceTag('samsat_sim')}
                  inRangeDot={Boolean(menuDistances?.samsat_sim?.inRange)}
                  onClick={() => runMenuAction(onOpenSamsatSim)}
                />
              )}
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<ActionTileIcon kind="map" className="h-5 w-5 shrink-0" />}
                label="Cari Rumah"
                accentClass="bg-[#3BA9A4]/30 border-[#7ECBA1]/50"
                onClick={() => runMenuAction(onOpenHouseSearch)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<ActionTileIcon kind="enter_house" className="h-5 w-5 shrink-0" />}
                label="Hunian"
                onClick={() => runMenuAction(onOpenMyProperty)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<ActionTileIcon kind="trade" className="h-5 w-5 shrink-0" />}
                label="Tawaran"
                badge={housingNotifCount}
                badgeTone="bg-[#F7D166] text-slate-950"
                onClick={() => runMenuAction(onOpenOffers)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<Landmark className="h-4 w-4 text-[#7BC4EB] shrink-0" />}
                label="Bank"
                locationHint={getDistanceTag('bank')}
                inRangeDot={Boolean(menuDistances?.bank?.inRange)}
                onClick={() => runMenuAction(onOpenBank)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<Store className="h-4 w-4 text-[#F7D166] shrink-0" />}
                label="Bisnis"
                badge={businessNotifCount}
                badgeTone="bg-[#EC7C70] text-white"
                accentClass="bg-[#E06B3B]/30 border-[#F7D166]/45"
                locationHint={getDistanceTag('business')}
                inRangeDot={Boolean(menuDistances?.business?.inRange)}
                onClick={() => runMenuAction(onOpenBusiness)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<ActionTileIcon kind="buy" className="h-5 w-5 shrink-0" />}
                label="Pasar P2P"
                onClick={() => runMenuAction(onOpenMarketplace)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<Gavel className="h-4 w-4 text-[#F0958D] shrink-0" />}
                label="Lelang"
                badge={auctionNotifCount}
                badgeTone="bg-[#EC7C70] text-white"
                locationHint={getDistanceTag('auction')}
                inRangeDot={Boolean(menuDistances?.auction?.inRange)}
                onClick={() => runMenuAction(onOpenAuction)}
              />
              <MobileMenuTile
                compact={isMobileLandscape}
                icon={<BarChart2 className="h-4 w-4 text-[#7BC4EB] shrink-0" />}
                label="Ekonomi"
                onClick={() => runMenuAction(onOpenEconomy)}
              />
              {onOpenLaw && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<Scale className="h-4 w-4 text-rose-300 shrink-0" />}
                  label={isJailed ? 'Tahanan' : 'Hukum'}
                  badge={wantedLevel > 0 || isJailed ? 1 : 0}
                  badgeTone="bg-rose-500 text-white"
                  accentClass={
                    wantedLevel > 0 || isJailed
                      ? 'bg-rose-500/25 border-rose-400/50'
                      : 'bg-white/10 border-white/15'
                  }
                  locationHint={isJailed ? undefined : getDistanceTag('law')}
                  inRangeDot={!isJailed && Boolean(menuDistances?.law?.inRange)}
                  onClick={() => runMenuAction(onOpenLaw)}
                />
              )}
              {isPoliceOfficer && onOpenPolice && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<Shield className="h-4 w-4 text-sky-300 shrink-0" />}
                  label="Polisi"
                  accentClass="bg-sky-500/25 border-sky-400/50"
                  onClick={() => runMenuAction(onOpenPolice)}
                />
              )}
              {onOpenQuests && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<ScrollText className="h-4 w-4 text-emerald-300 shrink-0" />}
                  label="Quest"
                  badge={activeQuestsCount}
                  badgeTone="bg-emerald-500 text-slate-950"
                  onClick={() => runMenuAction(onOpenQuests)}
                />
              )}
              {onOpenLandConstruction && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<HardHat className="h-4 w-4 text-amber-300 shrink-0" />}
                  label="Kavling"
                  onClick={() => runMenuAction(onOpenLandConstruction)}
                />
              )}
              {onOpenMortgageSecurity && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<ShieldAlert className="h-4 w-4 text-amber-300 shrink-0" />}
                  label="KPR & Aman"
                  onClick={() => runMenuAction(onOpenMortgageSecurity)}
                />
              )}
              {onOpenAgentDeveloper && (
                <MobileMenuTile
                  compact={isMobileLandscape}
                  icon={<Briefcase className="h-4 w-4 text-teal-300 shrink-0" />}
                  label="Agen"
                  locationHint={getDistanceTag('agent_developer')}
                  inRangeDot={Boolean(menuDistances?.agent_developer?.inRange)}
                  onClick={() => runMenuAction(onOpenAgentDeveloper)}
                />
              )}
            </div>

            {canUseDrone && onToggleDrone && !isMobileLandscape && (
              <button
                type="button"
                onClick={() => runMenuAction(onToggleDrone)}
                className="mt-2 w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-sky-500/20 border border-[#7BC4EB]/50 px-3 py-2 text-xs font-semibold text-[#FFFDF8] active:scale-[0.98]"
              >
                <Compass className="h-4 w-4 text-[#7BC4EB]" />
                <span>Lihat Kota dari Udara (Mode Drone)</span>
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
};

const DesktopMenuTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeTone?: string;
  accentClass?: string;
  distanceInfo?: { text: string; inRange: boolean };
  onClick: () => void;
}> = ({
  icon,
  label,
  badge = 0,
  badgeTone = 'bg-[#EC7C70] text-white',
  accentClass = 'bg-white/10 border-white/15 hover:bg-white/20',
  distanceInfo,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-[44px] flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-[#FFFDF8] transition-colors cursor-pointer ${accentClass}`}
  >
    <span className="flex items-center gap-2 min-w-0">
      {icon}
      <span className="whitespace-nowrap truncate">{label}</span>
    </span>
    <span className="flex items-center gap-1.5 shrink-0">
      {distanceInfo && (
        <span
          className={`text-[10px] font-mono tabular-nums whitespace-nowrap ${
            distanceInfo.inRange ? 'text-[#7ECBA1] font-semibold' : 'text-amber-300/95'
          }`}
        >
          {distanceInfo.text}
        </span>
      )}
      {badge > 0 && (
        <span
          className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${badgeTone}`}
        >
          {badge}
        </span>
      )}
    </span>
  </button>
);

const MobileMenuTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  compact?: boolean;
  badge?: number;
  badgeTone?: string;
  accentClass?: string;
  locationHint?: string;
  inRangeDot?: boolean;
  onClick: () => void;
}> = ({
  icon,
  label,
  compact = false,
  badge = 0,
  badgeTone = 'bg-[#EC7C70] text-white',
  accentClass = 'bg-white/10 border-white/15',
  locationHint,
  inRangeDot = false,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 font-semibold text-[#FFFDF8] hover:bg-white/20 active:scale-95 transition-transform ${
      compact ? 'min-h-[44px] py-1.5 text-[10px]' : 'min-h-[48px] py-2 text-[11px]'
    } ${accentClass}`}
  >
    {icon}
    <span className="truncate max-w-full leading-tight">{label}</span>
    {locationHint && (
      <span className="text-[8.5px] font-normal leading-none text-amber-300 font-mono truncate max-w-full">
        {locationHint}
      </span>
    )}
    {!locationHint && inRangeDot && (
      <span className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
    )}
    {badge > 0 && (
      <span
        className={`absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center tabular-nums ${badgeTone}`}
      >
        {badge}
      </span>
    )}
  </button>
);

const StatBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  compact: boolean;
  landscape: boolean;
  trackClass: string;
  colorClass: string;
}> = ({ icon, label, value, compact, landscape, trackClass, colorClass }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={
        landscape
          ? 'flex flex-row items-center gap-1'
          : compact
            ? 'flex flex-col items-center gap-0.5'
            : 'flex flex-row items-center gap-1.5'
      }
      title={`${label}: ${pct}%`}
    >
      {icon}
      <div className={compact && !landscape ? 'w-full min-w-0' : 'flex-1 min-w-0'}>
        {!compact && (
          <div className="flex items-center justify-between text-[10px] text-[#FFFDF8] mb-0.5 leading-none">
            <span className="font-medium text-slate-200 truncate">{label}</span>
            <span className="font-mono tabular-nums font-semibold ml-auto">{pct}%</span>
          </div>
        )}
        <div
          className={`${
            compact ? 'h-1.5' : 'h-2'
          } w-full overflow-hidden rounded-full border border-white/25 ${trackClass}`}
        >
          <div style={{ width: `${pct}%` }} className={`h-full ${colorClass} transition-all duration-300`} />
        </div>
      </div>
    </div>
  );
};


