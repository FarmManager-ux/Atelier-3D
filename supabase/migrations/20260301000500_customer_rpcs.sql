-- Atelier 3D Portal · Operações controladas (RPC) sobre contas de clientes.

create function public.create_customer_account(p_kind public.customer_kind, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'Autenticação necessária' using errcode = 'insufficient_privilege';
  end if;
  if p_kind = 'individual' and exists (
       select 1 from public.customer_members m join public.customer_accounts a on a.id = m.account_id
       where m.user_id = v_user and a.kind = 'individual') then
    raise exception 'Já existe uma conta de particular para este utilizador' using errcode = 'unique_violation';
  end if;
  insert into public.customer_accounts (kind, display_name, created_by)
  values (p_kind, btrim(p_display_name), v_user) returning id into v_id;
  insert into public.customer_members (account_id, user_id, role) values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

-- Devolve o token em claro UMA vez; só o hash fica na base de dados.
create function public.invite_customer_member(
  p_account uuid, p_email text, p_role public.customer_role default 'member')
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token  text;
  v_caller public.customer_role := app_private.customer_role(p_account);
begin
  if v_caller is null or v_caller = 'member' then
    raise exception 'Sem permissão para convidar' using errcode = 'insufficient_privilege';
  end if;
  if p_role = 'owner' then
    raise exception 'Não é possível convidar diretamente um proprietário' using errcode = 'check_violation';
  end if;
  if p_role = 'admin' and v_caller <> 'owner' then
    raise exception 'Apenas proprietários podem convidar administradores' using errcode = 'insufficient_privilege';
  end if;
  if (select kind from public.customer_accounts where id = p_account) <> 'company' then
    raise exception 'Só contas de empresa podem ter vários utilizadores' using errcode = 'check_violation';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.customer_invitations (account_id, email, role, token_hash, invited_by, expires_at)
  values (p_account, lower(btrim(p_email)), p_role,
          encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), now() + interval '7 days');
  return v_token;
end;
$$;

create function public.accept_customer_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_inv   public.customer_invitations;
begin
  if v_user is null then
    raise exception 'Autenticação necessária' using errcode = 'insufficient_privilege';
  end if;
  select email into v_email from auth.users where id = v_user;
  select * into v_inv from public.customer_invitations
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  -- Mensagem única: não revela se o convite existe.
  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now()
     or lower(v_inv.email::text) <> lower(coalesce(v_email, '')) then
    raise exception 'Convite inválido ou expirado' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.customer_members (account_id, user_id, role)
  values (v_inv.account_id, v_user, v_inv.role) on conflict (account_id, user_id) do nothing;
  update public.customer_invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.account_id;
end;
$$;

revoke all on function public.create_customer_account(public.customer_kind, text),
  public.invite_customer_member(uuid, text, public.customer_role),
  public.accept_customer_invitation(text) from public, anon;
grant execute on function public.create_customer_account(public.customer_kind, text),
  public.invite_customer_member(uuid, text, public.customer_role),
  public.accept_customer_invitation(text) to authenticated;
