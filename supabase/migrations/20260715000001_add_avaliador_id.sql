-- Adiciona coluna avaliador_id em taf_resultados
-- Permite rastrear qual avaliador lançou cada resultado e filtrar por papel

ALTER TABLE public.taf_resultados
  ADD COLUMN IF NOT EXISTS avaliador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_taf_resultados_avaliador_id
  ON public.taf_resultados (avaliador_id);
