import React, { useMemo, useState } from 'react';
import { ChevronRight, Compass, Map as MapIcon, X } from 'lucide-react';
import type { VehicleDoc, ZoneId } from '../types/game';
import { NAVIGATION_FEATURE_FLAGS } from '../world3d/interactions/navigationConfig';
import { getMapLandmarkSummaries, type WorldPoint2D } from '../world3d/interactions/registry';
import type { ActiveNavigationState } from '../world3d/interactions/useLocationGate';
import { LAYOUT_DATA } from '../world3d/layout/layoutHelpers';
import { getPlazaBox, getRailBoxes, getRoadBoxes } from '../world3d/layout/rules';
import type { OffscreenTargetIndicator } from '../world3d/DestinationGuide3D';
import { useViewportMode } from './useViewportMode';

interface NavigationMinimapProps {
  currentZone: ZoneId;
  playerPos: WorldPoint2D;
  playerYaw?: number;
  activeNav: ActiveNavigationState | null;
  offscreenIndicator: OffscreenTargetIndicator | null;
  drivingMode?: boolean;
  vehicles?: VehicleDoc[];
  onCenterToggle?: () => void;
}

const WORLD_SPAN = 160; // -80..+80

function toMapCoord(v: number): number {
  return ((v + 80) / WORLD_SPAN) * 100;
}

