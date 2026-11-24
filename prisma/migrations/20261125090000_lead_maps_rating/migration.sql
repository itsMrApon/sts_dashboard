-- Google Maps category and rating get their own columns instead of living in the notes.
ALTER TABLE "CallIntelLead"
  ADD COLUMN "mapsCategory" VARCHAR(120),
  ADD COLUMN "mapsRating" DOUBLE PRECISION,
  ADD COLUMN "mapsReviewCount" INTEGER;

-- Copy them out of the notes the Maps import wrote ("Category: X" / "Rating: 4.5 (120)").
UPDATE "CallIntelLead"
SET
  "mapsCategory" = left(substring("notes" from '(?n)^Category: (.+)$'), 120),
  "mapsRating" = substring("notes" from '(?n)^Rating: ([0-9]+(?:\.[0-9]+)?)')::double precision,
  "mapsReviewCount" = substring("notes" from '(?n)^Rating: [0-9.]+ \(([0-9]+)\)')::integer
WHERE "source" = 'BUSINESS' AND "notes" IS NOT NULL;

-- Then drop those two lines from the notes, leaving anything the person typed.
UPDATE "CallIntelLead"
SET "notes" = NULLIF(
  btrim(regexp_replace(regexp_replace("notes", '^(Category|Rating): [^\n]*\n?', '', 'gn'), '\n{3,}', E'\n\n', 'g'), E' \n'),
  ''
)
WHERE "source" = 'BUSINESS' AND "notes" ~ '(?n)^(Category|Rating): ';
