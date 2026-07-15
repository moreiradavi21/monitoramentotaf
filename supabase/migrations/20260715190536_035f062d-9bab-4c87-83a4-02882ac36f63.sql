GRANT SELECT, INSERT, UPDATE, DELETE ON public.militares TO authenticated;
GRANT ALL ON public.militares TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taf_resultados TO authenticated;
GRANT ALL ON public.taf_resultados TO service_role;