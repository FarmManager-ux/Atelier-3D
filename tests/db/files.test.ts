import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { asService, asUser, createTestDatabase, createUser } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
let bruno: string, carla: string, diogo: string, eva: string, op: string, sadmin: string, ana: string;
let acme: string, beta: string;

const H = "a".repeat(64);
const H2 = "b".repeat(64);
const rpc = async (u: string, sql: string, params: unknown[] = []) =>
  (await asUser(pool, u, (q) => q(sql, params), { commit: true })).rows[0];

type Up = { file_id: string; version_id: string; storage_path: string; version_number: number };
const begin = (u: string, acc: string, o: { project?: string | null; file?: string | null; name?: string; filename?: string; size?: number; sha?: string } = {}) =>
  asUser(pool, u, (q) => q(
    `select * from public.begin_file_upload($1,$2,$3,$4,$5,$6,$7)`,
    [acc, o.project ?? null, o.file ?? null, o.name ?? "Suporte", o.filename ?? "suporte.stl", o.size ?? 1000, o.sha ?? H],
  ), { commit: true }).then((r) => r.rows[0] as Up);
const complete = (v: string, size = 1000, sha = H) =>
  asService(pool, (q) => q(`select public.complete_file_upload($1,$2,$3) s`, [v, size, sha])).then((r) => r.rows[0].s);
/** Cria um ficheiro com uma versão disponível. */
async function available(u: string, acc: string, o: Parameters<typeof begin>[2] = {}) {
  const up = await begin(u, acc, o);
  expect(await complete(up.version_id, o.size ?? 1000, o.sha ?? H)).toBe("available");
  return up;
}

beforeAll(async () => {
  ({ pool, drop } = await createTestDatabase());
  [bruno, carla, diogo, eva, op, sadmin, ana] = await Promise.all(
    ["bruno", "carla", "diogo", "eva", "op", "sadmin", "ana"].map((n) => createUser(pool, `${n}@example.test`)),
  );
  await pool.query(`insert into public.staff_members (user_id, role) values ($1,'operator'),($2,'admin')`, [op, sadmin]);
  acme = (await rpc(bruno, `select public.create_account('company','Acme') id`)).id;
  beta = (await rpc(eva, `select public.create_account('company','Beta') id`)).id;
  await rpc(ana, `select public.create_account('individual','Ana') id`);
  const ti = async (email: string, role: string) => (await rpc(bruno, `select public.invite_member($1,$2,$3) t`, [acme, email, role])).t;
  await rpc(carla, `select public.accept_invitation($1)`, [await ti("carla@example.test", "admin")]);
  await rpc(diogo, `select public.accept_invitation($1)`, [await ti("diogo@example.test", "member")]);
});
afterAll(async () => { await drop?.(); });

describe("projetos", () => {
  it("qualquer membro cria projetos; created_by tem de ser o próprio", async () => {
    const r = await asUser(pool, diogo, (q) => q(`insert into public.projects (account_id,name,created_by) values ($1,'Protótipo',$2) returning id`, [acme, diogo]), { commit: true });
    expect(r.rowCount).toBe(1);
    await expect(asUser(pool, diogo, (q) => q(`insert into public.projects (account_id,name,created_by) values ($1,'X',$2)`, [acme, bruno]))).rejects.toThrow(/row-level security/);
  });
  it("outro cliente não vê, não cria nem edita projetos", async () => {
    expect((await asUser(pool, eva, (q) => q(`select * from public.projects where account_id=$1`, [acme]))).rowCount).toBe(0);
    await expect(asUser(pool, eva, (q) => q(`insert into public.projects (account_id,name,created_by) values ($1,'X',$2)`, [acme, eva]))).rejects.toThrow(/row-level security/);
    expect((await asUser(pool, eva, (q) => q(`update public.projects set name='Hack' where account_id=$1`, [acme]))).rowCount).toBe(0);
  });
  it("não há eliminação de projetos pelos clientes", async () => {
    await expect(asUser(pool, bruno, (q) => q(`delete from public.projects`))).rejects.toThrow(/permission denied/);
  });
});

