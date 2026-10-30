#!/usr/bin/env bash
# Prova que um backup se restaura: cria uma base com as migrações + dados de exemplo (fictícios),
# faz backup cifrado, restaura numa base nova e compara contagens de linhas.
# Precisa de PostgreSQL local (TEST_DATABASE_URL como administrador). Não toca em dados reais.
set -euo pipefail
cd "$(dirname "$0")/.."

admin="${TEST_DATABASE_URL:-postgres://atelier_test:test@127.0.0.1:5432/postgres}"
base="${admin%/*}"
src="atelier_bk_src_$$"; dst="atelier_bk_dst_$$"; tmp="$(mktemp -d)"
cleanup() { psql "$admin" -qc "drop database if exists $src with (force)" -c "drop database if exists $dst with (force)" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

prepare() { # shim do Supabase + migrações
  psql "$base/$1" -v ON_ERROR_STOP=1 -q -f tests/db/supabase-shim.sql >/dev/null 2>&1
}
psql "$admin" -qc "create database $src" -c "create database $dst"
prepare "$src"
for f in $(ls supabase/migrations/*.sql | sort); do psql "$base/$src" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1; done

# dados de exemplo (fictícios)
psql "$base/$src" -v ON_ERROR_STOP=1 -q -o /dev/null <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'ana@example.test'),
                                          ('22222222-2222-4222-8222-222222222222', 'bruno@example.test');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222"}', false);
select public.create_customer_account('company', 'Empresa de Teste, Lda');
SQL


export SUPABASE_DB_URL="$base/$src" BACKUP_PASSPHRASE="frase-de-teste-nao-secreta" BACKUP_DIR="$tmp"
bash scripts/backup.sh >/dev/null
file="$(ls "$tmp"/*.enc)"

# o ficheiro cifrado não pode conter dados legíveis
if grep -aq "Empresa de Teste" "$file"; then echo "FALHA: o backup não está cifrado" >&2; exit 1; fi
# palavra-passe errada tem de falhar
if RESTORE_DB_URL="$base/$dst" BACKUP_PASSPHRASE="errada" bash scripts/restore.sh "$file" >/dev/null 2>&1; then
  echo "FALHA: restauro aceitou palavra-passe errada" >&2; exit 1; fi

prepare "$dst"
RESTORE_DB_URL="$base/$dst" bash scripts/restore.sh "$file" >/dev/null

# nunca restaura por cima de dados existentes
if RESTORE_DB_URL="$base/$dst" bash scripts/restore.sh "$file" >/dev/null 2>&1; then
  echo "FALHA: restauro sobrescreveu uma base com dados" >&2; exit 1; fi

count() { psql "$base/$1" -tAc "select (select count(*) from auth.users) || ',' || (select count(*) from public.profiles) || ',' || (select count(*) from public.customer_accounts) || ',' || (select count(*) from public.customer_members) || ',' || (select count(*) from public.permissions) || ',' || (select count(*) from public.role_permissions) || ',' || (select count(*) from public.audit_log)"; }
a="$(count "$src")"; b="$(count "$dst")"
echo "origem=$a restaurado=$b"
[ "$a" = "$b" ] || { echo "FALHA: contagens diferentes" >&2; exit 1; }
echo "OK: backup cifrado, restauro verificado e contagens idênticas."
