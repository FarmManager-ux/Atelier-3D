# Reinício do projeto (outubro de 2026)

O projeto foi recomeçado de raiz por decisão do proprietário. Este documento regista o que aconteceu.

## Ponto de recuperação
- Branch no GitHub: **`archive/portal-v0`** (commit `b3add05`) e tag local `legacy/portal-v0`. (O GitHub recusou o envio da tag; a branch cumpre a mesma função.)
- O histórico completo mantém-se na branch de trabalho: só foram acrescentados commits, nada foi reescrito.
- Recuperar o código antigo: `git checkout archive/portal-v0`.
- Antes de eliminar: árvore limpa, sem alterações por guardar, sem `.env` nem segredos no repositório.

## Inventário
| Destino | O quê |
|---|---|
| **Eliminado** | Todas as páginas e componentes da versão anterior (`src/app/**`, `src/components/**`), lógica de negócio antiga (`src/lib/**`: ficheiros, formulários, ações, mensagens), as 8 migrações antigas, os testes de BD antigos, toda a documentação e `CLAUDE.md` antigos |
| **Aproveitado (movido com histórico)** | Clientes Supabase SSR/browser/admin e proxy de sessão → `src/shared/supabase/`; configuração de ambiente → `src/shared/config/`; redirecionamento seguro → `src/shared/security/`; validação de NIF → `src/shared/validation/` |
| **Aproveitado (adaptado)** | Harness de testes de BD e *shim* Supabase (`tests/db/`), workflow de CI, configuração de TypeScript/ESLint/Next/Tailwind |
| **Novo** | RBAC da equipa com 34 permissões, nova modelação de contas de clientes, auditoria genérica, testes de arquitetura, backups, design tokens, catálogo FDM, documentação |

## Nota honesta
Parte do desenho da versão anterior (RLS, auditoria, convites) provou-se sólida e foi **reimplementada** de forma mais geral
(RBAC por permissões, auditoria reutilizável) em vez de ser reescrita só por reescrever. O que mudou é sobretudo a estrutura, o
modelo de dados e o âmbito: agora é uma plataforma de gestão de toda a empresa, só FDM.

## Supabase
Nada foi alterado nem apagado em recursos externos. As novas migrações são aditivas (falham, não destroem). Ver docs/SUPABASE.md.
