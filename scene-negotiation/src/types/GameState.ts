export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type SceneName = "gta_negotiation";
export type TimeOfDay = "night" | "day" | "dusk";
export type NPCRole = "dealer" | "bodyguard" | "bystander";
export type NPCDisposition = "hostile" | "neutral" | "friendly" | "nervous";
export type NPCAnimationState =
  | "idle"
  | "alert"
  | "aggressive"
  | "relaxed"
  | "fleeing";

export interface NPCState {
  id: string;
  name: string;
  role: NPCRole;
  position: Vec3;
  home_position: Vec3;
  is_armed: boolean;
  weapon_type: string | null;
  disposition: NPCDisposition;
  is_speaking: boolean;
  animation_state: NPCAnimationState;
}

export interface GameState {
  timestamp: number;
  scene: {
    name: SceneName;
    time_of_day: TimeOfDay;
    tension_level: number;
    ambient_events: string[];
  };
  player: {
    position: Vec3;
    looking_at: string | null;
    distance_to_dealer: number;
    is_speaking: boolean;
    movement_speed: number;
    approached_calmly: boolean;
  };
  npcs: NPCState[];
  conversation: {
    is_active: boolean;
    turn_count: number;
    player_last_spoke_at: number | null;
  };
}

export type BackendStatus = "disconnected" | "connecting" | "connected" | "error";

export type NPCAction =
  | "step_forward"
  | "draw_weapon"
  | "holster_weapon"
  | "flee"
  | "relax";

export interface BaseBackendMessage {
  type: string;
}

export interface NPCAudioMessage extends BaseBackendMessage {
  type: "npc_audio";
  npc_id: string;
  data: string | { audio?: string; base64?: string; mime_type?: string };
  subtitle?: string;
}

export interface NPCActionMessage extends BaseBackendMessage {
  type: "npc_action";
  npc_id: string;
  action: NPCAction;
}

export interface TensionOverrideMessage extends BaseBackendMessage {
  type: "tension_override";
  level: number;
}

export interface SubtitleMessage extends BaseBackendMessage {
  type: "subtitle";
  npc_id?: string;
  text: string;
}

export type BackendMessage =
  | NPCAudioMessage
  | NPCActionMessage
  | TensionOverrideMessage
  | SubtitleMessage
  | BaseBackendMessage;

export interface AudioChunkMetadata {
  encoding: "pcm_s16le" | "webm_opus";
  sample_rate?: number;
  channels?: number;
  mime_type?: string;
}
