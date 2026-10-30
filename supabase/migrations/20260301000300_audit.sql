-- Atelier 3D Portal · Auditoria append-only.
-- Guarda ações e NOMES de colunas alteradas; valores só para colunas explicitamente marcadas como seguras.

create table public.audit_log (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid,
  account_id     uuid,
  action         text not null,
  entity_type    text not null,
  entity_id      text,
  metadata       jsonb not null default '{}'::jsonb
);
create index audit_log_account_idx on public.audit_log (account_id, occurred_at desc);
create index audit_log_actor_idx   on public.audit_log (actor_user_id, occurred_at desc);
create index audit_log_entity_idx  on public.audit_log (entity_type, entity_id);

create function app_private.audit_log_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'O registo de auditoria é só de acrescentar (append-only)' using errcode = 'insufficient_privilege';
end;
$$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function app_private.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function app_private.audit_log_immutable();

-- Eventos de aplicação (ex.: "orçamento enviado"). Só o servidor (chave de serviço).
create function app_private.write_audit(
  p_action text, p_entity_type text, p_entity_id text, p_account_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_user_id, account_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_account_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function app_private.write_audit(text, text, text, uuid, jsonb) from public, authenticated;
grant execute on function app_private.write_audit(text, text, text, uuid, jsonb) to service_role;

-- Gatilho genérico, reutilizável por TODAS as tabelas futuras.
--   argumento 1: coluna com o id da conta de cliente (ou '' se não aplicável)
--   argumento 2: coluna com o id da entidade (por omissão "id")
--   argumento 3: colunas (separadas por vírgula) cujos VALORES são seguros de registar
create function app_private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_acc_col  text := nullif(tg_argv[0], '');
  v_id_col   text := coalesce(nullif(tg_argv[1], ''), 'id');
  v_safe     text[] := string_to_array(coalesce(tg_argv[2], ''), ',');
  v_row      jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_old      jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_meta     jsonb := '{}'::jsonb;
begin
  if array_length(v_safe, 1) > 0 and v_safe[1] <> '' then
    v_meta := jsonb_build_object('safe', (
      select coalesce(jsonb_object_agg(k, coalesce(v_row -> k, 'null'::jsonb)), '{}'::jsonb)
      from unnest(v_safe) k where k <> ''));
  end if;
  if tg_op = 'UPDATE' then
    v_meta := v_meta || jsonb_build_object(
      'changed', (select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
                  from jsonb_each(to_jsonb(new)) n
                  where n.value is distinct from v_old -> n.key and n.key <> 'updated_at'),
      'previous', (select coalesce(jsonb_object_agg(k, v_old -> k), '{}'::jsonb)
                   from unnest(v_safe) k
                   where k <> '' and (v_row -> k) is distinct from (v_old -> k)));
  end if;

  insert into public.audit_log (actor_user_id, account_id, action, entity_type, entity_id, metadata)
  values (auth.uid(),
          case when v_acc_col is null then null else (v_row ->> v_acc_col)::uuid end,
          tg_table_name || '.' || lower(tg_op), tg_table_name, v_row ->> v_id_col, v_meta);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger audit_customer_accounts after insert or update or delete on public.customer_accounts
  for each row execute function app_private.audit_row('id', 'id', 'kind,status');
create trigger audit_customer_members after insert or update or delete on public.customer_members
  for each row execute function app_private.audit_row('account_id', 'user_id', 'role');
create trigger audit_customer_invitations after insert or update or delete on public.customer_invitations
  for each row execute function app_private.audit_row('account_id', 'id', 'role');
create trigger audit_customer_billing after insert or update or delete on public.customer_billing_profiles
  for each row execute function app_private.audit_row('account_id', 'account_id', '');
create trigger audit_staff_members after insert or update or delete on public.staff_members
  for each row execute function app_private.audit_row('', 'user_id', 'role_key,active');
create trigger audit_staff_roles after insert or update or delete on public.staff_roles
  for each row execute function app_private.audit_row('', 'key', '');
create trigger audit_role_permissions after insert or delete on public.role_permissions
  for each row execute function app_private.audit_row('', 'role_key', 'permission_key');
