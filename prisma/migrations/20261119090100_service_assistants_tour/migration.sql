-- Business tours that already exist keep running on the business's current (classic) agent.
-- Separate migration: a new enum value can't be used in the transaction that added it.
INSERT INTO "ServiceConfig" ("workspaceId", "kind", "enabled", "config", "updatedAt")
SELECT t."id", 'TOUR'::"WebServiceKind", false, jsonb_build_object('agentId', ba."agentId"::text), now()
FROM "Tenant" AS t
JOIN "BusinessAgent" AS ba ON ba."businessId" = t."businessId" AND ba."isPrimary" = true
WHERE EXISTS (SELECT 1 FROM "VoiceWizard" AS vw WHERE vw."userId" = t."userId" AND vw."webinarId" IS NULL)
ON CONFLICT ("workspaceId", "kind") DO NOTHING;
