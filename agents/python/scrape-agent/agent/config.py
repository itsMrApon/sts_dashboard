import os
from pathlib import Path

from dotenv import load_dotenv

_local_env = Path(__file__).resolve().parents[1] / ".env"
_root_env = Path(__file__).resolve().parents[4] / ".env"
load_dotenv(_local_env)
load_dotenv(_root_env)


def env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


SCRAPE_AGENT_API_KEY = env("SCRAPE_AGENT_API_KEY")
GOOGLE_API_KEY = env("GOOGLE_API_KEY")
OPENAI_API_KEY = env("OPENAI_API_KEY")
SCRAPE_LLM_MODEL = env("SCRAPE_LLM_MODEL", "google_genai/gemini-2.5-flash")
HOST = env("HOST", "0.0.0.0")
PORT = int(env("PORT", "8100") or "8100")
