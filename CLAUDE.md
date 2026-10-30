# Atelier 3D Portal — instruções para sessões do Claude Code (cloud)

Plataforma de gestão do Atelier 3D (Portugal). Interface **sempre em pt-PT**. Desenvolvimento exclusivamente em sessões cloud.

## Comandos
- `pnpm install` · `pnpm check` (lint + tipos + testes) · `pnpm backup:verify` · `pnpm build`
- Testes de BD precisam de PostgreSQL 16: `pg_ctlcluster 16 main start` e, uma vez,
  `su postgres -c "psql -c \"create role atelier_test superuser login password 'test'\""`
  (URL por omissão `postgres://atelier_test:test@127.0.0.1:5432/postgres`, ou `TEST_DATABASE_URL`).
- Docker, Supabase CLI e supabase.com NÃO estão acessíveis na cloud: as migrações (SQL puro em `supabase/migrations/`) são testadas contra
  PostgreSQL + `tests/db/supabase-shim.sql`. O que depende do Supabase real tem de ser dito como "não testado".
- Seed de permissões: `pnpm exec tsx scripts/gen-rbac-seed.ts` (gerada a partir de `src/modules/identity`; nunca editar `*_rbac_seed.sql` à mão).

## Arquitetura (ver docs/ARQUITETURA.md; imposta por `tests/architecture`)
- `src/modules/<m>/{domain,server,ui}` + `index.ts` público; `src/shared` não depende de módulos; `domain/` é puro.
- A chave `service_role` só em `modules/*/server/`, `api/`, `actions.ts`, `route.ts`; nunca em ficheiros `"use client"`.
- Next.js 16: `src/proxy.ts` (não `middleware.ts`); `cookies()`/`headers()`/`searchParams` são assíncronos. TypeScript fixo na série 6.

## Regras do produto
- Só impressão **FDM** (sem SLA/resina). Sem loja, carrinho ou produtos. `www.atelier3d.pt` (Shopify) é independente: sem integração.
- Nunca inventar preços, prazos, tarifas ou dados de produção: tudo configurado pela equipa; o simulador recusa calcular sem parâmetros aprovados.
- Toda a tabela nova: RLS ativa, `revoke` a `anon`, permissões via `has_permission()`, auditoria (`audit_row`) e testes de isolamento.
- Ficheiros: bucket privado, URLs assinados, versões imutáveis, nunca substituir uma versão aprovada. Dados fiscais só em tabelas próprias; auditoria nunca guarda valores pessoais.
- Migrações aditivas: nunca `drop` de dados; nunca editar uma migração já aplicada.
- Sem credenciais no código; sem dados reais em testes/seeds.

## Pedir autorização antes de
Serviços pagos ou APIs comerciais; alterar recursos externos (Supabase existente, DNS, alojamento); operações destrutivas sobre dados reais;
avançar de fase sem validação do proprietário. Preservar o que já está concluído. Pagamentos online só com autorização expressa.
