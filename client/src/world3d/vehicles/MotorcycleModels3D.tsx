import React from 'react';
import { getCustomColorMaterial, getPaletteMaterial } from '../assets/paletteMaterials';
import type { VehicleSharedMaterials } from './vehicleMaterials';

export interface MotorcycleMeshProps {
  subType: string;
  mats: VehicleSharedMaterials;
  castShadow: boolean;
  lod: 'full' | 'simple';
  steerAngle: number;
  wheelSpinRad: number;
  accessories?: string[];
}

const MotoWheel: React.FC<{
  radius: number;
  width: number;
  mats: VehicleSharedMaterials;
  castShadow: boolean;
  spin: number;
  simple?: boolean;
  hubCover?: boolean;
}> = ({ radius, width, mats, castShadow, spin, simple, hubCover }) => (
  <group rotation={[spin, 0, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]} material={mats.tire} castShadow={castShadow}>
      <cylinderGeometry args={[radius, radius, width, simple ? 8 : 12]} />
    </mesh>
    {!simple && (
      <mesh rotation={[0, 0, Math.PI / 2]} material={hubCover ? mats.accentDark : mats.rim}>
        <cylinderGeometry args={[radius * 0.58, radius * 0.58, width + 0.015, 8]} />
      </mesh>
    )}
    {hubCover && !simple && (
      <mesh rotation={[0, 0, Math.PI / 2]} material={mats.evAccent}>
        <cylinderGeometry args={[radius * 0.28, radius * 0.28, width + 0.025, 8]} />
      </mesh>
    )}
  </group>
);

