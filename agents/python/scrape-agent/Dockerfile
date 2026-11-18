# syntax=docker/dockerfile:1
# Lead website scrape worker (ScrapeGraphAI + headless Chromium). The Next.js app calls it over
# HTTP on the private Docker network; it needs no AI keys of its own (each request carries the
# creator's key). Deployed with scripts/deploy-workers.sh.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    # Chromium lives in the image, not in a user's home, so the non-root user finds it.
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    HOST=0.0.0.0 \
    PORT=8100 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Dependencies first (cached until pyproject.toml / uv.lock change).
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-install-project

COPY agent ./agent
RUN uv sync --locked

# Chromium plus the system libraries it needs (needs root, so before switching user).
RUN playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 1001 --create-home agent && chown -R agent /app /opt/ms-playwright
USER agent

EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=4)"

CMD ["python", "-m", "agent.main"]
