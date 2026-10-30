-- Atelier 3D Portal · Identidade, equipa (RBAC) e contas de clientes.

create type public.customer_kind as enum ('individual', 'company');
create type public.customer_role as enum ('owner', 'admin', 'member');
create type public.customer_status as enum ('active', 'suspended');

-- --------------------------------------------------------------- perfis
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

-- ------------------------------------------------------ equipa e permissões
create table public.permissions (
  key          text primary key check (key ~ '^[a-z]+(\.[a-z]+){1,2}$'),
  description  text not null
);

create table public.staff_roles (
  key         text primary key check (key ~ '^[a-z][a-z_]{1,30}$'),
  label       text not null check (char_length(label) between 1 and 80),
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_key        text not null references public.staff_roles (key) on delete cascade,
  permission_key  text not null references public.permissions (key) on delete cascade,
  primary key (role_key, permission_key)
);

-- Equipa interna. Primeiro administrador: ver docs/SUPABASE.md.
create table public.staff_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role_key    text not null references public.staff_roles (key),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);
create index staff_members_role_idx on public.staff_members (role_key);

-- ------------------------------------------------------ contas de clientes
create table public.customer_accounts (
  id            uuid primary key default gen_random_uuid(),
  kind          public.customer_kind not null,
  display_name  text not null check (char_length(display_name) between 1 and 200),
  status        public.customer_status not null default 'active',
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger customer_accounts_updated_at before update on public.customer_accounts
  for each row execute function app_private.set_updated_at();

create table public.customer_members (
  account_id  uuid not null references public.customer_accounts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.customer_role not null default 'member',
  created_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index customer_members_user_idx on public.customer_members (user_id);

create table public.customer_invitations (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.customer_accounts (id) on delete cascade,
  email       extensions.citext not null,
  role        public.customer_role not null default 'member',
  token_hash  text not null unique,
  invited_by  uuid references auth.users (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  check (role <> 'owner')
);
create index customer_invitations_account_idx on public.customer_invitations (account_id);

-- Dados de faturação (separados: acesso restrito).
create table public.customer_billing_profiles (
  account_id     uuid primary key references public.customer_accounts (id) on delete cascade,
  legal_name     text check (char_length(legal_name) <= 300),
  tax_id         text,
  country        text not null default 'PT' check (country ~ '^[A-Z]{2}$'),
  billing_email  extensions.citext check (char_length(billing_email::text) <= 254),
  address_line1  text check (char_length(address_line1) <= 200),
  address_line2  text check (char_length(address_line2) <= 200),
  postal_code    text check (char_length(postal_code) <= 20),
  city           text check (char_length(city) <= 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint billing_tax_id_valid check (
    tax_id is null
    or (country = 'PT' and app_private.is_valid_pt_nif(tax_id))
    or (country <> 'PT' and tax_id ~ '^[A-Za-z0-9]{4,20}$')),
  constraint billing_postal_pt check (
    country <> 'PT' or postal_code is null or postal_code ~ '^[0-9]{4}-[0-9]{3}$')
);
create trigger customer_billing_updated_at before update on public.customer_billing_profiles
  for each row execute function app_private.set_updated_at();

-- -------------------------------------------- funções de permissão (privadas)
create function app_private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_members s where s.user_id = auth.uid() and s.active);
$$;

-- O administrador tem sempre todas as permissões; as restantes funções seguem role_permissions.
create function app_private.has_permission(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = auth.uid() and s.active
      and (s.role_key = 'admin'
           or exists (select 1 from public.role_permissions rp
                      where rp.role_key = s.role_key and rp.permission_key = p))
  );
$$;

create function app_private.customer_role(p_account uuid)
returns public.customer_role language sql stable security definer set search_path = '' as $$
  select m.role from public.customer_members m where m.account_id = p_account and m.user_id = auth.uid();
$$;

create function app_private.is_customer_member(p_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.customer_role(p_account) is not null;
$$;

create function app_private.is_customer_admin(p_account uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(app_private.customer_role(p_account) in ('owner', 'admin'), false);
$$;

-- --------------------------------------------------- regras de integridade
create function app_private.enforce_individual_single_member()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select kind from public.customer_accounts where id = new.account_id) = 'individual'
     and exists (select 1 from public.customer_members
                 where account_id = new.account_id and user_id <> new.user_id) then
    raise exception 'Uma conta de particular só pode ter um utilizador' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger customer_members_individual_single before insert on public.customer_members
  for each row execute function app_private.enforce_individual_single_member();

create function app_private.enforce_last_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.customer_accounts where id = old.account_id)
     and not exists (select 1 from public.customer_members
                     where account_id = old.account_id and role = 'owner' and user_id <> old.user_id) then
    raise exception 'A conta tem de manter pelo menos um proprietário' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger customer_members_last_owner before update or delete on public.customer_members
  for each row execute function app_private.enforce_last_owner();

-- Tipo e criador imutáveis; o estado (ativa/suspensa) só muda por quem gere clientes.
create function app_private.customer_accounts_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind <> old.kind or new.created_by is distinct from old.created_by then
    raise exception 'O tipo e o criador da conta não podem ser alterados' using errcode = 'check_violation';
  end if;
  if new.status <> old.status and auth.uid() is not null and not app_private.has_permission('customers.write') then
    raise exception 'Sem permissão para alterar o estado da conta' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger customer_accounts_guard before update on public.customer_accounts
  for each row execute function app_private.customer_accounts_guard();

-- Nunca ficar sem administrador ativo; funções do sistema não se apagam.
create function app_private.staff_members_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role_key = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role_key <> 'admin' or not new.active)
     and not exists (select 1 from public.staff_members
                     where role_key = 'admin' and active and user_id <> old.user_id) then
    raise exception 'A plataforma tem de manter pelo menos um administrador ativo' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger staff_members_guard before update or delete on public.staff_members
  for each row execute function app_private.staff_members_guard();

create function app_private.staff_roles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.is_system and (tg_op = 'DELETE' or new.key <> old.key or new.is_system is distinct from old.is_system) then
    raise exception 'As funções do sistema não podem ser removidas nem renomeadas' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger staff_roles_guard before update or delete on public.staff_roles
  for each row execute function app_private.staff_roles_guard();

-- Perfil automático quando um utilizador é criado no Supabase Auth.
create function app_private.handle_new_user()
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
