import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { createTestDatabase } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
beforeAll(async () => { ({ pool, drop } = await createTestDatabase()); });
afterAll(async () => { await drop?.(); });

const REQUIRED = ["weddings", "wedding_members", "guests", "guest_groups", "invitations", "rsvp_responses", "tables",
  "table_seats", "guest_seatings", "budget_categories", "expenses", "tasks", "vendors", "documents", "calendar_events"];

describe("migrações", () => {
  it("aplicam-se por ordem a uma base limpa e criam todas as tabelas pedidas", async () => {
    const { rows } = await pool.query(`select table_name from information_schema.tables where table_schema='public'`);
    const have = rows.map((r) => r.table_name);
    for (const t of REQUIRED) expect(have, t).toContain(t);
  });
  it("todas as tabelas de public têm RLS ativa", async () => {
    const { rows } = await pool.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
  it("anon não tem privilégios sobre nenhuma tabela", async () => {
    const { rows } = await pool.query(
      `select table_name from information_schema.role_table_grants where table_schema='public' and grantee='anon'`);
    expect(rows).toEqual([]);
  });
  it("anon só executa as duas RPC públicas de RSVP", async () => {
    const { rows } = await pool.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    expect(rows.map((r) => r.proname)).toEqual(["get_rsvp_invitation", "submit_rsvp"]);
  });
  it("funções security definer têm search_path fixo", async () => {
    const { rows } = await pool.query(
      `select n.nspname||'.'||p.proname as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','app_private') and p.prosecdef and not coalesce(p.proconfig::text,'') like '%search_path%'`);
    expect(rows.map((r) => r.fn)).toEqual([]);
  });
  it("o bucket de documentos é privado", async () => {
    const { rows } = await pool.query(`select public from storage.buckets where id='wedding-documents'`);
    expect(rows[0].public).toBe(false);
  });
});
