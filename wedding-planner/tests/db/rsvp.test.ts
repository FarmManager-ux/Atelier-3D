import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addGuest, addTable, asUser, createWorld, run, seatsOf, type World } from "./fixtures";

let w: World;
beforeAll(async () => { w = await createWorld(); });
afterAll(async () => { await w?.drop(); });

const tokenOf = async (guest: string) => (await w.pool.query(`select token from public.invitations where guest_id=$1`, [guest])).rows[0].token as string;
const anon = (sql: string, params: unknown[] = []) => asUser(w.pool, null, (q) => q(sql, params), { commit: true });
const guestRow = async (id: string) => (await w.pool.query(`select * from public.guests where id=$1`, [id])).rows[0];

describe("RSVP público por token", () => {
  it("o convidado vê só o necessário: casamento, o seu nome e os acompanhantes autorizados", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Ana Reis", phone: "911111111", email: "ana@example.test", notes: "nota privada", companions_count: 1, children_count: 2, allergies: "Marisco" });
    const r = (await anon(`select public.get_rsvp_invitation($1) p`, [await tokenOf(g)])).rows[0].p;
    expect(r.wedding).toMatchObject({ name: "O Nosso Casamento", partner1: "Paulo", partner2: "Inês", date: "2027-07-02" });
    expect(r.guest).toMatchObject({ name: "Ana Reis", authorized_companions: 1, authorized_children: 2 });
    const flat = JSON.stringify(r);
    for (const secret of ["911111111", "ana@example.test", "nota privada", w.wedding, g]) expect(flat).not.toContain(secret);
  });
  it("confirma presença, acompanhantes e restrições: atualiza a área privada automaticamente", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Confirma", companions_count: 2, children_count: 1, invitation_status: "enviado" });
    const t = await tokenOf(g);
    const out = (await anon(`select public.submit_rsvp($1,'confirmado',1,1,'Rui Reis','Vegetariano','Glúten','Contamos convosco!') p`, [t])).rows[0].p;
    expect(out.current).toMatchObject({ status: "confirmado", companions: 1, children: 1 });
    const gr = await guestRow(g);
    expect(gr).toMatchObject({ rsvp_status: "confirmado", invitation_status: "entregue", attending_companions: 1, attending_children: 1,
      companion_names: "Rui Reis", dietary_restrictions: "Vegetariano", allergies: "Glúten", invited_count: 4, expected_count: 3 });
    const resp = (await w.pool.query(`select * from public.rsvp_responses where guest_id=$1`, [g])).rows;
    expect(resp).toHaveLength(1);
    expect(resp[0]).toMatchObject({ status: "confirmado", message: "Contamos convosco!", source: "link" });
    expect((await w.pool.query(`select responded_at from public.invitations where guest_id=$1`, [g])).rows[0].responded_at).not.toBeNull();
  });
  it("recusa presença; pode mudar de ideias; fica o histórico", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Indecisa", companions_count: 1 });
    const t = await tokenOf(g);
    await anon(`select public.submit_rsvp($1,'nao_vai')`, [t]);
    expect((await guestRow(g)).rsvp_status).toBe("nao_vai");
    expect((await guestRow(g)).expected_count).toBe(0);
    await anon(`select public.submit_rsvp($1,'confirmado',1,0)`, [t]);
    expect((await guestRow(g)).rsvp_status).toBe("confirmado");
    expect((await w.pool.query(`select count(*)::int n from public.rsvp_responses where guest_id=$1`, [g])).rows[0].n).toBe(2);
  });
  it("não aceita mais acompanhantes ou crianças do que os autorizados", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Limite", companions_count: 1, children_count: 0 });
    const t = await tokenOf(g);
    await expect(anon(`select public.submit_rsvp($1,'confirmado',2,0)`, [t])).rejects.toThrow(/acompanhantes inválido \(máximo 1\)/);
    await expect(anon(`select public.submit_rsvp($1,'confirmado',0,1)`, [t])).rejects.toThrow(/crianças inválido \(máximo 0\)/);
    await expect(anon(`select public.submit_rsvp($1,'confirmado',-1,0)`, [t])).rejects.toThrow(/inválido/);
    expect((await guestRow(g)).rsvp_status).toBe("sem_resposta");
  });
  it("rejeita respostas inválidas", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Inválida" });
    await expect(anon(`select public.submit_rsvp($1,'talvez',0,0)`, [await tokenOf(g)])).rejects.toThrow(/Resposta inválida/);
    await expect(anon(`select public.submit_rsvp($1,'sem_resposta',0,0)`, [await tokenOf(g)])).rejects.toThrow(/Resposta inválida/);
  });
  it("tokens inválidos, vazios ou adivinhados nunca funcionam", async () => {
    for (const bad of ["", "x", "0".repeat(36), "' or 1=1 --", "a".repeat(500)]) {
      await expect(anon(`select public.get_rsvp_invitation($1)`, [bad]), bad.slice(0, 10)).rejects.toThrow(/inválido ou desativado/);
      await expect(anon(`select public.submit_rsvp($1,'confirmado',0,0)`, [bad])).rejects.toThrow(/inválido ou desativado/);
    }
  });
  it("um token só altera o seu convidado (nunca os outros)", async () => {
    const a = await addGuest(w, w.paulo, { full_name: "Convidado A", companions_count: 1 });
    const b = await addGuest(w, w.paulo, { full_name: "Convidado B", companions_count: 1 });
    const before = await guestRow(b);
    await anon(`select public.submit_rsvp($1,'confirmado',1,0,'Nome','Dieta','Alergia','Msg')`, [await tokenOf(a)]);
    const after = await guestRow(b);
    expect(after).toEqual(before);
    expect((await w.pool.query(`select count(*)::int n from public.rsvp_responses where guest_id=$1`, [b])).rows[0].n).toBe(0);
  });
  it("o token de um casamento não acede a dados de outro", async () => {
    const mine = await addGuest(w, w.paulo, { full_name: "Meu" });
    const theirs = await addGuest(w, w.other, { full_name: "Deles" }, w.otherWedding);
    const p = (await anon(`select public.get_rsvp_invitation($1) p`, [await tokenOf(theirs)])).rows[0].p;
    expect(p.wedding.name).toBe("Casamento Alheio");
    expect(JSON.stringify(p)).not.toContain(mine);
  });
  it("link desativado ou regenerado deixa de funcionar", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Revogado" });
    const old = await tokenOf(g);
    await run(w.pool, w.paulo, `update public.invitations set rsvp_enabled=false where guest_id=$1`, [g]);
    await expect(anon(`select public.get_rsvp_invitation($1)`, [old])).rejects.toThrow(/inválido ou desativado/);
    await run(w.pool, w.paulo, `update public.invitations set rsvp_enabled=true where guest_id=$1`, [g]);
    const fresh = (await run(w.pool, w.ines, `select public.regenerate_rsvp_token($1) t`, [g]))[0].t;
    expect(fresh).not.toBe(old);
    await expect(anon(`select public.get_rsvp_invitation($1)`, [old])).rejects.toThrow(/inválido ou desativado/);
    await expect(anon(`select public.get_rsvp_invitation($1)`, [fresh])).resolves.toBeDefined();
    await expect(asUser(w.pool, w.outsider, (q) => q(`select public.regenerate_rsvp_token($1)`, [g]))).rejects.toThrow(/Sem permissão/);
    await expect(asUser(w.pool, null, (q) => q(`select public.regenerate_rsvp_token($1)`, [g]))).rejects.toThrow(/permission denied/);
  });
  it("o token só pode ser alterado por RPC (não por UPDATE direto)", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Token" });
    await expect(asUser(w.pool, w.paulo, (q) => q(`update public.invitations set token='fixo' where guest_id=$1`, [g]))).rejects.toThrow(/permission denied/);
  });
  it("travão contra abuso: no máximo 30 respostas por link", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Spam" });
    const t = await tokenOf(g);
    for (let i = 0; i < 30; i++) await anon(`select public.submit_rsvp($1,'nao_vai')`, [t]);
    await expect(anon(`select public.submit_rsvp($1,'nao_vai')`, [t])).rejects.toThrow(/Demasiadas respostas/);
  });
  it("anónimos não leem tabelas nem alteram convidados diretamente", async () => {
    for (const t of ["guests", "invitations", "rsvp_responses", "weddings"]) {
      await expect(asUser(w.pool, null, (q) => q(`select * from public.${t}`))).rejects.toThrow(/permission denied/);
    }
    await expect(asUser(w.pool, null, (q) => q(`update public.guests set rsvp_status='confirmado'`))).rejects.toThrow(/permission denied/);
  });
  it("anónimos não executam RPC privadas", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Privada" });
    await expect(asUser(w.pool, null, (q) => q(`select public.record_manual_rsvp($1,'confirmado')`, [g]))).rejects.toThrow(/permission denied/);
    await expect(asUser(w.pool, null, (q) => q(`select app_private.apply_rsvp($1,'confirmado',0,0,null,null,null,null,'link')`, [g]))).rejects.toThrow(/permission denied/);
  });
  it("registo manual (por telefone) por um dos noivos: valida, grava e exige ser membro", async () => {
    const g = await addGuest(w, w.paulo, { full_name: "Telefonou", companions_count: 1 });
    await run(w.pool, w.ines, `select public.record_manual_rsvp($1,'confirmado',1,0,'Vegano',null,'Ligou ao Paulo')`, [g]);
    expect((await guestRow(g)).dietary_restrictions).toBe("Vegano");
    expect((await w.pool.query(`select source, message from public.rsvp_responses where guest_id=$1`, [g])).rows[0]).toEqual({ source: "manual", message: "Ligou ao Paulo" });
    await expect(asUser(w.pool, w.outsider, (q) => q(`select public.record_manual_rsvp($1,'nao_vai')`, [g]))).rejects.toThrow(/Sem permissão/);
    await expect(asUser(w.pool, w.paulo, (q) => q(`insert into public.rsvp_responses (wedding_id, guest_id, status, source) values ($1,$2,'confirmado','link')`, [w.wedding, g]))).rejects.toThrow(/row-level security/);
  });
});

