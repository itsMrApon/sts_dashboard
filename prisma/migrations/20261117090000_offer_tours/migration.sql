-- Each product (Webinar) can own one guided tour, edited in the product's settings.
ALTER TABLE "VoiceWizard" ADD COLUMN "webinarId" UUID;

CREATE UNIQUE INDEX "VoiceWizard_webinarId_key" ON "VoiceWizard"("webinarId");

ALTER TABLE "VoiceWizard" ADD CONSTRAINT "VoiceWizard_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
