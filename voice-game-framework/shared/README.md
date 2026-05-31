# shared/ — Canonical protocol (single source of truth)

The one schema both the agent (Python) and the game client (TS) import. **Never change a field name in only one language.**

## Files
| File | Consumed by | Status |
|---|---|---|
| `protocol.md` | humans | ☐ to write |
| `schema.ts` | `client/` + `scene-negotiation/` | ☐ to write |
| `schema.py` | `agent/` | ☐ to write |

## Messages (see PLAN.md §7 for full examples)
**Data channel — game → agent**
- `game_state` — scene tension, player position/proximity/look/speaking, NPC roster (disposition, armed, animation_state).

**Data channel — agent → game**
- `npc_action` — `{npc_id, action, params}` where `action ∈ NPCAction`.
- `tension_update` — `{tension_level}`.
- `subtitle` — `{npc_id, utterance_id, text}`.

**Media track (not JSON):** player mic + NPC voice.

## Canonical field names (unify old plan ↔ game code)
`scene.tension_level` · `npc.animation_state` · `npc.is_armed` · `npc.disposition`
`NPCAction = step_forward | draw_weapon | holster_weapon | flee | relax`

Always include: `schema_version`, `session_id`, `conversation_id`; on agent outputs, `utterance_id`.
