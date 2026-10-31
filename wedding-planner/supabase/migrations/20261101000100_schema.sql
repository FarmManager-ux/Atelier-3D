-- O Nosso Casamento · Tabelas, relações, restrições e índices.
-- Todos os identificadores são UUID. Os registos de cada casamento só referenciam registos do MESMO
-- casamento (chaves estrangeiras compostas (id, wedding_id)).

-- ----------------------------------------------------------------- tipos
create type public.member_role      as enum ('owner', 'member');
create type public.guest_side       as enum ('partner1', 'partner2', 'both');
create type public.guest_category   as enum ('familia', 'amigos', 'trabalho', 'outros');
create type public.age_group        as enum ('adulto', 'crianca');
create type public.invitation_status as enum ('por_convidar', 'enviado', 'entregue', 'recusado');
create type public.rsvp_status      as enum ('sem_resposta', 'confirmado', 'nao_vai');
create type public.table_shape      as enum ('redonda', 'retangular', 'quadrada');
create type public.payment_status   as enum ('por_pagar', 'parcial', 'pago');
create type public.task_status      as enum ('por_iniciar', 'em_andamento', 'concluida');
create type public.task_priority    as enum ('baixa', 'media', 'alta');
create type public.task_assignee    as enum ('partner1', 'partner2', 'both', 'other');
create type public.vendor_status    as enum ('por_contactar', 'contactado', 'orcamento_recebido', 'em_negociacao', 'contratado', 'recusado');
create type public.document_category as enum ('contrato', 'orcamento', 'fatura', 'comprovativo', 'inspiracao', 'outro');
create type public.event_type       as enum ('pagamento', 'reuniao', 'prazo', 'tarefa', 'prova_roupa', 'contacto_fornecedor', 'data_importante', 'outro');

