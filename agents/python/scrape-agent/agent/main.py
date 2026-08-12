from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx
import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from . import __version__
from .config import HOST, PORT, SCRAPE_AGENT_API_KEY
from .schemas import AsyncAccepted, AsyncEnrichRequest, EnrichRequest, EnrichResponse
from .scraper import run_smart_scrape

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="STS Scrape Agent", version=__version__)


def authorize(
    x_api_key: Optional[str] = Header(default=None, alias="x-api-key"),
    authorization: Optional[str] = Header(default=None),
) -> None:
    expected = SCRAPE_AGENT_API_KEY
    if not expected:
        logger.warning("SCRAPE_AGENT_API_KEY unset — auth disabled")
        return

    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()

    provided = (x_api_key or bearer or "").strip()
    if provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "scrape-agent", "version": __version__}


@app.post("/enrich", response_model=EnrichResponse, dependencies=[Depends(authorize)])
async def enrich(body: EnrichRequest) -> EnrichResponse | JSONResponse:
    try:
        return await asyncio.to_thread(run_smart_scrape, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("enrich failed for %s", body.url)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "url": body.url,
                "leadId": body.leadId,
                "userId": body.userId,
                "enrichment": {
                    "companySummary": None,
                    "services": [],
                    "contactEmails": [],
                    "contactPhones": [],
                    "socialLinks": [],
                    "highlights": [],
                    "flags": [f"Scrape failed: {exc}"],
                    "raw": None,
                },
                "scrapedAt": "",
                "provider": "scrapegraph-ai",
                "error": str(exc),
            },
        )


async def _run_and_callback(body: AsyncEnrichRequest) -> None:
    try:
        result = await asyncio.to_thread(run_smart_scrape, body)
        payload = result.model_dump()
    except Exception as exc:  # noqa: BLE001
        logger.exception("async enrich failed for %s", body.url)
        payload = {
            "ok": False,
            "url": body.url,
            "leadId": body.leadId,
            "userId": body.userId,
            "enrichment": {
                "companySummary": None,
                "services": [],
                "contactEmails": [],
                "contactPhones": [],
                "socialLinks": [],
                "highlights": [],
                "flags": [f"Scrape failed: {exc}"],
                "raw": None,
            },
            "scrapedAt": "",
            "provider": "scrapegraph-ai",
            "error": str(exc),
        }

    headers = {"Content-Type": "application/json"}
    key = (body.callbackApiKey or SCRAPE_AGENT_API_KEY or "").strip()
    if key:
        headers["x-api-key"] = key

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(body.callbackUrl, json=payload, headers=headers)
            logger.info(
                "callback %s -> %s for lead %s",
                body.callbackUrl,
                resp.status_code,
                body.leadId,
            )
    except Exception:  # noqa: BLE001
        logger.exception("callback failed for lead %s", body.leadId)


@app.post(
    "/enrich/async",
    response_model=AsyncAccepted,
    status_code=202,
    dependencies=[Depends(authorize)],
)
async def enrich_async(body: AsyncEnrichRequest) -> AsyncAccepted:
    try:
        from .scraper import normalize_url

        normalize_url(body.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    asyncio.create_task(_run_and_callback(body))
    return AsyncAccepted(ok=True, accepted=True, url=body.url, leadId=body.leadId)


def run() -> None:
    uvicorn.run("agent.main:app", host=HOST, port=PORT, reload=False)


if __name__ == "__main__":
    run()
