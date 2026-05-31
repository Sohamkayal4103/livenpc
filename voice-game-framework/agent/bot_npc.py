#
# Voice Game Agent Framework — NPC bot.
# Adapted from the hackathon starter `bot-nemotron.py`. Same pipeline, but the
# persona is a game NPC (Rico), NPC actions are tools, and live game state
# arrives over the WebRTC data channel and is injected into the LLM context.
#
# Run locally (browser, WebRTC):
#     uv run --project ../../yc-voice-agents-hackathon/server python bot_npc.py
# then open http://localhost:7860 and click Connect.
#

import os
import sys

# Make `shared` (framework root) importable; local modules (personas/, services/,
# game_tools, game_context) are already on sys.path as the script dir.
_FRAMEWORK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _FRAMEWORK_ROOT not in sys.path:
    sys.path.insert(0, _FRAMEWORK_ROOT)

from dotenv import load_dotenv
from loguru import logger
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.runner.types import RunnerArguments, SmallWebRTCRunnerArguments
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from game_context import build_context_note
from game_tools import GameSession, build_npc_action_tools
from personas.rico_dealer import (
    RICO_NAME,
    RICO_NPC_ID,
    RICO_SYSTEM_PROMPT,
    RICO_TOOLS,
)
from services.nemotron_llm import VLLMOpenAILLMService
from services.nvidia_stt import NVidiaWebSocketSTTService
from shared.schema import GameStateMessage

from pipecat.services.gradium.tts import GradiumTTSService  # noqa: E402  (after sys.path setup)

# Reuse the starter kit's .env (one place for secrets). A local agent/.env, if
# present, overrides it.
load_dotenv(os.path.join(_FRAMEWORK_ROOT, "..", "yc-voice-agents-hackathon", "server", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)


def _tension_bucket(level: float) -> int:
    return int(min(0.999, max(0.0, level)) * 4)  # 0..3


async def run_bot(transport: BaseTransport):
    """NPC bot logic for one connection."""
    logger.info(f"Starting NPC bot — persona={RICO_NAME} ({RICO_NPC_ID})")

    npc_id = RICO_NPC_ID
    session = GameSession(npc_id)

    # Latest scene state from the game client (default = a calm cold-open).
    latest_state = GameStateMessage()
    last_injected_signature: tuple | None = None

    # --- Tools: pick the persona's allowed actions ---------------------------
    all_action_tools = build_npc_action_tools(session, npc_id)
    tool_functions = [all_action_tools[name] for name in RICO_TOOLS if name in all_action_tools]
    tools = ToolsSchema(standard_tools=tool_functions)

    # --- Services ------------------------------------------------------------
    stt = NVidiaWebSocketSTTService(
        url=os.getenv("NVIDIA_ASR_URL", "ws://44.241.251.184:8080"),
        strip_interim_prefix=True,
    )

    enable_thinking = os.getenv("NEMOTRON_ENABLE_THINKING", "false").lower() == "true"
    llm = VLLMOpenAILLMService(
        api_key=os.getenv("NEMOTRON_LLM_API_KEY", "EMPTY"),
        base_url=os.getenv(
            "NEMOTRON_LLM_URL",
            "http://nemotron-fleet-alb-1322439314.us-west-2.elb.amazonaws.com/v1",
        ),
        settings=VLLMOpenAILLMService.Settings(
            model=os.getenv("NEMOTRON_LLM_MODEL", "nvidia/nemotron-3-super"),
            system_instruction=RICO_SYSTEM_PROMPT,
            extra={"extra_body": {"chat_template_kwargs": {"enable_thinking": enable_thinking}}},
        ),
    )

    tts = GradiumTTSService(
        api_key=os.environ["GRADIUM_API_KEY"],
        settings=GradiumTTSService.Settings(
            voice=os.getenv("GRADIUM_VOICE_ID", "Eu9iL_CYe8N-Gkx_"),
        ),
    )

    for fn in tool_functions:
        llm.register_direct_function(fn)

    context = LLMContext(tools=tools)
    # Plain VAD turn-taking: when VAD detects end-of-speech, the NVIDIA STT
    # finalizes and the turn ends. We deliberately do NOT use the LLM-based
    # FilterIncompleteUserTurnStrategies — it asks the LLM to classify turns
    # with ✓/○/◐ markers, and Nemotron (a reasoning model) leaks that
    # meta-reasoning into the spoken output.
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.6)),
        ),
    )

    def maybe_inject_scene_note():
        """Add a fresh scene note to the LLM context when the situation has
        materially changed (tension bucket / proximity / facing). Keeps context
        from bloating while still steering the model per turn."""
        nonlocal last_injected_signature
        sig = (
            _tension_bucket(latest_state.scene.tension_level),
            round(latest_state.player.distance_to_dealer),
            latest_state.player.looking_at == npc_id,
            latest_state.player.approached_calmly,
        )
        if sig == last_injected_signature:
            return
        last_injected_signature = sig
        note = build_context_note(latest_state, npc_id)
        context.add_message({"role": "user", "content": f"[{note}]"})
        logger.debug(f"Injected scene note: {note}")

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Player connected")
        # Cold open: someone just walked up to Rico in the alley.
        context.add_message(
            {
                "role": "user",
                "content": (
                    "Someone just walked up to you in the alley and is standing there. "
                    "Greet them the way Rico would — short, wary, sizing them up."
                ),
            }
        )
        await worker.queue_frames([LLMRunFrame()])

    @worker.rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi, msg):
        """Receive game-state / conversation messages from the game client.

        The JS client sends these via `client.sendClientMessage(type, data)`;
        `msg.type` is the type string and `msg.data` is the payload dict.
        """
        if msg.type == "game_state":
            try:
                nonlocal latest_state
                latest_state = GameStateMessage.model_validate(msg.data or {})
            except Exception as e:  # defensive: never let a bad message kill the call
                logger.warning(f"Bad game_state message: {e}")
                return
            # Keep the dealer's local session in sync with the world's tension.
            session.tension = latest_state.scene.tension_level
            maybe_inject_scene_note()
        elif msg.type == "conversation_end":
            logger.info("conversation_end received")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Player disconnected")
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments):
    """Entry point. Local WebRTC only for now (phone/Twilio is a Phase 5 stretch)."""
    if os.environ.get("ENV") != "local":
        from pipecat.audio.filters.krisp_viva_filter import KrispVivaFilter

        krisp_filter = KrispVivaFilter()
    else:
        krisp_filter = None

    match runner_args:
        case SmallWebRTCRunnerArguments():
            webrtc_connection: SmallWebRTCConnection = runner_args.webrtc_connection
            transport = SmallWebRTCTransport(
                webrtc_connection=webrtc_connection,
                params=TransportParams(
                    audio_in_enabled=True,
                    audio_in_filter=krisp_filter,
                    audio_out_enabled=True,
                ),
            )
        case _:
            logger.error(f"Unsupported runner arguments type: {type(runner_args)}")
            return

    await run_bot(transport)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
