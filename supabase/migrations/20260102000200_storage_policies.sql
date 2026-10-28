-- Fase 1 · Bucket privado e políticas do Storage.
-- O acesso aos objetos depende SEMPRE da existência da versão na BD e da pertença à conta.

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 104857600)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Descarregar: versão disponível da própria conta (ou equipa).
create policy project_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.file_versions v
      where v.storage_path = storage.objects.name and v.status = 'available'
        and (app_private.is_account_member(v.account_id) or app_private.is_staff())
    )
  );

-- O autor vê os seus próprios objetos ainda não verificados/rejeitados (necessário
-- para os poder apagar: o DELETE do Storage também passa pelas políticas de leitura).
create policy project_files_select_own_unverified on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.file_versions v
      where v.storage_path = storage.objects.name and v.status in ('pending', 'rejected')
        and v.created_by = auth.uid() and app_private.is_account_member(v.account_id)
    )
  );

-- Carregar: apenas para a versão "pending" reservada por este utilizador.
create policy project_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.file_versions v
      where v.storage_path = storage.objects.name and v.status = 'pending'
        and v.created_by = auth.uid() and app_private.is_account_member(v.account_id)
    )
  );

-- Limpeza do próprio upload falhado/rejeitado. Versões disponíveis nunca se apagam.
create policy project_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.file_versions v
      where v.storage_path = storage.objects.name and v.status in ('pending', 'rejected')
        and v.created_by = auth.uid()
    )
  );
-- Sem política de UPDATE: não é possível substituir objetos existentes.
