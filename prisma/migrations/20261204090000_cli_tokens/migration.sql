-- CreateTable
CREATE TABLE "CliLoginRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deviceCodeHash" VARCHAR(64) NOT NULL,
    "userCode" VARCHAR(16) NOT NULL,
    "client" VARCHAR(16) NOT NULL,
    "deviceName" VARCHAR(100),
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "userId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliLoginRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CliToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "client" VARCHAR(16) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CliLoginRequest_deviceCodeHash_key" ON "CliLoginRequest"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "CliLoginRequest_userCode_key" ON "CliLoginRequest"("userCode");

-- CreateIndex
CREATE INDEX "CliLoginRequest_expiresAt_idx" ON "CliLoginRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CliToken_tokenHash_key" ON "CliToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CliToken_userId_revokedAt_idx" ON "CliToken"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "CliLoginRequest" ADD CONSTRAINT "CliLoginRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliToken" ADD CONSTRAINT "CliToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

