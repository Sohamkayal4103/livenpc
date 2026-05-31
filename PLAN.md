# PLAN.md — Voice Game Agent Framework

> **Single source of truth for this project.** Any human or AI agent should be able to read this file top‑to‑bottom and know *what we are building, why, how it is structured, and exactly what to do next.* Update the TODO checkboxes as work lands. Keep this file honest — if something is half‑done, say so.

---

## 0. TL;DR (read this first)

We are building a **voice‑agent framework for games**: a player talks (real voice) to NPCs in a 3D scene; an NPC talks back (real voice), and the scene reacts (NPC actions, tension, subtitles) in real time. The demo vehicle is a GTA‑style street negotiation with a drug dealer NPC named **Rico**.

This is being built **for the Cekura × Daily YC Voice Agents Hackathon** (sponsors: NVIDIA, AWS, Twilio). To win, the framework MUST be built **on the sponsor stack**, not around it:

- **Orchestration:** Pipecat (required by the organizers).
- **Models:** NVIDIA open weights — Nemotron‑3‑Super‑120B LLM + Nemotron Speech Streaming STT (hosted on AWS during the event) + Gradium TTS.
- **Evaluation + Auto‑Improvement:** Cekura. **This is the headline theme and the differentiator.** The demo that wins shows a Cekura scorecard going from "fails" → auto‑tuned → "passes," live.
- **Telephony / scale (optional stretch):** Twilio + Pipecat Cloud.

**The most important strategic decision (already made):** the audio conversation runs on a **real Pipecat agent over WebRTC**, NOT on a hand‑rolled base64‑over‑JSON WebSocket. Game *state* and NPC *actions* ride a separate data channel. See §3.

---

## 0.5 Credentials & accounts (what you actually need)

