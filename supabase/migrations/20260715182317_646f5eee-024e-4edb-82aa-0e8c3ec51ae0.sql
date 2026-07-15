-- Revoke default PUBLIC execute on SECURITY DEFINER functions and grant narrowly

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

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

-- militares_publicos is intentionally called from the public /auth register page
-- (visitors pick their own name before signing in). Keep anon+authenticated access
-- but drop the implicit PUBLIC grant so only these two roles are authorized.
REVOKE ALL ON FUNCTION public.militares_publicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.militares_publicos() TO anon, authenticated;
