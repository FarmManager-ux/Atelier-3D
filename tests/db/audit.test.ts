import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { asService, asUser, createStaff, createTestDatabase, createUser } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
let bruno: string, eva: string, diogo: string, auditor: string, sales: string;
let acme: string, beta: string;

beforeAll(async () => {
  ({ pool, drop } = await createTestDatabase());
  [bruno, eva, diogo] = await Promise.all(["bruno", "eva", "diogo"].map((n) => createUser(pool, `${n}@example.test`)));
  auditor = await createStaff(pool, "audit@example.test", "manager");
  sales = await createStaff(pool, "sales@example.test", "sales");
  const mk = async (u: string, name: string) =>
    (await asUser(pool, u, (q) => q(`select public.create_customer_account('company',$1) id`, [name]), { commit: true })).rows[0].id;
  acme = await mk(bruno, "Acme");
  beta = await mk(eva, "Beta");
  await asUser(pool, bruno, (q) => q(`insert into public.customer_billing_profiles (account_id, legal_name, tax_id) values ($1,'Acme, Lda','123456789')`, [acme]), { commit: true });
  await asUser(pool, bruno, (q) => q(`update public.customer_billing_profiles set tax_id='555555550' where account_id=$1`, [acme]), { commit: true });
});
afterAll(async () => { await drop?.(); });

describe("registo de auditoria", () => {
  it("regista contas, membros e faturação — sem guardar valores pessoais ou fiscais", async () => {
    const { rows } = await pool.query(`select action, metadata from public.audit_log where account_id=$1 order by id`, [acme]);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["customer_accounts.insert", "customer_members.insert", "customer_billing_profiles.insert", "customer_billing_profiles.update"]));
    const all = JSON.stringify(rows);
    for (const secret of ["123456789", "555555550", "Acme, Lda"]) expect(all).not.toContain(secret);
    expect(rows.find((r) => r.action === "customer_billing_profiles.update")!.metadata.changed).toEqual(["tax_id"]);
  });
  it("regista valores apenas das colunas marcadas como seguras (papel, estado)", async () => {
    await pool.query(`update public.customer_accounts set status='suspended' where id=$1`, [acme]);
    const { rows } = await pool.query(`select metadata from public.audit_log where account_id=$1 and action='customer_accounts.update' order by id desc limit 1`, [acme]);
    expect(rows[0].metadata).toMatchObject({ safe: { status: "suspended", kind: "company" }, changed: ["status"], previous: { status: "active" } });
  });
  it("regista alterações da equipa (função/estado)", async () => {
    const { rows } = await pool.query(`select metadata from public.audit_log where action='staff_members.insert' and entity_id=$1`, [sales]);
    expect(rows[0].metadata.safe).toEqual({ role_key: "sales", active: true });
  });
  it("é append-only, mesmo para SQL privilegiado", async () => {
    await expect(pool.query(`update public.audit_log set action='x'`)).rejects.toThrow(/append-only/);
    await expect(pool.query(`delete from public.audit_log`)).rejects.toThrow(/append-only/);
    await expect(pool.query(`truncate public.audit_log`)).rejects.toThrow(/append-only/);
  });
  it("visibilidade: audit.read vê tudo; admin da conta vê a sua; outros nada", async () => {
    const accounts = async (u: string) => (await asUser(pool, u, (q) => q(`select distinct account_id from public.audit_log where account_id is not null`))).rows.map((r) => r.account_id).sort();
    expect(await accounts(auditor)).toEqual([acme, beta].sort());
    expect(await accounts(bruno)).toEqual([acme]);
    expect(await accounts(eva)).toEqual([beta]);
    expect((await asUser(pool, diogo, (q) => q(`select * from public.audit_log`))).rowCount).toBe(0);
    expect((await asUser(pool, sales, (q) => q(`select * from public.audit_log`))).rowCount).toBe(0);
  });
  it("utilizadores não escrevem na auditoria; o servidor escreve eventos de aplicação", async () => {
    await expect(asUser(pool, eva, (q) => q(`insert into public.audit_log (action, entity_type) values ('fake','fake')`))).rejects.toThrow(/permission denied/);
    await expect(asUser(pool, eva, (q) => q(`select app_private.write_audit('a','b','c',null)`))).rejects.toThrow(/permission denied/);
    await asService(pool, (q) => q(`select app_private.write_audit('quote.sent','quote','q1',$1,'{"via":"email"}')`, [acme]));
    expect((await pool.query(`select 1 from public.audit_log where action='quote.sent' and account_id=$1`, [acme])).rowCount).toBe(1);
  });
});
