import logging
import os

from livekit.agents import Agent
from livekit.plugins import deepgram, google, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from .config import RoomConfig

logger = logging.getLogger(__name__)

try:
    from livekit.plugins import fishaudio
except ImportError:  # pragma: no cover - optional until dependency installed
    fishaudio = None  # type: ignore[assignment]


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


def _create_tts(config: RoomConfig):
    voice_provider = (getattr(config, "voice_provider", None) or "deepgram").lower()
    if voice_provider in ("fish", "fishaudio", "fish_audio"):
        if fishaudio is None:
            raise ValueError(
                "Fish Audio TTS selected but livekit-plugins-fishaudio is not installed."
            )
        reference_id = (config.voice_model or "").strip()
        tts_kwargs: dict = {
            # s2.1-pro-free = $0 fair-use API tier; s1/s2.1-pro require prepaid balance (402 otherwise)
            "model": os.getenv("FISH_TTS_MODEL", "s2.1-pro-free"),
            "latency_mode": os.getenv("FISH_LATENCY_MODE", "balanced"),
        }
        if reference_id:
            tts_kwargs["reference_id"] = reference_id
        return fishaudio.TTS(**tts_kwargs)
    return deepgram.TTS(model=config.voice_model)


def _create_llm(config: RoomConfig):
    llm_model = getattr(config, "llm_model", os.getenv("LLM_CHOICE", "gemini-2.5-flash"))
    llm_provider = (getattr(config, "llm_provider", "google") or "google").lower()

    if llm_provider in ("google", "gemini"):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "Google Gemini selected but GOOGLE_API_KEY is missing. "
                "Save it in Config Agent, or ensure SAAS_API_URL is reachable so tenant keys load."
            )
        return google.LLM(
            model=llm_model,
            api_key=api_key,
            temperature=0.7,
        )

    if llm_provider == "deepseek":
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError(
                "DeepSeek selected but DEEPSEEK_API_KEY is missing in tenant credentials."
            )
        return openai.LLM(
            model=llm_model,
            api_key=api_key,
            base_url="https://api.deepseek.com",
        )

    if llm_provider in ("kimi", "moonshot"):
        api_key = os.getenv("MOONSHOT_API_KEY") or os.getenv("KIMI_API_KEY")
        if not api_key:
            raise ValueError(
                "Kimi selected but MOONSHOT_API_KEY is missing in tenant credentials."
            )
        return openai.LLM(
            model=llm_model,
            api_key=api_key,
            base_url="https://api.moonshot.ai/v1",
        )

    if llm_provider == "openai":
        raise ValueError("OpenAI provider is not enabled yet. Select Google Gemini, DeepSeek, or Kimi.")
    if llm_provider in ("anthropic", "claude"):
        raise ValueError("Claude provider is not enabled yet. Select Google Gemini, DeepSeek, or Kimi.")

    raise ValueError(f"Unsupported llm_provider: {llm_provider}")


def create_voice_pipeline(config: RoomConfig) -> dict:
    """Create STT, LLM, TTS, VAD, and turn detection components based on config."""
    _apply_tenant_env(config)

    tts = _create_tts(config)

    # Speech-to-Text stays Deepgram regardless of TTS provider.
    stt_lang = "en" if config.language == "en" else "bn"
    if config.language == "bn":
        stt_model = "nova-2-general"  # Placeholder for Bangla model
    else:
        stt_model = "nova-2"

    stt = deepgram.STT(
        model=stt_model,
        language=stt_lang,
    )

    llm = _create_llm(config)

    vad = silero.VAD.load()
    turn_detection = MultilingualModel()

    return {
        "stt": stt,
        "llm": llm,
        "tts": tts,
        "vad": vad,
        "turn_detection": turn_detection,
    }
