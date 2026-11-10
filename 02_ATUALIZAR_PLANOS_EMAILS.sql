-- Execute DEPOIS do arquivo 01_CONFIGURAR_SUPABASE.sql.
-- Compatível com instalações anteriores; preserva perfis e senhas.
-- Antes de executar em produção, revise os planos e transações legadas.

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free','basic','premium'));

alter table public.wiapy_transactions add column if not exists tier text;
-- Migração legada: o webhook antigo só vendia plano premium.
update public.wiapy_transactions set tier = 'premium' where tier is null;
alter table public.wiapy_transactions alter column tier set not null;
alter table public.wiapy_transactions drop constraint if exists wiapy_transactions_tier_check;
alter table public.wiapy_transactions add constraint wiapy_transactions_tier_check check (tier in ('basic','premium'));

create table if not exists public.wiapy_refund_events (
  payment_id text primary key,
  recorded_at timestamptz not null default now()
);
create table if not exists public.wiapy_email_deliveries (
  payment_id text primary key references public.wiapy_transactions(payment_id) on delete cascade,
  claimed_at timestamptz,
  sent_at timestamptz,
  resend_message_id text,
  attempts integer not null default 0
);
alter table public.wiapy_refund_events enable row level security;
alter table public.wiapy_email_deliveries enable row level security;
revoke all on public.wiapy_refund_events,public.wiapy_email_deliveries from anon,authenticated;

-- Somente backend com service_role pode executar funções de compra.
create or replace function public.wiapy_recalculate_plan(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare has_premium boolean; has_basic boolean;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  select coalesce(bool_or(tier='premium'),false), coalesce(bool_or(tier='basic'),false)
    into has_premium,has_basic
    from public.wiapy_transactions where user_id=p_user_id and status='paid';
  update public.profiles set
    plan=case when has_premium then 'premium' when has_basic then 'basic' else 'free' end,
    active=has_premium or has_basic
  where id=p_user_id;
end;
$$;

create or replace function public.wiapy_apply_payment(
  p_payment_id text,p_user_id uuid,p_email text,p_checkout_id text,
  p_amount_cents integer,p_tier text,p_status text,p_name text
) returns text language plpgsql security definer set search_path = '' as $$
declare old record; reversed boolean;
begin
  if p_payment_id is null or length(p_payment_id)=0 or p_tier not in ('basic','premium') or p_status <> 'paid' then
    raise exception 'invalid_purchase';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_payment_id));
  select exists(select 1 from public.wiapy_refund_events where payment_id=p_payment_id) into reversed;
  if reversed then return 'refunded'; end if;
  select * into old from public.wiapy_transactions where payment_id=p_payment_id;
  if found and old.status = 'refunded' then return 'refunded'; end if;
  if found and (old.user_id <> p_user_id or old.checkout_id <> p_checkout_id or old.tier <> p_tier) then
    raise exception 'payment_owner_mismatch';
  end if;
  insert into public.profiles(id,email,name,plan,active)
    values(p_user_id,p_email,coalesce(nullif(p_name,''),split_part(p_email,'@',1)),'free',false)
    on conflict(id) do nothing;
  insert into public.wiapy_transactions(payment_id,user_id,email,checkout_id,amount_cents,status,tier,updated_at)
    values(p_payment_id,p_user_id,p_email,p_checkout_id,p_amount_cents,'paid',p_tier,now())
    on conflict(payment_id) do update set updated_at=now()
    where public.wiapy_transactions.status='paid';
  perform public.wiapy_recalculate_plan(p_user_id);
  update public.profiles set purchase_date=coalesce(purchase_date,now()),name=coalesce(nullif(name,''),p_name)
    where id=p_user_id;
  return 'paid';
end;
$$;

create or replace function public.wiapy_refund_payment(p_payment_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_payment_id));
  insert into public.wiapy_refund_events(payment_id) values(p_payment_id) on conflict do nothing;
  select user_id into uid from public.wiapy_transactions where payment_id=p_payment_id;
  if uid is null then return false; end if;
  update public.wiapy_transactions set status='refunded',updated_at=now() where payment_id=p_payment_id;
  perform public.wiapy_recalculate_plan(uid);
  return true;
end;
$$;

create or replace function public.wiapy_claim_email(p_payment_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare can_claim boolean;
begin
  insert into public.wiapy_email_deliveries(payment_id,claimed_at,attempts)
    values(p_payment_id,now(),1) on conflict(payment_id) do nothing;
  if found then return true; end if;
  update public.wiapy_email_deliveries set claimed_at=now(),attempts=attempts+1
    where payment_id=p_payment_id and sent_at is null and (claimed_at is null or claimed_at < now()-interval '6 minutes');
  return found;
end;
$$;

create or replace function public.wiapy_finish_email(p_payment_id text,p_message_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.wiapy_email_deliveries set sent_at=now(),resend_message_id=p_message_id
 where payment_id=p_payment_id and sent_at is null;
end;
$$;

create or replace function public.wiapy_release_email(p_payment_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.wiapy_email_deliveries set claimed_at=null where payment_id=p_payment_id and sent_at is null;
end;
$$;

revoke all on function public.wiapy_recalculate_plan(uuid) from public,anon,authenticated;
revoke all on function public.wiapy_apply_payment(text,uuid,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.wiapy_refund_payment(text) from public,anon,authenticated;
revoke all on function public.wiapy_claim_email(text) from public,anon,authenticated;
revoke all on function public.wiapy_finish_email(text,text) from public,anon,authenticated;
revoke all on function public.wiapy_release_email(text) from public,anon,authenticated;
grant execute on function public.wiapy_recalculate_plan(uuid) to service_role;
grant execute on function public.wiapy_apply_payment(text,uuid,text,text,integer,text,text,text) to service_role;
grant execute on function public.wiapy_refund_payment(text) to service_role;
grant execute on function public.wiapy_claim_email(text) to service_role;
grant execute on function public.wiapy_finish_email(text,text) to service_role;
grant execute on function public.wiapy_release_email(text) to service_role;

-- Para contas criadas pelo webhook anterior, confira manualmente as transações
-- antes de executar uma recalculação global: transações legadas foram marcadas premium.
