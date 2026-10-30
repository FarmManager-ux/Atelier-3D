# Roadmap do Atelier 3D Portal

Regras: uma fase só começa depois de a anterior estar **validada pelo proprietário**; cada fase deixa `pnpm check`,
`pnpm backup:verify` e `pnpm build` a verde; nenhuma funcionalidade é dada como concluída sem teste; nada de preços,
prazos ou dados de produção inventados (os valores são sempre configurados pela equipa).
Invariantes do produto: só impressão **FDM**; sem loja, carrinho ou produtos; sem integração com o Shopify (www);
faturação oficial no Moloni (sem integração obrigatória); sem serviços pagos nem APIs comerciais sem autorização.

| Fase | Nome | Estado |
|---|---|---|
| 0 | Fundação técnica e arquitetura | **Implementada e testada localmente; aguarda validação** |
| 1 | Design system e site público | por fazer |
| 2 | Autenticação e área de clientes | por fazer |
| 3 | CRM e central de contactos | por fazer |
| 4 | Orçamentos e simulador FDM | por fazer |
| 5 | Modelação 3D | por fazer |
| 6 | Encomendas e documentos | por fazer |
| 7 | Produção | por fazer |
| 8 | Impressoras e materiais | por fazer |
| 9 | Financeiro e relatórios | por fazer |
| 10 | Automatizações e otimização | por fazer |

> **Dependências a decidir (ver DECISOES-PENDENTES.md):** o simulador (Fase 4) precisa de um catálogo mínimo de
> materiais, e a Produção (Fase 7) precisa de impressoras e materiais (Fase 8). Proposta: criar as tabelas base
> `materials` na Fase 4 e `printers` na Fase 7 (com ecrãs de gestão completos na Fase 8), ou então trocar a ordem 7↔8.

---

## Fase 0 — Fundação técnica e arquitetura
**Objetivos:** base profissional sobre a qual todas as fases assentam.
**Funcionalidades:** estrutura modular; tokens do design system; Supabase (clientes SSR, proxy de sessão); RBAC da equipa
(6 funções, 34 permissões); contas de clientes particulares/empresa com vários utilizadores e convites; dados de
faturação separados; auditoria append-only; testes de BD/arquitetura; CI; backups cifrados com restauro verificado.
**Base de dados:** `profiles`, `permissions`, `staff_roles`, `role_permissions`, `staff_members`, `customer_accounts`,
`customer_members`, `customer_invitations`, `customer_billing_profiles`, `audit_log` + RPCs `create_customer_account`,
`invite_customer_member`, `accept_customer_invitation`.
**Testes:** 47 de BD (isolamento, RBAC ≡ TypeScript, auditoria, invariantes estruturais), 53 unitários/arquitetura,
`backup:verify`, build. **Critérios:** CI verde; mutação manual de 6 políticas detetada; documentação completa;
validação do proprietário (inclui decisões pendentes que bloqueiam a Fase 1).

## Fase 1 — Design system e site público
**Objetivos:** identidade visual própria (preto, grafite, branco, cinzento, laranja) e site público profissional, instalável (PWA).
**Funcionalidades:** componentes base acessíveis (botões, formulários, tabelas, cartões, navegação) com experiências
distintas para computador, tablet e telemóvel; homepage; a empresa; serviços (impressão 3D FDM, modelação 3D,
prototipagem, produção em série, soluções empresariais, peças de substituição); portefólio; biblioteca de plataformas
de modelos 3D (ligações curadas); contactos; FAQ; formulário de pedido de contacto/orçamento (lead); PWA (manifest,
service worker, ícones, offline básico); SEO e RGPD (política de privacidade, cookies só essenciais).
**Base de dados:** `portfolio_items`, `faq_items`, `service_pages` (conteúdo gerido por `content.manage`),
`contact_requests` (inserção pública por RPC com validação e *honeypot*; leitura só por `crm.read`).
**Testes:** RLS (leitura pública só de conteúdo publicado; inserção de pedidos sem leitura), acessibilidade (axe),
regressão visual em 3 larguras (Playwright), Lighthouse (PWA/desempenho) no CI. **Critérios:** WCAG AA nas páginas
principais; PWA instalável no Android; pedidos de contacto guardados; textos e imagens aprovados pelo proprietário.

## Fase 2 — Autenticação e área de clientes
**Objetivos:** registo aberto e área privada de cada cliente.
**Funcionalidades:** registo, confirmação de email, login, recuperação; contas particulares e empresariais com utilizadores
e convites; dashboard; dados pessoais e de faturação (NIF validado); ficheiros 3D e imagens privados com **versões
imutáveis** (nunca substituir ficheiros aprovados); documentos; histórico; área `/cliente`; painel `/admin` (casca com
guarda de permissões e 2FA para a equipa).
**Base de dados:** `files`, `file_versions`, `documents`, bucket privado `customer-files` + políticas de Storage,
`notification_preferences`.
**Testes:** isolamento de ficheiros entre clientes, upload (tamanho/formato/assinatura/hash), imutabilidade, fluxos de
autenticação, 2FA da equipa, E2E em Playwright contra Supabase de *staging*. **Critérios:** dois clientes nunca veem
dados um do outro (provado em BD **e** pela API real); upload/descarga reais funcionam; 2FA obrigatório à equipa.

