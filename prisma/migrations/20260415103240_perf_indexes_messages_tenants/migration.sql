-- CreateIndex
CREATE INDEX "Business_userId_createdAt_idx" ON "Business"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessAgent_businessId_isPrimary_idx" ON "BusinessAgent"("businessId", "isPrimary");

-- CreateIndex
CREATE INDEX "BusinessAgent_agentId_businessId_idx" ON "BusinessAgent"("agentId", "businessId");

-- CreateIndex
CREATE INDEX "BusinessProduct_businessId_isPrimary_idx" ON "BusinessProduct"("businessId", "isPrimary");

-- CreateIndex
CREATE INDEX "MessageChannel_roomName_updatedAt_idx" ON "MessageChannel"("roomName", "updatedAt");

-- CreateIndex
CREATE INDEX "MessageChannel_businessId_updatedAt_idx" ON "MessageChannel"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "OutreachChannel_userId_status_idx" ON "OutreachChannel"("userId", "status");

-- CreateIndex
CREATE INDEX "Tenant_userId_createdAt_idx" ON "Tenant"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Tenant_businessId_updatedAt_idx" ON "Tenant"("businessId", "updatedAt");
