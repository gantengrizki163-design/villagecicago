import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Gender, PlayerAnimState } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export const SKIN_TONE_PRESETS = [
  '#F6D2B5',
  '#E8B88E',
  '#D2996C',
  '#B87A4B',
  '#8F5733',
  '#6B3E26',
] as const;

export type HairStyleId =
  | 'spiky'
  | 'neat_part'
  | 'bob'
  | 'long_parted'
  | 'ponytail'
  | 'wavy_lob'
  | 'sanggul'
  | 'hijab_clean'
  | 'hijab_motif';

export type OutfitPresetId =
  | 'kasual'
  | 'batik'
  | 'kebaya'
  | 'pelajar'
  | 'proyek'
  | 'ojol'
  | 'santri'
  | 'dinas'
  | 'polisi'
  | 'petani'
  | 'pedagang';

export type CharacterHeadwearId =
  | 'none'
  | 'peci'
  | 'caping'
  | 'helm_proyek'
  | 'topi_sd'
  | 'topi_polisi'
  | 'baret_polisi'
  | 'topi_satpam';

export type CharacterHeldPropId =
  | 'none'
  | 'keranjang'
  | 'helm_ojol'
  | 'cangkul'
  | 'buku'
  | 'berkas'
  | 'tablet'
  | 'pentungan';

export interface CharacterLowPolyProps {
  assetId?: string;
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  anim?: PlayerAnimState;
  autoRotate?: boolean;
  castShadow?: boolean;
  scale?: number;
  hairStyle?: HairStyleId;
  hijabColor?: string;
  outfitPreset?: OutfitPresetId;
  headwear?: CharacterHeadwearId;
  heldProp?: CharacterHeldPropId;
  hasGlasses?: boolean;
  hasBackpack?: boolean;
  hasApron?: boolean;
  hasTie?: boolean;
  tieColor?: string;
  isPoliceAlert?: boolean;
  ridingHelmet?: boolean;
}

const EYE_WHITE_MAT = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.25 });
const EYE_PUPIL_MAT = new THREE.MeshStandardMaterial({ color: '#241812', roughness: 0.2 });
const CATCHLIGHT_MAT = new THREE.MeshStandardMaterial({
  color: '#FFFFFF',
  emissive: '#FFFFFF',
  emissiveIntensity: 0.35,
  roughness: 0.1,
});
const MOUTH_MAT = new THREE.MeshStandardMaterial({ color: '#8C4D3B', roughness: 0.7 });
const BLUSH_MAT = new THREE.MeshStandardMaterial({
  color: '#E88B7D',
  roughness: 0.85,
  transparent: true,
  opacity: 0.45,
});
const SHOE_SOLE_MAT = new THREE.MeshStandardMaterial({ color: '#F3EFE8', roughness: 0.85 });
const GLASSES_MAT = new THREE.MeshStandardMaterial({ color: '#1F242D', roughness: 0.35, metalness: 0.45 });
const BELT_LEATHER_MAT = new THREE.MeshStandardMaterial({ color: '#27201B', roughness: 0.62, metalness: 0.08 });
const BELT_BUCKLE_MAT = new THREE.MeshStandardMaterial({ color: '#D9DCE2', roughness: 0.25, metalness: 0.78 });

/**
 * Karakter low-poly stylized (4.5-5 proporsi kepala, tinggi ~1.70m, pivot bottom-center y=0)
 * mengacu pada lembar turnaround pria/wanita, variasi kustomisasi Indonesia, dan lineup NPC.
 * Mendukung animasi idle/walk berbasis exponential damping dan fallback GLB via AssetModelLoader.
 */
