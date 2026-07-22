
DROP VIEW IF EXISTS public.militares_disponiveis;

CREATE VIEW public.militares_disponiveis
WITH (security_invoker = true) AS
SELECT m.id, m.nome, m.posto,
       NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.militar_id = m.id) AS disponivel
FROM public.militares m;

GRANT SELECT (militar_id) ON public.profiles TO anon, authenticated;
GRANT SELECT (id, nome, posto, disponivel) ON public.militares_disponiveis TO anon, authenticated;
