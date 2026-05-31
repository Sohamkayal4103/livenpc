// Game <-> NPC agent integration.
//
// Bridges the Zustand game store to the framework's Pipecat bridge:
//   - OUT: maps the game store -> shared GameStateMessage, sent on a throttle.
//   - IN : maps agent messages (npc_action / tension_update) + subtitles +
//          speaking state back onto store actions.
//
// Replaces the old WebSocketBridge audio/JSON path. Audio (mic + Rico's voice)
// is handled by the Pipecat WebRTC media track inside the bridge.

import { pipecatBridge } from "@vgf/client/pipecatBridge";
import type { GameStateMessage, NPCSnapshot } from "@vgf/shared/schema";
import { DEALER_ID } from "../config/sceneConfig";
import type { GameState, NPCAction } from "../types/GameState";
import { useGameStore } from "./GameStateManager";

const AGENT_URL =
  (import.meta.env.VITE_AGENT_URL as string | undefined) ?? "http://localhost:7860/api/offer";

const SESSION_ID = `sess_${Math.random().toString(36).slice(2, 10)}`;
const STATE_SEND_INTERVAL_MS = 400;

let conversationId = "";
let sendTimer: number | null = null;

function dist(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.round(Math.sqrt(dx * dx + dz * dz) * 100) / 100;
}

/** Map the game store's GameState into the canonical shared GameStateMessage. */
function toGameStateMessage(state: GameState): GameStateMessage {
  const npcs: NPCSnapshot[] = state.npcs.map((npc) => ({
    id: npc.id,
    name: npc.name,
    role: npc.role,
    position: npc.position,
    distance_to_player: dist(npc.position, state.player.position),
    disposition: npc.disposition,
    is_armed: npc.is_armed,
    animation_state: npc.animation_state,
  }));

  return {
    type: "game_state",
    schema_version: 1,
    session_id: SESSION_ID,
    conversation_id: conversationId,
    timestamp_ms: Date.now(),
    scene: {
      id: state.scene.name,
      tension_level: state.scene.tension_level,
      ambient_events: state.scene.ambient_events,
    },
    player: {
      position: state.player.position,
      looking_at: state.player.looking_at,
      distance_to_dealer: state.player.distance_to_dealer,
      is_speaking: state.player.is_speaking,
      movement_speed: state.player.movement_speed,
      approached_calmly: state.player.approached_calmly,
    },
    npcs,
  };
}

function wireHandlers() {
  pipecatBridge.setHandlers({
    onStatus: (status) => {
      // Map bridge status onto the store's backend status (drives the HUD).
      const mapped = status === "error" ? "error" : status;
      useGameStore.getState().setBackendStatus(mapped, status === "error" ? "Agent error" : null);
    },
    onServerMessage: (msg) => {
      const store = useGameStore.getState();
      if (msg.type === "npc_action") {
        store.applyNpcAction(msg.npc_id, msg.action as NPCAction);
      } else if (msg.type === "tension_update") {
        store.setTension(msg.tension_level);
      } else if (msg.type === "subtitle") {
        store.setSubtitle(msg.text);
      }
    },
    onSubtitle: (text) => {
      useGameStore.getState().setSubtitle(text);
    },
    onBotSpeaking: (speaking) => {
      useGameStore.getState().setNpcSpeaking(DEALER_ID, speaking);
      if (speaking) useGameStore.getState().incrementTurn();
    },
    onUserSpeaking: (speaking) => {
      useGameStore.getState().setPlayerSpeaking(speaking);
    },
  });
}

function startSendLoop() {
  if (sendTimer != null) return;
  const tick = () => {
    if (!pipecatBridge.isConnected) return;
    const state = useGameStore.getState().gameState;
    pipecatBridge.sendGameState(toGameStateMessage(state));
  };
  tick();
  sendTimer = window.setInterval(tick, STATE_SEND_INTERVAL_MS);
}

function stopSendLoop() {
  if (sendTimer != null) {
    window.clearInterval(sendTimer);
    sendTimer = null;
  }
}

/** Begin a conversation with the dealer: connect audio + start streaming state. */
export async function startNpcConversation() {
  conversationId = `conv_${Math.random().toString(36).slice(2, 10)}`;
  wireHandlers();
  const store = useGameStore.getState();
  store.startConversation(DEALER_ID);
  store.setMicActive(true);
  await pipecatBridge.connect(AGENT_URL);
  startSendLoop();
}

/** End the conversation: stop streaming + disconnect audio. */
export async function endNpcConversation() {
  stopSendLoop();
  pipecatBridge.sendConversationEnd(DEALER_ID);
  await pipecatBridge.disconnect();
  const store = useGameStore.getState();
  store.setPlayerSpeaking(false);
  store.endConversation();
}
