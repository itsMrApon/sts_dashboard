import asyncio
import json
import logging
import os
import re
from typing import Dict, List, Optional
from urllib import error, request
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load environment variables.
#
# Important: This worker runs from `agents/python/livekit-agent`, so `.env` there
# might not include SAAS_API_URL / SAAS_API_KEY. Those live in the Next.js repo
# root `.env`, so we load both to ensure the agent prompt/instructions are
# fetched from the DB-backed SaaS endpoint.
_local_env = Path(__file__).resolve().parents[1] / ".env"  # livekit-agent/.env
_root_env = Path(__file__).resolve().parents[4] / ".env"  # sts-ai/.env
load_dotenv(_local_env)
load_dotenv(_root_env)

logger = logging.getLogger(__name__)


class MCPServerConfig(BaseModel):
    """Configuration for a specific MCP server."""

    name: str
    image: str
    args: List[str] = []
    env: Dict[str, str] = {}


class RoomConfig(BaseModel):
    """Configuration for a specific room (tenant)."""

    room_name: str
    business_type: str
    instructions: str
    first_message: Optional[str] = None
    language: str = "en"  # "en" or "bn"
    voice_provider: str = "deepgram"
    voice_model: str = "aura-asteria-en"
    llm_model: str = os.getenv("LLM_CHOICE", "gemini-2.5-flash")
    llm_provider: str = "google"
    enabled_mcp_servers: List[str] = []

    # Environment variables specific to this tenant (e.g. their Stripe Key)
    tenant_env: Dict[str, str] = Field(default_factory=dict)

    # Transcript logging (populated by SaaS backend)
    user_id: Optional[str] = None
    transcript_ingest_url: Optional[str] = None
    transcript_api_key: Optional[str] = None
    usage_ingest_url: Optional[str] = None
    usage_surface: Optional[str] = None


# --- Simulated SaaS Database (fallback for local/dev) ---

MOCK_SAAS_DB = {
    "room-airbnb-demo": RoomConfig(
        room_name="room-airbnb-demo",
        business_type="Travel Agency",
        instructions=(
            """You are a charismatic and helpful travel sales agent.
        Your goal is to inspire users to travel and help them plan their trips.
        If you have access to tools, use them to find listings.
        If you CANNOT access tools (e.g. Airbnb), strictly rely on your general knowledge """
        ),
        language="en",
        enabled_mcp_servers=["airbnb"],
    ),
    "room-stripe-demo": RoomConfig(
        room_name="room-stripe-demo",
        business_type="E-commerce Support",
        instructions=(
            """You are a polite and efficient billing support agent.
        If you can access account details, help the user.
        If tools are unavailable, explain general billing policies, refund timelines (usually 5-10 days),
        and how they can contact support via email. Always remain professional and reassuring."""
        ),
        language="en",
        enabled_mcp_servers=["stripe"],
        tenant_env={
            # In a real app, these would be decrypted from the DB
            "STRIPE_SECRET_KEY": os.getenv("STRIPE_SECRET_KEY", ""),
        },
    ),
    "room-bangla-demo": RoomConfig(
        room_name="room-bangla-demo",
        business_type="General Assistant",
        instructions="You are a helpful assistant who speaks Bangla.",
        language="bn",
        voice_model="aura-luna-en",  # Using English voice for now as Deepgram TTS Bangla might not be fully available
    ),
}

DEFAULT_CONFIG = RoomConfig(
    room_name="default",
    business_type="General Assistant",
    instructions="You are a helpful AI assistant.",
    enabled_mcp_servers=["airbnb", "stripe"],  # Default to all for testing if not specified
    tenant_env={
        "STRIPE_SECRET_KEY": os.getenv("STRIPE_SECRET_KEY", ""),
    },
)

SAAS_API_URL = os.getenv("SAAS_API_URL")
SAAS_API_KEY = os.getenv("SAAS_API_KEY")


def _config_lookup_room_name(room_name: str) -> str:
    """Client uses `{chatRoom}-v{N}` per voice attempt; config is keyed by chat room."""
    return re.sub(r"-v\d+$", "", room_name)


async def load_room_config(room_name: str) -> RoomConfig:
    """Fetch configuration for a room (tenant).

    In production, this calls your SaaS backend:
        {SAAS_API_URL}/rooms/{room_name}/agent-config

    If SAAS_API_URL is not set or the request fails, falls back to local mock config.
    """

    logger.info("Loading configuration for room: %s", room_name)

    lookup_name = _config_lookup_room_name(room_name)

    # Try SaaS backend first if configured
    if SAAS_API_URL:
        url = f"{SAAS_API_URL.rstrip('/')}/rooms/{lookup_name}/agent-config"
        headers = {"Accept": "application/json"}
        if SAAS_API_KEY:
            headers["Authorization"] = f"Bearer {SAAS_API_KEY}"

        def _fetch() -> Dict:
            req = request.Request(url, headers=headers, method="GET")
            with request.urlopen(req, timeout=25) as resp:
                return json.load(resp)

        try:
            data = await asyncio.to_thread(_fetch)
            logger.info("Loaded room config from SaaS backend for room: %s", room_name)
            return RoomConfig(**data)
        except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, Exception) as exc:  # noqa: BLE001
            logger.warning(
                "Failed to load room config from SaaS backend (%s). "
                "Falling back to local configuration.",
                exc,
            )

    # Fallback: local mock DB / default config
    config = MOCK_SAAS_DB.get(room_name) or MOCK_SAAS_DB.get(lookup_name)
    if not config:
        logger.warning("No specific config found for %s, using default.", room_name)
        config = DEFAULT_CONFIG.copy()
        config.room_name = room_name

    return config


def get_mcp_server_config(
    server_name: str, tenant_env: Dict[str, str]
) -> Optional[MCPServerConfig]:
    """Map server names to their Docker definitions."""

    if server_name == "airbnb":
        return MCPServerConfig(
            name="openbnb-airbnb",
            image="mcp/openbnb-airbnb",
            args=["run", "-i", "--rm", "mcp/openbnb-airbnb"],
        )

    if server_name == "stripe":
        stripe_key = tenant_env.get("STRIPE_SECRET_KEY")
        if not stripe_key:
            logger.warning(
                "Stripe enabled but STRIPE_SECRET_KEY not found in tenant config.",
            )
            return None

        return MCPServerConfig(
            name="stripe",
            image="mcp/stripe",
            args=[
                "run",
                "-i",
                "--rm",
                "-e",
                "STRIPE_SECRET_KEY",
                "mcp/stripe",
                "--tools=all",
            ],
            env={"STRIPE_SECRET_KEY": stripe_key},
        )

    return None

