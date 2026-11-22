import React from 'react';

export type StatusIconKind =
  | 'health'
  | 'hunger'
  | 'thirst'
  | 'energy'
  | 'hygiene'
  | 'mood'
  | 'money'
  | 'clock';

export type ActionIconKind =
  | 'buy'
  | 'eat'
  | 'sleep'
  | 'work'
  | 'apply_job'
  | 'ride_train'
  | 'visit_clinic'
  | 'enter_house'
  | 'trade'
  | 'chat'
  | 'phone'
  | 'backpack'
  | 'map'
  | 'settings';

export type FoodIconKind =
  | 'nasi_goreng'
  | 'mie_rebus'
  | 'es_teh_manis'
  | 'air_botol'
  | 'tempe_goreng'
  | 'bakso'
  | 'pisang'
  | 'kopi_sachet';

interface TileIconProps {
  kind: StatusIconKind;
  className?: string;
}

const STATUS_BG: Record<StatusIconKind, string> = {
  hunger: '#F39A68',
  thirst: '#F5A64B',
  energy: '#7BC4EB',
  health: '#F7D166',
  hygiene: '#F4A9BD',
  mood: '#3BA9A4',
  money: '#86C76D',
  clock: '#7BC96F',
};

/**
 * Set Ikon Status Bertahan Hidup, Uang & Jam (Batch 6)
 * Mengacu langsung pada Game_icon_set_with_symbols_aa99f2e6_2d0791db.jpg:
 * bingkai kotak membulat krem (#F5EFE0) dengan latar pastel & ilustrasi tebal terbaca.
 */
