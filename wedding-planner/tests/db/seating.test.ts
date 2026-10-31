import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addGuest, addTable, asUser, createWorld, run, seatsOf, type World } from "./fixtures";

let w: World;
beforeAll(async () => { w = await createWorld(); });
afterAll(async () => { await w?.drop(); });

const assign = (uid: string, guest: string, table: string) => run(w.pool, uid, `select public.assign_guest_to_table($1,$2)`, [guest, table]);
const table = async (id: string) => (await w.pool.query(
  `select t.capacity, (select count(*)::int from public.table_seats where table_id=t.id) seats,
          (select count(*)::int from public.guest_seatings where table_id=t.id) used from public.tables t where t.id=$1`, [id])).rows[0];

describe("lugares das mesas", () => {
  it("criar uma mesa cria os lugares físicos; alterar a capacidade ajusta-os", async () => {
    const t = await addTable(w, w.paulo, "Mesa 1", 6);
    expect(await table(t)).toEqual({ capacity: 6, seats: 6, used: 0 });
    await run(w.pool, w.paulo, `update public.tables set capacity=10 where id=$1`, [t]);
    expect((await table(t)).seats).toBe(10);
    await run(w.pool, w.paulo, `update public.tables set capacity=4 where id=$1`, [t]);
    expect((await table(t)).seats).toBe(4);
  });
  it("atribui convidados guardando os lugares (um convidado com acompanhantes ocupa vários)", async () => {
    const t = await addTable(w, w.paulo, "Mesa A", 6);
    const solo = await addGuest(w, w.paulo, { full_name: "Solo" });
    const familia = await addGuest(w, w.paulo, { full_name: "Família", companions_count: 1, children_count: 1 });
    await assign(w.paulo, solo, t);
    await assign(w.ines, familia, t);
    expect(await seatsOf(w.pool, solo)).toEqual([{ seat_number: 1, person_index: 0 }]);
    expect(await seatsOf(w.pool, familia)).toEqual([{ seat_number: 2, person_index: 0 }, { seat_number: 3, person_index: 1 }, { seat_number: 4, person_index: 2 }]);
    expect(await table(t)).toEqual({ capacity: 6, seats: 6, used: 4 });
  });
  it("NUNCA ultrapassa a capacidade e não deixa o estado a meio", async () => {
    const t = await addTable(w, w.paulo, "Mesa Cheia", 3);
    const a = await addGuest(w, w.paulo, { full_name: "Cabe", companions_count: 1 });
    const b = await addGuest(w, w.paulo, { full_name: "Não cabe", companions_count: 1 });
    await assign(w.paulo, a, t);
    await expect(assign(w.paulo, b, t)).rejects.toThrow(/não tem lugares suficientes \(faltam 1\)/);
    expect((await table(t)).used).toBe(2);
    expect(await seatsOf(w.pool, b)).toEqual([]);
  });
  it("mover entre mesas é atómico: se a mesa de destino estiver cheia, o convidado fica onde estava", async () => {
    const t1 = await addTable(w, w.paulo, "Origem", 4);
    const t2 = await addTable(w, w.paulo, "Destino", 1);
    const x = await addGuest(w, w.paulo, { full_name: "X" });
    const y = await addGuest(w, w.paulo, { full_name: "Y" });
    const z = await addGuest(w, w.paulo, { full_name: "Z" });
    await assign(w.paulo, x, t1); await assign(w.paulo, y, t2);
    await expect(assign(w.paulo, x, t2)).rejects.toThrow(/lugares suficientes/);
    expect((await w.pool.query(`select table_id from public.guest_seatings where guest_id=$1`, [x])).rows[0].table_id).toBe(t1);
    await assign(w.paulo, y, t1);
    await assign(w.paulo, z, t2);
    expect((await table(t2)).used).toBe(1);
  });
  it("o mesmo convidado nunca está em duas mesas (mover liberta a mesa anterior)", async () => {
    const t1 = await addTable(w, w.paulo, "M-A", 4);
    const t2 = await addTable(w, w.paulo, "M-B", 4);
    const g = await addGuest(w, w.paulo, { full_name: "Itinerante", companions_count: 1 });
    await assign(w.paulo, g, t1);
    await assign(w.paulo, g, t2);
    expect((await table(t1)).used).toBe(0);
    expect((await table(t2)).used).toBe(2);
    expect((await w.pool.query(`select distinct table_id from public.guest_seatings where guest_id=$1`, [g])).rows).toEqual([{ table_id: t2 }]);
    await assign(w.paulo, g, t2);
    expect((await table(t2)).used).toBe(2);
  });
  it("retirar um convidado liberta os lugares", async () => {
    const t = await addTable(w, w.paulo, "Retirar", 4);
    const g = await addGuest(w, w.paulo, { full_name: "Sai", companions_count: 1 });
    await assign(w.paulo, g, t);
    await run(w.pool, w.ines, `select public.unassign_guest($1)`, [g]);
    expect((await table(t)).used).toBe(0);
  });
  it("a base de dados impede dois convidados no mesmo lugar e o mesmo convidado em duas mesas", async () => {
    const t1 = await addTable(w, w.paulo, "U-1", 2);
    const t2 = await addTable(w, w.paulo, "U-2", 2);
    const a = await addGuest(w, w.paulo, { full_name: "A" });
    const b = await addGuest(w, w.paulo, { full_name: "B" });
    await assign(w.paulo, a, t1);
    const seat = (await w.pool.query(`select seat_id from public.guest_seatings where guest_id=$1`, [a])).rows[0].seat_id;
    await expect(w.pool.query(`insert into public.guest_seatings (wedding_id, guest_id, table_id, seat_id, person_index) values ($1,$2,$3,$4,0)`, [w.wedding, b, t1, seat])).rejects.toThrow(/duplicate key/);
    const seat2 = (await w.pool.query(`select id from public.table_seats where table_id=$1 limit 1`, [t2])).rows[0];
    await expect(w.pool.query(`insert into public.guest_seatings (wedding_id, guest_id, table_id, seat_id, person_index) values ($1,$2,$3,$4,1)`, [w.wedding, a, t2, seat2.id])).rejects.toThrow(/já está sentado noutra mesa/);
  });
  it("clientes não escrevem diretamente em lugares nem em atribuições", async () => {
    const t = await addTable(w, w.paulo, "Direta", 2);
    const g = await addGuest(w, w.paulo, { full_name: "G" });
    const seat = (await w.pool.query(`select id from public.table_seats where table_id=$1 limit 1`, [t])).rows[0].id;
    await expect(asUser(w.pool, w.paulo, (q) => q(`insert into public.guest_seatings (wedding_id, guest_id, table_id, seat_id, person_index) values ($1,$2,$3,$4,0)`, [w.wedding, g, t, seat]))).rejects.toThrow(/permission denied/);
    await expect(asUser(w.pool, w.paulo, (q) => q(`delete from public.table_seats where table_id=$1`, [t]))).rejects.toThrow(/permission denied/);
    await expect(asUser(w.pool, w.paulo, (q) => q(`update public.guest_seatings set table_id=$1`, [t]))).rejects.toThrow(/permission denied/);
  });
  it("isolamento: ninguém atribui convidados ou mesas de outro casamento", async () => {
    const mine = await addTable(w, w.paulo, "Minha", 4);
    const gMine = await addGuest(w, w.paulo, { full_name: "Meu" });
    const theirs = await addTable(w, w.other, "Deles", 4, w.otherWedding);
    const gTheirs = await addGuest(w, w.other, { full_name: "Deles" }, w.otherWedding);
    await expect(assign(w.paulo, gMine, theirs)).rejects.toThrow(/Mesa não encontrada/);
    await expect(assign(w.paulo, gTheirs, mine)).rejects.toThrow(/Sem permissão/);
    await expect(assign(w.outsider, gMine, mine)).rejects.toThrow(/Sem permissão/);
    await expect(run(w.pool, w.outsider, `select public.unassign_guest($1)`, [gMine])).rejects.toThrow(/Sem permissão/);
    await expect(asUser(w.pool, null, (q) => q(`select public.assign_guest_to_table($1,$2)`, [gMine, mine]))).rejects.toThrow(/permission denied/);
  });
});

