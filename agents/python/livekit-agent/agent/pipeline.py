import logging
import os

from livekit.agents import Agent
from livekit.plugins import deepgram, google, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from .config import RoomConfig

logger = logging.getLogger(__name__)

def _apply_tenant_env(config: RoomConfig) -> None:
    tenant_env = getattr(config, "tenant_env", {}) or {}
    for key, value in tenant_env.items():
        if isinstance(value, str) and value:
            os.environ[key] = value


class SaasAssistant(Agent):
    def __init__(self, config: RoomConfig, pipeline_components: dict):
        super().__init__(
            instructions=config.instructions,
            vad=pipeline_components["vad"],
            stt=pipeline_components["stt"],
            llm=pipeline_components["llm"],
            tts=pipeline_components["tts"],
            turn_detection=pipeline_components["turn_detection"],
        )
        self.name = config.room_name
        self.config = config

    async def get_tools(self, context) -> list:  # noqa: ARG002
        """Return tools available to the LLM.

        Static tools can be added here; dynamic MCP tools are handled via AgentSession.mcp_servers.
        """

        return []


def create_voice_pipeline(config: RoomConfig) -> dict:
    """Create STT, LLM, TTS, VAD, and turn detection components based on config."""
    _apply_tenant_env(config)

    # Text-to-Speech (Deepgram)
    tts = deepgram.TTS(model=config.voice_model)

    # Speech-to-Text (Deepgram)
    stt_lang = "en" if config.language == "en" else "bn"
    if config.language == "bn":
        stt_model = "nova-2-general"  # Placeholder for Bangla model
    else:
        stt_model = "nova-2"

    stt = deepgram.STT(
        model=stt_model,
        language=stt_lang,
    )

    # LLM (from config: Google Gemini or other)
    llm_model = getattr(config, "llm_model", os.getenv("LLM_CHOICE", "gemini-2.5-flash"))
    llm_provider = getattr(config, "llm_provider", "google")
    if llm_provider in ("google", "gemini"):
        llm = google.LLM(
            model=llm_model,
            temperature=0.7,
        )
    elif llm_provider == "openai":
        raise ValueError("OpenAI provider is not enabled yet. Select Google Gemini.")
    elif llm_provider in ("anthropic", "claude"):
        raise ValueError("Claude provider is not enabled yet. Select Google Gemini.")
    else:
        raise ValueError(f"Unsupported llm_provider: {llm_provider}")

    # Voice Activity Detection
    vad = silero.VAD.load()

    # Turn Detection
    turn_detection = MultilingualModel()

    return {
        "stt": stt,
        "llm": llm,
        "tts": tts,
        "vad": vad,
        "turn_detection": turn_detection,
    }