| Credential | Needed for | Phase | Status / how to get it |
|---|---|---|---|
| `GRADIUM_API_KEY` | **Required** — TTS (both paths) + STT in the GPT path | 0 | Free signup at gradium.ai; org gives a credits code at the event. |
| `NVIDIA_ASR_URL` / `NEMOTRON_LLM_URL` / `NEMOTRON_LLM_MODEL` | **Required** — NVIDIA STT + LLM | 0 | **Live, in README** (see Phase 0). No key. |
| **Pipecat Cloud** account + `pc cloud auth login` | **Required for Cekura** — Cekura tests a *deployed* Pipecat Cloud agent | 4 | Free signup: pipecat.daily.co/sign-up. `uv tool install pipecat-ai-cli`. |
| **Cekura** account (dashboard.cekura.ai) | **Required** — eval + auto-improve (the win) | 4 | Sign up; hackathon credits auto-apply. If missing, find Cekura staff on-site. |
| `OPENAI_API_KEY` | *Optional* — only for `bot-gpt.py` (GPT-4.1 vs Nemotron comparison in Cekura) | 0 | Your own paid key, small spend. Skip if going Nemotron-only. |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` | *Stretch* — phone access to the NPC | 5 | ✅ **Account upgraded (promo applied).** Still need to buy a voice number (uses credits) + wire a TwiML Bin. |
| **AWS account** | — | — | **Not needed.** NVIDIA models are hosted for us; we only hit the endpoints. |
| **NVIDIA / NGC key** | — | — | **Not needed.** Endpoints are open; LLM uses `api_key="EMPTY"`. |

**Bottom line:** the only keys to actively obtain are **Gradium** (free, credits at event) and accounts on **Pipecat Cloud** + **Cekura** (both free for the hackathon). NVIDIA is keyless. OpenAI and Twilio are optional/stretch.

---

## 1. Goals

### 1.1 Primary goal (must hit)
A working end‑to‑end loop, demoable in < 2 minutes:

1. Player speaks into the browser → Pipecat agent hears it (NVIDIA STT).
2. Nemotron LLM, given the **game state** (scene tension, player proximity, who is armed), responds **in character** as Rico (Gradium TTS), and optionally calls **NPC‑action tools** (`draw_weapon`, `step_forward`, `flee`, `relax`).
3. The 3D game plays the NPC voice spatially and applies the actions + tension changes.
4. **Cekura** simulates players against this agent, scores it on game‑specific evaluators, and we **feed failures back** into the persona/thresholds and show the score improve.

### 1.2 Secondary goals (strong bonus)
- Modular framework: swap the persona/scene without touching the pipeline. Adding "Bartender in a tavern" should be a config + prompt change, not a rewrite.
- Latency story: measure and minimize TTFB (time‑to‑first‑spoken‑word). Reasoning OFF for the realtime NPC.
- A second, off‑path "**Director**" that uses Nemotron *low‑effort reasoning* to adjust scene tension out‑of‑band (does not block speech).

### 1.3 Stretch goals (only if core is green)
- Twilio phone number → call Rico on a real phone.
- Multiple NPCs in one scene (dealer + bodyguard) with turn arbitration.
- Persistence: NPC remembers prior conversations across sessions.

### 1.4 Non‑goals (explicitly out of scope)
- Building a new STT/LLM/TTS from scratch — we reuse the starter kit's services.
- AAA game art. The existing `scene-negotiation/` visuals are good enough.
- Self‑hosting Nemotron (needs 8×H100). Use the AWS‑hosted endpoint the organizers provide.

---

## 2. Context: what already exists in this repo

| Path | What it is | How we use it |
|---|---|---|
| `scene-negotiation/` | A finished GTA‑style 3D scene (React + Three.js + Zustand). Player controls, NPCs, spatial audio, HUD, mic capture, a custom WebSocket bridge. | **Reuse the visuals/controls.** Rip out the custom audio transport; rewire to Pipecat. See §3. |
| `yc-voice-agents-hackathon/server/` | The official starter kit. A working Pipecat bot ("Field & Flower" flower shop) with GPT‑4.1 and a Nemotron variant. | **The spine.** We adapt `bot-nemotron.py` into the NPC agent. Copy `nvidia_stt.py` + `nemotron_llm.py` verbatim. |
| `voice-game-framework/` | **NEW — what we are building.** Modular framework code. | All new work lands here. See §4. |

### 2.1 Key facts learned from the starter kit (don't re‑learn these)
- The Pipecat pipeline is: `transport.input() → STT → user_aggregator → LLM → TTS → transport.output() → assistant_aggregator`.
- **NPC actions = LLM tools.** The flower bot's `add_to_order`/`place_order` are direct functions registered on the LLM. Our `draw_weapon`/`step_forward` work identically — the tool handler emits a message to the game.
- **Nemotron LLM** is OpenAI‑compatible vLLM. `nemotron_llm.py` (`VLLMOpenAILLMService`) fixes TTFB metrics for reasoning models. Toggle reasoning via `extra_body={"chat_template_kwargs": {"enable_thinking": bool}}`. **Keep thinking OFF for the realtime NPC** — the live endpoint may not strip chain‑of‑thought from spoken output.
- **Nemotron STT** (`nvidia_stt.py`, `NVidiaWebSocketSTTService`) is a WebSocket STT; VAD‑driven finalization. Expects 16‑bit PCM, 16 kHz, mono. Copy as‑is.
- **Transports:** `SmallWebRTCTransport` for local browser dev, `FastAPIWebsocketTransport` + `TwilioFrameSerializer` for phone. Krisp noise filter is auto‑enabled when deployed to Pipecat Cloud.
- **Cekura** connects to a **Pipecat Cloud** agent over WebRTC (Daily) as a simulated speaker and scores transcripts. It needs: Pipecat Cloud API key, agent name, agent‑config JSON, room‑properties JSON. **It cannot test a custom binary protocol** — this is *why* §3 matters.

---

## 3. Architecture (the decision that wins or loses)

### 3.1 The split: two channels, not one
The old plan crammed audio + game state + actions into one JSON WebSocket with base64 PCM. That breaks Pipecat compatibility, can't be evaluated by Cekura, and the base64 overhead fights the hackathon's latency theme. **We split by what each thing is:**

```
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│   GAME CLIENT (browser)     │         │     PIPECAT NPC AGENT (Python)        │
│   scene-negotiation/ +      │         │     voice-game-framework/agent/        │
│   pipecat-client-js         │         │                                        │
│                             │         │   transport.input()                    │
│  🎙  mic ───────────────────┼──audio──▶  → NVIDIA STT (nvidia_stt.py)          │
│                             │  (WebRTC │  → user_aggregator                     │
│  🔊  NPC voice ◀────────────┼──media)──  → Nemotron LLM (nemotron_llm.py)      │
│                             │         │     • persona = Rico (personas/)       │
│                             │         │     • game state injected as context   │
│  🎮  game state ────────────┼──data────▶    (game_context.py)                  │
│      (tension, proximity,   │  channel │     • NPC actions = LLM tools          │
│       who's armed)          │ (RTVI    │       (game_tools.py)                  │
│                             │  app msg)│  → Gradium TTS                         │
│  ⚡  NPC actions ◀──────────┼──data────  → transport.output()                  │
│      (draw_weapon, tension) │  channel │  → assistant_aggregator               │
└─────────────────────────────┘         └──────────────────────────────────────┘
                                                      ▲
                                                      │ simulates a "player",
                                              ┌───────┴────────┐  scores transcripts
                                              │     CEKURA     │  → auto‑improve loop
                                              └────────────────┘
