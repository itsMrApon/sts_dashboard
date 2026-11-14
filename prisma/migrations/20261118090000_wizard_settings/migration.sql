-- Playback options for each wizard profile (intro, auto-advance, pause, progress, talk button).
ALTER TABLE "VoiceWizard" ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}';
