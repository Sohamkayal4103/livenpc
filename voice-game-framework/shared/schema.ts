// Canonical protocol — TypeScript side. Mirrors schema.py and protocol.md.
// Imported by the game client (client/pipecatBridge.ts + scene-negotiation).
// If you change a field here, change schema.py and protocol.md too.

export const SCHEMA_VERSION = 1;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type NPCRole = "dealer" | "bodyguard" | "bystander";
export type NPCDisposition = "hostile" | "neutral" | "friendly" | "nervous";
export type NPCAnimationState =
  | "idle"
  | "alert"
  | "aggressive"
  | "relaxed"
  | "fleeing";
export type NPCAction =
  | "step_forward"
  | "draw_weapon"
  | "holster_weapon"
  | "flee"
  | "relax";

export interface ActionNote {
  type: string;
  note?: string;
}

export interface PlayerState {
  position: Vec3;
  looking_at: string | null;
  distance_to_dealer: number;
  is_speaking: boolean;
  movement_speed: number;
  approached_calmly: boolean;
  last_action?: ActionNote;
}

export interface NPCSnapshot {
  id: string;
  name: string;
  role: NPCRole;
  position: Vec3;
  distance_to_player: number;
  disposition: NPCDisposition;
  is_armed: boolean;
  animation_state: NPCAnimationState;
}

export interface SceneSnapshot {
  id: string;
  tension_level: number; // 0..1
  ambient_events: string[];
}

// ---- Game → Agent -------------------------------------------------------

export interface GameStateMessage {
  type: "game_state";
  schema_version: number;
  session_id: string;
  conversation_id: string;
  timestamp_ms: number;
  scene: SceneSnapshot;
  player: PlayerState;
  npcs: NPCSnapshot[];
}

export interface ConversationStartMessage {
  type: "conversation_start";
  npc_id: string;
  conversation_id: string;
}

export interface ConversationEndMessage {
  type: "conversation_end";
  npc_id: string;
  conversation_id: string;
}

export type GameToAgentMessage =
  | GameStateMessage
  | ConversationStartMessage
  | ConversationEndMessage;

// ---- Agent → Game -------------------------------------------------------

export interface NPCActionMessage {
  type: "npc_action";
  npc_id: string;
  action: NPCAction;
  params?: Record<string, number | string | boolean>;
  utterance_id?: string;
  reason?: string;
}

export interface TensionUpdateMessage {
  type: "tension_update";
  tension_level: number;
}

export interface SubtitleMessage {
  type: "subtitle";
  npc_id: string;
  utterance_id?: string;
  text: string;
}

export type AgentToGameMessage =
  | NPCActionMessage
  | TensionUpdateMessage
  | SubtitleMessage;
