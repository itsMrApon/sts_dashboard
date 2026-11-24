-- A creator's own WhatsApp number through Kapso, and handled webhook deliveries (dedupe).
-- CreateTable
CREATE TABLE "WhatsAppConnection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "provider" VARCHAR(16) NOT NULL DEFAULT 'kapso',
    "apiKeyEnc" TEXT NOT NULL,
    "phoneNumberId" VARCHAR(64) NOT NULL,
    "webhookSecretEnc" TEXT NOT NULL,
    "webhookTokenEnc" TEXT NOT NULL,
    "webhookTokenHash" VARCHAR(64) NOT NULL,
    "displayPhone" VARCHAR(32),
    "aiReplies" BOOLEAN NOT NULL DEFAULT true,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "key" VARCHAR(200) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_userId_key" ON "WhatsAppConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_webhookTokenHash_key" ON "WhatsAppConnection"("webhookTokenHash");

-- CreateIndex
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "WhatsAppConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