-- ------------------------------------------------------------- casamento
create table public.weddings (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default 'O Nosso Casamento' check (char_length(btrim(name)) between 1 and 120),
  partner1_name  text not null default 'Paulo' check (char_length(btrim(partner1_name)) between 1 and 60),
  partner2_name  text not null default 'Inês'  check (char_length(btrim(partner2_name)) between 1 and 60),
  wedding_date   date not null default date '2027-07-02',
  venue_name     text check (char_length(venue_name) <= 200),
  total_budget   numeric(12,2) not null default 0 check (total_budget >= 0),
  preferences    jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger weddings_updated_at before update on public.weddings
  for each row execute function app_private.set_updated_at();

create table public.wedding_members (
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null default 'member',
  email       extensions.citext,   -- copiado do utilizador ao entrar, para mostrar quem tem acesso
  created_at  timestamptz not null default now(),
  primary key (wedding_id, user_id)
);
create unique index wedding_members_one_wedding_per_user on public.wedding_members (user_id);

create table public.wedding_invitations (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings (id) on delete cascade,
  email        extensions.citext not null check (char_length(email::text) <= 254 and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  unique (wedding_id, email)
);

-- --------------------------------------------------------------- convidados
create table public.guest_groups (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, wedding_id)
);
create unique index guest_groups_name_unique on public.guest_groups (wedding_id, lower(btrim(name)));

create table public.guests (
  id                    uuid primary key default gen_random_uuid(),
  wedding_id            uuid not null references public.weddings (id) on delete cascade,
  group_id              uuid,
  full_name             text not null check (char_length(btrim(full_name)) between 1 and 160),
  surname               text check (char_length(surname) <= 100),
  phone                 text check (char_length(phone) <= 40),
  email                 extensions.citext check (email is null or (char_length(email::text) <= 254 and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  relationship          text check (char_length(relationship) <= 120),
  side                  public.guest_side not null default 'both',
  category              public.guest_category not null default 'outros',
  age_group             public.age_group not null default 'adulto',
  companion_names       text check (char_length(companion_names) <= 500),
  companions_count      int not null default 0 check (companions_count between 0 and 20),
  children_count        int not null default 0 check (children_count between 0 and 20),
  dietary_restrictions  text check (char_length(dietary_restrictions) <= 500),
  allergies             text check (char_length(allergies) <= 500),
  notes                 text check (char_length(notes) <= 2000),
  invitation_status     public.invitation_status not null default 'por_convidar',
  rsvp_status           public.rsvp_status not null default 'sem_resposta',
  -- Confirmados que realmente vêm (nulo = todos os autorizados). Preenchidos pelo RSVP.
  attending_companions  int check (attending_companions between 0 and 20),
  attending_children    int check (attending_children between 0 and 20),
  -- Pessoas convidadas neste registo: o convidado + acompanhantes + crianças.
  invited_count         int generated always as (1 + companions_count + children_count) stored,
  -- Pessoas que precisam de lugar: 0 se não vai, os confirmados se confirmou, todos os convidados caso contrário.
  expected_count        int generated always as (
    case rsvp_status
      when 'nao_vai'    then 0
      when 'confirmado' then 1 + least(coalesce(attending_companions, companions_count), companions_count)
                               + least(coalesce(attending_children, children_count), children_count)
      else 1 + companions_count + children_count
    end) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, wedding_id),
  foreign key (group_id, wedding_id) references public.guest_groups (id, wedding_id)
);
create index guests_wedding_name_idx on public.guests (wedding_id, lower(full_name));
create index guests_group_idx on public.guests (group_id);
create index guests_status_idx on public.guests (wedding_id, invitation_status, rsvp_status);
create index guests_name_trgm_idx on public.guests using gin (full_name extensions.gin_trgm_ops);

create table public.invitations (
  id                 uuid primary key default gen_random_uuid(),
  wedding_id         uuid not null references public.weddings (id) on delete cascade,
  guest_id           uuid not null,
  -- Token único do link de RSVP (144 bits). Quem o tem pode responder SÓ por este convidado.
  token              text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  rsvp_enabled       boolean not null default true,
  channel            text check (channel in ('whatsapp', 'email', 'mao', 'correio', 'outro')),
  sent_at            timestamptz,
  delivered_at       timestamptz,
  responded_at       timestamptz,
  last_contacted_at  timestamptz,
  notes              text check (char_length(notes) <= 1000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (guest_id),
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade
);
create index invitations_wedding_idx on public.invitations (wedding_id);

create table public.rsvp_responses (
  id                    uuid primary key default gen_random_uuid(),
  wedding_id            uuid not null references public.weddings (id) on delete cascade,
  guest_id              uuid not null,
  status                public.rsvp_status not null check (status in ('confirmado', 'nao_vai')),
  companions_attending  int not null default 0 check (companions_attending between 0 and 20),
  children_attending    int not null default 0 check (children_attending between 0 and 20),
  dietary_restrictions  text check (char_length(dietary_restrictions) <= 500),
  allergies             text check (char_length(allergies) <= 500),
  message               text check (char_length(message) <= 1000),
  source                text not null default 'link' check (source in ('link', 'manual')),
  submitted_at          timestamptz not null default now(),
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade
);
create index rsvp_responses_guest_idx on public.rsvp_responses (guest_id, submitted_at desc);
create index rsvp_responses_wedding_idx on public.rsvp_responses (wedding_id, submitted_at);

-- ------------------------------------------------------------------ mesas
create table public.tables (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  shape       public.table_shape not null default 'redonda',
  capacity    int not null default 8 check (capacity between 1 and 40),
  x           numeric(8,2) not null default 0,
  y           numeric(8,2) not null default 0,
  width       numeric(6,2) not null default 120 check (width between 40 and 600),
  height      numeric(6,2) not null default 120 check (height between 40 and 600),
  rotation    numeric(5,2) not null default 0 check (rotation between -360 and 360),
  notes       text check (char_length(notes) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, wedding_id)
);
create unique index tables_name_unique on public.tables (wedding_id, lower(btrim(name)));

-- Lugares físicos de cada mesa (criados/removidos automaticamente conforme a capacidade).
create table public.table_seats (
  id           uuid primary key default gen_random_uuid(),
  table_id     uuid not null,
  wedding_id   uuid not null,
  seat_number  int not null check (seat_number >= 1),
  unique (table_id, seat_number),
  unique (id, table_id),
  foreign key (table_id, wedding_id) references public.tables (id, wedding_id) on delete cascade
);

-- Uma linha por PESSOA sentada: um registo de convidado com acompanhantes ocupa vários lugares.
create table public.guest_seatings (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null,
  guest_id      uuid not null,
  table_id      uuid not null,
  seat_id       uuid not null unique,                    -- um lugar tem no máximo uma pessoa
  person_index  int not null check (person_index >= 0),  -- 0 = o convidado; 1.. = acompanhantes
  created_at    timestamptz not null default now(),
  unique (guest_id, person_index),
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade,
  foreign key (seat_id, table_id) references public.table_seats (id, table_id) on delete cascade
);
create index guest_seatings_table_idx on public.guest_seatings (table_id);

-- --------------------------------------------------------------- orçamento
create table public.budget_categories (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 80),
  planned_budget  numeric(12,2) not null default 0 check (planned_budget >= 0),
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (id, wedding_id)
);
create unique index budget_categories_name_unique on public.budget_categories (wedding_id, lower(btrim(name)));

create table public.vendors (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references public.weddings (id) on delete cascade,
  company_name      text not null check (char_length(btrim(company_name)) between 1 and 160),
  service_type      text check (char_length(service_type) <= 80),
  contact_name      text check (char_length(contact_name) <= 120),
  phone             text check (char_length(phone) <= 40),
  email             extensions.citext check (email is null or (char_length(email::text) <= 254 and email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  website           text check (website is null or (char_length(website) <= 300 and website ~* '^https?://[^\s]+$')),
  quoted_amount     numeric(12,2) check (quoted_amount >= 0),
  contracted_amount numeric(12,2) check (contracted_amount >= 0),
  status            public.vendor_status not null default 'por_contactar',
  notes             text check (char_length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, wedding_id)
);
create index vendors_wedding_idx on public.vendors (wedding_id, lower(company_name));

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  category_id     uuid not null,
  vendor_id       uuid,
  description     text not null check (char_length(btrim(description)) between 1 and 200),
  planned_amount  numeric(12,2) not null default 0 check (planned_amount >= 0),
  paid_amount     numeric(12,2) not null default 0 check (paid_amount >= 0),
  -- Estado derivado dos valores: nunca fica inconsistente.
  payment_status  public.payment_status generated always as (
    case when paid_amount <= 0 then 'por_pagar'::public.payment_status
         when paid_amount < planned_amount then 'parcial'::public.payment_status
         else 'pago'::public.payment_status end) stored,
  payment_date    date,
  due_date        date,
  notes           text check (char_length(notes) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, wedding_id),
  foreign key (category_id, wedding_id) references public.budget_categories (id, wedding_id),
  foreign key (vendor_id, wedding_id)   references public.vendors (id, wedding_id)
);
create index expenses_wedding_idx on public.expenses (wedding_id, due_date);
create index expenses_category_idx on public.expenses (category_id);
create index expenses_vendor_idx on public.expenses (vendor_id);

-- ------------------------------------------------------------------ tarefas
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  description     text check (char_length(description) <= 2000),
  category        text check (char_length(category) <= 60),
  assignee        public.task_assignee not null default 'both',
  assignee_other  text check (char_length(assignee_other) <= 80),
  due_date        date,
  priority        public.task_priority not null default 'media',
  status          public.task_status not null default 'por_iniciar',
  completed_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (assignee <> 'other' or assignee_other is not null)
);
create index tasks_wedding_idx on public.tasks (wedding_id, status, due_date);

-- --------------------------------------------------------------- documentos
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 200),
  category      public.document_category not null default 'outro',
  storage_path  text not null unique,
  mime_type     text check (char_length(mime_type) <= 120),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  vendor_id     uuid,
  notes         text check (char_length(notes) <= 1000),
  uploaded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (vendor_id, wedding_id) references public.vendors (id, wedding_id),
  -- O ficheiro tem de estar na pasta do próprio casamento.
  check (storage_path like wedding_id::text || '/%' and storage_path !~ '\.\.')
);
create index documents_wedding_idx on public.documents (wedding_id, category);

-- --------------------------------------------------------------- calendário
create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  event_type  public.event_type not null default 'outro',
  event_date  date not null,
  start_time  time,
  end_time    time,
  location    text check (char_length(location) <= 200),
  notes       text check (char_length(notes) <= 2000),
  vendor_id   uuid,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (vendor_id, wedding_id) references public.vendors (id, wedding_id),
  check (end_time is null or start_time is null or end_time > start_time)
);
create index calendar_events_wedding_idx on public.calendar_events (wedding_id, event_date);

-- ------------------------------------------------ gatilhos genéricos por tabela
do $$
declare t text;
begin
  foreach t in array array['guest_groups','guests','invitations','tables','vendors','expenses','tasks','calendar_events']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function app_private.set_updated_at()', t || '_updated_at', t);
  end loop;
  foreach t in array array['guest_groups','guests','invitations','rsvp_responses','tables','table_seats','guest_seatings',
                           'budget_categories','vendors','expenses','tasks','documents','calendar_events']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function app_private.wedding_id_immutable()', t || '_wedding_immutable', t);
  end loop;
end $$;
