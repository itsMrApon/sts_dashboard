"""Builds the voice components for one room from its engine config.

Two engine modes:
  * pipeline: STT (hears) -> LLM (thinks) -> TTS (speaks), each provider chosen independently.
  * realtime: one speech-to-speech model (OpenAI Realtime, Gemini Live, Grok Voice).

Every provider key is read per room from tenant_env only (the creator's own keys from
AI Agents -> Config) and passed explicitly to each plugin, so concurrent rooms never share or
leak each other's keys. The worker's own env is never used as a fallback: platform keys must
not pay for creators' calls.
"""

from __future__ import annotations

import logging
import os

from livekit.agents import Agent
from livekit.plugins import cartesia, deepgram, elevenlabs, fishaudio, google, openai, silero, xai
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from .config import RoomConfig

logger = logging.getLogger(__name__)


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

KEY_NAMES: dict[str, tuple[str, ...]] = {
    "google": ("GOOGLE_API_KEY",),
    "openai": ("OPENAI_API_KEY",),
    "anthropic": ("ANTHROPIC_API_KEY",),
    "openrouter": ("OPENROUTER_API_KEY",),
    "deepseek": ("DEEPSEEK_API_KEY",),
    "kimi": ("MOONSHOT_API_KEY", "KIMI_API_KEY"),
    "xai": ("XAI_API_KEY",),
    "deepgram": ("DEEPGRAM_API_KEY",),
    "fish": ("FISH_API_KEY",),
    "cartesia": ("CARTESIA_API_KEY",),
    "elevenlabs": ("ELEVENLABS_API_KEY", "ELEVEN_API_KEY"),
}

PROVIDER_LABELS = {
    "google": "Google Gemini",
    "openai": "OpenAI",
    "anthropic": "Claude",
    "openrouter": "OpenRouter",
    "deepseek": "DeepSeek",
    "kimi": "Kimi",
    "xai": "xAI Grok",
    "deepgram": "Deepgram",
    "fish": "Fish Audio",
    "cartesia": "Cartesia",
    "elevenlabs": "ElevenLabs",
}

_ALIASES = {"gemini": "google", "claude": "anthropic", "moonshot": "kimi", "grok": "xai",
            "fishaudio": "fish", "fish_audio": "fish", "eleven": "elevenlabs", "eleven_labs": "elevenlabs"}

# Default voices when the room names none. Cartesia's are from its public library (sonic-3).
DEFAULT_TTS_PROVIDER = "cartesia"
DEFAULT_STT_PROVIDER = "cartesia"
CARTESIA_MODEL = os.getenv("CARTESIA_TTS_MODEL", "sonic-3")
CARTESIA_DEFAULT_VOICE_EN = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"  # Skylar - Friendly Guide (US)
CARTESIA_DEFAULT_VOICE_BN = "9c35520a-73f9-4c9e-b6c6-69027a3819bd"  # Poulomi - Courteous Dispatcher
# Flash is ElevenLabs' low-latency model; v3 conversational covers Bangla.
ELEVENLABS_MODEL_EN = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
ELEVENLABS_MODEL_BN = os.getenv("ELEVENLABS_TTS_MODEL_BN", "eleven_v3_conversational")
ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel (premade)


def _norm(provider: str | None, default: str) -> str:
    value = (provider or default).strip().lower()
    return _ALIASES.get(value, value)


def _key(config: RoomConfig, provider: str) -> str:
    names = KEY_NAMES[provider]
    tenant_env = getattr(config, "tenant_env", {}) or {}
    for name in names:
        value = tenant_env.get(name)
        if isinstance(value, str) and value.strip():
            return value.strip()
    raise ValueError(
        f"{PROVIDER_LABELS[provider]} selected but the creator has no {PROVIDER_LABELS[provider]} key. "
        "They need to add it in AI Agents -> Config."
    )


def _has_key(config: RoomConfig, provider: str) -> bool:
    tenant_env = getattr(config, "tenant_env", {}) or {}
    return any(isinstance(tenant_env.get(name), str) and tenant_env[name].strip() for name in KEY_NAMES[provider])


def _is_bangla(config: RoomConfig) -> bool:
    return (config.language or "en").lower().startswith("bn")


class SaasAssistant(Agent):
    """Instructions only; STT/LLM/TTS (or the realtime model) live on the AgentSession."""

    def __init__(self, config: RoomConfig, pipeline_components: dict):  # noqa: ARG002
        super().__init__(instructions=_instructions_for(config))
        self.config = config


