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

## Modelo de dados (Fase 1)
- `accounts` ganha dados comerciais (telefone, site, email de faturação, atividade); `account_fiscal_data` valida o NIF português (dígito de controlo) **na BD**.
- `account_contacts` (um principal por conta) e `account_addresses` (faturação/envio/outra, código postal PT `0000-000`, uma predefinida por tipo).
- `projects` → `files` (ficheiro lógico: tipo `model_3d`/`image`, versão aprovada, arquivo) → `file_versions` (**imutáveis**: caminho, tamanho, SHA-256 declarado e verificado, estado `pending|available|rejected`).
- `file_type_rules`: formatos e limites (STL/3MF/STEP/STP/OBJ até 100 MB; PNG/JPG/JPEG/WebP até 15 MB). Valores propostos por mim e ainda **não confirmados por si** — são configuráveis.
- Integridade composta: um ficheiro só pode ficar num projeto **da mesma conta** (FK composta).

## Fluxo de upload (seguro)
1. O browser calcula o SHA-256 e chama `prepareUpload` (Server Action): valida formato/tamanho, chama `begin_file_upload` (permissões na BD) e pede um URL de upload assinado ao Storage.
2. O browser envia o ficheiro **diretamente** para o Storage (não passa pelo servidor Next.js; sem limite de 4,5 MB do alojamento). A política do Storage só deixa escrever no caminho reservado pelo próprio autor.
3. `completeUpload`: o servidor (chave de serviço) descarrega em *streaming*, confirma **tamanho real**, **SHA-256** e **assinatura do formato**; só então chama `complete_file_upload`, que passa a versão a `available`. Falha → `rejected` e objeto apagado.
4. Só versões `available` são visíveis a colegas/equipa e descarregáveis (URL assinado de 60 s gerado com a sessão do utilizador, sujeito à RLS do Storage).
Caminho no Storage: `{account_id}/{file_id}/{version_id}` (só UUIDs; o nome original fica na BD).

## Garantias de versionamento
- Versões nunca são alteradas ou apagadas (gatilho, mesmo para SQL privilegiado); apagar exige a rotina RGPD explícita.
- Nova versão **nunca** muda a versão aprovada; a aprovação é uma ação explícita de owner/admin (ou admin da equipa) e fica na auditoria.

## Permissões
| Papel | Conta | Membros | Fiscais | Convites | Auditoria |
|---|---|---|---|---|---|
| member | ler | ler | — | — | — |
| admin | ler/editar nome | gerir não-owners | ler/editar | convidar `member` | ler (da conta) |
| owner | idem | gerir todos | idem | convidar `member`/`admin` | idem |
| staff operator | ler | ler | — | — | — |
| staff admin | tudo | ler | ler/editar | ler | tudo |

Fase 1: contactos e moradas — leitura por qualquer membro, escrita por owner/admin. Projetos — qualquer membro cria/edita (sem eliminar). Ficheiros — qualquer membro carrega; só owner/admin aprovam versões e arquivam; a equipa (operador e admin) lê ficheiros disponíveis, mas operadores continuam sem dados fiscais.

Regras na BD: conta de particular tem 1 utilizador; nunca fica sem proprietário; tipo/criador da conta imutáveis.

## Camadas de proteção
1. `proxy.ts` fecha rotas privadas (sem sessão → `/entrar`; sem configuração → falha segura).
2. Server Actions validam com Zod. 3. RLS na BD é a barreira final. 4. Operações sensíveis (criar conta, convites) só por RPC `security definer` com `search_path` vazio.
Funções auxiliares ficam em `app_private` (fora da API).

## Testes da base de dados
Docker/Supabase CLI não existem nas sessões cloud. As migrações (SQL puro) são aplicadas a um PostgreSQL 16 com um *shim* mínimo de `auth` (`tests/db/supabase-shim.sql`). Limitação: não valida PostgREST, o Auth real nem o Storage. Quando houver um projeto Supabase de *staging*, acrescentar testes de integração contra ele.
