import React, { useMemo, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Pause, Play, RotateCw } from 'lucide-react';
import { getVehicleModelById } from '../firebase/vehicleConfigCache';
import { VehicleModelMesh } from '../world3d/vehicles/VehicleModelMesh';

interface VehiclePreview3DProps {
  modelId: string;
  color?: string;
  accessories?: string[];
  heightClass?: string;
  caption?: string;
}

export const VehiclePreview3D: React.FC<VehiclePreview3DProps> = ({
  modelId,
  color,
  accessories = [],
  heightClass = 'h-48 sm:h-52',
  caption,
}) => {
  const [autoRotate, setAutoRotate] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  const framing = useMemo(() => {
    const model = getVehicleModelById(modelId);
    const dims = model?.dimensions ?? { width: 1.8, height: 1.5, length: 3.6 };
    const span = Math.max(dims.length, dims.width * 1.35, dims.height * 1.45, 2.1);
    const camDist = Math.max(2.7, span * 1.15);
    const targetY = Math.max(0.4, dims.height * 0.38);
    const padRadius = Math.max(1.25, span * 0.56);
    return {
      camPos: [camDist * 0.72, camDist * 0.44, camDist * 0.78] as [number, number, number],
      targetY,
      padRadius,
      minDistance: Math.max(1.8, camDist * 0.6),
      maxDistance: camDist * 1.8,
    };
  }, [modelId]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-800 bg-[#0d1526] ${heightClass}`}
    >
      {contextLost ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-slate-300">
          <p>Pratinjau 3D dijeda oleh browser (WebGL context lost).</p>
          <button
            type="button"
            onClick={() => setContextLost(false)}
            className="rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-slate-950 cursor-pointer"
          >
            Muat Ulang 3D
          </button>
        </div>
      ) : (
        <Canvas
          camera={{ position: framing.camPos, fov: 38 }}
          dpr={[1, 1.5]}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            const handleLost = (e: Event) => {
              e.preventDefault();
              setContextLost(true);
            };
            const handleRestored = () => {
              setContextLost(false);
            };
            canvas.addEventListener('webglcontextlost', handleLost, false);
            canvas.addEventListener('webglcontextrestored', handleRestored, false);
          }}
        >
          <color attach="background" args={['#0d1526']} />
          <hemisphereLight args={['#d8ecff', '#3a465f', 0.95]} />
          <directionalLight position={[4, 6, 4.5]} intensity={1.4} color="#fff6e0" />
          <directionalLight position={[-3.5, 2.5, -3]} intensity={0.55} color="#7dd3fc" />

          <group position={[0, 0, 0]}>
            <VehicleModelMesh
              modelId={modelId}
              color={color}
              accessories={accessories}
              isNight={false}
              headlightsOn={true}
              castShadow={false}
              lod="full"
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
              <circleGeometry args={[framing.padRadius, 32]} />
              <meshStandardMaterial color="#1e293b" roughness={0.86} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
              <ringGeometry args={[framing.padRadius, framing.padRadius + 0.09, 32]} />
              <meshStandardMaterial color="#475569" roughness={0.78} />
            </mesh>
          </group>

          <OrbitControls
            key={modelId}
            enablePan={false}
            enableZoom={true}
            enableDamping={true}
            dampingFactor={0.08}
            minDistance={framing.minDistance}
            maxDistance={framing.maxDistance}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 2 - 0.06}
            target={[0, framing.targetY, 0]}
            autoRotate={autoRotate}
            autoRotateSpeed={1.6}
          />
        </Canvas>
      )}

      {/* Overlay kontrol ringan */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
          <RotateCw className="h-3 w-3 text-amber-400" />
          {caption ? `${caption} · Seret 360°` : 'Seret untuk putar 360°'}
        </span>
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/85 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          aria-label={autoRotate ? 'Jeda putaran otomatis' : 'Putar otomatis'}
        >
          {autoRotate ? <Pause className="h-3 w-3 text-amber-300" /> : <Play className="h-3 w-3 text-emerald-300" />}
          <span>{autoRotate ? 'Jeda' : 'Putar'}</span>
        </button>
      </div>
    </div>
  );
};