def _instructions_for(config: RoomConfig) -> str:
    instructions = config.instructions
    style = (config.voice_style or "").strip()
    # Realtime models have no separate TTS, so the speaking style rides on the instructions.
    if style and _norm(config.engine_mode, "pipeline") == "realtime":
        instructions = f"{instructions}\n\nSpeaking style: {style}"
    return instructions


# --- Hears -----------------------------------------------------------------


def _create_stt(config: RoomConfig):
    requested = _norm(config.stt_provider, DEFAULT_STT_PROVIDER)
    provider = requested
    bangla = _is_bangla(config)

    if provider in ("xai", "deepgram") and bangla and _has_key(config, "cartesia"):
        # Neither has Bangla STT; Cartesia Ink-Whisper does, on the creator's Cartesia key.
        logger.warning("%s STT has no Bangla; using Cartesia for this room.", PROVIDER_LABELS[provider])
        provider = "cartesia"

    if provider == "cartesia":
        # The plugin picks ink-2 (turn-detecting) for English and ink-whisper for other languages.
        kwargs: dict = {"language": "bn" if bangla else "en", "api_key": _key(config, "cartesia")}
        # Another provider's model id (rerouted room) would be rejected by Cartesia.
        if config.stt_model and requested == "cartesia":
            kwargs["model"] = config.stt_model
        return cartesia.STT(**kwargs)

    if provider == "openai":
        return openai.STT(
            model=config.stt_model or "gpt-4o-transcribe",
            language="bn" if bangla else "en",
            api_key=_key(config, "openai"),
        )
    if provider == "google":
        kwargs = {"language": "bn-BD" if bangla else "en-US", "api_key": _key(config, "google")}
        if config.stt_model:
            kwargs["model"] = config.stt_model
        return google.beta.GeminiSTT(**kwargs)
    if provider == "xai":
        return xai.STT(language="en", api_key=_key(config, "xai"))

    if provider == "deepgram":
        # Optional. Its model list has no Bangla; Bangla rooms move to Cartesia when a key exists.
        return deepgram.STT(
            model=config.stt_model or ("nova-2-general" if bangla else "nova-2"),
            language="bn" if bangla else "en",
            api_key=_key(config, "deepgram"),
        )

    raise ValueError(f"Unsupported stt_provider: {provider}")


# --- Thinks ----------------------------------------------------------------


def _create_llm(config: RoomConfig):
    model = config.llm_model or os.getenv("LLM_CHOICE", "gemini-2.5-flash")
    provider = _norm(config.llm_provider, "google")

    if provider == "google":
        return google.LLM(model=model, api_key=_key(config, "google"), temperature=0.7)
    if provider == "openai":
        return openai.LLM(model=model, api_key=_key(config, "openai"))
    if provider == "openrouter":
        return openai.LLM(model=model, api_key=_key(config, "openrouter"), base_url=OPENROUTER_BASE_URL)
    if provider == "deepseek":
        return openai.LLM(model=model, api_key=_key(config, "deepseek"), base_url="https://api.deepseek.com")
    if provider == "kimi":
        return openai.LLM(model=model, api_key=_key(config, "kimi"), base_url="https://api.moonshot.ai/v1")
    if provider == "xai":
        return xai.responses.LLM(model=model, api_key=_key(config, "xai"))
    if provider == "anthropic":
        from livekit.plugins import anthropic

        # No temperature: current Claude models reject sampling parameters.
        return anthropic.LLM(model=model, api_key=_key(config, "anthropic"))

    raise ValueError(f"Unsupported llm_provider: {provider}")


# --- Speaks ----------------------------------------------------------------


