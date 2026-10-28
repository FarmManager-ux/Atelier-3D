-- Fase 1 · Projetos e biblioteca privada de ficheiros com versões imutáveis.
--
-- Princípios:
--  * Uma versão de ficheiro nunca é alterada nem substituída (só passa de "pending" a
--    "available"/"rejected", e apenas pelo servidor com a chave de serviço).
--  * Uma nova versão NUNCA substitui automaticamente a versão aprovada.
--  * Um ficheiro só fica "available" depois de o servidor verificar tamanho, hash e tipo.

create type public.project_status as enum ('active', 'archived');
create type public.file_kind as enum ('model_3d', 'image');
create type public.file_version_status as enum ('pending', 'available', 'rejected');

-- Regras de formatos e limites: fonte única na BD (espelhadas em src/lib/files/rules.ts,
-- com um teste que garante a paridade).
create table public.file_type_rules (
  extension  text primary key check (extension ~ '^[a-z0-9]{2,8}$'),
  kind       public.file_kind not null,
  max_bytes  bigint not null check (max_bytes > 0)
);
insert into public.file_type_rules (extension, kind, max_bytes) values
  ('stl',  'model_3d', 104857600),
  ('3mf',  'model_3d', 104857600),
  ('step', 'model_3d', 104857600),
  ('stp',  'model_3d', 104857600),
  ('obj',  'model_3d', 104857600),
  ('png',  'image',     15728640),
  ('jpg',  'image',     15728640),
  ('jpeg', 'image',     15728640),
  ('webp', 'image',     15728640);

-- ------------------------------------------------------------ projetos
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 200),
  description  text check (char_length(description) <= 2000),
  status       public.project_status not null default 'active',
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, account_id)
);
create index projects_account_idx on public.projects (account_id, created_at desc);
create trigger projects_updated_at before update on public.projects
  for each row execute function app_private.set_updated_at();

-- ------------------------------------------------------------ ficheiros
create table public.files (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references public.accounts (id) on delete cascade,
  project_id           uuid,
  display_name         text not null check (char_length(display_name) between 1 and 200),
  kind                 public.file_kind not null,
  approved_version_id  uuid,
  approved_at          timestamptz,
  approved_by          uuid references auth.users (id) on delete set null,
  archived_at          timestamptz,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, account_id),
  -- O projeto tem de pertencer à mesma conta (MATCH SIMPLE: ignorado se project_id for nulo).
  foreign key (project_id, account_id) references public.projects (id, account_id)
);
create index files_account_idx on public.files (account_id, created_at desc);
create index files_project_idx on public.files (project_id);
create trigger files_updated_at before update on public.files
  for each row execute function app_private.set_updated_at();

create table public.file_versions (
  id                uuid primary key default gen_random_uuid(),
  file_id           uuid not null,
  account_id        uuid not null,
  version_number    int  not null check (version_number > 0),
  storage_path      text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255
                                          and original_filename !~ '[/\\[:cntrl:]]'),
  extension         text not null references public.file_type_rules (extension),
  size_bytes        bigint not null check (size_bytes > 0),
  declared_sha256   text not null check (declared_sha256 ~ '^[0-9a-f]{64}$'),
  sha256            text check (sha256 ~ '^[0-9a-f]{64}$'),
  status            public.file_version_status not null default 'pending',
  reject_reason     text check (char_length(reject_reason) <= 300),
  notes             text check (char_length(notes) <= 1000),
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  available_at      timestamptz,
  unique (file_id, version_number),
  foreign key (file_id, account_id) references public.files (id, account_id) on delete cascade
);
create index file_versions_account_idx on public.file_versions (account_id);
create index file_versions_file_idx on public.file_versions (file_id, version_number desc);

alter table public.files
  add foreign key (approved_version_id) references public.file_versions (id);

-- ----------------------------------------------- integridade e imutabilidade
create or replace function app_private.file_versions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- Só a rotina de eliminação RGPD (que define esta variável) pode apagar versões disponíveis.
    if old.status = 'available' and coalesce(current_setting('app.allow_erasure', true), '') <> 'on' then
      raise exception 'As versões de ficheiros são imutáveis e não podem ser apagadas'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  -- UPDATE: só pending → available/rejected; campos de identidade nunca mudam.
  if old.status <> 'pending'
     or new.status = 'pending'
     or new.id <> old.id or new.file_id <> old.file_id or new.account_id <> old.account_id
     or new.version_number <> old.version_number or new.storage_path <> old.storage_path
     or new.original_filename <> old.original_filename or new.extension <> old.extension
     or new.size_bytes <> old.size_bytes or new.declared_sha256 <> old.declared_sha256
     or new.created_by is distinct from old.created_by or new.created_at <> old.created_at
     or new.notes is distinct from old.notes then
    raise exception 'As versões de ficheiros são imutáveis'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger file_versions_guard before update or delete on public.file_versions
  for each row execute function app_private.file_versions_guard();

