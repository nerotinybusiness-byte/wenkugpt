ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "original_filename" varchar(512);

ALTER TABLE "chunks"
ADD COLUMN IF NOT EXISTS "highlight_boxes" jsonb;

UPDATE "documents"
SET "original_filename" = "filename"
WHERE "original_filename" IS NULL;

UPDATE "chunks"
SET "highlight_boxes" = CASE
    WHEN "bounding_box" IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array("bounding_box")
END
WHERE "highlight_boxes" IS NULL;
