# Arquitetura

Monólito modular em **Next.js (App Router) + TypeScript + Tailwind**, com **Supabase** (PostgreSQL, Auth, Storage, RLS)
como backend principal. Sem serviços pagos. Domínio: `portal.atelier3d.pt`. O site `www.atelier3d.pt` (Shopify) é
independente e não tem qualquer integração.

## Camadas e fronteiras
```
src/app/          rotas e UI (route groups): (public) site · (auth) · cliente/ · admin/ · api/
src/modules/<m>/  módulos de negócio: domain/ (puro) · server/ (Supabase, chave de serviço) · ui/ · index.ts (API pública)
src/shared/       infraestrutura transversal: config, supabase, security, validation, i18n
supabase/         migrações SQL versionadas
tests/            db/ (PostgreSQL real) · architecture/ (regras de fronteiras)
scripts/          backup, restauro, geração de seed RBAC
```
Regras impostas automaticamente por `tests/architecture` (o CI falha se forem quebradas):
- R1 um módulo usa outro só pela API pública (`@/modules/x`), nunca por caminhos internos; módulos não importam de `@/app`.
- R2 `domain/` é puro: sem React, Next, Supabase nem `server-only`.
- R3 `shared/` não depende de módulos nem de rotas.
- R4 a chave de serviço (`@/shared/supabase/admin`) só em `modules/*/server/`, `api/`, `actions.ts` e `route.ts`.
- R5 ficheiros `"use client"` nunca importam código de servidor. R6 `SUPABASE_SERVICE_ROLE` só em dois ficheiros. R7 sem segredos em `NEXT_PUBLIC_*`.

## Módulos (mapa final)
| Módulo | Fase | Responsabilidade |
|---|---|---|
| `identity` | 0 | Autenticação, contas de clientes, equipa e permissões (RBAC) — **existe** |
| `catalog` | 0/4/8 | Materiais e equipamentos FDM — **catálogo inicial existe** |
| `content` | 1 | Conteúdo do site público (portefólio, FAQ, serviços) |
| `files` | 2 | Ficheiros privados e versões imutáveis |
| `crm`, `messaging` | 3 | Contactos, interações, mensagens, notificações |
| `quotes`, `estimator` | 4 | Orçamentos e motor FDM (domínio puro e testável) |
| `modeling` | 5 | Serviço de modelação 3D |
| `orders`, `documents` | 6 | Encomendas e documentos |
| `production` | 7 | Trabalhos, planeamento, falhas, qualidade |
| `inventory` | 8 | Impressoras, bobines, stock, manutenção |
| `finance`, `reports` | 9 | Custos, margens, relatórios |
| `automations` | 10 | Regras e tarefas agendadas |

## Segurança por camadas
1. `proxy.ts` fecha `/cliente` e `/admin` sem sessão (falha segura se o Supabase não estiver configurado).
2. Server Actions/Route Handlers validam entradas com Zod e verificam permissões.
3. **RLS no PostgreSQL é a barreira final**: negar por omissão, `anon` sem privilégios, privilégios mínimos por coluna.
4. Operações sensíveis em RPC `security definer` com `search_path` vazio; funções auxiliares em `app_private` (fora da API).
5. Auditoria append-only de alterações (colunas alteradas; valores só de colunas explicitamente seguras).

## Modelo de acesso
- **Clientes**: `customer_accounts` (particular ou empresa) + `customer_members` (`owner`/`admin`/`member`). Só veem o que pertence às suas contas.
- **Equipa**: `staff_members` → função → permissões (`has_permission('módulo.ação')`). O `admin` tem sempre todas as permissões.
  Funções: admin, gestor, comercial, produção, financeiro, modelação 3D. Funções personalizadas criam-se no painel (Fase 2/6) sem alterar código.
- Dados de faturação em tabela separada: admins da conta e equipa com `customers.billing.*`.
- Toda a tabela nova: RLS ativa, `revoke ... from anon`, testes de isolamento. O teste `migrations.test.ts` falha se alguma tabela de `public` ficar sem RLS.

## Convenções de migrações
Ficheiros `AAAAMMDDHHMMSS_nome.sql`, ordem alfabética, **aditivas** (nunca `drop` de dados; nomes existentes fazem falhar, não apagar).
A seed de permissões é **gerada** de `src/modules/identity` (`pnpm exec tsx scripts/gen-rbac-seed.ts`) e validada por teste de paridade.
Uma migração aplicada em produção nunca se edita: cria-se uma nova.

## Ferramentas (todas gratuitas e abertas)
Next.js, React, TypeScript, Tailwind, Zod, Vitest, ESLint, tsx, Playwright (fases seguintes), Fontsource (Barlow Condensed, IBM Plex),
PostgreSQL/pg_dump/openssl (backups), GitHub Actions. Supabase no plano gratuito (limites em DECISOES-PENDENTES.md).

## Design (base na Fase 0, sistema completo na Fase 1)
Preto `#0a0a0b`, grafite `#141619–#363b42`, cinzentos `#6c727c–#d3d6db`, branco-papel `#f6f6f4`, laranja de sinalização `#ff6a13`.
Tipografia: Barlow Condensed (títulos, sinalética industrial), IBM Plex Sans (texto), IBM Plex Mono (dados). Motivo: linhas de
camadas FDM. Duas superfícies: "oficina" (escura) e "papel" (clara, para documentos e leitura).
