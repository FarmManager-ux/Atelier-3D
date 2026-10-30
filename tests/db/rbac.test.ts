import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { ALL_PERMISSIONS, PERMISSIONS, ROLES, STAFF_ROLES, roleHas } from "../../src/modules/identity";
import { asUser, createStaff, createTestDatabase, createUser } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
const staff: Record<string, string> = {};
let customer: string;

beforeAll(async () => {
  ({ pool, drop } = await createTestDatabase());
  for (const r of STAFF_ROLES) staff[r] = await createStaff(pool, `${r}@example.test`, r);
  customer = await createUser(pool, "cliente@example.test");
});
afterAll(async () => { await drop?.(); });

const can = async (uid: string, perm: string) =>
  (await asUser(pool, uid, (q) => q(`select app_private.has_permission($1) ok`, [perm]))).rows[0].ok as boolean;

describe("paridade TypeScript ↔ base de dados", () => {
  it("o catálogo de permissões é idêntico", async () => {
    const { rows } = await pool.query(`select key, description from public.permissions order by key`);
    expect(Object.fromEntries(rows.map((r) => [r.key, r.description]))).toEqual(PERMISSIONS);
  });
  it("as funções e a matriz função → permissões são idênticas", async () => {
    const roles = await pool.query(`select key, label from public.staff_roles order by key`);
    expect(Object.fromEntries(roles.rows.map((r) => [r.key, r.label]))).toEqual(
      Object.fromEntries(STAFF_ROLES.map((r) => [r, ROLES[r].label])));
    const rp = await pool.query(`select role_key, permission_key from public.role_permissions`);
    const db: Record<string, string[]> = {};
    for (const r of rp.rows) (db[r.role_key] ??= []).push(r.permission_key);
    for (const r of STAFF_ROLES) expect((db[r] ?? []).sort(), r).toEqual([...ROLES[r].permissions].sort());
  });
});

describe("has_permission() por função", () => {
  it.each(STAFF_ROLES)("%s: permissões na BD = matriz TypeScript (todas as %i chaves)", async (role) => {
    for (const p of ALL_PERMISSIONS) expect(await can(staff[role]!, p), `${role} ${p}`).toBe(roleHas(role, p));
  });
  it("um cliente (sem função de equipa) não tem nenhuma permissão", async () => {
    for (const p of ALL_PERMISSIONS) expect(await can(customer, p), p).toBe(false);
  });
  it("equipa inativa perde todas as permissões", async () => {
    const id = await createStaff(pool, "inativo@example.test", "manager");
    expect(await can(id, "crm.read")).toBe(true);
    await pool.query(`update public.staff_members set active = false where user_id = $1`, [id]);
    expect(await can(id, "crm.read")).toBe(false);
  });
  it("um administrador futuro mantém acesso a permissões novas (admin = todas)", async () => {
    await pool.query(`insert into public.permissions (key, description) values ('labs.use', 'Permissão futura de teste')`);
    expect(await can(staff.admin!, "labs.use")).toBe(true);
    expect(await can(staff.manager!, "labs.use")).toBe(false);
  });
});

describe("gestão da equipa", () => {
  it("só quem tem staff.manage gere membros e funções", async () => {
    const target = await createUser(pool, "novo@example.test");
    for (const r of STAFF_ROLES.filter((r) => r !== "admin")) {
      await expect(asUser(pool, staff[r]!, (q) => q(`insert into public.staff_members (user_id, role_key) values ($1,'sales')`, [target]))).rejects.toThrow(/row-level security/);
    }
    await asUser(pool, staff.admin!, (q) => q(`insert into public.staff_members (user_id, role_key) values ($1,'sales')`, [target]), { commit: true });
  });
  it("clientes não se podem promover nem ver a equipa", async () => {
    await expect(asUser(pool, customer, (q) => q(`insert into public.staff_members (user_id, role_key) values ($1,'admin')`, [customer]))).rejects.toThrow(/permission denied|row-level security/);
    expect((await asUser(pool, customer, (q) => q(`select * from public.staff_members`))).rowCount).toBe(0);
    expect((await asUser(pool, customer, (q) => q(`select * from public.role_permissions`))).rowCount).toBe(0);
    expect((await asUser(pool, customer, (q) => q(`select * from public.permissions`))).rowCount).toBe(0);
  });
  it("cada membro vê só a sua própria linha de equipa", async () => {
    const r = await asUser(pool, staff.sales!, (q) => q(`select user_id from public.staff_members`));
    expect(r.rows.map((x) => x.user_id)).toEqual([staff.sales]);
  });
  it("um membro não consegue alterar a sua própria função", async () => {
    const r = await asUser(pool, staff.sales!, (q) => q(`update public.staff_members set role_key='admin' where user_id=$1`, [staff.sales]));
    expect(r.rowCount).toBe(0);
  });
  it("a plataforma nunca fica sem administrador ativo", async () => {
    await expect(pool.query(`update public.staff_members set active=false where user_id=$1`, [staff.admin])).rejects.toThrow(/pelo menos um administrador/);
    await expect(pool.query(`delete from public.staff_members where user_id=$1`, [staff.admin])).rejects.toThrow(/pelo menos um administrador/);
    await expect(pool.query(`update public.staff_members set role_key='sales' where user_id=$1`, [staff.admin])).rejects.toThrow(/pelo menos um administrador/);
  });
  it("funções do sistema não se apagam nem se alteram; funções personalizadas sim (admin)", async () => {
    await expect(asUser(pool, staff.admin!, (q) => q(`delete from public.staff_roles where key='sales'`))).resolves.toMatchObject({ rowCount: 0 });
    await expect(pool.query(`delete from public.staff_roles where key='sales'`)).rejects.toThrow(/funções do sistema/);
    await expect(pool.query(`update public.staff_roles set key='vendas' where key='sales'`)).rejects.toThrow(/funções do sistema/);
    await asUser(pool, staff.admin!, async (q) => {
      await q(`insert into public.staff_roles (key, label) values ('qualidade','Controlo de qualidade')`);
      await q(`insert into public.role_permissions (role_key, permission_key) values ('qualidade','production.read')`);
    }, { commit: true });
    const qa = await createStaff(pool, "qa@example.test", "qualidade");
    expect(await can(qa, "production.read")).toBe(true);
    expect(await can(qa, "finance.read")).toBe(false);
  });
  it("não se acrescentam permissões a funções do sistema por SQL de cliente", async () => {
    await expect(asUser(pool, staff.admin!, (q) => q(`insert into public.role_permissions (role_key, permission_key) values ('sales','finance.read')`))).rejects.toThrow(/row-level security/);
  });
});
