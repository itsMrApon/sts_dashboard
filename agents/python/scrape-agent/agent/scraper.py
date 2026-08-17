from __future__ import annotations

import json
import logging
import re
import socket
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse, urlunparse

from .config import GOOGLE_API_KEY, OPENAI_API_KEY, SCRAPE_LLM_MODEL
from .schemas import EnrichRequest, EnrichResponse, WebsiteEnrichment, WebsiteEnrichmentSchema

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


def _host_resolves(host: str) -> bool:
    hostname = host.split("@")[-1].split(":")[0].strip().lower()
    if not hostname:
        return False
    try:
        socket.getaddrinfo(hostname, None)
        return True
    except OSError:
        return False


def candidate_urls(raw: str) -> list[str]:
    """Build scrape URL fallbacks (www ↔ apex, https preferred).

    Google/business sites often store www.* even when only the apex resolves
    (e.g. www.prothoma.tax fails DNS, prothoma.tax works).
    """
    primary = normalize_url(raw)
    parsed = urlparse(primary)
    host = parsed.netloc
    if not host:
        return [primary]

    hosts: list[str] = [host]
    lower = host.lower()
    if lower.startswith("www."):
        hosts.append(host[4:])
    else:
        hosts.append(f"www.{host}")

    resolving = [h for h in hosts if _host_resolves(h)]
    # Prefer DNS-resolving hosts only when we found any; otherwise try all.
    ordered_hosts = resolving or hosts

    out: list[str] = []
    seen: set[str] = set()
    for scheme in ("https", "http"):
        for h in ordered_hosts:
            candidate = urlunparse(
                (scheme, h, parsed.path or "/", parsed.params, parsed.query, "")
            )
            if candidate not in seen:
                seen.add(candidate)
                out.append(candidate)
    return out or [primary]


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
    if isinstance(value, str) and value.strip():
        return [value.strip()][:limit]
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            # e.g. {"name": "Audit"} / {"title": "..."}
            for key in ("name", "title", "service", "label", "value", "url", "link"):
                v = item.get(key)
                if isinstance(v, str) and v.strip():
                    out.append(v.strip())
                    break
        if len(out) >= limit:
            break
    return out


def _strip_fence(text: str) -> str:
    value = text.strip()
    if value.startswith("```"):
        value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.I)
        value = re.sub(r"\s*```$", "", value)
    return value.strip()


def _unwrap_payload(result: Any) -> dict[str, Any]:
    """Normalize SmartScraper / LLM shapes into a flat enrichment dict."""
    data: Any = result

    if isinstance(data, WebsiteEnrichment):
        dumped = data.model_dump()
        dumped.pop("raw", None)
        return dumped
    if isinstance(data, WebsiteEnrichmentSchema):
        return data.model_dump()

    if isinstance(data, str):
        text = _strip_fence(data)
        try:
            parsed = json.loads(text)
            data = parsed
        except json.JSONDecodeError:
            return {"companySummary": text}

    if not isinstance(data, dict):
        return {}

    # Work on a shallow copy so we never mutate / cycle the original payload.
    data = dict(data)

    # Unwrap common ScrapeGraphAI wrappers: {"content": {...}} / answer / result
    for _ in range(3):
        nested = None
        for key in ("content", "answer", "result", "data", "output", "enrichment"):
            if key in data and isinstance(data[key], (dict, str)) and len(data) <= 3:
                nested = data[key]
                break
        if nested is None:
            break
        if isinstance(nested, str):
            text = _strip_fence(nested)
            try:
                parsed = json.loads(text)
                data = dict(parsed) if isinstance(parsed, dict) else {"companySummary": text}
            except json.JSONDecodeError:
                return {"companySummary": text}
        else:
            data = dict(nested)

    # Snake_case → camelCase aliases
    aliases = {
        "company_summary": "companySummary",
        "company": "companySummary",
        "description": "companySummary",
        "summary": "companySummary",
        "about": "companySummary",
        "contact_emails": "contactEmails",
        "emails": "contactEmails",
        "contact_phones": "contactPhones",
        "phones": "contactPhones",
        "social_links": "socialLinks",
        "socials": "socialLinks",
        "products": "services",
    }
    for src, dest in aliases.items():
        if dest not in data or data.get(dest) in (None, "", []):
            if src in data and data[src] not in (None, "", []):
                data[dest] = data[src]

    return data


