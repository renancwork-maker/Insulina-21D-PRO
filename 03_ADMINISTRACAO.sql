-- Execute DEPOIS dos arquivos 01 e 02. Seguro para executar novamente.
-- Nunca habilite acesso do navegador a service_role.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_premium_override boolean DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

-- Recalcula sem perder a decisão manual de ativar/desativar VIP.
CREATE OR REPLACE FUNCTION public.wiapy_recalculate_plan(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  has_premium boolean;
  has_basic boolean;
  override_value boolean;
BEGIN
  SELECT admin_premium_override INTO override_value
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  SELECT coalesce(bool_or(tier='premium'), false), coalesce(bool_or(tier='basic'), false)
    INTO has_premium, has_basic
    FROM public.wiapy_transactions
    WHERE user_id=p_user_id AND status='paid';
  UPDATE public.profiles SET
    plan = CASE
      WHEN override_value IS TRUE THEN 'premium'
      WHEN override_value IS FALSE THEN
        CASE WHEN has_basic OR has_premium THEN 'basic' ELSE 'free' END
      WHEN has_premium THEN 'premium'
      WHEN has_basic THEN 'basic'
      ELSE 'free'
    END,
    active = CASE
      WHEN override_value IS TRUE THEN true
      WHEN override_value IS FALSE THEN (has_basic OR has_premium)
      ELSE (has_basic OR has_premium)
    END
  WHERE id = p_user_id;
END;
$$;

-- Executada APENAS pela Netlify com chave service_role.
CREATE OR REPLACE FUNCTION public.clube_admin_set_premium(
  p_admin_id uuid,
  p_user_id uuid,
  p_override boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_admin_id = p_user_id THEN
    RAISE EXCEPTION 'cannot_change_own_access';
  END IF;
  UPDATE public.profiles
     SET admin_premium_override = p_override
   WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  PERFORM public.wiapy_recalculate_plan(p_user_id);
  INSERT INTO public.admin_audit_log(admin_user_id,target_user_id,event,details)
  VALUES (p_admin_id,p_user_id,'set_premium',jsonb_build_object('override',p_override));
END;
$$;

REVOKE ALL ON FUNCTION public.wiapy_recalculate_plan(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.clube_admin_set_premium(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wiapy_recalculate_plan(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clube_admin_set_premium(uuid,uuid,boolean) TO service_role;
