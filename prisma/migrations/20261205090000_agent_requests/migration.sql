-- CreateTable
CREATE TABLE "AgentRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenId" UUID,
    "client" VARCHAR(16) NOT NULL,
    "runId" VARCHAR(64) NOT NULL,
    "runTitle" VARCHAR(200) NOT NULL,
    "area" VARCHAR(32) NOT NULL,
    "tool" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "detail" VARCHAR(500),
    "reason" TEXT,
    "input" JSONB NOT NULL DEFAULT '{}',
    "secretEnc" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "result" JSONB,
    "error" VARCHAR(1000),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolGrant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tool" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRequest_userId_status_createdAt_idx" ON "AgentRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolGrant_userId_tool_key" ON "AgentToolGrant"("userId", "tool");

-- AddForeignKey
ALTER TABLE "AgentRequest" ADD CONSTRAINT "AgentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRequest" ADD CONSTRAINT "AgentRequest_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "CliToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolGrant" ADD CONSTRAINT "AgentToolGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


