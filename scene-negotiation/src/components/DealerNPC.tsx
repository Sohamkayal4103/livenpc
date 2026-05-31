import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { characterModelPaths } from "../config/characterConfig";
import { GameCharacter } from "./characters/GameCharacter";
import type { NPCState } from "../types/GameState";
import { useGameStore } from "../systems/GameStateManager";
import { yawToFacePoint } from "../utils/characterFacing";

export function DealerNPC({ npc }: { npc: NPCState }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const player = useGameStore((state) => state.gameState.player.position);
  const activeConversation = useGameStore((state) => state.gameState.conversation.is_active);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.set(npc.position.x, npc.position.y, npc.position.z);
    group.current.rotation.set(0, yawToFacePoint(npc.position, player), 0);

    if (ring.current) {
      const material = ring.current.material as THREE.MeshStandardMaterial;
      material.opacity = activeConversation ? 0.56 + Math.sin(clock.elapsedTime * 4) * 0.16 : 0;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <torusGeometry args={[0.72, 0.025, 8, 48]} />
        <meshStandardMaterial
          color="#7ef0bd"
          emissive="#2fe09b"
          emissiveIntensity={1.1}
          transparent
          opacity={0}
        />
      </mesh>
      <GameCharacter
        kind="dealer"
        modelPath={characterModelPaths.dealer}
        pose={npc.is_speaking ? "talk" : npc.animation_state}
        isSpeaking={npc.is_speaking}
        armed={npc.is_armed}
        showWeapon={npc.animation_state === "aggressive"}
      />
      <Billboard position={[0, 2.24, 0]}>
        <Text
          fontSize={0.16}
          color="#f3f1e9"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#05070b"
        >
          {npc.name}
        </Text>
      </Billboard>
    </group>
  );
}
