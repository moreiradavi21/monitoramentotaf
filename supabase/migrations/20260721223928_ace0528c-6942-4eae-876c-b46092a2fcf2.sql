
-- Make the view use invoker rights and restrict anon to safe columns only.
ALTER VIEW public.militares_publicos SET (security_invoker = true);

-- Row-level: allow anon to read any militar row (needed for signup lookup).
DROP POLICY IF EXISTS "Anon lista militares para cadastro" ON public.militares;
CREATE POLICY "Anon lista militares para cadastro" ON public.militares
  FOR SELECT TO anon USING (true);

-- Column-level: strip anon down to just the public-safe columns.
REVOKE SELECT ON public.militares FROM anon;
GRANT SELECT (id, nome, posto) ON public.militares TO anon;
