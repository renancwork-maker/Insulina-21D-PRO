-- Execute UMA vez no SQL Editor do Supabase para ativar login também por celular.
-- A consulta é feita exclusivamente pela função de servidor com SERVICE_ROLE_KEY.
CREATE TABLE IF NOT EXISTS public.wiapy_purchase_contacts (
  payment_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_digits text NOT NULL CHECK (phone_digits ~ '^[0-9]{10,11}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wiapy_purchase_contacts_phone_idx
  ON public.wiapy_purchase_contacts (phone_digits);
ALTER TABLE public.wiapy_purchase_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wiapy_purchase_contacts FROM anon, authenticated;
-- Para compras anteriores, será necessário importar os telefones confirmados
-- da Wiapy, ou reenviar os webhooks de compras pagas depois da migração.
