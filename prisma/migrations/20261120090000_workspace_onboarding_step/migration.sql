-- Onboarding progress per workspace. NULL = finished (every existing workspace), otherwise the
-- setup step the creator is on: agent | tools | keys. Additive only.
ALTER TABLE "Tenant" ADD COLUMN "onboardingStep" VARCHAR(16);
