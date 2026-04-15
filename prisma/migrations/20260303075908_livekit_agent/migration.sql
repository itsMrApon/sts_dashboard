-- CreateTable
CREATE TABLE "LiveKitAgent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "roomName" VARCHAR(255) NOT NULL,
    "firstMessage" TEXT,
    "systemPrompt" TEXT,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "voiceModel" VARCHAR(100) NOT NULL DEFAULT 'aura-asteria-en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveKitAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveKitAgent_roomName_key" ON "LiveKitAgent"("roomName");

-- CreateIndex
CREATE INDEX "LiveKitAgent_roomName_idx" ON "LiveKitAgent"("roomName");

-- CreateIndex
CREATE INDEX "LiveKitAgent_createdAt_idx" ON "LiveKitAgent"("createdAt");
