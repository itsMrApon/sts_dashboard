import os
from pathlib import Path

from dotenv import load_dotenv

_here = Path(__file__).resolve()
load_dotenv(_here.parents[1] / ".env")  # scrape-agent/.env
# sts-ai/.env only exists in a repo checkout; in Docker (/app/agent) there is no such parent.
if len(_here.parents) > 4:
    load_dotenv(_here.parents[4] / ".env")


def env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


SCRAPE_AGENT_API_KEY = env("SCRAPE_AGENT_API_KEY")
SCRAPE_LLM_MODEL = env("SCRAPE_LLM_MODEL", "google_genai/gemini-2.5-flash")
HOST = env("HOST", "0.0.0.0")
PORT = int(env("PORT", "8100") or "8100")
