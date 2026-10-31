import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addGuest, asUser, createWorld, run, type World } from "./fixtures";

let w: World;
let cat: string, otherCat: string, vendor: string, otherVendor: string;
beforeAll(async () => {
  w = await createWorld();
  cat = (await w.pool.query(`select id from public.budget_categories where wedding_id=$1 and name='Catering'`, [w.wedding])).rows[0].id;
  otherCat = (await w.pool.query(`select id from public.budget_categories where wedding_id=$1 limit 1`, [w.otherWedding])).rows[0].id;
  vendor = (await run(w.pool, w.paulo, `insert into public.vendors (wedding_id, company_name, status) values ($1,'Quinta do Lago','contratado') returning id`, [w.wedding]))[0].id;
  otherVendor = (await run(w.pool, w.other, `insert into public.vendors (wedding_id, company_name) values ($1,'Fornecedor Alheio') returning id`, [w.otherWedding]))[0].id;
});
afterAll(async () => { await w?.drop(); });

const expense = (uid: string, planned: number, paid: number, extra = "") =>
  run(w.pool, uid, `insert into public.expenses (wedding_id, category_id, description, planned_amount, paid_amount${extra ? ", " + extra.split("=")[0] : ""}) values ($1,$2,'Teste',$3,$4${extra ? ", " + extra.split("=")[1] : ""}) returning id, payment_status`, [w.wedding, cat, planned, paid]);

describe("orçamento e despesas", () => {
  it("o estado do pagamento é derivado dos valores (nunca fica inconsistente)", async () => {
    expect((await expense(w.paulo, 1000, 0))[0].payment_status).toBe("por_pagar");
    expect((await expense(w.paulo, 1000, 400))[0].payment_status).toBe("parcial");
    expect((await expense(w.paulo, 1000, 1000))[0].payment_status).toBe("pago");
    expect((await expense(w.paulo, 1000, 1200))[0].payment_status).toBe("pago");
    const [{ id }] = await expense(w.paulo, 500, 0);
    await run(w.pool, w.ines, `update public.expenses set paid_amount=500 where id=$1`, [id]);
    expect((await w.pool.query(`select payment_status from public.expenses where id=$1`, [id])).rows[0].payment_status).toBe("pago");
    await expect(w.pool.query(`update public.expenses set payment_status='pago' where id=$1`, [id])).rejects.toThrow(/generated column|can only be updated to DEFAULT/);
  });
  it("valida valores e relações: não negativos; categoria e fornecedor do mesmo casamento", async () => {
    await expect(expense(w.paulo, -1, 0)).rejects.toThrow(/check/);
    await expect(expense(w.paulo, 10, -5)).rejects.toThrow(/check/);
    await expect(run(w.pool, w.paulo, `insert into public.expenses (wedding_id, category_id, description) values ($1,$2,'X')`, [w.wedding, otherCat])).rejects.toThrow(/foreign key/);
    await expect(run(w.pool, w.paulo, `insert into public.expenses (wedding_id, category_id, vendor_id, description) values ($1,$2,$3,'X')`, [w.wedding, cat, otherVendor])).rejects.toThrow(/foreign key/);
    expect((await run(w.pool, w.paulo, `insert into public.expenses (wedding_id, category_id, vendor_id, description, planned_amount) values ($1,$2,$3,'Aluguer',2500) returning vendor_id`, [w.wedding, cat, vendor]))[0].vendor_id).toBe(vendor);
  });
  it("não se apaga uma categoria nem um fornecedor com despesas associadas", async () => {
    await expect(run(w.pool, w.paulo, `delete from public.budget_categories where id=$1`, [cat])).rejects.toThrow(/foreign key|violates/);
    await expect(run(w.pool, w.paulo, `delete from public.vendors where id=$1`, [vendor])).rejects.toThrow(/foreign key|violates/);
  });
  it("isolamento: nenhum dos noivos vê despesas, categorias ou fornecedores de outro casamento", async () => {
    for (const t of ["expenses", "budget_categories", "vendors"]) {
      const rows = (await asUser(w.pool, w.other, (q) => q(`select wedding_id from public.${t}`))).rows;
      expect(rows.every((r) => r.wedding_id === w.otherWedding), t).toBe(true);
    }
  });
});

