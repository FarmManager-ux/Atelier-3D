#!/usr/bin/env bash
# Backup cifrado da base de dados do Atelier 3D Portal (ferramentas gratuitas: pg_dump + openssl).
#
# Variáveis:
#   SUPABASE_DB_URL     (obrigatória) ligação PostgreSQL, ex.: postgresql://postgres:***@db.xxx.supabase.co:5432/postgres
#   BACKUP_PASSPHRASE   (obrigatória) palavra-passe de cifra (guardar à parte, num gestor de palavras-passe)
#   BACKUP_DIR          (opcional)    diretório de saída (por omissão ./backups)
#
# Conteúdo: dados da aplicação (esquemas public e app_private) + utilizadores (auth.users, auth.identities).
# NÃO inclui os ficheiros do Storage (ver docs/BACKUPS.md).
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL em falta}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE em falta}"
out_dir="${BACKUP_DIR:-./backups}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$out_dir"

# 1) utilizadores (têm de ser restaurados antes, por causa das chaves estrangeiras)
pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
  -t auth.users -t auth.identities > "$work/01-auth-data.sql"
# 2) estrutura e dados da aplicação
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges \
  --schema=public --schema=app_private > "$work/02-app.sql"

# Compatibilidade: pg_dump 17+ escreve opções que servidores mais antigos (ex.: PostgreSQL 15/16) rejeitam.
sed -i '/^SET transaction_timeout = /d' "$work/01-auth-data.sql" "$work/02-app.sql"

tar -C "$work" -czf "$work/backup.tar.gz" 01-auth-data.sql 02-app.sql
target="$out_dir/atelier3d-$stamp.tar.gz.enc"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass env:BACKUP_PASSPHRASE -in "$work/backup.tar.gz" -out "$target"
chmod 600 "$target"
( cd "$out_dir" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256" )
echo "Backup criado: $target"
