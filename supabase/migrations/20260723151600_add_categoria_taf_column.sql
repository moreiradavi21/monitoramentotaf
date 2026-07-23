ALTER TABLE public.militares
  ADD COLUMN IF NOT EXISTS categoria_taf text DEFAULT 'belico_masculino';