describe("tarefas", () => {
  it("carimba a conclusão e limpa-a se for reaberta; valida o responsável", async () => {
    const [t] = await run(w.pool, w.paulo, `insert into public.tasks (wedding_id, title, assignee, priority, due_date) values ($1,'Escolher bolo','partner2','alta','2027-03-01') returning id, status, completed_at`, [w.wedding]);
    expect([t.status, t.completed_at]).toEqual(["por_iniciar", null]);
    await run(w.pool, w.ines, `update public.tasks set status='em_andamento' where id=$1`, [t.id]);
    await run(w.pool, w.ines, `update public.tasks set status='concluida' where id=$1`, [t.id]);
    expect((await w.pool.query(`select completed_at from public.tasks where id=$1`, [t.id])).rows[0].completed_at).not.toBeNull();
    await run(w.pool, w.ines, `update public.tasks set status='por_iniciar' where id=$1`, [t.id]);
    expect((await w.pool.query(`select completed_at from public.tasks where id=$1`, [t.id])).rows[0].completed_at).toBeNull();
    await expect(run(w.pool, w.paulo, `insert into public.tasks (wedding_id, title, assignee) values ($1,'X','other')`, [w.wedding])).rejects.toThrow(/check/);
    await expect(run(w.pool, w.paulo, `insert into public.tasks (wedding_id, title) values ($1,'  ')`, [w.wedding])).rejects.toThrow(/check/);
  });
});

describe("fornecedores", () => {
  it("valida email e site; guarda valores", async () => {
    await expect(run(w.pool, w.paulo, `insert into public.vendors (wedding_id, company_name, email) values ($1,'F','mau')`, [w.wedding])).rejects.toThrow(/check/);
    await expect(run(w.pool, w.paulo, `insert into public.vendors (wedding_id, company_name, website) values ($1,'F','javascript:alert(1)')`, [w.wedding])).rejects.toThrow(/check/);
    const [v] = await run(w.pool, w.paulo, `insert into public.vendors (wedding_id, company_name, website, quoted_amount, contracted_amount) values ($1,'Foto & Arte','https://foto.example',1800,1650) returning quoted_amount::float q, contracted_amount::float c`, [w.wedding]);
    expect(v).toEqual({ q: 1800, c: 1650 });
  });
});

describe("calendário", () => {
  it("cria eventos de todos os tipos pedidos e valida horas", async () => {
    for (const type of ["pagamento", "reuniao", "prazo", "tarefa", "prova_roupa", "contacto_fornecedor", "data_importante", "outro"]) {
      await run(w.pool, w.paulo, `insert into public.calendar_events (wedding_id, title, event_type, event_date) values ($1,$2,$3,'2027-02-01')`, [w.wedding, `Evento ${type}`, type]);
    }
    await expect(run(w.pool, w.paulo, `insert into public.calendar_events (wedding_id, title, event_date, start_time, end_time) values ($1,'Mau','2027-02-01','15:00','14:00')`, [w.wedding])).rejects.toThrow(/check/);
    expect((await run(w.pool, w.ines, `insert into public.calendar_events (wedding_id, title, event_date, start_time, end_time, vendor_id) values ($1,'Prova','2027-02-02','10:00','11:00',$2) returning id`, [w.wedding, vendor])).length).toBe(1);
  });
});