export const StatusTileIcon: React.FC<TileIconProps> = ({ kind, className = 'h-6 w-6' }) => {
  const bg = STATUS_BG[kind];

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="11" fill="#F5EFE0" stroke="#C9B99B" strokeWidth="2" />
      <rect x="5" y="5" width="38" height="38" rx="8.5" fill={bg} />

      {kind === 'hunger' && (
        <g>
          {/* Nasi putih & mangkuk kuning-oranye + sendok */}
          <path d="M13 24 C13 17, 31 17, 31 24 Z" fill="#FFFDF8" stroke="#D5CFC4" strokeWidth="1.2" />
          <circle cx="18" cy="21" r="2.2" fill="#FFFDF8" />
          <circle cx="22.5" cy="19.5" r="2.4" fill="#FFFDF8" />
          <circle cx="27" cy="21" r="2.1" fill="#FFFDF8" />
          <path d="M29 19 L34 14" stroke="#B6C0CA" strokeWidth="2.8" strokeLinecap="round" />
          <ellipse cx="34.5" cy="13.5" rx="2.8" ry="2" transform="rotate(-38 34.5 13.5)" fill="#DCE3EA" stroke="#9AA5B1" strokeWidth="1" />
          <path d="M11.5 24 H33.5 C33.5 32.5, 29 36, 22.5 36 C16 36, 11.5 32.5, 11.5 24 Z" fill="#F4B23E" stroke="#C87E1B" strokeWidth="1.5" />
          <path d="M15 27.5 H29" stroke="#FAD07A" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}

      {kind === 'thirst' && (
        <g>
          {/* Gelas air bening kebiruan + gelembung */}
          <polygon points="15,12 33,12 30.5,37 17.5,37" fill="#B9E5FB" stroke="#3479B2" strokeWidth="1.6" strokeLinejoin="round" />
          <polygon points="16.5,20 31.5,20 30,35.5 18,35.5" fill="#5EB3E6" />
          <ellipse cx="24" cy="12" rx="9" ry="2.2" fill="#DFF3FE" stroke="#3479B2" strokeWidth="1.4" />
          <circle cx="21" cy="26" r="1.4" fill="#E6F7FF" />
          <circle cx="26.5" cy="29.5" r="1.7" fill="#E6F7FF" />
          <circle cx="23.5" cy="32.5" r="1.1" fill="#E6F7FF" />
        </g>
      )}

      {kind === 'energy' && (
        <polygon
          points="26,9 15,26 23,26 20,39 33,21 25,21"
          fill="#FFD147"
          stroke="#C87E1B"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}

      {kind === 'health' && (
        <path
          d="M24 36.5 C24 36.5 11.5 28.6 11.5 19.8 C11.5 15.2 15.2 12 19.3 12 C21.8 12 23.4 13.4 24 14.8 C24.6 13.4 26.2 12 28.7 12 C32.8 12 36.5 15.2 36.5 19.8 C36.5 28.6 24 36.5 24 36.5 Z"
          fill="#EF4B45"
          stroke="#B72B27"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}

      {kind === 'hygiene' && (
        <g>
          {/* Sabun biru + busa gelembung putih */}
          <rect x="13" y="19" width="21" height="13" rx="6" fill="#7AD1F4" stroke="#4298C2" strokeWidth="1.5" />
          <rect x="16.5" y="22.5" width="14" height="6" rx="3" fill="#A6E3FA" />
          <circle cx="31" cy="15" r="3.4" fill="#FFFFFF" stroke="#7AD1F4" strokeWidth="1.2" />
          <circle cx="35.5" cy="18.5" r="2" fill="#FFFFFF" stroke="#7AD1F4" strokeWidth="1" />
          <circle cx="15" cy="33" r="2.8" fill="#FFFFFF" stroke="#7AD1F4" strokeWidth="1.1" />
          <circle cx="19.5" cy="35" r="1.9" fill="#FFFFFF" stroke="#7AD1F4" strokeWidth="1" />
        </g>
      )}

      {kind === 'mood' && (
        <g>
          <circle cx="24" cy="24" r="12.5" fill="#F9CF56" stroke="#C88B1D" strokeWidth="1.6" />
          <path d="M18 21.5 Q20 19 22 21.5" fill="none" stroke="#5A3C16" strokeWidth="2" strokeLinecap="round" />
          <path d="M26 21.5 Q28 19 30 21.5" fill="none" stroke="#5A3C16" strokeWidth="2" strokeLinecap="round" />
          <path d="M18.5 26.5 Q24 32 29.5 26.5" fill="none" stroke="#5A3C16" strokeWidth="2.1" strokeLinecap="round" />
        </g>
      )}

      {kind === 'money' && (
        <g transform="rotate(-12 24 24)">
          <rect x="10" y="16.5" width="28" height="16" rx="2.5" fill="#4C9D4A" stroke="#2D6A2E" strokeWidth="1.4" />
          <rect x="11" y="14.5" width="28" height="16" rx="2.5" fill="#77C36A" stroke="#2D6A2E" strokeWidth="1.4" />
          <rect x="14" y="17.2" width="22" height="10.6" rx="1.4" fill="#99DA89" />
          <circle cx="25" cy="22.5" r="4.2" fill="#4C9D4A" />
          <text x="25" y="24.5" textAnchor="middle" fontSize="5.4" fontWeight="800" fill="#F5EFE0" fontFamily="sans-serif">
            Rp
          </text>
        </g>
      )}

      {kind === 'clock' && (
        <g>
          <circle cx="24" cy="24" r="13" fill="#E06B3B" stroke="#A64621" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="9.8" fill="#F5EBD8" />
          <line x1="24" y1="24" x2="24" y2="17" stroke="#5A3C16" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="24" y1="24" x2="30" y2="21.5" stroke="#D64937" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="24" r="1.6" fill="#5A3C16" />
        </g>
      )}
    </svg>
  );
};

const ACTION_BG: Record<ActionIconKind, string> = {
  buy: '#B9E7C9',
  eat: '#FCE79C',
  sleep: '#BCE3FA',
  work: '#F9B4B4',
  apply_job: '#FCD19C',
  ride_train: '#DDE3F8',
  visit_clinic: '#FBE0E2',
  enter_house: '#F9C99B',
  trade: '#FDF0A6',
  chat: '#BAE6F7',
  phone: '#C2E2FA',
  backpack: '#B4C3ED',
  map: '#F9C79B',
  settings: '#E2E6EE',
};

/**
 * Set Ikon Tombol Aksi Game (Batch 6)
 * Mengacu pada Game_UI_action_button_icons_92c1b0c3_8b063c72.jpg:
 * squircle bertepi navy gelap (#25314D) dengan isian pastel cerah & garis ikon bersih.
 */
export const ActionTileIcon: React.FC<{ kind: ActionIconKind; className?: string }> = ({
  kind,
  className = 'h-5 w-5',
}) => {
  const bg = ACTION_BG[kind];

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="12" fill={bg} stroke="#25314D" strokeWidth="2.6" />

      {kind === 'buy' && (
        <g stroke="#25314D" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15 H16 L19.5 29 H33.5 L36 18.5 H17" />
          <circle cx="21" cy="34" r="2" fill="#25314D" />
          <circle cx="32" cy="34" r="2" fill="#25314D" />
        </g>
      )}

      {kind === 'eat' && (
        <g stroke="#25314D" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 13 V21 M20 13 V21 M23 13 V21 M17 21 C17 24 23 24 23 21 M20 23 V36" />
          <path d="M30 13 V36 M30 13 C33.5 14 34 21 30 24" />
        </g>
      )}

      {kind === 'sleep' && (
        <g stroke="#25314D" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 33 V19 M37 33 V23 M11 28 H37" />
          <rect x="14.5" y="22.5" width="7" height="3.5" rx="1.2" fill="#FFFFFF" />
          <path d="M22.5 23 H34.5 C36 23 37 24.5 37 27.5 H22.5 Z" fill="#7AB8E8" />
        </g>
      )}

      {kind === 'work' && (
        <g stroke="#25314D" strokeWidth="2.2" fill="none" strokeLinejoin="round">
          <path d="M19 18 V15 H29 V18" />
          <rect x="12" y="18" width="24" height="16" rx="3" fill="#DF746A" />
          <path d="M12 24 H36" />
          <rect x="22" y="22" width="4" height="4" rx="0.8" fill="#FCE79C" />
        </g>
      )}

      {kind === 'apply_job' && (
        <g stroke="#25314D" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="13" y="11" width="19" height="26" rx="2.5" fill="#FFFDF8" />
          <circle cx="20" cy="18.5" r="2.6" fill="#7AB8E8" />
          <path d="M16.5 24 C16.5 22 23.5 22 23.5 24" />
          <line x1="25" y1="17" x2="29" y2="17" />
          <line x1="16.5" y1="28" x2="27" y2="28" />
          <circle cx="32.5" cy="31.5" r="5.5" fill="#77C36A" />
          <path d="M30.5 31.5 H34.5 M33 29.5 L35 31.5 L33 33.5" />
        </g>
      )}

      {kind === 'ride_train' && (
        <g stroke="#25314D" strokeWidth="2" fill="none" strokeLinejoin="round">
          <rect x="14" y="13" width="20" height="19" rx="4" fill="#9FA8C9" />
          <rect x="17" y="16.5" width="14" height="7" rx="1.5" fill="#E3F2FD" />
          <circle cx="19" cy="28" r="1.7" fill="#FCD19C" />
          <circle cx="29" cy="28" r="1.7" fill="#FCD19C" />
          <line x1="16" y1="35" x2="32" y2="35" strokeLinecap="round" />
        </g>
      )}

      {kind === 'visit_clinic' && (
        <path
          d="M20.5 12 H27.5 V20.5 H36 V27.5 H27.5 V36 H20.5 V27.5 H12 V20.5 H20.5 Z"
          fill="#EA4C46"
          stroke="#25314D"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}

      {kind === 'enter_house' && (
        <g stroke="#25314D" strokeWidth="2.1" strokeLinejoin="round">
          <polygon points="24,11 11,22 37,22" fill="#E06B3B" />
          <rect x="14" y="22" width="20" height="14" fill="#F5EFE0" />
          <rect x="21" y="26.5" width="6" height="9.5" fill="#B87842" />
        </g>
      )}

      {kind === 'trade' && (
        <g stroke="#25314D" strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 22 L17 18 L24 22 L29 18 L37 23" />
          <path d="M13 24 L20 31 C22 33 26 33 28 31 L35 25" fill="#F9C99B" />
          <line x1="20" y1="26" x2="24" y2="30" />
          <line x1="24" y1="25" x2="28" y2="29" />
        </g>
      )}

      {kind === 'chat' && (
        <g stroke="#25314D" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M12 16 H30 A4 4 0 0 1 34 20 V27 A4 4 0 0 1 30 31 H20 L14 35 V31 H12 A4 4 0 0 1 8 27 V20 A4 4 0 0 1 12 16 Z" fill="#8CD7A4" />
          <circle cx="17" cy="23.5" r="1.4" fill="#25314D" />
          <circle cx="22" cy="23.5" r="1.4" fill="#25314D" />
          <circle cx="27" cy="23.5" r="1.4" fill="#25314D" />
        </g>
      )}

      {kind === 'phone' && (
        <g stroke="#25314D" strokeWidth="2.1" fill="none">
          <rect x="16" y="11" width="16" height="26" rx="3" fill="#FFFDF8" />
          <line x1="21" y1="14.5" x2="27" y2="14.5" strokeLinecap="round" />
          <circle cx="24" cy="33.5" r="1.3" fill="#25314D" />
        </g>
      )}

      {kind === 'backpack' && (
        <g stroke="#25314D" strokeWidth="2.1" strokeLinejoin="round">
          <path d="M19 15 V12 H29 V15" fill="none" />
          <rect x="14" y="15" width="20" height="20" rx="6" fill="#E69A61" />
          <rect x="17" y="24" width="14" height="8" rx="2.5" fill="#F5D39E" />
        </g>
      )}

      {kind === 'map' && (
        <g stroke="#25314D" strokeWidth="2" strokeLinejoin="round">
          <polygon points="11,22 19,19 29,23 37,20 37,34 29,37 19,33 11,36" fill="#9ED691" />
          <path d="M24 11 C19.8 11 17 14 17 17.5 C17 22.5 24 28.5 24 28.5 C24 28.5 31 22.5 31 17.5 C31 14 28.2 11 24 11 Z" fill="#EA4C46" />
          <circle cx="24" cy="17.5" r="2.3" fill="#FFFDF8" />
        </g>
      )}

      {kind === 'settings' && (
        <g stroke="#25314D" strokeWidth="2.1" fill="#C4CCD8" strokeLinejoin="round">
          <path d="M21.5 11 H26.5 L27.5 14.5 L30.8 15.8 L33.8 14 L37 17.2 L35.2 20.2 L36.5 23.5 L40 24.5 V29.5 L36.5 30.5 L35.2 33.8 L37 36.8 L33.8 40 L30.8 38.2 L27.5 39.5 L26.5 43 H21.5 L20.5 39.5 L17.2 38.2 L14.2 40 L11 36.8 L12.8 33.8 L11.5 30.5 L8 29.5 V24.5 L11.5 23.5 L12.8 20.2 L11 17.2 L14.2 14 L17.2 15.8 L20.5 14.5 Z" transform="translate(0 -3)" />
          <circle cx="24" cy="24" r="5" fill="#E2E6EE" />
        </g>
      )}
    </svg>
  );
};

export function resolveFoodIconKind(itemId: string): FoodIconKind {
  const id = itemId.toLowerCase();
  if (id.includes('mie')) return 'mie_rebus';
  if (id.includes('teh')) return 'es_teh_manis';
  if (id.includes('air') || id.includes('mineral') || id.includes('water')) return 'air_botol';
  if (id.includes('tempe')) return 'tempe_goreng';
  if (id.includes('bakso')) return 'bakso';
  if (id.includes('pisang')) return 'pisang';
  if (id.includes('kopi') || id.includes('coffee')) return 'kopi_sachet';
  return 'nasi_goreng';
}

/**
 * Set Ikon Makanan & Minuman Indonesia (Batch 6)
 * Mengacu pada Low-poly_Indonesian_food_icon_set_9bcad077_55be61b0.jpg.
 */
export const FoodIcon: React.FC<{ itemId: string; className?: string }> = ({
  itemId,
  className = 'h-10 w-10',
}) => {
  const kind = resolveFoodIconKind(itemId);

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#F5EFE0" stroke="#DFD5C2" strokeWidth="1.5" />

      {kind === 'nasi_goreng' && (
        <g>
          {/* Piring putih + nasi goreng + telur ceplok + timun + cabai */}
          <ellipse cx="24" cy="29" rx="16.5" ry="9" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.4" />
          <path d="M15 28 C15 19 31 19 31 28 Z" fill="#C97F43" />
          <ellipse cx="23" cy="20.5" rx="6.5" ry="3.2" fill="#FFFFFF" />
          <circle cx="23" cy="19.8" r="2.6" fill="#F5B82E" />
          <circle cx="33.5" cy="25.5" r="2.8" fill="#8BD160" stroke="#4D8E38" strokeWidth="0.9" />
          <circle cx="34.5" cy="29" r="2.6" fill="#8BD160" stroke="#4D8E38" strokeWidth="0.9" />
          <ellipse cx="14.5" cy="29.5" rx="2.6" ry="1.3" fill="#E34C3E" />
        </g>
      )}

      {kind === 'mie_rebus' && (
        <g>
          {/* Mangkuk kuning mie kuah + telur rebus + sawi */}
          <path d="M10 24 H38 C37 33.5 32 37 24 37 C16 37 11 33.5 10 24 Z" fill="#F2CB6E" stroke="#C59132" strokeWidth="1.4" />
          <ellipse cx="24" cy="24" rx="13.5" ry="4.8" fill="#E89E4A" />
          <path d="M15 24 Q19 21 23 24 T31 24" fill="none" stroke="#FDE68A" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="19" cy="22.5" r="3.4" fill="#FFFFFF" />
          <circle cx="19" cy="22.5" r="1.7" fill="#F5B82E" />
          <ellipse cx="28" cy="22" rx="3" ry="1.8" fill="#69AD3B" />
          <line x1="30" y1="21" x2="36" y2="12" stroke="#CBD5E1" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}

      {kind === 'es_teh_manis' && (
        <g>
          {/* Gelas es teh manis + es batu + irisan jeruk nipis + sedotan */}
          <line x1="27" y1="20" x2="32.5" y2="9.5" stroke="#E8894B" strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="16,16 32,16 29.5,38 18.5,38" fill="#DDF0FA" stroke="#7BA4BF" strokeWidth="1.4" />
          <polygon points="17.2,20 30.8,20 28.8,36.5 19.2,36.5" fill="#B55B24" />
          <rect x="20" y="21" width="4" height="4" rx="0.8" fill="#E6F7FF" opacity="0.85" />
          <rect x="25" y="23" width="3.8" height="3.8" rx="0.8" fill="#E6F7FF" opacity="0.85" />
          <circle cx="16.5" cy="15.5" r="4.2" fill="#80BE43" stroke="#4D8E38" strokeWidth="1.2" />
          <circle cx="16.5" cy="15.5" r="2.2" fill="#D5F2A3" />
        </g>
      )}

      {kind === 'air_botol' && (
        <g>
          {/* Botol air mineral bening tutup biru */}
          <rect x="21" y="9" width="6" height="3.5" rx="1" fill="#3A7FE5" />
          <path d="M18 16 C18 13.5 21 12.5 21 12.5 H27 C27 12.5 30 13.5 30 16 V36 C30 37.8 28.5 39 26.5 39 H21.5 C19.5 39 18 37.8 18 36 Z" fill="#D2ECFA" stroke="#76ABD1" strokeWidth="1.4" />
          <rect x="18" y="22" width="12" height="6" fill="#5EB3E6" />
        </g>
      )}

      {kind === 'tempe_goreng' && (
        <g>
          <ellipse cx="24" cy="31" rx="15" ry="7.5" fill="#EEDCC5" stroke="#C7AA88" strokeWidth="1.2" />
          <rect x="13" y="21" width="12" height="8" rx="1.6" transform="rotate(-12 19 25)" fill="#E3A548" stroke="#B8782B" strokeWidth="1.2" />
          <rect x="21" y="22" width="12" height="8" rx="1.6" transform="rotate(8 27 26)" fill="#F0B95E" stroke="#B8782B" strokeWidth="1.2" />
        </g>
      )}

      {kind === 'bakso' && (
        <g>
          <path d="M10 24 H38 C37 33.5 32 37 24 37 C16 37 11 33.5 10 24 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.4" />
          <ellipse cx="24" cy="24" rx="13.5" ry="4.5" fill="#D9D4C7" />
          <circle cx="19" cy="22.5" r="3.6" fill="#9A8879" />
          <circle cx="27" cy="22" r="3.8" fill="#8A7869" />
          <circle cx="23.5" cy="25" r="3.2" fill="#9A8879" />
          <path d="M22 18 L25 21 M27 18 L24 21" stroke="#69AD3B" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}

      {kind === 'pisang' && (
        <g>
          <path d="M13 30 Q23 33 32 17 Q29 27 15 33 Z" fill="#F2CB46" stroke="#C89E1E" strokeWidth="1.2" />
          <path d="M16 34 Q26 37 35 20 Q32 30 18 37 Z" fill="#FAD964" stroke="#C89E1E" strokeWidth="1.2" />
          <rect x="31" y="13" width="4" height="4" rx="1" fill="#744A2D" />
        </g>
      )}

      {kind === 'kopi_sachet' && (
        <g>
          <rect x="13" y="11" width="16" height="23" rx="2" fill="#F2D7BA" stroke="#B87842" strokeWidth="1.3" />
          <rect x="15.5" y="15" width="11" height="11" rx="1.5" fill="#D87139" />
          <ellipse cx="32" cy="34.5" rx="6.5" ry="3.2" fill="#5D3A24" />
        </g>
      )}
    </svg>
  );
};
