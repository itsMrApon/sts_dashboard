-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'SLACK';

-- AlterTable
ALTER TABLE "MessageChannel" ADD COLUMN     "campaignId" UUID,
ADD COLUMN     "slackBotToken" TEXT,
ADD COLUMN     "slackChannelId" TEXT,
ADD COLUMN     "slackTeamId" TEXT,
ADD COLUMN     "webinarId" UUID;
