-- Offers redesign (step 1): ways to order, buyer price options, creator-scoped contacts, orders,
-- payment requests, platform packages ($49 setup / $499 monthly). Vapi is removed from project links.
-- Additive except Webinar.aiAgentId (Vapi assistant id), which is dropped after backfilling livekitAgentId.

-- CreateEnum
CREATE TYPE "OrderModeKind" AS ENUM ('INSTANT_CHECKOUT', 'AI_ASSISTANT', 'LIVE_HOST', 'DIRECT_PAY');

-- CreateEnum
CREATE TYPE "OfferPriceKind" AS ENUM ('ONE_TIME', 'MONTHLY', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'DEPOSIT_PAID', 'PAID', 'REFUNDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('OPEN', 'PAID', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SetupRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');


-- AlterTable
ALTER TABLE "User" ADD COLUMN     "businessSubscriptionId" VARCHAR(255),
ADD COLUMN     "businessSubscriptionStatus" VARCHAR(32),
ADD COLUMN     "setupPaidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Webinar"
ADD COLUMN     "slug" VARCHAR(80);

-- CreateTable
CREATE TABLE "OfferOrderMode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webinarId" UUID NOT NULL,
    "kind" "OrderModeKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferOrderMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferPrice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webinarId" UUID NOT NULL,
    "kind" "OfferPriceKind" NOT NULL,
    "label" VARCHAR(80),
    "amountCents" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "depositCents" INTEGER,
    "depositPercent" INTEGER,
    "balanceDueDays" INTEGER,
    "stripeProductId" VARCHAR(255),
    "stripePriceId" VARCHAR(255),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(32),
    "name" VARCHAR(100),
    "source" VARCHAR(32) NOT NULL DEFAULT 'link',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "webinarId" UUID,
    "offerPriceId" UUID,
    "contactId" UUID,
    "paymentRequestId" UUID,
    "orderMode" "OrderModeKind",
    "source" VARCHAR(64),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "amountTotalCents" INTEGER NOT NULL DEFAULT 0,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "stripeCheckoutSessionId" VARCHAR(255),
    "stripePaymentIntentId" VARCHAR(255),
    "stripeInvoiceId" VARCHAR(255),
    "stripeSubscriptionId" VARCHAR(255),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "contactId" UUID,
    "webinarId" UUID,
    "token" VARCHAR(32) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "note" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "stripePaymentIntentId" VARCHAR(255) NOT NULL,
    "status" "SetupRequestStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferOrderMode_webinarId_kind_key" ON "OfferOrderMode"("webinarId", "kind");

-- CreateIndex
CREATE INDEX "OfferPrice_webinarId_idx" ON "OfferPrice"("webinarId");

-- CreateIndex
CREATE INDEX "Contact_userId_createdAt_idx" ON "Contact"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_email_key" ON "Contact"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_phone_key" ON "Contact"("userId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentRequestId_key" ON "Order"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_webinarId_idx" ON "Order"("webinarId");

-- CreateIndex
CREATE INDEX "Order_contactId_idx" ON "Order"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_token_key" ON "PaymentRequest"("token");

-- CreateIndex
CREATE INDEX "PaymentRequest_userId_createdAt_idx" ON "PaymentRequest"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SetupRequest_stripePaymentIntentId_key" ON "SetupRequest"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "SetupRequest_status_createdAt_idx" ON "SetupRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Webinar_slug_key" ON "Webinar"("slug");

-- AddForeignKey
ALTER TABLE "OfferOrderMode" ADD CONSTRAINT "OfferOrderMode_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferPrice" ADD CONSTRAINT "OfferPrice_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_offerPriceId_fkey" FOREIGN KEY ("offerPriceId") REFERENCES "OfferPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupRequest" ADD CONSTRAINT "SetupRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

-- 1) Vapi-only projects: point them at the creator's primary business agent (LiveKit).
UPDATE "Webinar" w
SET "livekitAgentId" = ba."agentId"
FROM "Business" b
JOIN "BusinessAgent" ba ON ba."businessId" = b."id" AND ba."isPrimary" = true
WHERE w."livekitAgentId" IS NULL
  AND w."aiAgentId" IS NOT NULL
  AND b."userId" = w."presenterId";

-- 2) Share slugs: ascii words from the title + 8 hex chars of the id (titles in Bangla fall back to the id part).
UPDATE "Webinar"
SET "slug" = CONCAT_WS(
  '-',
  NULLIF(TRIM(BOTH '-' FROM LEFT(TRIM(BOTH '-' FROM regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')), 60)), ''),
  LEFT(REPLACE("id"::text, '-', ''), 8)
)
WHERE "slug" IS NULL;

-- 3) Ways to order from the legacy link variants (or ctaType when no variants were saved).
--    *_BOOK_A_CALL -> AI_ASSISTANT, PRODUCT_BUY_NOW -> INSTANT_CHECKOUT, PROJECT_BUY_NOW -> LIVE_HOST
INSERT INTO "OfferOrderMode" ("webinarId", "kind", "enabled", "updatedAt")
SELECT DISTINCT w."id", m.kind::"OrderModeKind", true, CURRENT_TIMESTAMP
FROM "Webinar" w
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN v LIKE '%BOOK_A_CALL' THEN 'AI_ASSISTANT'
    WHEN v = 'PRODUCT_BUY_NOW' THEN 'INSTANT_CHECKOUT'
    WHEN v = 'PROJECT_BUY_NOW' THEN 'LIVE_HOST'
  END AS kind
  FROM unnest(
    CASE WHEN cardinality(w."linkVariants") > 0 THEN w."linkVariants"
    ELSE ARRAY[
      CASE
        WHEN w."ctaType" = 'BOOK_A_CALL' AND w."kind" = 'PRODUCT' THEN 'PRODUCT_BOOK_A_CALL'
        WHEN w."ctaType" = 'BOOK_A_CALL' THEN 'PROJECT_BOOK_A_CALL'
        WHEN w."kind" = 'PRODUCT' THEN 'PRODUCT_BUY_NOW'
        ELSE 'PROJECT_BUY_NOW'
      END
    ] END
  ) AS v
) m
WHERE m.kind IS NOT NULL
ON CONFLICT ("webinarId", "kind") DO NOTHING;

-- 4) Legacy single Stripe price -> default price option (amount synced from Stripe later).
INSERT INTO "OfferPrice" ("webinarId", "kind", "stripePriceId", "stripeProductId", "isDefault", "updatedAt")
SELECT "id", 'ONE_TIME', "priceId", "stripeProductId", true, CURRENT_TIMESTAMP
FROM "Webinar"
WHERE "priceId" IS NOT NULL AND "priceId" <> '';

-- 5) Creator-scoped contacts from past attendances (Attendee.email is global, so split it per creator).
INSERT INTO "Contact" ("userId", "email", "name", "source", "createdAt", "updatedAt")
SELECT DISTINCT ON (w."presenterId", lower(a."email"))
  w."presenterId", lower(a."email"), a."name", 'attendee', att."createdAt", CURRENT_TIMESTAMP
FROM "Attendance" att
JOIN "Attendee" a ON a."id" = att."attendeeId"
JOIN "Webinar" w ON w."id" = att."webinarId"
WHERE a."email" <> ''
ORDER BY w."presenterId", lower(a."email"), att."createdAt"
ON CONFLICT DO NOTHING;

-- 6) Vapi removed from project links.
DROP INDEX IF EXISTS "Webinar_aiAgentId_idx";
ALTER TABLE "Webinar" DROP COLUMN IF EXISTS "aiAgentId";
