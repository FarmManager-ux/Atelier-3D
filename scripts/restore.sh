#!/usr/bin/env bash
# Restauro de um backup criado por scripts/backup.sh para uma base de dados VAZIA e preparada
# (projeto Supabase novo, ou base de teste com os esquemas auth/extensions).
#
#   uso: RESTORE_DB_URL=... BACKUP_PASSPHRASE=... scripts/restore.sh ficheiro.tar.gz.enc
#
# Nunca restaura por cima de dados existentes: recusa se public.profiles já existir.
set -euo pipefail

: "${RESTORE_DB_URL:?RESTORE_DB_URL em falta}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE em falta}"
file="${1:?indique o ficheiro de backup}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [ "$(psql "$RESTORE_DB_URL" -tAc "select to_regclass('public.profiles') is not null")" = "t" ]; then
  echo "RECUSADO: a base de destino já tem dados da aplicação (public.profiles existe)." >&2
  exit 3
fi
if [ -f "$file.sha256" ]; then ( cd "$(dirname "$file")" && sha256sum -c "$(basename "$file").sha256" >/dev/null ); fi

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" -out "$work/backup.tar.gz"
tar -C "$work" -xzf "$work/backup.tar.gz"
# Extensões exigidas pelo esquema (idempotente; já existem num projeto Supabase típico).
psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -q -c "create schema if not exists extensions" \
  -c "create extension if not exists pgcrypto with schema extensions" \
  -c "create extension if not exists citext with schema extensions" 2>/dev/null
psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/01-auth-data.sql"
# O esquema "public" já existe em qualquer base PostgreSQL/Supabase.
sed -i '/^CREATE SCHEMA public;$/d' "$work/02-app.sql"
psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$work/02-app.sql"
echo "Restauro concluído."
