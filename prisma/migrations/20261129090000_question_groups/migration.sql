-- Questions customers asked, grouped by meaning, per creator and project (null = General).
-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "webinarId" UUID,
    "label" VARCHAR(200) NOT NULL,
    "examples" JSONB NOT NULL DEFAULT '[]',
    "askedCount" INTEGER NOT NULL DEFAULT 0,
    "wentQuietCount" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "lastAskedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionGroup_userId_status_idx" ON "QuestionGroup"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGroup_userId_webinarId_label_key" ON "QuestionGroup"("userId", "webinarId", "label");

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

