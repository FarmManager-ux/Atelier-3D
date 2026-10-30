import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function adminUrl(): string {
  return (
    process.env.TEST_DATABASE_URL ??
    "postgres://atelier_test:test@127.0.0.1:5432/postgres"
  );
}

/** Cria uma base de dados descartável e aplica o shim + todas as migrações. */
export async function createTestDatabase(): Promise<{
  pool: pg.Pool;
  drop: () => Promise<void>;
}> {
  const name = `atelier_test_${process.pid}_${Date.now()}`;
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  await admin.query(`create database ${name}`);

  const url = new URL(adminUrl());
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });
  // Ligações inativas podem ser terminadas pelo DROP DATABASE ... FORCE no fim; é esperado.
  pool.on("error", () => {});

  await pool.query(readFileSync(join(ROOT, "tests/db/supabase-shim.sql"), "utf8"));
  const dir = join(ROOT, "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(join(dir, f), "utf8"));
  }

  return {
    pool,
    drop: async () => {
      await pool.end();
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}

export async function createUser(pool: pg.Pool, email: string, fullName?: string) {
  const { rows } = await pool.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify(fullName ? { full_name: fullName } : {})],
  );
  return rows[0].id as string;
}

/**
 * Executa `fn` como um utilizador autenticado (papel "authenticated" + JWT sub),
 * dentro de uma transação revertida no fim.
 */
export async function asUser<T>(
  pool: pg.Pool,
  userId: string | null,
  fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${userId ? "authenticated" : "anon"}`);
    if (userId) {
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
    }
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Executa `fn` como o servidor com chave de serviço (papel service_role). */
export async function asService<T>(
  pool: pg.Pool,
  fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role service_role");
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function createStaff(pool: pg.Pool, email: string, role: string) {
  const id = await createUser(pool, email);
  await pool.query(`insert into public.staff_members (user_id, role_key) values ($1, $2)`, [id, role]);
  return id;
}
