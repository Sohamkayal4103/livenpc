FROM dailyco/pipecat-base:latest

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Install dependencies from the lockfile (same resolved set as the starter).
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

# Application code — the Rico NPC agent + its modules.
COPY ./bot.py bot.py
COPY ./game_context.py game_context.py
COPY ./game_tools.py game_tools.py
COPY ./personas ./personas
COPY ./services ./services
COPY ./shared ./shared
