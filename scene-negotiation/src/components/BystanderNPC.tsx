import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { characterModelPaths } from "../config/characterConfig";
import { GameCharacter } from "./characters/GameCharacter";
import type { NPCState } from "../types/GameState";

export function BystanderNPC({ npc }: { npc: NPCState }) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.lerp(new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z), 0.14);
    group.current.rotation.y = Math.PI * 0.62 + Math.sin(clock.elapsedTime) * 0.06;
    const fleeingBob = npc.animation_state === "fleeing" ? Math.sin(clock.elapsedTime * 15) * 0.05 : 0;
    group.current.position.y = npc.position.y + fleeingBob;
  });

  return (
    <group ref={group} position={[npc.position.x, npc.position.y, npc.position.z]}>
      <GameCharacter
        kind="bystander"
        modelPath={characterModelPaths.bystander}
        pose={npc.animation_state === "fleeing" ? "fleeing" : "smoking"}
      />
    </group>
  );
}
