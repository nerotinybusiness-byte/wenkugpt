ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "template_profile_id" varchar(128);

ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "template_matched" boolean NOT NULL DEFAULT false;

ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "template_match_score" real;

ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "template_boilerplate_chunks" integer NOT NULL DEFAULT 0;

ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "template_detection_mode" varchar(32);

ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "template_warnings" jsonb;

ALTER TABLE "chunks"
ADD COLUMN IF NOT EXISTS "is_template_boilerplate" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "chunks_template_boilerplate_idx"
ON "chunks" ("is_template_boilerplate");
