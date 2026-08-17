-- Add optional workspace link on webinars (Workspace maps to Tenant table)
ALTER TABLE "Webinar" ADD COLUMN "workspaceId" UUID;

CREATE INDEX "Webinar_workspaceId_idx" ON "Webinar"("workspaceId");

ALTER TABLE "Webinar" ADD CONSTRAINT "Webinar_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from business product links
UPDATE "Webinar" w
SET "workspaceId" = t.id
FROM "BusinessProduct" bp
JOIN "Tenant" t ON t."businessId" = bp."businessId"
WHERE w.id = bp."webinarId"
  AND w."workspaceId" IS NULL;

-- Backfill from tenant.webinarId pointer
UPDATE "Webinar" w
SET "workspaceId" = t.id
FROM "Tenant" t
WHERE t."webinarId" = w.id
  AND w."workspaceId" IS NULL;
