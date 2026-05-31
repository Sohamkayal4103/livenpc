"""Turn a game-state message into a compact context note for the LLM.

The note is injected before the NPC's turn (same idea as the flower bot's
`caller_context`), so the model's mood/decisions reflect the live scene without
us re-prompting the whole system instruction.

Kept SHORT on purpose: long context = slower, and the model only needs the
decision-relevant facts (tension, proximity, threat posture).
"""

from __future__ import annotations

from shared.schema import GameStateMessage, NPCSnapshot


def _tension_word(level: float) -> str:
    if level >= 0.75:
        return "very high"
    if level >= 0.5:
        return "high"
    if level >= 0.25:
        return "rising"
    return "calm"


def _facing(state: GameStateMessage, npc_id: str) -> str:
    return "looking right at you" if state.player.looking_at == npc_id else "not looking at you"


def build_context_note(state: GameStateMessage, npc_id: str) -> str:
    """Build the per-turn scene note for the NPC with id ``npc_id``.

    Returns a single short paragraph. Safe to call with a default/empty state.
    """
    me: NPCSnapshot | None = next((n for n in state.npcs if n.id == npc_id), None)
    others = [n for n in state.npcs if n.id != npc_id]

    tension = state.scene.tension_level
    parts: list[str] = [
        f"SCENE STATE — tension is {_tension_word(tension)} ({tension:.2f}).",
        f"The player is {state.player.distance_to_dealer:.1f}m away, "
        f"{_facing(state, npc_id)}, "
        f"{'speaking' if state.player.is_speaking else 'quiet'}, "
        f"{'moving fast' if state.player.movement_speed > 3 else 'moving calmly'}, "
        f"and {'unarmed' if not any(n.is_armed for n in state.npcs if n.role == 'dealer') else 'armed'}.",
    ]
    if state.player.approached_calmly is False:
        parts.append("They did NOT approach calmly — they rushed you.")
    if me is not None:
        parts.append(
            f"You ({me.name}) are currently {me.disposition}, "
            f"{'armed' if me.is_armed else 'unarmed'}, {me.animation_state}."
        )
    if others:
        who = ", ".join(f"{n.name or n.id} ({n.role}, {n.animation_state})" for n in others)
        parts.append(f"Also present: {who}.")
    if state.scene.ambient_events:
        parts.append("Recent events: " + ", ".join(state.scene.ambient_events) + ".")

    parts.append("React in character. Keep it short.")
    return " ".join(parts)
