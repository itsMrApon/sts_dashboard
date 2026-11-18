-- Creator-owned Cartesia and ElevenLabs keys (encrypted at rest, like the other provider keys).
ALTER TABLE "UserVoiceCredential" ADD COLUMN "cartesiaApiKey" TEXT;
ALTER TABLE "UserVoiceCredential" ADD COLUMN "elevenlabsApiKey" TEXT;
ALTER TABLE "UserVoiceCredential" ADD COLUMN "cartesiaValidatedAt" TIMESTAMP(3);
ALTER TABLE "UserVoiceCredential" ADD COLUMN "elevenlabsValidatedAt" TIMESTAMP(3);

-- Cartesia Sonic is the default voice for new rows. Existing rows keep the voice they have.
ALTER TABLE "LiveKitAgent" ALTER COLUMN "voiceProvider" SET DEFAULT 'cartesia';
ALTER TABLE "LiveKitAgent" ALTER COLUMN "voiceModel" SET DEFAULT 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4';
ALTER TABLE "AgentEngineSettings" ALTER COLUMN "voiceProvider" SET DEFAULT 'cartesia';
ALTER TABLE "AgentEngineSettings" ALTER COLUMN "voiceModel" SET DEFAULT 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4';

-- Cartesia Ink is the default speech-to-text, and tours narrate with a Cartesia voice.
ALTER TABLE "AgentEngineSettings" ALTER COLUMN "sttProvider" SET DEFAULT 'cartesia';
ALTER TABLE "VoiceWizard" ALTER COLUMN "voice" SET DEFAULT 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4';
