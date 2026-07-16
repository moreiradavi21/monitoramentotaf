
-- Revoke broad EXECUTE and grant only what's needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.marcar_ciente(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_profile(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.militares_publicos() FROM PUBLIC;

-- Keep RPC-called functions available to signed-in users only
GRANT EXECUTE ON FUNCTION public.marcar_ciente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_profile(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_profile(uuid) TO authenticated;

-- militares_publicos is used during signup (anon) to list military names
GRANT EXECUTE ON FUNCTION public.militares_publicos() TO anon, authenticated;

-- Internal helpers used only by RLS policies / triggers / other SECURITY DEFINER functions
-- Grant to service_role only; RLS/policies invoke them through SECURITY DEFINER wrappers.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- RLS policies need authenticated to execute has_role/is_approved (invoker checks EXECUTE)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

-- Explicit admin-only write policies on user_roles to make role management intent clear.
DROP POLICY IF EXISTS "Admins gerenciam papéis" ON public.user_roles;
CREATE POLICY "Admins gerenciam papéis"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
