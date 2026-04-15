-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Platform" ADD VALUE 'YOUTUBE';
ALTER TYPE "Platform" ADD VALUE 'FACEBOOK_MESSENGER';
ALTER TYPE "Platform" ADD VALUE 'INSTAGRAM';
ALTER TYPE "Platform" ADD VALUE 'TIKTOK';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "channels" TEXT[];

-- AlterTable
ALTER TABLE "MessageChannel" ADD COLUMN     "accountLabel" VARCHAR(255),
ADD COLUMN     "credentials" JSONB,
ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE INDEX "MessageChannel_userId_idx" ON "MessageChannel"("userId");
