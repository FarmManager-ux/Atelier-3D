# Backups próprios

O plano gratuito do Supabase não inclui backups geridos utilizáveis para recuperação, por isso o projeto tem os seus.
Ferramentas gratuitas: `pg_dump`, `openssl` (AES-256, PBKDF2) e GitHub Actions.

## O que inclui
Esquemas `public` e `app_private` (estrutura e dados) e `auth.users`/`auth.identities` (utilizadores).
**Não inclui os ficheiros do Storage** (3D, imagens, documentos): ficam para a Fase 2, com cópia dedicada.

## Como funciona
- `scripts/backup.sh` → `backups/atelier3d-<data>.tar.gz.enc` (+ `.sha256`).
- `scripts/restore.sh` → restaura para uma base **vazia**; recusa se já houver dados da aplicação; verifica o SHA-256.
- `pnpm backup:verify` (corre no CI) prova o ciclo completo: cifra, palavra-passe errada falha, restauro recusa sobrescrever,
  contagens idênticas (utilizadores, contas, permissões, auditoria).
- `.github/workflows/backup.yml`: semanal (segunda, 03:17 UTC) e manual. **Só corre se os segredos existirem**; sem eles termina sem erro.
  O ficheiro cifrado fica como artefacto privado do GitHub durante 30 dias.

## Ações suas para ativar
1. No Supabase, copie a ligação **Session pooler** (os *runners* do GitHub não têm IPv6; a ligação direta do plano gratuito é só IPv6).
2. GitHub → Settings → Secrets and variables → Actions: crie `SUPABASE_DB_URL` e `BACKUP_PASSPHRASE` (frase longa e aleatória).
3. **Guarde a `BACKUP_PASSPHRASE` num gestor de palavras-passe, separada do GitHub.** Sem ela o backup não se recupera.
4. Execute o workflow manualmente uma vez e, **a cada trimestre**, faça um restauro de teste para um projeto Supabase de ensaio.
5. Para retenção superior a 30 dias, descarregue periodicamente os artefactos para um local seu.
