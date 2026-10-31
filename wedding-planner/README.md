# O Nosso Casamento — Wedding Planner

Aplicação privada para organizar um casamento (convidados, convites e confirmações, mesas, orçamento, tarefas, fornecedores, documentos, calendário). Interface em pt-PT.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · componentes estilo shadcn/ui (Radix) · Supabase (PostgreSQL, Auth, Storage, Realtime) · dnd-kit · Recharts · Lucide.

> Vive na pasta `wedding-planner/` deste repositório e é independente do portal Atelier 3D. Para a separar num repositório próprio basta copiar a pasta.

## O que está testado e o que não está

| Testado localmente | Não testado (precisa de Supabase/Vercel reais) |
|---|---|
| 79 testes de base de dados contra PostgreSQL 16 real: RLS, isolamento entre casamentos, capacidade das mesas, um convidado só numa mesa, concorrência, RSVP por token, storage (políticas), orçamento | Supabase Auth (login, recuperação de password, emails) |
| 71 testes unitários: estatísticas, mesas, orçamento, CSV, calendário, validação | Realtime e Storage reais (as políticas SQL estão testadas, o serviço não) |
| Lint, tipos e `next build` | Deploy na Vercel, envio de emails, comportamento em telemóveis reais |

As migrações correm contra PostgreSQL com um *shim* mínimo do Supabase (`tests/db/supabase-shim.sql`). Valide o fluxo completo no seu projeto Supabase depois de configurar.

## Instalação local

```bash
cd wedding-planner
pnpm install
cp .env.example .env.local   # preencher com os valores do seu projeto Supabase
pnpm dev
```

Comandos: `pnpm check` (lint + tipos + testes), `pnpm build`, `pnpm test:db` (precisa de PostgreSQL 16; URL em `TEST_DATABASE_URL`, por omissão `postgres://atelier_test:test@127.0.0.1:5432/postgres`).

## Configurar o Supabase

1. Crie um projeto em <https://supabase.com> (região UE, por exemplo Frankfurt ou Paris). Use um projeto **novo e dedicado**.
2. Em *Project Settings → API* copie o URL e a chave `anon` para `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (ex.: `http://localhost:3000`; em produção, o URL da Vercel)
   Nunca use a chave `service_role` nesta aplicação.
3. Execute as migrações **por ordem** no *SQL Editor* (ou com `supabase db push` na sua máquina):
   1. `supabase/migrations/20261101000000_foundation.sql`
   2. `…0100_schema.sql`
   3. `…0200_functions.sql`
   4. `…0300_rls.sql`
   5. `…0400_storage_realtime.sql`
4. Em *Authentication → URL Configuration*: *Site URL* = `NEXT_PUBLIC_SITE_URL`; em *Redirect URLs* adicione `<site>/auth/confirmar` e `<site>/redefinir`.
5. Em *Authentication → Providers → Email*: ative email+password. Configure um SMTP próprio para emails fiáveis (o SMTP por omissão do Supabase tem limites baixos).
6. Em *Storage* confirme que existe o bucket **privado** `wedding-documents`.
7. Em *Database → Replication* confirme que as tabelas aparecem na publicação `supabase_realtime`. Se não, a aplicação continua a funcionar com atualização periódica (30 s).

## Criar os primeiros utilizadores

1. Abra a aplicação e use **Registar** com o email do primeiro cônjuge. Confirme o email, entre e preencha o assistente (nomes, data, orçamento) — fica como *proprietário*.
2. Em **Definições → Utilizadores**, convide o segundo cônjuge pelo email. Ao registar-se com esse email, é adicionado automaticamente ao mesmo casamento.
3. Depois de criar os dois, pode desativar novos registos em *Authentication → Sign In / Providers → Allow new users to sign up* (os convites passam a exigir criar a conta antes de desligar).

Cada casamento admite até 6 membros; todos veem e editam os mesmos dados em simultâneo.

## Convites digitais (RSVP)

Em **Convites e confirmações** gere-se um link individual por convidado (token aleatório de 144 bits). A página pública `/rsvp/<token>` só permite responder por esse convidado; não expõe mais dados. Os links são copiados ou abertos via WhatsApp — a aplicação **não envia emails nem mensagens por si**.

## Deploy na Vercel

1. Importe o repositório na Vercel e defina **Root Directory = `wedding-planner`**.
2. Defina as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (URL final da Vercel ou domínio próprio).
3. Faça deploy e atualize *Site URL* e *Redirect URLs* no Supabase para o URL final.
4. A aplicação envia `X-Robots-Tag: noindex` e cabeçalhos de segurança (ver `next.config.ts`).

## Estrutura

```
src/app         rotas: (auth) público, (app) autenticado, rsvp/[token] público
src/components  UI, módulos (guests, tables, invites, budget, …)
src/lib         dados (react-query + Realtime), domínio puro (stats, seating, budget, csv…), validação
supabase/migrations  esquema, funções, RLS, storage
tests/db        testes de base de dados
```

Regras de dados: contagens são sempre por pessoa (convidado + acompanhantes + crianças); uma pessoa só ocupa um lugar; a capacidade das mesas é imposta pela base de dados (não só pela interface).
