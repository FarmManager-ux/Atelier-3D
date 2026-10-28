# Ações manuais pendentes (dependem do proprietário)

A sessão cloud não consegue alcançar `supabase.com`, por isso nada disto foi feito nem testado.

## 1. Criar o projeto Supabase
1. Em supabase.com criar um projeto (sugestão: nome `atelier3d-staging`) na região **UE** (ex.: Frankfurt `eu-central-1`).
2. Guardar a palavra-passe da BD num gestor de palavras-passe.
3. Em *Project Settings → API* copiar **URL** e **anon/publishable key** (a `service_role` NUNCA vai para o repositório nem para o browser).

## 2. Aplicar as migrações
Ver [MIGRACOES.md](MIGRACOES.md) (inclui os avisos da Fase 1). Em *SQL Editor*, executar por ordem **todos** os ficheiros de `supabase/migrations/` (8 ficheiros) (ou, noutra máquina/sessão com acesso, `supabase db push`). Depois confirmar que as tabelas têm RLS ativa (*Table Editor*).

## 3. Configurar Authentication
- *Providers → Email*: confirmação de email **ativa**; mínimo de palavra-passe 12.
- *URL Configuration*: Site URL = URL da app; Redirect URLs inclui `<URL>/auth/confirmar`.
- *Email Templates* (Confirm signup e Reset password): usar ligação
  `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=signup&next=/conta` e, na recuperação,
  `...&type=recovery&next=/redefinir-palavra-passe`; traduzir o texto para pt-PT.
- Configurar SMTP próprio (remetente em atelier3d.pt, SPF/DKIM/DMARC) — o SMTP por omissão do Supabase é limitado.

## 4. Variáveis de ambiente
- **GitHub → Settings → Secrets and variables → Actions**: não são precisas para o CI atual (usa um Postgres próprio).
- **Hosting** (ex.: Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` e, **novo na Fase 1**, `SUPABASE_SERVICE_ROLE_KEY` (segredo; só no servidor, nunca com prefixo `NEXT_PUBLIC_`; necessário para concluir uploads). Se esta chave não estiver definida, os uploads falham de forma segura (ficam `pending`).
- **Sessões cloud do Claude Code**: para correr a app contra o Supabase, definir as mesmas variáveis em *Environment → Secrets* e permitir o domínio `*.supabase.co` na rede do ambiente.

## 5. Primeira conta da equipa
Registar-se na app e, no *SQL Editor*, executar (substituir pelo email real):
```sql
insert into public.staff_members (user_id, role)
select id, 'admin' from auth.users where email = 'o-seu-email@exemplo.pt';
```
Ativar 2FA nessa conta assim que a Fase 6 o exigir.

## 6. Hosting e domínio (só com a sua confirmação)
Escolher o hosting (ex.: Vercel) e, **quando decidir**, criar o registo DNS de `conta.atelier3d.pt`. Nada foi alterado no DNS nem no site atual.

## 7. Acesso ao site atual (desbloqueia a Fase 3)
Permitir `atelier3d.pt` e `www.atelier3d.pt` na rede do ambiente cloud, ou fornecer o código/regras do simulador.

## 8. Textos legais
Fornecer/aprovar termos de utilização e política de privacidade (o formulário de registo já exige aceitação, mas ainda não liga a nenhum texto).

## 9. GitHub
Ativar proteção da branch `main` (exigir CI verde e revisão) e, se desejar, Dependabot.

## 10. Fase 1 — decisões e verificações que dependem de si
1. **Confirmar formatos e limites** (STL, 3MF, STEP/STP, OBJ até 100 MB; PNG, JPG, WebP até 15 MB). Para alterar: tabela `file_type_rules` **e** `src/lib/files/rules.ts` (o teste de paridade avisa se divergirem). O Supabase impõe um limite global de tamanho por ficheiro que depende do plano (historicamente 50 MB no plano gratuito; **confirme nas definições do seu projeto**) — se for inferior a 100 MB, reduza o limite ou mude de plano.
2. **Confirmar no Supabase** que o bucket `project-files` ficou **Private** (Storage) e que as 3–4 políticas de `storage.objects` existem.
3. **Quotas de armazenamento por conta**: definir se quer limite (e qual) — não inventei nenhum.
4. **Antivírus**: decidir o serviço para a Fase 7 (ex.: ClamAV num serviço próprio).
5. **Teste manual após configurar o Supabase** (checklist): registar duas contas (A e B); em A criar projeto e carregar um STL; confirmar que B não vê nada e que o URL de descarga de A não funciona para B; carregar uma 2.ª versão e confirmar que a aprovada não muda; convidar um utilizador numa conta de empresa e aceitar o convite.
6. **Rotas CORS/Storage**: se o upload falhar no browser, verificar em *Storage → Settings* e nas *Redirect URLs* do projeto.
