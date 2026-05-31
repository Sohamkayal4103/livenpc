// Pipecat bridge — the game client's connection to the NPC agent.
//
// Replaces the old base64-over-JSON WebSocket. Audio (mic + NPC voice) rides
// the Pipecat WebRTC media track automatically; game state + NPC actions ride
// the RTVI data channel:
//   - game -> agent : sendGameState() / sendConversationEnd()  (sendClientMessage)
//   - agent -> game : onServerMessage (npc_action / tension_update) + onSubtitle
//
// Self-contained + framework-agnostic: it knows nothing about the game store.
// The game wires its store to these callbacks (see scene-negotiation's
// systems/PipecatConnection.ts).

import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import type { AgentToGameMessage, GameStateMessage } from "../shared/schema";

export type BridgeStatus = "connecting" | "connected" | "disconnected" | "error";

export interface PipecatBridgeHandlers {
  onStatus?: (status: BridgeStatus, error?: string) => void;
  onServerMessage?: (msg: AgentToGameMessage) => void; // npc_action / tension_update
  onSubtitle?: (text: string) => void;
  onBotSpeaking?: (speaking: boolean) => void;
  onUserSpeaking?: (speaking: boolean) => void;
}

export const DEFAULT_AGENT_URL = "http://localhost:7860/api/offer";

class PipecatBridge {
  private client: PipecatClient | null = null;
  private connected = false;
  private handlers: PipecatBridgeHandlers = {};
  private botAudioEl: HTMLAudioElement | null = null;

  get isConnected() {
    return this.connected;
  }

  /** The Pipecat client does NOT auto-play the NPC's voice — it hands us a
   * MediaStreamTrack and we must attach it to an <audio> element ourselves. */
  private attachBotAudio(track: MediaStreamTrack) {
    if (!this.botAudioEl) {
      const el = document.createElement("audio");
      el.autoplay = true;
      el.style.display = "none";
      document.body.appendChild(el);
      this.botAudioEl = el;
    }
    this.botAudioEl.srcObject = new MediaStream([track]);
    void this.botAudioEl.play().catch(() => {
      /* autoplay may need a gesture; the player already clicked, so this is rare */
    });
  }

  private teardownBotAudio() {
    if (this.botAudioEl) {
      this.botAudioEl.srcObject = null;
      this.botAudioEl.remove();
      this.botAudioEl = null;
    }
  }

  setHandlers(handlers: PipecatBridgeHandlers) {
    this.handlers = handlers;
  }

  async connect(webrtcUrl = DEFAULT_AGENT_URL) {
    if (this.client) return;

    const client = new PipecatClient({
      transport: new SmallWebRTCTransport(),
      enableMic: true,
      enableCam: false,
    });
    this.client = client;
    this.handlers.onStatus?.("connecting");

    client.on(RTVIEvent.Connected, () => {
      this.connected = true;
      this.handlers.onStatus?.("connected");
    });
    client.on(RTVIEvent.Disconnected, () => {
      this.connected = false;
      this.handlers.onStatus?.("disconnected");
    });
    client.on(RTVIEvent.Error, (e: unknown) => {
      this.handlers.onStatus?.("error", String(e));
    });

    // Custom server messages (npc_action / tension_update). The RTVI envelope
    // may hand us either the inner payload or a { data: payload } wrapper —
    // unwrap defensively.
    client.on(RTVIEvent.ServerMessage, (raw: any) => {
      const msg = raw && raw.type ? raw : raw?.data;
      if (msg && typeof msg.type === "string") {
        this.handlers.onServerMessage?.(msg as AgentToGameMessage);
      }
    });

    // Subtitles: the NPC's spoken line as text, straight from RTVI.
    client.on(RTVIEvent.BotTranscript, (d: { text: string }) => {
      if (d?.text) this.handlers.onSubtitle?.(d.text);
    });

    // Attach the NPC's voice track so it actually plays. The bot track may
    // arrive with participant undefined on SmallWebRTC — treat "not explicitly
    // local" as the bot.
    client.on(RTVIEvent.TrackStarted, (track: MediaStreamTrack, participant?: { local?: boolean }) => {
      console.debug("[pipecatBridge] trackStarted", track.kind, "local:", participant?.local);
      if (track.kind === "audio" && !participant?.local) {
        this.attachBotAudio(track);
      }
    });

    client.on(RTVIEvent.BotStartedSpeaking, () => this.handlers.onBotSpeaking?.(true));
    client.on(RTVIEvent.BotStoppedSpeaking, () => this.handlers.onBotSpeaking?.(false));
    client.on(RTVIEvent.UserStartedSpeaking, () => this.handlers.onUserSpeaking?.(true));
    client.on(RTVIEvent.UserStoppedSpeaking, () => this.handlers.onUserSpeaking?.(false));

    try {
      await client.connect({ webrtcUrl });
      // Fallback: if the bot audio track started before our listener attached,
      // grab it from the transport's current tracks.
      const botAudio = client.tracks()?.bot?.audio;
      if (botAudio) this.attachBotAudio(botAudio);
    } catch (error) {
      this.handlers.onStatus?.("error", String(error));
      this.client = null;
      this.connected = false;
    }
  }

  sendGameState(payload: GameStateMessage) {
    if (!this.client) return;
    this.client.sendClientMessage("game_state", payload);
  }

  sendConversationEnd(npcId: string) {
    if (!this.client) return;
    this.client.sendClientMessage("conversation_end", { npc_id: npcId });
  }

  async disconnect() {
    const client = this.client;
    this.client = null;
    this.connected = false;
    this.teardownBotAudio();
    try {
      await client?.disconnect();
    } catch {
      /* ignore */
    }
    this.handlers.onStatus?.("disconnected");
  }
}

export const pipecatBridge = new PipecatBridge();
