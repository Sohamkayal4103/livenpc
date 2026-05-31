"""Canonical protocol — Python side. Mirrors schema.ts and protocol.md.

Imported by the agent (game_context.py, game_tools.py, bot_npc.py). If you
change a field here, change schema.ts and protocol.md too.

Pydantic v2 models. Inbound game messages are parsed defensively (extra fields
ignored) so a slightly-ahead client never crashes the agent.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = 1

NPCRole = Literal["dealer", "bodyguard", "bystander"]
NPCDisposition = Literal["hostile", "neutral", "friendly", "nervous"]
NPCAnimationState = Literal["idle", "alert", "aggressive", "relaxed", "fleeing"]
NPCAction = Literal["step_forward", "draw_weapon", "holster_weapon", "flee", "relax"]


class _Lenient(BaseModel):
    # Ignore unknown fields so a newer client doesn't break the agent.
    model_config = ConfigDict(extra="ignore")


class Vec3(_Lenient):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class ActionNote(_Lenient):
    type: str
    note: str | None = None


class PlayerState(_Lenient):
    position: Vec3 = Field(default_factory=Vec3)
    looking_at: str | None = None
    distance_to_dealer: float = 999.0
    is_speaking: bool = False
    movement_speed: float = 0.0
    approached_calmly: bool = True
    last_action: ActionNote | None = None


class NPCSnapshot(_Lenient):
    id: str
    name: str = ""
    role: NPCRole = "dealer"
    position: Vec3 = Field(default_factory=Vec3)
    distance_to_player: float = 999.0
    disposition: NPCDisposition = "neutral"
    is_armed: bool = False
    animation_state: NPCAnimationState = "idle"


class SceneSnapshot(_Lenient):
    id: str = "scene"
    tension_level: float = 0.0
    ambient_events: list[str] = Field(default_factory=list)


# ---- Game → Agent -------------------------------------------------------


class GameStateMessage(_Lenient):
    type: Literal["game_state"] = "game_state"
    schema_version: int = SCHEMA_VERSION
    session_id: str = ""
    conversation_id: str = ""
    timestamp_ms: int = 0
    scene: SceneSnapshot = Field(default_factory=SceneSnapshot)
    player: PlayerState = Field(default_factory=PlayerState)
    npcs: list[NPCSnapshot] = Field(default_factory=list)


# ---- Agent → Game -------------------------------------------------------


class NPCActionMessage(_Lenient):
    type: Literal["npc_action"] = "npc_action"
    npc_id: str
    action: NPCAction
    params: dict | None = None
    utterance_id: str | None = None
    reason: str | None = None


class TensionUpdateMessage(_Lenient):
    type: Literal["tension_update"] = "tension_update"
    tension_level: float


class SubtitleMessage(_Lenient):
    type: Literal["subtitle"] = "subtitle"
    npc_id: str
    text: str
    utterance_id: str | None = None
