-- CreateEnum
CREATE TYPE "ContextStatusEnum" AS ENUM ('DRAFT', 'PUBLISHED', 'STALE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "compactProfileJson" JSONB,
ADD COLUMN     "compactTokenEstimate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contextCoreJson" JSONB,
ADD COLUMN     "contextIndustryJson" JSONB,
ADD COLUMN     "contextSocialJson" JSONB,
ADD COLUMN     "contextStatus" "ContextStatusEnum" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "contextVersion" VARCHAR(100),
ADD COLUMN     "contextVertical" VARCHAR(100),
ADD COLUMN     "fullProfileJson" JSONB,
ADD COLUMN     "publishedAt" TIMESTAMP(3);