```

- **Audio channel (WebRTC media track):** player mic → NPC voice. Continuous binary. This is what Cekura evaluates and where latency lives. **No base64, no per‑frame JSON.**
- **Data channel (RTVI / app messages):** game state IN (as LLM context), NPC actions + tension + subtitles OUT (from LLM tool calls).

### 3.2 How game state reaches the LLM
Each turn (or on significant change), the client sends a compact game‑state message on the data channel. The agent injects it into the LLM context as a system/context note, e.g.:

> *"Scene state: tension 0.42 (rising). Player is 3.2m away, approached calmly, looking at you, unarmed. Your bodyguard is idle. Stay in character as Rico."*

This is the same mechanism as the flower bot adding `caller_context` to the system prompt — just refreshed per turn.

### 3.3 How NPC actions reach the game
NPC actions are **LLM tools** (direct functions, exactly like `place_order`). When Nemotron decides Rico draws a weapon, it calls `draw_weapon(target="player")`. The handler:
1. Returns a tool result to the LLM (so it can keep talking), and
2. Emits an **app message** on the data channel → the game client applies it via the existing `applyNpcAction` / `setTension` store actions.

### 3.4 The shared schema (single source of truth)
`voice-game-framework/shared/` holds the canonical protocol so client (TS) and agent (Python) never drift. **Unify the divergent schemas** (the old plan and the game code disagreed — see §7). Anchor on the game's `GameState` field names (`tension_level`, `animation_state`, `is_armed`, `disposition`) and the fixed `NPCAction` enum. Add `schema_version`, thread `conversation_id` + `utterance_id` for eval/observability.

---

## 4. Folder structure (modular — build here)

```
voice-game-framework/
├── README.md                  # How to run the framework end‑to‑end
├── agent/                     # Pipecat NPC backend (Python) — the spine
│   ├── README.md
│   ├── bot_npc.py             # NPC agent (adapted from starter bot-nemotron.py)
│   ├── game_context.py        # game state JSON → LLM context string
│   ├── game_tools.py          # NPC action tools (draw_weapon, step_forward, ...)
│   ├── director.py            # (stretch) off‑path tension reasoning
│   ├── personas/              # one file per NPC persona (prompt + tool config)
│   │   └── rico_dealer.py
│   └── services/              # copied verbatim from starter kit
│       ├── nvidia_stt.py
│       └── nemotron_llm.py
├── client/                    # Game‑side Pipecat integration (TS)
│   ├── README.md
│   └── pipecatBridge.ts       # replaces scene-negotiation WebSocketBridge audio path
├── shared/                    # Canonical protocol — single source of truth
│   ├── README.md
│   ├── protocol.md            # human‑readable contract (req/resp/data messages)
│   ├── schema.ts              # TS types (imported by the game client)
│   └── schema.py              # Pydantic models (imported by the agent)
├── eval/                      # Cekura evaluators + scenarios
│   ├── README.md
│   └── scenarios/             # game‑specific test scenarios + evaluator definitions
└── docs/
    └── README.md              # architecture notes, latency log, decisions
