-- CreateTable
CREATE TABLE "RoomEmbedConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomName" VARCHAR(255) NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "siteKeyHash" TEXT NOT NULL,
    "siteKeyPrefix" VARCHAR(32) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomEmbedConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomEmbedConfig_roomName_key" ON "RoomEmbedConfig"("roomName");

-- CreateIndex
CREATE INDEX "RoomEmbedConfig_userId_idx" ON "RoomEmbedConfig"("userId");

-- CreateIndex
CREATE INDEX "RoomEmbedConfig_tenantId_idx" ON "RoomEmbedConfig"("tenantId");