## Fase 3 — CRM e central de contactos
**Objetivos:** centralizar todos os contactos num só sítio.
**Funcionalidades:** registo manual de contactos de website, Instagram, WhatsApp, email, telefone e presencial; associação a
clientes e orçamentos; interações e notas; estados do contacto; conversão de pedido do site em contacto; mensagens por
pedido/encomenda entre cliente e equipa; notificações na aplicação.
**Base de dados:** `contacts`, `contact_channels`, `interactions`, `message_threads`, `messages`, `notifications`.
**Testes:** RLS por permissão (`crm.*`, `messages.*`), isolamento das mensagens, pesquisa, auditoria.
**Critérios:** fluxo completo de um contacto desde a receção até à associação a cliente e orçamento.

## Fase 4 — Orçamentos e simulador FDM
**Objetivos:** orçamentos fiáveis e estimativas indicativas com motor próprio e gratuito.
**Funcionalidades:** formulários para modelos existentes, modelação 3D, peças automóveis e projetos industriais, com
upload de fotografias e ficheiros 3D; ciclo do orçamento (rascunho, enviado, aceite, rejeitado, expirado) com versões e
validade; motor de estimativa (dimensões, material, peso, enchimento, paredes, suportes, altura de camada, tempo,
energia, preparação, mão de obra, margem) com **intervalos** indicativos; análise local de STL/3MF/OBJ (volume, caixa
envolvente, área, indício de suportes) no browser, sem APIs externas; regras e tarifas configuráveis no painel e
guardadas em *snapshot* por orçamento.
**Base de dados:** `materials` (catálogo base), `quote_requests`, `quotes`, `quote_versions`, `quote_lines`,
`pricing_rule_sets` (versionados), `estimates`.
**Testes:** testes de ouro do motor com **parâmetros de teste explícitos** (nunca valores reais inventados), propriedades
(monotonia, intervalos coerentes), *parsers* com sólidos de volume conhecido, recusa de calcular sem parâmetros
configurados. **Critérios:** o motor nunca devolve valores sem tarifas aprovadas pelo proprietário; paridade provada
entre os cálculos do browser e do servidor.

## Fase 5 — Modelação 3D
**Objetivos:** serviço pago de modelação com custo conhecido antes de começar.
**Funcionalidades:** fluxo (1) pedido, (2) análise, (3) orçamento de modelação, (4) aceitação, (5) pagamento **registado
manualmente** ou autorização administrativa, (6) modelação, (7) revisões, (8) aprovação, (9) entrega do ficheiro,
(10) encomenda de impressão. Máquina de estados com transições validadas.
**Base de dados:** `modeling_jobs`, `modeling_quotes`, `modeling_revisions`, `modeling_deliverables`.
**Testes:** transições legais/ilegais, impossibilidade de iniciar sem aceitação e pagamento/autorização, entrega só após
aprovação, permissões `modeling.*`. **Critérios:** nenhum trabalho inicia sem custo aceite. *(Pagamentos online: só com
autorização expressa.)*

## Fase 6 — Encomendas e documentos
**Funcionalidades:** encomenda criada a partir de orçamento aceite; estados e histórico; repetir encomenda (novo
orçamento, nunca copia preço antigo); documentos associados (PDF do orçamento gerado localmente); expedição e registo de
entrega. **Base de dados:** `orders`, `order_items`, `order_status_history`, `shipments`, extensão de `documents`.
**Testes:** transições, isolamento, repetição. **Critérios:** cliente acompanha estado e histórico das suas encomendas.

## Fase 7 — Produção
**Funcionalidades:** trabalhos de produção; planeamento; atribuição de impressoras; consumos; tempos; falhas; controlo de
qualidade. **Base de dados:** `production_jobs`, `production_events`, `print_failures`, `quality_checks`.
**Testes:** transições, atribuição sem conflitos, permissões `production.*`. **Critérios:** um trabalho percorre
planeamento → impressão → controlo de qualidade com consumos registados.

## Fase 8 — Impressoras e materiais
**Funcionalidades:** equipamentos FDM adicionáveis no painel; materiais (os 11 iniciais) adicionáveis; bobines; stock e
peças; manutenção. **Base de dados:** `printers`, `printer_maintenance`, `spools`, `stock_items`, `stock_movements`.
**Testes:** saldos de stock, bobine↔consumo, manutenção, permissões. **Critérios:** consumos de produção abatem bobines.

## Fase 9 — Financeiro e relatórios
**Funcionalidades:** custos, margens, rentabilidade, valores orçamentados vs recebidos, registos de faturação (referência
ao documento do Moloni, sem integração obrigatória); relatórios e indicadores. **Base de dados:** `cost_entries`,
`payments_received`, `invoice_references`, vistas de relatório. **Testes:** cálculos com dados controlados, permissões
`finance.*`, produção e comercial sem acesso. **Critérios:** rentabilidade por encomenda reconcilia com os registos.

## Fase 10 — Automatizações e otimização
**Funcionalidades:** regras (lembretes, validade de orçamentos, alertas de stock/manutenção), tarefas agendadas (gratuitas:
`pg_cron`/GitHub Actions), otimização de desempenho, revisão de segurança e RGPD final. **Testes:** idempotência das
automatizações, carga, auditoria. **Critérios:** auditoria de segurança sem achados críticos.