describe("regras ao mudar a presença ou o número de pessoas", () => {
  it("quem não vai comparecer não pode ser sentado e liberta o lugar se já estava", async () => {
    const t = await addTable(w, w.paulo, "Presença", 4);
    const g = await addGuest(w, w.paulo, { full_name: "Desiste", companions_count: 1 });
    await assign(w.paulo, g, t);
    expect((await table(t)).used).toBe(2);
    await run(w.pool, w.paulo, `update public.guests set rsvp_status='nao_vai' where id=$1`, [g]);
    expect((await table(t)).used).toBe(0);
    await expect(assign(w.paulo, g, t)).rejects.toThrow(/não vai comparecer/);
  });
  it("reduzir acompanhantes liberta lugares; aumentar ocupa-os se houver espaço", async () => {
    const t = await addTable(w, w.paulo, "Resize", 4);
    const g = await addGuest(w, w.paulo, { full_name: "Variável", companions_count: 2 });
    await assign(w.paulo, g, t);
    expect((await table(t)).used).toBe(3);
    await run(w.pool, w.paulo, `update public.guests set companions_count=0 where id=$1`, [g]);
    expect((await table(t)).used).toBe(1);
    await run(w.pool, w.paulo, `update public.guests set companions_count=2 where id=$1`, [g]);
    expect((await table(t)).used).toBe(3);
  });
  it("aumentar para além da capacidade é recusado e nada muda", async () => {
    const t = await addTable(w, w.paulo, "Limite", 2);
    const g = await addGuest(w, w.paulo, { full_name: "Limite", companions_count: 1 });
    await assign(w.paulo, g, t);
    await expect(run(w.pool, w.paulo, `update public.guests set children_count=1 where id=$1`, [g])).rejects.toThrow(/lugares suficientes/);
    expect((await w.pool.query(`select children_count from public.guests where id=$1`, [g])).rows[0].children_count).toBe(0);
    expect((await table(t)).used).toBe(2);
  });
  it("reduzir a capacidade abaixo dos sentados é recusado; reagrupa lugares altos quando possível", async () => {
    const t = await addTable(w, w.paulo, "Capacidade", 6);
    const gs: string[] = [];
    for (const n of ["g1", "g2", "g3", "g4"]) { const id = await addGuest(w, w.paulo, { full_name: n }); await assign(w.paulo, id, t); gs.push(id); }
    await expect(run(w.pool, w.paulo, `update public.tables set capacity=3 where id=$1`, [t])).rejects.toThrow(/tem 4 pessoas sentadas/);
    await run(w.pool, w.paulo, `select public.unassign_guest($1)`, [gs[0]]);
    await run(w.pool, w.paulo, `update public.tables set capacity=3 where id=$1`, [t]);
    expect(await table(t)).toEqual({ capacity: 3, seats: 3, used: 3 });
    expect((await seatsOf(w.pool, gs[3]!))[0]!.seat_number).toBeLessThanOrEqual(3);
  });
  it("apagar uma mesa liberta os convidados (ficam sem mesa) e apaga os lugares", async () => {
    const t = await addTable(w, w.paulo, "Apagar", 4);
    const g = await addGuest(w, w.paulo, { full_name: "Sem mesa", companions_count: 1 });
    await assign(w.paulo, g, t);
    await run(w.pool, w.paulo, `delete from public.tables where id=$1`, [t]);
    expect(await seatsOf(w.pool, g)).toEqual([]);
    expect((await w.pool.query(`select 1 from public.table_seats where table_id=$1`, [t])).rowCount).toBe(0);
    expect((await w.pool.query(`select 1 from public.guests where id=$1`, [g])).rowCount).toBe(1);
  });
});

