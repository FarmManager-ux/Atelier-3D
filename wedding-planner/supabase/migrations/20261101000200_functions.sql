-- O Nosso Casamento · Regras de negócio na base de dados:
-- lugares das mesas (capacidade e unicidade garantidas), estados dos convites e RSVP seguro por token.
--
-- Códigos de erro próprios:  WP001 = mesa sem lugares suficientes · WP002 = convidado não vai comparecer.

-- ----------------------------------------------------------- permissões
create function app_private.is_wedding_member(p_wedding uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.wedding_members m where m.wedding_id = p_wedding and m.user_id = auth.uid());
$$;

create function app_private.is_wedding_owner(p_wedding uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.wedding_members m
                 where m.wedding_id = p_wedding and m.user_id = auth.uid() and m.role = 'owner');
$$;

-- No máximo 6 utilizadores por casamento (a aplicação é privada para os noivos).
create function app_private.wedding_members_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.wedding_members where wedding_id = new.wedding_id) >= 6 then
    raise exception 'Limite de utilizadores atingido (6)' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger wedding_members_limit before insert on public.wedding_members
  for each row execute function app_private.wedding_members_limit();

-- ------------------------------------------- lugares das mesas: sincronização
create function app_private.sync_table_seats()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_occupied int;
  r          record;
  v_free     uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.table_seats (table_id, wedding_id, seat_number)
    select new.id, new.wedding_id, g from generate_series(1, new.capacity) g;
    return new;
  end if;
  if new.capacity = old.capacity then return new; end if;

  if new.capacity > old.capacity then
    insert into public.table_seats (table_id, wedding_id, seat_number)
    select new.id, new.wedding_id, g from generate_series(old.capacity + 1, new.capacity) g;
    return new;
  end if;

  select count(*) into v_occupied from public.guest_seatings where table_id = new.id;
  if v_occupied > new.capacity then
    raise exception 'A mesa "%" tem % pessoas sentadas e não pode ter capacidade %', new.name, v_occupied, new.capacity
      using errcode = 'check_violation';
  end if;
  -- Reagrupa quem está em lugares que vão desaparecer para os primeiros lugares livres.
  for r in
    select gs.id as seating_id from public.guest_seatings gs
      join public.table_seats ts on ts.id = gs.seat_id
     where gs.table_id = new.id and ts.seat_number > new.capacity
     order by ts.seat_number
  loop
    select ts.id into v_free from public.table_seats ts
     where ts.table_id = new.id and ts.seat_number <= new.capacity
       and not exists (select 1 from public.guest_seatings g2 where g2.seat_id = ts.id)
     order by ts.seat_number limit 1;
    update public.guest_seatings set seat_id = v_free where id = r.seating_id;
  end loop;
  delete from public.table_seats where table_id = new.id and seat_number > new.capacity;
  return new;
end;
$$;
create trigger tables_sync_seats after insert or update of capacity on public.tables
  for each row execute function app_private.sync_table_seats();

-- Defesa em profundidade: um convidado só pode estar numa mesa e não pode ocupar mais lugares do que as pessoas esperadas.
create function app_private.guest_seatings_guard()
returns trigger language plpgsql set search_path = '' as $$
declare v_expected int;
begin
  if exists (select 1 from public.guest_seatings where guest_id = new.guest_id and table_id <> new.table_id) then
    raise exception 'O convidado já está sentado noutra mesa' using errcode = 'check_violation';
  end if;
  select expected_count into v_expected from public.guests where id = new.guest_id;
  if new.person_index >= coalesce(v_expected, 0) then
    raise exception 'O convidado não tem pessoas a sentar neste lugar' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger guest_seatings_guard before insert on public.guest_seatings
  for each row execute function app_private.guest_seatings_guard();

