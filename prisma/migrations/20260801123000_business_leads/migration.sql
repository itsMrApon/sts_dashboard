-- AlterTable
ALTER TABLE "CallIntelLead" ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'MEETING';
ALTER TABLE "CallIntelLead" ADD COLUMN "phone" VARCHAR(50);
ALTER TABLE "CallIntelLead" ADD COLUMN "website" VARCHAR(500);
ALTER TABLE "CallIntelLead" ADD COLUMN "address" VARCHAR(500);
ALTER TABLE "CallIntelLead" ADD COLUMN "placeId" VARCHAR(100);

-- AlterTable
ALTER TABLE "CallIntelSettings" ADD COLUMN "businessLocation" VARCHAR(255);
ALTER TABLE "CallIntelSettings" ADD COLUMN "businessNiche" VARCHAR(255);

-- CreateIndex
CREATE INDEX "CallIntelLead_userId_source_idx" ON "CallIntelLead"("userId", "source");

-- CreateIndex
CREATE INDEX "CallIntelLead_userId_placeId_idx" ON "CallIntelLead"("userId", "placeId");
