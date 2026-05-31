# Phase 4 Runbook — Cekura eval + auto-improve

Step-by-step to execute once your Pipecat Cloud + Cekura accounts are ready.
Everything here is prepped; this is the "press play" sequence.

## Prereqs
- Pipecat Cloud account, CLI installed + logged in:
  ```bash
  uv tool install pipecat-ai-cli
  pc cloud auth login
  ```
- Cekura account at dashboard.cekura.ai (hackathon credits auto-applied).

## Step 1 — Deploy Rico to Pipecat Cloud
**The deployable bundle is already built + validated: `../deploy-rico/`.**
It contains `bot.py` (cloud entry, supports Daily **and** webrtc via
`create_transport`), the agent modules, vendored `shared/schema.py`, a
`pyproject.toml` with the `daily` extra, a regenerated `uv.lock`, `Dockerfile`,
`pcc-deploy.toml` (agent_name `rico-bot`), and a staged `.env`.

Deploy (from `voice-game-framework/deploy-rico/`):
```bash
export PATH="$HOME/.local/bin:$PATH"   # pc CLI
pc cloud auth login                    # one-time, opens browser
pc cloud organizations list            # note your ORG name (Cekura needs it)
pc cloud secrets set rico-bot-secrets --file .env
pc cloud deploy
```
After deploy, note the **agent name** (`rico-bot`) + **org** — Cekura needs both.
Sanity check it's live: `pc cloud agents list` (and `pc cloud logs rico-bot`).

## Step 2 — Install Cekura + define evaluators
```
/plugin marketplace add cekura-ai/cekura-skills
/plugin install cekura@cekura-skills
/setup-mcp
```
- Connect the agent: **select `Pipecat` as the provider**; give it the Pipecat
  Cloud API key + agent name from Step 1.
- Create the 8 evaluators from `scenarios/evaluators.md` via `/create-metric`
  (or let `/autogen-eval` draft them, then refine to match).
- Seed the 8 player scenarios from `scenarios/player-scenarios.md`.

## Step 3 — Baseline run
```
/run-evals
/cekura-report
```
- **Screenshot the scorecard** and paste the numbers into `../docs/README.md`
  (Cekura scorecards table). This is the "before".

## Step 4 — Auto-improve
```
(skill) cekura-self-improving-agent   # or /improve-metric per failing metric
```
- Apply suggested fixes to `agent/personas/rico_dealer.py` (and tool-trigger
  wording in `agent/game_tools.py` if weapon discipline fails).
- Redeploy (`pc cloud deploy`), `/run-evals` again.
- Record the **after** numbers. The before→after delta on evaluators 1–5 is the
  demo headline.

## Action check (our own harness, complements Cekura)
Cekura scores speech; weapon-discipline correctness is also visible in our logs:
```bash
grep "\[npc_action\]" /tmp/bot-npc.log    # local
# or pull deployed logs: pc cloud logs <agent>
```
Cross-reference: for calm scenarios (S1, S2) there should be ZERO `draw_weapon`;
for S4 there should be a `draw_weapon` then a `holster_weapon`/`relax`.

## What to capture for the demo
1. Baseline scorecard screenshot.
2. The prompt/threshold diff you applied.
3. Improved scorecard screenshot.
4. One transcript example of a fixed failure (before vs after).
