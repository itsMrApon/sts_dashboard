-- Engine modes (pipeline/realtime), selectable STT, speaking style, realtime choice. Additive with defaults.
ALTER TABLE "AgentEngineSettings" ADD COLUMN IF NOT EXISTS "engineMode" VARCHAR(20) NOT NULL DEFAULT 'pipeline';
ALTER TABLE "AgentEngineSettings" ADD COLUMN IF NOT EXISTS "sttProvider" VARCHAR(50) NOT NULL DEFAULT 'deepgram';
ALTER TABLE "AgentEngineSettings" ADD COLUMN IF NOT EXISTS "sttModel" VARCHAR(100);
ALTER TABLE "AgentEngineSettings" ADD COLUMN IF NOT EXISTS "voiceStyle" VARCHAR(500);
ALTER TABLE "AgentEngineSettings" ADD COLUMN IF NOT EXISTS "realtimeProvider" VARCHAR(50) NOT NULL DEFAULT 'openai';
ALTER TABLE "AgentEngineSettings" ADD COLUMN IF NOT EXISTS "realtimeModel" VARCHAR(100) NOT NULL DEFAULT 'gpt-realtime';
ALTER TABLE "AgentEngineSettings" ADD COLUMN IF NOT EXISTS "realtimeVoice" VARCHAR(100) NOT NULL DEFAULT 'marin';

-- xAI (Grok) key: LLM, STT, TTS and Grok Voice realtime.
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "xaiApiKey" TEXT;
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "xaiValidatedAt" TIMESTAMP(3);