export const NavigationMinimap: React.FC<NavigationMinimapProps> = ({
  currentZone,
  playerPos,
  activeNav,
  offscreenIndicator,
  drivingMode = false,
  vehicles = [],
}) => {
  const { isCompactHud, isMobileLandscape, showTouchControls } = useViewportMode();
  const [expandedOnMobile, setExpandedOnMobile] = useState(false);

  const staticGeo = useMemo(() => {
    const roads = getRoadBoxes(LAYOUT_DATA.roads);
    const rails = getRailBoxes(LAYOUT_DATA.rails, LAYOUT_DATA.rules.railSafeMeters, LAYOUT_DATA.lots);
    const plaza = getPlazaBox(LAYOUT_DATA);
    const landmarks = getMapLandmarkSummaries();
    return { roads, rails, plaza, landmarks };
  }, []);

  if (!NAVIGATION_FEATURE_FLAGS.MINIMAP_ENABLED) return null;

  const showFullMap = !isCompactHud || expandedOnMobile || Boolean(activeNav);
  const mapSizeClass = isMobileLandscape
    ? 'h-[92px] w-[92px]'
    : isCompactHud
      ? 'h-[112px] w-[112px]'
      : 'h-[132px] w-[132px]';

  const wrapperClass = isMobileLandscape
    ? 'fixed top-[100px] right-2.5 z-20'
    : isCompactHud
      ? drivingMode
        ? 'fixed top-[170px] right-2.5 z-20'
        : 'fixed bottom-[154px] right-4 z-20'
      : showTouchControls
        ? 'fixed top-[64px] right-[62px] z-20'
        : 'fixed top-[64px] right-3 z-20';

  const polylinePoints = activeNav
    ? activeNav.waypoints.map((p) => `${toMapCoord(p.x).toFixed(1)},${toMapCoord(p.z).toFixed(1)}`).join(' ')
    : '';

  const px = toMapCoord(playerPos.x);
  const pz = toMapCoord(playerPos.z);

  return (
    <>
      {/* Indikator Tepi Layar Saat Tujuan di Luar Jangkauan Kamera */}
      {activeNav && offscreenIndicator && offscreenIndicator.active && !offscreenIndicator.onScreen && (
        <div
          style={{
            left: `${Math.max(10, Math.min(90, offscreenIndicator.xPct))}%`,
            top: `${Math.max(16, Math.min(82, offscreenIndicator.yPct))}%`,
          }}
          className="pointer-events-none fixed -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1 rounded-full border border-[#F7D166]/80 bg-[#161E38]/92 px-2 py-1 text-[10px] font-bold text-[#FFFDF8] shadow-xl"
        >
          <span
            style={{ transform: `rotate(${-offscreenIndicator.angleDeg}deg)` }}
            className="inline-flex text-[#F7D166]"
          >
            <ChevronRight className="h-3.5 w-3.5 stroke-[3]" />
          </span>
          <span className="max-w-[96px] truncate">{offscreenIndicator.label}</span>
          <span className="font-mono tabular-nums text-[#7BC4EB]">
            {offscreenIndicator.distanceMeters}m
          </span>
        </div>
      )}

      {/* Minimap / Tombol Peta Ringkas */}
      <div className={wrapperClass}>
        {!showFullMap ? (
          <button
            type="button"
            onClick={() => setExpandedOnMobile(true)}
            className="flex h-10 items-center gap-1.5 rounded-2xl border border-[#F5EFE0]/30 bg-[#161E38]/85 backdrop-blur-md px-2.5 text-[11px] font-bold text-[#FFFDF8] shadow-xl active:scale-95"
            aria-label="Buka minimap kota"
          >
            <MapIcon className="h-3.5 w-3.5 text-[#7ECBA1]" />
            <span>Peta</span>
          </button>
        ) : (
          <div className="rounded-2xl border border-[#F5EFE0]/30 bg-[#161E38]/88 backdrop-blur-md p-1.5 shadow-2xl">
            <div className="mb-1 flex items-center justify-between px-1 text-[9px] font-bold uppercase tracking-wider text-slate-300">
              <span className="flex items-center gap-1 truncate">
                <Compass className="h-3 w-3 text-[#7BC4EB] shrink-0" />
                {currentZone === 'cicalengka' ? 'Cicalengka' : currentZone}
              </span>
              {isCompactHud && (
                <button
                  type="button"
                  onClick={() => setExpandedOnMobile(false)}
                  className="rounded p-0.5 text-slate-400 hover:text-white"
                  aria-label="Perkecil peta"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <svg
              viewBox="0 0 100 100"
              className={`${mapSizeClass} rounded-xl border border-white/10 bg-[#1E2C3A]`}
            >
              {currentZone === 'cicalengka' ? (
                <>
                  {/* Plaza Alun-Alun */}
                  <rect
                    x={toMapCoord(staticGeo.plaza.minX)}
                    y={toMapCoord(staticGeo.plaza.minZ)}
                    width={(staticGeo.plaza.width / WORLD_SPAN) * 100}
                    height={(staticGeo.plaza.depth / WORLD_SPAN) * 100}
                    rx="1.5"
                    fill="#265947"
                    opacity="0.8"
                  />

                  {/* Jalan Raya & Gang */}
                  {staticGeo.roads.map((r, idx) => (
                    <rect
                      key={`${r.roadId}_${idx}`}
                      x={toMapCoord(r.asphalt.minX)}
                      y={toMapCoord(r.asphalt.minZ)}
                      width={Math.max(1.5, (r.asphalt.width / WORLD_SPAN) * 100)}
                      height={Math.max(1.5, (r.asphalt.depth / WORLD_SPAN) * 100)}
                      fill="#475569"
                    />
                  ))}

                  {/* Rel Kereta */}
                  {staticGeo.rails.map((rail) => (
                    <line
                      key={rail.railId}
                      x1={toMapCoord(rail.ballast.minX)}
                      y1={toMapCoord(rail.ballast.cz)}
                      x2={toMapCoord(rail.ballast.maxX)}
                      y2={toMapCoord(rail.ballast.cz)}
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                      strokeDasharray="2 1.2"
                    />
                  ))}

                  {/* Landmark Utama */}
                  {staticGeo.landmarks.map((lm) => (
                    <g key={lm.id}>
                      <circle cx={toMapCoord(lm.x)} cy={toMapCoord(lm.z)} r="1.8" fill={lm.color} />
                    </g>
                  ))}

                  {/* Kendaraan Pribadi yang Terparkir */}
                  {vehicles
                    .filter(
                      (v) =>
                        v.status === 'parked' &&
                        (v.parkedPos?.zone || 'cicalengka') === currentZone
                    )
                    .map((v) => {
                      const vx = toMapCoord(v.parkedPos.x);
                      const vz = toMapCoord(v.parkedPos.z);
                      return (
                        <g key={v.id}>
                          <title>{`${v.name} (${v.plateNumber})`}</title>
                          <rect
                            x={vx - 1.6}
                            y={vz - 1.6}
                            width="3.2"
                            height="3.2"
                            rx="0.6"
                            fill="#f59e0b"
                            stroke="#0f172a"
                            strokeWidth="0.7"
                          />
                        </g>
                      );
                    })}
                </>
              ) : (
                <>
                  <rect x="10" y="34" width="80" height="6" fill="#475569" />
                  <line x1="8" y1="16" x2="92" y2="16" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="2 1" />
                </>
              )}

              {/* Rute Navigasi Aktif */}
              {activeNav && polylinePoints && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="2.5 1.5"
                />
              )}

              {/* Penanda Tujuan Aktif */}
              {activeNav && activeNav.destination.zone === currentZone && (
                <g>
                  <circle
                    cx={toMapCoord(activeNav.destination.arrivalPoint.x)}
                    cy={toMapCoord(activeNav.destination.arrivalPoint.z)}
                    r="4.4"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.4"
                  />
                  <circle
                    cx={toMapCoord(activeNav.destination.arrivalPoint.x)}
                    cy={toMapCoord(activeNav.destination.arrivalPoint.z)}
                    r="2.4"
                    fill="#fde047"
                  />
                </g>
              )}

              {/* Posisi Pemain */}
              <circle cx={px} cy={pz} r="3.4" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
              <circle cx={px} cy={pz} r="1.7" fill="#ef4444" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
};