-- Coloca TODAS as pessoas de um convidado na mesa indicada (atómico: ou cabe tudo ou nada muda).
create function app_private.place_guest(p_guest uuid, p_table uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_g     public.guests;
  v_t     public.tables;
  v_have  int;
  v_need  int;
  v_seats uuid[];
begin
  select * into v_g from public.guests where id = p_guest for update;
  if not found then raise exception 'Convidado não encontrado' using errcode = 'no_data_found'; end if;
  select * into v_t from public.tables where id = p_table for update;
  if not found or v_t.wedding_id <> v_g.wedding_id then
    raise exception 'Mesa não encontrada' using errcode = 'no_data_found';
  end if;
  if v_g.expected_count = 0 then
    raise exception '% não vai comparecer e não precisa de lugar', v_g.full_name using errcode = 'WP002';
  end if;

  delete from public.guest_seatings where guest_id = p_guest and table_id <> p_table;
  delete from public.guest_seatings where guest_id = p_guest and person_index >= v_g.expected_count;
  select count(*) into v_have from public.guest_seatings where guest_id = p_guest;
  v_need := v_g.expected_count - v_have;
  if v_need <= 0 then return; end if;

  select coalesce(array_agg(id), '{}') into v_seats from (
    select ts.id from public.table_seats ts
     where ts.table_id = p_table
       and not exists (select 1 from public.guest_seatings gs where gs.seat_id = ts.id)
     order by ts.seat_number limit v_need) s;
  if coalesce(array_length(v_seats, 1), 0) < v_need then
    raise exception 'A mesa "%" não tem lugares suficientes (faltam %)', v_t.name, v_need - coalesce(array_length(v_seats, 1), 0)
      using errcode = 'WP001';
  end if;

  insert into public.guest_seatings (wedding_id, guest_id, table_id, seat_id, person_index)
  select v_g.wedding_id, p_guest, p_table, s.id, v_have + s.ord - 1
    from unnest(v_seats) with ordinality as s(id, ord);
end;
$$;

-- Reajusta os lugares quando o número de pessoas esperadas muda (acompanhantes, RSVP...).
create function app_private.resync_guest_seatings(p_guest uuid, p_unseat_on_overflow boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_table    uuid;
  v_expected int;
begin
  select table_id into v_table from public.guest_seatings where guest_id = p_guest limit 1;
  if v_table is null then return; end if;
  select expected_count into v_expected from public.guests where id = p_guest;
  if v_expected = 0 then
    delete from public.guest_seatings where guest_id = p_guest;
    return;
  end if;
  begin
    perform app_private.place_guest(p_guest, v_table);
  exception when sqlstate 'WP001' then
    if p_unseat_on_overflow then
      delete from public.guest_seatings where guest_id = p_guest;
    else
      raise;
    end if;
  end;
end;
$$;

-- -------------------------------------------------- gatilhos dos convidados
create function app_private.guests_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.invitations (wedding_id, guest_id, sent_at, delivered_at, responded_at)
  values (new.wedding_id, new.id,
          case when new.invitation_status <> 'por_convidar' then now() end,
          case when new.invitation_status = 'entregue' then now() end,
          case when new.rsvp_status <> 'sem_resposta' then now() end);
  return new;
end;
$$;
create trigger guests_after_insert after insert on public.guests
  for each row execute function app_private.guests_after_insert();

-- Datas do convite acompanham o estado (só preenche se estiver vazio: datas manuais prevalecem).
create function app_private.guests_invitation_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.invitation_status = 'por_convidar' then
    update public.invitations set sent_at = null, delivered_at = null where guest_id = new.id;
  else
    update public.invitations
       set sent_at = coalesce(sent_at, now()),
           delivered_at = case when new.invitation_status = 'entregue' then coalesce(delivered_at, now()) else delivered_at end
     where guest_id = new.id;
  end if;
  return new;
end;
$$;
create trigger guests_invitation_stamp after update of invitation_status on public.guests
  for each row when (old.invitation_status is distinct from new.invitation_status)
  execute function app_private.guests_invitation_stamp();

create function app_private.guests_rsvp_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.rsvp_status = 'sem_resposta' then
    update public.invitations set responded_at = null where guest_id = new.id;
  else
    update public.invitations set responded_at = coalesce(responded_at, now()) where guest_id = new.id;
  end if;
  return new;
end;
$$;
create trigger guests_rsvp_stamp after update of rsvp_status on public.guests
  for each row when (old.rsvp_status is distinct from new.rsvp_status)
  execute function app_private.guests_rsvp_stamp();

create function app_private.guests_resync_seats()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.resync_guest_seatings(
    new.id, coalesce(current_setting('app.unseat_on_overflow', true), '') = 'on');
  return new;
end;
$$;
create trigger guests_resync_seats after update on public.guests
  for each row when (old.expected_count is distinct from new.expected_count)
  execute function app_private.guests_resync_seats();

-- ---------------------------------------------------------- tarefas
create function app_private.tasks_completed_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'concluida' then
    new.completed_at = coalesce(new.completed_at, now());
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;
create trigger tasks_completed_stamp before insert or update of status on public.tasks
  for each row execute function app_private.tasks_completed_stamp();

-- ================================================================ API (RPC)
-- Mesas: atribuir/mover e retirar convidados.
create function public.assign_guest_to_table(p_guest uuid, p_table uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_wedding_member((select wedding_id from public.guests where id = p_guest)) then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  perform app_private.place_guest(p_guest, p_table);
end;
$$;

create function public.unassign_guest(p_guest uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_wedding_member((select wedding_id from public.guests where id = p_guest)) then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  delete from public.guest_seatings where guest_id = p_guest;
end;
$$;

-- Convites: gerar um novo link de RSVP (o anterior deixa de funcionar).
create function public.regenerate_rsvp_token(p_guest uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  if not app_private.is_wedding_member((select wedding_id from public.guests where id = p_guest)) then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  update public.invitations set token = v_token where guest_id = p_guest;
  return v_token;
end;
$$;

-- Aplica uma resposta de presença (usada pelo link público e pelo registo manual).
create function app_private.apply_rsvp(
  p_guest uuid, p_status text, p_companions int, p_children int, p_names text,
  p_dietary text, p_allergies text, p_message text, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_g public.guests;
begin
  select * into v_g from public.guests where id = p_guest for update;
  if not found then raise exception 'Convidado não encontrado' using errcode = 'no_data_found'; end if;
  if p_status not in ('confirmado', 'nao_vai') then
    raise exception 'Resposta inválida' using errcode = 'invalid_parameter_value';
  end if;
  if p_status = 'confirmado' then
    if p_companions is null or p_companions < 0 or p_companions > v_g.companions_count then
      raise exception 'Número de acompanhantes inválido (máximo %)', v_g.companions_count using errcode = 'invalid_parameter_value';
    end if;
    if p_children is null or p_children < 0 or p_children > v_g.children_count then
      raise exception 'Número de crianças inválido (máximo %)', v_g.children_count using errcode = 'invalid_parameter_value';
    end if;
  end if;
  -- Resposta pelo link: se já não houver lugar na mesa, o convidado fica sem mesa (em vez de falhar).
  perform set_config('app.unseat_on_overflow', case when p_source = 'link' then 'on' else 'off' end, true);

  update public.guests set
    rsvp_status          = p_status::public.rsvp_status,
    attending_companions = case when p_status = 'confirmado' then p_companions end,
    attending_children   = case when p_status = 'confirmado' then p_children end,
    companion_names      = case when p_names is null then companion_names else nullif(btrim(p_names), '') end,
    dietary_restrictions = case when p_dietary is null then dietary_restrictions else nullif(btrim(p_dietary), '') end,
    allergies            = case when p_allergies is null then allergies else nullif(btrim(p_allergies), '') end,
    invitation_status    = case when invitation_status in ('por_convidar', 'enviado') then 'entregue' else invitation_status end
  where id = p_guest;
  update public.invitations set responded_at = now() where guest_id = p_guest;

  insert into public.rsvp_responses (wedding_id, guest_id, status, companions_attending, children_attending,
                                     dietary_restrictions, allergies, message, source)
  values (v_g.wedding_id, p_guest, p_status::public.rsvp_status,
          case when p_status = 'confirmado' then p_companions else 0 end,
          case when p_status = 'confirmado' then p_children else 0 end,
          nullif(btrim(p_dietary), ''), nullif(btrim(p_allergies), ''), nullif(btrim(p_message), ''), p_source);
end;
$$;

create function public.record_manual_rsvp(
  p_guest uuid, p_status text, p_companions int default 0, p_children int default 0,
  p_dietary text default null, p_allergies text default null, p_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_wedding_member((select wedding_id from public.guests where id = p_guest)) then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  perform app_private.apply_rsvp(p_guest, p_status, p_companions, p_children, null, p_dietary, p_allergies, p_message, 'manual');
end;
$$;

-- Informação mínima mostrada na página pública de RSVP (nunca contactos nem dados de outros convidados).
create function app_private.rsvp_payload(p_invitation uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'wedding', jsonb_build_object('name', w.name, 'partner1', w.partner1_name, 'partner2', w.partner2_name,
                                  'date', w.wedding_date, 'venue', w.venue_name),
    'guest', jsonb_build_object('name', g.full_name, 'authorized_companions', g.companions_count,
                                'authorized_children', g.children_count, 'companion_names', g.companion_names),
    'current', jsonb_build_object('status', g.rsvp_status, 'companions', g.attending_companions,
                                  'children', g.attending_children,
                                  'dietary_restrictions', g.dietary_restrictions, 'allergies', g.allergies))
  from public.invitations i
  join public.guests g on g.id = i.guest_id
  join public.weddings w on w.id = i.wedding_id
  where i.id = p_invitation;
$$;

create function public.get_rsvp_invitation(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.invitations where token = p_token and rsvp_enabled;
  if v_id is null then
    raise exception 'Link de confirmação inválido ou desativado' using errcode = 'invalid_parameter_value';
  end if;
  return app_private.rsvp_payload(v_id);
end;
$$;

create function public.submit_rsvp(
  p_token text, p_status text, p_companions int default 0, p_children int default 0,
  p_companion_names text default null, p_dietary text default null, p_allergies text default null,
  p_message text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where token = p_token and rsvp_enabled;
  if not found then
    raise exception 'Link de confirmação inválido ou desativado' using errcode = 'invalid_parameter_value';
  end if;
  -- Travão simples contra abuso do link.
  if (select count(*) from public.rsvp_responses where guest_id = v_inv.guest_id and source = 'link') >= 30 then
    raise exception 'Demasiadas respostas por este link. Contacte os noivos.' using errcode = 'check_violation';
  end if;
  perform app_private.apply_rsvp(v_inv.guest_id, p_status, p_companions, p_children, p_companion_names,
                                 p_dietary, p_allergies, p_message, 'link');
  return app_private.rsvp_payload(v_inv.id);
end;
$$;

-- Casamento: criar (com as 16 categorias de orçamento) e aceitar convites de utilizador.
create function public.create_wedding(
  p_name text default 'O Nosso Casamento', p_partner1 text default 'Paulo',
  p_partner2 text default 'Inês', p_date date default date '2027-07-02')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'Autenticação necessária' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.wedding_members where user_id = v_user) then
    raise exception 'Já pertence a um casamento' using errcode = 'unique_violation';
  end if;
  insert into public.weddings (name, partner1_name, partner2_name, wedding_date, created_by)
  values (btrim(p_name), btrim(p_partner1), btrim(p_partner2), p_date, v_user) returning id into v_id;
  insert into public.wedding_members (wedding_id, user_id, role, email)
  values (v_id, v_user, 'owner', (select email from auth.users where id = v_user));
  insert into public.budget_categories (wedding_id, name, sort_order)
  select v_id, c.name, c.ord from unnest(array[
    'Espaço','Catering','Fotografia','Vídeo','Música','Decoração','Flores','Vestido','Fato',
    'Alianças','Convites','Bolo','Transporte','Alojamento','Lua de mel','Outros']) with ordinality as c(name, ord);
  return v_id;
end;
$$;

create function public.accept_wedding_invitation()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_inv   public.wedding_invitations;
begin
  if v_user is null then
    raise exception 'Autenticação necessária' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.wedding_members where user_id = v_user) then
    return (select wedding_id from public.wedding_members where user_id = v_user);
  end if;
  select email into v_email from auth.users where id = v_user;
  select * into v_inv from public.wedding_invitations
   where lower(email::text) = lower(coalesce(v_email, '')) and accepted_at is null
   order by created_at limit 1;
  if not found then return null; end if;
  insert into public.wedding_members (wedding_id, user_id, role, email) values (v_inv.wedding_id, v_user, 'member', v_email);
  update public.wedding_invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.wedding_id;
end;
$$;

-- Permissões de execução: só o necessário.
revoke all on function
  public.assign_guest_to_table(uuid, uuid), public.unassign_guest(uuid), public.regenerate_rsvp_token(uuid),
  public.record_manual_rsvp(uuid, text, int, int, text, text, text),
  public.get_rsvp_invitation(text),
  public.submit_rsvp(text, text, int, int, text, text, text, text),
  public.create_wedding(text, text, text, date), public.accept_wedding_invitation()
  from public, anon, authenticated;
grant execute on function
  public.assign_guest_to_table(uuid, uuid), public.unassign_guest(uuid), public.regenerate_rsvp_token(uuid),
  public.record_manual_rsvp(uuid, text, int, int, text, text, text),
  public.create_wedding(text, text, text, date), public.accept_wedding_invitation()
  to authenticated;
-- Ligação pública de RSVP: o token é a credencial.
grant execute on function public.get_rsvp_invitation(text),
  public.submit_rsvp(text, text, int, int, text, text, text, text) to anon, authenticated;
