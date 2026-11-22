import React from 'react';
import { Bath } from 'lucide-react';
import type { NearbyInteractTarget } from '../world3d/LocalPlayer';
import { ActionTileIcon, type ActionIconKind } from './GameIcons';
import { useViewportMode } from './useViewportMode';

interface ActionButtonProps {
  target: NearbyInteractTarget;
  busy: boolean;
  onTrigger: () => void;
  onBathAtKontrakan?: () => void;
}

function mapTargetToActionIcon(target: NonNullable<NearbyInteractTarget>): ActionIconKind {
  switch (target.type) {
    case 'warung':
    case 'biz_cashier':
    case 'pasar_grosir':
    case 'balai_lelang':
      return 'buy';
    case 'interior_eat':
      return 'eat';
    case 'bath':
    case 'interior_bath':
    case 'interior_sleep':
    case 'kontrakan':
    case 'penampungan':
    case 'emperan':
      return 'sleep';
    case 'clinic':
      return 'visit_clinic';
    case 'school':
      return 'apply_job';
    case 'station':
      return 'ride_train';
    case 'job_site':
    case 'biz_craft':
    case 'construction':
      return 'work';
    case 'property':
    case 'interior_exit':
    case 'business':
    case 'biz_manage':
    case 'kantor_desa':
      return 'enter_house';
    case 'bank':
    case 'atm':
    case 'toko_mebel':
    case 'agent_office':
      return 'trade';
    case 'land_plot':
      return 'map';
    case 'polsek':
      return 'settings';
    case 'vehicle_board':
      return 'ride_train';
    case 'dealer':
      return 'buy';
    case 'spbu':
      return 'trade';
    case 'workshop':
      return 'work';
    case 'samsat_sim':
      return 'apply_job';
    case 'npc':
    default:
      return 'chat';
  }
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  target,
  busy,
  onTrigger,
  onBathAtKontrakan,
}) => {
  const { isCompactHud, isMobileLandscape } = useViewportMode();
  if (!target) return null;

  const iconKind = mapTargetToActionIcon(target);

  return (
    <div
      className={`fixed z-20 flex flex-col items-end gap-2 ${
        isMobileLandscape
          ? 'bottom-3 right-3.5 max-w-[calc(100vw-145px)]'
          : isCompactHud
            ? 'bottom-5 right-4 max-w-[calc(100vw-156px)]'
            : 'bottom-6 right-6'
      }`}
    >
      {target.type === 'kontrakan' && onBathAtKontrakan && (
        <button
          type="button"
          disabled={busy}
          onClick={onBathAtKontrakan}
          className="min-h-[42px] flex items-center gap-2 rounded-full border-2 border-white bg-[#5EB3D6] px-3.5 py-1.5 text-xs font-bold text-[#161E38] shadow-xl hover:bg-[#7BC4EB] active:scale-95 disabled:opacity-60 whitespace-nowrap"
        >
          <Bath className="h-4 w-4 shrink-0" />
          <span className="truncate">Mandi di Kontrakan</span>
        </button>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onTrigger}
        className={`${
          isMobileLandscape ? 'min-h-[44px] px-3.5 py-1.5 text-xs' : 'min-h-[48px] px-4 py-2 text-xs sm:text-sm'
        } max-w-full flex items-center gap-2 rounded-full border-[3px] border-white bg-[#EC7C70] font-bold text-white shadow-2xl ring-2 ring-[#25314D]/25 hover:bg-[#F28C80] active:scale-95 disabled:opacity-60 transition-transform`}
      >
        <ActionTileIcon kind={iconKind} className="h-6 w-6 shrink-0" />
        <span className="drop-shadow-sm truncate">{busy ? 'Memproses...' : target.label}</span>
      </button>
    </div>
  );
};

