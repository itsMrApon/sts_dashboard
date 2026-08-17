import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import (
    AgentSession,
    JobContext,
    JobProcess,
    RoomOutputOptions,
    RunContext,
    WorkerOptions,
    cli,
    mcp,
)
from livekit.agents.llm import function_tool

from .config import get_mcp_server_config, load_room_config, RoomConfig
from .pipeline import SaasAssistant, create_voice_pipeline
from .tools import AgentTools

_project_root = Path(__file__).resolve().parent.parent
_repo_root = Path(__file__).resolve().parents[4]
# Same as config.py: worker .env then repo root .env (so GOOGLE_API_KEY can live only in sts-ai/.env).
load_dotenv(_project_root / ".env")
load_dotenv(_repo_root / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TranscriptLogger:
    """Collects speech segments during a session and POSTs them on disconnect."""

    def __init__(self, config: RoomConfig):
        self.config = config
        self.segments: list[dict] = []
        self._start_time = time.monotonic()

    def on_user_speech(self, text: str) -> None:
        self.segments.append({
            "role": "user",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def on_agent_speech(self, text: str) -> None:
        self.segments.append({
            "role": "agent",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def save(self) -> None:
        if not self.segments:
            logger.info("No transcript segments to save.")
            return

        if not self.config.transcript_ingest_url or not self.config.user_id:
            logger.warning(
                "Transcript logging skipped: missing ingest URL (%s) or user_id (%s)",
                self.config.transcript_ingest_url,
                self.config.user_id,
            )
            return

        duration = int(time.monotonic() - self._start_time)

        payload = {
            "userId": self.config.user_id,
            "roomName": self.config.room_name,
            "transcript": self.segments,
            "duration": duration,
        }

        try:
            import urllib.request
            import urllib.error

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.config.transcript_ingest_url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.config.transcript_api_key or "",
                },
                method="POST",
            )

            import asyncio

            def _post():
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return resp.read()

            resp_data = await asyncio.to_thread(_post)
            logger.info("Transcript saved: %s", resp_data.decode())
        except Exception as exc:
            logger.error("Failed to save transcript: %s", exc)


class UsageReporter:
    """Posts LLM / STT / TTS usage for Config Agent after a voice session."""

    def __init__(self, config: RoomConfig):
        self.config = config
        self._start_time = time.monotonic()
        self._agent_chars = 0
        self._collector = None
        try:
            from livekit.agents import metrics

            self._collector = metrics.UsageCollector()
        except Exception:
            logger.info("LiveKit UsageCollector unavailable; will estimate voice usage.")

    def collect(self, event) -> None:
        if not self._collector:
            return
        payload = getattr(event, "metrics", event)
        try:
            self._collector.collect(payload)
        except Exception as exc:
            logger.debug("Usage collect skipped: %s", exc)

    def add_agent_speech(self, text: str) -> None:
        self._agent_chars += len(text or "")

    async def save(self) -> None:
        ingest_url = getattr(self.config, "usage_ingest_url", None)
        if not ingest_url or not self.config.user_id:
            return

        summary = None
        if self._collector:
            try:
                summary = self._collector.get_summary()
            except Exception as exc:
                logger.debug("Usage summary unavailable: %s", exc)

        llm_in = int(getattr(summary, "llm_prompt_tokens", 0) or 0)
        llm_out = int(getattr(summary, "llm_completion_tokens", 0) or 0)
        tts_chars = int(getattr(summary, "tts_characters_count", 0) or 0)
        stt_seconds = float(getattr(summary, "stt_audio_duration", 0) or 0)
        duration_ms = int((time.monotonic() - self._start_time) * 1000)

        if tts_chars <= 0:
            tts_chars = self._agent_chars
        stt_ms = int(stt_seconds * 1000) if stt_seconds > 0 else duration_ms

        voice_provider = (getattr(self.config, "voice_provider", None) or "deepgram").lower()
        tts_provider = "fish" if voice_provider in ("fish", "fishaudio", "fish_audio") else "deepgram"

        payload = {
            "userId": self.config.user_id,
            "surface": getattr(self.config, "usage_surface", None) or "messages",
            "llmProvider": getattr(self.config, "llm_provider", None) or "google",
            "sttProvider": "deepgram",
            "ttsProvider": tts_provider,
            "llmInputTokens": llm_in,
            "llmOutputTokens": llm_out,
            "llmRequests": 1 if (llm_in or llm_out) else 0,
            "sttAudioMs": stt_ms,
            "sttRequests": 1 if stt_ms else 0,
            "ttsCharacters": tts_chars,
            "ttsRequests": 1 if tts_chars else 0,
            "sessionAudioMs": duration_ms,
        }

        try:
            import urllib.request

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                ingest_url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.config.transcript_api_key or "",
                },
                method="POST",
            )

            def _post():
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return resp.read()

            resp_data = await asyncio.to_thread(_post)
            logger.info("Usage saved: %s", resp_data.decode())
        except Exception as exc:
            logger.error("Failed to save usage: %s", exc)


def prewarm(proc: JobProcess):
    """Pre-load global resources (can exceed default 10s on cold start)."""
    from livekit.plugins import silero

    logger.info("Prewarming Silero VAD…")
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("Silero VAD ready")


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the SaaS agent."""
    try:
        room_name = ctx.room.name
        logger.info(f"Starting agent for room: {room_name}")

        # Connect before any slow work (e.g. SaaS config HTTP). Otherwise
        # `load_room_config` can block for its full timeout and LiveKit warns:
        # "room connection was not established within 10 seconds after job_entry"
        # because `connect()` normally runs inside `session.start()`.
        await ctx.connect()

        config = await load_room_config(room_name)
        logger.info(
            "Loaded config for %s (Language: %s)",
            config.business_type,
            config.language,
        )

        pipeline_components = create_voice_pipeline(config)
        # Prefer VAD loaded in prewarm so job start does not reload the model.
        prewarmed_vad = ctx.proc.userdata.get("vad")
        if prewarmed_vad is not None:
            pipeline_components["vad"] = prewarmed_vad

        mcp_servers: list[mcp.MCPServerStdio] = []

        import subprocess

        is_docker_running = False
        try:
            subprocess.run(
                ["docker", "info"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
                timeout=2,
            )
            is_docker_running = True
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            logger.warning("Docker is not running. MCP servers will be disabled.")

        if is_docker_running:
            for server_name in config.enabled_mcp_servers:
                server_conf = get_mcp_server_config(server_name, config.tenant_env)
                if server_conf:
                    logger.info("Enabling MCP Server: %s", server_conf.name)
                    mcp_servers.append(
                        mcp.MCPServerStdio(
                            command="docker",
                            args=server_conf.args,
                            env=server_conf.env,
                        )
                    )

        session = AgentSession(
            stt=pipeline_components["stt"],
            llm=pipeline_components["llm"],
            tts=pipeline_components["tts"],
            vad=pipeline_components["vad"],
            turn_detection=pipeline_components["turn_detection"],
            mcp_servers=mcp_servers,
        )

        transcript_logger = TranscriptLogger(config)
        usage_reporter = UsageReporter(config)

        class ConfiguredAssistant(SaasAssistant):
            def __init__(self, config, pipeline_components):
                super().__init__(config, pipeline_components)

            @function_tool
            async def get_current_date_and_time(self, context: RunContext) -> str:
                return await AgentTools().get_current_date_and_time(context)

        assistant = ConfiguredAssistant(config, pipeline_components)

        @session.on("user_speech_committed")
        def _on_user_speech(ev):
            text = getattr(ev, "text", None) or getattr(ev, "content", None) or str(ev)
            if text:
                transcript_logger.on_user_speech(text)
                logger.debug("User said: %s", text[:80])

        @session.on("agent_speech_committed")
        def _on_agent_speech(ev):
            text = getattr(ev, "text", None) or getattr(ev, "content", None) or str(ev)
            if text:
                transcript_logger.on_agent_speech(text)
                usage_reporter.add_agent_speech(text)
                logger.debug("Agent said: %s", text[:80])

        @session.on("metrics_collected")
        def _on_metrics(ev):
            usage_reporter.collect(ev)

        def _on_disconnect(*_args):
            logger.info(
                "Room disconnected — saving transcript (%d segments)",
                len(transcript_logger.segments),
            )
            # livekit rtc EventEmitter requires synchronous callbacks.
            asyncio.create_task(transcript_logger.save())
            asyncio.create_task(usage_reporter.save())

        ctx.room.on("disconnected", _on_disconnect)

        await session.start(
            room=ctx.room,
            agent=assistant,
            room_output_options=RoomOutputOptions(
                transcription_enabled=True,
                audio_enabled=True,
            ),
        )

        if getattr(config, "first_message", None):
            await session.generate_reply(instructions=config.first_message)
        else:
            await session.generate_reply(
                instructions=(
                    f"Greet the user warmly in {config.language} (if applicable) and "
                    f"introduce yourself as their assistant for {config.business_type}."
                )
            )
    except Exception as e:
        logger.exception("Agent failed to start or join room: %s", e)
        raise


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="saas-agent",
            # Keep one warm job process so the first call does not wait on Silero load
            # before ctx.connect() — client "Agent did not join" fires at ~20s by default.
            num_idle_processes=1,
            # Silero / plugin imports often exceed the default 10s on first spawn.
            initialize_process_timeout=60.0,
        )
    )
