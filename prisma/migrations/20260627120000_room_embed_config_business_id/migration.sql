-- AlterTable
ALTER TABLE "RoomEmbedConfig" ADD COLUMN "businessId" UUID;

-- CreateIndex
CREATE INDEX "RoomEmbedConfig_businessId_idx" ON "RoomEmbedConfig"("businessId");

-- Backfill businessId from message channels on the same room
UPDATE "RoomEmbedConfig" AS rec
SET "businessId" = mc."businessId"
FROM "MessageChannel" AS mc
WHERE mc."roomName" = rec."roomName"
  AND mc."businessId" IS NOT NULL
  AND rec."businessId" IS NULL;
