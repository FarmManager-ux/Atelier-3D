# Atelier 3D — instruções para sessões do Claude Code (cloud)

Plataforma de clientes e produção do Atelier 3D (Portugal). Interface **sempre em pt-PT**.
Desenvolvimento exclusivamente em sessões cloud; nada pode depender de uma máquina local.

## Comandos
- `pnpm install` · `pnpm check` (lint + tipos + testes) · `pnpm build`
- Testes de BD precisam de PostgreSQL 16: `pg_ctlcluster 16 main start` e, uma vez,
  `su postgres -c "psql -c \"create role atelier_test superuser login password 'test'\""`
  (URL por omissão: `postgres://atelier_test:test@127.0.0.1:5432/postgres`; ou `TEST_DATABASE_URL`).
- Docker e o Supabase CLI NÃO estão disponíveis na cloud; as migrações são SQL puro em
  `supabase/migrations/` e são testadas contra Postgres + `tests/db/supabase-shim.sql`.

## Regras do projeto
- Next.js 16: o ficheiro é `src/proxy.ts` (não `middleware.ts`); `cookies()`/`headers()`/`searchParams` são assíncronos.
- Toda a tabela nova: RLS ativa, privilégios explícitos (`revoke` a `anon`), testes de isolamento em `tests/db/`.
- Dados fiscais só em tabelas próprias, nunca no registo de auditoria (que guarda só nomes de colunas).
- Ficheiros 3D: bucket privado, URLs assinados; versões imutáveis; nunca substituir uma versão aprovada.
- Nunca inventar preços, prazos ou regras do simulador. O simulador está BLOQUEADO até as regras reais serem fornecidas.
- Sem credenciais no código. Sem dados reais de clientes em testes/seeds.
- Não alterar DNS nem o site atual sem confirmação explícita do proprietário.
- Não integrar pagamentos antes de decisão do proprietário.
- TypeScript fixo na série 6 (typescript-eslint ainda não suporta a 7).

Ver `docs/` para arquitetura, segurança e ações manuais pendentes.
