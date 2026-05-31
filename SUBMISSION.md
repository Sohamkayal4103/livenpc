# Submission form — copy/paste answers

Fill the Google Form with these. The README.md in the repo already contains the
long-form versions of 1–6.

---

**Email:** skayal1@ucsc.edu

**Person or Team Name:** Soham Kayal — *LiveNPC* (solo)
*(rename if you like — this is what they yell from the stage)*

**GitHub Link:** https://github.com/<your-username>/livenpc  *(PLACEHOLDER — create the public repo and paste the real link; make sure `.env` files are gitignored — they are by the included `.gitignore`)*

---

## 1. What is this?

**LiveNPC — an engine-agnostic voice-agent framework for game NPCs.** Talk to a
game character with your voice; it reasons over the live scene, talks back, takes
**in-world actions** (via LLM tool calls), and can even place **real phone calls**
to real people — all continuously evaluated and auto-improved with Cekura.

Any game — Three.js/web, Unity, Unreal, Godot — streams player audio + scene
state to a Pipecat agent and gets back NPC voice, subtitles, and structured
actions over a small documented protocol. The included demo is a GTA-style street
negotiation with an NPC named Rico, but the agent is not specific to that scene.

Stack: **Pipecat** (orchestration) · **NVIDIA Nemotron** STT+LLM (open weights) ·
**Gradium** TTS · **Cekura** (eval + self-improvement) · **Twilio** (real calls) ·
deployed on **Pipecat Cloud**.

## 2. Video (< 60s)

https://youtu.be/_XHvCFvFKlg

## 3. How we used Cekura, Nemotron, and Pipecat

**Pipecat:** the NPC is a Pipecat pipeline (STT → LLM → TTS). NPC actions are
direct-function **tools**; live game state arrives via **RTVI** and is injected
into the LLM context each turn; actions stream back as RTVI messages. One
`create_transport` build serves WebRTC (game) + Daily (Cekura) + Twilio (phone),
deployed to Pipecat Cloud as `rico-bot`.

**Nemotron:** Nemotron-3-Super-120B is the NPC's brain (dialogue + tool decisions)
and Nemotron Speech Streaming is the STT, on the AWS endpoints. Reasoning off for
voice latency. Its tool-calling is reliable — it draws a weapon only on real
threats and de-escalates in character.

**Cekura — what we tested & how much we improved:** we built **8 game-specific
evaluators** (in-character, no-reasoning-leakage, weapon discipline, justified
escalation, de-escalation, brevity, on-world, latency) and **8 simulated-player
scenarios**, and ran them against the deployed agent. Goal: prove the NPC stays
in character and escalates *only* when genuinely provoked. **Baseline:
in-character 6/6, weapon-discipline 3/3, no-leakage & de-escalation passing; 2
failures — brevity (too wordy with a calm buyer) and escalation (too passive vs.
a verbal aggressor).** Cekura pinpointed exactly those two; our self-improve loop
edits the persona/tooling and redeploys to fix them. The loop already produced
one real fix during the hack: an eval caught Nemotron's turn-classifier
*reasoning leaking into speech*, which we traced and removed.
*(If you re-run after the fix, update with the improved numbers here.)*

## 4. What we did new during the hackathon

**New:** the entire agent framework (Rico persona, NPC-action tools,
game-state→LLM context injection, the shared TS/Python protocol); the RTVI game
integration that rewired the game's audio onto Pipecat; the Cekura setup (8
evaluators + 8 scenarios + baseline + self-improve loop); Twilio outbound calling
from inside the game (phone UI + call backend + multi-transport agent); and the
Pipecat Cloud deployment bundle.

**Borrowed/pre-existing:** the 3D scene art & controls (`scene-negotiation/`
existed before — we kept the visuals, replaced the placeholder networking); and
the Pipecat starter kit (we reused its NVIDIA STT + Nemotron LLM service classes).

## 5. Feedback on the tools

**Nemotron (NVIDIA):** Tool-calling is strong and well-judged; stays in character
and resists jailbreaks. Two issues: (a) with an LLM-based turn-completion strategy
its **reasoning leaked into the spoken output** (no reasoning-parser on the
endpoint) — easy trap, worth a louder warning / default reasoning parser for
voice; (b) higher first-token latency than GPT-4.1 (we kept reasoning off).

**Cekura:** Zero-to-scored-baseline via the Claude Code plugin was fast and
useful. Friction/bugs: the plugin **MCP needed manual API-key auth + a session
restart**, and tools only worked in the session where the plugin was installed;
`scenarios_run_pipecat_v2` returned a 400 until `pipecat_agent_name` was set on
the agent config (clearer error / auto-fill would help). Biggest gap for
self-improvement: **no easy path to ingest real/production call transcripts** (only
Cekura-initiated sims) — that would truly close the loop.

**Pipecat / Twilio:** `create_transport` cleanly served WebRTC + Daily + Twilio
from one image; cloud build/deploy was smooth (~80s). Gotcha: the JS client
**doesn't auto-play the bot audio track** — you must attach it to an `<audio>`
element yourself (caused a confusing "subtitles work but no audio" debug). Worth
documenting prominently.

## 6. Live link (optional)

Deployed agent: Pipecat Cloud `rico-bot` (org `extreme-crab-blush-918`). Game
client + phone backend run locally per the README.

---

## 60-SECOND DEMO SHOT LIST (for the video)

Keep it to the *experience*, not narration. Target ~55s.

- **0:00–0:08** — Game world, walk up to Rico (the dealer). On-screen text:
  "You talk to this NPC with your voice."
- **0:08–0:22** — Speak: *"I'm here for the package."* Rico replies in voice
  (subtitle shows). Then threaten him — he **draws his weapon**, tension HUD
  spikes. (This shows voice + scene-aware tool actions.)
- **0:22–0:33** — Quick cut to the **Cekura dashboard**: the baseline scorecard
  (8 scenarios, metrics), highlight in-character/weapon-discipline passing + the
  2 flagged failures. Caption: "Every NPC behavior is evaluated & auto-improved."
- **0:33–0:50** — Back in game: open the **📱 phone**, tap **Call Utkarsh** — cut
  to a **real phone ringing**, answered, and the AI (Rico) talking on the line.
  Caption: "NPCs can call real phones (Twilio)."
- **0:50–0:58** — End card: "LiveNPC — voice NPCs for any game engine. Pipecat ·
  Nemotron · Cekura · Twilio." 

Record at 1080p, no long intro, jump straight into the world.