describe("documentos (metadados) e Storage privado", () => {
  const path = (wedding: string, name = "contrato.pdf") => `${wedding}/${crypto.randomUUID()}-${name}`;
  const putObject = (uid: string, name: string, bucket = "wedding-documents") =>
    asUser(w.pool, uid, (q) => q(`insert into storage.objects (bucket_id, name, owner) values ($1,$2,$3)`, [bucket, name, uid]), { commit: true });
  const getObject = async (uid: string, name: string) =>
    (await asUser(w.pool, uid, (q) => q(`select name from storage.objects where name=$1`, [name]))).rowCount;

  it("o ficheiro tem de estar na pasta do próprio casamento", async () => {
    const ok = path(w.wedding);
    await run(w.pool, w.paulo, `insert into public.documents (wedding_id, name, category, storage_path, size_bytes, uploaded_by) values ($1,'Contrato',$2,$3,1000,$4)`, [w.wedding, "contrato", ok, w.paulo]);
    await expect(run(w.pool, w.paulo, `insert into public.documents (wedding_id, name, storage_path, size_bytes, uploaded_by) values ($1,'X',$2,10,$3)`, [w.wedding, path(w.otherWedding), w.paulo])).rejects.toThrow(/check/);
    await expect(run(w.pool, w.paulo, `insert into public.documents (wedding_id, name, storage_path, size_bytes, uploaded_by) values ($1,'X',$2,10,$3)`, [w.wedding, `${w.wedding}/../${w.otherWedding}/x.pdf`, w.paulo])).rejects.toThrow(/check/);
    await expect(run(w.pool, w.paulo, `insert into public.documents (wedding_id, name, storage_path, size_bytes, uploaded_by) values ($1,'Grande',$2,26214401,$3)`, [w.wedding, path(w.wedding), w.paulo])).rejects.toThrow(/check/);
    await expect(run(w.pool, w.paulo, `insert into public.documents (wedding_id, name, storage_path, size_bytes, uploaded_by) values ($1,'X',$2,10,$3)`, [w.wedding, path(w.wedding), w.ines])).rejects.toThrow(/row-level security/);
  });
  it("só os noivos veem e apagam os documentos; estranhos não", async () => {
    expect((await asUser(w.pool, w.ines, (q) => q(`select 1 from public.documents`))).rowCount).toBeGreaterThan(0);
    expect((await asUser(w.pool, w.outsider, (q) => q(`select 1 from public.documents`))).rowCount).toBe(0);
    expect((await asUser(w.pool, w.other, (q) => q(`select 1 from public.documents where wedding_id=$1`, [w.wedding]))).rowCount).toBe(0);
    expect((await asUser(w.pool, w.outsider, (q) => q(`delete from public.documents`))).rowCount).toBe(0);
  });
  it("Storage: só se carrega para a pasta do próprio casamento", async () => {
    const mine = path(w.wedding, "foto.jpg");
    await expect(putObject(w.paulo, mine)).resolves.toBeDefined();
    await expect(putObject(w.paulo, path(w.otherWedding))).rejects.toThrow(/row-level security/);
    await expect(putObject(w.outsider, path(w.wedding))).rejects.toThrow(/row-level security/);
    await expect(putObject(w.paulo, "sem-pasta.pdf")).rejects.toThrow(/row-level security/);
    await expect(putObject(w.paulo, "nao-e-uuid/ficheiro.pdf")).rejects.toThrow(/row-level security/);
    await expect(putObject(w.paulo, path(w.wedding), "outro-bucket")).rejects.toThrow(/row-level security|foreign key|violates/);
  });
  it("Storage: ver e apagar só os membros; nunca substituir", async () => {
    const name = path(w.wedding, "comprovativo.pdf");
    await putObject(w.ines, name);
    expect(await getObject(w.paulo, name)).toBe(1);
    expect(await getObject(w.outsider, name)).toBe(0);
    expect(await getObject(w.other, name)).toBe(0);
    await expect(asUser(w.pool, null, (q) => q(`select * from storage.objects`))).rejects.toThrow(/permission denied|row-level/);
    expect((await asUser(w.pool, w.outsider, (q) => q(`delete from storage.objects where name=$1`, [name]))).rowCount).toBe(0);
    expect((await asUser(w.pool, w.ines, (q) => q(`update storage.objects set metadata='{}' where name=$1`, [name]))).rowCount).toBe(0);
    expect((await asUser(w.pool, w.paulo, (q) => q(`delete from storage.objects where name=$1`, [name]))).rowCount).toBe(1);
  });
});

describe("dados em simultâneo e integridade global", () => {
  it("os dois noivos inserem ao mesmo tempo sem conflitos", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => addGuest(w, i % 2 ? w.ines : w.paulo, { full_name: `Simultâneo ${i}` })));
    expect(new Set(results).size).toBe(20);
  });
});
