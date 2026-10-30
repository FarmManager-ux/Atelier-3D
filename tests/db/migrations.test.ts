import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { createTestDatabase } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
beforeAll(async () => { ({ pool, drop } = await createTestDatabase()); });
afterAll(async () => { await drop?.(); });

describe("migrações", () => {
  it("aplicam-se por ordem a uma base limpa", async () => {
    const { rows } = await pool.query(`select count(*)::int n from information_schema.tables where table_schema='public'`);
    expect(rows[0].n).toBeGreaterThanOrEqual(10);
  });
  it("todas as tabelas do esquema public têm RLS ativa (regra do projeto)", async () => {
    const { rows } = await pool.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
  it("anon não tem qualquer privilégio sobre tabelas do esquema public", async () => {
    const { rows } = await pool.query(
      `select table_name, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'anon'`);
    expect(rows).toEqual([]);
  });
  it("nenhuma função em public é executável por anon", async () => {
    const { rows } = await pool.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`);
    expect(rows.map((r) => r.proname)).toEqual([]);
  });
  it("não existe nenhuma função security definer sem search_path fixo", async () => {
    const { rows } = await pool.query(
      `select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public','app_private') and p.prosecdef
          and not coalesce(p.proconfig::text, '') like '%search_path%'`);
    expect(rows.map((r) => r.fn)).toEqual([]);
  });
});
