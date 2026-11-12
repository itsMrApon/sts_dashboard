"""Builds the voice components for one room from its engine config.

Two engine modes:
  * pipeline: STT (hears) -> LLM (thinks) -> TTS (speaks), each provider chosen independently.
  * realtime: one speech-to-speech model (OpenAI Realtime, Gemini Live, Grok Voice).

Every provider key is read per room from tenant_env (then the worker's own .env), and passed
explicitly to each plugin, so concurrent rooms never share or leak each other's keys.
"""

from __future__ import annotations

import logging
import os

from livekit.agents import Agent
from livekit.plugins import deepgram, fishaudio, google, openai, silero, xai
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from .config import RoomConfig

logger = logging.getLogger(__name__)

# Process env captured at import, before anything can mutate os.environ.
_BASE_ENV = dict(os.environ)

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
}

_ALIASES = {"gemini": "google", "claude": "anthropic", "moonshot": "kimi", "grok": "xai",
            "fishaudio": "fish", "fish_audio": "fish"}


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
    for name in names:
        value = _BASE_ENV.get(name)
        if value and value.strip():
            return value.strip()
    raise ValueError(
        f"{PROVIDER_LABELS[provider]} selected but {names[0]} is missing. "
        "Save it on AI Agents -> Config, or set it in the worker .env."
    )


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
    provider = _norm(config.stt_provider, "deepgram")
    bangla = _is_bangla(config)

    if provider == "xai" and bangla:
        logger.warning("Grok STT has no Bangla; falling back to Deepgram for this room.")
        provider = "deepgram"

    if provider == "openai":
        return openai.STT(
            model=config.stt_model or "gpt-4o-transcribe",
            language="bn" if bangla else "en",
            api_key=_key(config, "openai"),
        )
    if provider == "google":
        kwargs: dict = {"language": "bn-BD" if bangla else "en-US", "api_key": _key(config, "google")}
        if config.stt_model:
            kwargs["model"] = config.stt_model
        return google.beta.GeminiSTT(**kwargs)
    if provider == "xai":
        return xai.STT(language="en", api_key=_key(config, "xai"))

    # Deepgram (default). Its model list has no Bangla; kept as-is for existing Bangla agents.
    return deepgram.STT(
        model=config.stt_model or ("nova-2-general" if bangla else "nova-2"),
        language="bn" if bangla else "en",
        api_key=_key(config, "deepgram"),
    )


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
    provider = _norm(config.voice_provider, "deepgram")
    voice = (config.voice_model or "").strip()
    style = (config.voice_style or "").strip()
    bangla = _is_bangla(config)

    if provider == "fish":
        kwargs: dict = {
            # s2.1-pro-free = $0 fair-use API tier; s1/s2.1-pro require prepaid balance (402 otherwise)
            "model": os.getenv("FISH_TTS_MODEL", "s2.1-pro-free"),
            "latency_mode": os.getenv("FISH_LATENCY_MODE", "balanced"),
            "api_key": _key(config, "fish"),
        }
        if voice:
            kwargs["voice_id"] = voice
        return fishaudio.TTS(**kwargs)
    if provider == "openai":
        kwargs = {"model": "gpt-4o-mini-tts", "voice": voice or "coral", "api_key": _key(config, "openai")}
        if style:
            kwargs["instructions"] = style
        return openai.TTS(**kwargs)
    if provider == "google":
        kwargs = {"model": "gemini-2.5-flash-tts", "voice_name": voice or "Kore", "api_key": _key(config, "google")}
        if style:
            kwargs["instructions"] = style
        return google.beta.GeminiTTS(**kwargs)
    if provider == "xai":
        return xai.TTS(voice=voice or "ara", language="bn" if bangla else "en", api_key=_key(config, "xai"))

    return deepgram.TTS(model=voice or "aura-asteria-en", api_key=_key(config, "deepgram"))


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
