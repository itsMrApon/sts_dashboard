# STS Scrape Agent

Python sidecar that enriches Google lead websites with [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai).

## Setup

```bash
cd agents/python/scrape-agent
cp env.example .env
# set SCRAPE_AGENT_API_KEY + GOOGLE_API_KEY

uv sync
uv run playwright install chromium
```

Next.js `.env`:

```bash
SCRAPE_AGENT_URL=http://127.0.0.1:8100
SCRAPE_AGENT_API_KEY=dev-scrape-secret
```

## Run

```bash
uv run python -m agent.main
```

## Endpoints

- `GET /health`
- `POST /enrich` — sync scrape (auth: `x-api-key`)
- `POST /enrich/async` — background scrape + callback
