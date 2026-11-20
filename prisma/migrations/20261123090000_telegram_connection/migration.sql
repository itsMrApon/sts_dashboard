-- CreateTable
CREATE TABLE "TelegramConnection" (
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "botTokenEnc" TEXT NOT NULL,
    "botUsername" VARCHAR(64) NOT NULL,
    "webhookSecret" VARCHAR(64) NOT NULL,
    "linkCode" VARCHAR(32) NOT NULL,
    "chatId" VARCHAR(32),
    "chatTitle" VARCHAR(255),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConnection_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConnection_webhookSecret_key" ON "TelegramConnection"("webhookSecret");

-- CreateIndex
CREATE INDEX "TelegramConnection_userId_idx" ON "TelegramConnection"("userId");

-- AddForeignKey
ALTER TABLE "TelegramConnection" ADD CONSTRAINT "TelegramConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