describe("RSVP e mesas", () => {
  it("quem recusa pelo link perde a mesa; quem aumenta sem haver lugar fica sem mesa (sem falhar)", async () => {
    const t = await addTable(w, w.paulo, "Mesa RSVP", 3);
    const a = await addGuest(w, w.paulo, { full_name: "Recusa", companions_count: 1 });
    await run(w.pool, w.paulo, `select public.assign_guest_to_table($1,$2)`, [a, t]);
    await anon(`select public.submit_rsvp($1,'nao_vai')`, [await tokenOf(a)]);
    expect(await seatsOf(w.pool, a)).toEqual([]);

    // b ocupa 1 lugar (confirmou só ele); depois confirma o acompanhante, mas a mesa já está cheia com o resto
    const b = await addGuest(w, w.paulo, { full_name: "Cresce", companions_count: 1 });
    await run(w.pool, w.paulo, `select public.record_manual_rsvp($1,'confirmado',0,0)`, [b]);
    await run(w.pool, w.paulo, `select public.assign_guest_to_table($1,$2)`, [b, t]);
    const filler = await addGuest(w, w.paulo, { full_name: "Enche", companions_count: 1 });
    await run(w.pool, w.paulo, `select public.assign_guest_to_table($1,$2)`, [filler, t]);   // 1 + 2 = 3 lugares: cheia
    await anon(`select public.submit_rsvp($1,'confirmado',1,0)`, [await tokenOf(b)]);        // precisaria de 2: não cabe
    expect((await guestRow(b)).rsvp_status).toBe("confirmado");
    expect(await seatsOf(w.pool, b)).toEqual([]);
    expect((await seatsOf(w.pool, filler)).length).toBe(2);
  });
  it("registo manual que ultrapassa a capacidade é recusado e nada muda", async () => {
    const t = await addTable(w, w.paulo, "Mesa Manual", 2);
    const g = await addGuest(w, w.paulo, { full_name: "Manual", companions_count: 1 });
    await run(w.pool, w.paulo, `select public.record_manual_rsvp($1,'confirmado',0,0)`, [g]);
    await run(w.pool, w.paulo, `select public.assign_guest_to_table($1,$2)`, [g, t]);
    const other = await addGuest(w, w.paulo, { full_name: "Outro" });
    await run(w.pool, w.paulo, `select public.assign_guest_to_table($1,$2)`, [other, t]);
    await expect(run(w.pool, w.paulo, `select public.record_manual_rsvp($1,'confirmado',1,0)`, [g])).rejects.toThrow(/lugares suficientes/);
    expect((await guestRow(g)).attending_companions).toBe(0);
  });
});
