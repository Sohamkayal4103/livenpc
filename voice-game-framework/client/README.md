# client/ — Game‑side Pipecat integration

Rewires the existing `../../scene-negotiation/` game so its audio runs on a Pipecat transport instead of the hand‑rolled base64‑over‑JSON WebSocket.

## What changes in scene-negotiation
| Old (`scene-negotiation/src/systems/`) | New |
|---|---|
| `MicCapture.ts` (base64 PCM chunks) | Pipecat client mic over the WebRTC **media track** — delete the base64 path. |
| `WebSocketBridge.ts` audio messages (`player_audio`, `npc_audio`) | `pipecatBridge.ts` — audio on the media track. |
| `WebSocketBridge.ts` game messages (`game_state_update`, `npc_action`, `tension_override`, `subtitle`) | Same intent, now on the Pipecat **data channel** (RTVI app messages). |
| `AudioManager.ts` spatial playback | Keep if feasible (pipe transport audio through a `PannerNode`), else use Pipecat audio out. |

## Files
| File | Responsibility | Status |
|---|---|---|
| `pipecatBridge.ts` | Connect SmallWebRTC; mic out + NPC voice in on media; game state out + NPC actions in on data channel; dispatch to the Zustand store (`applyNpcAction`, `setTension`, `setSubtitle`). | ☐ to write |

## Wiring
Incoming data‑channel messages map straight onto existing store actions in
`scene-negotiation/src/systems/GameStateManager.ts` — no store rewrite needed.
Outgoing game state uses the existing `selectTextSnapshot()` shape, conformed to `../shared/schema.ts`.

## Dependency
```bash
cd ../../scene-negotiation && npm i @pipecat-ai/client-js @pipecat-ai/small-webrtc-transport
```
(Confirm exact package names against current Pipecat JS client docs.)