export const CharacterLowPoly: React.FC<CharacterLowPolyProps> = ({
  assetId,
  gender,
  skinColor,
  hairColor,
  shirtColor,
  pantsColor,
  anim = 'idle',
  autoRotate = false,
  castShadow = true,
  scale = 1,
  hairStyle,
  hijabColor = '#F4F1EA',
  outfitPreset = 'kasual',
  headwear = 'none',
  heldProp = 'none',
  hasGlasses = false,
  hasBackpack = false,
  hasApron = false,
  hasTie = false,
  tieColor = '#D64937',
  isPoliceAlert = false,
  ridingHelmet = false,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const pelvisRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);

  const resolvedHairStyle: HairStyleId =
    hairStyle ?? (gender === 'perempuan' ? 'wavy_lob' : 'spiky');

  const isHijab = resolvedHairStyle === 'hijab_clean' || resolvedHairStyle === 'hijab_motif';
  const isFemale = gender === 'perempuan';
  const isSkirtOrJarik = outfitPreset === 'kebaya' || outfitPreset === 'santri';
  const isLongSleeve =
    outfitPreset === 'proyek' ||
    outfitPreset === 'ojol' ||
    outfitPreset === 'polisi' ||
    outfitPreset === 'santri' ||
    outfitPreset === 'dinas' ||
    outfitPreset === 'petani';
  const isBoots = outfitPreset === 'polisi' || outfitPreset === 'proyek';
  const isSandals = outfitPreset === 'kebaya' || outfitPreset === 'petani';
  const isShorts = outfitPreset === 'pelajar' && !isFemale;

  const skinMat = useMemo(
    () => getCustomColorMaterial(skinColor || '#E8B88E', { roughness: 0.78 }),
    [skinColor]
  );
  const hairMat = useMemo(
    () => getCustomColorMaterial(hairColor || '#261D18', { roughness: 0.86, flatShading: true }),
    [hairColor]
  );
  const shirtMat = useMemo(
    () => getCustomColorMaterial(shirtColor || '#F4EFE8', { roughness: 0.82 }),
    [shirtColor]
  );
  const pantsMat = useMemo(
    () => getCustomColorMaterial(pantsColor || '#486C9E', { roughness: 0.84 }),
    [pantsColor]
  );
  const hijabMat = useMemo(
    () => getCustomColorMaterial(hijabColor || '#F4F1EA', { roughness: 0.85 }),
    [hijabColor]
  );
  const tieMat = useMemo(
    () => getCustomColorMaterial(tieColor || '#D64937', { roughness: 0.76 }),
    [tieColor]
  );

  // Material sekunder dari palet resmi STYLE_GUIDE.md
  const cuffMat = useMemo(() => getCustomColorMaterial('#6488B8', { roughness: 0.84 }), []);
  const shoeUpperMat = useMemo(
    () =>
      isBoots
        ? getCustomColorMaterial(outfitPreset === 'polisi' ? '#1E242D' : '#6F492C', { roughness: 0.64 })
        : isSandals
          ? getPaletteMaterial('wood_dark')
          : getCustomColorMaterial('#525864', { roughness: 0.72 }),
    [isBoots, isSandals, outfitPreset]
  );
  const collarMat = useMemo(
    () =>
      outfitPreset === 'kasual'
        ? getCustomColorMaterial('#B9BDC6', { roughness: 0.84 })
        : outfitPreset === 'ojol'
          ? getCustomColorMaterial('#1F2937', { roughness: 0.78 })
          : getPaletteMaterial('flag_white'),
    [outfitPreset]
  );
  const batikAccentMat = useMemo(() => getCustomColorMaterial('#8C552B', { roughness: 0.85 }), []);
  const batikGoldMat = useMemo(() => getCustomColorMaterial('#C99A4E', { roughness: 0.82 }), []);
  const vestOrangeMat = useMemo(() => getCustomColorMaterial('#EB6D26', { roughness: 0.75 }), []);
  const hiVisStripeMat = useMemo(() => getCustomColorMaterial('#F3D34A', { roughness: 0.45 }), []);
  const jarikMat = useMemo(() => getCustomColorMaterial('#7A4D2B', { roughness: 0.86 }), []);
  const sarungMat = useMemo(() => getCustomColorMaterial('#2D634A', { roughness: 0.86 }), []);
  const strawMat = useMemo(() => getPaletteMaterial('bamboo_light'), []);
  const woodWarmMat = useMemo(() => getPaletteMaterial('wood_warm'), []);
  const steelMat = useMemo(() => getPaletteMaterial('rail_steel'), []);
  const goldMat = useMemo(() => getPaletteMaterial('trim_gold'), []);
  const redFlagMat = useMemo(() => getPaletteMaterial('flag_red'), []);
  const whiteFlagMat = useMemo(() => getPaletteMaterial('flag_white'), []);

  // Dimensi anatomi sesuai proporsi 4.5-5 kepala (~1.70m pria, ~1.66m wanita)
  const torsoWidth = isFemale ? 0.34 : 0.38;
  const shoulderX = torsoWidth / 2 + 0.055;
  const hipX = isFemale ? 0.095 : 0.105;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (autoRotate && rootRef.current) {
      rootRef.current.rotation.y += dt * 0.78;
    }

    const isWalking = anim === 'walk';
    const isDriving = anim === 'driving';
    const isPassenger = anim === 'passenger';
    const isSeated = isDriving || isPassenger;

    if (isWalking) {
      phaseRef.current += dt * 8.8;
    } else if (isSeated) {
      phaseRef.current += dt * 4.5;
    } else {
      phaseRef.current += dt * 2.1;
    }

    const phase = phaseRef.current;
    const legSwing = isWalking ? Math.sin(phase) * 0.56 : 0;
    const armSwingBase = isWalking ? Math.sin(phase) * 0.44 : Math.sin(phase * 0.7) * 0.02;
    const bob = isSeated
      ? -0.68 + Math.sin(phase * 2.2) * 0.004
      : isWalking
        ? Math.abs(Math.sin(phase)) * 0.026
        : Math.sin(phase) * 0.009;
    const torsoTwist = isWalking ? Math.sin(phase) * 0.07 : 0;
    const torsoLean = isDriving ? 0.1 : isPassenger ? 0.03 : isWalking ? 0.045 : 0;
    const idleHeadYaw = isSeated
      ? Math.sin(phase * 0.35) * 0.03
      : isWalking
        ? -torsoTwist * 0.5
        : Math.sin(phase * 0.42) * 0.055;

    // Penyesuaian pose lengan saat membawa barang (prop) atau mengemudi
    const rightArmRestX = isDriving
      ? -0.86
      : isPassenger
        ? -0.28
        : heldProp === 'cangkul'
          ? -0.58
          : heldProp === 'helm_ojol'
            ? -0.28
            : heldProp === 'buku' || heldProp === 'tablet' || heldProp === 'berkas'
              ? -0.36
              : heldProp === 'pentungan'
                ? -0.18
                : 0;
    const leftArmRestX = isDriving
      ? -0.86
      : isPassenger
        ? -0.28
        : heldProp === 'keranjang'
          ? -0.38
          : 0;
    const rightArmSwingScale = isSeated ? 0 : rightArmRestX !== 0 ? 0.25 : 1;
    const leftArmSwingScale = isSeated ? 0 : leftArmRestX !== 0 ? 0.25 : 1;

    const targetLeftLegX = isSeated ? -1.24 : isSkirtOrJarik ? legSwing * 0.45 : legSwing;
    const targetRightLegX = isSeated ? -1.24 : isSkirtOrJarik ? -legSwing * 0.45 : -legSwing;

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = THREE.MathUtils.damp(
        leftLegRef.current.rotation.x,
        targetLeftLegX,
        14,
        dt
      );
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = THREE.MathUtils.damp(
        rightLegRef.current.rotation.x,
        targetRightLegX,
        14,
        dt
      );
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.damp(
        leftArmRef.current.rotation.x,
        leftArmRestX - armSwingBase * leftArmSwingScale,
        14,
        dt
      );
      leftArmRef.current.rotation.z = THREE.MathUtils.damp(
        leftArmRef.current.rotation.z,
        isDriving ? 0.14 : heldProp === 'keranjang' ? -0.14 : -0.1,
        10,
        dt
      );
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.damp(
        rightArmRef.current.rotation.x,
        rightArmRestX + armSwingBase * rightArmSwingScale,
        14,
        dt
      );
      rightArmRef.current.rotation.z = THREE.MathUtils.damp(
        rightArmRef.current.rotation.z,
        isDriving ? -0.14 : heldProp === 'helm_ojol' ? 0.16 : 0.1,
        10,
        dt
      );
    }
    if (pelvisRef.current) {
      pelvisRef.current.position.y = THREE.MathUtils.damp(pelvisRef.current.position.y, bob, 14, dt);
      pelvisRef.current.rotation.x = THREE.MathUtils.damp(pelvisRef.current.rotation.x, torsoLean, 12, dt);
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.y = THREE.MathUtils.damp(torsoRef.current.rotation.y, torsoTwist, 12, dt);
    }
    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.damp(headRef.current.rotation.y, idleHeadYaw, 8, dt);
    }
  });

  const resolvedAssetId = assetId ?? (isFemale ? 'char_player_female' : 'char_player_male');

  const characterContent = (
    <group ref={rootRef} scale={scale}>
      <group ref={pelvisRef}>
        {/* KAKI KIRI & KANAN (pivot pinggul y = 0.70) */}
        {[-1, 1].map((side) => {
          const isLeft = side < 0;
          return (
            <group
              key={isLeft ? 'leftLeg' : 'rightLeg'}
              ref={isLeft ? leftLegRef : rightLegRef}
              position={[side * hipX, 0.7, 0]}
            >
              {/* Paha & Betis (tersembunyi rapi bila memakai jarik/sarung penuh, namun kaki tetap melangkah) */}
              {!isSkirtOrJarik && (
                <>
                  <mesh position={[0, -0.16, 0]} material={pantsMat} castShadow={castShadow}>
                    <cylinderGeometry args={[0.078, 0.068, 0.3, 8]} />
                  </mesh>
                  {isShorts ? (
                    <mesh position={[0, -0.43, 0]} material={skinMat} castShadow={castShadow}>
                      <cylinderGeometry args={[0.056, 0.048, 0.28, 8]} />
                    </mesh>
                  ) : outfitPreset === 'petani' ? (
                    <>
                      <mesh position={[0, -0.34, 0]} material={cuffMat} castShadow={castShadow}>
                        <cylinderGeometry args={[0.072, 0.072, 0.06, 8]} />
                      </mesh>
                      <mesh position={[0, -0.47, 0]} material={skinMat} castShadow={castShadow}>
                        <cylinderGeometry args={[0.055, 0.047, 0.22, 8]} />
                      </mesh>
                    </>
                  ) : (
                    <>
                      <mesh position={[0, -0.42, 0]} material={pantsMat} castShadow={castShadow}>
                        <cylinderGeometry args={[0.067, 0.06, 0.26, 8]} />
                      </mesh>
                      {/* Lipatan ujung celana (cuffed hem) sesuai turnaround */}
                      {outfitPreset === 'kasual' && (
                        <mesh position={[0, -0.54, 0]} material={cuffMat} castShadow={castShadow}>
                          <cylinderGeometry args={[0.066, 0.066, 0.055, 8]} />
                        </mesh>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Pergelangan kaki terlihat di bawah jarik/sarung */}
              {isSkirtOrJarik && (
                <mesh position={[0, -0.56, 0]} material={skinMat} castShadow={castShadow}>
                  <cylinderGeometry args={[0.048, 0.044, 0.14, 8]} />
                </mesh>
              )}

              {/* Sepatu / Sandal (y = 0..-0.70 lokal -> menyentuh tanah y = 0) */}
              {isSandals ? (
                <group position={[0, -0.66, 0.02]}>
                  <mesh position={[0, -0.024, 0]} material={shoeUpperMat} castShadow={castShadow}>
                    <boxGeometry args={[0.125, 0.026, 0.21]} />
                  </mesh>
                  <mesh position={[0, -0.003, -0.015]} material={skinMat} castShadow={castShadow}>
                    <boxGeometry args={[0.112, 0.03, 0.16]} />
                  </mesh>
                  <mesh position={[0, 0.015, 0.03]} material={shoeUpperMat}>
                    <boxGeometry args={[0.12, 0.014, 0.025]} />
                  </mesh>
                  <mesh position={[0, 0.015, -0.025]} material={shoeUpperMat}>
                    <boxGeometry args={[0.12, 0.014, 0.025]} />
                  </mesh>
                </group>
              ) : (
                <group position={[0, -0.65, 0.025]}>
                  {/* Sol putih tebal */}
                  <mesh position={[0, -0.03, 0]} material={SHOE_SOLE_MAT} castShadow={castShadow}>
                    <boxGeometry args={[0.135, 0.042, 0.23]} />
                  </mesh>
                  {/* Bodi sepatu / boots */}
                  <mesh
                    position={[0, isBoots ? 0.045 : 0.015, -0.015]}
                    material={shoeUpperMat}
                    castShadow={castShadow}
                  >
                    <boxGeometry args={[0.125, isBoots ? 0.12 : 0.068, 0.165]} />
                  </mesh>
                  {/* Ujung toe-cap putih sneaker */}
                  {!isBoots && (
                    <mesh position={[0, 0.008, 0.08]} material={SHOE_SOLE_MAT} castShadow={castShadow}>
                      <boxGeometry args={[0.12, 0.052, 0.065]} />
                    </mesh>
                  )}
                  {/* Strip tali sepatu */}
                  {!isBoots && (
                    <>
                      <mesh position={[0, 0.05, 0.025]} material={SHOE_SOLE_MAT}>
                        <boxGeometry args={[0.075, 0.01, 0.016]} />
                      </mesh>
                      <mesh position={[0, 0.05, -0.005]} material={SHOE_SOLE_MAT}>
                        <boxGeometry args={[0.075, 0.01, 0.016]} />
                      </mesh>
                    </>
                  )}
                </group>
              )}
            </group>
          );
        })}

        {/* PINGGUL / ROK / JARIK / SARUNG */}
        <group position={[0, 0.73, 0]}>
          {outfitPreset === 'kebaya' ? (
            <group position={[0, -0.25, 0]}>
              <mesh material={jarikMat} castShadow={castShadow}>
                <cylinderGeometry args={[0.175, 0.215, 0.58, 10]} />
              </mesh>
              <mesh position={[0, -0.24, 0]} material={batikGoldMat}>
                <cylinderGeometry args={[0.208, 0.218, 0.08, 10]} />
              </mesh>
            </group>
          ) : outfitPreset === 'santri' ? (
            <group position={[0, -0.24, 0]}>
              <mesh material={sarungMat} castShadow={castShadow}>
                <cylinderGeometry args={[0.18, 0.195, 0.56, 10]} />
              </mesh>
              <mesh position={[0, 0.04, 0]} material={batikGoldMat}>
                <cylinderGeometry args={[0.186, 0.19, 0.05, 10]} />
              </mesh>
            </group>
          ) : (
            <mesh material={pantsMat} castShadow={castShadow}>
              <boxGeometry args={[torsoWidth - 0.02, 0.14, 0.215]} />
            </mesh>
          )}
        </group>

        {/* TORSO, LENGAN, DAN KEPALA */}
        <group ref={torsoRef} position={[0, 0.8, 0]}>
          {/* Baju Utama dengan siluet chunky & ujung baju agak melebar */}
          <mesh position={[0, 0.2, 0]} material={shirtMat} castShadow={castShadow}>
            <cylinderGeometry args={[torsoWidth * 0.56, torsoWidth * 0.52, 0.44, 8]} />
          </mesh>
          {/* Bahu membulat agar sambungan lengan natural */}
          <mesh position={[0, 0.37, 0]} material={shirtMat} castShadow={castShadow}>
            <boxGeometry args={[torsoWidth, 0.12, 0.22]} />
          </mesh>
          {/* Kerah baju / leher baju */}
          <mesh position={[0, 0.43, 0.01]} material={collarMat}>
            <cylinderGeometry args={[0.086, 0.098, 0.04, 10]} />
          </mesh>

          {/* Aksen Pakaian Spesifik Profesi / Gaya */}
          {outfitPreset === 'batik' && (
            <group>
              <mesh position={[0, 0.18, 0.108]} material={batikAccentMat}>
                <boxGeometry args={[0.22, 0.34, 0.015]} />
              </mesh>
              <mesh position={[-0.07, 0.22, 0.116]} material={batikGoldMat}>
                <boxGeometry args={[0.04, 0.22, 0.012]} />
              </mesh>
              <mesh position={[0.07, 0.22, 0.116]} material={batikGoldMat}>
                <boxGeometry args={[0.04, 0.22, 0.012]} />
              </mesh>
            </group>
          )}

          {outfitPreset === 'kebaya' && (
            <group>
              <mesh position={[0, 0.19, 0.108]} material={batikGoldMat}>
                <boxGeometry args={[0.04, 0.26, 0.016]} />
              </mesh>
              <mesh position={[0, 0.31, 0.114]} material={goldMat}>
                <sphereGeometry args={[0.018, 6, 6]} />
              </mesh>
            </group>
          )}

          {outfitPreset === 'proyek' && (
            <group>
              {/* Rompi safety oranye */}
              <mesh position={[0, 0.2, 0]} material={vestOrangeMat} castShadow={castShadow}>
                <boxGeometry args={[torsoWidth + 0.02, 0.39, 0.24]} />
              </mesh>
              {/* Strip reflektor kuning */}
              <mesh position={[0, 0.11, 0]} material={hiVisStripeMat}>
                <boxGeometry args={[torsoWidth + 0.028, 0.045, 0.248]} />
              </mesh>
              <mesh position={[0, 0.23, 0]} material={hiVisStripeMat}>
                <boxGeometry args={[torsoWidth + 0.028, 0.045, 0.248]} />
              </mesh>
            </group>
          )}

          {outfitPreset === 'ojol' && (
            <group>
              {/* Strip jaket ojol di dada & bahu */}
              <mesh position={[0, 0.26, 0.112]} material={whiteFlagMat}>
                <boxGeometry args={[torsoWidth * 0.92, 0.045, 0.015]} />
              </mesh>
              <mesh position={[0, 0.33, 0]} material={collarMat}>
                <boxGeometry args={[torsoWidth + 0.012, 0.14, 0.228]} />
              </mesh>
            </group>
          )}

          {(outfitPreset === 'polisi' || outfitPreset === 'dinas') && (
            <group>
              {/* Sabuk kopel & gesper */}
              <mesh position={[0, 0.02, 0]} material={BELT_LEATHER_MAT}>
                <boxGeometry args={[torsoWidth + 0.015, 0.055, 0.235]} />
              </mesh>
              <mesh position={[0, 0.02, 0.122]} material={BELT_BUCKLE_MAT}>
                <boxGeometry args={[0.065, 0.048, 0.014]} />
              </mesh>
              {/* Lencana / saku dada */}
              <mesh position={[-0.085, 0.28, 0.115]} material={goldMat}>
                <boxGeometry args={[0.045, 0.045, 0.014]} />
              </mesh>
              <mesh position={[0.085, 0.27, 0.113]} material={collarMat}>
                <boxGeometry args={[0.065, 0.07, 0.012]} />
              </mesh>
            </group>
          )}

          {hasTie && (
            <group position={[0, 0.24, 0.114]}>
              <mesh position={[0, 0.12, 0]} material={tieMat}>
                <boxGeometry args={[0.045, 0.045, 0.016]} />
              </mesh>
              <mesh position={[0, -0.02, 0]} material={tieMat}>
                <boxGeometry args={[0.036, 0.22, 0.014]} />
              </mesh>
            </group>
          )}

          {hasApron && (
            <group position={[0, 0.04, 0.112]}>
              <mesh material={whiteFlagMat} castShadow={castShadow}>
                <boxGeometry args={[torsoWidth * 0.78, 0.56, 0.022]} />
              </mesh>
              <mesh position={[-0.06, 0, 0.012]} material={steelMat}>
                <boxGeometry args={[0.02, 0.54, 0.008]} />
              </mesh>
              <mesh position={[0.06, 0, 0.012]} material={steelMat}>
                <boxGeometry args={[0.02, 0.54, 0.008]} />
              </mesh>
            </group>
          )}

          {hasBackpack && (
            <group position={[0, 0.21, -0.155]}>
              <mesh material={redFlagMat} castShadow={castShadow}>
                <boxGeometry args={[0.26, 0.32, 0.12]} />
              </mesh>
              <mesh position={[0, -0.04, -0.055]} material={batikAccentMat}>
                <boxGeometry args={[0.2, 0.14, 0.04]} />
              </mesh>
            </group>
          )}

          {/* Leher */}
          <mesh position={[0, 0.46, 0]} material={skinMat} castShadow={castShadow}>
            <cylinderGeometry args={[0.058, 0.068, 0.11, 8]} />
          </mesh>

          {/* KEPALA, WAJAH & RAMBUT/HIJAB (pivot leher y = 0.50 lokal -> ~1.30m dunia) */}
          <group ref={headRef} position={[0, 0.51, 0]}>
            {/* Kepala low-poly membulat lembut (4.5-5 head proportion) */}
            <mesh position={[0, 0.165, 0]} scale={[0.98, 1.04, 0.96]} material={skinMat} castShadow={castShadow}>
              <sphereGeometry args={[0.175, 12, 9]} />
            </mesh>
            {/* Telinga kiri & kanan */}
            {!isHijab && (
              <>
                <mesh position={[-0.172, 0.15, -0.01]} scale={[0.55, 0.85, 0.65]} material={skinMat} castShadow={castShadow}>
                  <sphereGeometry args={[0.042, 7, 6]} />
                </mesh>
                <mesh position={[0.172, 0.15, -0.01]} scale={[0.55, 0.85, 0.65]} material={skinMat} castShadow={castShadow}>
                  <sphereGeometry args={[0.042, 7, 6]} />
                </mesh>
              </>
            )}

            {/* Wajah ramah (Mata besar + catchlight + alis + hidung kecil + senyum tipis) */}
            <group position={[0, 0.16, 0]}>
              {[-1, 1].map((side) => (
                <group key={side}>
                  {/* Putih mata */}
                  <mesh position={[side * 0.058, 0.01, 0.152]} scale={[0.85, 1.05, 0.4]} material={EYE_WHITE_MAT}>
                    <sphereGeometry args={[0.028, 8, 6]} />
                  </mesh>
                  {/* Pupil cokelat tua */}
                  <mesh position={[side * 0.058, 0.01, 0.16]} scale={[0.82, 1.02, 0.45]} material={EYE_PUPIL_MAT}>
                    <sphereGeometry args={[0.02, 8, 6]} />
                  </mesh>
                  {/* Kilau putih mata (catchlight) */}
                  <mesh position={[side * 0.065, 0.019, 0.168]} material={CATCHLIGHT_MAT}>
                    <sphereGeometry args={[0.0065, 6, 5]} />
                  </mesh>
                  {/* Alis melengkung */}
                  <mesh
                    position={[side * 0.058, 0.054, 0.156]}
                    rotation={[0, 0, side * -0.1]}
                    material={hairMat}
                  >
                    <boxGeometry args={[0.054, 0.015, 0.015]} />
                  </mesh>
                  {/* Rona pipi halus */}
                  {isFemale && (
                    <mesh position={[side * 0.088, -0.026, 0.142]} scale={[1.1, 0.65, 0.35]} material={BLUSH_MAT}>
                      <sphereGeometry args={[0.022, 6, 5]} />
                    </mesh>
                  )}
                </group>
              ))}
              {/* Hidung kecil */}
              <mesh position={[0, -0.016, 0.172]} scale={[0.8, 0.9, 1]} material={skinMat}>
                <sphereGeometry args={[0.016, 6, 5]} />
              </mesh>
              {/* Senyum tipis */}
              <mesh position={[0, -0.056, 0.158]} rotation={[0.12, 0, 0]} material={MOUTH_MAT}>
                <boxGeometry args={[0.058, 0.011, 0.012]} />
              </mesh>

              {/* Kacamata (Guru / Pejabat Desa) */}
              {hasGlasses && (
                <group position={[0, 0.012, 0.174]}>
                  <mesh position={[-0.058, 0, 0]} material={GLASSES_MAT}>
                    <boxGeometry args={[0.068, 0.052, 0.012]} />
                  </mesh>
                  <mesh position={[0.058, 0, 0]} material={GLASSES_MAT}>
                    <boxGeometry args={[0.068, 0.052, 0.012]} />
                  </mesh>
                  <mesh position={[0, 0.01, 0]} material={GLASSES_MAT}>
                    <boxGeometry args={[0.04, 0.01, 0.01]} />
                  </mesh>
                </group>
              )}
            </group>

            {/* GAYA RAMBUT / HIJAB */}
            {resolvedHairStyle === 'spiky' && (
              <group position={[0, 0.17, 0]}>
                <mesh position={[0, 0.12, -0.015]} scale={[1.06, 0.72, 1.06]} material={hairMat} castShadow={castShadow}>
                  <icosahedronGeometry args={[0.175, 1]} />
                </mesh>
                <mesh position={[-0.05, 0.19, 0.06]} rotation={[0.35, 0, 0.3]} material={hairMat} castShadow={castShadow}>
                  <coneGeometry args={[0.065, 0.12, 5]} />
                </mesh>
                <mesh position={[0.04, 0.2, 0.05]} rotation={[0.25, 0, -0.28]} material={hairMat} castShadow={castShadow}>
                  <coneGeometry args={[0.07, 0.13, 5]} />
                </mesh>
                <mesh position={[0, 0.18, -0.06]} rotation={[-0.35, 0, 0]} material={hairMat} castShadow={castShadow}>
                  <coneGeometry args={[0.08, 0.12, 5]} />
                </mesh>
                <mesh position={[0, 0.02, -0.115]} scale={[1.02, 0.92, 0.62]} material={hairMat} castShadow={castShadow}>
                  <icosahedronGeometry args={[0.165, 1]} />
                </mesh>
              </group>
            )}

            {resolvedHairStyle === 'neat_part' && (
              <group position={[0, 0.17, 0]}>
                <mesh position={[0, 0.11, -0.01]} scale={[1.04, 0.68, 1.04]} material={hairMat} castShadow={castShadow}>
                  <icosahedronGeometry args={[0.172, 1]} />
                </mesh>
                <mesh position={[0.04, 0.145, 0.075]} rotation={[0.15, 0.2, -0.18]} material={hairMat}>
                  <boxGeometry args={[0.17, 0.07, 0.13]} />
                </mesh>
                <mesh position={[0, 0.015, -0.115]} scale={[1.0, 0.9, 0.6]} material={hairMat}>
                  <icosahedronGeometry args={[0.16, 1]} />
                </mesh>
              </group>
            )}

            {resolvedHairStyle === 'bob' && (
              <group position={[0, 0.17, 0]}>
                <mesh position={[0, 0.11, -0.02]} scale={[1.08, 0.72, 1.08]} material={hairMat} castShadow={castShadow}>
                  <icosahedronGeometry args={[0.175, 1]} />
                </mesh>
                <mesh position={[0, 0.095, 0.115]} material={hairMat}>
                  <boxGeometry args={[0.28, 0.07, 0.08]} />
                </mesh>
                <mesh position={[-0.145, -0.03, -0.02]} material={hairMat} castShadow={castShadow}>
                  <boxGeometry args={[0.09, 0.24, 0.26]} />
                </mesh>
                <mesh position={[0.145, -0.03, -0.02]} material={hairMat} castShadow={castShadow}>
                  <boxGeometry args={[0.09, 0.24, 0.26]} />
                </mesh>
                <mesh position={[0, -0.03, -0.14]} material={hairMat} castShadow={castShadow}>
                  <boxGeometry args={[0.32, 0.26, 0.11]} />
                </mesh>
              </group>
            )}

            {(resolvedHairStyle === 'wavy_lob' || resolvedHairStyle === 'long_parted') && (
              <group position={[0, 0.17, 0]}>
                <mesh position={[0, 0.11, -0.02]} scale={[1.08, 0.72, 1.08]} material={hairMat} castShadow={castShadow}>
                  <icosahedronGeometry args={[0.175, 1]} />
                </mesh>
                {/* Poni belah samping */}
                <mesh position={[-0.08, 0.09, 0.115]} rotation={[0.1, 0, 0.28]} material={hairMat}>
                  <boxGeometry args={[0.15, 0.07, 0.09]} />
                </mesh>
                <mesh position={[0.09, 0.09, 0.115]} rotation={[0.1, 0, -0.25]} material={hairMat}>
                  <boxGeometry args={[0.13, 0.065, 0.09]} />
                </mesh>
                {/* Rambut sebahu / panjang di belakang & sisi */}
                <mesh
                  position={[0, resolvedHairStyle === 'long_parted' ? -0.12 : -0.06, -0.14]}
                  material={hairMat}
                  castShadow={castShadow}
                >
                  <boxGeometry args={[0.32, resolvedHairStyle === 'long_parted' ? 0.42 : 0.3, 0.12]} />
                </mesh>
                <mesh position={[-0.145, -0.05, -0.04]} rotation={[0, 0, 0.12]} material={hairMat} castShadow={castShadow}>
                  <boxGeometry args={[0.09, 0.28, 0.18]} />
                </mesh>
                <mesh position={[0.145, -0.05, -0.04]} rotation={[0, 0, -0.12]} material={hairMat} castShadow={castShadow}>
                  <boxGeometry args={[0.09, 0.28, 0.18]} />
                </mesh>
              </group>
            )}

            {(resolvedHairStyle === 'ponytail' || resolvedHairStyle === 'sanggul') && (
              <group position={[0, 0.17, 0]}>
                <mesh position={[0, 0.1, -0.015]} scale={[1.05, 0.7, 1.05]} material={hairMat} castShadow={castShadow}>
                  <icosahedronGeometry args={[0.172, 1]} />
                </mesh>
                <mesh position={[0, 0.01, -0.12]} scale={[1.0, 0.9, 0.58]} material={hairMat}>
                  <icosahedronGeometry args={[0.16, 1]} />
                </mesh>
                {resolvedHairStyle === 'ponytail' ? (
                  <mesh position={[0, -0.04, -0.22]} rotation={[0.35, 0, 0]} material={hairMat} castShadow={castShadow}>
                    <coneGeometry args={[0.07, 0.28, 7]} />
                  </mesh>
                ) : (
                  <mesh position={[0, 0.01, -0.2]} material={hairMat} castShadow={castShadow}>
                    <sphereGeometry args={[0.088, 8, 7]} />
                  </mesh>
                )}
              </group>
            )}

            {isHijab && (
              <group position={[0, 0.16, -0.01]}>
                {/* Kerudung membungkus kepala & leher */}
                <mesh position={[0, 0.045, -0.015]} scale={[1.12, 1.12, 1.1]} material={hijabMat} castShadow={castShadow}>
                  <sphereGeometry args={[0.176, 10, 8]} />
                </mesh>
                {/* Drapery menutup leher dan bahu depan */}
                <mesh position={[0, -0.19, 0.02]} material={hijabMat} castShadow={castShadow}>
                  <cylinderGeometry args={[0.155, 0.215, 0.22, 10]} />
                </mesh>
                {resolvedHairStyle === 'hijab_motif' && (
                  <mesh position={[0, -0.11, 0.16]} material={batikGoldMat}>
                    <boxGeometry args={[0.18, 0.03, 0.05]} />
                  </mesh>
                )}
              </group>
            )}

            {/* PENUTUP KEPALA (Peci, Caping, Helm Proyek, Topi SD, Topi Polisi, Baret) */}
            {headwear === 'peci' && (
              <mesh position={[0, 0.34, -0.01]} material={BELT_LEATHER_MAT} castShadow={castShadow}>
                <cylinderGeometry args={[0.145, 0.155, 0.11, 12]} />
              </mesh>
            )}

            {headwear === 'caping' && (
              <group position={[0, 0.37, 0]}>
                <mesh material={strawMat} castShadow={castShadow}>
                  <coneGeometry args={[0.32, 0.17, 14]} />
                </mesh>
                <mesh position={[0, -0.055, 0]} material={batikAccentMat}>
                  <cylinderGeometry args={[0.16, 0.17, 0.03, 12]} />
                </mesh>
              </group>
            )}

            {headwear === 'helm_proyek' && (
              <group position={[0, 0.32, 0]}>
                <mesh material={hiVisStripeMat} castShadow={castShadow}>
                  <sphereGeometry args={[0.195, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                </mesh>
                <mesh position={[0, 0.01, 0.14]} material={hiVisStripeMat}>
                  <boxGeometry args={[0.24, 0.025, 0.12]} />
                </mesh>
                <mesh position={[0, 0.16, 0]} material={vestOrangeMat}>
                  <boxGeometry args={[0.05, 0.04, 0.22]} />
                </mesh>
              </group>
            )}

            {headwear === 'topi_sd' && (
              <group position={[0, 0.32, 0]}>
                <mesh material={redFlagMat} castShadow={castShadow}>
                  <sphereGeometry args={[0.185, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                </mesh>
                <mesh position={[0, 0.075, 0.14]} material={whiteFlagMat}>
                  <boxGeometry args={[0.12, 0.055, 0.08]} />
                </mesh>
                <mesh position={[0, 0.01, 0.17]} material={redFlagMat}>
                  <boxGeometry args={[0.2, 0.02, 0.12]} />
                </mesh>
              </group>
            )}

            {(headwear === 'topi_polisi' || headwear === 'topi_satpam') && (
              <group position={[0, 0.34, 0]}>
                <mesh
                  position={[0, 0.03, 0]}
                  material={headwear === 'topi_satpam' ? sarungMat : BELT_LEATHER_MAT}
                  castShadow={castShadow}
                >
                  <cylinderGeometry args={[0.195, 0.165, 0.09, 10]} />
                </mesh>
                <mesh position={[0, -0.02, 0.16]} material={BELT_LEATHER_MAT}>
                  <boxGeometry args={[0.22, 0.022, 0.12]} />
                </mesh>
                <mesh position={[0, 0.035, 0.175]} material={goldMat}>
                  <boxGeometry args={[0.045, 0.045, 0.015]} />
                </mesh>
              </group>
            )}

            {headwear === 'baret_polisi' && (
              <group position={[0.02, 0.34, -0.01]} rotation={[0.05, 0, -0.18]}>
                <mesh material={batikAccentMat} castShadow={castShadow}>
                  <cylinderGeometry args={[0.19, 0.155, 0.085, 12]} />
                </mesh>
                <mesh position={[0.07, 0.0, 0.15]} material={goldMat}>
                  <boxGeometry args={[0.045, 0.045, 0.015]} />
                </mesh>
              </group>
            )}

            {/* Helm berkendara motor SNI low-poly */}
            {ridingHelmet && (
              <group position={[0, 0.2, 0]}>
                <mesh material={BELT_LEATHER_MAT} castShadow={castShadow}>
                  <sphereGeometry args={[0.205, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.68]} />
                </mesh>
                <mesh position={[0, -0.02, 0.16]} material={GLASSES_MAT}>
                  <boxGeometry args={[0.26, 0.095, 0.1]} />
                </mesh>
                <mesh position={[0, 0.14, 0]} material={redFlagMat}>
                  <boxGeometry args={[0.045, 0.03, 0.24]} />
                </mesh>
              </group>
            )}

            {/* Indikator sirine merah di atas kepala saat polisi mengejar laporan */}
            {isPoliceAlert && (
              <mesh position={[0, 0.54, 0]}>
                <sphereGeometry args={[0.075, 6, 6]} />
                <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={1.8} />
              </mesh>
            )}
          </group>

          {/* LENGAN KIRI & KANAN (pivot bahu y = 0.40 lokal -> ~1.20m dunia) */}
          {[-1, 1].map((side) => {
            const isLeft = side < 0;
            return (
              <group
                key={isLeft ? 'leftArm' : 'rightArm'}
                ref={isLeft ? leftArmRef : rightArmRef}
                position={[side * shoulderX, 0.39, 0]}
              >
                {/* Lengan baju atas */}
                <mesh position={[0, -0.09, 0]} material={shirtMat} castShadow={castShadow}>
                  <cylinderGeometry args={[0.06, 0.066, 0.18, 8]} />
                </mesh>
                {/* Lengan bawah: panjang vs pendek */}
                <mesh
                  position={[0, -0.27, 0]}
                  material={isLongSleeve ? shirtMat : skinMat}
                  castShadow={castShadow}
                >
                  <cylinderGeometry args={[0.052, 0.044, 0.21, 8]} />
                </mesh>
                {/* Tangan chunky */}
                <mesh
                  position={[0, -0.4, 0.008]}
                  material={outfitPreset === 'proyek' ? BELT_LEATHER_MAT : skinMat}
                  castShadow={castShadow}
                >
                  <boxGeometry args={[0.072, 0.088, 0.062]} />
                </mesh>

                {/* Barang bawaan di tangan kiri (Keranjang anyaman) */}
                {isLeft && heldProp === 'keranjang' && (
                  <group position={[-0.04, -0.46, 0.06]}>
                    <mesh material={strawMat} castShadow={castShadow}>
                      <cylinderGeometry args={[0.14, 0.1, 0.18, 8]} />
                    </mesh>
                    <mesh position={[0, 0.11, 0]} material={woodWarmMat}>
                      <torusGeometry args={[0.11, 0.014, 6, 12, Math.PI]} />
                    </mesh>
                  </group>
                )}

                {/* Barang bawaan di tangan kanan */}
                {!isLeft && heldProp === 'helm_ojol' && (
                  <group position={[0.06, -0.4, 0.05]}>
                    <mesh material={shirtMat} castShadow={castShadow}>
                      <sphereGeometry args={[0.135, 10, 8]} />
                    </mesh>
                    <mesh position={[0, -0.02, 0.1]} material={BELT_LEATHER_MAT}>
                      <boxGeometry args={[0.16, 0.075, 0.07]} />
                    </mesh>
                  </group>
                )}

                {!isLeft && heldProp === 'cangkul' && (
                  <group position={[0.03, -0.28, -0.02]} rotation={[0.92, 0, 0.05]}>
                    <mesh position={[0, 0.35, 0]} material={woodWarmMat} castShadow={castShadow}>
                      <cylinderGeometry args={[0.022, 0.022, 1.05, 6]} />
                    </mesh>
                    <mesh position={[0, 0.85, 0.09]} rotation={[0.3, 0, 0]} material={steelMat} castShadow={castShadow}>
                      <boxGeometry args={[0.18, 0.025, 0.2]} />
                    </mesh>
                  </group>
                )}

                {!isLeft && (heldProp === 'buku' || heldProp === 'berkas' || heldProp === 'tablet') && (
                  <mesh
                    position={[-0.08, -0.36, 0.13]}
                    rotation={[0.4, 0.3, 0.2]}
                    material={
                      heldProp === 'tablet'
                        ? BELT_LEATHER_MAT
                        : heldProp === 'buku'
                          ? batikAccentMat
                          : whiteFlagMat
                    }
                    castShadow={castShadow}
                  >
                    <boxGeometry args={[0.18, 0.24, 0.035]} />
                  </mesh>
                )}

                {!isLeft && heldProp === 'pentungan' && (
                  <mesh position={[0, -0.44, 0.12]} rotation={[Math.PI / 2.4, 0, 0]} material={BELT_LEATHER_MAT}>
                    <cylinderGeometry args={[0.02, 0.024, 0.38, 6]} />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );

  return (
    <AssetModelLoader assetId={resolvedAssetId} castShadow={castShadow}>
      {characterContent}
    </AssetModelLoader>
  );
};
