import type { GameState, NPCState, Vec3 } from "../types/GameState";

export const BACKEND_WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL ?? "ws://localhost:8765";

export const DEALER_ID = "dealer_rico";

export const sceneParams = {
  interactionDistance: 3,
  conversationEndDistance: 5,
  playerStart: { x: 0, y: 0, z: 7.6 } satisfies Vec3,
  alleyBounds: {
    minX: -5.2,
    maxX: 5.2,
    minZ: -11.2,
    maxZ: 9.2,
  },
  dealerLookTarget: { x: 0, y: 1.4, z: 4.5 } satisfies Vec3,
};

export const initialNpcs: NPCState[] = [
  {
    id: DEALER_ID,
    name: "RICO",
    role: "dealer",
    position: { x: 0, y: 0, z: -6.7 },
    home_position: { x: 0, y: 0, z: -6.7 },
    is_armed: true,
    weapon_type: "pistol_concealed",
    disposition: "neutral",
    is_speaking: false,
    animation_state: "idle",
  },
  {
    id: "bodyguard_left",
    name: "MARA",
    role: "bodyguard",
    position: { x: -2.35, y: 0, z: -5.7 },
    home_position: { x: -2.35, y: 0, z: -5.7 },
    is_armed: true,
    weapon_type: "pistol",
    disposition: "neutral",
    is_speaking: false,
    animation_state: "relaxed",
  },
  {
    id: "bodyguard_right",
    name: "VEX",
    role: "bodyguard",
    position: { x: 2.55, y: 0, z: -5.2 },
    home_position: { x: 2.55, y: 0, z: -5.2 },
    is_armed: true,
    weapon_type: "pistol",
    disposition: "neutral",
    is_speaking: false,
    animation_state: "relaxed",
  },
  {
    id: "bystander_smoker",
    name: "JULES",
    role: "bystander",
    position: { x: 4.2, y: 0, z: -1.6 },
    home_position: { x: 4.2, y: 0, z: -1.6 },
    is_armed: false,
    weapon_type: null,
    disposition: "nervous",
    is_speaking: false,
    animation_state: "idle",
  },
];

export const createInitialGameState = (): GameState => ({
  timestamp: Date.now(),
  scene: {
    name: "gta_negotiation",
    time_of_day: "night",
    tension_level: 0.26,
    ambient_events: ["distant_traffic", "neon_hum"],
  },
  player: {
    position: sceneParams.playerStart,
    looking_at: null,
    distance_to_dealer: 999,
    is_speaking: false,
    movement_speed: 0,
    approached_calmly: true,
  },
  npcs: initialNpcs.map((npc) => ({ ...npc, position: { ...npc.position } })),
  conversation: {
    is_active: false,
    turn_count: 0,
    player_last_spoke_at: null,
  },
});