describe("início de upload (begin_file_upload)", () => {
  it("cria o ficheiro e a versão 1 pendente com caminho derivado de IDs", async () => {
    const up = await begin(diogo, acme, { filename: "Suporte Final.STL" });
    expect(up.version_number).toBe(1);
    expect(up.storage_path).toBe(`${acme}/${up.file_id}/${up.version_id}`);
    const { rows } = await pool.query(`select status, extension, original_filename from public.file_versions where id=$1`, [up.version_id]);
    expect(rows[0]).toMatchObject({ status: "pending", extension: "stl", original_filename: "Suporte Final.STL" });
  });
  it("rejeita formatos não suportados, sem extensão e tamanhos inválidos", async () => {
    await expect(begin(bruno, acme, { filename: "virus.exe" })).rejects.toThrow(/Formato de ficheiro não suportado/);
    await expect(begin(bruno, acme, { filename: "semextensao" })).rejects.toThrow(/extensão/);
    await expect(begin(bruno, acme, { size: 0 })).rejects.toThrow(/Tamanho/);
    await expect(begin(bruno, acme, { size: 104857601 })).rejects.toThrow(/Tamanho/);
    await expect(begin(bruno, acme, { filename: "foto.png", size: 15728641 })).rejects.toThrow(/Tamanho/);
    await expect(begin(bruno, acme, { sha: "xyz" })).rejects.toThrow(/declared_sha256/);
  });
  it("limite diferente para imagens e modelos", async () => {
    await expect(begin(bruno, acme, { filename: "foto.jpg", size: 15728640 })).resolves.toBeDefined();
    await expect(begin(bruno, acme, { filename: "peca.step", size: 104857600 })).resolves.toBeDefined();
  });
  it("nomes de ficheiro com separadores de caminho são recusados", async () => {
    await expect(begin(bruno, acme, { filename: "../../x.stl" })).rejects.toThrow(/original_filename/);
    await expect(begin(bruno, acme, { filename: "a\\b.stl" })).rejects.toThrow(/original_filename/);
  });
  it("não-membros não carregam ficheiros em contas alheias", async () => {
    await expect(begin(eva, acme)).rejects.toThrow(/Sem permissão/);
    await expect(asUser(pool, null, (q) => q(`select * from public.begin_file_upload($1,null,null,'x','a.stl',1,$2)`, [acme, H]))).rejects.toThrow(/permission denied/);
  });
  it("não aceita projeto de outra conta", async () => {
    const p = (await asUser(pool, eva, (q) => q(`insert into public.projects (account_id,name,created_by) values ($1,'Beta P',$2) returning id`, [beta, eva]), { commit: true })).rows[0].id;
    await expect(begin(bruno, acme, { project: p })).rejects.toThrow(/Projeto inválido/);
  });
  it("associa ao projeto da própria conta; mover para projeto alheio é impossível", async () => {
    const p = (await asUser(pool, bruno, (q) => q(`insert into public.projects (account_id,name,created_by) values ($1,'P1',$2) returning id`, [acme, bruno]), { commit: true })).rows[0].id;
    const up = await begin(bruno, acme, { project: p });
    const { rows } = await pool.query(`select project_id from public.files where id=$1`, [up.file_id]);
    expect(rows[0].project_id).toBe(p);
    const other = (await pool.query(`select id from public.projects where account_id=$1`, [beta])).rows[0].id;
    await expect(asUser(pool, bruno, (q) => q(`update public.files set project_id=$1 where id=$2`, [other, up.file_id]))).rejects.toThrow(/foreign key/);
  });
  it("limita uploads pendentes por utilizador", async () => {
    const u = await createUser(pool, "spam@example.test");
    const acc = (await rpc(u, `select public.create_account('individual','Spam') id`)).id;
    for (let i = 0; i < 20; i++) await begin(u, acc);
    await expect(begin(u, acc)).rejects.toThrow(/Demasiados/);
  });
});

