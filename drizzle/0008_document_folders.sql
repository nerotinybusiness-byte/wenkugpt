ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS folder_name varchar(128);

CREATE INDEX IF NOT EXISTS documents_user_folder_idx
ON public.documents (user_id, folder_name);
