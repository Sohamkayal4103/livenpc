import { BACKEND_WS_URL } from "../config/sceneConfig";
import type {
  AudioChunkMetadata,
  BackendMessage,
  NPCActionMessage,
  NPCAudioMessage,
  SubtitleMessage,
  TensionOverrideMessage,
} from "../types/GameState";
import { audioManager } from "./AudioManager";
import { useGameStore } from "./GameStateManager";

const extractAudio = (message: NPCAudioMessage) => {
  if (typeof message.data === "string") return message.data;
  return message.data.audio ?? message.data.base64 ?? "";
};

class WebSocketBridge {
  private socket: WebSocket | null = null;
  private url = BACKEND_WS_URL;
  private reconnectTimer: number | null = null;
  private shouldReconnect = false;
  private queuedMessages: unknown[] = [];

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(url = BACKEND_WS_URL) {
    this.url = url;
    this.shouldReconnect = true;
    useGameStore.getState().setBackendUrl(url);
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    useGameStore.getState().setBackendStatus("connecting");
    void this.probeAndOpen();
  }

  private async probeAndOpen() {
    if (!this.shouldReconnect) return;
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const available = await this.probeBackend();
    if (!available) {
      useGameStore.getState().setBackendStatus("disconnected");
      this.scheduleReconnect();
      return;
    }

    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      useGameStore.getState().setBackendStatus("connected");
      this.sendGameState(useGameStore.getState().gameState);
      this.flushQueue();
    };

    this.socket.onclose = () => {
      this.socket = null;
      useGameStore.getState().setBackendStatus("disconnected");
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      useGameStore.getState().setBackendStatus("error", `Unable to connect to ${this.url}`);
    };

    this.socket.onmessage = (event) => {
      useGameStore.getState().noteBackendMessage();
      try {
        this.handleMessage(JSON.parse(event.data) as BackendMessage);
      } catch (error) {
        console.warn("Invalid backend message", error, event.data);
      }
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    useGameStore.getState().setBackendStatus("disconnected");
  }

  sendGameState(gameState: unknown) {
    this.sendJson({
      type: "game_state_update",
      data: gameState,
    });
  }

  sendConversationStart(npcId: string) {
    this.sendJson({
      type: "conversation_start",
      npc_id: npcId,
    });
  }

  sendConversationEnd(npcId: string) {
    this.sendJson({
      type: "conversation_end",
      npc_id: npcId,
    });
  }

  sendPlayerAudio(base64Audio: string, metadata: AudioChunkMetadata) {
    this.sendJson({
      type: "player_audio",
      data: {
        audio: base64Audio,
        ...metadata,
      },
    });
  }

  private sendJson(payload: unknown) {
    if (!this.connected || !this.socket) {
      if (this.shouldReconnect) this.queueMessage(payload);
      return;
    }
    this.socket.send(JSON.stringify(payload));
  }

  private queueMessage(payload: unknown) {
    const typedPayload = payload as { type?: string };
    if (typedPayload.type === "game_state_update") {
      this.queuedMessages = this.queuedMessages.filter(
        (message) => (message as { type?: string }).type !== "game_state_update",
      );
    }
    this.queuedMessages.push(payload);
    if (this.queuedMessages.length > 24) {
      this.queuedMessages = this.queuedMessages.slice(-24);
    }
  }

  private flushQueue() {
    if (!this.connected || !this.socket) return;
    const messages = this.queuedMessages;
    this.queuedMessages = [];
    for (const message of messages) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      useGameStore.getState().setBackendStatus("connecting");
      void this.probeAndOpen();
    }, 3000);
  }

  private async probeBackend() {
    const httpUrl = this.url.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 700);
    try {
      await fetch(httpUrl, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private handleMessage(message: BackendMessage) {
    const store = useGameStore.getState();
    if (message.type === "npc_audio") {
      const audioMessage = message as NPCAudioMessage;
      const npc = store.gameState.npcs.find((candidate) => candidate.id === audioMessage.npc_id);
      const audio = extractAudio(audioMessage);
      if (audioMessage.subtitle) {
        store.setSubtitle(audioMessage.subtitle);
      }
      if (npc && audio) {
        store.incrementTurn();
        void audioManager.playNpcAudio(audioMessage.npc_id, audio, npc.position, (speaking) => {
          useGameStore.getState().setNpcSpeaking(audioMessage.npc_id, speaking);
        });
      }
      return;
    }

    if (message.type === "npc_action") {
      const actionMessage = message as NPCActionMessage;
      store.applyNpcAction(actionMessage.npc_id, actionMessage.action);
      return;
    }

    if (message.type === "tension_override") {
      store.setTension((message as TensionOverrideMessage).level);
      return;
    }

    if (message.type === "subtitle") {
      store.setSubtitle((message as SubtitleMessage).text);
    }
  }
}

export const webSocketBridge = new WebSocketBridge();
