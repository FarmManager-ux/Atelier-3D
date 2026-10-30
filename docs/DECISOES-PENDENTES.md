# Decisões que dependem do proprietário

Nada abaixo foi decidido por mim. Cada ponto indica o impacto e a minha recomendação.

| # | Decisão | Porque importa | Recomendação |
|---|---|---|---|
| 1 | **Alojamento da aplicação** | O plano gratuito da Vercel (Hobby) destina-se a uso não comercial (confirme nos termos atuais). Alternativas gratuitas: Netlify, Cloudflare Pages/Workers, ou servidor próprio (custo). | Decidir antes da Fase 1 (preview e PWA dependem disto). Posso avaliar a compatibilidade de cada opção sem custo. |
| 2 | **Plano Supabase e ficheiros 3D** | O limite de tamanho por ficheiro e o armazenamento do plano gratuito podem não chegar a 100 MB por ficheiro; o projeto gratuito pode pausar por inatividade e não tem backups utilizáveis (mitigado por `scripts/backup.sh`). | Começar no gratuito com limite de ficheiros menor; avaliar o plano pago só quando necessário (precisa da sua autorização). |
| 3 | **Email transacional (SMTP)** | O envio de emails de confirmação/recuperação exige SMTP próprio; o SMTP por omissão do Supabase é muito limitado (confirme). Opções: SMTP do seu fornecedor de email do domínio (sem custo adicional) ou um serviço com nível gratuito (conta externa → precisa da sua autorização). | Usar o SMTP do domínio atelier3d.pt se existir. |
| 4 | **Projeto Supabase** | Não consigo ver se já existe um projeto, nem se as migrações antigas foram aplicadas. | Confirmar (ver docs/SUPABASE.md §0). |
| 5 | **Ordem das fases 7 e 8** | Produção (7) usa impressoras e materiais (8); o simulador (4) usa materiais. | Criar `materials` na Fase 4 e `printers` na Fase 7 (ecrãs completos na 8), ou trocar 7↔8. |
| 6 | **Pagamentos da modelação** | O fluxo pede "pagamento ou autorização administrativa". Pagamento online exige API comercial. | Fase 5 apenas com registo manual/autorização; online só com autorização. |
| 7 | **Conteúdos do site público** | Textos, imagens de portefólio e FAQ têm de ser reais e aprovados por si. | Fornecer na Fase 1; até lá uso marcadores claramente identificados. |
| 8 | **Antivírus para uploads** | Verificação de malware exige um serviço (ClamAV é gratuito, mas precisa de alojamento). | Decidir na Fase 2. |
| 9 | **DNS `portal.atelier3d.pt`** | Não altero DNS sem confirmação. | Quando o alojamento estiver escolhido, indico o registo exato a criar. |
| 10 | **Política de privacidade e termos** | Obrigatório com registo aberto (RGPD). | Fornecer ou validar texto até à Fase 2. |
