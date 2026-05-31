# Phone Enhancements — implementation specs (NOT yet built)

Two follow-up features for the in-game phone (see `PHONE-FEATURE.md` for the
base feature). Written so a human or an AI agent can implement them cold. Each
has: goal, approach, exact files, step-by-step, gotchas, and how to verify.

---

# Feature A — Feed real phone conversations into Cekura

## Goal
Every real call placed from the game (game 📱 → Twilio → caller talks to Rico)
gets its transcript scored by Cekura against the existing metrics, so
**production conversations** — not just Cekura's simulated ones — drive the
auto-improve loop. This realizes the hackathon's "evaluation data flows back
into the agent" theme end-to-end.

## Current state (why it doesn't happen automatically)
- Cekura's normal flow: **Cekura initiates** simulated calls (it's the caller).
- Our game calls are **outbound to real people**; Cekura isn't in that path.
- So real-call transcripts are never seen by Cekura unless we send them.

## Two ingestion options (pick one; B is simplest to start)

### Option A1 — Transcript ingestion (recommended)
The deployed Pipecat agent already produces a transcript. Capture it and POST it
to Cekura for scoring.

**Files to touch**
- `voice-game-framework/deploy-rico/bot.py` — add a transcript collector +
  on-disconnect upload.
- (new) a small `cekura_ingest.py` helper, or inline in `bot.py`.

**Steps**
1. **Collect the transcript.** Pipecat emits transcription frames. Add a
   `TranscriptProcessor` (pipecat) to the pipeline, OR accumulate from the RTVI
   bot/user transcript events. Keep a list of `{role, text, ts}` per session.
   - Pipecat has `pipecat.processors.transcript_processor.TranscriptProcessor`
     with `on_transcript_update` — wire it and append turns.
