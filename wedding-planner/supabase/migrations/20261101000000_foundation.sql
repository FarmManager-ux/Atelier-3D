-- O Nosso Casamento · Fundação
-- Esquemas, extensões e utilitários. Compatível com Supabase (extensões no esquema "extensions").
-- Aditiva: não apaga nem altera objetos existentes (se um nome já existir, a migração falha).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- Funções internas, não expostas pela API (PostgREST expõe só "public").
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

create function app_private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Impede mover um registo para outro casamento (o wedding_id é imutável).
create function app_private.wedding_id_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.wedding_id <> old.wedding_id then
    raise exception 'O casamento de um registo não pode ser alterado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
