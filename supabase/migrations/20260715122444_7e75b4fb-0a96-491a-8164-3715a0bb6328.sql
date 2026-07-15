
-- =========================================================
-- profiles: posto, requested_role, approved, militar_id
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS posto text,
  ADD COLUMN IF NOT EXISTS requested_role text,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS militar_id uuid REFERENCES public.militares(id) ON DELETE SET NULL;

-- Approve existing users (first admin + qualquer conta já existente)
UPDATE public.profiles SET approved = true;

-- =========================================================
-- taf_resultados: ciente
-- =========================================================
ALTER TABLE public.taf_resultados
  ADD COLUMN IF NOT EXISTS ciente_at timestamptz,
  ADD COLUMN IF NOT EXISTS ciente_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- =========================================================
-- Helper: is_approved
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE id = _user_id), false);
$$;

REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;

-- =========================================================
-- New handle_new_user: guarda metadata + auto-admin no primeiro
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first boolean;
  req_role text;
  posto_meta text;
  militar_meta uuid;
BEGIN
  posto_meta   := NEW.raw_user_meta_data->>'posto';
  req_role     := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'companhia');
  militar_meta := NULLIF(NEW.raw_user_meta_data->>'militar_id','')::uuid;

  SELECT COUNT(*) = 0 INTO is_first FROM public.user_roles;

  INSERT INTO public.profiles (id, nome, posto, requested_role, approved, militar_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    posto_meta,
    req_role,
    is_first,          -- primeiro usuário já aprovado
    militar_meta
  );

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    -- Novos usuários só recebem papel após aprovação; por ora sem papel.
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================
-- Approve profile helper (admin only) — grants role
-- =========================================================
CREATE OR REPLACE FUNCTION public.approve_profile(_profile_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem aprovar contas.';
  END IF;

  UPDATE public.profiles SET approved = true WHERE id = _profile_id;

  -- limpa papel anterior e insere o novo
  DELETE FROM public.user_roles WHERE user_id = _profile_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_profile_id, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_profile(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_profile(uuid, app_role) TO authenticated;

-- Revoke approval / block account
CREATE OR REPLACE FUNCTION public.revoke_profile(_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem revogar contas.';
  END IF;

  UPDATE public.profiles SET approved = false WHERE id = _profile_id;
  DELETE FROM public.user_roles WHERE user_id = _profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_profile(uuid) TO authenticated;

-- =========================================================
-- Mark ciente (militar da companhia sobre próprio TAF)
-- =========================================================
CREATE OR REPLACE FUNCTION public.marcar_ciente(_resultado_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_militar uuid;
  approved_ok boolean;
BEGIN
  SELECT militar_id, approved INTO my_militar, approved_ok
  FROM public.profiles WHERE id = auth.uid();

  IF NOT approved_ok THEN
    RAISE EXCEPTION 'Conta não aprovada.';
  END IF;
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

REVOKE ALL ON FUNCTION public.marcar_ciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_ciente(uuid) TO authenticated;

-- =========================================================
-- RLS: militares — remove leitura pública, exige aprovação
-- =========================================================
DROP POLICY IF EXISTS "public read militares" ON public.militares;
DROP POLICY IF EXISTS "Aprovados leem militares" ON public.militares;
CREATE POLICY "Aprovados leem militares"
  ON public.militares FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

REVOKE SELECT ON public.militares FROM anon;

-- =========================================================
-- RLS: taf_resultados — leitura só aprovados; avaliador pode gravar
-- =========================================================
DROP POLICY IF EXISTS "public read taf" ON public.taf_resultados;
DROP POLICY IF EXISTS "Aprovados leem taf" ON public.taf_resultados;
CREATE POLICY "Aprovados leem taf"
  ON public.taf_resultados FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

REVOKE SELECT ON public.taf_resultados FROM anon;

-- Insert: admin ou avaliador
DROP POLICY IF EXISTS "Admin insere taf" ON public.taf_resultados;
DROP POLICY IF EXISTS "Avaliador insere taf" ON public.taf_resultados;
CREATE POLICY "Avaliador insere taf"
  ON public.taf_resultados FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'avaliador'));

DROP POLICY IF EXISTS "Admin atualiza taf" ON public.taf_resultados;
DROP POLICY IF EXISTS "Avaliador atualiza taf" ON public.taf_resultados;
CREATE POLICY "Avaliador atualiza taf"
  ON public.taf_resultados FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'avaliador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'avaliador'));

-- Delete: apenas admin
-- (Admin deleta taf policy already exists)

-- =========================================================
-- RLS: profiles — admin lê todos, aprovação
-- =========================================================
DROP POLICY IF EXISTS "Admin lê todos os perfis" ON public.profiles;
CREATE POLICY "Admin lê todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- (o usuário já pode ler o próprio via política existente "Profiles são visíveis para autenticados"
--  mas essa política é aberta demais. Vamos restringir:)
DROP POLICY IF EXISTS "Profiles são visíveis para autenticados" ON public.profiles;
CREATE POLICY "Usuário lê próprio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
