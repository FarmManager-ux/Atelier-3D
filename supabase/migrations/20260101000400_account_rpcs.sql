-- Fase 0 · Operações controladas (RPC) para criar contas e gerir convites.

create or replace function public.create_account(p_type public.account_type, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'Autenticação necessária' using errcode = 'insufficient_privilege';
  end if;
  if p_type = 'individual' and exists (
       select 1 from public.account_members m join public.accounts a on a.id = m.account_id
       where m.user_id = v_user and a.type = 'individual') then
    raise exception 'Já existe uma conta de particular para este utilizador'
      using errcode = 'unique_violation';
  end if;
  insert into public.accounts (type, display_name, created_by)
  values (p_type, btrim(p_display_name), v_user)
  returning id into v_id;
  insert into public.account_members (account_id, user_id, role) values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

-- Devolve o token em claro UMA vez (para o link do convite); só o hash fica na BD.
create or replace function public.invite_member(
  p_account uuid, p_email text, p_role public.account_role default 'member')
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_caller public.account_role := app_private.account_role(p_account);
begin
  if v_caller is null or v_caller = 'member' then
    raise exception 'Sem permissão para convidar' using errcode = 'insufficient_privilege';
  end if;
  if p_role = 'owner' then
    raise exception 'Não é possível convidar diretamente um proprietário'
      using errcode = 'check_violation';
  end if;
  if p_role = 'admin' and v_caller <> 'owner' then
    raise exception 'Apenas proprietários podem convidar administradores'
      using errcode = 'insufficient_privilege';
  end if;
  if (select type from public.accounts where id = p_account) <> 'company' then
    raise exception 'Só contas de empresa podem ter vários utilizadores'
      using errcode = 'check_violation';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.account_invitations (account_id, email, role, token_hash, invited_by, expires_at)
  values (p_account, lower(btrim(p_email)), p_role,
          encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(),
          now() + interval '7 days');
  return v_token;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_inv   public.account_invitations;
begin
  if v_user is null then
    raise exception 'Autenticação necessária' using errcode = 'insufficient_privilege';
  end if;
  select email into v_email from auth.users where id = v_user;
  select * into v_inv from public.account_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;
  -- Mensagem única para não revelar se o convite existe.
  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now()
     or lower(v_inv.email::text) <> lower(coalesce(v_email, '')) then
    raise exception 'Convite inválido ou expirado' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.account_members (account_id, user_id, role)
  values (v_inv.account_id, v_user, v_inv.role)
  on conflict (account_id, user_id) do nothing;
  update public.account_invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.account_id;
end;
$$;

revoke all on function public.create_account(public.account_type, text),
  public.invite_member(uuid, text, public.account_role),
  public.accept_invitation(text) from public, anon;
grant execute on function public.create_account(public.account_type, text),
  public.invite_member(uuid, text, public.account_role),
  public.accept_invitation(text) to authenticated;
