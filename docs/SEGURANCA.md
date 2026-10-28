# Segurança e RGPD

## Implementado e testado na Fase 0
- RLS em todas as tabelas; `anon` sem acesso; privilégios mínimos a `authenticated` (testes em `tests/db/rls.test.ts`, incl. teste de mutação manual).
- Isolamento entre clientes (contas, membros, dados fiscais, convites, auditoria).
- Convites: token aleatório de 256 bits, só o hash na BD, expiram em 7 dias, uso único, ligados ao email.
- Auditoria append-only (UPDATE/DELETE/TRUNCATE bloqueados), sem valores pessoais.
- Redirecionamento seguro (`safeRedirectPath`) contra *open redirect*.
- Respostas neutras em registo/recuperação (sem enumeração de contas).
- Cabeçalhos: HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP.
- Palavra-passe: mínimo 12 caracteres.

## Implementado e testado na Fase 1 (testes locais; ver docs/TESTES.md §B)
- Bucket privado; políticas do Storage ligadas à BD (pertença à conta + versão `available`).
- `available` só é atribuído pelo servidor após verificar tamanho, SHA-256 e assinatura do ficheiro; nenhum cliente consegue marcar um ficheiro como disponível (testado).
- Imutabilidade de versões (gatilho) e aprovação explícita; nomes de ficheiro saneados e caminhos só com UUIDs (sem *path traversal*).
- Isolamento de projetos, ficheiros, moradas, contactos e dados fiscais entre clientes; operadores sem dados fiscais.
- Auditoria de alterações a moradas/contactos/ficheiros sem guardar o conteúdo.
- Erros da BD nunca chegam ao utilizador com detalhes técnicos.
- A chave de serviço só existe em código `server-only` (verificado: não aparece no *bundle* do browser).
- Travão de abuso: máx. 20 uploads pendentes por utilizador/hora.

## Limitações conhecidas da Fase 1
- **Sem antivírus**: a verificação por assinatura só deteta ficheiros que não correspondem à extensão; não deteta malware dentro de um formato válido (Fase 7).
- Sem quotas de armazenamento por conta (decisão de negócio pendente).
- A aceitação do convite ocorre ao abrir a ligação (autenticado, email coincidente); sem envio de email — a ligação é copiada manualmente.
- Uploads `pending` abandonados não expiram ainda.

## Por fazer (fases seguintes / ações do proprietário)
- **CSP** com nonce (Fase 7). **2FA** obrigatório para a equipa (configurar no Supabase + exigir na app, Fase 6).
- Limitação de pedidos além da do Supabase Auth; CAPTCHA no registo se houver abuso.
- Ficheiros: bucket privado, antivírus, validação de tipo/tamanho, hash SHA-256 (Fase 1).
- RGPD: política de privacidade, termos, base legal, registo de tratamentos, subcontratantes (Supabase, email), exportação/eliminação de dados, retenção (dados fiscais podem exigir conservação legal — validar com contabilista/jurista). Os termos referidos no registo ainda não têm texto/ligação.
- Backups: ativar *Point-in-Time Recovery* (plano pago) ou backups diários e testar restauro.
- Registo de erros (Sentry ou equivalente), sem dados pessoais nos logs.
