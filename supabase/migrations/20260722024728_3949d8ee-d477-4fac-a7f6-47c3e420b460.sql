
CREATE OR REPLACE FUNCTION public.militares_disponiveis()
RETURNS TABLE (id uuid, nome text, posto text, disponivel boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.nome, m.posto,
         NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.militar_id = m.id) AS disponivel
  FROM public.militares m
  ORDER BY m.nome;
$$;

REVOKE ALL ON FUNCTION public.militares_disponiveis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.militares_disponiveis() TO anon, authenticated;
