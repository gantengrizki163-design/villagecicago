import React from 'react';
import type { Gender, PlayerAnimState } from '../types/game';
import {
  CharacterLowPoly,
  type CharacterHeadwearId,
  type HairStyleId,
  type OutfitPresetId,
} from '../world3d/assets/CharacterLowPoly';

export interface AvatarVisualStyle {
  hairStyle?: HairStyleId;
  hijabColor?: string;
  outfitPreset?: OutfitPresetId;
  headwear?: CharacterHeadwearId;
}

const STYLE_STORAGE_PREFIX = 'cicalengka_avatar_style:';

export function saveLocalAvatarStyle(uid: string | undefined, style: AvatarVisualStyle): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STYLE_STORAGE_PREFIX}${uid || 'pending'}`;
    window.localStorage.setItem(key, JSON.stringify(style));
  } catch {
    // Abaikan jika storage dibatasi browser
  }
}

export function loadLocalAvatarStyle(uid?: string): AvatarVisualStyle {
  if (typeof window === 'undefined') return {};
  try {
    const raw =
      (uid ? window.localStorage.getItem(`${STYLE_STORAGE_PREFIX}${uid}`) : null) ??
      window.localStorage.getItem(`${STYLE_STORAGE_PREFIX}pending`);
    if (!raw) return {};
    return JSON.parse(raw) as AvatarVisualStyle;
  } catch {
    return {};
  }
}

interface AvatarMeshProps {
  uid?: string;
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  anim?: PlayerAnimState;
  autoRotate?: boolean;
  castShadow?: boolean;
  hairStyle?: HairStyleId;
  hijabColor?: string;
  outfitPreset?: OutfitPresetId;
  headwear?: CharacterHeadwearId;
  scale?: number;
  ridingHelmet?: boolean;
}

/**
 * Karakter low-poly 3D modular dengan pivot di tengah-bawah kaki (y = 0).
 * Menggunakan CharacterLowPoly sesuai referensi turnaround & kustomisasi Indonesia.
 */
export const AvatarMesh: React.FC<AvatarMeshProps> = ({
  uid,
  gender,
  skinColor,
  hairColor,
  shirtColor,
  pantsColor,
  anim = 'idle',
  autoRotate = false,
  castShadow = true,
  hairStyle,
  hijabColor,
  outfitPreset,
  headwear,
  scale = 1,
  ridingHelmet = false,
}) => {
  const savedStyle = uid ? loadLocalAvatarStyle(uid) : {};
  return (
    <CharacterLowPoly
      gender={gender}
      skinColor={skinColor}
      hairColor={hairColor}
      shirtColor={shirtColor}
      pantsColor={pantsColor}
      anim={anim}
      autoRotate={autoRotate}
      castShadow={castShadow}
      hairStyle={hairStyle ?? savedStyle.hairStyle}
      hijabColor={hijabColor ?? savedStyle.hijabColor}
      outfitPreset={outfitPreset ?? savedStyle.outfitPreset}
      headwear={headwear ?? savedStyle.headwear}
      scale={scale}
      ridingHelmet={ridingHelmet}
    />
  );
};
