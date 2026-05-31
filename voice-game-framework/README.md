# Voice Game Agent Framework

Real‑time voice agents for games. A player **talks** to NPCs in a 3D scene; an NPC **talks back** and the scene reacts (NPC actions, tension, subtitles) — all on the hackathon sponsor stack (Pipecat + NVIDIA Nemotron + Gradium + Cekura).

> **Read [`../PLAN.md`](../PLAN.md) first.** It is the single source of truth for goals, architecture, and the build order. This README is just the map of the folder.

## Architecture in one line
Audio (mic ↔ NPC voice) rides a **Pipecat WebRTC media track**; game state IN and NPC actions OUT ride a **data channel**. See `PLAN.md` §3.

## Folder map
| Folder | What lives here |
|---|---|
| `agent/` | The Pipecat NPC backend (Python). The spine. Start here. |
| `client/` | Game‑side Pipecat integration (TS) that rewires `scene-negotiation/`. |
| `shared/` | Canonical protocol (TS + Python) — the one schema both sides import. |
| `eval/` | Cekura evaluators + game scenarios. The auto‑improve loop. |
| `docs/` | Decisions, latency log, Cekura scorecards. |

## Quick start
1. Smoke‑test the starter (`PLAN.md` Phase 0).
2. Define the schema (`shared/`, Phase 1).
3. Build the agent (`agent/`, Phase 2) — this is the core.
4. Rewire the game client (`client/`, Phase 3).
5. Evaluate + auto‑improve with Cekura (`eval/`, Phase 4) — this is what wins.

## Design rules
- **One schema, two languages.** Never edit a field name in only one of `shared/schema.ts` / `shared/schema.py`.
- **Personas are data.** A new NPC is a new file in `agent/personas/` + a scene‑config row. The pipeline never changes.
- **Reasoning OFF for the realtime NPC.** Protects latency; avoids spoken chain‑of‑thought.
