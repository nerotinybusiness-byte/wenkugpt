ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS ocr_rescue_engine varchar(32),
ADD COLUMN IF NOT EXISTS ocr_rescue_fallback_engine varchar(32);
