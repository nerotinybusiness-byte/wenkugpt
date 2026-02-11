ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS ocr_rescue_applied boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ocr_rescue_chunks_recovered integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ocr_rescue_warnings jsonb;
