-- ============================================================
-- Auto-aprovação de contas Cia C Apoio (requested_role = 'companhia')
--
-- Antes: todos os novos usuários esperavam aprovação do admin.
-- Agora: contas 'companhia' recebem approved=true e role='user'
--        no momento do cadastro — sem intervenção do administrador.
--        Avaliador e Administrador continuam aguardando aprovação.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first      boolean;
  req_role      text;
  posto_meta    text;
  militar_meta  uuid;
  auto_approved boolean;
BEGIN
  posto_meta   := NEW.raw_user_meta_data->>'posto';
  req_role     := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'companhia');
  militar_meta := NULLIF(NEW.raw_user_meta_data->>'militar_id', '')::uuid;

  -- É o primeiro usuário do sistema? (se sim, vira admin)
  SELECT COUNT(*) = 0 INTO is_first FROM public.user_roles;

  -- Companhia (Cia C Apoio) é auto-aprovada; admin também (por ser o primeiro).
  auto_approved := (is_first OR req_role = 'companhia');

  INSERT INTO public.profiles (id, nome, posto, requested_role, approved, militar_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    posto_meta,
    req_role,
    auto_approved,
    militar_meta
  );

  IF is_first THEN
    -- Primeiro usuário do sistema → admin
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSIF req_role = 'companhia' THEN
    -- Militar da Cia C Apoio → acesso imediato como 'user'
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  ELSE
    -- avaliador / administrador → sem papel até o admin aprovar
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Garante que somente service_role pode chamar a função diretamente
-- (ela é acionada como trigger, não via RPC)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
