# In-Game Phone — real Twilio calls from the game

**What it does:** in the 3D game there's a 📱 button. Open it, pick a contact
(or add one), hit **Call**, and Twilio dials that real phone. When the person
answers, their call is bridged to the **AI agent (Rico)** running on Pipecat
Cloud — so a real human talks to the Nemotron-powered NPC, live, on their phone.

This adds the last sponsor pillar (**Twilio telephony**) to the stack:
Pipecat + Nemotron + Gradium + Cekura + **Twilio**.

---

## Architecture

```
[Game 📱 button]                                   [Real phone rings]
  click "Call Utkarsh"                                     ▲
        │ POST /call {to:"+1831..."}                       │ Twilio dials it
        ▼                                                   │
[phone-backend/call_server.py]  ──Twilio REST createCall──▶ [Twilio]
  (holds Twilio auth token)        To=+1831…, From=your#         │
                                   Twiml=<Connect><Stream>       │ on answer,
                                                                 ▼ bridge audio
                                        wss://api.pipecat.daily.co/ws/twilio
                                        _pipecatCloudServiceHost = rico-bot.<org>
                                                                 ▼
                                            [rico-bot on Pipecat Cloud]
                                            NVIDIA STT → Nemotron → Gradium
```

Why a backend: the browser must not hold the Twilio auth token, so a tiny local
service (`call_server.py`) places the call.

---

## Files (all created)
| File | Role |
|---|---|
| `voice-game-framework/phone-backend/call_server.py` | FastAPI service: `POST /call {to}` → Twilio outbound call bridged to `rico-bot`. |
| `scene-negotiation/src/components/PhonePanel.tsx` | The 📱 UI: contacts, add-contact, Call button. Seeded with Soham + Utkarsh. |
| `scene-negotiation/src/App.tsx` | Renders `<PhonePanel/>`. |
| `voice-game-framework/deploy-rico/bot.py` | Added a `"twilio"` transport so the deployed agent accepts phone calls. |

---

## Setup (do these in order)

### 1. Buy a Twilio voice number  *(human, ~3 min)*
- [Twilio Console](https://console.twilio.com/) → **Phone Numbers → Buy a number**
  → filter by **Voice** capability → Buy. (Uses your hackathon credits.)
- Copy it in E.164 form, e.g. `+18055551234`.

### 2. Add the number to the agent's secrets
Edit `voice-game-framework/deploy-rico/.env` and add:
```
TWILIO_PHONE_NUMBER=+18055551234
```
(`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are already there.)

### 3. Redeploy the agent with Twilio support  *(the bot now has a "twilio" transport)*
```bash
cd voice-game-framework/deploy-rico
export PATH="$HOME/.local/bin:$PATH"
pc cloud deploy
```
(No need to re-upload secrets unless you want the cloud agent to also know the
number — the call backend is what uses `TWILIO_PHONE_NUMBER`, so this redeploy is
only to add the `twilio` transport.)

### 4. Start the phone backend
```bash
cd voice-game-framework/phone-backend
../../yc-voice-agents-hackathon/server/.venv/bin/python call_server.py
# Serves http://localhost:8090 ; GET / shows whether Twilio is configured.
```

### 5. The game already has the 📱 button
`npm run dev` in `scene-negotiation` (already running). Reload the page; the
green 📱 is bottom-right.

---

## Test
1. Backend health: open `http://localhost:8090/` → should show
   `"configured": true` and your `from_number`.
2. In the game, click 📱 → **Call** next to a contact.
3. That phone rings; answer it → you're talking to Rico (the AI).
4. Backend/Twilio logs show the call SID; `pc cloud logs rico-bot` shows the
   agent handling the Twilio session.

---

## Important caveats
- **Trial vs upgraded Twilio:** an upgraded account (you applied the promo) can
  call any number. A *trial* account can only call **verified** numbers — if
  calls fail with a "not verified" error, verify Soham/Utkarsh's numbers in
  Twilio Console → **Verified Caller IDs**, or confirm the account is upgraded.
- **Number format:** must be E.164 (`+1` + 10 digits). The UI auto-prepends `+1`
  if you omit it.
- **Persona:** the callee talks to Rico (street dealer). To use a friendlier
  "phone persona", point the TwiML at a different deployed agent, or branch the
  persona on transport type in `bot.py`.
- **Backend not reachable:** the panel will say so — make sure `call_server.py`
  is running on `:8090` (override with `VITE_PHONE_BACKEND_URL`).

---

## How an AI agent should extend/debug this
- The call mechanism is one Twilio REST POST in `call_server.py::place_call`
  (`To`/`From`/`Twiml`). The TwiML connects to Pipecat Cloud's Twilio WSS with
  `_pipecatCloudServiceHost = <agent>.<org>` (see `SERVICE_HOST`).
- To make the **agent call out automatically** (e.g. from inside the game when
  tension peaks), call the same `/call` endpoint from the agent/game instead of
  the button.
- To change which agent answers, set `PIPECAT_SERVICE_HOST` for the backend.
