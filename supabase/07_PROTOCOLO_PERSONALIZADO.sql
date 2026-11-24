-- Execute no SQL Editor antes do deploy. Não torna fotos públicas.
begin;
create table if not exists public.clube_verified_sessions (
 session_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 verified_at timestamptz not null default now()
);
alter table public.clube_verified_sessions enable row level security;
revoke all on public.clube_verified_sessions from anon, authenticated;
grant select, insert, delete on public.clube_verified_sessions to service_role;
create or replace function public.clube_protocolo_sessao_segura() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clube_verified_sessions s join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
 join public.profiles p on p.id=s.user_id
 where s.user_id=auth.uid() and s.session_id::text=auth.jwt()->>'session_id' and p.active is distinct from false);
$$;
revoke all on function public.clube_protocolo_sessao_segura() from public, anon;
grant execute on function public.clube_protocolo_sessao_segura() to authenticated, anon;
create table if not exists public.clube_protocol_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 age integer not null check(age between 35 and 110), weight_kg numeric not null check(weight_kg between 35 and 220), height_cm numeric not null check(height_cm between 120 and 210),
 activity text not null check(activity in ('low','light','moderate')),
 needs_review boolean not null default true, consent_at timestamptz not null default now(),
 photo_consent_at timestamptz, photos_decision text not null default 'pending' check(photos_decision in ('pending','skipped','done')),
 weekly_choices jsonb not null default '{}'::jsonb check(jsonb_typeof(weekly_choices)='object'),
 updated_at timestamptz not null default now()
);
create table if not exists public.clube_protocol_checkins (
 user_id uuid not null references auth.users(id) on delete cascade, reference_date date not null,
 answers jsonb not null check(jsonb_typeof(answers)='object'), saved_at timestamptz not null default now(),
 primary key(user_id,reference_date)
);
alter table public.clube_protocol_profiles add column if not exists photo_consent_at timestamptz;
create or replace function public.clube_checkin_yesterday() returns trigger language plpgsql set search_path='' as $$
declare start_day date; begin
 if new.reference_date <> (now() at time zone 'America/Sao_Paulo')::date - 1 then raise exception 'Checklist somente do dia anterior'; end if;
 select start_date into start_day from public.journey_starts where user_id=new.user_id;
 if start_day is null or new.reference_date < start_day or new.reference_date > start_day+20 then raise exception 'Data fora da jornada'; end if;
 return new;
end $$;
drop trigger if exists clube_checkin_yesterday on public.clube_protocol_checkins;
create trigger clube_checkin_yesterday before insert or update on public.clube_protocol_checkins for each row execute function public.clube_checkin_yesterday();
create table if not exists public.clube_protocol_evolution (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 reference_date date not null, weight_kg numeric check(weight_kg between 20 and 350), waist_cm numeric check(waist_cm between 30 and 250), hip_cm numeric check(hip_cm between 40 and 280), note text check(length(note)<=700), created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['clube_protocol_profiles','clube_protocol_checkins','clube_protocol_evolution'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('drop policy if exists clube_protocol_owner on public.%I',t);
  execute format('create policy clube_protocol_owner on public.%I for all to authenticated using (user_id=auth.uid() and public.clube_protocolo_sessao_segura()) with check (user_id=auth.uid() and public.clube_protocolo_sessao_segura())',t);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('clube-protocol-photos','clube-protocol-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive guard also protects against any preexisting broad permissive Storage policies.
drop policy if exists clube_protocol_photos_guard on storage.objects;
create policy clube_protocol_photos_guard on storage.objects as restrictive for all to public
using (bucket_id<>'clube-protocol-photos' or (auth.uid()::text=(storage.foldername(name))[1] and public.clube_protocolo_sessao_segura()))
with check (bucket_id<>'clube-protocol-photos' or (auth.uid()::text=(storage.foldername(name))[1] and public.clube_protocolo_sessao_segura()));
-- The guard function is callable by anon but returns false without an authenticated verified session.
drop policy if exists clube_protocol_photos_owner on storage.objects;
create policy clube_protocol_photos_owner on storage.objects for all to authenticated
using(bucket_id='clube-protocol-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.clube_protocolo_sessao_segura())
with check(bucket_id='clube-protocol-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.clube_protocolo_sessao_segura());
commit;
