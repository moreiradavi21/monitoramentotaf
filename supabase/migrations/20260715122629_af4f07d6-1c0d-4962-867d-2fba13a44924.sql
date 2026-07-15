
CREATE OR REPLACE FUNCTION public.militares_publicos()
RETURNS TABLE(id uuid, nome text, posto text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome, posto::text FROM public.militares ORDER BY nome;
$$;

REVOKE ALL ON FUNCTION public.militares_publicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.militares_publicos() TO anon, authenticated;
