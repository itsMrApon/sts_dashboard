-- Website chat history container (Chat AI / hosted page). Telegram/Discord/Slack bot code was removed;
-- their enum values and MessageChannel columns stay so existing rows remain readable.
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'WEB' BEFORE 'TELEGRAM';
