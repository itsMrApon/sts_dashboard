-- CreateEnum
CREATE TYPE "WebinarKind" AS ENUM ('PROJECT', 'PRODUCT');

-- AlterTable
ALTER TABLE "Webinar" ADD COLUMN     "kind" "WebinarKind" NOT NULL DEFAULT 'PROJECT';
