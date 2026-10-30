-- Atelier 3D Portal · Fundação
-- Esquemas, extensões e utilitários. Compatível com Supabase (extensões no esquema "extensions").
-- Esta migração NÃO apaga nem altera objetos existentes: se algum nome já existir, falha (segurança).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Funções auxiliares internas: não expostas pela API (PostgREST expõe só "public").
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

-- NIF português: 9 dígitos, prefixo válido e dígito de controlo (módulo 11).
create function app_private.is_valid_pt_nif(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_sum   int := 0;
  v_check int;
begin
  if p is null or p !~ '^[0-9]{9}$' then return false; end if;
  if p !~ '^(1|2|3|5|6|8|9|45|70|71|72|74|75|77|78|79|90|91|98|99)' then return false; end if;
  for i in 1..8 loop
    v_sum := v_sum + substr(p, i, 1)::int * (10 - i);
  end loop;
  v_check := 11 - (v_sum % 11);
  if v_check >= 10 then v_check := 0; end if;
  return v_check = substr(p, 9, 1)::int;
end;
$$;