def _create_tts(config: RoomConfig):
    provider = _norm(config.voice_provider, DEFAULT_TTS_PROVIDER)
    voice = (config.voice_model or "").strip()
    style = (config.voice_style or "").strip()
    bangla = _is_bangla(config)
    # Clamp: some providers reject extreme values; 1.0 means "leave the provider default".
    speed = min(max(float(config.speaking_speed or 1.0), 0.7), 1.3)
    custom_speed = abs(speed - 1.0) > 1e-6

    if provider == "cartesia":
        # The account engine is shared by English and Bangla agents: the English default voice
        # on a Bangla agent means "no voice picked", so it gets the native Bangla default.
        if not voice or (bangla and voice == CARTESIA_DEFAULT_VOICE_EN):
            voice = CARTESIA_DEFAULT_VOICE_BN if bangla else CARTESIA_DEFAULT_VOICE_EN
        kwargs: dict = {
            "model": CARTESIA_MODEL,
            "voice": voice,
            "language": "bn" if bangla else "en",
            # Sonic word timestamps cover en/de/es/fr only; other languages just log a warning.
            "word_timestamps": not bangla,
            "api_key": _key(config, "cartesia"),
        }
        if custom_speed:
            kwargs["speed"] = speed
        return cartesia.TTS(**kwargs)
    if provider == "elevenlabs":
        kwargs = {
            "model": ELEVENLABS_MODEL_BN if bangla else ELEVENLABS_MODEL_EN,
            "voice_id": voice or ELEVENLABS_DEFAULT_VOICE,
            "language": "bn" if bangla else "en",
            "api_key": _key(config, "elevenlabs"),
        }
        if custom_speed:
            kwargs["voice_settings"] = elevenlabs.VoiceSettings(
                stability=0.5, similarity_boost=0.75, speed=min(max(speed, 0.8), 1.2)
            )
        return elevenlabs.TTS(**kwargs)
    if provider == "fish":
        kwargs = {
            # s2.1-pro-free = $0 fair-use API tier; s1/s2.1-pro require prepaid balance (402 otherwise)
            "model": os.getenv("FISH_TTS_MODEL", "s2.1-pro-free"),
            "latency_mode": os.getenv("FISH_LATENCY_MODE", "balanced"),
            "api_key": _key(config, "fish"),
        }
        if voice:
            kwargs["voice_id"] = voice
        if custom_speed:
            kwargs["speed"] = speed
        return fishaudio.TTS(**kwargs)
    if provider == "openai":
        kwargs = {"model": "gpt-4o-mini-tts", "voice": voice or "coral", "api_key": _key(config, "openai")}
        if custom_speed:
            kwargs["speed"] = speed
        if style:
            kwargs["instructions"] = style
        return openai.TTS(**kwargs)
    if provider == "google":
        kwargs = {"model": "gemini-2.5-flash-tts", "voice_name": voice or "Kore", "api_key": _key(config, "google")}
        # Gemini TTS has no speed setting; ask for the pace in its style instructions instead.
        pace = ("Speak at a slightly slower pace." if speed < 1 else "Speak at a slightly faster pace.") if custom_speed else ""
        if style or pace:
            kwargs["instructions"] = " ".join(part for part in (style, pace) if part)
        return google.beta.GeminiTTS(**kwargs)
    if provider == "xai":
        return xai.TTS(voice=voice or "ara", language="bn" if bangla else "en", api_key=_key(config, "xai"))

    if provider == "deepgram":
        if custom_speed:
            return deepgram.TTS(model=voice or "aura-asteria-en", api_key=_key(config, "deepgram"), speed=speed)
        return deepgram.TTS(model=voice or "aura-asteria-en", api_key=_key(config, "deepgram"))

    raise ValueError(f"Unsupported voice_provider: {provider}")


# --- Realtime ----------------------------------------------------------------


def _create_realtime(config: RoomConfig):
    provider = _norm(config.realtime_provider, "openai")
    model = (config.realtime_model or "").strip()
    voice = (config.realtime_voice or "").strip()

    if provider == "openai":
        kwargs: dict = {"api_key": _key(config, "openai")}
        if model:
            kwargs["model"] = model
        if voice:
            kwargs["voice"] = voice
        return openai.realtime.RealtimeModel(**kwargs)
    if provider == "google":
        kwargs = {"api_key": _key(config, "google")}
        if model:
            kwargs["model"] = model
        if voice:
            kwargs["voice"] = voice
        return google.realtime.RealtimeModel(**kwargs)
    if provider == "xai":
        kwargs = {"api_key": _key(config, "xai")}
        if model:
            kwargs["model"] = model
        if voice:
            kwargs["voice"] = voice
        return xai.realtime.RealtimeModel(**kwargs)

    raise ValueError(f"Unsupported realtime_provider: {provider}")


def create_voice_pipeline(config: RoomConfig) -> dict:
    """Build components for the room's engine mode. Realtime has no separate STT/TTS."""
    vad = silero.VAD.load()

    if _norm(config.engine_mode, "pipeline") == "realtime":
        return {
            "mode": "realtime",
            "stt": None,
            "llm": _create_realtime(config),
            "tts": None,
            "vad": vad,
            # Realtime models do their own server-side turn detection.
            "turn_detection": None,
        }

    return {
        "mode": "pipeline",
        "stt": _create_stt(config),
        "llm": _create_llm(config),
        "tts": _create_tts(config),
        "vad": vad,
        "turn_detection": MultilingualModel(),
    }
