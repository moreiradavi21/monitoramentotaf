-- Adiciona coluna categoria_taf à tabela militares
-- Valores possíveis: belico_masculino | belico_feminino | saude_masculino | saude_feminino
ALTER TABLE public.militares
  ADD COLUMN IF NOT EXISTS categoria_taf text DEFAULT 'belico_masculino';
