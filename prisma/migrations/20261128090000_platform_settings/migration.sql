-- Platform-wide settings edited by owners in /integrations (for now the trigger.dev keys), stored encrypted.
CREATE TABLE "PlatformSetting" (
    "key" VARCHAR(64) NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);
