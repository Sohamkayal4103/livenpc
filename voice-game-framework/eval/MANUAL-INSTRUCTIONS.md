# Manual Instructions — Cekura + Rico Eval

Everything is set up. This file tells you how to check results, modify evals,
re-deploy, and manage things manually via the Cekura dashboard and terminal.

---

## 1. Cekura Dashboard (Web)

Open: **https://dashboard.cekura.ai**

### Check Eval Results
- Go to **Projects** > **Soham Rajesh Kayal Project**
- Click **Results** in the left sidebar
- Look for **"Baseline Run v3"** (result ID: 591423)
- Each run shows: transcript, metrics scores, pass/fail, audio recording
- Click into any run to see the full conversation + per-metric breakdown

### View / Edit Metrics
- Left sidebar > **Metrics**
- Your 7 custom Rico metrics are listed (In-Character, No Leakage, Weapon
  Discipline, Justified Escalation, De-escalation, Brevity, On-World)
- Click any metric to edit its description (the LLM judge prompt)
- Hit **Save** after changes

### View / Edit Scenarios (Evaluators)
- Left sidebar > **Evaluators**
- Your 8 scenarios are listed (S1–S8)
- Click any to edit: instructions, personality, expected outcome, attached metrics
- You can also create new scenarios here with the **+ Create** button

### Run Evals from Dashboard
- Go to **Evaluators**, select the scenarios you want
- Click **Run** > choose **Pipecat** as the run type
- Set frequency (1 = one run per scenario)
- Hit **Start**

### View Agent Config
- Left sidebar > **Agents** > **rico-bot**
- Here you can edit: description, system prompt, pipecat_data, provider settings

---

## 2. Terminal Commands

### Check if rico-bot is deployed and running
```bash
pc cloud agent list
pc cloud agent logs rico-bot
```

### Re-deploy after code changes
```bash
cd ~/Desktop/voice_agent_hack/sample_game/voice-game-framework/deploy-rico
pc cloud deploy
```

### Update secrets (if you change .env)
```bash
cd ~/Desktop/voice_agent_hack/sample_game/voice-game-framework/deploy-rico
pc cloud secrets set rico-bot-secrets --file .env
```

### Check Pipecat Cloud org info
```bash
pc cloud organizations list
pc cloud --show-cli-config
```

### Check action logs (weapon discipline cross-check)
```bash
pc cloud agent logs rico-bot | grep "\[npc_action\]"
```

---

## 3. Key IDs Reference

| Item | ID |
|------|----|
| Cekura Project | 5874 |
| Cekura Agent (rico-bot) | 18060 |
| Pipecat Cloud Org | extreme-crab-blush-918 |
| Pipecat Public Key | <PIPECAT_PUBLIC_KEY> |
| Pipecat Private Key | <PIPECAT_PRIVATE_KEY> |
| Baseline Result Set | 591423 |

### Metric IDs
| # | Metric | ID |
|---|--------|----|
| 1 | In-Character (Rico) | 147884 |
| 2 | No Reasoning/Metadata Leakage | 147885 |
| 3 | Weapon Discipline | 147886 |
| 4 | Justified Escalation | 147887 |
| 5 | De-escalation on Compliance | 147888 |
| 6 | Conversational Brevity | 147889 |
| 7 | Stays On-World / Refuses Derailment | 147890 |
| 8 | Latency (predefined) | 147240 |

### Scenario IDs
| Scenario | ID |
|----------|----|
| S1 — Calm Buyer | 272963 |
| S2 — Time-waster | 272964 |
| S3 — Verbal Aggressor | 272965 |
| S4 — Real Threat then Backs Down | 272966 |
| S5 — Undercover | 272967 |
| S6 — Jailbreak | 272968 |
| S7 — Silence | 272969 |
| S8 — Rapid-fire | 272970 |

---

## 4. Troubleshooting the PCC-1002 Error

The baseline runs may still be failing with:
```
PCC-1002 - Attempt to start agent without public api key
```

**What was done so far:**
- Created Pipecat private key: `<PIPECAT_PRIVATE_KEY>`
- Set `pipecat_api_key` on both agent and project to the public key `<PIPECAT_PUBLIC_KEY>`
- Set `pipecat_data.public_key`, `pipecat_data.api_key`, `pipecat_data.pipecat_agent_name`

**If it still fails, try on the dashboard:**
1. Go to **Agents** > **rico-bot** > edit Pipecat credentials
2. Make sure both "Pipecat API Key" and "Public Key" fields are filled:
   - API Key: `<PIPECAT_PRIVATE_KEY>`
   - Public Key: `<PIPECAT_PUBLIC_KEY>`
   - Agent Name: `rico-bot`
3. Or go to **Project Settings** > **Integrations** > **Pipecat** and enter both keys there
4. Re-run from the Evaluators page

**Alternative — ask Cekura support:**
The Cekura team (Sidhant, Tarush, Dhruv, Greg, Janhvi) are admins on your org.
Reach out on the hackathon Slack or email for help with the Pipecat integration.

---

## 5. After Baseline — Improve Loop

Once baseline results are in:

1. **Screenshot the scorecard** from the dashboard Results page
2. **Identify failing metrics** — look at which evaluators scored FALSE
3. **Edit the agent prompt** in `deploy-rico/personas/rico_dealer.py`:
   - Weapon discipline failing? Strengthen the "only draw when genuinely provoked" rules
   - Leakage? Add "never speak your reasoning aloud" to the prompt
   - Brevity? Add "maximum two sentences per reply"
4. **Re-deploy**: `pc cloud deploy` from `deploy-rico/`
5. **Re-run evals** from the dashboard
6. **Compare before vs after** in the Results page
7. Record the delta in `docs/README.md`

---

## 6. Cekura API (curl examples)

### Check result status
```bash
curl -s -H "x-api-key: $CEKURA_API_KEY" \
  "https://api.cekura.ai/test_framework/v1/results/591423/" | python3 -m json.tool
```

### List all results for rico-bot
```bash
curl -s -H "x-api-key: $CEKURA_API_KEY" \
  "https://api.cekura.ai/test_framework/v1/results/?agent_id=18060" | python3 -m json.tool
```

### Trigger a new Pipecat run (all 8 scenarios)
```bash
curl -s -X POST -H "x-api-key: $CEKURA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "scenarios": [
      {"scenario": 272963}, {"scenario": 272964}, {"scenario": 272965},
      {"scenario": 272966}, {"scenario": 272967}, {"scenario": 272968},
      {"scenario": 272969}, {"scenario": 272970}
    ],
    "frequency": 1,
    "name": "Manual Run"
  }' \
  "https://api.cekura.ai/test_framework/v1/scenarios/run_pipecat_v2/" | python3 -m json.tool
```
