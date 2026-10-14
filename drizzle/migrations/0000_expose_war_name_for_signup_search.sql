CREATE OR REPLACE VIEW public.militares_disponiveis WITH (security_invoker = true) AS
SELECT m.id, m.nome, m.posto,
       NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.militar_id = m.id) AS disponivel,
       m.nome_guerra
FROM public.militares m;
GRANT SELECT (nome_guerra) ON public.militares TO anon;
GRANT SELECT ON public.militares_disponiveis TO anon, authenticated, service_role;