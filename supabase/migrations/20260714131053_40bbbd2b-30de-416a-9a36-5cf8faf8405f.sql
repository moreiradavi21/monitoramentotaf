
CREATE TYPE public.posto_graduacao AS ENUM ('oficial', 'sargento', 'cabo', 'soldado', 'recruta');

CREATE TABLE public.militares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  posto posto_graduacao NOT NULL,
  identificacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.militares TO anon, authenticated;
GRANT ALL ON public.militares TO service_role;
ALTER TABLE public.militares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read militares" ON public.militares FOR SELECT USING (true);
CREATE POLICY "public write militares" ON public.militares FOR INSERT WITH CHECK (true);
CREATE POLICY "public update militares" ON public.militares FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete militares" ON public.militares FOR DELETE USING (true);

CREATE TABLE public.taf_resultados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  militar_id UUID NOT NULL REFERENCES public.militares(id) ON DELETE CASCADE,
  taf_numero SMALLINT NOT NULL,
  chamada SMALLINT NOT NULL,
  data_aplicacao DATE NOT NULL DEFAULT CURRENT_DATE,
  flexao INTEGER,
  abdominal INTEGER,
  corrida_metros INTEGER,
  barra INTEGER,
  nota_flexao NUMERIC(4,2),
  nota_abdominal NUMERIC(4,2),
  nota_corrida NUMERIC(4,2),
  nota_barra NUMERIC(4,2),
  nota_final NUMERIC(4,2),
  mencao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT taf_numero_range CHECK (taf_numero BETWEEN 1 AND 3),
  CONSTRAINT chamada_range CHECK (chamada BETWEEN 1 AND 2),
  UNIQUE (militar_id, taf_numero, chamada)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taf_resultados TO anon, authenticated;
GRANT ALL ON public.taf_resultados TO service_role;
ALTER TABLE public.taf_resultados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read taf" ON public.taf_resultados FOR SELECT USING (true);
CREATE POLICY "public write taf" ON public.taf_resultados FOR INSERT WITH CHECK (true);
CREATE POLICY "public update taf" ON public.taf_resultados FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete taf" ON public.taf_resultados FOR DELETE USING (true);

CREATE INDEX idx_taf_militar ON public.taf_resultados(militar_id);
CREATE INDEX idx_taf_edicao ON public.taf_resultados(taf_numero, chamada);
