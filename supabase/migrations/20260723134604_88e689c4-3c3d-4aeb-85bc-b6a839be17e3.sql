
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first boolean;
  req_role text;
  posto_meta text;
  militar_meta uuid;
  auto_approve boolean;
BEGIN
  posto_meta   := NEW.raw_user_meta_data->>'posto';
  req_role     := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'companhia');
  militar_meta := NULLIF(NEW.raw_user_meta_data->>'militar_id','')::uuid;

  SELECT COUNT(*) = 0 INTO is_first FROM public.user_roles;

  -- Companhia é auto-aprovado (basta confirmar o e-mail).
  -- Avaliador/Administrador continuam exigindo aprovação do admin.
  auto_approve := is_first OR req_role = 'companhia';

  INSERT INTO public.profiles (id, nome, posto, requested_role, approved, militar_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    posto_meta,
    req_role,
    auto_approve,
    militar_meta
  );

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSIF req_role = 'companhia' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;

-- Corrige contas de Cia C Apoio já criadas que ficaram pendentes.
UPDATE public.profiles
   SET approved = true
 WHERE requested_role = 'companhia' AND approved = false;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'user'::app_role
  FROM public.profiles p
 WHERE p.requested_role = 'companhia'
   AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id)
ON CONFLICT DO NOTHING;
