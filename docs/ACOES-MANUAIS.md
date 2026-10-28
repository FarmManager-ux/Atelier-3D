# Ações manuais pendentes (dependem do proprietário)

A sessão cloud não consegue alcançar `supabase.com`, por isso nada disto foi feito nem testado.

## 1. Criar o projeto Supabase
1. Em supabase.com criar um projeto (sugestão: nome `atelier3d-staging`) na região **UE** (ex.: Frankfurt `eu-central-1`).
2. Guardar a palavra-passe da BD num gestor de palavras-passe.
3. Em *Project Settings → API* copiar **URL** e **anon/publishable key** (a `service_role` NUNCA vai para o repositório nem para o browser).

## 2. Aplicar as migrações
Em *SQL Editor*, executar por ordem os ficheiros de `supabase/migrations/` (ou, noutra máquina/sessão com acesso, `supabase db push`). Depois confirmar que as tabelas têm RLS ativa (*Table Editor*).

## 3. Configurar Authentication
- *Providers → Email*: confirmação de email **ativa**; mínimo de palavra-passe 12.
- *URL Configuration*: Site URL = URL da app; Redirect URLs inclui `<URL>/auth/confirmar`.
- *Email Templates* (Confirm signup e Reset password): usar ligação
  `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=signup&next=/conta` e, na recuperação,
  `...&type=recovery&next=/redefinir-palavra-passe`; traduzir o texto para pt-PT.
- Configurar SMTP próprio (remetente em atelier3d.pt, SPF/DKIM/DMARC) — o SMTP por omissão do Supabase é limitado.

## 4. Variáveis de ambiente
- **GitHub → Settings → Secrets and variables → Actions**: não são precisas para o CI atual (usa um Postgres próprio).
- **Hosting** (ex.: Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
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
