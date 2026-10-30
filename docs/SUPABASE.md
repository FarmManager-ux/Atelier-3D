# Supabase: configuração e migrações

> O ambiente cloud do Claude Code **não alcança supabase.com**. Nada disto foi executado nem testado contra um projeto
> real; as migrações foram testadas num PostgreSQL 16 com um *shim* mínimo do Supabase (`tests/db/supabase-shim.sql`).

## 0. Há algum projeto Supabase anterior?
Não consegui verificar (sem acesso nem credenciais). **Confirme no painel do Supabase:**
- Se **não** existe projeto: crie um novo (região UE, ex.: Frankfurt) e siga os passos abaixo.
- Se existe um projeto onde aplicou as migrações **antigas** (versão `legacy/portal-v0`): **não aplique estas migrações nesse projeto**
  (usam nomes de tabelas diferentes mas coincidem em `profiles`; a migração falharia, sem apagar nada). Crie um projeto novo ou peça-me
  um script de migração dos dados. Nunca vou alterar um projeto existente sem autorização específica.

## 1. Aplicar as migrações (por ordem)
No *SQL Editor* (ou `supabase db push` noutra máquina), executar os 6 ficheiros de `supabase/migrations/`:
`foundation` → `identity` → `rbac_seed` → `audit` → `rls` → `customer_rpcs`. (ver [lista](#migrações)).
As migrações **nunca apagam dados**: se um nome já existir, falham. Verificação posterior:
```sql
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;   -- tem de devolver 0 linhas
select count(*) from public.permissions;                                -- 34
```

## 2. Primeiro administrador
Registe-se (Fase 2) ou crie o utilizador em *Authentication → Users*, e depois, no SQL Editor:
```sql
insert into public.staff_members (user_id, role_key)
select id, 'admin' from auth.users where email = 'o-seu-email@exemplo.pt';
```

## 3. Authentication
Confirmação de email ativa; palavra-passe mínima 12; Site URL e Redirect URLs com `https://portal.atelier3d.pt`
(e o URL de preview); **2FA (TOTP)** para a equipa (exigido na Fase 2). Email: ver DECISOES-PENDENTES.md (SMTP).

## 4. Variáveis de ambiente (nunca em Git)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, e `SUPABASE_SERVICE_ROLE_KEY` (**segredo**, só servidor).
Para as sessões cloud: *Environment → Secrets* e permitir `*.supabase.co` na rede.

## Migrações
| Ficheiro | Conteúdo |
|---|---|
| `20260301000000_foundation` | Esquemas `extensions`/`app_private`, `set_updated_at`, validação de NIF |
| `20260301000100_identity` | Perfis, RBAC, contas de clientes, membros, convites, faturação, regras de integridade |
| `20260301000200_rbac_seed` | 34 permissões e 6 funções (**gerada**, não editar) |
| `20260301000300_audit` | `audit_log` append-only e gatilho genérico `audit_row` |
| `20260301000400_rls` | Políticas RLS e privilégios mínimos |
| `20260301000500_customer_rpcs` | `create_customer_account`, `invite_customer_member`, `accept_customer_invitation` |