describe("conclusão do upload (só servidor)", () => {
  it("clientes não podem marcar uma versão como disponível", async () => {
    const up = await begin(bruno, acme);
    await expect(asUser(pool, bruno, (q) => q(`select public.complete_file_upload($1,1000,$2)`, [up.version_id, H]))).rejects.toThrow(/permission denied/);
    await expect(asUser(pool, bruno, (q) => q(`update public.file_versions set status='available' where id=$1`, [up.version_id]))).rejects.toThrow(/permission denied/);
    await expect(asUser(pool, bruno, (q) => q(`select public.reject_file_upload($1,'x')`, [up.version_id]))).rejects.toThrow(/permission denied/);
  });
  it("tamanho ou hash diferentes → rejeitado", async () => {
    const a = await begin(bruno, acme);
    expect(await complete(a.version_id, 999)).toBe("rejected");
    const b = await begin(bruno, acme);
    expect(await complete(b.version_id, 1000, H2)).toBe("rejected");
    const { rows } = await pool.query(`select status, sha256 from public.file_versions where id=$1`, [b.version_id]);
    expect(rows[0]).toEqual({ status: "rejected", sha256: null });
  });
  it("correto → disponível com hash verificado; não se conclui duas vezes", async () => {
    const up = await begin(bruno, acme);
    expect(await complete(up.version_id)).toBe("available");
    const { rows } = await pool.query(`select status, sha256, available_at from public.file_versions where id=$1`, [up.version_id]);
    expect(rows[0].sha256).toBe(H);
    expect(rows[0].available_at).not.toBeNull();
    await expect(complete(up.version_id)).rejects.toThrow(/já concluída/);
  });
});

describe("versões imutáveis", () => {
  it("nova versão incrementa o número e NÃO altera a versão aprovada", async () => {
    const v1 = await available(carla, acme);
    await asUser(pool, carla, (q) => q(`select public.approve_file_version($1)`, [v1.version_id]), { commit: true });
    const v2 = await available(diogo, acme, { file: v1.file_id, filename: "suporte_v2.stl", sha: H2 });
    expect(v2.version_number).toBe(2);
    expect(v2.file_id).toBe(v1.file_id);
    const f = (await pool.query(`select approved_version_id from public.files where id=$1`, [v1.file_id])).rows[0];
    expect(f.approved_version_id).toBe(v1.version_id);
    // aprovação explícita da v2 só por admin/owner
    await expect(asUser(pool, diogo, (q) => q(`select public.approve_file_version($1)`, [v2.version_id]))).rejects.toThrow(/Sem permissão/);
    await asUser(pool, bruno, (q) => q(`select public.approve_file_version($1)`, [v2.version_id]), { commit: true });
    expect((await pool.query(`select approved_version_id from public.files where id=$1`, [v1.file_id])).rows[0].approved_version_id).toBe(v2.version_id);
  });
  it("não se aprova versão pendente, rejeitada ou de outra conta", async () => {
    const p = await begin(carla, acme);
    await expect(asUser(pool, carla, (q) => q(`select public.approve_file_version($1)`, [p.version_id]))).rejects.toThrow(/Só versões disponíveis/);
    const other = await available(eva, beta);
    await expect(asUser(pool, bruno, (q) => q(`select public.approve_file_version($1)`, [other.version_id]))).rejects.toThrow(/Sem permissão/);
  });
  it("a versão aprovada tem de ser disponível e do próprio ficheiro (mesmo por SQL privilegiado)", async () => {
    const a = await available(bruno, acme);
    const b = await available(bruno, acme);
    await expect(pool.query(`update public.files set approved_version_id=$1 where id=$2`, [b.version_id, a.file_id])).rejects.toThrow(/versão aprovada/);
  });
  it("nenhum campo de uma versão muda depois de criada (nem para superutilizadores)", async () => {
    const up = await available(bruno, acme);
    for (const set of [`size_bytes=1`, `sha256='${H2}'`, `storage_path='x'`, `original_filename='y.stl'`, `status='pending'`, `status='rejected'`, `version_number=9`]) {
      await expect(pool.query(`update public.file_versions set ${set} where id=$1`, [up.version_id]), set).rejects.toThrow(/imutáveis/);
    }
  });
  it("versões disponíveis não se apagam, exceto na rotina RGPD explícita", async () => {
    const up = await available(bruno, acme);
    await expect(pool.query(`delete from public.file_versions where id=$1`, [up.version_id])).rejects.toThrow(/imutáveis/);
    await expect(pool.query(`delete from public.files where id=$1`, [up.file_id])).rejects.toThrow(/imutáveis/);
    await expect(asUser(pool, bruno, (q) => q(`delete from public.file_versions`))).rejects.toThrow(/permission denied/);
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local app.allow_erasure = 'on'");
      await c.query(`update public.files set approved_version_id = null where id=$1`, [up.file_id]);
      await c.query(`delete from public.files where id=$1`, [up.file_id]);
      await c.query("commit");
    } finally { c.release(); }
    expect((await pool.query(`select 1 from public.file_versions where id=$1`, [up.version_id])).rowCount).toBe(0);
  });
  it("nova versão tem de ser do mesmo tipo (modelo vs imagem)", async () => {
    const m = await available(bruno, acme);
    await expect(begin(bruno, acme, { file: m.file_id, filename: "foto.png" })).rejects.toThrow(/mesmo tipo/);
  });
  it("não aceita novas versões em ficheiros arquivados", async () => {
    const m = await available(carla, acme);
    await asUser(pool, carla, (q) => q(`select public.set_file_archived($1,true)`, [m.file_id]), { commit: true });
    await expect(begin(carla, acme, { file: m.file_id })).rejects.toThrow(/arquivado/);
  });
  it("só admin/owner arquivam", async () => {
    const m = await available(diogo, acme);
    await expect(asUser(pool, diogo, (q) => q(`select public.set_file_archived($1,true)`, [m.file_id]))).rejects.toThrow(/Sem permissão/);
    await expect(asUser(pool, eva, (q) => q(`select public.set_file_archived($1,true)`, [m.file_id]))).rejects.toThrow(/Sem permissão/);
  });
  it("versões simultâneas recebem números distintos", async () => {
    const m = await available(bruno, acme);
    const ups = await Promise.all([1, 2, 3, 4].map(() => begin(bruno, acme, { file: m.file_id })));
    expect(new Set(ups.map((u) => u.version_number)).size).toBe(4);
  });
});

