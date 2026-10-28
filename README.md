# Atelier 3D · Plataforma de clientes e produção

Portal em pt-PT para clientes do Atelier 3D (impressão 3D, Portugal): contas de particulares e
empresas, orçamentos, projetos e ficheiros 3D, encomendas e administração.

**Estado: Fase 0 (fundações).** Ver [docs/PLANO.md](docs/PLANO.md) para o que existe e o que falta.

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (PostgreSQL, Auth, Storage; região UE) · Vitest · GitHub Actions.

## Desenvolvimento (sessões cloud)
```bash
pnpm install
cp .env.example .env.local   # preencher com valores do projeto Supabase (ver docs/ACOES-MANUAIS.md)
pnpm dev                     # http://localhost:3000
pnpm check                   # lint + tipos + testes (unitários + base de dados)
pnpm build
```
Os testes de base de dados precisam de um PostgreSQL 16 (ver [CLAUDE.md](CLAUDE.md)); o CI fornece um.

## Estrutura
```
src/app/            rotas (auth, portal) e route handlers
src/lib/            lógica partilhada (env, supabase, validação, i18n)
src/proxy.ts        renovação de sessão e proteção de rotas privadas
supabase/migrations esquema SQL versionado (RLS, funções, auditoria)
tests/db/           testes de isolamento/permissões contra PostgreSQL real
docs/               arquitetura, segurança, plano, ações manuais
```

## Documentação
- [Arquitetura e decisões](docs/ARQUITETURA.md)
- [Segurança e RGPD](docs/SEGURANCA.md)
- [Plano faseado](docs/PLANO.md)
- [Ações manuais pendentes](docs/ACOES-MANUAIS.md)
