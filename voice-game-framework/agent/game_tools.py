"""NPC action tools.

Each NPC action (draw_weapon, step_forward, ...) is an LLM tool — exactly like
the flower bot's `place_order`. When the model calls one, the handler:

  1. updates the per-call GameSession (so tension/armed state persists), and
  2. emits an `npc_action` (and maybe `tension_update`) app message to the game
     client over the WebRTC data channel, and
  3. returns a short result so the model can keep talking.

`build_npc_action_tools(session, npc_id)` returns the list of direct functions
to register on the LLM. Personas pick which subset they expose (see
personas/rico_dealer.py RICO_TOOLS); bot_npc filters by name.
"""

from __future__ import annotations

import uuid

from loguru import logger
from pipecat.processors.frame_processor import FrameDirection
from pipecat.processors.frameworks.rtvi.frames import RTVIServerMessageFrame
from pipecat.services.llm_service import FunctionCallParams


class GameSession:
    """Mutable scene state for one call. Tools read/write this so changes
    persist across turns and stay consistent with what we tell the client."""

    def __init__(self, npc_id: str):
        self.npc_id = npc_id
        self.tension: float = 0.2
        self.is_armed: bool = False
        self.disposition: str = "neutral"
        self.animation_state: str = "idle"

    def clamp_tension(self) -> float:
        self.tension = max(0.0, min(1.0, self.tension))
        return self.tension


def _new_utt_id() -> str:
    return f"utt_{uuid.uuid4().hex[:8]}"


def build_npc_action_tools(session: GameSession, npc_id: str):
    """Return the NPC action tool functions, closed over the session + npc_id."""

    async def _emit(params: FunctionCallParams, message: dict) -> None:
        """Send a message to the game client over RTVI (arrives client-side as
        an `RTVIEvent.ServerMessage`; `message` is the event's `.data`)."""
        await params.llm.push_frame(
            RTVIServerMessageFrame(data=message),
            FrameDirection.DOWNSTREAM,
        )

    async def _emit_action(
        params: FunctionCallParams, action: str, reason: str, params_obj: dict | None = None
    ) -> None:
        await _emit(
            params,
            {
                "type": "npc_action",
                "npc_id": npc_id,
                "action": action,
                "params": params_obj or {},
                "utterance_id": _new_utt_id(),
                "reason": reason,
            },
        )

    async def _emit_tension(params: FunctionCallParams) -> None:
        await _emit(params, {"type": "tension_update", "tension_level": session.clamp_tension()})

    async def step_forward(params: FunctionCallParams, reason: str = "") -> None:
        """Take a menacing step toward the player to assert dominance. Use when
        you want to intimidate without yet drawing a weapon.

        Args:
            reason: Brief reason you're stepping forward (for logging/eval).
        """
        session.animation_state = "aggressive"
        session.disposition = "hostile"
        session.tension += 0.15
        logger.info(f"[npc_action] step_forward — {reason}")
        await _emit_action(params, "step_forward", reason, {"distance": 0.8, "duration_ms": 900})
        await _emit_tension(params)
        await params.result_callback({"ok": True, "did": "stepped forward"})

    async def draw_weapon(params: FunctionCallParams, reason: str = "") -> None:
        """Draw your weapon. ONLY when genuinely provoked or threatened — never
        on someone calm. This is a serious escalation.

        Args:
            reason: What provoked you (for logging/eval).
        """
        session.is_armed = True
        session.animation_state = "aggressive"
        session.disposition = "hostile"
        session.tension = max(session.tension, 0.8)
        logger.info(f"[npc_action] draw_weapon — {reason}")
        await _emit_action(params, "draw_weapon", reason, {"weapon": "pistol"})
        await _emit_tension(params)
        await params.result_callback({"ok": True, "did": "drew weapon"})

    async def holster_weapon(params: FunctionCallParams, reason: str = "") -> None:
        """Put your weapon away and ease off. Use when the player backs down or
        complies.

        Args:
            reason: Why you're standing down (for logging/eval).
        """
        session.is_armed = False
        session.animation_state = "idle"
        session.disposition = "neutral"
        session.tension = min(session.tension, 0.35)
        logger.info(f"[npc_action] holster_weapon — {reason}")
        await _emit_action(params, "holster_weapon", reason)
        await _emit_tension(params)
        await params.result_callback({"ok": True, "did": "holstered weapon"})

    async def relax(params: FunctionCallParams, reason: str = "") -> None:
        """Drop your guard and relax. Use when the situation has fully calmed.

        Args:
            reason: Why you're relaxing (for logging/eval).
        """
        session.animation_state = "relaxed"
        session.disposition = "neutral"
        session.tension = min(session.tension, 0.2)
        logger.info(f"[npc_action] relax — {reason}")
        await _emit_action(params, "relax", reason)
        await _emit_tension(params)
        await params.result_callback({"ok": True, "did": "relaxed"})

    async def flee(params: FunctionCallParams, reason: str = "") -> None:
        """Run away. Use only if you're badly outmatched or it's gone truly
        sideways.

        Args:
            reason: Why you're fleeing (for logging/eval).
        """
        session.animation_state = "fleeing"
        session.disposition = "nervous"
        session.tension = max(session.tension, 0.6)
        logger.info(f"[npc_action] flee — {reason}")
        await _emit_action(params, "flee", reason)
        await _emit_tension(params)
        await params.result_callback({"ok": True, "did": "fleeing"})

    all_tools = {
        "step_forward": step_forward,
        "draw_weapon": draw_weapon,
        "holster_weapon": holster_weapon,
        "relax": relax,
        "flee": flee,
    }
    return all_tools
