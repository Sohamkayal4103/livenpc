import type { GameState, NPCAnimationState, NPCDisposition, Vec3 } from "../types/GameState";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const distance = (a: Vec3, b: Vec3) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const lerp = (a: number, b: number, alpha: number) => a + (b - a) * alpha;

export function calculateNextTension(state: GameState, deltaSeconds: number) {
  const armedNpcCount = state.npcs.filter((npc) => npc.is_armed).length;
  const current = state.scene.tension_level;
  const movingFastNearDealer =
    state.player.distance_to_dealer < 8 && state.player.movement_speed > 4.1;
  const invadingSpace = state.player.distance_to_dealer < 1.8;
  const calmConversation =
    state.conversation.is_active && state.player.movement_speed < 0.4;

  let target = 0.12 + armedNpcCount * 0.06;

  if (state.conversation.is_active) target += 0.08;
  if (movingFastNearDealer) target += 0.25;
  if (invadingSpace) target += 0.12;
  if (!state.player.approached_calmly) target += 0.08;
  if (state.scene.ambient_events.includes("gunshot_nearby")) target += 0.2;

  if (calmConversation) target -= 0.08;
  if (state.player.distance_to_dealer > 4.2 && state.conversation.is_active) {
    target -= 0.05;
  }

  const response = Math.min(1, deltaSeconds * 1.8);
  return clamp01(lerp(current, clamp01(target), response));
}

export function animationForRole(
  role: string,
  tension: number,
  activeConversation: boolean,
): NPCAnimationState {
  if (role === "bystander" && tension > 0.72) return "fleeing";
  if (role === "bodyguard" && tension > 0.68) return "aggressive";
  if (role === "bodyguard" && tension > 0.42) return "alert";
  if (role === "dealer" && activeConversation) return tension > 0.62 ? "alert" : "idle";
  return role === "bodyguard" ? "relaxed" : "idle";
}

export function dispositionForRole(
  role: string,
  tension: number,
  current: NPCDisposition,
): NPCDisposition {
  if (role === "bystander" && tension > 0.72) return "nervous";
  if (role === "bodyguard" && tension > 0.68) return "hostile";
  if (role === "dealer" && tension < 0.3) return "friendly";
  if (role === "dealer" && tension > 0.7) return "hostile";
  if (current === "friendly" && tension > 0.55) return "neutral";
  return current === "hostile" && tension < 0.45 ? "neutral" : current;
}
