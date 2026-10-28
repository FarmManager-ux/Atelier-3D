# Arquitetura

Monólito modular em Next.js, com Supabase como backend gerido (PostgreSQL + Auth + Storage), região UE.

## Decisões (aprovadas)
| # | Decisão | Nota |
|---|---|---|
| 1 | Next.js + TypeScript + PostgreSQL | |
| 2 | Supabase (BD, Auth, Storage) numa região da UE | Frankfurt (`eu-central-1`) recomendado; Paris/Londres também servem. Ver ações manuais. |
| 3 | Contas empresariais multiutilizador desde o início | `accounts` + `account_members` (owner/admin/member) + convites |
| 4 | Ficheiros 3D privados, com histórico por versão | Fase 1 (bucket privado, URLs assinados, versões imutáveis) |
| 5 | Orçamentos manuais antes do simulador | Fases 2 → 3 |
| 6 | Sem pagamentos nesta fase | Apenas pontos de extensão |
| 7 | Domínio `conta.atelier3d.pt` | Sem alterar DNS/site sem confirmação |
| 8 | Simulador bloqueado | Até serem analisadas as regras reais |

## Modelo de dados (Fase 0)
- `profiles` (1:1 com `auth.users`) · `staff_members` (equipa: `admin`/`operator`)
- `accounts` (`individual` | `company`) · `account_members` (papel por conta) · `account_invitations` (token só em hash, 7 dias)
- `account_fiscal_data` (NIF/nome fiscal, separado; visível a owner/admin da conta e admins da equipa; **não** a operadores)
- `audit_log` (append-only; guarda ações e nomes de colunas alteradas, nunca valores pessoais/fiscais)

## Permissões
| Papel | Conta | Membros | Fiscais | Convites | Auditoria |
|---|---|---|---|---|---|
| member | ler | ler | — | — | — |
| admin | ler/editar nome | gerir não-owners | ler/editar | convidar `member` | ler (da conta) |
| owner | idem | gerir todos | idem | convidar `member`/`admin` | idem |
| staff operator | ler | ler | — | — | — |
| staff admin | tudo | ler | ler/editar | ler | tudo |

Regras na BD: conta de particular tem 1 utilizador; nunca fica sem proprietário; tipo/criador da conta imutáveis.

## Camadas de proteção
1. `proxy.ts` fecha rotas privadas (sem sessão → `/entrar`; sem configuração → falha segura).
2. Server Actions validam com Zod. 3. RLS na BD é a barreira final. 4. Operações sensíveis (criar conta, convites) só por RPC `security definer` com `search_path` vazio.
Funções auxiliares ficam em `app_private` (fora da API).

## Testes da base de dados
Docker/Supabase CLI não existem nas sessões cloud. As migrações (SQL puro) são aplicadas a um PostgreSQL 16 com um *shim* mínimo de `auth` (`tests/db/supabase-shim.sql`). Limitação: não valida PostgREST, o Auth real nem o Storage. Quando houver um projeto Supabase de *staging*, acrescentar testes de integração contra ele.