describe("isolamento de ficheiros entre clientes", () => {
  let acmeFile: Up;
  beforeAll(async () => { acmeFile = await available(bruno, acme, { name: "Confidencial" }); });

  it("outro cliente não vê ficheiros nem versões", async () => {
    expect((await asUser(pool, eva, (q) => q(`select * from public.files where account_id=$1`, [acme]))).rowCount).toBe(0);
    expect((await asUser(pool, eva, (q) => q(`select * from public.file_versions where account_id=$1`, [acme]))).rowCount).toBe(0);
    expect((await asUser(pool, ana, (q) => q(`select * from public.files`))).rowCount).toBe(0);
  });
  it("outro cliente não edita nem arquiva ficheiros alheios", async () => {
    expect((await asUser(pool, eva, (q) => q(`update public.files set display_name='Hack' where id=$1`, [acmeFile.file_id]))).rowCount).toBe(0);
    await expect(asUser(pool, eva, (q) => q(`select public.set_file_archived($1,true)`, [acmeFile.file_id]))).rejects.toThrow(/Sem permissão/);
  });
  it("não é possível acrescentar versões a ficheiros de outro cliente", async () => {
    await expect(begin(eva, beta, { file: acmeFile.file_id })).rejects.toThrow(/Ficheiro inválido/);
    await expect(begin(eva, acme, { file: acmeFile.file_id })).rejects.toThrow(/Sem permissão/);
  });
  it("versões pendentes só são vistas pelo autor", async () => {
    const pend = await begin(diogo, acme);
    const ids = async (u: string) => (await asUser(pool, u, (q) => q(`select id from public.file_versions where id=$1`, [pend.version_id]))).rowCount;
    expect(await ids(diogo)).toBe(1);
    expect(await ids(bruno)).toBe(0);
    expect(await ids(op)).toBe(0);
  });
  it("a equipa (operador e admin) vê ficheiros disponíveis", async () => {
    expect((await asUser(pool, op, (q) => q(`select * from public.file_versions where id=$1`, [acmeFile.version_id]))).rowCount).toBe(1);
    expect((await asUser(pool, sadmin, (q) => q(`select * from public.files where id=$1`, [acmeFile.file_id]))).rowCount).toBe(1);
  });
  it("anónimos não leem nada", async () => {
    await expect(asUser(pool, null, (q) => q(`select * from public.files`))).rejects.toThrow(/permission denied/);
    await expect(asUser(pool, null, (q) => q(`select * from storage.objects`))).rejects.toThrow(/permission denied|row-level/);
  });
  it("a auditoria regista os eventos de ficheiros sem expor conteúdo", async () => {
    const { rows } = await pool.query(`select distinct action from public.audit_log where entity_type in ('files','file_versions')`);
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["files.insert", "file_versions.insert", "file_versions.update", "files.update"]));
  });
});

