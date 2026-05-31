import { create } from "zustand";
import { createInitialGameState, DEALER_ID } from "../config/sceneConfig";
import type {
  BackendStatus,
  GameState,
  NPCAction,
  NPCAnimationState,
  NPCDisposition,
  Vec3,
} from "../types/GameState";
import { distance, lerp } from "./TensionSystem";

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const cloneVec = (value: Vec3): Vec3 => ({
  x: round3(value.x),
  y: round3(value.y),
  z: round3(value.z),
});
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface HudState {
  promptVisible: boolean;
  subtitle: string;
  micActive: boolean;
  micError: string | null;
  pointerLocked: boolean;
}

interface GameStore {
  gameState: GameState;
  backend: {
    status: BackendStatus;
    url: string;
    lastError: string | null;
    lastMessageAt: number | null;
  };
  hud: HudState;
  setBackendStatus: (status: BackendStatus, lastError?: string | null) => void;
  setBackendUrl: (url: string) => void;
  noteBackendMessage: () => void;
  setPlayerPosition: (position: Vec3, movementSpeed: number, lookingAt: string | null) => void;
  setPlayerSpeaking: (isSpeaking: boolean) => void;
  startConversation: (npcId: string) => void;
  endConversation: () => void;
  incrementTurn: () => void;
  setNpcSpeaking: (npcId: string, isSpeaking: boolean) => void;
  setNpcState: (
    npcId: string,
    patch: Partial<{
      position: Vec3;
      disposition: NPCDisposition;
      animation_state: NPCAnimationState;
      is_armed: boolean;
      weapon_type: string | null;
    }>,
  ) => void;
  applyNpcAction: (npcId: string, action: NPCAction) => void;
  setTension: (value: number) => void;
  setAmbientEvents: (events: string[]) => void;
  setSubtitle: (subtitle: string) => void;
  setMicActive: (active: boolean, error?: string | null) => void;
  setPromptVisible: (visible: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  resetScene: () => void;
}

const withTimestamp = (state: GameState): GameState => ({
  ...state,
  timestamp: Date.now(),
});

const recomputeDistance = (state: GameState): GameState => {
  const dealer = state.npcs.find((npc) => npc.id === DEALER_ID);
  if (!dealer) return state;
  return {
    ...state,
    player: {
      ...state.player,
      distance_to_dealer: round3(distance(state.player.position, dealer.position)),
    },
  };
};

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: recomputeDistance(createInitialGameState()),
  backend: {
    status: "disconnected",
    url: "",
    lastError: null,
    lastMessageAt: null,
  },
  hud: {
    promptVisible: false,
    subtitle: "",
    micActive: false,
    micError: null,
    pointerLocked: false,
  },
  setBackendStatus: (status, lastError = null) =>
    set((state) => ({
      backend: { ...state.backend, status, lastError },
    })),
  setBackendUrl: (url) =>
    set((state) => ({
      backend: { ...state.backend, url },
    })),
  noteBackendMessage: () =>
    set((state) => ({
      backend: { ...state.backend, lastMessageAt: Date.now() },
    })),
  setPlayerPosition: (position, movementSpeed, lookingAt) =>
    set((state) => {
      const dealer = state.gameState.npcs.find((npc) => npc.id === DEALER_ID);
      const distanceToDealer = dealer ? distance(position, dealer.position) : 999;
      const ranTowardDealer =
        movementSpeed > 4.1 && distanceToDealer < 8 && state.gameState.player.approached_calmly;
      return {
        gameState: withTimestamp({
          ...state.gameState,
          player: {
            ...state.gameState.player,
            position: cloneVec(position),
            movement_speed: round3(movementSpeed),
            looking_at: lookingAt,
            distance_to_dealer: round3(distanceToDealer),
            approached_calmly: ranTowardDealer
              ? false
              : state.gameState.player.approached_calmly,
          },
        }),
      };
    }),
  setPlayerSpeaking: (isSpeaking) =>
    set((state) => ({
      gameState: withTimestamp({
        ...state.gameState,
        player: {
          ...state.gameState.player,
          is_speaking: isSpeaking,
        },
        conversation: {
          ...state.gameState.conversation,
          player_last_spoke_at: isSpeaking ? Date.now() : state.gameState.conversation.player_last_spoke_at,
        },
      }),
    })),
  startConversation: () =>
    set((state) => ({
      gameState: withTimestamp({
        ...state.gameState,
        conversation: {
          ...state.gameState.conversation,
          is_active: true,
        },
      }),
      hud: {
        ...state.hud,
        subtitle: state.backend.status === "connected" ? "" : "Backend disconnected",
      },
    })),
  endConversation: () =>
    set((state) => ({
      gameState: withTimestamp({
        ...state.gameState,
        player: {
          ...state.gameState.player,
          is_speaking: false,
        },
        conversation: {
          ...state.gameState.conversation,
          is_active: false,
        },
      }),
      hud: {
        ...state.hud,
        micActive: false,
        subtitle: "",
      },
    })),
  incrementTurn: () =>
    set((state) => ({
      gameState: withTimestamp({
        ...state.gameState,
        conversation: {
          ...state.gameState.conversation,
          turn_count: state.gameState.conversation.turn_count + 1,
        },
      }),
    })),
  setNpcSpeaking: (npcId, isSpeaking) =>
    set((state) => ({
      gameState: withTimestamp({
        ...state.gameState,
        npcs: state.gameState.npcs.map((npc) =>
          npc.id === npcId ? { ...npc, is_speaking: isSpeaking } : npc,
        ),
      }),
    })),
  setNpcState: (npcId, patch) =>
    set((state) => ({
      gameState: recomputeDistance(
        withTimestamp({
          ...state.gameState,
          npcs: state.gameState.npcs.map((npc) =>
            npc.id === npcId
              ? {
                  ...npc,
                  ...patch,
                  position: patch.position ? cloneVec(patch.position) : npc.position,
                }
              : npc,
          ),
        }),
      ),
    })),
  applyNpcAction: (npcId, action) => {
    const npc = get().gameState.npcs.find((candidate) => candidate.id === npcId);
    if (!npc) return;

    if (action === "step_forward") {
      const towardEntrance = {
        x: lerp(npc.position.x, 0, 0.18),
        y: npc.position.y,
        z: npc.position.z + 0.75,
      };
      get().setNpcState(npcId, {
        position: towardEntrance,
        animation_state: "aggressive",
        disposition: "hostile",
      });
      return;
    }

    if (action === "draw_weapon") {
      get().setNpcState(npcId, {
        is_armed: true,
        weapon_type: npc.weapon_type ?? "pistol",
        animation_state: "aggressive",
        disposition: "hostile",
      });
      get().setTension(Math.max(get().gameState.scene.tension_level, 0.78));
      return;
    }

    if (action === "holster_weapon" || action === "relax") {
      get().setNpcState(npcId, {
        animation_state: npc.role === "bodyguard" ? "relaxed" : "idle",
        disposition: "neutral",
        position: npc.home_position,
      });
      get().setTension(Math.min(get().gameState.scene.tension_level, 0.38));
      return;
    }

    if (action === "flee") {
      get().setNpcState(npcId, {
        animation_state: "fleeing",
        disposition: "nervous",
        position: { x: 5.1, y: 0, z: 8.7 },
      });
    }
  },
  setTension: (value) =>
    set((state) => ({
      gameState: withTimestamp({
        ...state.gameState,
        scene: {
          ...state.gameState.scene,
          tension_level: round3(clamp01(value)),
        },
      }),
    })),
  setAmbientEvents: (events) =>
    set((state) => ({
      gameState: withTimestamp({
        ...state.gameState,
        scene: {
          ...state.gameState.scene,
          ambient_events: events,
        },
      }),
    })),
  setSubtitle: (subtitle) =>
    set((state) => ({
      hud: {
        ...state.hud,
        subtitle,
      },
    })),
  setMicActive: (active, error = null) =>
    set((state) => ({
      hud: {
        ...state.hud,
        micActive: active,
        micError: error,
      },
    })),
  setPromptVisible: (visible) =>
    set((state) => ({
      hud: {
        ...state.hud,
        promptVisible: visible,
      },
    })),
  setPointerLocked: (locked) =>
    set((state) => ({
      hud: {
        ...state.hud,
        pointerLocked: locked,
      },
    })),
  resetScene: () =>
    set((state) => ({
      gameState: recomputeDistance(createInitialGameState()),
      hud: {
        ...state.hud,
        promptVisible: false,
        subtitle: "",
        micActive: false,
        micError: null,
      },
    })),
}));

export function selectTextSnapshot(state: GameState) {
  return {
    coordinate_system: "origin at alley center, x right, y up, z toward entrance",
    scene: state.scene,
    player: state.player,
    npcs: state.npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      role: npc.role,
      position: npc.position,
      disposition: npc.disposition,
      is_armed: npc.is_armed,
      is_speaking: npc.is_speaking,
      animation_state: npc.animation_state,
    })),
    conversation: state.conversation,
  };
}
