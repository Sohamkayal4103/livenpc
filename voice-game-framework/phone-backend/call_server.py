#
# Phone-call backend for the in-game phone feature.
#
# The browser can't safely hold the Twilio auth token, so this tiny FastAPI
# service places the call. The game POSTs { "to": "+1..." }; we ask Twilio to
# dial that number and, when the person answers, bridge their audio to the
# deployed Rico agent on Pipecat Cloud (over Twilio media streams).
#
# So: game button -> this service -> Twilio -> real phone rings -> they talk
# to the AI (Rico).
#
# Run (uses the starter kit's venv, which already has fastapi/uvicorn/aiohttp):
#   cd voice-game-framework/phone-backend
#   ../../yc-voice-agents-hackathon/server/.venv/bin/python call_server.py
# Serves on http://localhost:8090
#
# Env (read from ../deploy-rico/.env by default):
#   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  — your Twilio creds
#   TWILIO_PHONE_NUMBER                    — the voice number you bought (+1...)
#   PIPECAT_SERVICE_HOST                   — defaults to rico-bot.<org>
#

import os

import aiohttp
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Reuse the deployed agent's secrets file (Twilio creds live there already).
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "deploy-rico", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
FROM_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")  # the number you bought
SERVICE_HOST = os.environ.get("PIPECAT_SERVICE_HOST", "rico-bot.extreme-crab-blush-918")

# TwiML run when the callee answers: bridge their call audio to the Pipecat
# Cloud agent over Twilio media streams (same endpoint the README uses for
# inbound, just triggered for an outbound call here).
TWIML = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    "<Response><Connect>"
    '<Stream url="wss://api.pipecat.daily.co/ws/twilio">'
    f'<Parameter name="_pipecatCloudServiceHost" value="{SERVICE_HOST}"/>'
    "</Stream>"
    "</Connect></Response>"
)

app = FastAPI(title="Game Phone Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CallRequest(BaseModel):
    to: str  # E.164, e.g. +18313468532
    name: str | None = None


@app.get("/")
async def health():
    return {
        "ok": True,
        "configured": bool(ACCOUNT_SID and AUTH_TOKEN and FROM_NUMBER),
        "from_number": FROM_NUMBER or None,
        "service_host": SERVICE_HOST,
    }


@app.post("/call")
async def place_call(req: CallRequest):
    if not (ACCOUNT_SID and AUTH_TOKEN and FROM_NUMBER):
        return {
            "ok": False,
            "error": "Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER.",
        }

    url = f"https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Calls.json"
    data = {"To": req.to, "From": FROM_NUMBER, "Twiml": TWIML}
    auth = aiohttp.BasicAuth(ACCOUNT_SID, AUTH_TOKEN)

    async with aiohttp.ClientSession() as session:
        async with session.post(url, data=data, auth=auth) as resp:
            body = await resp.json()
            if resp.status >= 400:
                return {"ok": False, "status": resp.status, "error": body}
            return {"ok": True, "call_sid": body.get("sid"), "to": req.to, "name": req.name}


if __name__ == "__main__":
    print(f"Phone backend — from={FROM_NUMBER or 'UNSET'} -> agent {SERVICE_HOST}")
    uvicorn.run(app, host="0.0.0.0", port=8090)
