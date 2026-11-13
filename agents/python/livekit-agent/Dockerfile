# syntax=docker/dockerfile:1
# LiveKit voice worker ("saas-agent"). Build from this folder:
#   docker compose up -d --build
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    # Model weights live in the image, not in a user's home, so any UID finds them.
    HF_HOME=/opt/hf \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Dependencies first (cached until pyproject.toml / uv.lock change).
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project

COPY agent ./agent

# Bake the turn-detector + Silero weights into the image so a call never waits on a download.
RUN python -m agent.main download-files

RUN useradd --system --uid 1001 agent && chown -R agent /app /opt/hf
USER agent

# LiveKit worker health endpoint (only reachable inside the container network).
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/', timeout=4)"

# `start` = production mode (no file watching). Outbound-only: it dials LiveKit, no inbound ports.
CMD ["python", "-m", "agent.main", "start"]
