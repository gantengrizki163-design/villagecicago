import React, { useMemo } from 'react';
import type { Gender, PlayerAnimState } from '../../types/game';
import {
  CharacterLowPoly,
  type CharacterHeadwearId,
  type CharacterHeldPropId,
  type HairStyleId,
  type OutfitPresetId,
} from './CharacterLowPoly';

export interface CharacterNpcVariantsProps {
  npcId?: string;
  role: string;
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  anim?: PlayerAnimState;
  castShadow?: boolean;
  isPoliceAlert?: boolean;
}

interface NpcVisualProfile {
  scale: number;
  shirtColor: string;
  pantsColor: string;
  hairStyle: HairStyleId;
  hijabColor?: string;
  outfitPreset: OutfitPresetId;
  headwear: CharacterHeadwearId;
  heldProp: CharacterHeldPropId;
  hasGlasses?: boolean;
  hasBackpack?: boolean;
  hasApron?: boolean;
  hasTie?: boolean;
  tieColor?: string;
}

function resolveNpcVisualProfile(
  role: string,
  gender: Gender,
  shirtColor: string,
  pantsColor: string
): NpcVisualProfile {
  const defaultHair: HairStyleId = gender === 'perempuan' ? 'wavy_lob' : 'neat_part';

  switch (role) {
    case 'polisi_patroli':
      return {
        scale: 1.0,
        shirtColor: '#8B7963',
        pantsColor: '#4A3C31',
        hairStyle: gender === 'perempuan' ? 'sanggul' : 'neat_part',
        outfitPreset: 'polisi',
        headwear: 'baret_polisi',
        heldProp: 'none',
      };
    case 'polisi_atasan':
      return {
        scale: 1.02,
        shirtColor: '#7A6B5D',
        pantsColor: '#3B3028',
        hairStyle: 'neat_part',
        outfitPreset: 'polisi',
        headwear: 'topi_polisi',
        heldProp: 'berkas',
      };
    case 'ojek':
      return {
        scale: 1.0,
        shirtColor: '#3AA64B',
        pantsColor: '#252C38',
        hairStyle: 'neat_part',
        outfitPreset: 'ojol',
        headwear: 'none',
        heldProp: 'helm_ojol',
      };
    case 'petani':
      return {
        scale: 0.98,
        shirtColor: '#4F698F',
        pantsColor: '#2B3544',
        hairStyle: 'neat_part',
        outfitPreset: 'petani',
        headwear: 'caping',
        heldProp: 'cangkul',
      };
    case 'kontraktor':
    case 'mandor':
      return {
        scale: 1.02,
        shirtColor: '#496791',
        pantsColor: '#3D4450',
        hairStyle: 'neat_part',
        outfitPreset: 'proyek',
        headwear: 'helm_proyek',
        heldProp: 'none',
      };
    case 'anak_sekolah':
      return {
        scale: 0.77,
        shirtColor: '#F7F6F2',
        pantsColor: '#D64937',
        hairStyle: 'spiky',
        outfitPreset: 'pelajar',
        headwear: 'topi_sd',
        heldProp: 'none',
        hasBackpack: true,
        hasTie: true,
        tieColor: '#D64937',
      };
    case 'pedagang':
      return {
        scale: 0.97,
        shirtColor: '#F3C09E',
        pantsColor: '#7A4D2B',
        hairStyle: 'sanggul',
        outfitPreset: 'kebaya',
        headwear: 'none',
        heldProp: 'keranjang',
      };
    case 'ibu_rumah_tangga':
      return {
        scale: 0.97,
        shirtColor: shirtColor || '#4CAF6E',
        pantsColor: '#7A4D2B',
        hairStyle: 'sanggul',
        outfitPreset: 'kebaya',
        headwear: 'none',
        heldProp: 'keranjang',
      };
    case 'pedagang_grosir':
      return {
        scale: 1.0,
        shirtColor: shirtColor || '#D9C8B2',
        pantsColor: pantsColor || '#333C4B',
        hairStyle: 'neat_part',
        outfitPreset: 'pedagang',
        headwear: 'none',
        heldProp: 'berkas',
        hasApron: true,
      };
    case 'guru':
      return {
        scale: gender === 'perempuan' ? 0.98 : 1.0,
        shirtColor: shirtColor || '#C8A582',
        pantsColor: pantsColor || '#262F3D',
        hairStyle: gender === 'perempuan' ? 'wavy_lob' : 'neat_part',
        outfitPreset: 'batik',
        headwear: 'none',
        heldProp: 'buku',
        hasGlasses: true,
      };
    case 'pejabat_desa':
      return {
        scale: 1.0,
        shirtColor: '#EFECE6',
        pantsColor: '#2B3442',
        hairStyle: 'neat_part',
        outfitPreset: 'dinas',
        headwear: 'peci',
        heldProp: 'berkas',
        hasGlasses: true,
      };
    case 'pegawai_bank':
      return {
        scale: 0.98,
        shirtColor: '#1F5FC4',
        pantsColor: '#1E2736',
        hairStyle: 'ponytail',
        outfitPreset: 'dinas',
        headwear: 'none',
        heldProp: 'tablet',
        hasTie: true,
        tieColor: '#F2BC2E',
      };
    case 'agen_properti':
      return {
        scale: 1.0,
        shirtColor: '#2563EB',
        pantsColor: '#222B3A',
        hairStyle: 'neat_part',
        outfitPreset: 'dinas',
        headwear: 'none',
        heldProp: 'berkas',
        hasTie: true,
        tieColor: '#1E293B',
      };
    case 'satpam':
      return {
        scale: 1.01,
        shirtColor: '#246A4D',
        pantsColor: '#1B2432',
        hairStyle: 'neat_part',
        outfitPreset: 'polisi',
        headwear: 'topi_satpam',
        heldProp: 'pentungan',
      };
    case 'penjaga':
      return {
        scale: 1.0,
        shirtColor: shirtColor || '#B87842',
        pantsColor: '#2B3442',
        hairStyle: 'neat_part',
        outfitPreset: 'batik',
        headwear: 'peci',
        heldProp: 'none',
      };
    default:
      return {
        scale: 1.0,
        shirtColor,
        pantsColor,
        hairStyle: defaultHair,
        outfitPreset: 'kasual',
        headwear: 'none',
        heldProp: 'none',
      };
  }
}

