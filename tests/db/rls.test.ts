import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;

// Utilizadores
let ana: string; // particular
let bruno: string; // dono da empresa Acme
let carla: string; // admin Acme
let diogo: string; // membro Acme
let eva: string; // dona da empresa Beta (outro cliente)
let opId: string; // operador da equipa
let adminId: string; // admin da equipa

// Contas
let anaAcc: string;
let acme: string;
let beta: string;

beforeAll(async () => {
  ({ pool, drop } = await createTestDatabase());
  ana = await createUser(pool, "ana@example.test", "Ana");
  bruno = await createUser(pool, "bruno@example.test", "Bruno");
  carla = await createUser(pool, "carla@example.test");
  diogo = await createUser(pool, "diogo@example.test");
  eva = await createUser(pool, "eva@example.test");
  opId = await createUser(pool, "operador@example.test");
  adminId = await createUser(pool, "admin@example.test");
  await pool.query(
    `insert into public.staff_members (user_id, role) values ($1,'operator'), ($2,'admin')`,
    [opId, adminId],
  );

  anaAcc = (await asUser(pool, ana, (q) => q(`select public.create_account('individual','Ana Silva') id`), { commit: true })).rows[0].id;
  acme = (await asUser(pool, bruno, (q) => q(`select public.create_account('company','Acme, Lda') id`), { commit: true })).rows[0].id;
  beta = (await asUser(pool, eva, (q) => q(`select public.create_account('company','Beta, SA') id`), { commit: true })).rows[0].id;

  // Convites aceites: Carla (admin) e Diogo (membro) entram na Acme.
  const t1 = (await asUser(pool, bruno, (q) => q(`select public.invite_member($1,'carla@example.test','admin') t`, [acme]), { commit: true })).rows[0].t;
  await asUser(pool, carla, (q) => q(`select public.accept_invitation($1)`, [t1]), { commit: true });
  const t2 = (await asUser(pool, bruno, (q) => q(`select public.invite_member($1,'diogo@example.test','member') t`, [acme]), { commit: true })).rows[0].t;
  await asUser(pool, diogo, (q) => q(`select public.accept_invitation($1)`, [t2]), { commit: true });

  await asUser(pool, bruno, (q) => q(`insert into public.account_fiscal_data (account_id, legal_name, nif) values ($1,'Acme, Lda','123456789')`, [acme]), { commit: true });
  await asUser(pool, eva, (q) => q(`insert into public.account_fiscal_data (account_id, legal_name, nif) values ($1,'Beta, SA','987654321')`, [beta]), { commit: true });
});

afterAll(async () => {
  await drop?.();
});

describe("perfil automático", () => {
  it("cria o perfil quando o utilizador é criado", async () => {
    const { rows } = await pool.query(`select full_name from public.profiles where id = $1`, [ana]);
    expect(rows[0].full_name).toBe("Ana");
  });
});

