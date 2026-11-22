import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarMesh } from '../components/AvatarMesh';
import { FloatingTag } from '../components/FloatingTag';
import type { RTDBPlayer } from '../types/game';

interface RemotePlayerItemProps {
  player: RTDBPlayer;
  chatBubble?: string | null;
  castShadow?: boolean;
}

const RemotePlayerAvatar: React.FC<RemotePlayerItemProps> = ({
  player,
  chatBubble,
  castShadow = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(player.x, player.y, player.z));
  const currentRot = useRef(player.rotY);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const factor = 1 - Math.exp(-12 * dt);

    currentPos.current.x = THREE.MathUtils.lerp(currentPos.current.x, player.x, factor);
    currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, player.y, factor);
    currentPos.current.z = THREE.MathUtils.lerp(currentPos.current.z, player.z, factor);

    let rotDiff = player.rotY - currentRot.current;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    currentRot.current += rotDiff * factor;

    if (groupRef.current) {
      groupRef.current.position.copy(currentPos.current);
      groupRef.current.rotation.y = currentRot.current;
    }
  });

  return (
    <group ref={groupRef} position={[player.x, player.y, player.z]}>
      <AvatarMesh
        gender={player.gender}
        skinColor={player.skinColor}
        hairColor={player.hairColor}
        shirtColor={player.shirtColor}
        pantsColor={player.pantsColor}
        anim={player.anim}
        castShadow={castShadow}
      />
      <FloatingTag name={player.name} chatBubble={chatBubble} />
    </group>
  );
};

interface RemotePlayersProps {
  players: RTDBPlayer[];
  localBubbles: Record<string, string>;
  hiddenUids?: Set<string>;
  castShadow?: boolean;
}

export const RemotePlayers: React.FC<RemotePlayersProps> = ({
  players,
  localBubbles,
  hiddenUids,
  castShadow = true,
}) => {
  return (
    <group>
      {players
        .filter((p) => !hiddenUids?.has(p.uid))
        .map((p) => (
          <RemotePlayerAvatar
            key={p.uid}
            player={p}
            chatBubble={localBubbles[p.uid]}
            castShadow={castShadow}
          />
        ))}
    </group>
  );
};