describe("políticas do Storage (bucket privado)", () => {
  const putObject = (u: string, name: string) =>
    asUser(pool, u, (q) => q(`insert into storage.objects (bucket_id, name, owner) values ('project-files',$1,$2)`, [name, u]), { commit: true });
  const getObject = async (u: string, name: string) =>
    (await asUser(pool, u, (q) => q(`select name from storage.objects where bucket_id='project-files' and name=$1`, [name]))).rowCount;

  it("o bucket é privado", async () => {
    const { rows } = await pool.query(`select public from storage.buckets where id='project-files'`);
    expect(rows[0].public).toBe(false);
  });
  it("só o autor carrega para a versão pendente reservada", async () => {
    const up = await begin(diogo, acme);
    await expect(putObject(eva, up.storage_path)).rejects.toThrow(/row-level security/);
    await expect(putObject(bruno, up.storage_path)).rejects.toThrow(/row-level security/); // colega, mas não o autor
    await expect(putObject(diogo, `${acme}/${up.file_id}/${crypto.randomUUID()}`)).rejects.toThrow(/row-level security/);
    await expect(putObject(diogo, `${beta}/x/y`)).rejects.toThrow(/row-level security/);
    await expect(putObject(diogo, up.storage_path)).resolves.toBeDefined();
  });
  it("objetos de versões pendentes só são visíveis ao autor; depois de verificados, só pela conta e equipa", async () => {
    const up = await begin(diogo, acme);
    await putObject(diogo, up.storage_path);
    // ainda pendente: só o autor o vê; colegas, equipa e outros clientes não
    expect(await getObject(diogo, up.storage_path)).toBe(1);
    expect(await getObject(bruno, up.storage_path)).toBe(0);
    expect(await getObject(op, up.storage_path)).toBe(0);
    expect(await getObject(eva, up.storage_path)).toBe(0);
    await complete(up.version_id);
    expect(await getObject(diogo, up.storage_path)).toBe(1);
    expect(await getObject(carla, up.storage_path)).toBe(1);
    expect(await getObject(op, up.storage_path)).toBe(1);
    expect(await getObject(eva, up.storage_path)).toBe(0);
    expect(await getObject(ana, up.storage_path)).toBe(0);
  });
  it("objetos disponíveis não se substituem nem se apagam; pendentes/rejeitados do autor sim", async () => {
    const ok = await begin(diogo, acme);
    await putObject(diogo, ok.storage_path);
    await complete(ok.version_id);
    const del = await asUser(pool, diogo, (q) => q(`delete from storage.objects where name=$1`, [ok.storage_path]));
    expect(del.rowCount).toBe(0);
    const upd = await asUser(pool, diogo, (q) => q(`update storage.objects set metadata='{}' where name=$1`, [ok.storage_path]));
    expect(upd.rowCount).toBe(0);

    const bad = await begin(diogo, acme);
    await putObject(diogo, bad.storage_path);
    await asService(pool, (q) => q(`select public.reject_file_upload($1,'tipo inválido')`, [bad.version_id]));
    expect((await asUser(pool, bruno, (q) => q(`delete from storage.objects where name=$1`, [bad.storage_path]))).rowCount).toBe(0); // colega não
    expect((await asUser(pool, diogo, (q) => q(`delete from storage.objects where name=$1`, [bad.storage_path]))).rowCount).toBe(1);
  });
});

