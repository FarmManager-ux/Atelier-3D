# Plano faseado

| Fase | Estado | Conteúdo |
|---|---|---|
| 0 Fundações | **Código pronto; falta ligar ao Supabase real** | Projeto, CI, esquema base, autenticação, contas multiutilizador, auditoria, i18n |
| 1 Perfis e ficheiros | **Código pronto e testado localmente; falta validar com Supabase real** | Perfil completo, moradas, contactos, fiscais, equipa/convites, projetos, biblioteca privada com versões imutáveis |
| 2 Orçamentos manuais | por fazer | Pedidos, versões, validade, aprovar/rejeitar, admin básico |
| 3 Simulador | **BLOQUEADO** | Requer acesso/regras reais do simulador atual |
| 4 Encomendas | por fazer | Estados, produção, expedição, repetir encomenda |
| 5 Mensagens/notificações | por fazer | |
| 6 Administração completa | por fazer | |
| 7 Endurecimento | por fazer | CSP, RGPD, carga, backups |
| 8 Integrações | por fazer | Faturação, pagamentos, impressoras (só adaptadores) |

## Fase 0 — critérios
Verificados: CI local (lint, tipos, 66 testes, build), arranque real do servidor, isolamento na BD.
**Não verificados** (precisam do projeto Supabase): registo/login/recuperação ponta a ponta, envio de emails, criação automática da conta após confirmação, CI no GitHub.

## Fase 1 — critérios
Verificados localmente: lint, tipos, 146 testes (unitários + PostgreSQL 16), build, arranque do servidor (rotas privadas fechadas), mutação manual das proteções.
**Não verificados** (ver docs/TESTES.md §B): fluxos autenticados reais, upload/descarga com o Storage real, emails.
