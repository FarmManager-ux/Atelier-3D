import { describe, expect, it } from "vitest";
import type { Guest, GuestSeating, Invitation, TableRow, TableSeat } from "../db-types";
import { computeGuestStats, computeSeatStats, confirmationEvolution, distribution } from "./stats";
import { buildSeatingView, canFit, missingSeats, seatLabel, seatPositions } from "./seating";
import { followUpState, filterGuests, emptyFilters, normalizeText, personLabel, sortGuests, needsContact } from "./guests";
import { byCategory, computeBudget, overdue } from "./budget";
import { guest } from "./test-helpers";

const table = (id: string, capacity: number, o: Partial<TableRow> = {}): TableRow => ({ id, wedding_id: "w", name: id, shape: "redonda", capacity, x: 0, y: 0, width: 120, height: 120, rotation: 0, notes: null, ...o });

describe("estatísticas de convidados (sempre em pessoas, sem duplicar)", () => {
  const guests = [
    guest({ invitation_status: "por_convidar", companions_count: 1 }),                                                    // 2 pessoas por convidar
    guest({ invitation_status: "enviado", companions_count: 1, children_count: 1 }),                                      // 3, sem resposta
    guest({ invitation_status: "entregue", rsvp_status: "confirmado", companions_count: 2, attending_companions: 1 }),    // convidou 3, vêm 2
    guest({ invitation_status: "entregue", rsvp_status: "nao_vai", companions_count: 1 }),                                // 2 não vão
    guest({ invitation_status: "recusado" }),                                                                              // 1
  ];
  const s = computeGuestStats(guests);
  it("conta registos e pessoas", () => {
    expect(s.totalRecords).toBe(5);
    expect(s.totalPeople).toBe(2 + 3 + 3 + 2 + 1);
  });
  it("pessoas convidadas, por convidar e convites enviados", () => {
    expect(s.invitedPeople).toBe(3 + 3 + 2 + 1);
    expect(s.toInvitePeople).toBe(2);
    expect(s.invitesSent).toBe(4);
    expect(s.invitesToSend).toBe(1);
  });
  it("confirmações, recusas (incluindo acompanhantes que não vêm) e sem resposta", () => {
    expect(s.confirmedPeople).toBe(2);
    expect(s.declinedPeople).toBe(1 + 2);
    expect(s.noReplyPeople).toBe(2 + 3 + 1);
    expect(s.confirmedPeople + s.declinedPeople + s.noReplyPeople).toBe(s.totalPeople); // partição exata
  });
  it("convites pendentes de resposta e taxa de confirmação", () => {
    expect(s.pendingInvites).toBe(2);
    expect(s.confirmationRate).toBeCloseTo(2 / 9);
  });
  it("estado dos convites por registo", () => {
    expect(s.invitationBreakdown).toEqual({ por_convidar: 1, enviado: 1, entregue: 2, recusado: 1 });
  });
  it("sem convidados não divide por zero", () => {
    const e = computeGuestStats([]);
    expect(e.confirmationRate).toBe(0);
    expect(e.totalPeople).toBe(0);
  });
});

describe("distribuição e evolução", () => {
  const labels = { group: [{ id: "a", wedding_id: "w", name: "Família Silva", notes: null, created_at: "" }], side: { partner1: "Paulo", partner2: "Inês", both: "Ambos" }, category: { familia: "Família", amigos: "Amigos", trabalho: "Trabalho", outros: "Outros" } };
  it("distribui pessoas por categoria, grupo e lado", () => {
    const gs = [guest({ category: "familia", group_id: "a", side: "partner1", companions_count: 1 }), guest({ category: "amigos", group_id: "a", side: "partner2" }), guest({ category: "familia" })];
    expect(distribution(gs, "category", labels).map((d) => [d.label, d.people])).toEqual([["Família", 3], ["Amigos", 1]]);
    expect(distribution(gs, "group", labels).map((d) => [d.label, d.people])).toEqual([["Família Silva", 3], ["Sem grupo", 1]]);
    expect(distribution(gs, "side", labels).map((d) => [d.label, d.people])).toEqual([["Paulo", 2], ["Ambos", 1], ["Inês", 1]]);
  });
  it("evolução acumulada das confirmações por dia", () => {
    const a = guest({ rsvp_status: "confirmado", companions_count: 1 }), b = guest({ rsvp_status: "confirmado" }), c = guest({ rsvp_status: "nao_vai" });
    const inv = (g: Guest, at: string | null): Invitation => ({ id: `i${g.id}`, wedding_id: "w", guest_id: g.id, token: "t", rsvp_enabled: true, channel: null, sent_at: null, delivered_at: null, responded_at: at, last_contacted_at: null, notes: null });
    const out = confirmationEvolution([a, b, c], [inv(a, "2027-01-02T10:00:00"), inv(b, "2027-01-05T10:00:00"), inv(c, "2027-01-06T10:00:00")]);
    expect(out).toEqual([{ date: "2027-01-02", people: 2 }, { date: "2027-01-05", people: 3 }]);
  });
});

