import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { saveLocalAvatarStyle } from '../components/AvatarMesh';
import { CharacterPreview3D } from '../components/CharacterPreview3D';
import { callCreateCharacter, type CreateCharacterPayload } from '../firebase/api';
import { auth } from '../firebase/config';
import type { Gender } from '../types/game';
import {
  SKIN_TONE_PRESETS,
  type HairStyleId,
  type OutfitPresetId,
} from '../world3d/assets/CharacterLowPoly';

const SKIN_PRESETS: string[] = [...SKIN_TONE_PRESETS];
const HAIR_PRESETS = ['#1e1b18', '#4a3222', '#7c2d12', '#d97706'];
const SHIRT_PRESETS = ['#F4EFE8', '#059669', '#2563eb', '#dc2626', '#d97706', '#7c3aed'];
const PANTS_PRESETS = ['#486C9E', '#1e293b', '#451a03', '#334155'];
const HIJAB_PRESETS = ['#F4F1EA', '#A7D8F0', '#F3B8C4', '#86C79A'];

const HAIR_STYLE_OPTIONS: { id: HairStyleId; label: string }[] = [
  { id: 'spiky', label: 'Spiky' },
  { id: 'neat_part', label: 'Rapi' },
  { id: 'bob', label: 'Bob' },
  { id: 'wavy_lob', label: 'Sebahu' },
  { id: 'long_parted', label: 'Panjang' },
  { id: 'ponytail', label: 'Kuncir' },
  { id: 'hijab_clean', label: 'Hijab' },
  { id: 'hijab_motif', label: 'Hijab Motif' },
];

const OUTFIT_PRESET_OPTIONS: { id: OutfitPresetId; label: string }[] = [
  { id: 'kasual', label: 'Kasual' },
  { id: 'batik', label: 'Batik' },
  { id: 'kebaya', label: 'Kebaya' },
  { id: 'santri', label: 'Santri' },
  { id: 'pelajar', label: 'Pelajar' },
  { id: 'dinas', label: 'Dinas' },
];

export const CharacterCreator: React.FC = () => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('laki-laki');
  const [skinColor, setSkinColor] = useState(SKIN_PRESETS[1]);
  const [hairColor, setHairColor] = useState(HAIR_PRESETS[0]);
  const [shirtColor, setShirtColor] = useState(SHIRT_PRESETS[0]);
  const [pantsColor, setPantsColor] = useState(PANTS_PRESETS[0]);
  const [hairStyle, setHairStyle] = useState<HairStyleId>('spiky');
  const [hijabColor, setHijabColor] = useState(HIJAB_PRESETS[0]);
  const [outfitPreset, setOutfitPreset] = useState<OutfitPresetId>('kasual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenderChange = (nextGender: Gender) => {
    setGender(nextGender);
    if (nextGender === 'perempuan' && (hairStyle === 'spiky' || hairStyle === 'neat_part')) {
      setHairStyle('wavy_lob');
    } else if (nextGender === 'laki-laki' && (hairStyle === 'wavy_lob' || hairStyle === 'hijab_clean' || hairStyle === 'hijab_motif')) {
      setHairStyle('spiky');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!/^[a-zA-Z0-9 _.-]{3,20}$/.test(trimmed)) {
      setError('Nama harus 3–20 karakter (huruf, angka, spasi, _, ., -).');
      return;
    }

    const payload: CreateCharacterPayload = {
      name: trimmed,
      gender,
      skinColor,
      hairColor,
      shirtColor,
      pantsColor,
    };

    saveLocalAvatarStyle(auth.currentUser?.uid, {
      hairStyle,
      hijabColor,
      outfitPreset,
      headwear: outfitPreset === 'santri' && gender === 'laki-laki' ? 'peci' : 'none',
    });

    setSubmitting(true);
    try {
      await callCreateCharacter(payload);
    } catch (err) {
      setError((err as Error)?.message || 'Gagal nyieun karakter.');
    } finally {
      setSubmitting(false);
    }
  };

  const isHijabSelected = hairStyle === 'hijab_clean' || hairStyle === 'hijab_motif';

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overscroll-y-contain touch-pan-y bg-slate-950 text-slate-100 px-4 pt-6 pb-10 sm:py-8">
      <div className="mx-auto flex min-h-full w-full max-w-3xl items-center justify-center">
        <div className="w-full rounded-2xl border border-emerald-500/30 bg-slate-900 p-5 sm:p-7 shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h1 className="text-xl font-bold text-white">Buat Karakter Warga Cicalengka</h1>
              <p className="text-xs text-slate-400">
                Satu akun satu karakter · Modal awal{' '}
                <span className="text-emerald-300 font-semibold">Rp 100.000</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Keluar
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <CharacterPreview3D
                gender={gender}
                skinColor={skinColor}
                hairColor={hairColor}
                shirtColor={shirtColor}
                pantsColor={pantsColor}
                hairStyle={hairStyle}
                hijabColor={hijabColor}
                outfitPreset={outfitPreset}
                headwear={outfitPreset === 'santri' && gender === 'laki-laki' ? 'peci' : 'none'}
              />
              <p className="mt-2 text-center text-[11px] text-slate-400">
                Spawn awal di Peron Stasiun Cicalengka (+689m)
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nama Karakter (Unik)
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={20}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kang Ujang"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Jenis Kelamin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['laki-laki', 'perempuan'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGenderChange(g)}
                      className={`rounded-xl border py-2 text-xs font-semibold capitalize ${
                        gender === g
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-950 text-slate-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gaya Rambut / Hijab
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {HAIR_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setHairStyle(opt.id)}
                      className={`rounded-lg border px-1.5 py-1.5 text-[11px] font-medium ${
                        hairStyle === opt.id
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gaya Busana
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {OUTFIT_PRESET_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOutfitPreset(opt.id)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                        outfitPreset === opt.id
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <ColorPickerRow
                label="Warna Kulit"
                presets={SKIN_PRESETS}
                value={skinColor}
                onChange={setSkinColor}
              />
              {isHijabSelected ? (
                <ColorPickerRow
                  label="Warna Hijab"
                  presets={HIJAB_PRESETS}
                  value={hijabColor}
                  onChange={setHijabColor}
                />
              ) : (
                <ColorPickerRow
                  label="Warna Rambut"
                  presets={HAIR_PRESETS}
                  value={hairColor}
                  onChange={setHairColor}
                />
              )}
              <ColorPickerRow
                label="Warna Baju"
                presets={SHIRT_PRESETS}
                value={shirtColor}
                onChange={setShirtColor}
              />
              <ColorPickerRow
                label="Warna Celana"
                presets={PANTS_PRESETS}
                value={pantsColor}
                onChange={setPantsColor}
              />

              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {submitting ? 'Menyimpan ke Firestore...' : 'Masuk Dunia Cicalengka'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const ColorPickerRow: React.FC<{
  label: string;
  presets: string[];
  value: string;
  onChange: (c: string) => void;
}> = ({ label, presets, value, onChange }) => (
  <div>
    <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
      <span>{label}</span>
      <span className="font-mono text-[10px] text-slate-400">{value}</span>
    </div>
    <div className="flex items-center gap-2">
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`h-7 w-7 rounded-lg border-2 ${
            value.toLowerCase() === c.toLowerCase() ? 'border-white scale-105' : 'border-slate-700'
          }`}
          aria-label={`${label} ${c}`}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded bg-transparent border-0 p-0"
        aria-label={`Pilih ${label} kustom`}
      />
    </div>
  </div>
);
