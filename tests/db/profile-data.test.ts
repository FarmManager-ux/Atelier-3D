import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
let ana: string, bruno: string, carla: string, diogo: string, eva: string, op: string, staffAdmin: string;
let acme: string;

const rpc = async (u: string, sql: string, params: unknown[] = []) =>
  (await asUser(pool, u, (q) => q(sql, params), { commit: true })).rows[0];

beforeAll(async () => {
  ({ pool, drop } = await createTestDatabase());
  [ana, bruno, carla, diogo, eva, op, staffAdmin] = await Promise.all(
    ["ana", "bruno", "carla", "diogo", "eva", "op", "sadmin"].map((n) => createUser(pool, `${n}@example.test`)),
  );
  await pool.query(`insert into public.staff_members (user_id, role) values ($1,'operator'),($2,'admin')`, [op, staffAdmin]);
  await rpc(ana, `select public.create_account('individual','Ana') id`);
  acme = (await rpc(bruno, `select public.create_account('company','Acme') id`)).id;
  await rpc(eva, `select public.create_account('company','Beta') id`);
  const ti = async (email: string, role: string) =>
    (await rpc(bruno, `select public.invite_member($1,$2,$3) t`, [acme, email, role])).t;
  await rpc(carla, `select public.accept_invitation($1)`, [await ti("carla@example.test", "admin")]);
  await rpc(diogo, `select public.accept_invitation($1)`, [await ti("diogo@example.test", "member")]);
});
afterAll(async () => { await drop?.(); });

describe("dados fiscais e comerciais", () => {
  const fiscal = (u: string, acc: string, nif: string, country = "PT") =>
    asUser(pool, u, (q) => q(`insert into public.account_fiscal_data (account_id, nif, country) values ($1,$2,$3)`, [acc, nif, country]));

  it("rejeita NIF português com dígito de controlo errado", async () => {
    await expect(fiscal(bruno, acme, "123456788")).rejects.toThrow(/account_fiscal_nif_valid/);
    await expect(fiscal(bruno, acme, "000000000")).rejects.toThrow(/account_fiscal_nif_valid/);
  });
  it("aceita NIF português válido e identificadores estrangeiros simples", async () => {
    await expect(fiscal(bruno, acme, "123456789")).resolves.toBeDefined();
    await expect(fiscal(bruno, acme, "DE123456789", "DE")).resolves.toBeDefined();
    await expect(fiscal(bruno, acme, "DE12 34", "DE")).rejects.toThrow(/account_fiscal_nif_valid/);
  });
  it("admin edita dados comerciais; membro não", async () => {
    const ok = await asUser(pool, carla, (q) => q(`update public.accounts set phone='+351 910 000 000', website='https://acme.example', billing_email='fatura@acme.example', activity='Prototipagem' where id=$1`, [acme]));
    expect(ok.rowCount).toBe(1);
    const no = await asUser(pool, diogo, (q) => q(`update public.accounts set phone='1' where id=$1`, [acme]));
    expect(no.rowCount).toBe(0);
  });
  it("valida o site (só http/https) e não permite alterar campos protegidos", async () => {
    await expect(asUser(pool, bruno, (q) => q(`update public.accounts set website='javascript:alert(1)' where id=$1`, [acme]))).rejects.toThrow(/website/);
    await expect(asUser(pool, bruno, (q) => q(`update public.accounts set type='individual' where id=$1`, [acme]))).rejects.toThrow(/permission denied/);
  });
});

describe("contactos", () => {
  it("admin cria; membro lê mas não escreve; outro cliente não vê", async () => {
    await asUser(pool, carla, (q) => q(`insert into public.account_contacts (account_id,name,email,is_primary) values ($1,'Compras','compras@acme.example',true)`, [acme]), { commit: true });
    expect((await asUser(pool, diogo, (q) => q(`select * from public.account_contacts`))).rowCount).toBe(1);
    await expect(asUser(pool, diogo, (q) => q(`insert into public.account_contacts (account_id,name,email) values ($1,'X','x@x.pt')`, [acme]))).rejects.toThrow(/row-level security/);
    expect((await asUser(pool, eva, (q) => q(`select * from public.account_contacts`))).rowCount).toBe(0);
    await expect(asUser(pool, eva, (q) => q(`insert into public.account_contacts (account_id,name,email) values ($1,'X','x@x.pt')`, [acme]))).rejects.toThrow(/row-level security/);
    expect((await asUser(pool, eva, (q) => q(`delete from public.account_contacts where account_id=$1`, [acme]))).rowCount).toBe(0);
  });
  it("exige email ou telefone e um só contacto principal", async () => {
    await expect(asUser(pool, bruno, (q) => q(`insert into public.account_contacts (account_id,name) values ($1,'Sem meios')`, [acme]))).rejects.toThrow(/check/);
    await expect(asUser(pool, bruno, (q) => q(`insert into public.account_contacts (account_id,name,email,is_primary) values ($1,'Outro','o@acme.example',true)`, [acme]))).rejects.toThrow(/one_primary/);
  });
  it("a equipa lê contactos", async () => {
    expect((await asUser(pool, op, (q) => q(`select * from public.account_contacts`))).rowCount).toBeGreaterThan(0);
  });
});

describe("moradas", () => {
  const addr = (u: string, acc: string, extra = "") =>
    asUser(pool, u, (q) => q(`insert into public.account_addresses (account_id,kind,recipient_name,line1,postal_code,city ${extra ? ",is_default" : ""}) values ($1,'shipping','Acme','Rua A 1','4000-001','Porto' ${extra ? ",true" : ""})`, [acc]), { commit: true });

  it("valida o código postal português", async () => {
    await expect(asUser(pool, bruno, (q) => q(`insert into public.account_addresses (account_id,recipient_name,line1,postal_code,city) values ($1,'A','R','4000','Porto')`, [acme]))).rejects.toThrow(/check/);
    await expect(asUser(pool, bruno, (q) => q(`insert into public.account_addresses (account_id,recipient_name,line1,postal_code,city,country) values ($1,'A','R','75001','Paris','FR')`, [acme]), { commit: true })).resolves.toBeDefined();
  });
  it("só uma morada predefinida por tipo", async () => {
    await addr(bruno, acme, "default");
    await expect(addr(bruno, acme, "default")).rejects.toThrow(/one_default/);
  });
  it("isolamento e permissões", async () => {
    expect((await asUser(pool, eva, (q) => q(`select * from public.account_addresses`))).rowCount).toBe(0);
    expect((await asUser(pool, diogo, (q) => q(`select * from public.account_addresses`))).rowCount).toBeGreaterThan(0);
    await expect(addr(diogo, acme)).rejects.toThrow(/row-level security/);
    await expect(addr(eva, acme)).rejects.toThrow(/row-level security/);
    expect((await asUser(pool, eva, (q) => q(`update public.account_addresses set city='X' where account_id=$1`, [acme]))).rowCount).toBe(0);
  });
  it("alterações a moradas ficam na auditoria sem guardar a morada", async () => {
    const { rows } = await pool.query(`select action, metadata::text m from public.audit_log where entity_type='account_addresses'`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.m).join()).not.toContain("Rua A 1");
  });
});

