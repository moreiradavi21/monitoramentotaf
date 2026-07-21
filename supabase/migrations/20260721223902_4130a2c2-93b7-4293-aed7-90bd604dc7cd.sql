
-- 1. Private schema for internal helpers (not exposed by PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- 2. Recreate has_role / is_approved in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE id = _user_id), false)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_approved(uuid) TO authenticated;

-- 3. Drop policies that reference the old public helpers
DROP POLICY IF EXISTS "Admin deleta militares" ON public.militares;
DROP POLICY IF EXISTS "Admin deleta taf" ON public.taf_resultados;
DROP POLICY IF EXISTS "Aprovados leem militares" ON public.militares;
DROP POLICY IF EXISTS "Aprovados leem taf" ON public.taf_resultados;
DROP POLICY IF EXISTS "Avaliador insere taf" ON public.taf_resultados;
DROP POLICY IF EXISTS "Avaliador atualiza taf" ON public.taf_resultados;
DROP POLICY IF EXISTS "Admin lê todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Avaliador insere militares" ON public.militares;
DROP POLICY IF EXISTS "Avaliador atualiza militares" ON public.militares;
DROP POLICY IF EXISTS "Admins gerenciam papéis" ON public.user_roles;

-- 4. Drop old public helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_approved(uuid);

-- 5. Recreate policies with private.* helpers
CREATE POLICY "Admin deleta militares" ON public.militares
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin deleta taf" ON public.taf_resultados
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Aprovados leem militares" ON public.militares
  FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()));

CREATE POLICY "Aprovados leem taf" ON public.taf_resultados
  FOR SELECT TO authenticated
  USING (private.is_approved(auth.uid()));

CREATE POLICY "Avaliador insere taf" ON public.taf_resultados
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'avaliador'));

CREATE POLICY "Avaliador atualiza taf" ON public.taf_resultados
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'avaliador'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'avaliador'));

CREATE POLICY "Admin lê todos os perfis" ON public.profiles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Avaliador insere militares" ON public.militares
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'avaliador'));

CREATE POLICY "Avaliador atualiza militares" ON public.militares
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'avaliador'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'avaliador'));

CREATE POLICY "Admins gerenciam papéis" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 6. Admin can update profiles (needed for approve/revoke as INVOKER)
CREATE POLICY "Admin atualiza perfis" ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 7. Militar (Cia C Apoio) can mark ciente on their own linked record
CREATE POLICY "Militar dá ciente próprio" ON public.taf_resultados
  FOR UPDATE TO authenticated
  USING (militar_id = (SELECT militar_id FROM public.profiles WHERE id = auth.uid() AND approved = true))
  WITH CHECK (militar_id = (SELECT militar_id FROM public.profiles WHERE id = auth.uid() AND approved = true));

-- 8. Convert RPC functions to SECURITY INVOKER (authz enforced by RLS + in-function checks)
CREATE OR REPLACE FUNCTION public.marcar_ciente(_resultado_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  my_militar uuid;
BEGIN
  SELECT militar_id INTO my_militar FROM public.profiles WHERE id = auth.uid();
  IF my_militar IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a um militar.';
  END IF;

  UPDATE public.taf_resultados
     SET ciente_at = now(), ciente_by = auth.uid()
   WHERE id = _resultado_id AND militar_id = my_militar;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não pertence ao seu militar.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_profile(_profile_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar contas.';
  END IF;
  UPDATE public.profiles SET approved = true WHERE id = _profile_id;
  DELETE FROM public.user_roles WHERE user_id = _profile_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_profile_id, _role);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_profile(_profile_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem revogar contas.';
  END IF;
  UPDATE public.profiles SET approved = false WHERE id = _profile_id;
  DELETE FROM public.user_roles WHERE user_id = _profile_id;
END;
$$;

-- 9. Replace militares_publicos function with a view exposing only safe columns.
--    Views run with the view owner's rights by default (security_invoker=false)
--    so anon/authenticated bypass militares RLS and get just id/nome/posto.
DROP FUNCTION IF EXISTS public.militares_publicos();
CREATE OR REPLACE VIEW public.militares_publicos AS
  SELECT id, nome, posto::text AS posto FROM public.militares ORDER BY nome;
GRANT SELECT ON public.militares_publicos TO anon, authenticated;