```

**Modularity rule:** adding a new NPC = a new file in `personas/` + a row in the scene config. The pipeline in `bot_npc.py` does not change. Keep persona text, tool definitions, and pipeline wiring separate.

---

## 5. TODO — execution checklist

Work top to bottom. Each phase ends with a **verifiable** checkpoint. Don't start a phase before the prior checkpoint is green.

### Phase 0 — Setup & smoke test (the starter, unmodified) ✅ DONE (2026-05-30)
- [x] Install `uv`; `cd yc-voice-agents-hackathon/server && uv sync`.
- [x] Copy `.env.example` → `.env`. Filled `OPENAI_API_KEY` + `GRADIUM_API_KEY` (+ live NVIDIA endpoints + Twilio creds).
- [x] `uv run bot-gpt.py` → talked to it in browser. **Works great; hears voice well, responsive.**
- [x] Set the **live NVIDIA endpoints** (now published in the hackathon README) and run `uv run bot-nemotron.py`. **Checkpoint: Nemotron path works.**
  ```bash
  export NVIDIA_ASR_URL=ws://44.241.251.184:8080
  export NEMOTRON_LLM_URL=http://nemotron-fleet-alb-1322439314.us-west-2.elb.amazonaws.com/v1
  export NEMOTRON_LLM_MODEL=nvidia/nemotron-3-super
  ```
  No NVIDIA key needed (the LLM service uses `NEMOTRON_LLM_API_KEY="EMPTY"`). The LLM URL is plain HTTP behind an AWS ALB; the ASR is a raw WebSocket on `:8080`.
- [x] **Nemotron path verified (2026-05-30):** hears voice accurately, responds correctly. Noticeably slower than GPT (expected for 120B) — acceptable; `enable_thinking=false` already set. Measure/optimize TTFB later in Cekura (Phase 4).

### Phase 1 — Shared schema ⏱ ~30 min
- [ ] Write `shared/protocol.md`: define the data‑channel messages (game_state IN; npc_action / tension_update / subtitle OUT) and correlation IDs. Fold in the old request/response intent from git history of `voice_agent_framework_plan.md` (deleted — see §7 for the preserved schema).
- [ ] Write `shared/schema.ts` and `shared/schema.py` with matching field names. **Checkpoint: one schema, two languages, no drift.**

### Phase 2 — The NPC agent (CORE) ⏱ ~2–3 hr
- [ ] Copy `nvidia_stt.py` + `nemotron_llm.py` into `agent/services/`.
- [ ] Create `agent/personas/rico_dealer.py`: Rico's system prompt (terse, in‑character, spoken‑aloud rules like the flower bot's style guide) + which tools he has.
- [ ] Create `agent/game_tools.py`: `draw_weapon`, `holster_weapon`, `step_forward`, `flee`, `relax` as direct functions. Each emits an app message to the client + returns a tool result. Map 1:1 to the game's `NPCAction` enum.
- [ ] Create `agent/game_context.py`: turn a game‑state message into a compact context string for the LLM.
- [ ] Create `agent/bot_npc.py` from `bot-nemotron.py`: same pipeline; swap persona; register game tools; on data‑channel game‑state messages, refresh context; keep `enable_thinking=False`.
- [x] **Checkpoint PASSED (2026-05-30):** talked to Rico in browser. In character; escalation ladder works — verbal threat → `step_forward`, "I pull a knife" → `draw_weapon` (both fired in logs as `[npc_action]`, tool→app-message path confirmed). Minor: strip stray `✓` token from Nemotron output before it can reach subtitles.

### Phase 3 — Game client rewire ⏱ ~2 hr
- [ ] Add `pipecat-client-js` to `scene-negotiation/`.
- [ ] Write `client/pipecatBridge.ts`: connect SmallWebRTC, send mic over the media track, receive NPC voice, send game state + receive NPC actions on the data channel.
- [ ] Replace the audio path in `scene-negotiation/src/systems/WebSocketBridge.ts` (and retire `MicCapture` base64 path) with the bridge. Keep `AudioManager` spatial playback if feasible, or use Pipecat's audio out + a panner.
- [ ] Wire incoming actions to existing store calls (`applyNpcAction`, `setTension`, `setSubtitle`).
- [x] **Checkpoint PASSED (2026-05-30):** full loop in 3D — walk up, press E, talk, Rico replies in voice, subtitles show his lines, actions/tension drive the scene. Fixes made: client uses RTVI (`sendClientMessage`/`ServerMessage`) not raw app messages; bot audio track attached to an `<audio>` element manually; removed `FilterIncompleteUserTurnStrategies` (Nemotron leaked turn-classifier reasoning into speech) → plain VAD turn-taking.

### Phase 4 — Cekura eval + auto‑improve (THE WIN) ⏱ ~2 hr
- [ ] Deploy the agent to Pipecat Cloud (`pc cloud deploy`) so Cekura can reach it.
- [ ] Install Cekura plugin: `/plugin marketplace add cekura-ai/cekura-skills` then `/plugin install cekura@cekura-skills`; run `/setup-mcp`.
- [ ] Define game‑specific evaluators (`/create-metric` or `/autogen-eval`): *stays in character; escalates tension only when threatened; draws weapon only on real provocation; de‑escalates on compliance; TTFB under budget; no chain‑of‑thought leakage.*
- [ ] `/run-evals` → `/cekura-report`. Record the baseline scorecard (screenshot it).
- [ ] Use `cekura-self-improving-agent` / `/improve-metric` to feed failures into the persona prompt + tool‑trigger thresholds. Re‑run. **Checkpoint: a documented before→after score improvement.**

### Phase 5 — Demo polish & stretch ⏱ remaining time
- [ ] Rehearse the < 2‑min demo + the Cekura before/after slide.
- [ ] (Stretch) Twilio number → call Rico (`bot_npc.py` already has the Twilio transport branch from the starter).
- [ ] (Stretch) `agent/director.py`: low‑effort reasoning tension director.
- [ ] (Stretch) Add a second NPC persona to prove modularity.

---

## 6. Winning criteria & demo script

**Judges reward (from the README):** creativity, technical interest, real problem‑solving, *great use of Cekura to improve performance*, and *use of NVIDIA open models*. The auto‑improve loop is the theme.

**Demo narrative (2 min):**
1. "Everyone else built a phone bot. We built a 3D game NPC you *talk to* — on the same production stack: Pipecat orchestration, Nemotron on AWS, Twilio‑ready."
2. Live: walk up to Rico, negotiate, he draws a gun, tension spikes. (15s of magic.)
3. "But the point isn't that it works — it's that we can *measure and improve* it." Show Cekura baseline: Rico fails *'don't draw a weapon unprovoked'* at 6/10.
4. Show the auto‑improved prompt diff → re‑run → 9/10. **That arc is the win.**

---

## 7. Preserved reference: the original request/response schema (from the deleted plan)

The old `voice_agent_framework_plan.md` proposed a custom HTTP/WS contract. We **retired the transport** (audio now rides Pipecat WebRTC) but the *semantic model* below is still the basis for `shared/`. Note: the old plan and the running game code used different field names — `shared/schema.*` MUST unify them (anchor on the game's names). Captured here so nothing is lost:

**Request intent (game → agent), now split into a data‑channel `game_state` message:**
```json
{
  "type": "game_state", "schema_version": 1,
  "session_id": "sess_123", "conversation_id": "conv_456", "timestamp_ms": 0,
  "player": { "position": {"x":0,"y":0,"z":3.2}, "looking_at": "dealer_rico",
              "is_speaking": true, "last_action": {"type":"walk_forward","note":"..."} },
  "scene": { "id": "gta_back_alley", "tension_level": 0.42, "ambient_events": ["player_approached_dealer"] },
  "npcs": [ { "id":"dealer_rico", "role":"dealer", "distance_to_player":3.2,
              "disposition":"neutral", "is_armed":false, "animation_state":"idle" } ]
}
```

**Response intent (agent → game) — now: audio on the media track + these on the data channel:**
```json
{ "type": "npc_action", "npc_id": "bodyguard_1", "action": "step_forward",
  "params": { "distance": 0.8, "duration_ms": 900 }, "utterance_id": "utt_789" }
