-- Clube do Segredo - banco novo. Executar uma única vez no SQL Editor do Supabase.
-- IMPORTANTE: acesso premium só é concedido pela função de webhook (service_role).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  plan text not null default 'free' check (plan in ('free', 'basic', 'premium')),
  active boolean not null default false,
  purchase_date timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_unique_lower_email on public.profiles (lower(email));

create table if not exists public.wiapy_transactions (
  payment_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  checkout_id text not null,
  amount_cents integer not null,
  status text not null default 'paid' check (status in ('paid','refunded')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists wiapy_transactions_user_status_idx on public.wiapy_transactions(user_id, status);

create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,
  done boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number integer, weight numeric, cintura numeric, quadril numeric,
  humor text, nota text, foto_url text,
  created_at timestamptz not null default now()
);
create index if not exists checkins_user_created_idx on public.checkins(user_id, created_at);
create table if not exists public.acessos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text, evento text,
  created_at timestamptz not null default now()
);
create index if not exists acessos_user_created_idx on public.acessos(user_id, created_at);

-- Qualquer conta criada por fora do webhook fica BLOQUEADA até pagamento aprovado.
create or replace function public.clube_register_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,email,name,plan,active)
  values (new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
    'free', false)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists clube_register_profile_trigger on auth.users;
create trigger clube_register_profile_trigger after insert on auth.users
for each row execute function public.clube_register_profile();

-- RLS protege dados de cada cliente. Somente a service_role altera acesso ou plano.
alter table public.profiles enable row level security;
alter table public.wiapy_transactions enable row level security;
alter table public.progress enable row level security;
alter table public.favorites enable row level security;
alter table public.checkins enable row level security;
alter table public.acessos enable row level security;
revoke all on public.profiles,public.wiapy_transactions,public.progress,
  public.favorites,public.checkins,public.acessos from anon,authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.progress to authenticated;
grant select,insert,delete on public.favorites to authenticated;
grant select,insert on public.checkins to authenticated;
grant insert on public.acessos to authenticated;

drop policy if exists clube_profile_select on public.profiles;
create policy clube_profile_select on public.profiles for select to authenticated
  using (id=(select auth.uid()));

drop policy if exists clube_progress_select on public.progress;
create policy clube_progress_select on public.progress for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists clube_progress_insert on public.progress;
create policy clube_progress_insert on public.progress for insert to authenticated
  with check (user_id=(select auth.uid()));
drop policy if exists clube_progress_update on public.progress;
create policy clube_progress_update on public.progress for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists clube_progress_delete on public.progress;
create policy clube_progress_delete on public.progress for delete to authenticated
  using (user_id=(select auth.uid()));

drop policy if exists clube_favorites_select on public.favorites;
create policy clube_favorites_select on public.favorites for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists clube_favorites_insert on public.favorites;
create policy clube_favorites_insert on public.favorites for insert to authenticated
  with check (user_id=(select auth.uid()));
drop policy if exists clube_favorites_delete on public.favorites;
create policy clube_favorites_delete on public.favorites for delete to authenticated
  using (user_id=(select auth.uid()));

drop policy if exists clube_checkins_select on public.checkins;
create policy clube_checkins_select on public.checkins for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists clube_checkins_insert on public.checkins;
create policy clube_checkins_insert on public.checkins for insert to authenticated
  with check (user_id=(select auth.uid()));

drop policy if exists clube_acessos_insert on public.acessos;
create policy clube_acessos_insert on public.acessos for insert to authenticated
  with check (user_id=(select auth.uid()));
-- Não há policy para wiapy_transactions: somente service_role pode ler/alterar.
