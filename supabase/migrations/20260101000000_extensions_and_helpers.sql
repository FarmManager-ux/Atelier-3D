-- Fase 0 · Extensões e utilitários base.
-- Compatível com Supabase (extensões no esquema "extensions").

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Esquema privado: funções auxiliares NÃO expostas pela API (PostgREST).
create schema if not exists app_private;
revoke all on schema app_private from public;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
