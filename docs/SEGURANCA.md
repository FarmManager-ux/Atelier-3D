# Segurança e RGPD

## Controlos implementados e testados (Fase 0, PostgreSQL 16 real)
| Controlo | Prova |
|---|---|
| RLS ativa em todas as tabelas de `public`; `anon` sem privilégios nem funções | `tests/db/migrations.test.ts` (também protege migrações futuras) |
| Isolamento entre clientes (contas, membros, convites, faturação, perfis, auditoria) | `tests/db/customers.test.ts`, `audit.test.ts` |
| RBAC da equipa: BD ≡ matriz TypeScript, cliente sem permissões, equipa inativa sem acesso | `tests/db/rbac.test.ts` |
| Faturação só para admins da conta e funções financeiras; comercial/produção excluídos | `customers.test.ts` |
| Convites: token de 256 bits, só o hash na BD, 7 dias, uso único, ligado ao email, mensagem única | `customers.test.ts` |
| Nunca ficar sem proprietário (conta) nem sem administrador (plataforma); funções de sistema protegidas | `customers.test.ts`, `rbac.test.ts` |
| Auditoria append-only; sem valores pessoais/fiscais; leitura por `audit.read` ou admin da conta | `audit.test.ts` |
| Funções `security definer` com `search_path` fixo | `migrations.test.ts` |
| Fronteiras de código e chave de serviço só no servidor; sem segredos em `NEXT_PUBLIC_*` | `tests/architecture` (com auto-teste) |
| Backups cifrados e restauro verificado | `pnpm backup:verify` |
| Cabeçalhos HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP | `next.config.ts` (verificado manualmente na Fase anterior; teste automático na Fase 1) |

Mutação manual: 6 políticas RLS sabotadas de propósito — todas detetadas pela suite.

## Ainda não coberto (fases seguintes)
- CSP com nonce e testes de cabeçalhos (Fase 1). 2FA obrigatório da equipa e fluxos de Auth reais (Fase 2).
- Storage privado, validação/antivírus de ficheiros, hash e versões imutáveis (Fase 2).
- Limitação de pedidos e anti-abuso em formulários públicos (Fase 1).
- RGPD: política de privacidade, base legal, registo de tratamentos, subcontratantes (Supabase, SMTP), exportação/eliminação de dados,
  retenção (dados de faturação podem ter obrigação legal de conservação: validar com contabilista). Rotina de eliminação explícita (Fase 10).
- Testes de integração contra um projeto Supabase de *staging*.

## Princípios
Nunca expor `service_role`; nunca dados reais em testes; auditoria sem dados pessoais; negar por omissão; um erro técnico nunca chega ao utilizador.