export const MotorcycleModelMesh: React.FC<MotorcycleMeshProps> = ({
  subType,
  mats,
  castShadow,
  lod,
  steerAngle,
  wheelSpinRad,
  accessories = [],
}) => {
  const hasBox = subType === 'ojek' || accessories.includes('box_kurir');
  const hasLedBar = accessories.includes('lampu_led');
  const hasSportExhaust = accessories.includes('knalpot_sport');

  if (subType === 'becak') {
    const frameBlueMat = getCustomColorMaterial('#4E8FB3', { roughness: 0.55, metalness: 0.25 });
    const redMat = getPaletteMaterial('tarp_red');
    const yellowMat = getPaletteMaterial('tarp_yellow');
    const blueMat = getPaletteMaterial('tarp_blue');
    const creamMat = getPaletteMaterial('wall_cream');

    if (lod === 'simple') {
      return (
        <group>
          <mesh position={[0, 0.56, 0.2]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.92, 0.44, 1.3]} />
          </mesh>
          <mesh position={[0, 1.48, 0.25]} material={blueMat}>
            <boxGeometry args={[0.98, 0.14, 0.92]} />
          </mesh>
          <mesh position={[-0.48, 0.3, 0.4]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
            <cylinderGeometry args={[0.3, 0.3, 0.08, 8]} />
          </mesh>
          <mesh position={[0.48, 0.3, 0.4]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
            <cylinderGeometry args={[0.3, 0.3, 0.08, 8]} />
          </mesh>
          <mesh position={[0, 0.28, -0.75]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
            <cylinderGeometry args={[0.28, 0.28, 0.08, 8]} />
          </mesh>
        </group>
      );
    }

    return (
      <group>
        {[-0.5, 0.5].map((wx) => (
          <group key={wx} position={[wx, 0.32, 0.42]}>
            <MotoWheel radius={0.32} width={0.08} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
          </group>
        ))}
        <group position={[0, 0.28, -0.78]}>
          <MotoWheel radius={0.28} width={0.08} mats={mats} castShadow={castShadow} spin={wheelSpinRad} />
        </group>
        <mesh position={[0, 0.32, 0.42]} rotation={[0, 0, Math.PI / 2]} material={frameBlueMat}>
          <cylinderGeometry args={[0.03, 0.03, 0.96, 8]} />
        </mesh>
        <mesh position={[0, 0.38, -0.15]} material={frameBlueMat} castShadow={castShadow}>
          <boxGeometry args={[0.12, 0.08, 1.35]} />
        </mesh>
        <mesh position={[0, 0.48, 0.34]} material={creamMat} castShadow={castShadow}>
          <boxGeometry args={[0.84, 0.24, 0.72]} />
        </mesh>
        <mesh position={[0, 0.64, 0.36]} material={redMat} castShadow={castShadow}>
          <boxGeometry args={[0.74, 0.14, 0.52]} />
        </mesh>
        <mesh position={[0, 0.92, 0.06]} material={redMat} castShadow={castShadow}>
          <boxGeometry args={[0.78, 0.46, 0.14]} />
        </mesh>
        <mesh position={[-0.41, 0.74, 0.34]} material={yellowMat}>
          <boxGeometry args={[0.08, 0.36, 0.68]} />
        </mesh>
        <mesh position={[0.41, 0.74, 0.34]} material={yellowMat}>
          <boxGeometry args={[0.08, 0.36, 0.68]} />
        </mesh>
        {[
          [-0.4, 1.18, 0.62],
          [0.4, 1.18, 0.62],
          [-0.4, 1.18, 0.04],
          [0.4, 1.18, 0.04],
        ].map(([px, py, pz], idx) => (
          <mesh key={idx} position={[px, py, pz]} material={mats.chrome}>
            <cylinderGeometry args={[0.02, 0.02, 0.76, 6]} />
          </mesh>
        ))}
        <group position={[0, 1.56, 0.34]}>
          <mesh position={[-0.31, 0, 0]} rotation={[0, 0, 0.14]} material={blueMat} castShadow={castShadow}>
            <boxGeometry args={[0.34, 0.06, 0.86]} />
          </mesh>
          <mesh position={[0, 0.025, 0]} material={yellowMat} castShadow={castShadow}>
            <boxGeometry args={[0.32, 0.06, 0.86]} />
          </mesh>
          <mesh position={[0.31, 0, 0]} rotation={[0, 0, -0.14]} material={redMat} castShadow={castShadow}>
            <boxGeometry args={[0.34, 0.06, 0.86]} />
          </mesh>
        </group>
        <mesh position={[0, 0.76, -0.68]} material={mats.seatDark}>
          <boxGeometry args={[0.2, 0.08, 0.24]} />
        </mesh>
        <mesh position={[0, 0.94, -0.25]} material={mats.chrome}>
          <boxGeometry args={[0.52, 0.04, 0.04]} />
        </mesh>
        <mesh position={[-0.38, 1.32, -0.1]} material={mats.chrome}>
          <cylinderGeometry args={[0.015, 0.015, 1.1, 6]} />
        </mesh>
        <mesh position={[-0.38, 1.82, -0.22]} material={mats.body}>
          <boxGeometry args={[0.02, 0.16, 0.22]} />
        </mesh>
      </group>
    );
  }

  // LOD simple untuk motor lalu lintas NPC jarak jauh
  if (lod === 'simple') {
    const r = subType === 'trail' ? 0.31 : 0.25;
    return (
      <group>
        <mesh position={[0, 0.56, 0]} material={mats.body} castShadow={castShadow}>
          <boxGeometry args={[0.34, 0.38, 1.32]} />
        </mesh>
        <mesh position={[0, 0.78, -0.18]} material={mats.seatDark}>
          <boxGeometry args={[0.26, 0.1, 0.6]} />
        </mesh>
        <mesh position={[0, r, 0.62]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
          <cylinderGeometry args={[r, r, 0.12, 8]} />
        </mesh>
        <mesh position={[0, r, -0.6]} rotation={[0, 0, Math.PI / 2]} material={mats.tire}>
          <cylinderGeometry args={[r, r, 0.14, 8]} />
        </mesh>
        {hasBox && (
          <mesh position={[0, 0.98, -0.68]} material={getCustomColorMaterial('#2563EB')}>
            <boxGeometry args={[0.44, 0.38, 0.42]} />
          </mesh>
        )}
      </group>
    );
  }

  const isTrail = subType === 'trail';
  const isSport = subType === 'sport';
  const isTua = subType === 'tua';
  const isListrik = subType === 'listrik';
  const isBebek = subType === 'bebek';
  const isMatic = subType === 'matic' || subType === 'ojek';

  const wheelR = isTrail ? 0.31 : isSport ? 0.27 : 0.25;
  const frontZ = isSport || isTrail ? 0.7 : 0.64;
  const rearZ = isSport || isTrail ? -0.66 : -0.58;
  const wheelW = isSport ? 0.16 : isTrail ? 0.11 : 0.13;

  const boxCargoMat = getCustomColorMaterial('#2563EB', { roughness: 0.6 });
  const courierAccent = getPaletteMaterial('flag_white');

  return (
    <group>
      {/* Roda Belakang */}
      <group position={[0, wheelR, rearZ]}>
        <MotoWheel
          radius={wheelR}
          width={wheelW + 0.02}
          mats={mats}
          castShadow={castShadow}
          spin={wheelSpinRad}
          hubCover={isListrik}
        />
      </group>

      {/* Fork & Roda Depan Belok */}
      <group position={[0, 0, frontZ]} rotation={[0, steerAngle, 0]}>
        <group position={[0, wheelR, 0]}>
          <MotoWheel
            radius={wheelR}
            width={wheelW}
            mats={mats}
            castShadow={castShadow}
            spin={wheelSpinRad}
            hubCover={isListrik}
          />
        </group>
        {/* Garpu depan */}
        <mesh
          position={[-0.09, isTrail ? 0.64 : 0.56, -0.06]}
          rotation={[-0.24, 0, 0]}
          material={isSport || isTrail ? mats.chrome : mats.accentDark}
        >
          <cylinderGeometry args={[0.024, 0.024, isTrail ? 0.68 : 0.56, 6]} />
        </mesh>
        <mesh
          position={[0.09, isTrail ? 0.64 : 0.56, -0.06]}
          rotation={[-0.24, 0, 0]}
          material={isSport || isTrail ? mats.chrome : mats.accentDark}
        >
          <cylinderGeometry args={[0.024, 0.024, isTrail ? 0.68 : 0.56, 6]} />
        </mesh>
        {/* Spakbor Depan */}
        <mesh
          position={[0, isTrail ? 0.72 : wheelR + 0.23, 0.02]}
          rotation={[isTrail ? -0.1 : 0.22, 0, 0]}
          material={mats.body}
          castShadow={castShadow}
        >
          <boxGeometry args={[0.17, 0.05, isTrail ? 0.44 : 0.34]} />
        </mesh>
        {/* Stang & Spion */}
        <group position={[0, isTrail ? 1.06 : isSport ? 0.92 : 1.0, -0.18]}>
          <mesh material={isTua || isTrail ? mats.chrome : mats.accentDark}>
            <boxGeometry args={[isTrail ? 0.78 : isSport ? 0.58 : 0.68, 0.045, 0.055]} />
          </mesh>
          <mesh position={[-0.28, 0.11, 0]} material={mats.accentDark}>
            <boxGeometry args={[0.09, 0.06, 0.03]} />
          </mesh>
          <mesh position={[0.28, 0.11, 0]} material={mats.accentDark}>
            <boxGeometry args={[0.09, 0.06, 0.03]} />
          </mesh>
          {isTrail && (
            <>
              <mesh position={[-0.32, 0.01, 0.05]} material={mats.body}>
                <boxGeometry args={[0.14, 0.08, 0.04]} />
              </mesh>
              <mesh position={[0.32, 0.01, 0.05]} material={mats.body}>
                <boxGeometry args={[0.14, 0.08, 0.04]} />
              </mesh>
            </>
          )}
        </group>

        {/* Lampu depan khusus model berstang putar */}
        {(isBebek || isMatic || isTrail || isTua || isListrik) && (
          <group position={[0, isTrail ? 0.94 : 0.97, -0.08]}>
            {isTua ? (
              <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.chrome}>
                <cylinderGeometry args={[0.09, 0.08, 0.12, 10]} />
              </mesh>
            ) : (
              <mesh material={mats.body} castShadow={castShadow}>
                <boxGeometry args={[0.22, 0.14, 0.18]} />
              </mesh>
            )}
            <mesh position={[0, -0.01, 0.08]} material={isListrik ? mats.evAccent : mats.headlight}>
              <boxGeometry args={[isTua ? 0.12 : 0.15, 0.1, 0.05]} />
            </mesh>
            {hasLedBar && (
              <mesh position={[0, -0.14, 0.08]} material={mats.evAccent}>
                <boxGeometry args={[0.18, 0.04, 0.05]} />
              </mesh>
            )}
          </group>
        )}
      </group>

      {/* Bodi Utama sesuai Varian */}
      {isSport ? (
        <>
          {/* Rangka tengah + mesin */}
          <mesh position={[0, 0.48, 0.02]} material={mats.accentDark} castShadow={castShadow}>
            <boxGeometry args={[0.32, 0.3, 0.95]} />
          </mesh>
          {/* Fairing samping agresif */}
          <mesh position={[0, 0.64, 0.36]} rotation={[-0.18, 0, 0]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.42, 0.42, 0.68]} />
          </mesh>
          {/* Tangki sport berotot */}
          <mesh position={[0, 0.86, 0.14]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.36, 0.24, 0.5]} />
          </mesh>
          {/* Windshield visor bening */}
          <mesh position={[0, 0.98, 0.56]} rotation={[-0.6, 0, 0]} material={mats.glass}>
            <boxGeometry args={[0.32, 0.24, 0.04]} />
          </mesh>
          {/* Lampu depan twin agresif */}
          <mesh position={[-0.09, 0.74, 0.7]} material={mats.headlight}>
            <boxGeometry args={[0.1, 0.07, 0.05]} />
          </mesh>
          <mesh position={[0.09, 0.74, 0.7]} material={mats.headlight}>
            <boxGeometry args={[0.1, 0.07, 0.05]} />
          </mesh>
          {/* Buntut sport meruncing & jok bertingkat */}
          <mesh position={[0, 0.78, -0.22]} material={mats.seatDark}>
            <boxGeometry args={[0.28, 0.1, 0.38]} />
          </mesh>
          <mesh position={[0, 0.85, -0.58]} rotation={[0.18, 0, 0]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.26, 0.16, 0.46]} />
          </mesh>
        </>
      ) : isTrail ? (
        <>
          {/* Mesin tinggi & bash plate */}
          <mesh position={[0, 0.54, 0.04]} material={mats.accentDark} castShadow={castShadow}>
            <boxGeometry args={[0.28, 0.34, 0.64]} />
          </mesh>
          {/* Tangki ramping + shroud */}
          <mesh position={[0, 0.88, 0.2]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.3, 0.22, 0.54]} />
          </mesh>
          {/* Jok panjang datar MX */}
          <mesh position={[0, 0.89, -0.26]} material={mats.seatDark} castShadow={castShadow}>
            <boxGeometry args={[0.24, 0.1, 0.68]} />
          </mesh>
          {/* Spakbor belakang tinggi */}
          <mesh position={[0, 0.84, -0.72]} rotation={[0.22, 0, 0]} material={mats.body}>
            <boxGeometry args={[0.2, 0.05, 0.42]} />
          </mesh>
        </>
      ) : isTua ? (
        <>
          {/* Rangka besi klasik & blok mesin chrome */}
          <mesh position={[0, 0.46, 0.02]} material={mats.chrome} castShadow={castShadow}>
            <boxGeometry args={[0.26, 0.28, 0.54]} />
          </mesh>
          {/* Tangki retro membulat */}
          <mesh position={[0, 0.78, 0.18]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.3, 0.22, 0.48]} />
          </mesh>
          {/* Jok kulit cokelat klasik */}
          <mesh position={[0, 0.76, -0.24]} material={mats.seatBrown} castShadow={castShadow}>
            <boxGeometry args={[0.28, 0.11, 0.58]} />
          </mesh>
          <mesh position={[0, 0.54, -0.5]} material={mats.body}>
            <boxGeometry args={[0.2, 0.18, 0.45]} />
          </mesh>
        </>
      ) : isBebek ? (
        <>
          {/* Dek sayap bebek khas */}
          <mesh position={[0, 0.62, 0.42]} rotation={[-0.18, 0, 0]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.38, 0.48, 0.18]} />
          </mesh>
          {/* Rangka step-through */}
          <mesh position={[0, 0.46, 0.04]} material={mats.accentDark} castShadow={castShadow}>
            <boxGeometry args={[0.26, 0.22, 0.84]} />
          </mesh>
          {/* Sayap bodi belakang & jok datar */}
          <mesh position={[0, 0.64, -0.34]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.34, 0.26, 0.7]} />
          </mesh>
          <mesh position={[0, 0.8, -0.24]} material={mats.seatDark}>
            <boxGeometry args={[0.28, 0.1, 0.64]} />
          </mesh>
        </>
      ) : (
        /* Matic, Listrik & Ojek */
        <>
          <mesh position={[0, 0.34, 0.05]} material={mats.accentDark} castShadow={castShadow}>
            <boxGeometry args={[0.36, 0.14, 0.9]} />
          </mesh>
          <mesh position={[0, 0.56, -0.32]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.42, 0.34, 0.72]} />
          </mesh>
          <mesh position={[0, 0.76, -0.22]} material={mats.seatDark} castShadow={castShadow}>
            <boxGeometry args={[0.34, 0.11, 0.62]} />
          </mesh>
          <mesh position={[0, 0.68, 0.44]} rotation={[-0.22, 0, 0]} material={mats.body} castShadow={castShadow}>
            <boxGeometry args={[0.4, 0.56, 0.22]} />
          </mesh>
          {isListrik && (
            <mesh position={[0, 0.52, -0.18]} material={mats.evAccent}>
              <boxGeometry args={[0.44, 0.08, 0.52]} />
            </mesh>
          )}
        </>
      )}

      {/* Knalpot (kecuali motor listrik) */}
      {!isListrik && (
        <mesh
          position={[0.18, isTrail ? 0.68 : 0.34, -0.45]}
          rotation={[isTrail || isSport ? 0.22 : 0.04, 0, 0]}
          material={hasSportExhaust || isTua ? mats.chrome : mats.accentDark}
        >
          <cylinderGeometry args={[0.045, 0.05, 0.62, 8]} />
        </mesh>
      )}
      {hasSportExhaust && !isListrik && (
        <mesh position={[-0.18, 0.34, -0.45]} rotation={[0.14, 0, 0]} material={mats.chrome}>
          <cylinderGeometry args={[0.045, 0.05, 0.58, 8]} />
        </mesh>
      )}

      {/* Lampu Belakang, Sein Kiri-Kanan + Plat Nomor */}
      <mesh position={[0, 0.72, rearZ - 0.18]} material={mats.taillight}>
        <boxGeometry args={[0.14, 0.08, 0.04]} />
      </mesh>
      <mesh position={[0.14, 0.72, rearZ - 0.18]} material={mats.turnLeft}>
        <boxGeometry args={[0.055, 0.055, 0.04]} />
      </mesh>
      <mesh position={[-0.14, 0.72, rearZ - 0.18]} material={mats.turnRight}>
        <boxGeometry args={[0.055, 0.055, 0.04]} />
      </mesh>
      <mesh position={[0.16, isTrail ? 0.92 : 0.74, frontZ - 0.02]} material={mats.turnLeft}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
      </mesh>
      <mesh position={[-0.16, isTrail ? 0.92 : 0.74, frontZ - 0.02]} material={mats.turnRight}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
      </mesh>
      <mesh position={[0, 0.56, rearZ - 0.2]} material={mats.plate}>
        <boxGeometry args={[0.18, 0.08, 0.02]} />
      </mesh>

      {/* Boks Pengiriman / Aksesori Box Kurir */}
      {hasBox && (
        <group position={[0, 1.0, -0.72]}>
          <mesh material={boxCargoMat} castShadow={castShadow}>
            <boxGeometry args={[0.48, 0.42, 0.46]} />
          </mesh>
          <mesh position={[0.245, 0, 0]} material={courierAccent}>
            <boxGeometry args={[0.02, 0.16, 0.22]} />
          </mesh>
          <mesh position={[-0.245, 0, 0]} material={courierAccent}>
            <boxGeometry args={[0.02, 0.16, 0.22]} />
          </mesh>
        </group>
      )}
    </group>
  );
};
