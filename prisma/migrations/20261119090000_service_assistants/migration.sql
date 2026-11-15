-- One assistant per service. Each /ai-agents assistant is made for one service
-- (chat | voice | form | tour) and carries that service's behaviour; services link the
-- assistant that runs them via ServiceConfig.config.agentId. Additive only.

ALTER TYPE "WebServiceKind" ADD VALUE IF NOT EXISTS 'TOUR';

ALTER TABLE "LiveKitAgent" ADD COLUMN "service" VARCHAR(16);
ALTER TABLE "LiveKitAgent" ADD COLUMN "serviceSettings" JSONB NOT NULL DEFAULT '{}';

-- Services already set up keep running on the business's current agent. It stays a
-- "classic" assistant (service NULL), which any service may use.
UPDATE "ServiceConfig" AS sc
SET "config" = jsonb_set(COALESCE(sc."config", '{}'::jsonb), '{agentId}', to_jsonb(ba."agentId"::text))
FROM "Tenant" AS t
JOIN "BusinessAgent" AS ba ON ba."businessId" = t."businessId" AND ba."isPrimary" = true
WHERE t."id" = sc."workspaceId"
  AND NOT (COALESCE(sc."config", '{}'::jsonb) ? 'agentId');