-- A versão aprovada tem de ser uma versão disponível do próprio ficheiro.
create or replace function app_private.files_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind <> old.kind or new.account_id <> old.account_id then
    raise exception 'O tipo e a conta de um ficheiro não podem ser alterados'
      using errcode = 'check_violation';
  end if;
  if new.approved_version_id is distinct from old.approved_version_id
     and new.approved_version_id is not null
     and not exists (select 1 from public.file_versions v
                     where v.id = new.approved_version_id and v.file_id = new.id
                       and v.status = 'available') then
    raise exception 'A versão aprovada tem de ser uma versão disponível deste ficheiro'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger files_guard before update on public.files
  for each row execute function app_private.files_guard();

-- Auditoria
create trigger audit_projects after insert or update or delete on public.projects
  for each row execute function app_private.audit_row();
create trigger audit_files after insert or update or delete on public.files
  for each row execute function app_private.audit_row();
create trigger audit_file_versions after insert or update or delete on public.file_versions
  for each row execute function app_private.audit_row();

-- ----------------------------------------------------------------- RLS
alter table public.file_type_rules enable row level security;
alter table public.projects        enable row level security;
alter table public.files           enable row level security;
alter table public.file_versions   enable row level security;

revoke all on public.file_type_rules, public.projects, public.files, public.file_versions
  from anon, authenticated;
grant select on public.file_type_rules to authenticated;
grant select, insert, update (name, description, status) on public.projects to authenticated;
grant select, update (display_name, project_id) on public.files to authenticated;
grant select on public.file_versions to authenticated;

create policy file_type_rules_select on public.file_type_rules for select to authenticated using (true);

-- Projetos: qualquer membro lê, cria e edita; a equipa lê.
create policy projects_select on public.projects for select to authenticated
  using (app_private.is_account_member(account_id) or app_private.is_staff());
create policy projects_insert on public.projects for insert to authenticated
  with check (app_private.is_account_member(account_id) and created_by = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (app_private.is_account_member(account_id))
  with check (app_private.is_account_member(account_id));

-- Ficheiros: criação só via RPC; membros leem/renomeiam; equipa lê.
create policy files_select on public.files for select to authenticated
  using (app_private.is_account_member(account_id) or app_private.is_staff());
create policy files_update on public.files for update to authenticated
  using (app_private.is_account_member(account_id))
  with check (app_private.is_account_member(account_id));

-- Versões: membros veem as disponíveis e as suas pendentes; equipa vê as disponíveis.
create policy file_versions_select on public.file_versions for select to authenticated
  using (
    (app_private.is_account_member(account_id) and (status = 'available' or created_by = auth.uid()))
    or (app_private.is_staff() and status = 'available')
  );

-- ------------------------------------------------------------------ RPCs
-- 1) Início de upload: valida tudo e reserva a versão (pending) + caminho no storage.
create or replace function public.begin_file_upload(
  p_account       uuid,
  p_project       uuid,
  p_file          uuid,
  p_display_name  text,
  p_filename      text,
  p_size          bigint,
  p_sha256        text,
  p_notes         text default null)
returns table (file_id uuid, version_id uuid, storage_path text, version_number int)
language plpgsql security definer set search_path = '' as $$
declare
  v_user    uuid := auth.uid();
  v_ext     text := lower(substring(p_filename from '\.([A-Za-z0-9]+)$'));
  v_rule    public.file_type_rules;
  v_file    public.files;
  v_file_id uuid;
  v_ver_id  uuid := gen_random_uuid();
  v_num     int;
