
DROP FUNCTION IF EXISTS public.militares_disponiveis();

CREATE OR REPLACE VIEW public.militares_disponiveis
WITH (security_invoker = false) AS
SELECT m.id, m.nome, m.posto,
       NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.militar_id = m.id) AS disponivel
FROM public.militares m;

REVOKE ALL ON public.militares_disponiveis FROM PUBLIC;
GRANT SELECT (id, nome, posto, disponivel) ON public.militares_disponiveis TO anon, authenticated;
