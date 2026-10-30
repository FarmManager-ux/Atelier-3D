import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { asUser, createStaff, createTestDatabase, createUser } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
let ana: string, bruno: string, carla: string, diogo: string, eva: string;
let sales: string, finance: string, production: string, admin: string;
let anaAcc: string, acme: string, beta: string;

const rpc = async (u: string, sql: string, params: unknown[] = []) =>
  (await asUser(pool, u, (q) => q(sql, params), { commit: true })).rows[0];

beforeAll(async () => {
  ({ pool, drop } = await createTestDatabase());
  [ana, bruno, carla, diogo, eva] = await Promise.all(["ana", "bruno", "carla", "diogo", "eva"].map((n) => createUser(pool, `${n}@example.test`)));
  sales = await createStaff(pool, "sales@example.test", "sales");
  finance = await createStaff(pool, "finance@example.test", "finance");
  production = await createStaff(pool, "production@example.test", "production");
  admin = await createStaff(pool, "admin@example.test", "admin");
  anaAcc = (await rpc(ana, `select public.create_customer_account('individual','Ana Silva') id`)).id;
  acme = (await rpc(bruno, `select public.create_customer_account('company','Acme, Lda') id`)).id;
  beta = (await rpc(eva, `select public.create_customer_account('company','Beta, SA') id`)).id;
  const invite = async (email: string, role: string) => (await rpc(bruno, `select public.invite_customer_member($1,$2,$3) t`, [acme, email, role])).t;
  await rpc(carla, `select public.accept_customer_invitation($1)`, [await invite("carla@example.test", "admin")]);
  await rpc(diogo, `select public.accept_customer_invitation($1)`, [await invite("diogo@example.test", "member")]);
  await asUser(pool, bruno, (q) => q(`insert into public.customer_billing_profiles (account_id, legal_name, tax_id, country) values ($1,'Acme, Lda','123456789','PT')`, [acme]), { commit: true });
  await asUser(pool, eva, (q) => q(`insert into public.customer_billing_profiles (account_id, legal_name, tax_id, country) values ($1,'Beta, SA','987654322','PT')`, [beta]), { commit: true });
});
afterAll(async () => { await drop?.(); });

const ids = async (u: string, table: string) => (await asUser(pool, u, (q) => q(`select * from public.${table}`))).rowCount;

describe("isolamento entre clientes", () => {
  it("cada cliente vê apenas as suas contas", async () => {
    const accs = async (u: string) => (await asUser(pool, u, (q) => q(`select id from public.customer_accounts`))).rows.map((r) => r.id).sort();
    expect(await accs(ana)).toEqual([anaAcc]);
    expect(await accs(eva)).toEqual([beta]);
    expect(await accs(bruno)).toEqual([acme]);
  });
  it("não vê faturação, membros, convites nem perfis de outros clientes", async () => {
    expect(await ids(ana, "customer_billing_profiles")).toBe(0);
    expect((await asUser(pool, eva, (q) => q(`select * from public.customer_billing_profiles where account_id=$1`, [acme]))).rowCount).toBe(0);
    expect((await asUser(pool, eva, (q) => q(`select * from public.customer_members where account_id=$1`, [acme]))).rowCount).toBe(0);
    expect((await asUser(pool, eva, (q) => q(`select * from public.customer_invitations where account_id=$1`, [acme]))).rowCount).toBe(0);
    expect((await asUser(pool, eva, (q) => q(`select id from public.profiles`))).rows.map((r) => r.id)).toEqual([eva]);
  });
  it("não edita nem cria dados noutras contas", async () => {
    expect((await asUser(pool, eva, (q) => q(`update public.customer_accounts set display_name='Hack' where id=$1`, [acme]))).rowCount).toBe(0);
    await expect(asUser(pool, eva, (q) => q(`insert into public.customer_billing_profiles (account_id, legal_name) values ($1,'x')`, [anaAcc]))).rejects.toThrow(/row-level security/);
    await expect(asUser(pool, eva, (q) => q(`select public.invite_customer_member($1,'x@example.test','member')`, [acme]))).rejects.toThrow(/Sem permissão/);
  });
  it("anónimos não acedem a nada", async () => {
    await expect(asUser(pool, null, (q) => q(`select * from public.customer_accounts`))).rejects.toThrow(/permission denied/);
    await expect(asUser(pool, null, (q) => q(`select public.create_customer_account('individual','x')`))).rejects.toThrow(/permission denied/);
  });
  it("não há inserção direta em contas nem em membros", async () => {
    await expect(asUser(pool, eva, (q) => q(`insert into public.customer_accounts (kind, display_name) values ('company','Fake')`))).rejects.toThrow(/permission denied/);
    await expect(asUser(pool, eva, (q) => q(`insert into public.customer_members (account_id, user_id, role) values ($1,$2,'owner')`, [acme, eva]))).rejects.toThrow(/permission denied/);
  });
});

