# agent/ — Pipecat NPC backend

The spine of the framework. A Pipecat pipeline that hears the player, responds in character as an NPC, and emits NPC actions as LLM tool calls. Adapted from the starter kit's `bot-nemotron.py`.

## Pipeline
```
transport.input() → NVIDIA STT → user_aggregator → Nemotron LLM → Gradium TTS → transport.output() → assistant_aggregator
```

## Files (build in this order — see PLAN.md Phase 2)
| File | Responsibility | Status |
|---|---|---|
| `services/nvidia_stt.py` | NVIDIA Nemotron streaming STT. **Copy verbatim** from `../../yc-voice-agents-hackathon/server/`. | ☐ to copy |
| `services/nemotron_llm.py` | vLLM OpenAI‑compatible LLM w/ correct TTFB. **Copy verbatim.** | ☐ to copy |
| `personas/rico_dealer.py` | Rico's system prompt + tool list. Persona = data. | ☐ to write |
| `game_context.py` | Game‑state message → compact LLM context string. | ☐ to write |
| `game_tools.py` | NPC actions as direct functions (`draw_weapon`, `step_forward`, `flee`, `relax`, `holster_weapon`). Each emits an app message + returns a tool result. Maps 1:1 to `shared` `NPCAction`. | ☐ to write |
| `bot_npc.py` | Assembles the pipeline; swaps persona; registers tools; refreshes context on data‑channel game‑state messages. From `bot-nemotron.py`. | ☐ to write |
| `director.py` | (Stretch) off‑path low‑effort‑reasoning tension director. | ☐ stretch |

## Rules
- `enable_thinking=False` on the realtime LLM (latency + no spoken chain‑of‑thought).
- NPC actions are **tools**, exactly like the flower bot's `place_order`. Tool handler → app message to client.
- Game state is injected as a per‑turn context note, like the flower bot's `caller_context`.
- Keep transport branches (`SmallWebRTC` local, `Twilio` phone) from the starter — they're free.

## Run (once built)
```bash
uv run bot_npc.py   # open http://localhost:7860
```
Env: `NVIDIA_ASR_URL`, `NEMOTRON_LLM_URL`, `GRADIUM_API_KEY` (+ `TWILIO_*` for phone).
