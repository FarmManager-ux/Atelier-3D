import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addGuest, asUser, createWorld, run, type World } from "./fixtures";

let w: World;
beforeAll(async () => { w = await createWorld(); });
afterAll(async () => { await w?.drop(); });

const guest = async (id: string) => (await w.pool.query(`select * from public.guests where id=$1`, [id])).rows[0];
const inv = async (id: string) => (await w.pool.query(`select * from public.invitations where guest_id=$1`, [id])).rows[0];

describe("convidados: criação e contagem de pessoas", () => {
  it("guarda todos os campos pedidos", async () => {
    const id = await addGuest(w, w.paulo, {
      full_name: "Maria Silva", surname: "Silva", phone: "912345678", email: "Maria@Example.test", relationship: "Prima do Paulo",
      side: "partner1", category: "familia", age_group: "adulto", companion_names: "João Silva", companions_count: 1, children_count: 2,
      dietary_restrictions: "Vegetariana", allergies: "Frutos secos", notes: "Mesa perto da pista",
    });
    const g = await guest(id);
    expect(g).toMatchObject({ full_name: "Maria Silva", side: "partner1", category: "familia", companions_count: 1, children_count: 2,
      invitation_status: "por_convidar", rsvp_status: "sem_resposta", email: "Maria@Example.test" });
  });
  it("conta pessoas individuais: o convidado + acompanhantes + crianças (sem duplicar)", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Família Costa", companions_count: 1, children_count: 2 });
    expect((await guest(id)).invited_count).toBe(4);
    expect((await guest(id)).expected_count).toBe(4);
  });
  it("cada convidado nasce com um convite e um token único de RSVP", async () => {
    const a = await addGuest(w, w.paulo, { full_name: "A" });
    const b = await addGuest(w, w.paulo, { full_name: "B" });
    const [ia, ib] = [await inv(a), await inv(b)];
    expect(ia.token).toMatch(/^[0-9a-f]{36}$/);
    expect(ia.token).not.toBe(ib.token);
    expect(ia.sent_at).toBeNull();
  });
  it("valida os dados: nomes vazios, emails inválidos, contagens negativas", async () => {
    await expect(addGuest(w, w.paulo, { full_name: "   " })).rejects.toThrow(/check/);
    await expect(addGuest(w, w.paulo, { full_name: "X", email: "nao-é-email" })).rejects.toThrow(/check/);
    await expect(addGuest(w, w.paulo, { full_name: "X", companions_count: -1 })).rejects.toThrow(/check/);
    await expect(addGuest(w, w.paulo, { full_name: "X", children_count: 99 })).rejects.toThrow(/check/);
    await expect(addGuest(w, w.paulo, { full_name: "X", side: "ninguem" })).rejects.toThrow(/invalid input value/);
  });
});

describe("estado do convite e da presença são independentes", () => {
  it("convite entregue sem resposta; confirmação sem ter mudado o convite", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Independente" });
    await run(w.pool, w.paulo, `update public.guests set invitation_status='entregue' where id=$1`, [id]);
    let g = await guest(id);
    expect([g.invitation_status, g.rsvp_status]).toEqual(["entregue", "sem_resposta"]);
    expect((await inv(id)).responded_at).toBeNull();
    await run(w.pool, w.ines, `update public.guests set rsvp_status='confirmado' where id=$1`, [id]);
    g = await guest(id);
    expect([g.invitation_status, g.rsvp_status]).toEqual(["entregue", "confirmado"]);
    await run(w.pool, w.ines, `update public.guests set invitation_status='enviado' where id=$1`, [id]);
    expect((await guest(id)).rsvp_status).toBe("confirmado");
  });
  it("as datas do convite acompanham os estados (enviado, entregue, resposta) e revertem", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Datas" });
    await run(w.pool, w.paulo, `update public.guests set invitation_status='enviado' where id=$1`, [id]);
    let i = await inv(id);
    expect([i.sent_at !== null, i.delivered_at]).toEqual([true, null]);
    await run(w.pool, w.paulo, `update public.guests set invitation_status='entregue' where id=$1`, [id]);
    i = await inv(id); expect(i.delivered_at).not.toBeNull();
    await run(w.pool, w.paulo, `update public.guests set rsvp_status='nao_vai' where id=$1`, [id]);
    expect((await inv(id)).responded_at).not.toBeNull();
    await run(w.pool, w.paulo, `update public.guests set rsvp_status='sem_resposta', invitation_status='por_convidar' where id=$1`, [id]);
    i = await inv(id);
    expect([i.sent_at, i.delivered_at, i.responded_at]).toEqual([null, null, null]);
  });
  it("datas manuais do convite prevalecem sobre o carimbo automático", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Manual" });
    await run(w.pool, w.paulo, `update public.invitations set sent_at='2027-01-10T10:00:00Z' where guest_id=$1`, [id]);
    await run(w.pool, w.paulo, `update public.guests set invitation_status='enviado' where id=$1`, [id]);
    expect(new Date((await inv(id)).sent_at).toISOString()).toBe("2027-01-10T10:00:00.000Z");
  });
  it("pessoas esperadas: 0 se não vai; os confirmados se confirmou parcialmente", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Esperados", companions_count: 2, children_count: 1 });
    await run(w.pool, w.paulo, `select public.record_manual_rsvp($1,'confirmado',1,0)`, [id]);
    expect([(await guest(id)).invited_count, (await guest(id)).expected_count]).toEqual([4, 2]);
    await run(w.pool, w.paulo, `select public.record_manual_rsvp($1,'nao_vai')`, [id]);
    expect([(await guest(id)).invited_count, (await guest(id)).expected_count]).toEqual([4, 0]);
  });
  it("importar um convidado já confirmado regista as datas", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Importado", invitation_status: "entregue", rsvp_status: "confirmado" });
    const i = await inv(id);
    expect([i.sent_at, i.delivered_at, i.responded_at].every((x) => x !== null)).toBe(true);
  });
});

