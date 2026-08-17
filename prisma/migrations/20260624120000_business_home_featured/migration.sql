-- AlterTable
ALTER TABLE "Business" ADD COLUMN "isHomeFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Business_userId_isHomeFeatured_idx" ON "Business"("userId", "isHomeFeatured");
