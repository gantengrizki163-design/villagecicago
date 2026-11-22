import React from 'react';
import { Canvas } from '@react-three/fiber';
import type { Gender } from '../types/game';
import type {
  CharacterHeadwearId,
  HairStyleId,
  OutfitPresetId,
} from '../world3d/assets/CharacterLowPoly';
import { AvatarMesh } from './AvatarMesh';

interface CharacterPreview3DProps {
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  hairStyle?: HairStyleId;
  hijabColor?: string;
  outfitPreset?: OutfitPresetId;
  headwear?: CharacterHeadwearId;
}

export const CharacterPreview3D: React.FC<CharacterPreview3DProps> = (props) => {
  return (
    <div className="h-64 sm:h-72 w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      <Canvas camera={{ position: [0, 1.15, 2.7], fov: 40 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#10192b']} />
        <hemisphereLight args={['#c9e8fa', '#4e5b75', 0.9]} />
        <directionalLight position={[2.8, 4.5, 4]} intensity={1.35} color="#fff5dc" />
        <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#93c5fd" />
        <group position={[0, -0.85, 0]}>
          <AvatarMesh {...props} autoRotate anim="idle" castShadow={false} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <circleGeometry args={[0.72, 24]} />
            <meshStandardMaterial color="#233044" roughness={0.88} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
            <ringGeometry args={[0.72, 0.78, 24]} />
            <meshStandardMaterial color="#3b4d68" roughness={0.82} />
          </mesh>
        </group>
      </Canvas>
    </div>
  );
};