describe("empresas com vários utilizadores", () => {
  it("colegas veem-se; membro não vê faturação; admin e owner veem", async () => {
    const m = await asUser(pool, diogo, (q) => q(`select user_id from public.customer_members where account_id=$1`, [acme]));
    expect(m.rows.map((x) => x.user_id).sort()).toEqual([bruno, carla, diogo].sort());
    const billing = async (u: string) => (await asUser(pool, u, (q) => q(`select * from public.customer_billing_profiles where account_id=$1`, [acme]))).rowCount;
    expect(await billing(diogo)).toBe(0);
    expect(await billing(carla)).toBe(1);
    expect(await billing(bruno)).toBe(1);
  });
  it("admin não promove a proprietário nem despromove o proprietário; gere membros normais", async () => {
    await expect(asUser(pool, carla, (q) => q(`update public.customer_members set role='owner' where account_id=$1 and user_id=$2`, [acme, diogo]))).rejects.toThrow(/row-level security/);
    expect((await asUser(pool, carla, (q) => q(`update public.customer_members set role='member' where account_id=$1 and user_id=$2`, [acme, bruno]))).rowCount).toBe(0);
    expect((await asUser(pool, carla, (q) => q(`update public.customer_members set role='admin' where account_id=$1 and user_id=$2`, [acme, diogo]))).rowCount).toBe(1);
  });
  it("membro simples não edita a conta nem convida", async () => {
    expect((await asUser(pool, diogo, (q) => q(`update public.customer_accounts set display_name='X' where id=$1`, [acme]))).rowCount).toBe(0);
    await expect(asUser(pool, diogo, (q) => q(`select public.invite_customer_member($1,'y@example.test','member')`, [acme]))).rejects.toThrow(/Sem permissão/);
  });
  it("admin só convida membros; owner também administradores; nunca owners", async () => {
    await expect(asUser(pool, carla, (q) => q(`select public.invite_customer_member($1,'z@example.test','admin')`, [acme]))).rejects.toThrow(/Apenas proprietários/);
    await expect(asUser(pool, bruno, (q) => q(`select public.invite_customer_member($1,'z@example.test','owner')`, [acme]))).rejects.toThrow(/proprietário/);
    expect((await asUser(pool, bruno, (q) => q(`select public.invite_customer_member($1,'z@example.test','admin') t`, [acme]))).rows[0].t).toMatch(/^[0-9a-f]{64}$/);
  });
  it("contas de particular: 1 utilizador, sem convites, 1 por pessoa", async () => {
    await expect(asUser(pool, ana, (q) => q(`select public.invite_customer_member($1,'w@example.test','member')`, [anaAcc]))).rejects.toThrow(/Só contas de empresa/);
    await expect(pool.query(`insert into public.customer_members (account_id, user_id) values ($1,$2)`, [anaAcc, eva])).rejects.toThrow(/só pode ter um utilizador/);
    await expect(asUser(pool, ana, (q) => q(`select public.create_customer_account('individual','Outra')`))).rejects.toThrow(/Já existe/);
  });
  it("o último proprietário não sai nem é despromovido; eliminar a conta em cascata funciona", async () => {
    await expect(asUser(pool, bruno, (q) => q(`delete from public.customer_members where account_id=$1 and user_id=$2`, [acme, bruno]))).rejects.toThrow(/pelo menos um proprietário/);
    await expect(asUser(pool, bruno, (q) => q(`update public.customer_members set role='admin' where account_id=$1 and user_id=$2`, [acme, bruno]))).rejects.toThrow(/pelo menos um proprietário/);
    const tmp = (await rpc(eva, `select public.create_customer_account('company','Temp') id`)).id;
    await pool.query(`delete from public.customer_accounts where id=$1`, [tmp]);
    expect((await pool.query(`select 1 from public.customer_members where account_id=$1`, [tmp])).rowCount).toBe(0);
  });
  it("tipo e criador da conta são imutáveis", async () => {
    await expect(pool.query(`update public.customer_accounts set kind='individual' where id=$1`, [acme])).rejects.toThrow(/não podem ser alterados/);
    await expect(asUser(pool, bruno, (q) => q(`update public.customer_accounts set kind='individual' where id=$1`, [acme]))).rejects.toThrow(/permission denied/);
  });
});

