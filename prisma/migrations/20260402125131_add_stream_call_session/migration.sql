-- CreateEnum
CREATE TYPE "StreamCallStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "StreamCallSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomName" VARCHAR(255) NOT NULL,
    "webinarId" UUID NOT NULL,
    "callId" VARCHAR(255) NOT NULL,
    "hostUserId" UUID NOT NULL,
    "attendeeUserId" VARCHAR(255) NOT NULL,
    "attendeeIdentity" VARCHAR(255) NOT NULL,
    "status" "StreamCallStatus" NOT NULL DEFAULT 'PENDING',
    "attendeeJoinedAt" TIMESTAMP(3),
    "creatorJoinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamCallSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamCallSession_callId_key" ON "StreamCallSession"("callId");

-- CreateIndex
CREATE INDEX "StreamCallSession_roomName_idx" ON "StreamCallSession"("roomName");

-- CreateIndex
CREATE INDEX "StreamCallSession_webinarId_idx" ON "StreamCallSession"("webinarId");
