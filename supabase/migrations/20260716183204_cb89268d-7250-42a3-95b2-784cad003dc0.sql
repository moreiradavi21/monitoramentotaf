
-- Remove duplicate/overly-permissive policies on militares
DROP POLICY IF EXISTS militares_select ON public.militares;
DROP POLICY IF EXISTS militares_insert ON public.militares;
DROP POLICY IF EXISTS militares_update ON public.militares;
DROP POLICY IF EXISTS militares_delete ON public.militares;

-- Remove duplicate policies on taf_resultados (text-role variants)
DROP POLICY IF EXISTS taf_resultados_select ON public.taf_resultados;
DROP POLICY IF EXISTS taf_resultados_insert ON public.taf_resultados;
DROP POLICY IF EXISTS taf_resultados_update ON public.taf_resultados;
DROP POLICY IF EXISTS taf_resultados_delete ON public.taf_resultados;

-- Drop the now-unused text-based has_role overload
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.has_role(text);

-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, grant only to roles that need them
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.marcar_ciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_ciente(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_profile(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_profile(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_profile(uuid) TO authenticated;

-- militares_publicos is intentionally public for the sign-up flow (returns id, nome, posto only)
REVOKE ALL ON FUNCTION public.militares_publicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.militares_publicos() TO anon, authenticated;
