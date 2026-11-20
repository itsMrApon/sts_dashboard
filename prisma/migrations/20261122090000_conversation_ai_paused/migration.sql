-- A person took over this chat: the AI stays quiet until handed back.
ALTER TABLE "MessageConversation" ADD COLUMN "aiPausedAt" TIMESTAMP(3);
