-- Enforce one connector per kind per tenant.
CREATE UNIQUE INDEX "TenantInboundConnector_tenantId_kind_key"
ON "TenantInboundConnector"("tenantId", "kind");
