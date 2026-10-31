-- O Nosso Casamento · Storage privado (documentos) e atualizações em tempo real.

-- Extrai o id do casamento da primeira pasta do caminho ("<wedding_id>/<ficheiro>") sem nunca falhar.
create function app_private.wedding_id_from_path(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-documents', 'wedding-documents', false, 26214400, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy wedding_documents_select on storage.objects for select to authenticated
  using (bucket_id = 'wedding-documents' and app_private.is_wedding_member(app_private.wedding_id_from_path(name)));
create policy wedding_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'wedding-documents' and app_private.is_wedding_member(app_private.wedding_id_from_path(name)));
create policy wedding_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'wedding-documents' and app_private.is_wedding_member(app_private.wedding_id_from_path(name)));
-- Sem política de UPDATE: ficheiros não se substituem; apagam-se e carregam-se de novo.

-- Tempo real: os dois noivos veem as alterações um do outro sem recarregar a página.
-- (A publicação "supabase_realtime" existe em projetos Supabase; fora do Supabase, esta parte é ignorada.)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['weddings','wedding_members','wedding_invitations','guest_groups','guests','invitations',
      'rsvp_responses','tables','table_seats','guest_seatings','budget_categories','vendors','expenses','tasks',
      'documents','calendar_events']
    loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;
