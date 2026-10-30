-- Atelier 3D Portal · RLS. Negar por omissão; só o necessário é aberto.
-- Regra para tabelas futuras: RLS ativa, "revoke all ... from anon", privilégios explícitos e testes de isolamento.

alter table public.profiles                  enable row level security;
alter table public.permissions               enable row level security;
alter table public.staff_roles               enable row level security;
alter table public.role_permissions          enable row level security;
alter table public.staff_members             enable row level security;
alter table public.customer_accounts         enable row level security;
alter table public.customer_members          enable row level security;
alter table public.customer_invitations      enable row level security;
alter table public.customer_billing_profiles enable row level security;
alter table public.audit_log                 enable row level security;

revoke all on public.profiles, public.permissions, public.staff_roles, public.role_permissions,
  public.staff_members, public.customer_accounts, public.customer_members,
  public.customer_invitations, public.customer_billing_profiles, public.audit_log
  from anon, authenticated;

grant select, update (full_name, phone, locale) on public.profiles to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update (label), delete on public.staff_roles to authenticated;
grant select, insert, delete on public.role_permissions to authenticated;
grant select, insert, update (role_key, active), delete on public.staff_members to authenticated;
grant select, update (display_name, status) on public.customer_accounts to authenticated;
grant select, update (role), delete on public.customer_members to authenticated;
grant select, delete on public.customer_invitations to authenticated;
grant select, insert, update on public.customer_billing_profiles to authenticated;
grant select on public.audit_log to authenticated;

-- perfis: cada utilizador o seu; a equipa com acesso a clientes vê os perfis.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app_private.has_permission('customers.read') or app_private.has_permission('crm.read'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- catálogo de permissões e funções: visível à equipa; funções personalizadas geridas por "staff.manage".
create policy permissions_select on public.permissions for select to authenticated using (app_private.is_staff());
create policy staff_roles_select on public.staff_roles for select to authenticated using (app_private.is_staff());
create policy staff_roles_insert on public.staff_roles for insert to authenticated
  with check (app_private.has_permission('staff.manage') and not is_system);
create policy staff_roles_update on public.staff_roles for update to authenticated
  using (app_private.has_permission('staff.manage') and not is_system)
  with check (app_private.has_permission('staff.manage') and not is_system);
create policy staff_roles_delete on public.staff_roles for delete to authenticated
  using (app_private.has_permission('staff.manage') and not is_system);

create policy role_permissions_select on public.role_permissions for select to authenticated using (app_private.is_staff());
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (app_private.has_permission('staff.manage')
              and exists (select 1 from public.staff_roles r where r.key = role_key and not r.is_system));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (app_private.has_permission('staff.manage')
         and exists (select 1 from public.staff_roles r where r.key = role_key and not r.is_system));

-- equipa: cada membro vê a sua linha; "staff.manage" gere todas.
create policy staff_members_select on public.staff_members for select to authenticated
  using (user_id = auth.uid() or app_private.has_permission('staff.manage'));
create policy staff_members_insert on public.staff_members for insert to authenticated
  with check (app_private.has_permission('staff.manage'));
create policy staff_members_update on public.staff_members for update to authenticated
  using (app_private.has_permission('staff.manage')) with check (app_private.has_permission('staff.manage'));
create policy staff_members_delete on public.staff_members for delete to authenticated
  using (app_private.has_permission('staff.manage'));

-- contas de clientes: membros e equipa com "customers.read" leem; edição pelos admins da conta ou "customers.write".
create policy customer_accounts_select on public.customer_accounts for select to authenticated
  using (app_private.is_customer_member(id) or app_private.has_permission('customers.read'));
create policy customer_accounts_update on public.customer_accounts for update to authenticated
  using (app_private.is_customer_admin(id) or app_private.has_permission('customers.write'))
  with check (app_private.is_customer_admin(id) or app_private.has_permission('customers.write'));

-- membros: colegas veem-se; owner gere todos; admin gere não-proprietários; qualquer um pode sair.
create policy customer_members_select on public.customer_members for select to authenticated
  using (app_private.is_customer_member(account_id) or app_private.has_permission('customers.read'));
create policy customer_members_update on public.customer_members for update to authenticated
  using (app_private.customer_role(account_id) = 'owner'
         or (app_private.customer_role(account_id) = 'admin' and role <> 'owner'))
  with check (app_private.customer_role(account_id) = 'owner'
         or (app_private.customer_role(account_id) = 'admin' and role <> 'owner'));
create policy customer_members_delete on public.customer_members for delete to authenticated
  using (user_id = auth.uid()
         or app_private.customer_role(account_id) = 'owner'
         or (app_private.customer_role(account_id) = 'admin' and role <> 'owner'));

create policy customer_invitations_select on public.customer_invitations for select to authenticated
  using (app_private.is_customer_admin(account_id) or app_private.has_permission('customers.write'));
create policy customer_invitations_delete on public.customer_invitations for delete to authenticated
  using (app_private.is_customer_admin(account_id));

-- faturação: admins da conta; equipa só com permissões específicas de faturação.
create policy billing_select on public.customer_billing_profiles for select to authenticated
  using (app_private.is_customer_admin(account_id) or app_private.has_permission('customers.billing.read'));
create policy billing_insert on public.customer_billing_profiles for insert to authenticated
  with check (app_private.is_customer_admin(account_id) or app_private.has_permission('customers.billing.write'));
create policy billing_update on public.customer_billing_profiles for update to authenticated
  using (app_private.is_customer_admin(account_id) or app_private.has_permission('customers.billing.write'))
  with check (app_private.is_customer_admin(account_id) or app_private.has_permission('customers.billing.write'));

-- auditoria: "audit.read" vê tudo; admins de uma conta veem a da sua conta.
create policy audit_select on public.audit_log for select to authenticated
  using (app_private.has_permission('audit.read')
         or (account_id is not null and app_private.is_customer_admin(account_id)));
