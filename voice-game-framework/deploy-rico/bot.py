#
# Rico NPC bot — Pipecat Cloud deployable entry point.
#
# Mirrors agent/bot_npc.py, but the transport is built with create_transport so
# the SAME image serves both:
#   - "daily"  : Pipecat Cloud sessions (this is what Cekura connects over)
#   - "webrtc" : local SmallWebRTC dev
#
# Secrets (GRADIUM_API_KEY, NVIDIA_ASR_URL, NEMOTRON_LLM_URL, ...) come from the
# Pipecat Cloud secret set at runtime, so there's no .env loading here.
#

import os

from loguru import logger
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.gradium.tts import GradiumTTSService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams
from pipecat.workers.runner import WorkerRunner

from game_context import build_context_note
from game_tools import GameSession, build_npc_action_tools
from personas.rico_dealer import RICO_NAME, RICO_NPC_ID, RICO_SYSTEM_PROMPT, RICO_TOOLS
from services.nemotron_llm import VLLMOpenAILLMService
from services.nvidia_stt import NVidiaWebSocketSTTService
from shared.schema import GameStateMessage

# Transport params per environment:
#   daily  → Cekura / Pipecat Cloud WebRTC sessions
#   webrtc → local SmallWebRTC dev
#   twilio → real phone calls (the in-game phone feature). Pipecat sets the
#            Twilio serializer + 8 kHz μ-law handling automatically.
transport_params = {
    "daily": lambda: DailyParams(audio_in_enabled=True, audio_out_enabled=True),
    "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    "twilio": lambda: FastAPIWebsocketParams(audio_in_enabled=True, audio_out_enabled=True),
}


def _tension_bucket(level: float) -> int:
    return int(min(0.999, max(0.0, level)) * 4)


async def run_bot(transport: BaseTransport):
    """NPC bot logic for one connection (identical to agent/bot_npc.py)."""
    logger.info(f"Starting NPC bot — persona={RICO_NAME} ({RICO_NPC_ID})")

    npc_id = RICO_NPC_ID
    session = GameSession(npc_id)
    latest_state = GameStateMessage()
    last_injected_signature: tuple | None = None

    all_action_tools = build_npc_action_tools(session, npc_id)
    tool_functions = [all_action_tools[name] for name in RICO_TOOLS if name in all_action_tools]
    tools = ToolsSchema(standard_tools=tool_functions)

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
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.6)),
        ),
    )

    def maybe_inject_scene_note():
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
        if msg.type == "game_state":
            try:
                nonlocal latest_state
                latest_state = GameStateMessage.model_validate(msg.data or {})
            except Exception as e:
                logger.warning(f"Bad game_state message: {e}")
                return
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
    """Pipecat Cloud entry point. Builds the right transport for the environment."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
