# Testes: o que cada um prova (e o que não prova)

Comando: `pnpm check` (lint + tipos + testes). Testes de BD exigem PostgreSQL 16 (ver `CLAUDE.md`); o CI fornece um.

## A. Testes locais (correm nas sessões cloud e no CI, sem Supabase)
| Ficheiros | O que cobrem |
|---|---|
| `src/**/*.test.ts` (unit) | Validação de formulários (Zod), NIF, redirecionamentos seguros, regras de formatos/tamanhos, nome de ficheiro, **verificação do conteúdo por assinatura (magic bytes)**, **fluxo de finalização do upload** (hash, tamanho, rejeição, remoção do objeto) com armazenamento simulado, mensagens de erro da BD, rotas protegidas |
| `tests/db/rls.test.ts` | Fase 0: isolamento entre clientes, papéis, convites, auditoria |
| `tests/db/profile-data.test.ts` | NIF na BD, dados comerciais, contactos, moradas, permissões e isolamento |
| `tests/db/files.test.ts` | Projetos, `begin_file_upload`, conclusão só pelo servidor, **imutabilidade das versões**, aprovação explícita (nova versão não substitui a aprovada), arquivo, isolamento entre clientes, **políticas do Storage** |
| `tests/db/rules-parity.test.ts` | Regras TS ≡ regras na BD |

Executados contra **PostgreSQL 16 real** com um *shim* mínimo de `auth`/`storage` (`tests/db/supabase-shim.sql`).

## B. O que os testes locais NÃO provam (dependem de infraestrutura real)
Nada disto foi testado, porque o projeto Supabase ainda não existe/está inacessível:
1. Registo, login, confirmação por email, recuperação de palavra-passe (Supabase Auth + SMTP).
2. Upload real para o Storage via URL assinado (`createSignedUploadUrl`/`uploadToSignedUrl`), descarga por URL assinado, e a compatibilidade das políticas com o Storage real (que valida com o seu próprio serviço).
3. Renderização das páginas autenticadas (formulários, listas) contra dados reais; usabilidade em telemóvel real.
4. Tempo/memória do cálculo de SHA-256 no browser para ficheiros de ~100 MB em telemóveis.
5. Limites de corpo/tempo do alojamento ao verificar ficheiros grandes no servidor (`finalizeUpload` lê o ficheiro inteiro em *streaming*).

## C. Plano para fechar B (quando existir um projeto Supabase de *staging*)
Testes de integração (variáveis `SUPABASE_*` de *staging* no CI) que: criem utilizadores de teste, façam upload/descarga reais, e confirmem o isolamento entre dois utilizadores através da API real.

## D. Mutação manual executada nesta fase
Sabotagem deliberada de políticas e confirmada a falha dos testes: leitura de versões (2 falhas), leitura do Storage (1), gatilho de imutabilidade (2). A remoção isolada da condição de autoria na inserção do Storage não altera o comportamento (a RLS de `file_versions` já cobre o caso): sobreposição intencional.