describe("isolamento entre clientes", () => {
  it("cada cliente vê apenas as suas contas", async () => {
    const ids = async (u: string) =>
      (await asUser(pool, u, (q) => q(`select id from public.accounts`))).rows.map((r) => r.id).sort();
    expect(await ids(ana)).toEqual([anaAcc]);
    expect(await ids(eva)).toEqual([beta]);
    expect(await ids(bruno)).toEqual([acme]);
  });

  it("não vê dados fiscais de outro cliente", async () => {
    const r = await asUser(pool, ana, (q) => q(`select * from public.account_fiscal_data`));
    expect(r.rowCount).toBe(0);
    const r2 = await asUser(pool, eva, (q) => q(`select nif from public.account_fiscal_data where account_id = $1`, [acme]));
    expect(r2.rowCount).toBe(0);
  });

  it("não vê membros nem perfis de outras contas", async () => {
    const m = await asUser(pool, eva, (q) => q(`select * from public.account_members where account_id = $1`, [acme]));
    expect(m.rowCount).toBe(0);
    const p = await asUser(pool, eva, (q) => q(`select id from public.profiles`));
    expect(p.rows.map((r) => r.id)).toEqual([eva]);
  });

  it("não consegue editar contas de outros (0 linhas afetadas)", async () => {
    const r = await asUser(pool, eva, (q) => q(`update public.accounts set display_name = 'Hack' where id = $1`, [acme]));
    expect(r.rowCount).toBe(0);
  });

  it("não consegue inserir dados fiscais noutra conta", async () => {
    await expect(
      asUser(pool, eva, (q) => q(`insert into public.account_fiscal_data (account_id, nif) values ($1,'111111111')`, [anaAcc])),
    ).rejects.toThrow(/row-level security/);
  });

  it("não consegue convidar para uma conta onde não é admin", async () => {
    await expect(
      asUser(pool, eva, (q) => q(`select public.invite_member($1,'x@example.test','member')`, [acme])),
    ).rejects.toThrow(/Sem permissão/);
  });

  it("utilizadores anónimos não leem nada", async () => {
    await expect(asUser(pool, null, (q) => q(`select * from public.accounts`))).rejects.toThrow(/permission denied/);
    await expect(asUser(pool, null, (q) => q(`select public.create_account('individual','x')`))).rejects.toThrow(/permission denied/);
  });

  it("não se pode inserir diretamente em contas nem em membros", async () => {
    await expect(
      asUser(pool, eva, (q) => q(`insert into public.accounts (type, display_name) values ('company','Fake')`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(pool, eva, (q) => q(`insert into public.account_members (account_id, user_id, role) values ($1,$2,'owner')`, [acme, eva])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("empresas com vários utilizadores", () => {
  it("colegas veem-se mutuamente", async () => {
    const r = await asUser(pool, diogo, (q) => q(`select user_id from public.account_members where account_id = $1`, [acme]));
    expect(r.rows.map((x) => x.user_id).sort()).toEqual([bruno, carla, diogo].sort());
  });

  it("membro simples não vê dados fiscais, owner e admin vêem", async () => {
    const n = async (u: string) =>
      (await asUser(pool, u, (q) => q(`select * from public.account_fiscal_data where account_id = $1`, [acme]))).rowCount;
    expect(await n(diogo)).toBe(0);
    expect(await n(carla)).toBe(1);
    expect(await n(bruno)).toBe(1);
  });

  it("membro simples não edita a conta nem convida", async () => {
    const r = await asUser(pool, diogo, (q) => q(`update public.accounts set display_name = 'X' where id = $1`, [acme]));
    expect(r.rowCount).toBe(0);
    await expect(
      asUser(pool, diogo, (q) => q(`select public.invite_member($1,'y@example.test','member')`, [acme])),
    ).rejects.toThrow(/Sem permissão/);
  });

  it("admin não consegue tornar alguém proprietário", async () => {
    await expect(
      asUser(pool, carla, (q) => q(`update public.account_members set role = 'owner' where account_id = $1 and user_id = $2`, [acme, diogo])),
    ).rejects.toThrow(/row-level security/);
  });

  it("admin não consegue despromover o proprietário", async () => {
    const r = await asUser(pool, carla, (q) => q(`update public.account_members set role = 'member' where account_id = $1 and user_id = $2`, [acme, bruno]));
    expect(r.rowCount).toBe(0);
  });

  it("admin gere membros normais", async () => {
    const r = await asUser(pool, carla, (q) => q(`update public.account_members set role = 'admin' where account_id = $1 and user_id = $2`, [acme, diogo]));
    expect(r.rowCount).toBe(1);
  });

  it("admin não convida administradores; owner sim", async () => {
    await expect(
      asUser(pool, carla, (q) => q(`select public.invite_member($1,'z@example.test','admin')`, [acme])),
    ).rejects.toThrow(/Apenas proprietários/);
    const t = await asUser(pool, bruno, (q) => q(`select public.invite_member($1,'z@example.test','admin') t`, [acme]));
    expect(t.rows[0].t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("conta de particular não aceita convites nem segundo utilizador", async () => {
    await expect(
      asUser(pool, ana, (q) => q(`select public.invite_member($1,'w@example.test','member')`, [anaAcc])),
    ).rejects.toThrow(/Só contas de empresa/);
    await expect(
      pool.query(`insert into public.account_members (account_id, user_id) values ($1,$2)`, [anaAcc, eva]),
    ).rejects.toThrow(/só pode ter um utilizador/);
  });

  it("não se cria uma segunda conta de particular", async () => {
    await expect(
      asUser(pool, ana, (q) => q(`select public.create_account('individual','Outra')`)),
    ).rejects.toThrow(/Já existe/);
  });

  it("o último proprietário não pode sair nem ser despromovido", async () => {
    await expect(
      asUser(pool, bruno, (q) => q(`delete from public.account_members where account_id = $1 and user_id = $2`, [acme, bruno])),
    ).rejects.toThrow(/pelo menos um proprietário/);
    await expect(
      asUser(pool, bruno, (q) => q(`update public.account_members set role = 'admin' where account_id = $1 and user_id = $2`, [acme, bruno])),
    ).rejects.toThrow(/pelo menos um proprietário/);
  });

  it("eliminar uma conta em cascata não é bloqueado pela regra do último proprietário", async () => {
    const tmp = (await asUser(pool, eva, (q) => q(`select public.create_account('company','Temp') id`), { commit: true })).rows[0].id;
    await pool.query(`delete from public.accounts where id = $1`, [tmp]);
    const r = await pool.query(`select 1 from public.account_members where account_id = $1`, [tmp]);
    expect(r.rowCount).toBe(0);
  });
});

describe("convites", () => {
  it("só o token certo, pelo email certo, uma única vez", async () => {
    const frank = await createUser(pool, "frank@example.test");
    const token = (await asUser(pool, bruno, (q) => q(`select public.invite_member($1,'frank@example.test','member') t`, [acme]), { commit: true })).rows[0].t;
    // utilizador errado
    await expect(asUser(pool, eva, (q) => q(`select public.accept_invitation($1)`, [token]))).rejects.toThrow(/Convite inválido/);
    // token errado
    await expect(asUser(pool, frank, (q) => q(`select public.accept_invitation($1)`, ["x".repeat(64)]))).rejects.toThrow(/Convite inválido/);
    // certo
    const ok = await asUser(pool, frank, (q) => q(`select public.accept_invitation($1) a`, [token]), { commit: true });
    expect(ok.rows[0].a).toBe(acme);
    // reutilização
    await expect(asUser(pool, frank, (q) => q(`select public.accept_invitation($1)`, [token]))).rejects.toThrow(/Convite inválido/);
  });

  it("convites expirados são recusados e o token não fica em claro na BD", async () => {
    const gil = await createUser(pool, "gil@example.test");
    const token = (await asUser(pool, bruno, (q) => q(`select public.invite_member($1,'gil@example.test','member') t`, [acme]), { commit: true })).rows[0].t;
    await pool.query(`update public.account_invitations set expires_at = now() - interval '1 minute' where email = 'gil@example.test'`);
    await expect(asUser(pool, gil, (q) => q(`select public.accept_invitation($1)`, [token]))).rejects.toThrow(/Convite inválido/);
    const stored = await pool.query(`select token_hash from public.account_invitations where email = 'gil@example.test'`);
    expect(stored.rows[0].token_hash).not.toBe(token);
  });

  it("utilizadores sem permissão não veem convites", async () => {
    const r = await asUser(pool, diogo, (q) => q(`select * from public.account_invitations`));
    expect(r.rowCount).toBe(0);
    const r2 = await asUser(pool, eva, (q) => q(`select * from public.account_invitations where account_id = $1`, [acme]));
    expect(r2.rowCount).toBe(0);
  });
});

describe("equipa interna", () => {
  it("operador vê contas e membros mas NÃO dados fiscais", async () => {
    const accs = await asUser(pool, opId, (q) => q(`select id from public.accounts`));
    expect(accs.rowCount).toBeGreaterThanOrEqual(3);
    const fiscal = await asUser(pool, opId, (q) => q(`select * from public.account_fiscal_data`));
    expect(fiscal.rowCount).toBe(0);
  });

  it("admin da equipa vê dados fiscais e auditoria globais", async () => {
    const fiscal = await asUser(pool, adminId, (q) => q(`select * from public.account_fiscal_data`));
    expect(fiscal.rowCount).toBe(2);
    const audit = await asUser(pool, adminId, (q) => q(`select * from public.audit_log`));
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  it("clientes não se podem promover a equipa", async () => {
    await expect(
      asUser(pool, eva, (q) => q(`insert into public.staff_members (user_id, role) values ($1,'admin')`, [eva])),
    ).rejects.toThrow(/permission denied/);
    const r = await asUser(pool, eva, (q) => q(`select * from public.staff_members`));
    expect(r.rowCount).toBe(0);
  });
});

describe("auditoria", () => {
  it("regista criação de contas, membros e alteração fiscal sem guardar valores", async () => {
    await asUser(pool, bruno, (q) => q(`update public.account_fiscal_data set nif = '555555555' where account_id = $1`, [acme]), { commit: true });
    const { rows } = await pool.query(
      `select action, metadata from public.audit_log where account_id = $1 order by id`, [acme]);
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("accounts.insert");
    expect(actions).toContain("account_members.insert");
    expect(actions).toContain("account_fiscal_data.update");
    expect(JSON.stringify(rows)).not.toContain("555555555");
    expect(JSON.stringify(rows)).not.toContain("123456789");
    const upd = rows.find((r) => r.action === "account_fiscal_data.update");
    expect(upd.metadata.changed).toEqual(["nif"]);
  });

  it("é append-only, mesmo para utilizadores privilegiados", async () => {
    await expect(pool.query(`update public.audit_log set action = 'x'`)).rejects.toThrow(/append-only/);
    await expect(pool.query(`delete from public.audit_log`)).rejects.toThrow(/append-only/);
    await expect(pool.query(`truncate public.audit_log`)).rejects.toThrow(/append-only/);
  });

  it("clientes veem a auditoria da sua conta só se forem admin; nunca a de outros", async () => {
    const a = await asUser(pool, bruno, (q) => q(`select distinct account_id from public.audit_log`));
    expect(a.rows.map((r) => r.account_id)).toEqual([acme]);
    const b = await asUser(pool, ana, (q) => q(`select distinct account_id from public.audit_log`));
    expect(b.rows.map((r) => r.account_id)).toEqual([anaAcc]);
    const c = await asUser(pool, diogo, (q) => q(`select * from public.audit_log`));
    expect(c.rowCount).toBe(0);
  });

  it("o utilizador não pode escrever na auditoria", async () => {
    await expect(
      asUser(pool, eva, (q) => q(`insert into public.audit_log (action, entity_type) values ('fake','fake')`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(pool, eva, (q) => q(`select app_private.write_audit('a','b','c',null)`)),
    ).rejects.toThrow(/permission denied/);
  });
});
