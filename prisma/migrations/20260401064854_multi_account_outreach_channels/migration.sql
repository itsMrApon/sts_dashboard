/*
  Warnings:

  - Made the column `accountLabel` on table `OutreachChannel` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OutreachPlatform" ADD VALUE 'YOUTUBE';
ALTER TYPE "OutreachPlatform" ADD VALUE 'WEBSITE';

-- DropIndex
DROP INDEX "public"."OutreachChannel_userId_platform_key";

-- AlterTable
ALTER TABLE "OutreachChannel" ADD COLUMN     "pageUrl" VARCHAR(500),
ALTER COLUMN "accountLabel" SET NOT NULL;

-- CreateIndex
CREATE INDEX "OutreachChannel_userId_platform_idx" ON "OutreachChannel"("userId", "platform");
