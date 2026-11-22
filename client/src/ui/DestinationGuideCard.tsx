import React from 'react';
import {
  Briefcase,
  Building2,
  Car,
  CreditCard,
  FileCheck2,
  Footprints,
  Fuel,
  Gavel,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  MapPin,
  Navigation,
  Package,
  Scale,
  ShoppingBag,
  Sofa,
  Store,
  TrainFront,
  UserCheck,
  Utensils,
  Wrench,
  X,
} from 'lucide-react';
import { NAVIGATION_FEATURE_FLAGS } from '../world3d/interactions/navigationConfig';
import type { InteractionDestination } from '../world3d/interactions/registry';
import type {
  ActiveNavigationState,
  PendingGatePrompt,
} from '../world3d/interactions/useLocationGate';
import { useViewportMode } from './useViewportMode';

function DestinationIcon({
  kind,
  className = 'h-5 w-5',
}: {
  kind: InteractionDestination['iconKind'];
  className?: string;
}) {
  switch (kind) {
    case 'work':
      return <Briefcase className={className} />;
    case 'clinic':
      return <HeartPulse className={className} />;
    case 'school':
      return <GraduationCap className={className} />;
    case 'train':
      return <TrainFront className={className} />;
    case 'bank':
      return <Landmark className={className} />;
    case 'atm':
      return <CreditCard className={className} />;
    case 'business':
      return <Store className={className} />;
    case 'wholesale':
      return <Package className={className} />;
    case 'auction':
      return <Gavel className={className} />;
    case 'law':
      return <Scale className={className} />;
    case 'agent':
      return <Building2 className={className} />;
    case 'furniture':
      return <Sofa className={className} />;
    case 'warung':
      return <Utensils className={className} />;
    case 'house':
    case 'land':
      return <Home className={className} />;
    case 'npc':
      return <UserCheck className={className} />;
    case 'vehicle':
      return <Car className={className} />;
    case 'fuel':
      return <Fuel className={className} />;
    case 'workshop':
      return <Wrench className={className} />;
    case 'samsat':
      return <FileCheck2 className={className} />;
    default:
      return <ShoppingBag className={className} />;
  }
}

interface DestinationGuideCardProps {
  pendingPrompt: PendingGatePrompt | null;
  activeNav: ActiveNavigationState | null;
  activeDistanceMeters: number;
  activeEtaSeconds: number;
  onSelectDestination: (destId: string) => void;
  onShowDirection: () => void;
  onStartAutoWalk: () => void;
  onToggleAutoWalk: () => void;
  onCancelPrompt: () => void;
  onCancelNav: () => void;
}

