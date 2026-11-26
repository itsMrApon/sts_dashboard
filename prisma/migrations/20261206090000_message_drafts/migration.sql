-- CreateTable
CREATE TABLE "MessageDraft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'message',
    "source" VARCHAR(16) NOT NULL DEFAULT 'ai',
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageDraft_conversationId_key" ON "MessageDraft"("conversationId");

-- CreateIndex
CREATE INDEX "MessageDraft_userId_updatedAt_idx" ON "MessageDraft"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessageConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


