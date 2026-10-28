# Plano faseado

| Fase | Estado | Conteúdo |
|---|---|---|
| 0 Fundações | **Código pronto; falta ligar ao Supabase real** | Projeto, CI, esquema base, autenticação, contas multiutilizador, auditoria, i18n |
| 1 Perfis e ficheiros | por fazer | Perfil completo, moradas, fiscais, biblioteca privada de ficheiros com versões |
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
