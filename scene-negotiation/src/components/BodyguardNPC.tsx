import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { characterModelPaths } from "../config/characterConfig";
import { GameCharacter } from "./characters/GameCharacter";
import type { NPCState } from "../types/GameState";
import { useGameStore } from "../systems/GameStateManager";
import { yawToFacePoint } from "../utils/characterFacing";

export function BodyguardNPC({ npc }: { npc: NPCState }) {
  const group = useRef<THREE.Group>(null);
  const player = useGameStore((state) => state.gameState.player.position);
  const tension = useGameStore((state) => state.gameState.scene.tension_level);
  const aggressive = npc.animation_state === "aggressive";
  const alert = npc.animation_state === "alert" || aggressive;

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.lerp(new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z), 0.22);

    const scan = Math.sin(clock.elapsedTime * 1.5 + npc.position.x) * (alert ? 0.08 : 0.18);
    group.current.rotation.set(0, yawToFacePoint(npc.position, player) + scan, 0);
  });

  return (
    <group ref={group} position={[npc.position.x, npc.position.y, npc.position.z]}>
      <GameCharacter
        kind="bodyguard"
        modelPath={characterModelPaths.bodyguard}
        pose={npc.animation_state}
        armed={npc.is_armed}
        showWeapon={npc.is_armed && tension > 0.45}
      />
      <Billboard position={[0, 2.12, 0]}>
        <Text
          fontSize={0.14}
          color={aggressive ? "#ffb0a0" : "#d5dbe1"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#05070b"
        >
          {npc.name}
        </Text>
      </Billboard>
    </group>
  );
}
