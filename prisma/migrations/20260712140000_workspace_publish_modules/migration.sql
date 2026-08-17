-- Add outbound publish module flags on Workspace (Tenant table).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "publishModulesJson" JSONB;
