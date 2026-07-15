ALTER TABLE public.militares ADD COLUMN IF NOT EXISTS data_nascimento date;
CREATE UNIQUE INDEX IF NOT EXISTS militares_nome_uniq ON public.militares (lower(nome));