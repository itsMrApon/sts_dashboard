-- CreateTable
CREATE TABLE "TenantInboundConnector" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "mcpUrl" VARCHAR(500) NOT NULL,
    "authType" VARCHAR(32) NOT NULL DEFAULT 'none',
    "authSecret" VARCHAR(500),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInboundConnector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantInboundConnector_tenantId_idx" ON "TenantInboundConnector"("tenantId");
CREATE INDEX "TenantInboundConnector_userId_idx" ON "TenantInboundConnector"("userId");
CREATE INDEX "TenantInboundConnector_tenantId_enabled_idx" ON "TenantInboundConnector"("tenantId", "enabled");

-- AddForeignKey
ALTER TABLE "TenantInboundConnector" ADD CONSTRAINT "TenantInboundConnector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInboundConnector" ADD CONSTRAINT "TenantInboundConnector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
