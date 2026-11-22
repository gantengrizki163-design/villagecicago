import React from 'react';
import type { GraphicsQuality } from '../../types/game';
import { AssetModelLoader } from './AssetModelLoader';
import { getPaletteMaterial } from './paletteMaterials';

// Ref: /assets/aistudio/Indonesian_commuter_train_isomet__3442bafd_e2f4ed4d.jpg

interface VehicleTrainProps {
  quality: GraphicsQuality;
  isNight?: boolean;
}

/**
 * Rangkaian Kereta Komuter 3 Gerbong Low-Poly sesuai referensi commuter train:
 * bodi atas krem, garis & hidung biru kobalt, jendela gelap, AC atap,
 * pantograf belah ketupat, dan bogie roda rel.
 */
export const VehicleTrain: React.FC<VehicleTrainProps> = ({ quality, isNight = false }) => {
  const shadows = quality !== 'low';
  const creamMat = getPaletteMaterial('train_cream');
  const blueMat = getPaletteMaterial('train_blue');
  const darkMat = getPaletteMaterial('rail_steel');
  const tireMat = getPaletteMaterial('vehicle_tire');
  const windowMat = getPaletteMaterial(isNight ? 'emissive_warm' : 'glass_day');
  const headlightMat = getPaletteMaterial('emissive_warm', { emissiveIntensity: 1.8 });

  const carOffsets = [11.5, 0, -11.5];

  return (
    <AssetModelLoader assetId="vehicle_train" quality={quality} castShadow={shadows}>
      <group>
        {carOffsets.map((cx, carIdx) => {
          const isHead = carIdx === 0;
          const isTail = carIdx === 2;
          return (
            <group key={carIdx} position={[cx, 0, 0]}>
              {/* Sasis Bawah & Bogie Roda */}
              <mesh position={[0, 0.42, 0]} material={tireMat}>
                <boxGeometry args={[10.4, 0.36, 2.3]} />
              </mesh>
              {[-3.4, 3.4].map((bx) => (
                <group key={bx} position={[bx, 0.25, 0]}>
                  <mesh position={[-0.7, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={tireMat}>
                    <cylinderGeometry args={[0.3, 0.3, 2.25, 8]} />
                  </mesh>
                  <mesh position={[0.7, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={tireMat}>
                    <cylinderGeometry args={[0.3, 0.3, 2.25, 8]} />
                  </mesh>
                </group>
              ))}

              {/* Bodi Utama Gerbong Krem & Garis Biru */}
              <mesh position={[0, 1.72, 0]} material={creamMat} castShadow={shadows} receiveShadow>
                <boxGeometry args={[10.6, 2.25, 2.55]} />
              </mesh>
              <mesh position={[0, 1.05, 0]} material={blueMat}>
                <boxGeometry args={[10.64, 0.52, 2.58]} />
              </mesh>
              <mesh position={[0, 2.75, 0]} material={blueMat}>
                <boxGeometry args={[10.62, 0.16, 2.56]} />
              </mesh>

              {/* Jendela Penumpang & Pintu Geser */}
              {[-3.6, -2.0, 2.0, 3.6].map((wx) => (
                <mesh key={wx} position={[wx, 1.98, 0]} material={windowMat}>
                  <boxGeometry args={[1.15, 0.72, 2.59]} />
                </mesh>
              ))}
              {[-0.45, 0.45].map((dx) => (
                <mesh key={dx} position={[dx, 1.65, 0]} material={darkMat}>
                  <boxGeometry args={[0.75, 1.65, 2.58]} />
                </mesh>
              ))}

              {/* Unit AC Atap */}
              {[-2.8, 2.8].map((ax) => (
                <mesh key={ax} position={[ax, 2.98, 0]} material={creamMat} castShadow={shadows}>
                  <boxGeometry args={[1.8, 0.28, 1.35]} />
                </mesh>
              ))}

              {/* Hidung Masinis di Gerbong Depan */}
              {isHead && (
                <group position={[5.35, 1.65, 0]}>
                  <mesh position={[0, -0.45, 0]} material={blueMat} castShadow={shadows}>
                    <boxGeometry args={[0.55, 1.1, 2.52]} />
                  </mesh>
                  <mesh position={[0.05, 0.38, 0]} rotation={[0, 0, -0.15]} material={windowMat}>
                    <boxGeometry args={[0.16, 0.72, 2.05]} />
                  </mesh>
                  <mesh position={[0.28, -0.58, -0.78]} material={headlightMat}>
                    <boxGeometry args={[0.08, 0.22, 0.32]} />
                  </mesh>
                  <mesh position={[0.28, -0.58, 0.78]} material={headlightMat}>
                    <boxGeometry args={[0.08, 0.22, 0.32]} />
                  </mesh>
                </group>
              )}

              {/* Pantograf di Atap Gerbong Belakang */}
              {isTail && (
                <group position={[-2.2, 3.15, 0]}>
                  <mesh position={[0, 0.28, 0]} rotation={[0, 0, 0.55]} material={darkMat}>
                    <boxGeometry args={[0.08, 0.75, 0.9]} />
                  </mesh>
                  <mesh position={[0, 0.62, 0]} material={darkMat}>
                    <boxGeometry args={[0.12, 0.08, 1.4]} />
                  </mesh>
                </group>
              )}
            </group>
          );
        })}
      </group>
    </AssetModelLoader>
  );
};