describe("vista de mesas", () => {
  const t1 = table("t1", 4), t2 = table("t2", 2);
  const g1 = guest({ companions_count: 1 }), g2 = guest(), g3 = guest({ rsvp_status: "nao_vai" }), g4 = guest({ companions_count: 2 });
  const seats: TableSeat[] = [1, 2, 3, 4].map((i) => ({ id: `s${i}`, table_id: "t1", wedding_id: "w", seat_number: i }));
  const seatings: GuestSeating[] = [
    { id: "x1", wedding_id: "w", guest_id: g1.id, table_id: "t1", seat_id: "s1", person_index: 0 },
    { id: "x2", wedding_id: "w", guest_id: g1.id, table_id: "t1", seat_id: "s2", person_index: 1 },
    { id: "x3", wedding_id: "w", guest_id: g2.id, table_id: "t1", seat_id: "s4", person_index: 0 },
  ];
  const view = buildSeatingView([t1, t2], [g1, g2, g3, g4], seatings, seats);
  it("calcula lugares ocupados, livres e a lista de convidados por mesa", () => {
    const s = view.byId.get("t1")!;
    expect([s.used, s.free, s.full]).toEqual([3, 1, false]);
    expect(s.guests.map((x) => [x.guest.id, x.seatNumbers])).toEqual([[g1.id, [1, 2]], [g2.id, [4]]]);
  });
  it("identifica convidados sem mesa (exclui quem não vai)", () => {
    expect(view.unseated.map((g) => g.id)).toEqual([g4.id]);
  });
  it("verifica se um convidado cabe e quantos lugares faltam", () => {
    const s2 = view.byId.get("t2")!;
    expect(canFit(s2, g4)).toBe(false);
    expect(missingSeats(s2, g4)).toBe(1);
    expect(canFit(s2, g2)).toBe(true);
    expect(canFit(view.byId.get("t1")!, g1, true)).toBe(true);
  });
  it("estatísticas de lugares", () => {
    const st = computeSeatStats([t1, t2], seatings, [g1, g2, g3, g4]);
    expect(st).toMatchObject({ tables: 2, capacity: 6, occupied: 3, free: 3, unseatedPeople: 3, unseatedGuests: 1, fullTables: 0 });
  });
  it("etiquetas de lugares e posições à volta da mesa", () => {
    expect(seatLabel([3, 1, 2])).toBe("1–3");
    expect(seatLabel([1, 4])).toBe("1, 4");
    expect(seatLabel([])).toBe("—");
    for (const shape of ["redonda", "retangular", "quadrada"] as const) {
      for (const cap of [1, 2, 5, 8, 11]) expect(seatPositions(shape, cap), `${shape} ${cap}`).toHaveLength(cap);
    }
  });
});