begin
  if v_user is null or not app_private.is_account_member(p_account) then
    raise exception 'Sem permissão para carregar ficheiros nesta conta' using errcode = 'insufficient_privilege';
  end if;
  if v_ext is null then
    raise exception 'O ficheiro não tem extensão' using errcode = 'check_violation';
  end if;
  select * into v_rule from public.file_type_rules where extension = v_ext;
  if not found then
    raise exception 'Formato de ficheiro não suportado: .%', v_ext using errcode = 'check_violation';
  end if;
  if p_size is null or p_size <= 0 or p_size > v_rule.max_bytes then
    raise exception 'Tamanho do ficheiro inválido (máximo % bytes para .%)', v_rule.max_bytes, v_ext
      using errcode = 'check_violation';
  end if;
  -- Travão simples contra abuso: máx. 20 uploads por concluir por utilizador.
  if (select count(*) from public.file_versions v
      where v.created_by = v_user and v.status = 'pending' and v.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Demasiados carregamentos em curso. Tente novamente mais tarde.'
      using errcode = 'check_violation';
  end if;

  if p_file is null then
    if p_project is not null and not exists (
         select 1 from public.projects where id = p_project and account_id = p_account and status = 'active') then
      raise exception 'Projeto inválido' using errcode = 'check_violation';
    end if;
    insert into public.files (account_id, project_id, display_name, kind, created_by)
    values (p_account, p_project, btrim(p_display_name), v_rule.kind, v_user)
    returning id into v_file_id;
    v_num := 1;
  else
    -- Nova versão de um ficheiro existente: bloqueia a linha para numerar sem corridas.
    select * into v_file from public.files where id = p_file and account_id = p_account for update;
    if not found or v_file.archived_at is not null then
      raise exception 'Ficheiro inválido ou arquivado' using errcode = 'check_violation';
    end if;
    if v_file.kind <> v_rule.kind then
      raise exception 'A nova versão tem de ser do mesmo tipo de ficheiro' using errcode = 'check_violation';
    end if;
    v_file_id := v_file.id;
    select coalesce(max(v.version_number), 0) + 1 into v_num from public.file_versions v where v.file_id = v_file_id;
  end if;

  insert into public.file_versions (id, file_id, account_id, version_number, storage_path, original_filename,
                                    extension, size_bytes, declared_sha256, notes, created_by)
  values (v_ver_id, v_file_id, p_account, v_num,
          p_account::text || '/' || v_file_id::text || '/' || v_ver_id::text,
          p_filename, v_ext, p_size, lower(p_sha256), nullif(btrim(p_notes), ''), v_user);

  return query select v_file_id, v_ver_id, p_account::text || '/' || v_file_id::text || '/' || v_ver_id::text, v_num;
end;
$$;

-- 2) Conclusão/rejeição: SÓ o servidor (chave de serviço) depois de verificar o objeto.
create or replace function public.complete_file_upload(p_version uuid, p_size bigint, p_sha256 text)
returns public.file_version_status
language plpgsql security definer set search_path = '' as $$
declare
  v public.file_versions;
begin
  select * into v from public.file_versions where id = p_version for update;
  if not found or v.status <> 'pending' then
    raise exception 'Versão inexistente ou já concluída' using errcode = 'check_violation';
  end if;
  if p_size is distinct from v.size_bytes or lower(p_sha256) is distinct from v.declared_sha256 then
    update public.file_versions
       set status = 'rejected', reject_reason = 'Tamanho ou impressão digital não coincidem'
     where id = p_version;
    return 'rejected';
  end if;
  update public.file_versions
     set status = 'available', sha256 = lower(p_sha256), available_at = now()
   where id = p_version;
  return 'available';
end;
$$;

create or replace function public.reject_file_upload(p_version uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.file_versions
     set status = 'rejected', reject_reason = left(coalesce(p_reason, 'Rejeitado'), 300)
   where id = p_version and status = 'pending';
end;
$$;

-- 3) Aprovação explícita de uma versão (nunca automática).
create or replace function public.approve_file_version(p_version uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.file_versions;
begin
  select * into v from public.file_versions where id = p_version;
  if not found
     or not (app_private.is_account_admin(v.account_id) or app_private.is_staff_admin()) then
    raise exception 'Sem permissão para aprovar esta versão' using errcode = 'insufficient_privilege';
  end if;
  if v.status <> 'available' then
    raise exception 'Só versões disponíveis podem ser aprovadas' using errcode = 'check_violation';
  end if;
  update public.files
     set approved_version_id = v.id, approved_at = now(), approved_by = auth.uid()
   where id = v.file_id;
end;
$$;

create or replace function public.set_file_archived(p_file uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.files;
begin
  select * into f from public.files where id = p_file;
  if not found
     or not (app_private.is_account_admin(f.account_id) or app_private.is_staff_admin()) then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  update public.files set archived_at = case when p_archived then now() else null end where id = p_file;
end;
$$;

revoke all on function
  public.begin_file_upload(uuid, uuid, uuid, text, text, bigint, text, text),
  public.complete_file_upload(uuid, bigint, text),
  public.reject_file_upload(uuid, text),
  public.approve_file_version(uuid),
  public.set_file_archived(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.begin_file_upload(uuid, uuid, uuid, text, text, bigint, text, text),
  public.approve_file_version(uuid), public.set_file_archived(uuid, boolean) to authenticated;
grant execute on function public.complete_file_upload(uuid, bigint, text),
  public.reject_file_upload(uuid, text) to service_role;
