# STS Scrape Agent

Python sidecar that enriches Google/business leads by scraping their website with [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai).

Next.js calls this worker over HTTP (same process-split pattern as the LiveKit voice agent).

## Setup

```bash
cd agents/python/scrape-agent
cp .env.example .env
# set SCRAPE_AGENT_API_KEY + GOOGLE_API_KEY

uv sync
uv run playwright install chromium
```

Also set in the Next.js root `.env`:

```bash
SCRAPE_AGENT_URL=http://127.0.0.1:8100
SCRAPE_AGENT_API_KEY=dev-scrape-secret

# Coolify / VPS: Next.js spawns this worker when needed, then stops it
SCRAPE_AGENT_MANAGED=1
# optional overrides:
# SCRAPE_AGENT_CWD=/app/agents/python/scrape-agent
# SCRAPE_AGENT_CMD=uv run python -m agent.main
# SCRAPE_AGENT_PORT=8100
```

On Coolify, install `uv` + Playwright Chromium on the same host as the Node app so the supervisor can start this process.

## Run

Manual (when not using `SCRAPE_AGENT_MANAGED`):

```bash
uv run python -m agent.main
# or: uv run uvicorn agent.main:app --host 0.0.0.0 --port 8100
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Liveness |
| POST | `/enrich` | `x-api-key` or `Authorization: Bearer` | Sync website scrape |
| POST | `/enrich/async` | same | Accept job, POST result to `callbackUrl` |

### Sync body

```json
{
  "url": "https://example.com",
  "leadId": "uuid",
  "userId": "uuid",
  "name": "Acme Cafe",
  "company": "Acme Cafe",
  "prompt": "optional override"
}
```

### Response

```json
{
  "ok": true,
  "url": "https://example.com",
  "leadId": "...",
  "enrichment": {
    "companySummary": "...",
    "services": [],
    "contactEmails": [],
    "contactPhones": [],
    "socialLinks": [],
    "highlights": [],
    "flags": [],
    "raw": {}
  },
  "scrapedAt": "2026-08-11T18:00:00Z",
  "provider": "scrapegraph-ai"
}
```
