-- CreateTable
CREATE TABLE "UserVoiceCredential" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "googleApiKey" TEXT,
    "deepgramApiKey" TEXT,
    "openaiApiKey" TEXT,
    "anthropicApiKey" TEXT,
    "googleValidatedAt" TIMESTAMP(3),
    "deepgramValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVoiceCredential_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LiveKitAgent" ADD COLUMN "voiceProvider" VARCHAR(50) NOT NULL DEFAULT 'deepgram';

-- CreateIndex
CREATE UNIQUE INDEX "UserVoiceCredential_userId_key" ON "UserVoiceCredential"("userId");

-- CreateIndex
CREATE INDEX "UserVoiceCredential_userId_idx" ON "UserVoiceCredential"("userId");

-- AddForeignKey
ALTER TABLE "UserVoiceCredential" ADD CONSTRAINT "UserVoiceCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
