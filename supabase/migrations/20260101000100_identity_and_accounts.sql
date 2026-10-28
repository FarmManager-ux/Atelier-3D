-- Fase 0 · Identidade, contas (particulares e empresas), membros e convites.
-- Princípio: tudo com RLS ativa e "negar por omissão".

create type public.account_type as enum ('individual', 'company');
create type public.account_role as enum ('owner', 'admin', 'member');
create type public.staff_role   as enum ('admin', 'operator');

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 200),
  phone       text check (char_length(phone) <= 40),
  locale      text not null default 'pt-PT',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function app_private.set_updated_at();

-- Equipa interna do Atelier 3D. Só é escrita com a chave de serviço / SQL
-- Editor (nunca pela API de clientes).
create table public.staff_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.staff_role not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- contas
create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  type          public.account_type not null,
  display_name  text not null check (char_length(display_name) between 1 and 200),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger accounts_updated_at before update on public.accounts
  for each row execute function app_private.set_updated_at();

-- Dados fiscais separados: visíveis só a owner/admin da conta e à equipa admin.
create table public.account_fiscal_data (
  account_id    uuid primary key references public.accounts (id) on delete cascade,
  legal_name    text check (char_length(legal_name) <= 300),
  nif           text check (nif ~ '^[0-9]{9}$'),
  country       text not null default 'PT' check (country ~ '^[A-Z]{2}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger account_fiscal_updated_at before update on public.account_fiscal_data
  for each row execute function app_private.set_updated_at();

create table public.account_members (
  account_id  uuid not null references public.accounts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.account_role not null default 'member',
  created_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index account_members_user_idx on public.account_members (user_id);

create table public.account_invitations (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts (id) on delete cascade,
  email       extensions.citext not null,
  role        public.account_role not null default 'member',
  token_hash  text not null unique,
  invited_by  uuid references auth.users (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  check (role <> 'owner')
);
create index account_invitations_account_idx on public.account_invitations (account_id);

-- ------------------------------------------- funções auxiliares (privadas)
create or replace function app_private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_members s
                 where s.user_id = auth.uid() and s.active);
$$;

create or replace function app_private.is_staff_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_members s
                 where s.user_id = auth.uid() and s.active and s.role = 'admin');
$$;

create or replace function app_private.account_role(p_account uuid)
returns public.account_role language sql stable security definer set search_path = '' as $$
  select m.role from public.account_members m
  where m.account_id = p_account and m.user_id = auth.uid();
$$;

create or replace function app_private.is_account_member(p_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.account_role(p_account) is not null;
$$;

create or replace function app_private.is_account_admin(p_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(app_private.account_role(p_account) in ('owner', 'admin'), false);
$$;

grant usage on schema app_private to authenticated, service_role;
grant execute on all functions in schema app_private to authenticated, service_role;

-- --------------------------------------------- regras de integridade
-- Contas de particular têm exatamente um utilizador.
create or replace function app_private.enforce_individual_single_member()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select type from public.accounts where id = new.account_id) = 'individual'
     and exists (select 1 from public.account_members
                 where account_id = new.account_id and user_id <> new.user_id) then
    raise exception 'Uma conta de particular só pode ter um utilizador'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger account_members_individual_single before insert on public.account_members
  for each row execute function app_private.enforce_individual_single_member();

-- Nunca deixar uma conta sem proprietário.
create or replace function app_private.enforce_last_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.accounts where id = old.account_id)
     and not exists (select 1 from public.account_members
                     where account_id = old.account_id and role = 'owner'
                       and user_id <> old.user_id) then
    raise exception 'A conta tem de manter pelo menos um proprietário'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger account_members_last_owner before update or delete on public.account_members
  for each row execute function app_private.enforce_last_owner();

-- O tipo e o criador de uma conta são imutáveis.
create or replace function app_private.accounts_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.type <> old.type or new.created_by is distinct from old.created_by then
    raise exception 'O tipo e o criador da conta não podem ser alterados'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger accounts_immutable before update on public.accounts
  for each row execute function app_private.accounts_immutable();

-- Perfil automático quando um utilizador é criado no Supabase Auth.
create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'full_name', 200), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.handle_new_user();
