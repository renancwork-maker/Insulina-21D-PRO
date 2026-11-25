-- Executar antes do deploy. Reutiliza a tabela de atividade existente.
-- Nenhum histórico é apagado; somente o servidor pode chamar esta função.
BEGIN;
CREATE OR REPLACE FUNCTION public.clube_registrar_login_simples(p_user_id uuid, p_os text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.active IS DISTINCT FROM false
      AND EXISTS (SELECT 1 FROM public.wiapy_transactions t
        WHERE t.user_id = p.id AND t.status = 'paid' AND t.tier IN ('basic','premium'))
  ) THEN
    RAISE EXCEPTION 'purchase_not_eligible';
  END IF;
  INSERT INTO public.app_user_activity AS a
    (user_id, first_open_at, last_open_at, last_seen_at, open_count, last_os)
  VALUES (p_user_id, v_now, v_now, v_now, 1,
    CASE WHEN p_os IN ('ios','android','desktop','other') THEN p_os ELSE 'other' END)
  ON CONFLICT (user_id) DO UPDATE SET
    first_open_at = COALESCE(a.first_open_at, EXCLUDED.first_open_at),
    last_open_at = GREATEST(a.last_open_at, EXCLUDED.last_open_at),
    last_seen_at = GREATEST(a.last_seen_at, EXCLUDED.last_seen_at),
    open_count = COALESCE(a.open_count, 0) + 1,
    last_os = CASE WHEN a.last_open_at > EXCLUDED.last_open_at THEN a.last_os ELSE EXCLUDED.last_os END;
END;
$$;
REVOKE ALL ON FUNCTION public.clube_registrar_login_simples(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clube_registrar_login_simples(uuid,text) TO service_role;
COMMIT;
