from typing import Any, Optional

from pydantic import BaseModel, Field


class EnrichRequest(BaseModel):
    url: str = Field(..., min_length=8)
    leadId: Optional[str] = None
    userId: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None
    prompt: Optional[str] = None
    geminiApiKey: Optional[str] = None


class AsyncEnrichRequest(EnrichRequest):
    callbackUrl: str = Field(..., min_length=8)
    callbackApiKey: Optional[str] = None


class WebsiteEnrichment(BaseModel):
    companySummary: Optional[str] = None
    services: list[str] = Field(default_factory=list)
    contactEmails: list[str] = Field(default_factory=list)
    contactPhones: list[str] = Field(default_factory=list)
    socialLinks: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)
    raw: Any = None


class EnrichResponse(BaseModel):
    ok: bool = True
    url: str
    leadId: Optional[str] = None
    userId: Optional[str] = None
    enrichment: WebsiteEnrichment
    scrapedAt: str
    provider: str = "scrapegraph-ai"
    error: Optional[str] = None


class AsyncAccepted(BaseModel):
    ok: bool = True
    accepted: bool = True
    url: str
    leadId: Optional[str] = None