describe("filtros, ordenação e acompanhamento", () => {
  const a = guest({ full_name: "Ana Pereira", email: "ana@x.pt", group_id: "g", side: "partner1", invitation_status: "enviado" });
  const b = guest({ full_name: "Bruno Álvaro", phone: "912", side: "partner2", rsvp_status: "confirmado", invitation_status: "entregue" });
  const c = guest({ full_name: "Carla Zé", side: "both" });
  const tableOf = new Map([[a.id, "t1"]]);
  it("pesquisa sem distinguir acentos nem maiúsculas", () => {
    expect(filterGuests([a, b, c], { ...emptyFilters, search: "alvaro" }, tableOf)).toEqual([b]);
    expect(filterGuests([a, b, c], { ...emptyFilters, search: "ANA@X" }, tableOf)).toEqual([a]);
    expect(normalizeText("  Éé  Ã ")).toBe("ee a");
  });
  it("filtra por grupo, lado, estado do convite, presença e mesa", () => {
    expect(filterGuests([a, b, c], { ...emptyFilters, groupId: "g" }, tableOf)).toEqual([a]);
    expect(filterGuests([a, b, c], { ...emptyFilters, groupId: "none" }, tableOf)).toEqual([b, c]);
    expect(filterGuests([a, b, c], { ...emptyFilters, side: "partner2" }, tableOf)).toEqual([b]);
    expect(filterGuests([a, b, c], { ...emptyFilters, invitation: "entregue" }, tableOf)).toEqual([b]);
    expect(filterGuests([a, b, c], { ...emptyFilters, rsvp: "confirmado" }, tableOf)).toEqual([b]);
    expect(filterGuests([a, b, c], { ...emptyFilters, table: "t1" }, tableOf)).toEqual([a]);
    expect(filterGuests([a, b, c], { ...emptyFilters, table: "none" }, tableOf)).toEqual([b, c]);
  });
  it("combina filtros", () => {
    expect(filterGuests([a, b, c], { ...emptyFilters, side: "partner2", rsvp: "confirmado", search: "bruno" }, tableOf)).toEqual([b]);
    expect(filterGuests([a, b, c], { ...emptyFilters, side: "partner1", rsvp: "confirmado" }, tableOf)).toEqual([]);
  });
  it("ordena por colunas nos dois sentidos", () => {
    const ctx = { groupName: () => "", tableName: (id: string) => (id === a.id ? "Mesa 1" : "") };
    expect(sortGuests([c, a, b], "full_name", "asc", ctx).map((g) => g.full_name)).toEqual(["Ana Pereira", "Bruno Álvaro", "Carla Zé"]);
    expect(sortGuests([c, a, b], "full_name", "desc", ctx)[0]).toBe(c);
    expect(sortGuests([c, a, b], "rsvp_status", "desc", ctx)[0]).toBe(b);
    expect(sortGuests([c, b, a], "table", "asc", ctx)[0]).toBe(a);
  });
  it("quem ainda precisa de ser contactado", () => {
    const now = new Date("2027-03-20T12:00:00Z");
    const inv = (sent: string): Invitation => ({ id: "i", wedding_id: "w", guest_id: "g", token: "t", rsvp_enabled: true, channel: null, sent_at: sent, delivered_at: null, responded_at: null, last_contacted_at: null, notes: null });
    expect(followUpState(c, undefined, now)).toBe("to_invite");
    expect(followUpState(a, inv("2027-03-01T00:00:00Z"), now)).toBe("to_follow_up");
    expect(followUpState(a, inv("2027-03-18T00:00:00Z"), now)).toBe("waiting");
    expect(followUpState(b, undefined, now)).toBe("done");
    expect(needsContact(c, undefined, now)).toBe(true);
    expect(needsContact(b, undefined, now)).toBe(false);
  });
  it("etiqueta das pessoas de um registo", () => {
    expect(personLabel({ full_name: "Maria", companion_names: "João, Rita" }, 0)).toBe("Maria");
    expect(personLabel({ full_name: "Maria", companion_names: "João, Rita" }, 2)).toBe("Rita");
    expect(personLabel({ full_name: "Maria", companion_names: null }, 1)).toBe("Maria +1");
  });
});

describe("orçamento", () => {
  const exp = (o: Record<string, unknown>) => ({ id: "e", wedding_id: "w", category_id: "c1", vendor_id: null, description: "x", planned_amount: 0, paid_amount: 0, payment_status: "por_pagar", payment_date: null, due_date: null, notes: null, ...o }) as never;
  const list = [exp({ planned_amount: 1000, paid_amount: 400, due_date: "2027-01-01" }), exp({ category_id: "c2", planned_amount: 500, paid_amount: 500 }), exp({ planned_amount: 100, paid_amount: 150 })];
  it("totais: previsto, pago, por pagar e diferença para o orçamento", () => {
    const s = computeBudget(2000, list);
    expect(s).toMatchObject({ planned: 1600, paid: 1050, toPay: 600, difference: 400, remainingAfterPaid: 950, overBudget: false });
    expect(s.usedShare).toBeCloseTo(0.8);
    expect(computeBudget(1000, list)).toMatchObject({ difference: -600, overBudget: true });
    expect(computeBudget(0, []).usedShare).toBe(0);
  });
  it("evita erros de vírgula flutuante", () => {
    expect(computeBudget(100, [exp({ planned_amount: 0.1, paid_amount: 0.1 }), exp({ planned_amount: 0.2, paid_amount: 0.2 })]).paid).toBe(0.3);
  });
  it("por categoria e pagamentos em atraso", () => {
    const cats = [{ id: "c1", wedding_id: "w", name: "Catering", planned_budget: 1000, sort_order: 1 }, { id: "c2", wedding_id: "w", name: "Música", planned_budget: 0, sort_order: 2 }];
    const r = byCategory(cats, list);
    expect(r[0]).toMatchObject({ planned: 1100, paid: 550, toPay: 600, count: 2, overAllotment: true });
    expect(r[1]).toMatchObject({ planned: 500, count: 1, overAllotment: false });
    expect(overdue(list, "2027-02-01")).toHaveLength(1);
    expect(overdue(list, "2026-12-31")).toHaveLength(0);
  });
});
