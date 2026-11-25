-- Execute após 07_PROTOCOLO_PERSONALIZADO.sql, antes do deploy. Preserva todos os dados existentes.
begin;
alter table public.clube_protocol_profiles drop constraint if exists clube_protocol_profiles_age_check;
alter table public.clube_protocol_profiles add constraint clube_protocol_profiles_age_check check (age between 18 and 110);
commit;