describe("convites", () => {
  it("token certo, email certo, uso único, hash na BD, expiram", async () => {
    const frank = await createUser(pool, "frank@example.test");
    const token = (await rpc(bruno, `select public.invite_customer_member($1,'frank@example.test','member') t`, [acme])).t;
    await expect(asUser(pool, eva, (q) => q(`select public.accept_customer_invitation($1)`, [token]))).rejects.toThrow(/Convite inválido/);
    await expect(asUser(pool, frank, (q) => q(`select public.accept_customer_invitation($1)`, ["x".repeat(64)]))).rejects.toThrow(/Convite inválido/);
    expect((await rpc(frank, `select public.accept_customer_invitation($1) a`, [token])).a).toBe(acme);
    await expect(asUser(pool, frank, (q) => q(`select public.accept_customer_invitation($1)`, [token]))).rejects.toThrow(/Convite inválido/);
    const gil = await createUser(pool, "gil@example.test");
    const t2 = (await rpc(bruno, `select public.invite_customer_member($1,'gil@example.test','member') t`, [acme])).t;
    await pool.query(`update public.customer_invitations set expires_at = now() - interval '1 minute' where email='gil@example.test'`);
    await expect(asUser(pool, gil, (q) => q(`select public.accept_customer_invitation($1)`, [t2]))).rejects.toThrow(/Convite inválido/);
    expect((await pool.query(`select token_hash from public.customer_invitations where email='gil@example.test'`)).rows[0].token_hash).not.toBe(t2);
  });
  it("membros sem permissão não veem convites", async () => {
    expect(await ids(diogo, "customer_invitations")).toBe(0);
  });
});

describe("faturação: validação e acesso da equipa", () => {
  const bill = (u: string, acc: string, nif: string, country = "PT", postal: string | null = null) =>
    asUser(pool, u, (q) => q(`insert into public.customer_billing_profiles (account_id, tax_id, country, postal_code) values ($1,$2,$3,$4)
                               on conflict (account_id) do update set tax_id=excluded.tax_id, country=excluded.country, postal_code=excluded.postal_code`, [acc, nif, country, postal]));
  it("NIF português com dígito de controlo e código postal PT validados na BD", async () => {
    await expect(bill(bruno, acme, "123456788")).rejects.toThrow(/billing_tax_id_valid/);
    await expect(bill(bruno, acme, "000000000")).rejects.toThrow(/billing_tax_id_valid/);
    await expect(bill(bruno, acme, "123456789", "PT", "4000")).rejects.toThrow(/billing_postal_pt/);
    await expect(bill(bruno, acme, "123456789", "PT", "4000-001")).resolves.toBeDefined();
    await expect(bill(bruno, acme, "DE123456789", "DE", "10115")).resolves.toBeDefined();
    await expect(bill(bruno, acme, "DE12 34", "DE")).rejects.toThrow(/billing_tax_id_valid/);
  });
  it("financeiro e administrador veem faturação; comercial e produção NÃO", async () => {
    expect(await ids(finance, "customer_billing_profiles")).toBe(2);
    expect(await ids(admin, "customer_billing_profiles")).toBe(2);
    expect(await ids(sales, "customer_billing_profiles")).toBe(0);
    expect(await ids(production, "customer_billing_profiles")).toBe(0);
  });
  it("só financeiro/admin escrevem faturação de clientes", async () => {
    expect((await asUser(pool, finance, (q) => q(`update public.customer_billing_profiles set city='Porto' where account_id=$1`, [acme]))).rowCount).toBe(1);
    expect((await asUser(pool, sales, (q) => q(`update public.customer_billing_profiles set city='X' where account_id=$1`, [acme]))).rowCount).toBe(0);
  });
  it("comercial e produção veem contas conforme permissões; estado só com customers.write", async () => {
    expect(await ids(sales, "customer_accounts")).toBe(3);
    expect(await ids(production, "customer_accounts")).toBe(0);
    expect((await asUser(pool, sales, (q) => q(`update public.customer_accounts set status='suspended' where id=$1`, [beta]))).rowCount).toBe(1);
    await expect(asUser(pool, eva, (q) => q(`update public.customer_accounts set status='suspended' where id=$1`, [beta]))).rejects.toThrow(/Sem permissão para alterar o estado/);
  });
});
