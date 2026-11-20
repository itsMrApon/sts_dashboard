-- CreateTable
CREATE TABLE "PhoneLine" (
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "twilioAccountSid" VARCHAR(64) NOT NULL,
    "twilioAuthTokenEnc" TEXT NOT NULL,
    "phoneNumber" VARCHAR(32) NOT NULL,
    "twilioNumberSid" VARCHAR(64) NOT NULL,
    "twilioTrunkSid" VARCHAR(64),
    "livekitInboundTrunkId" VARCHAR(64),
    "livekitDispatchRuleId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneLine_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE INDEX "PhoneLine_userId_idx" ON "PhoneLine"("userId");

-- AddForeignKey
ALTER TABLE "PhoneLine" ADD CONSTRAINT "PhoneLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
