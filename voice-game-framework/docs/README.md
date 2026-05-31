# docs/ — Decisions, latency log, Cekura scorecards

Living record of *why* things are the way they are and *how well* they work. Future agents/humans read this before changing architecture.

## Deployment facts (Pipecat Cloud)
- **Agent name:** `rico-bot`
- **Org:** `extreme-crab-blush-918` (Soham), region us-west
- **Secret set:** `rico-bot-secrets`
- **Service host (for Cekura/TwiML):** `rico-bot.extreme-crab-blush-918`
- Deployed 2026-05-30, cloud build (~85s). Redeploy after prompt changes with
  `pc cloud deploy` from `../deploy-rico/`.

## Decision log
- **2026‑05‑28 — Split audio (Pipecat WebRTC media) from game state/actions (data channel).** The original custom base64‑over‑JSON WS bypassed Pipecat (required), couldn't be tested by Cekura (the theme), and its overhead fought the latency theme. See `../../PLAN.md` §3.
- **NPC actions = LLM tools** (mirrors the starter's `place_order`), not a separate inference call.
- **Reasoning OFF for the realtime NPC** — latency + the live Nemotron endpoint may not strip chain‑of‑thought from spoken output.

## Latency log (fill in during the event)
| Date | STT | LLM TTFB | TTS | End‑to‑end | Notes |
|---|---|---|---|---|---|
| 2026‑05‑30 | NVIDIA Nemotron | — (subjectively slower than GPT‑4.1, acceptable) | Gradium | — | Phase 0 smoke test, flower bot. GPT‑4.1 noticeably snappier; Nemotron fine. Quantify in Cekura. |

## Cekura scorecards (fill in during Phase 4)
| Run | Evaluator | Score | Change made | Re‑run score |
|---|---|---|---|---|
| baseline | | | — | |
