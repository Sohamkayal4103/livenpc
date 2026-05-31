# Protocol — Voice Game Agent Framework

Canonical, human‑readable contract. `schema.ts` (client) and `schema.py` (agent) implement exactly this. **If you change a field, change all three.**

Two channels (see `../../PLAN.md` §3):
- **Media track (WebRTC):** player mic ↔ NPC voice. Not described here — it's raw audio handled by Pipecat.
- **Data channel (WebRTC app messages):** everything below. JSON objects, each with a `type`.

`schema_version` is `1`.

---

## Game → Agent

### `game_state`
Sent on connect and whenever the scene changes materially (debounce to ~2–4 Hz; always send right before the player speaks so the LLM has fresh context).

```jsonc
{
  "type": "game_state",
  "schema_version": 1,
  "session_id": "sess_123",
  "conversation_id": "conv_456",
  "timestamp_ms": 1730000000000,
  "scene": {
    "id": "gta_back_alley",
    "tension_level": 0.42,              // 0..1
    "ambient_events": ["player_approached_dealer"]
  },
  "player": {
    "position": { "x": 0, "y": 0, "z": 3.2 },
    "looking_at": "dealer_rico",        // npc_id | null
    "distance_to_dealer": 3.2,
    "is_speaking": true,
    "movement_speed": 1.1,
    "approached_calmly": true,
    "last_action": { "type": "walk_forward", "note": "Walks forward calmly, watching the dealer." }
  },
  "npcs": [
    {
      "id": "dealer_rico",
      "name": "Rico",
      "role": "dealer",                 // dealer | bodyguard | bystander
      "position": { "x": 0, "y": 0, "z": 0 },
      "distance_to_player": 3.2,
      "disposition": "neutral",         // hostile | neutral | friendly | nervous
      "is_armed": false,
      "animation_state": "idle"         // idle | alert | aggressive | relaxed | fleeing
    }
  ]
}
```

### `conversation_start` / `conversation_end`
```jsonc
{ "type": "conversation_start", "npc_id": "dealer_rico", "conversation_id": "conv_456" }
{ "type": "conversation_end",   "npc_id": "dealer_rico", "conversation_id": "conv_456" }
```

---

## Agent → Game

Audio is the media track. These ride the data channel.

### `npc_action`
Emitted when the NPC LLM calls an action tool. `action` is one of the fixed `NPCAction` enum.

```jsonc
{
  "type": "npc_action",
  "npc_id": "dealer_rico",
  "action": "draw_weapon",             // step_forward | draw_weapon | holster_weapon | flee | relax
  "params": { "distance": 0.8, "duration_ms": 900 },  // action-specific, optional
  "utterance_id": "utt_789",
  "reason": "player threatened him"     // optional, for eval/observability
}
```

### `tension_update`
```jsonc
{ "type": "tension_update", "tension_level": 0.55 }
```

### `subtitle`
The spoken line as text (for on‑screen subtitles + Cekura transcripts).
```jsonc
{ "type": "subtitle", "npc_id": "dealer_rico", "utterance_id": "utt_789", "text": "You came alone. Good." }
```

---

## Enums (single source of truth)

| Enum | Values |
|---|---|
| `NPCRole` | `dealer`, `bodyguard`, `bystander` |
| `NPCDisposition` | `hostile`, `neutral`, `friendly`, `nervous` |
| `NPCAnimationState` | `idle`, `alert`, `aggressive`, `relaxed`, `fleeing` |
| `NPCAction` | `step_forward`, `draw_weapon`, `holster_weapon`, `flee`, `relax` |

## Field‑name notes (why these names)
Anchored on the running game (`scene-negotiation/src/types/GameState.ts`): `tension_level` (not `tension`), `animation_state` (not `state`), `is_armed` (not `armed`). The old plan's free‑form action strings are replaced by the `NPCAction` enum.
