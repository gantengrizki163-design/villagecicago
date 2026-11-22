import React, { useMemo } from 'react';
import type { GraphicsQuality } from '../../types/game';
import { getCustomColorMaterial, getPaletteMaterial } from './paletteMaterials';

export interface PasarMalam3DProps {
  isNight: boolean;
  hour?: number;
  quality: GraphicsQuality;
}

/**
 * Suasana Pasar Malam & Lampu Hangat Alun-Alun (Batch 6).
 * Menggabungkan tenda warna-warni Diorama_Pasar_Tradisional dengan pencahayaan malam hangat #FFBE55
 * tanpa menghalangi jalur jalan kaki atau collider Alun-Alun.
 */
export const PasarMalam3D: React.FC<PasarMalam3DProps> = ({
  isNight,
  hour = 12,
  quality,
}) => {
  const shadows = quality !== 'low';
  const eveningGlow = isNight || hour >= 17 || hour < 6;

  const woodWarmMat = getPaletteMaterial('wood_warm');
  const woodDarkMat = getPaletteMaterial('wood_dark');
  const redTarpMat = getPaletteMaterial('tarp_red');
  const blueTarpMat = getPaletteMaterial('tarp_blue');
  const yellowTarpMat = getPaletteMaterial('tarp_yellow');
  const creamMat = getPaletteMaterial('wall_cream');
  const wireMat = getCustomColorMaterial('#2C3344', { roughness: 0.8 });
  const bulbMat = getPaletteMaterial('emissive_warm', {
    emissiveIntensity: eveningGlow ? 2.4 : 0.15,
  });
  const lanternCoralMat = getCustomColorMaterial('#F39A68', { roughness: 0.7 });

  // Untaian kabel lampu hangat di antara 4 tiang lampu sudut Alun-Alun (pusat plaza: [0, 0, 6])
  const bulbPositions = useMemo(() => {
    const pts: Array<{ pos: [number, number, number]; key: string }> = [];
    const spans: Array<{ a: [number, number]; b: [number, number]; id: string }> = [
      { a: [-9.2, -1.2], b: [9.2, -1.2], id: 'north' },
      { a: [-9.2, 13.2], b: [9.2, 13.2], id: 'south' },
      { a: [-9.2, -1.2], b: [-9.2, 13.2], id: 'west' },
      { a: [9.2, -1.2], b: [9.2, 13.2], id: 'east' },
    ];
    for (const s of spans) {
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = THREE_LERP(s.a[0], s.b[0], t);
        const z = THREE_LERP(s.a[1], s.b[1], t);
        const sag = Math.sin(t * Math.PI) * 0.55;
        pts.push({ key: `${s.id}_${i}`, pos: [x, 4.35 - sag, z] });
      }
    }
    return pts;
  }, []);

  return (
    <group>
      {/* Kabel & Bohlam Festoon Alun-Alun (terlihat setiap saat, menyala hangat saat sore/malam) */}
      <mesh position={[0, 4.32, -1.2]} material={wireMat}>
        <boxGeometry args={[18.4, 0.04, 0.04]} />
      </mesh>
      <mesh position={[0, 4.32, 13.2]} material={wireMat}>
        <boxGeometry args={[18.4, 0.04, 0.04]} />
      </mesh>
      <mesh position={[-9.2, 4.32, 6]} material={wireMat}>
        <boxGeometry args={[0.04, 0.04, 14.4]} />
      </mesh>
      <mesh position={[9.2, 4.32, 6]} material={wireMat}>
        <boxGeometry args={[0.04, 0.04, 14.4]} />
      </mesh>

      {bulbPositions.map((b) => (
        <mesh key={b.key} position={b.pos} material={bulbMat}>
          <sphereGeometry args={[0.13, 8, 6]} />
        </mesh>
      ))}

      {/* Gerobak Jajanan & Tenda Pasar Malam di Tepi Selatan & Utara Alun-Alun saat Sore/Malam */}
      {eveningGlow && (
        <group>
          {[
            { pos: [0, 0, 12.6] as [number, number, number], tarp: redTarpMat, rotY: 0 },
            { pos: [0, 0, -0.3] as [number, number, number], tarp: blueTarpMat, rotY: Math.PI },
          ].map((stall, idx) => (
            <group key={idx} position={stall.pos} rotation={[0, stall.rotY, 0]}>
              {/* Meja Gerobak Kayu */}
              <mesh position={[0, 0.48, 0]} material={woodWarmMat} castShadow={shadows}>
                <boxGeometry args={[2.1, 0.86, 1.05]} />
              </mesh>
              <mesh position={[-0.95, 1.22, -0.42]} material={woodDarkMat}>
                <boxGeometry args={[0.1, 2.2, 0.1]} />
              </mesh>
              <mesh position={[0.95, 1.22, -0.42]} material={woodDarkMat}>
                <boxGeometry args={[0.1, 2.2, 0.1]} />
              </mesh>
              <mesh position={[-0.95, 1.22, 0.42]} material={woodDarkMat}>
                <boxGeometry args={[0.1, 2.2, 0.1]} />
              </mesh>
              <mesh position={[0.95, 1.22, 0.42]} material={woodDarkMat}>
                <boxGeometry args={[0.1, 2.2, 0.1]} />
              </mesh>
              {/* Kanopi Tenda Warna-Warni */}
              <mesh position={[0, 2.35, 0]} material={stall.tarp} castShadow={shadows}>
                <boxGeometry args={[2.35, 0.14, 1.4]} />
              </mesh>
              <mesh position={[0, 2.42, 0]} material={yellowTarpMat}>
                <boxGeometry args={[0.75, 0.16, 1.42]} />
              </mesh>
              {/* Lampion Kertas Hangat di Depan Gerobak */}
              {[-0.7, 0.7].map((lx) => (
                <group key={lx} position={[lx, 2.02, 0.58]}>
                  <mesh material={bulbMat}>
                    <sphereGeometry args={[0.16, 8, 6]} />
                  </mesh>
                  <mesh position={[0, 0.17, 0]} material={lanternCoralMat}>
                    <cylinderGeometry args={[0.08, 0.08, 0.04, 8]} />
                  </mesh>
                </group>
              ))}
              {/* Wadah Jajanan Hangat di Atas Meja */}
              <mesh position={[-0.4, 1.0, 0]} material={creamMat}>
                <cylinderGeometry args={[0.24, 0.22, 0.16, 8]} />
              </mesh>
              <mesh position={[0.4, 1.02, 0]} material={yellowTarpMat}>
                <boxGeometry args={[0.52, 0.2, 0.42]} />
              </mesh>
            </group>
          ))}

          {/* Cahaya Hangat Pasar Malam Alun-Alun */}
          {quality !== 'low' && (
            <>
              <pointLight position={[0, 3.4, 12.2]} color="#FFBE55" intensity={3.2} distance={24} decay={1.2} />
              <pointLight position={[0, 3.4, -0.2]} color="#FFBE55" intensity={3.0} distance={24} decay={1.2} />
            </>
          )}
        </group>
      )}
    </group>
  );
};

function THREE_LERP(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