describe("famílias/grupos", () => {
  it("associa vários convidados ao mesmo grupo; nomes de grupo únicos (sem distinguir maiúsculas)", async () => {
    const g1 = (await run(w.pool, w.paulo, `insert into public.guest_groups (wedding_id, name) values ($1,'Família Pereira') returning id`, [w.wedding]))[0].id;
    await expect(run(w.pool, w.ines, `insert into public.guest_groups (wedding_id, name) values ($1,' família pereira ')`, [w.wedding])).rejects.toThrow(/duplicate key/);
    await addGuest(w, w.paulo, { full_name: "Pai", group_id: g1 });
    await addGuest(w, w.paulo, { full_name: "Mãe", group_id: g1 });
    const { rows } = await w.pool.query(`select count(*)::int n, sum(invited_count)::int p from public.guests where group_id=$1`, [g1]);
    expect(rows[0]).toEqual({ n: 2, p: 2 });
  });
  it("não se apaga um grupo com membros; depois de os desassociar, apaga-se sem apagar convidados", async () => {
    const g1 = (await run(w.pool, w.paulo, `insert into public.guest_groups (wedding_id, name) values ($1,'Temporário') returning id`, [w.wedding]))[0].id;
    const a = await addGuest(w, w.paulo, { full_name: "Membro", group_id: g1 });
    await expect(run(w.pool, w.paulo, `delete from public.guest_groups where id=$1`, [g1])).rejects.toThrow(/foreign key|violates/);
    await run(w.pool, w.paulo, `update public.guests set group_id=null where group_id=$1`, [g1]);
    await run(w.pool, w.paulo, `delete from public.guest_groups where id=$1`, [g1]);
    expect((await guest(a)).group_id).toBeNull();
  });
  it("um convidado não pode ser associado a um grupo de outro casamento", async () => {
    const foreign = (await run(w.pool, w.other, `insert into public.guest_groups (wedding_id, name) values ($1,'Alheio') returning id`, [w.otherWedding]))[0].id;
    await expect(addGuest(w, w.paulo, { full_name: "Cruzado", group_id: foreign })).rejects.toThrow(/foreign key/);
  });
});

describe("edição, duplicação e eliminação", () => {
  it("edita, e o wedding_id nunca pode mudar", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Editável" });
    await run(w.pool, w.ines, `update public.guests set full_name='Editado', side='both' where id=$1`, [id]);
    expect((await guest(id)).full_name).toBe("Editado");
    await expect(w.pool.query(`update public.guests set wedding_id=$1 where id=$2`, [w.otherWedding, id])).rejects.toThrow(/não pode ser alterado/);
  });
  it("eliminar um convidado elimina o convite e as respostas", async () => {
    const id = await addGuest(w, w.paulo, { full_name: "Apagável" });
    await run(w.pool, w.paulo, `select public.record_manual_rsvp($1,'confirmado')`, [id]);
    await run(w.pool, w.paulo, `delete from public.guests where id=$1`, [id]);
    for (const t of ["invitations", "rsvp_responses"]) {
      expect((await w.pool.query(`select 1 from public.${t} where guest_id=$1`, [id])).rowCount, t).toBe(0);
    }
  });
  it("os dois noivos não veem convidados de outro casamento", async () => {
    await addGuest(w, w.other, { full_name: "Do Outro Casamento" }, w.otherWedding);
    const names = (await asUser(w.pool, w.paulo, (q) => q(`select full_name from public.guests`))).rows.map((r) => r.full_name);
    expect(names).not.toContain("Do Outro Casamento");
  });
});
