CREATE UNIQUE INDEX IF NOT EXISTS profiles_militar_id_uniq ON public.profiles(militar_id) WHERE militar_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.guard_profile_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL
     OR current_setting('app.profile_guard_bypass', true) = 'on'
     OR private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.approved := false;
    NEW.militar_id := NULL;
  ELSE
    NEW.approved := OLD.approved;
    NEW.militar_id := OLD.militar_id;
    NEW.requested_role := OLD.requested_role;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_profile_privileged_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard_privileged ON public.profiles;
CREATE TRIGGER profiles_guard_privileged BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_profile_privileged_fields();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  is_first boolean; req_role text; posto_meta text; militar_meta uuid; auto_approve boolean;
BEGIN
  posto_meta := NEW.raw_user_meta_data->>'posto';
  req_role := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'companhia');
  IF req_role NOT IN ('companhia','avaliador','admin') THEN req_role := 'companhia'; END IF;
  BEGIN
    militar_meta := NULLIF(NEW.raw_user_meta_data->>'militar_id','')::uuid;
  EXCEPTION WHEN others THEN militar_meta := NULL; END;

  -- Only accept an existing military record not yet linked to another account
  IF militar_meta IS NOT NULL AND (
       NOT EXISTS (SELECT 1 FROM public.militares WHERE id = militar_meta)
       OR EXISTS (SELECT 1 FROM public.profiles WHERE militar_id = militar_meta)) THEN
    militar_meta := NULL;
  END IF;

  SELECT COUNT(*) = 0 INTO is_first FROM public.user_roles;
  auto_approve := is_first OR (req_role = 'companhia' AND militar_meta IS NOT NULL);

  INSERT INTO public.profiles (id, nome, posto, requested_role, approved, militar_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), posto_meta, req_role, auto_approve, militar_meta);

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSIF auto_approve THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.restore_companhia_profile(_nome text, _posto text, _militar_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _nome IS NULL OR length(trim(_nome)) = 0 OR length(_nome) > 200 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN RAISE EXCEPTION 'Perfil já existe'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.militares WHERE id = _militar_id) THEN RAISE EXCEPTION 'Militar inválido'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE militar_id = _militar_id) THEN RAISE EXCEPTION 'Militar já vinculado a outra conta'; END IF;
  PERFORM set_config('app.profile_guard_bypass', 'on', true);
  INSERT INTO public.profiles (id, nome, posto, requested_role, approved, militar_id)
  VALUES (uid, trim(_nome), _posto, 'companhia', true, _militar_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'user') ON CONFLICT DO NOTHING;
  PERFORM set_config('app.profile_guard_bypass', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.restore_companhia_profile(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_companhia_profile(text, text, uuid) TO authenticated;

-- Signup list: expose only non-sensitive columns without a blanket anon policy on militares
CREATE OR REPLACE VIEW public.militares_disponiveis WITH (security_invoker = false) AS
SELECT m.id, m.nome, m.posto,
  NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.militar_id = m.id) AS disponivel,
  m.nome_guerra
FROM public.militares m;
GRANT SELECT ON public.militares_disponiveis TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anon lista militares para cadastro" ON public.militares;