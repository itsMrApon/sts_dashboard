-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TELEGRAM', 'DISCORD', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateTable
CREATE TABLE "MessageChannel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomName" VARCHAR(255) NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "ChannelStatus" NOT NULL DEFAULT 'INACTIVE',
    "telegramBotToken" TEXT,
    "telegramBotUsername" TEXT,
    "telegramWebhookSet" BOOLEAN NOT NULL DEFAULT false,
    "discordBotToken" TEXT,
    "discordPublicKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageConversation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channelId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageChannel_roomName_idx" ON "MessageChannel"("roomName");

-- CreateIndex
CREATE UNIQUE INDEX "MessageChannel_roomName_platform_key" ON "MessageChannel"("roomName", "platform");

-- CreateIndex
CREATE INDEX "MessageConversation_channelId_idx" ON "MessageConversation"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageConversation_channelId_externalId_key" ON "MessageConversation"("channelId", "externalId");

-- AddForeignKey
ALTER TABLE "MessageConversation" ADD CONSTRAINT "MessageConversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MessageChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