2. **On call end** (`on_client_disconnected`), assemble the full transcript.
3. **Send to Cekura.** POST the transcript to Cekura's evaluate/observability
   endpoint for agent `18060`, against the existing metric IDs
   (147884–147890). The exact endpoint/payload is best confirmed via the Cekura
   MCP/skills — use the `/evaluate-calls` skill (it "analyzes individual call
   recordings/transcripts"). Likely shape:
   ```
   POST https://api.cekura.ai/test_framework/v1/observability/  (confirm)
   { "agent": 18060, "transcript": [...], "metrics": [147884, ...],
     "metadata": {"source": "game_phone", "to": "+1831..."} }
   ```
   Auth: `Authorization: Bearer $CEKURA_API_KEY`.
4. **Result** shows in the same Cekura dashboard run history; the
   `cekura-self-improving-agent` step can now read real-world failures.

**Gotchas**
- Confirm the exact Cekura ingestion endpoint with the Cekura tools (the
  terminal Claude Code that has the plugin) before coding — don't guess the URL.
- Don't block call teardown on the upload; fire-and-forget or background task.
- Strip any tool/JSON noise so only spoken turns are scored.

### Option A2 — Recording ingestion
Twilio can record the call; Cekura's `/evaluate-calls` can score the recording.

**Steps**
1. In `phone-backend/call_server.py`, add `"Record": "true"` (and a
   `RecordingStatusCallback` URL) to the Twilio `createCall` form data.
2. Twilio posts a `RecordingUrl` when the call ends → store it.
3. Submit that recording URL to Cekura `/evaluate-calls`.

**Trade-off:** simplest to capture, but recording + transcription adds latency
and you depend on Twilio storage. Transcript ingestion (A1) is tighter.

## How to verify
- Place a game call, hang up, then check the Cekura dashboard run history for a
  new entry tagged `source=game_phone` with per-metric scores.

## Why this is the winning version
It closes the loop on *real* usage: game call → transcript → Cekura score →
prompt fix → redeploy. That's a true auto-improvement harness, not just offline
evals.

---

# Feature B — Character holds the phone to their ear during a call

## Goal
When a call is placed from the 📱 panel, the on-screen character pulls out a
phone, raises it to their ear (human-like), and holds it there until the call
ends, then lowers it.

## Approach
The characters are rigged GLB models rendered with React Three Fiber
(`scene-negotiation/src/components/characters/`). We (1) attach a phone 3D
model to the character's hand bone, (2) raise the arm while a call is active,
and (3) drive show/hide from a global "call active" flag.

## Pieces

### B1 — A global "active call" flag
**Files**: `scene-negotiation/src/systems/GameStateManager.ts` (store),
`scene-negotiation/src/components/PhonePanel.tsx`.
- Add store state: `activeCall: { name: string; number: string } | null` plus
  `setActiveCall(call)` / `clearActiveCall()`.
- In `PhonePanel.call()`, on success → `setActiveCall({name, number})`.
- Clear it on hang-up (see B4).

### B2 — The phone prop + hand-bone attachment
**Files**: `scene-negotiation/src/components/characters/RiggedCharacterModel.tsx`
(or a new `PhoneProp.tsx`), `public/models/props/` for a phone GLB.
- Asset: drop a small phone GLB in `public/models/props/phone.glb` (or build a
  primitive: a thin `boxGeometry` ~0.07 × 0.14 × 0.01 with a dark material — good
  enough for a demo).
- Find the hand bone: the model is skinned, so after the SkeletonUtils clone,
  traverse and log bone names once:
  ```ts
  clone.traverse(o => { if ((o as THREE.Bone).isBone) console.log(o.name); });
  ```
  Find the right-hand bone (commonly `mixamorigRightHand` or similar — the
  Soldier model's names must be confirmed from that log).
- Attach: render the phone as a child of that bone so it inherits the hand's
  world transform every frame:
  ```tsx
  {handBone && <primitive object={handBone}>
     <mesh visible={callActive} position={[...]} rotation={[...]}>
        <boxGeometry args={[0.07,0.14,0.01]} /> <meshStandardMaterial color="#111" />
     </mesh>
  </primitive>}
  ```
  Tune `position`/`rotation` so it sits in the palm.

### B3 — Raise the arm to the ear while calling
Two ways, in order of effort:
- **Procedural (no new assets):** when `callActive`, lerp the right
  upper-arm + forearm bone rotations so the hand comes up beside the head; lerp
  back when the call ends. Do it in a `useFrame` on the cloned skeleton bones.
  Needs a little trial-and-error on the Euler angles per bone.
- **Animation clip:** if you add a "talking on phone" GLB animation, play it via
  drei `useAnimations` while `callActive` and crossfade back to idle after.
- **Cheap fallback that still reads well:** skip the arm raise; just attach the
  phone near the ear (child of the head bone) while calling. Less realistic but
  one line and zero rigging.

### B4 — Knowing when the call ends (so the phone lowers)
The base feature only *starts* calls; it doesn't track the end. Options:
- **Real (best):** add a Twilio `statusCallback` to `createCall` in
  `call_server.py` pointing to a new `/call-status` endpoint that records call
  lifecycle (`initiated→ringing→in-progress→completed`). The game polls
  `GET /call-status/{sid}` (or the backend pushes via WebSocket); on
  `completed`, `clearActiveCall()`.
  - Requires the backend to be reachable by Twilio (public URL, e.g. ngrok) for
    the callback — note this is the same public-endpoint requirement as inbound.
- **Simple (demo-grade):** a **Hang Up** button in the panel that calls
  `clearActiveCall()` (and optionally Twilio's "complete call" REST to actually
  end it), plus an auto-clear timer (e.g. 90s) as a safety net.

## Which character holds it?
The **player** places the call, so the player character is the natural choice
(`Player.tsx` → `GameCharacter kind="player"`). Pass `callActive` down to the
rigged model. (If you'd rather an NPC "takes the call", pass it to that NPC's
`GameCharacter` instead.)

## Files summary
| File | Change |
|---|---|
| `systems/GameStateManager.ts` | add `activeCall` + setters |
| `components/PhonePanel.tsx` | set/clear `activeCall`; add Hang Up button |
| `components/characters/RiggedCharacterModel.tsx` | hand-bone lookup + phone prop + (optional) arm-raise in `useFrame` |
| `components/Player.tsx` (and/or NPC) | pass `callActive` to its `GameCharacter` |
| `public/models/props/phone.glb` | optional phone asset (or use a primitive) |
| `phone-backend/call_server.py` | (for real end-detection) add `statusCallback` + `/call-status` |

## How to verify
- Place a call → the character raises a phone to their ear within ~0.5s.
- End the call (Hang Up, or Twilio `completed`) → arm lowers, phone hides.
- Bone attachment holds through idle/walk animations (phone stays in hand).

## Gotchas
- Bone names differ per model — always log them first (B2).
- The phone is a child of a *bone*, not the group; if it floats, you attached to
  the wrong node or need `bone.add()` via `scene.attach` semantics.
- Keep the prop low-poly; it renders every frame inside the skinned hierarchy.
