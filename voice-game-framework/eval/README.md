# eval/ — Cekura evaluation & auto‑improvement

**This is what wins the hackathon.** Cekura simulates players against the deployed Pipecat agent, scores transcripts on game‑specific evaluators, and we feed failures back into the persona/thresholds and show the score improve.

## Prerequisites
- Agent deployed to Pipecat Cloud (`pc cloud deploy`) so Cekura can reach it over WebRTC.
- Cekura plugin installed in Claude Code:
  ```
  /plugin marketplace add cekura-ai/cekura-skills
  /plugin install cekura@cekura-skills
  /setup-mcp
  ```

## Game‑specific evaluators (define with /create-metric or /autogen-eval)
| Evaluator | Passes when… |
|---|---|
| In‑character | Rico never breaks character / never sounds like an AI assistant. |
| Justified escalation | Tension rises only when the player is actually threatening. |
| Weapon discipline | `draw_weapon` fires only on real provocation, never unprovoked. |
| De‑escalation | Complies/holsters when the player backs down. |
| Latency | TTFB (time‑to‑first‑spoken‑word) under budget. |
| No leakage | No chain‑of‑thought / tool JSON in spoken output. |

## Loop (PLAN.md Phase 4)
1. `/autogen-eval` → generate player scenarios.
2. `/run-evals` → `/cekura-report` → **screenshot the baseline** into `../docs/`.
3. `cekura-self-improving-agent` / `/improve-metric` → apply fixes to `agent/personas/` + tool thresholds.
4. Re‑run. Record the before→after delta. **That delta is the demo.**

## Files
| Path | Status |
|---|---|
| `scenarios/evaluators.md` | ✅ 8 evaluators defined (in-character, weapon discipline, de-escalation, no-leak, latency, …) |
| `scenarios/player-scenarios.md` | ✅ 8 simulated-player scenarios + coverage matrix |
| `RUNBOOK.md` | ✅ press-play sequence: deploy → define → baseline → auto-improve |

**Prepped locally (2026-05-30).** Ready to execute once Pipecat Cloud + Cekura
accounts are logged in. Start at `RUNBOOK.md`.
