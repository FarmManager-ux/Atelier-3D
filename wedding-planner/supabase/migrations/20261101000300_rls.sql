-- O Nosso Casamento · RLS. Negar por omissão: só os membros do casamento acedem aos dados.
-- anon não tem NENHUM acesso direto às tabelas (a página pública de RSVP usa as RPC get_rsvp_invitation/submit_rsvp).

alter table public.weddings            enable row level security;
alter table public.wedding_members     enable row level security;
alter table public.wedding_invitations enable row level security;
alter table public.guest_groups        enable row level security;
alter table public.guests              enable row level security;
alter table public.invitations         enable row level security;
alter table public.rsvp_responses      enable row level security;
alter table public.tables              enable row level security;
alter table public.table_seats         enable row level security;
alter table public.guest_seatings      enable row level security;
alter table public.budget_categories   enable row level security;
alter table public.vendors             enable row level security;
alter table public.expenses            enable row level security;
alter table public.tasks               enable row level security;
alter table public.documents           enable row level security;
alter table public.calendar_events     enable row level security;

revoke all on
  public.weddings, public.wedding_members, public.wedding_invitations, public.guest_groups, public.guests,
  public.invitations, public.rsvp_responses, public.tables, public.table_seats, public.guest_seatings,
  public.budget_categories, public.vendors, public.expenses, public.tasks, public.documents, public.calendar_events
  from anon, authenticated;

-- Privilégios (a RLS limita ao casamento do utilizador).
grant select, update (name, partner1_name, partner2_name, wedding_date, venue_name, total_budget, preferences)
  on public.weddings to authenticated;
grant delete on public.weddings to authenticated;                         -- só o proprietário (política)
grant select, delete on public.wedding_members to authenticated;         -- criação por RPC
grant select, insert, delete on public.wedding_invitations to authenticated;
grant select, insert, update, delete on
  public.guest_groups, public.guests, public.budget_categories, public.vendors, public.expenses,
  public.tasks, public.calendar_events, public.tables to authenticated;
grant select, insert, delete on public.documents, public.rsvp_responses to authenticated;
grant update (name, category, notes, vendor_id) on public.documents to authenticated;
grant select on public.table_seats, public.guest_seatings to authenticated;  -- escrita só pelas RPC de mesas
grant select on public.invitations to authenticated;
grant update (rsvp_enabled, channel, sent_at, delivered_at, responded_at, last_contacted_at, notes)
  on public.invitations to authenticated;                                 -- o token só muda por RPC

-- casamento
create policy weddings_select on public.weddings for select to authenticated
  using (app_private.is_wedding_member(id));
create policy weddings_update on public.weddings for update to authenticated
  using (app_private.is_wedding_member(id)) with check (app_private.is_wedding_member(id));
create policy weddings_delete on public.weddings for delete to authenticated
  using (app_private.is_wedding_owner(id));

-- utilizadores: veem-se entre si; o proprietário remove outros; qualquer um pode sair (menos o proprietário).
create policy wedding_members_select on public.wedding_members for select to authenticated
  using (app_private.is_wedding_member(wedding_id));
create policy wedding_members_delete on public.wedding_members for delete to authenticated
  using ((app_private.is_wedding_owner(wedding_id) and role <> 'owner')
         or (user_id = auth.uid() and role <> 'owner'));

create policy wedding_invitations_select on public.wedding_invitations for select to authenticated
  using (app_private.is_wedding_member(wedding_id));
create policy wedding_invitations_insert on public.wedding_invitations for insert to authenticated
  with check (app_private.is_wedding_member(wedding_id) and invited_by = auth.uid() and accepted_at is null);
create policy wedding_invitations_delete on public.wedding_invitations for delete to authenticated
  using (app_private.is_wedding_member(wedding_id));

-- tabelas de dados do casamento: membros fazem tudo dentro do seu casamento.
do $$
declare t text;
begin
  foreach t in array array['guest_groups','guests','budget_categories','vendors','expenses','tasks','calendar_events','tables']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (app_private.is_wedding_member(wedding_id)) with check (app_private.is_wedding_member(wedding_id))', t || '_member', t);
  end loop;
  foreach t in array array['invitations','table_seats','guest_seatings']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (app_private.is_wedding_member(wedding_id))', t || '_select', t);
  end loop;
end $$;
create policy invitations_update on public.invitations for update to authenticated
  using (app_private.is_wedding_member(wedding_id)) with check (app_private.is_wedding_member(wedding_id));

create policy rsvp_responses_select on public.rsvp_responses for select to authenticated
  using (app_private.is_wedding_member(wedding_id));
create policy rsvp_responses_insert on public.rsvp_responses for insert to authenticated
  with check (app_private.is_wedding_member(wedding_id) and source = 'manual');
create policy rsvp_responses_delete on public.rsvp_responses for delete to authenticated
  using (app_private.is_wedding_member(wedding_id));

create policy documents_select on public.documents for select to authenticated
  using (app_private.is_wedding_member(wedding_id));
create policy documents_insert on public.documents for insert to authenticated
  with check (app_private.is_wedding_member(wedding_id) and uploaded_by = auth.uid());
create policy documents_update on public.documents for update to authenticated
  using (app_private.is_wedding_member(wedding_id)) with check (app_private.is_wedding_member(wedding_id));
create policy documents_delete on public.documents for delete to authenticated
  using (app_private.is_wedding_member(wedding_id));