export const DestinationGuideCard: React.FC<DestinationGuideCardProps> = ({
  pendingPrompt,
  activeNav,
  activeDistanceMeters,
  activeEtaSeconds,
  onSelectDestination,
  onShowDirection,
  onStartAutoWalk,
  onToggleAutoWalk,
  onCancelPrompt,
  onCancelNav,
}) => {
  const { isCompactHud, isMobileLandscape } = useViewportMode();

  return (
    <>
      {/* 1. Kartu Konfirmasi Tujuan Saat Klik Menu Lokasi yang Masih Jauh */}
      {pendingPrompt && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-4 sm:bottom-6 z-30 flex justify-center px-3">
          <div className="w-full max-w-md rounded-2xl border border-[#7BC4EB]/55 bg-[#161E38]/96 backdrop-blur-md p-3.5 text-[#FFFDF8] shadow-2xl">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3BA9A4]/25 border border-[#7ECBA1]/50 text-[#7ECBA1]">
                  <DestinationIcon kind={pendingPrompt.selectedDestination.iconKind} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7BC4EB]">
                    Perlu Datang ke Lokasi
                  </div>
                  <h3 className="text-sm font-bold text-white truncate">
                    {pendingPrompt.selectedDestination.label}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 text-[#F7D166] font-semibold">
                      <MapPin className="h-3 w-3 shrink-0" />±{pendingPrompt.distanceMeters} m
                    </span>
                    <span>· ~{pendingPrompt.etaSeconds} dtk jalan</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancelPrompt}
                className="rounded-lg bg-white/10 p-1.5 text-slate-300 hover:bg-white/20 hover:text-white"
                aria-label="Tutup panduan tujuan"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {pendingPrompt.selectedDestination.subtitle && (
              <p className="mt-1.5 text-[11px] text-slate-300">
                {pendingPrompt.selectedDestination.subtitle}
              </p>
            )}

            {pendingPrompt.routeNote && (
              <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-950/45 px-2.5 py-1.5 text-[11px] text-amber-200">
                {pendingPrompt.routeNote}
              </div>
            )}

            {/* Pilihan alternatif jika lebih dari 1 lokasi valid (misal Bank/ATM, Puskesmas/Klinik, Lokasi Kerja) */}
            {pendingPrompt.destinations.length > 1 && (
              <div className="mt-2.5">
                <div className="mb-1 text-[10px] font-semibold text-slate-400">
                  Pilih Lokasi Tujuan ({pendingPrompt.destinations.length} tersedia):
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {pendingPrompt.destinations.map((dest) => {
                    const active = dest.id === pendingPrompt.selectedDestination.id;
                    return (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => onSelectDestination(dest.id)}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          active
                            ? 'border-[#7ECBA1] bg-[#3BA9A4]/30 text-white'
                            : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/15'
                        }`}
                      >
                        {dest.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tombol Aksi */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onShowDirection}
                className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border border-[#7BC4EB]/55 bg-[#7BC4EB]/15 px-3 py-2 text-xs font-bold text-[#BCE5F7] hover:bg-[#7BC4EB]/25 active:scale-[0.98]"
              >
                <Navigation className="h-3.5 w-3.5 shrink-0" />
                <span>Tunjukkan Arah</span>
              </button>

              {NAVIGATION_FEATURE_FLAGS.AUTO_WALK_ENABLED && (
                <button
                  type="button"
                  onClick={onStartAutoWalk}
                  className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl bg-[#3BA9A4] px-3 py-2 text-xs font-bold text-[#161E38] hover:bg-[#4ec1bc] active:scale-[0.98]"
                >
                  <Footprints className="h-3.5 w-3.5 shrink-0" />
                  <span>Jalan ke Sana</span>
                </button>
              )}

              <button
                type="button"
                onClick={onCancelPrompt}
                className="min-h-[40px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/15"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Bar Navigasi Aktif Saat Sedang Menuju Tujuan */}
      {!pendingPrompt && activeNav && (
        <div
          className={`pointer-events-auto fixed left-1/2 -translate-x-1/2 z-20 ${
            isMobileLandscape
              ? 'top-[54px] max-w-[calc(100vw-11rem)]'
              : isCompactHud
                ? 'top-[68px] max-w-[calc(100vw-7.2rem)]'
                : 'bottom-4 max-w-md w-[calc(100vw-2rem)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#7ECBA1]/65 bg-[#161E38]/92 backdrop-blur-md px-3 py-2 text-xs text-[#FFFDF8] shadow-2xl">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#3BA9A4]/25 text-[#7ECBA1] border border-[#7ECBA1]/45">
                <DestinationIcon kind={activeNav.destination.iconKind} className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-bold text-white text-[11px] sm:text-xs">
                  {activeNav.autoWalk ? 'Berjalan ke: ' : 'Arah ke: '}
                  {activeNav.destination.label}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono tabular-nums">
                  <span className="text-[#F7D166] font-bold">±{activeDistanceMeters}m</span>
                  <span>· ~{activeEtaSeconds}d</span>
                  {activeNav.autoWalk && (
                    <span className="text-[#7ECBA1] font-sans font-semibold">· Auto</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {NAVIGATION_FEATURE_FLAGS.AUTO_WALK_ENABLED && (
                <button
                  type="button"
                  onClick={onToggleAutoWalk}
                  className={`min-h-[34px] rounded-xl px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    activeNav.autoWalk
                      ? 'bg-amber-500/25 border border-amber-400/60 text-amber-200 hover:bg-amber-500/35'
                      : 'bg-[#3BA9A4] text-[#161E38] hover:bg-[#4ec1bc]'
                  }`}
                >
                  {activeNav.autoWalk ? 'Hentikan' : 'Jalan'}
                </button>
              )}
              <button
                type="button"
                onClick={onCancelNav}
                className="h-8 w-8 rounded-xl border border-white/15 bg-white/10 flex items-center justify-center text-slate-300 hover:bg-white/20 hover:text-white"
                aria-label="Batalkan penunjuk arah"
                title="Batal"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
