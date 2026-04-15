-- AlterTable
ALTER TABLE "MessageChannel" ADD COLUMN     "businessId" UUID;

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAgent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProduct" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL,
    "webinarId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Business_userId_idx" ON "Business"("userId");

-- CreateIndex
CREATE INDEX "BusinessAgent_businessId_idx" ON "BusinessAgent"("businessId");

-- CreateIndex
CREATE INDEX "BusinessAgent_agentId_idx" ON "BusinessAgent"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAgent_businessId_agentId_key" ON "BusinessAgent"("businessId", "agentId");

-- CreateIndex
CREATE INDEX "BusinessProduct_businessId_idx" ON "BusinessProduct"("businessId");

-- CreateIndex
CREATE INDEX "BusinessProduct_webinarId_idx" ON "BusinessProduct"("webinarId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProduct_businessId_webinarId_key" ON "BusinessProduct"("businessId", "webinarId");

-- CreateIndex
CREATE INDEX "MessageChannel_businessId_idx" ON "MessageChannel"("businessId");

-- AddForeignKey
ALTER TABLE "MessageChannel" ADD CONSTRAINT "MessageChannel_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAgent" ADD CONSTRAINT "BusinessAgent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAgent" ADD CONSTRAINT "BusinessAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "LiveKitAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProduct" ADD CONSTRAINT "BusinessProduct_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProduct" ADD CONSTRAINT "BusinessProduct_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
