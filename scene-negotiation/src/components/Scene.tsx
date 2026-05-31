import { ContactShadows, Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Environment } from "./Environment";
import { Player } from "./Player";
import { DealerNPC } from "./DealerNPC";
import { BodyguardNPC } from "./BodyguardNPC";
import { BystanderNPC } from "./BystanderNPC";
import { ProximityTrigger } from "./ProximityTrigger";
import { DEALER_ID } from "../config/sceneConfig";
import { audioManager } from "../systems/AudioManager";
import { useGameStore } from "../systems/GameStateManager";
import {
  animationForRole,
  calculateNextTension,
  dispositionForRole,
  distance,
  lerp,
} from "../systems/TensionSystem";
import { webSocketBridge } from "../systems/WebSocketBridge";
import type { GameState } from "../types/GameState";

const fingerprintForState = (state: GameState) => {
  const player = state.player.position;
  const npcBits = state.npcs
    .map(
      (npc) =>
        `${npc.id}:${npc.position.x.toFixed(1)},${npc.position.z.toFixed(1)},${npc.animation_state},${npc.disposition},${npc.is_speaking}`,
    )
    .join("|");
  return [
    player.x.toFixed(1),
    player.z.toFixed(1),
    state.player.looking_at,
    state.player.is_speaking,
    state.player.approached_calmly,
    state.scene.tension_level.toFixed(2),
    state.conversation.is_active,
    state.conversation.turn_count,
    npcBits,
  ].join(";");
};

function GameSystems() {
  const { camera } = useThree();
  const lastSendAt = useRef(0);
  const lastFingerprint = useRef("");

  useEffect(() => {
    const handleAdvance = (event: Event) => {
      const detail = (event as CustomEvent<{ ms: number }>).detail;
      const seconds = Math.max(0.016, Math.min(0.25, (detail?.ms ?? 16) / 1000));
      const state = useGameStore.getState().gameState;
      useGameStore.getState().setTension(calculateNextTension(state, seconds));
    };
    window.addEventListener("codex-advance-time", handleAdvance);
    return () => window.removeEventListener("codex-advance-time", handleAdvance);
  }, []);

  useFrame((_, delta) => {
    const store = useGameStore.getState();
    const state = store.gameState;
    audioManager.updateListener(state.player.position, camera.quaternion);

    const nextTension = calculateNextTension(state, Math.min(delta, 0.05));
    if (Math.abs(nextTension - state.scene.tension_level) > 0.004) {
      store.setTension(nextTension);
    }

    const latest = useGameStore.getState().gameState;
    const ambient = latest.scene.tension_level > 0.74
      ? ["distant_traffic", "neon_hum", "police_siren_distant"]
      : ["distant_traffic", "neon_hum"];
    if (ambient.join("|") !== latest.scene.ambient_events.join("|")) {
      store.setAmbientEvents(ambient);
    }

    for (const npc of latest.npcs) {
      const animation = animationForRole(
        npc.role,
        latest.scene.tension_level,
        latest.conversation.is_active,
      );
      const disposition = dispositionForRole(npc.role, latest.scene.tension_level, npc.disposition);
      const patch: Parameters<typeof store.setNpcState>[1] = {};
      if (npc.animation_state !== animation && !npc.is_speaking) patch.animation_state = animation;
      if (npc.disposition !== disposition) patch.disposition = disposition;

      if (npc.role === "bodyguard") {
        const shouldStepForward = latest.scene.tension_level > 0.68;
        const targetZ = npc.home_position.z + (shouldStepForward ? 0.62 : 0);
        if (Math.abs(npc.position.z - targetZ) > 0.03) {
          patch.position = {
            x: npc.position.x,
            y: npc.position.y,
            z: lerp(npc.position.z, targetZ, 0.035),
          };
        }
      }

      if (npc.role === "bystander" && animation === "fleeing") {
        const exit = { x: 5.1, y: 0, z: 8.7 };
        if (distance(npc.position, exit) > 0.08) {
          patch.position = {
            x: lerp(npc.position.x, exit.x, 0.025),
            y: 0,
            z: lerp(npc.position.z, exit.z, 0.025),
          };
        }
      }

      if (Object.keys(patch).length > 0) {
        store.setNpcState(npc.id, patch);
      }
    }

    const outboundState = useGameStore.getState().gameState;
    const fingerprint = fingerprintForState(outboundState);
    const now = performance.now();
    const activeStale = outboundState.conversation.is_active && now - lastSendAt.current > 2000;
    if (fingerprint !== lastFingerprint.current || activeStale) {
      webSocketBridge.sendGameState(outboundState);
      lastFingerprint.current = fingerprint;
      lastSendAt.current = now;
    }
  });

  return null;
}

function RenderTuning() {
  const { gl } = useThree();

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.65;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);

  return null;
}

function PlayerReadabilityLight() {
  const light = useRef<THREE.PointLight>(null);
  const player = useGameStore((state) => state.gameState.player.position);

  useFrame(() => {
    light.current?.position.set(player.x, player.y + 2.4, player.z + 1.8);
  });

  return (
    <pointLight
      ref={light}
      color="#b8d2ff"
      intensity={1.15}
      distance={7.5}
      decay={1.4}
    />
  );
}

export function Scene() {
  const npcs = useGameStore((state) => state.gameState.npcs);
  const dealer = npcs.find((npc) => npc.id === DEALER_ID);
  const bodyguards = npcs.filter((npc) => npc.role === "bodyguard");
  const bystanders = npcs.filter((npc) => npc.role === "bystander");

  return (
    <>
      <RenderTuning />
      <color attach="background" args={["#080d13"]} />
      <fog attach="fog" args={["#101923", 18, 58]} />
      <ambientLight color="#9eb6e7" intensity={0.34} />
      <hemisphereLight color="#9fb8ff" groundColor="#161a1e" intensity={0.58} />
      <directionalLight
        castShadow
        color="#9eb4ff"
        intensity={0.5}
        position={[-3, 6, 8]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight color="#ffe0a3" intensity={3.2} distance={11} decay={1.55} position={[0, 3.2, -6.4]} />
      <pointLight color="#86ffd2" intensity={1.25} distance={10} decay={1.6} position={[3.4, 1.8, 1.6]} />
      <spotLight
        castShadow
        color="#ff806c"
        intensity={1.15}
        angle={0.42}
        penumbra={0.7}
        distance={22}
        position={[5.2, 3.2, 2.8]}
      />
      <Stars radius={52} depth={16} count={900} factor={2.8} saturation={0} fade speed={0.35} />
      <Environment />
      <Player />
      <PlayerReadabilityLight />
      {dealer ? <DealerNPC npc={dealer} /> : null}
      {bodyguards.map((npc) => (
        <BodyguardNPC key={npc.id} npc={npc} />
      ))}
      {bystanders.map((npc) => (
        <BystanderNPC key={npc.id} npc={npc} />
      ))}
      <ContactShadows
        opacity={0.24}
        scale={15}
        blur={2.1}
        far={10}
        position={[0, 0.02, -2]}
        color="#05070b"
      />
      <ProximityTrigger />
      <GameSystems />
    </>
  );
}
