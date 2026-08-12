from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

from .config import GOOGLE_API_KEY, OPENAI_API_KEY, SCRAPE_LLM_MODEL
from .schemas import EnrichRequest, EnrichResponse, WebsiteEnrichment

logger = logging.getLogger(__name__)

DEFAULT_PROMPT = """Extract sales-useful facts about this business from the page.
Return JSON with these keys:
- companySummary: short description of what the company does
- services: list of products/services offered
- contactEmails: public emails found
- contactPhones: public phone numbers found
- socialLinks: social profile URLs found
- highlights: 3-8 talking points for a sales call
- flags: risks, gaps, or notable opportunities
Use empty lists when unknown. Prefer verifiable page content only."""


def normalize_url(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise ValueError("url is required")
    if not re.match(r"^https?://", value, re.I):
        value = f"https://{value}"
    parsed = urlparse(value)
    if not parsed.netloc:
        raise ValueError("invalid url")
    return value


def build_graph_config(api_key: Optional[str] = None) -> dict[str, Any]:
    model = SCRAPE_LLM_MODEL or "google_genai/gemini-2.5-flash"
    key = (api_key or "").strip()

    if model.startswith("openai/") or model.startswith("gpt-"):
        key = key or OPENAI_API_KEY
        if not key:
            raise RuntimeError("OPENAI_API_KEY missing for scrape agent")
        if not model.startswith("openai/"):
            model = f"openai/{model}"
    else:
        key = key or GOOGLE_API_KEY
        if not key:
            raise RuntimeError("GOOGLE_API_KEY missing for scrape agent")
        if not (
            model.startswith("google_genai/")
            or model.startswith("gemini/")
            or model.startswith("google/")
        ):
            model = f"google_genai/{model}"

    return {
        "llm": {
            "model": model,
            "api_key": key,
            "temperature": 0,
        },
        "verbose": False,
        "headless": True,
        "timeout": 90,
    }


def _as_str_list(value: Any, limit: int = 20) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        if len(out) >= limit:
            break
    return out


def _coerce_enrichment(raw: Any) -> WebsiteEnrichment:
    data: dict[str, Any]
    if isinstance(raw, dict):
        data = raw
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            data = parsed if isinstance(parsed, dict) else {"companySummary": raw}
        except json.JSONDecodeError:
            data = {"companySummary": raw.strip()[:2000] or None}
    else:
        data = {"raw": raw}

    summary = data.get("companySummary") or data.get("summary") or data.get("description")
    if summary is not None and not isinstance(summary, str):
        summary = str(summary)

    return WebsiteEnrichment(
        companySummary=(summary.strip() if isinstance(summary, str) and summary.strip() else None),
        services=_as_str_list(data.get("services") or data.get("products")),
        contactEmails=_as_str_list(data.get("contactEmails") or data.get("emails")),
        contactPhones=_as_str_list(data.get("contactPhones") or data.get("phones")),
        socialLinks=_as_str_list(data.get("socialLinks") or data.get("socials")),
        highlights=_as_str_list(data.get("highlights"), limit=10),
        flags=_as_str_list(data.get("flags"), limit=10),
        raw=data,
    )


def run_smart_scrape(req: EnrichRequest) -> EnrichResponse:
    from scrapegraphai.graphs import SmartScraperGraph

    url = normalize_url(req.url)
    prompt_parts = [req.prompt.strip() if req.prompt else DEFAULT_PROMPT]
    if req.name or req.company:
        prompt_parts.append(
            f"\nLead context: name={req.name or 'unknown'}; company={req.company or 'unknown'}"
        )
    prompt = "\n".join(prompt_parts)

    graph_config = build_graph_config(req.geminiApiKey)
    logger.info("Scraping %s with model %s", url, graph_config["llm"]["model"])

    graph = SmartScraperGraph(
        prompt=prompt,
        source=url,
        config=graph_config,
    )
    result = graph.run()
    enrichment = _coerce_enrichment(result)

    return EnrichResponse(
        ok=True,
        url=url,
        leadId=req.leadId,
        userId=req.userId,
        enrichment=enrichment,
        scrapedAt=datetime.now(timezone.utc).isoformat(),
        provider="scrapegraph-ai",
    )