describe("concorrência: os dois noivos a arrastar ao mesmo tempo", () => {
  it("20 pedidos em simultâneo para uma mesa de 5 lugares: exatamente 5 conseguem", async () => {
    const t = await addTable(w, w.paulo, "Corrida", 5);
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) ids.push(await addGuest(w, i % 2 ? w.ines : w.paulo, { full_name: `Corredor ${i}` }));
    const results = await Promise.allSettled(ids.map((g, i) => assign(i % 2 ? w.ines : w.paulo, g, t)));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(5);
    expect(results.filter((r) => r.status === "rejected").length).toBe(15);
    expect((await table(t)).used).toBe(5);
  });
  it("o mesmo convidado atribuído a 2 mesas em simultâneo acaba numa só", async () => {
    const t1 = await addTable(w, w.paulo, "Dupla-1", 4);
    const t2 = await addTable(w, w.paulo, "Dupla-2", 4);
    const g = await addGuest(w, w.paulo, { full_name: "Disputado", companions_count: 1 });
    await Promise.allSettled([assign(w.paulo, g, t1), assign(w.ines, g, t2), assign(w.paulo, g, t1), assign(w.ines, g, t2)]);
    expect((await w.pool.query(`select distinct table_id from public.guest_seatings where guest_id=$1`, [g])).rows.length).toBe(1);
    expect((await seatsOf(w.pool, g)).length).toBe(2);
  });
});
