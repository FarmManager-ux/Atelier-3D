-- Fase 0 · Registo de auditoria append-only.
-- Nunca guarda valores de dados pessoais/fiscais: apenas nomes de colunas alteradas.

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

create or replace function app_private.audit_log_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'O registo de auditoria é só de acrescentar (append-only)'
    using errcode = 'insufficient_privilege';
end;
$$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function app_private.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function app_private.audit_log_immutable();

create or replace function app_private.write_audit(
  p_action text, p_entity_type text, p_entity_id text,
  p_account_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_user_id, account_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_account_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function app_private.write_audit(text, text, text, uuid, jsonb) from public, authenticated;
grant execute on function app_private.write_audit(text, text, text, uuid, jsonb) to service_role;

-- Trigger genérico para as tabelas da Fase 0.
create or replace function app_private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row      jsonb;
  v_old      jsonb;
  v_account  uuid;
  v_entity   text;
  v_meta     jsonb := '{}'::jsonb;
begin
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) end;

  if tg_table_name = 'accounts' then
    v_account := (v_row ->> 'id')::uuid;
    v_entity  := v_row ->> 'id';
  elsif tg_table_name = 'account_members' then
    v_account := (v_row ->> 'account_id')::uuid;
    v_entity  := (v_row ->> 'user_id');
    v_meta    := jsonb_build_object('role', v_row ->> 'role');
    if tg_op = 'UPDATE' then
      v_meta := v_meta || jsonb_build_object('previous_role', v_old ->> 'role');
    end if;
  elsif tg_table_name = 'account_invitations' then
    v_account := (v_row ->> 'account_id')::uuid;
    v_entity  := v_row ->> 'id';
    v_meta    := jsonb_build_object('role', v_row ->> 'role');
  else
    v_account := (v_row ->> 'account_id')::uuid;
    v_entity  := coalesce(v_row ->> 'id', v_row ->> 'account_id');
  end if;

  if tg_op = 'UPDATE' then
    v_meta := v_meta || jsonb_build_object('changed', (
      select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
      from jsonb_each(to_jsonb(new)) n
      where n.value is distinct from v_old -> n.key
        and n.key not in ('updated_at')));
  end if;

  insert into public.audit_log (actor_user_id, account_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_account, tg_table_name || '.' || lower(tg_op), tg_table_name, v_entity, v_meta);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger audit_accounts after insert or update or delete on public.accounts
  for each row execute function app_private.audit_row();
create trigger audit_account_fiscal after insert or update or delete on public.account_fiscal_data
  for each row execute function app_private.audit_row();
create trigger audit_account_members after insert or update or delete on public.account_members
  for each row execute function app_private.audit_row();
create trigger audit_account_invitations after insert or update or delete on public.account_invitations
  for each row execute function app_private.audit_row();
