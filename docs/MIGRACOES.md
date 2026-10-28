# Migrações da base de dados

Ficheiros em `supabase/migrations/`, aplicados **por ordem alfabética** (marca temporal no nome).
Nunca editar uma migração já aplicada em produção: criar uma nova.

| Ficheiro | Fase | Conteúdo |
|---|---|---|
| `20260101000000_extensions_and_helpers` | 0 | Extensões (`pgcrypto`, `citext`), esquema privado `app_private` |
| `20260101000100_identity_and_accounts` | 0 | Perfis, equipa, contas, membros, convites, dados fiscais, regras de integridade |
| `20260101000200_audit_log` | 0 | Auditoria append-only e gatilhos |
| `20260101000300_rls_policies` | 0 | RLS e privilégios das tabelas da Fase 0 |
| `20260101000400_account_rpcs` | 0 | `create_account`, `invite_member`, `accept_invitation` |
| `20260102000000_profile_data` | 1 | Validação do NIF (dígito de controlo) na BD, dados comerciais, contactos, moradas |
| `20260102000100_projects_and_files` | 1 | Projetos, ficheiros, versões imutáveis, regras de formatos/limites, RPCs de upload e aprovação |
| `20260102000200_storage_policies` | 1 | Bucket privado `project-files` e políticas do Storage |

## Como aplicar
- **Supabase (recomendado)**: `supabase link` + `supabase db push` (precisa do CLI e de rede; não existe nas sessões cloud), **ou** colar cada ficheiro, por ordem, no *SQL Editor*.
- Antes, confirmar que o projeto tem os esquemas `auth` e `storage` (existem por omissão em projetos Supabase).
- Depois de aplicar: *Storage* deve mostrar o bucket `project-files` como **Private**.

## Pontos de atenção
- `20260102000000` troca a restrição simples do NIF por validação do dígito de controlo: **dados fiscais já existentes com NIF inválido bloqueiam a migração**. Em produção, validar antes (`select nif from account_fiscal_data where country='PT'`).
- `20260102000200` cria políticas em `storage.objects`. Em projetos Supabase isto funciona no SQL Editor/CLI; se der erro de permissão, criar as 4 políticas pela UI (*Storage → Policies*) com o mesmo texto.
- A rotina RGPD de eliminação (Fase 7) terá de executar `set local app.allow_erasure = 'on'` para apagar versões disponíveis; fora disso o gatilho recusa.
- Uploads que ficam `pending` (browser fechado a meio) não são limpos automaticamente ainda: rotina de expiração prevista na Fase 7 (apagar `pending` com mais de 24 h e o objeto correspondente).