def _coerce_enrichment(result: Any) -> WebsiteEnrichment:
    data = _unwrap_payload(result)

    summary = (
        data.get("companySummary") or data.get("summary") or data.get("description")
    )
    if isinstance(summary, dict):
        summary = summary.get("text") or summary.get("value") or json.dumps(summary)

    enrichment = WebsiteEnrichment(
        companySummary=(
            summary.strip()
            if isinstance(summary, str) and summary.strip()
            else None
        ),
        services=_as_str_list(data.get("services") or data.get("products")),
        contactEmails=_as_str_list(data.get("contactEmails") or data.get("emails")),
        contactPhones=_as_str_list(data.get("contactPhones") or data.get("phones")),
        socialLinks=_as_str_list(data.get("socialLinks") or data.get("socials")),
        highlights=_as_str_list(data.get("highlights"), limit=10),
        flags=_as_str_list(data.get("flags"), limit=10),
        raw=result if not isinstance(result, (WebsiteEnrichment, WebsiteEnrichmentSchema)) else data,
    )

    # If everything empty but we have a stringy content blob, surface it.
    if (
        not enrichment.companySummary
        and not enrichment.services
        and not enrichment.highlights
        and isinstance(result, dict)
        and isinstance(result.get("content"), str)
        and result["content"].strip()
    ):
        enrichment.companySummary = result["content"].strip()[:4000]
        enrichment.flags = [
            *enrichment.flags,
            "Unstructured scrape content — re-scrape after agent update",
        ][:10]

    return enrichment


def _is_navigation_error(err: BaseException) -> bool:
    msg = str(err).lower()
    needles = (
        "err_name_not_resolved",
        "err_connection_refused",
        "err_connection_timed_out",
        "err_connection_reset",
        "err_ssl",
        "net::err_",
        "name or service not known",
        "nodename nor servname",
        "getaddrinfo failed",
        "navigating to",
        "timeout",
    )
    return any(n in msg for n in needles)


def run_smart_scrape(req: EnrichRequest) -> EnrichResponse:
    from scrapegraphai.graphs import SmartScraperGraph

    urls = candidate_urls(req.url)
    prompt_parts = [req.prompt.strip() if req.prompt else DEFAULT_PROMPT]
    if req.name or req.company:
        prompt_parts.append(
            f"\nLead context: name={req.name or 'unknown'}; company={req.company or 'unknown'}"
        )
    prompt = "\n".join(prompt_parts)

    graph_config = build_graph_config(req.geminiApiKey)
    last_error: BaseException | None = None

    for idx, url in enumerate(urls):
        logger.info(
            "Scraping %s with model %s (attempt %s/%s)",
            url,
            graph_config["llm"]["model"],
            idx + 1,
            len(urls),
        )
        try:
            graph = SmartScraperGraph(
                prompt=prompt,
                source=url,
                config=graph_config,
                schema=WebsiteEnrichmentSchema,
            )
            result = graph.run()
            enrichment = _coerce_enrichment(result)
            if (
                not enrichment.companySummary
                and not enrichment.services
                and not enrichment.highlights
                and not enrichment.contactEmails
            ):
                enrichment.flags = [
                    *enrichment.flags,
                    "Scrape returned little structured data",
                ][:10]
                logger.warning(
                    "Sparse enrichment for %s; raw keys=%s",
                    url,
                    list(result.keys()) if isinstance(result, dict) else type(result),
                )
            return EnrichResponse(
                ok=True,
                url=url,
                leadId=req.leadId,
                userId=req.userId,
                enrichment=enrichment,
                scrapedAt=datetime.now(timezone.utc).isoformat(),
                provider="scrapegraph-ai",
            )
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if idx < len(urls) - 1 and _is_navigation_error(exc):
                logger.warning("Navigation failed for %s; trying fallback URL", url)
                continue
            raise

    assert last_error is not None
    raise last_error
