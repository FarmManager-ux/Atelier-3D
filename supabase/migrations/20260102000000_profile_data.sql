-- Fase 1 · Perfis completos: dados comerciais, contactos e moradas.

-- ------------------------------------------------ validação de NIF (PT)
create or replace function app_private.is_valid_pt_nif(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_sum int := 0;
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
grant execute on function app_private.is_valid_pt_nif(text) to authenticated, service_role;

-- NIF português tem dígito de controlo; outros países: identificador alfanumérico simples.
alter table public.account_fiscal_data drop constraint if exists account_fiscal_data_nif_check;
alter table public.account_fiscal_data
  add constraint account_fiscal_nif_valid check (
    nif is null
    or (country = 'PT' and app_private.is_valid_pt_nif(nif))
    or (country <> 'PT' and nif ~ '^[A-Za-z0-9]{4,20}$')
  );

-- --------------------------------------------- dados comerciais da conta
alter table public.accounts
  add column phone         text check (char_length(phone) <= 40),
  add column website       text check (website is null or website ~* '^https?://[^\s]+$' and char_length(website) <= 300),
  add column billing_email extensions.citext check (char_length(billing_email::text) <= 254),
  add column activity      text check (char_length(activity) <= 500);

grant update (display_name, phone, website, billing_email, activity) on public.accounts to authenticated;

-- ---------------------------------------------------------- contactos
create table public.account_contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  email       extensions.citext check (char_length(email::text) <= 254),
  phone       text check (char_length(phone) <= 40),
  job_title   text check (char_length(job_title) <= 200),
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index account_contacts_account_idx on public.account_contacts (account_id);
create unique index account_contacts_one_primary on public.account_contacts (account_id) where is_primary;
create trigger account_contacts_updated_at before update on public.account_contacts
  for each row execute function app_private.set_updated_at();

-- ------------------------------------------------------------ moradas
create type public.address_kind as enum ('billing', 'shipping', 'other');

create table public.account_addresses (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts (id) on delete cascade,
  kind             public.address_kind not null default 'shipping',
  label            text check (char_length(label) <= 100),
  recipient_name   text not null check (char_length(recipient_name) between 1 and 200),
  line1            text not null check (char_length(line1) between 1 and 200),
  line2            text check (char_length(line2) <= 200),
  postal_code      text not null check (char_length(postal_code) between 1 and 20),
  city             text not null check (char_length(city) between 1 and 100),
  region           text check (char_length(region) <= 100),
  country          text not null default 'PT' check (country ~ '^[A-Z]{2}$'),
  phone            text check (char_length(phone) <= 40),
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (country <> 'PT' or postal_code ~ '^[0-9]{4}-[0-9]{3}$')
);
create index account_addresses_account_idx on public.account_addresses (account_id);
-- Uma morada predefinida por conta e por tipo.
create unique index account_addresses_one_default on public.account_addresses (account_id, kind) where is_default;
create trigger account_addresses_updated_at before update on public.account_addresses
  for each row execute function app_private.set_updated_at();

-- Auditoria
create trigger audit_account_contacts after insert or update or delete on public.account_contacts
  for each row execute function app_private.audit_row();
create trigger audit_account_addresses after insert or update or delete on public.account_addresses
  for each row execute function app_private.audit_row();

-- ---------------------------------------------------------------- RLS
alter table public.account_contacts  enable row level security;
alter table public.account_addresses enable row level security;
revoke all on public.account_contacts, public.account_addresses from anon, authenticated;
grant select, insert, update, delete on public.account_contacts, public.account_addresses to authenticated;

-- Leitura: membros e equipa. Escrita: owner/admin da conta e admins da equipa.
create policy contacts_select on public.account_contacts for select to authenticated
  using (app_private.is_account_member(account_id) or app_private.is_staff());
create policy contacts_write on public.account_contacts for all to authenticated
  using (app_private.is_account_admin(account_id) or app_private.is_staff_admin())
  with check (app_private.is_account_admin(account_id) or app_private.is_staff_admin());

create policy addresses_select on public.account_addresses for select to authenticated
  using (app_private.is_account_member(account_id) or app_private.is_staff());
create policy addresses_write on public.account_addresses for all to authenticated
  using (app_private.is_account_admin(account_id) or app_private.is_staff_admin())
  with check (app_private.is_account_admin(account_id) or app_private.is_staff_admin());
