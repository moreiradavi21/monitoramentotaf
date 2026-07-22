-- Permite que o admin exclua uma conta de usuário diretamente pelo app.
-- A função roda como postgres (superuser) e pode deletar de auth.users.

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem excluir contas.';
  END IF;

  -- Deleta de auth.users — cascata apaga profiles e user_roles automaticamente
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
