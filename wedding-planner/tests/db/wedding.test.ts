import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addGuest, asUser, createUser, createWorld, run, type World } from "./fixtures";

let w: World;
beforeAll(async () => { w = await createWorld(); });
afterAll(async () => { await w?.drop(); });

describe("casamento e utilizadores", () => {
  it("o casamento nasce com as informações iniciais pedidas", async () => {
    const [row] = (await w.pool.query(`select name, partner1_name, partner2_name, wedding_date::text d from public.weddings where id=$1`, [w.wedding])).rows;
    expect(row).toEqual({ name: "O Nosso Casamento", partner1_name: "Paulo", partner2_name: "Inês", d: "2027-07-02" });
  });
  it("cria as 16 categorias de orçamento pedidas, por ordem", async () => {
    const { rows } = await w.pool.query(`select name from public.budget_categories where wedding_id=$1 order by sort_order`, [w.wedding]);
    expect(rows.map((r) => r.name)).toEqual(["Espaço","Catering","Fotografia","Vídeo","Música","Decoração","Flores","Vestido","Fato","Alianças","Convites","Bolo","Transporte","Alojamento","Lua de mel","Outros"]);
  });
  it("os dois noivos acedem ao mesmo casamento; o primeiro é proprietário", async () => {
    const m = (await w.pool.query(`select user_id, role from public.wedding_members where wedding_id=$1 order by role`, [w.wedding])).rows;
    expect(m).toEqual(expect.arrayContaining([{ user_id: w.paulo, role: "owner" }, { user_id: w.ines, role: "member" }]));
    for (const u of [w.paulo, w.ines]) {
      expect((await asUser(w.pool, u, (q) => q(`select id from public.weddings`))).rows.map((r) => r.id)).toEqual([w.wedding]);
    }
  });
  it("cada membro fica registado com o seu email (para a lista de utilizadores autorizados)", async () => {
    const rows = (await asUser(w.pool, w.ines, (q) => q(`select user_id, email::text e from public.wedding_members order by role`))).rows;
    expect(rows.map((r) => r.e).sort()).toEqual(["ines@example.test", "paulo@example.test"]);
  });
  it("trabalham em simultâneo: o que um cria o outro vê e edita", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Convidado do Paulo" });
    const seen = await asUser(w.pool, w.ines, (q) => q(`select full_name from public.guests where id=$1`, [g]));
    expect(seen.rows[0].full_name).toBe("Convidado do Paulo");
    const upd = await asUser(w.pool, w.ines, (q) => q(`update public.guests set phone='912345678' where id=$1`, [g]));
    expect(upd.rowCount).toBe(1);
  });
  it("ambos podem alterar nome, noivos, data e orçamento total", async () => {
    await run(w.pool, w.ines, `update public.weddings set name='Casamento P&I', partner1_name='Paulo M.', wedding_date='2027-07-03', total_budget=25000 where id=$1`, [w.wedding]);
    const [r] = (await w.pool.query(`select name, wedding_date::text d, total_budget::float t from public.weddings where id=$1`, [w.wedding])).rows;
    expect(r).toEqual({ name: "Casamento P&I", d: "2027-07-03", t: 25000 });
    await run(w.pool, w.paulo, `update public.weddings set name='O Nosso Casamento', partner1_name='Paulo', wedding_date='2027-07-02' where id=$1`, [w.wedding]);
  });
  it("cada utilizador só pode pertencer a um casamento", async () => {
    await expect(asUser(w.pool, w.paulo, (q) => q(`select public.create_wedding()`))).rejects.toThrow(/Já pertence/);
  });
  it("um estranho não vê nada e não consegue criar dados no casamento alheio", async () => {
    for (const t of ["weddings", "wedding_members", "guests", "tables", "expenses", "tasks", "vendors", "documents", "calendar_events", "budget_categories", "guest_groups", "invitations"]) {
      expect((await asUser(w.pool, w.outsider, (q) => q(`select * from public.${t}`))).rowCount, t).toBe(0);
    }
    await expect(asUser(w.pool, w.outsider, (q) => q(`insert into public.guests (wedding_id, full_name) values ($1,'Intruso')`, [w.wedding]))).rejects.toThrow(/row-level security/);
    expect((await asUser(w.pool, w.outsider, (q) => q(`update public.weddings set name='Hack' where id=$1`, [w.wedding]))).rowCount).toBe(0);
    expect((await asUser(w.pool, w.outsider, (q) => q(`delete from public.guests where wedding_id=$1`, [w.wedding]))).rowCount).toBe(0);
  });
  it("utilizadores anónimos não acedem a nenhuma tabela", async () => {
    for (const t of ["weddings", "guests", "tables", "expenses", "documents"]) {
      await expect(asUser(w.pool, null, (q) => q(`select * from public.${t}`)), t).rejects.toThrow(/permission denied/);
    }
  });
  it("convites de utilizador: só quem tem o email convidado entra; só os membros convidam", async () => {
    const third = await createUser(w.pool, "terceiro@example.test");
    expect((await run(w.pool, third, `select public.accept_wedding_invitation() id`))[0].id).toBeNull();
    await expect(asUser(w.pool, w.outsider, (q) => q(`insert into public.wedding_invitations (wedding_id, email, invited_by) values ($1,'terceiro@example.test',$2)`, [w.wedding, w.outsider]))).rejects.toThrow(/row-level security/);
    await run(w.pool, w.ines, `insert into public.wedding_invitations (wedding_id, email, invited_by) values ($1,'Terceiro@Example.test',$2)`, [w.wedding, w.ines]);
    expect((await run(w.pool, third, `select public.accept_wedding_invitation() id`))[0].id).toBe(w.wedding);
    expect((await asUser(w.pool, third, (q) => q(`select id from public.guests limit 1`))).rowCount).toBeGreaterThan(0);
  });
  it("não se convida duas vezes o mesmo email (sem distinguir maiúsculas)", async () => {
    await run(w.pool, w.paulo, `insert into public.wedding_invitations (wedding_id, email, invited_by) values ($1,'Dup@Example.test',$2)`, [w.wedding, w.paulo]);
    await expect(run(w.pool, w.ines, `insert into public.wedding_invitations (wedding_id, email, invited_by) values ($1,'dup@example.TEST',$2)`, [w.wedding, w.ines])).rejects.toThrow(/duplicate key/);
    await run(w.pool, w.paulo, `delete from public.wedding_invitations where email='dup@example.test'`);
  });
  it("o proprietário remove utilizadores; ninguém remove o proprietário; membro pode sair", async () => {
    const [t] = (await w.pool.query(`select id from auth.users where email='terceiro@example.test'`)).rows;
    expect((await asUser(w.pool, w.ines, (q) => q(`delete from public.wedding_members where user_id=$1`, [t.id]))).rowCount).toBe(0);
    expect((await asUser(w.pool, w.paulo, (q) => q(`delete from public.wedding_members where user_id=$1`, [w.paulo]))).rowCount).toBe(0);
    expect((await run(w.pool, w.paulo, `delete from public.wedding_members where user_id=$1 returning 1`, [t.id])).length).toBe(1);
    expect((await asUser(w.pool, t.id, (q) => q(`select * from public.guests`))).rowCount).toBe(0);
  });
  it("no máximo 6 utilizadores por casamento", async () => {
    const extra: string[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await createUser(w.pool, `extra${i}@example.test`);
      extra.push(u);
      await w.pool.query(`insert into public.wedding_invitations (wedding_id, email) values ($1,$2)`, [w.wedding, `extra${i}@example.test`]);
    }
    for (const u of extra.slice(0, 4)) await run(w.pool, u, `select public.accept_wedding_invitation()`);
    await expect(run(w.pool, extra[4]!, `select public.accept_wedding_invitation()`)).rejects.toThrow(/Limite de utilizadores/);
  });
  it("só o proprietário apaga o casamento (e tudo em cascata)", async () => {
    const scratch = await createUser(w.pool, "scratch@example.test");
    const id = (await run(w.pool, scratch, `select public.create_wedding('Teste','A','B','2030-01-01') id`))[0].id;
    await addGuest(w, scratch, { full_name: "X" }, id);
    expect((await asUser(w.pool, w.outsider, (q) => q(`delete from public.weddings where id=$1`, [id]))).rowCount).toBe(0);
    expect((await run(w.pool, scratch, `delete from public.weddings where id=$1 returning 1`, [id])).length).toBe(1);
    expect((await w.pool.query(`select 1 from public.guests where wedding_id=$1`, [id])).rowCount).toBe(0);
  });
});
