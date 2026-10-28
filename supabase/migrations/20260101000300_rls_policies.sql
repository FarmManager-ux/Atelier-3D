-- Fase 0 · Row-Level Security. Negar por omissão; só o necessário é aberto.

alter table public.profiles             enable row level security;
alter table public.staff_members        enable row level security;
alter table public.accounts             enable row level security;
alter table public.account_fiscal_data  enable row level security;
alter table public.account_members      enable row level security;
alter table public.account_invitations  enable row level security;
alter table public.audit_log            enable row level security;

-- Nenhum acesso para utilizadores anónimos; privilégios mínimos para autenticados.
revoke all on public.profiles, public.staff_members, public.accounts,
  public.account_fiscal_data, public.account_members, public.account_invitations,
  public.audit_log from anon, authenticated;

grant select, update (full_name, phone, locale) on public.profiles to authenticated;
grant select on public.staff_members to authenticated;
grant select, update (display_name) on public.accounts to authenticated;
grant select, insert, update on public.account_fiscal_data to authenticated;
grant select, update (role), delete on public.account_members to authenticated;
grant select, delete on public.account_invitations to authenticated;
grant select on public.audit_log to authenticated;

-- profiles: cada utilizador vê/edita o seu; a equipa vê todos (para atendimento).
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app_private.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- staff_members: cada membro da equipa só vê a sua própria linha.
create policy staff_select_self on public.staff_members for select to authenticated
  using (user_id = auth.uid());

-- accounts: só membros (e equipa) leem; só owner/admin editam. Criação via RPC.
create policy accounts_select on public.accounts for select to authenticated
  using (app_private.is_account_member(id) or app_private.is_staff());
create policy accounts_update on public.accounts for update to authenticated
  using (app_private.is_account_admin(id) or app_private.is_staff_admin())
  with check (app_private.is_account_admin(id) or app_private.is_staff_admin());

-- dados fiscais: owner/admin da conta e admins da equipa. Operadores NÃO.
create policy fiscal_select on public.account_fiscal_data for select to authenticated
  using (app_private.is_account_admin(account_id) or app_private.is_staff_admin());
create policy fiscal_insert on public.account_fiscal_data for insert to authenticated
  with check (app_private.is_account_admin(account_id) or app_private.is_staff_admin());
create policy fiscal_update on public.account_fiscal_data for update to authenticated
  using (app_private.is_account_admin(account_id) or app_private.is_staff_admin())
  with check (app_private.is_account_admin(account_id) or app_private.is_staff_admin());

-- membros: colegas veem-se; owner gere todos; admin gere não-proprietários;
-- qualquer um pode sair da conta (protegido pelo gatilho do último proprietário).
create policy members_select on public.account_members for select to authenticated
  using (app_private.is_account_member(account_id) or app_private.is_staff());
create policy members_update on public.account_members for update to authenticated
  using (app_private.account_role(account_id) = 'owner'
         or (app_private.account_role(account_id) = 'admin' and role <> 'owner'))
  with check (app_private.account_role(account_id) = 'owner'
         or (app_private.account_role(account_id) = 'admin' and role <> 'owner'));
create policy members_delete on public.account_members for delete to authenticated
  using (user_id = auth.uid()
         or app_private.account_role(account_id) = 'owner'
         or (app_private.account_role(account_id) = 'admin' and role <> 'owner'));

-- convites: owner/admin veem e revogam; criação e aceitação via RPC.
create policy invitations_select on public.account_invitations for select to authenticated
  using (app_private.is_account_admin(account_id) or app_private.is_staff_admin());
create policy invitations_delete on public.account_invitations for delete to authenticated
  using (app_private.is_account_admin(account_id));

-- auditoria: owner/admin vêem a da sua conta; admins da equipa vêem tudo.
create policy audit_select on public.audit_log for select to authenticated
  using (app_private.is_staff_admin()
         or (account_id is not null and app_private.is_account_admin(account_id)));