```
```json
{ "type": "tension_update", "tension_level": 0.55 }
```
```json
{ "type": "subtitle", "npc_id": "dealer_rico", "utterance_id": "utt_789",
  "text": "You came alone. Good. Let's talk." }
```
Audio (`pcm_s16le`/base64) that the old plan put inline is **removed** — it is the WebRTC media track.

**Field‑name unification (old plan → canonical):** `scene.tension` → `scene.tension_level`; `npc.state` → `npc.animation_state`; `npc.armed` → `npc.is_armed`; free‑form action strings → fixed `NPCAction` enum (`step_forward | draw_weapon | holster_weapon | flee | relax`).

---

## 8. Risks & how to handle them
- **Three WebRTC pieces** (browser ↔ agent ↔ Cekura): get the audio path green in Phase 2/3 *before* any 3D polish.
- **Nemotron is heavy** (8×H100): use the AWS‑hosted endpoint only; never self‑host. Reasoning OFF for the NPC to protect latency and avoid spoken chain‑of‑thought.
- **Cekura needs a deployed agent:** budget time for `pc cloud deploy` in Phase 4; don't leave it to the last hour.
- **Schema drift:** the client and agent share `shared/` — change the schema in one place only.

---

## 9. How to keep this file useful
- Tick the boxes in §5 as work lands; add new TODOs as they surface.
- Log latency numbers and Cekura scores in `voice-game-framework/docs/README.md`.
- If a decision in §3 changes, update §3 *and* note why — future agents rely on it.