/**
 * Varian visual NPC profesi Indonesia mengacu pada Indonesian_NPC_characters_lineup.
 */
export const CharacterNpcVariants: React.FC<CharacterNpcVariantsProps> = ({
  npcId,
  role,
  gender,
  skinColor,
  hairColor,
  shirtColor,
  pantsColor,
  anim = 'idle',
  castShadow = true,
  isPoliceAlert = false,
}) => {
  const profile = useMemo(
    () => resolveNpcVisualProfile(role, gender, shirtColor, pantsColor),
    [role, gender, shirtColor, pantsColor]
  );

  // Override warna baju kecil per ID spesifik agar tetap beda & mudah dikenali di keramaian
  const finalShirtColor = useMemo(() => {
    if (npcId === 'npc_bu_kokom') return '#4CAF6E';
    if (npcId === 'npc_teh_neng') return '#F3C09E';
    return profile.shirtColor;
  }, [npcId, profile.shirtColor]);

  return (
    <CharacterLowPoly
      assetId="char_npc_lineup"
      gender={gender}
      skinColor={skinColor}
      hairColor={hairColor}
      shirtColor={finalShirtColor}
      pantsColor={profile.pantsColor}
      anim={anim}
      castShadow={castShadow}
      scale={profile.scale}
      hairStyle={profile.hairStyle}
      hijabColor={profile.hijabColor}
      outfitPreset={profile.outfitPreset}
      headwear={profile.headwear}
      heldProp={profile.heldProp}
      hasGlasses={profile.hasGlasses}
      hasBackpack={profile.hasBackpack}
      hasApron={profile.hasApron}
      hasTie={profile.hasTie}
      tieColor={profile.tieColor}
      isPoliceAlert={isPoliceAlert}
    />
  );
};
