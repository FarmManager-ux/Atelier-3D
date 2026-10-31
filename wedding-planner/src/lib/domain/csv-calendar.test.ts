import { describe, expect, it } from "vitest";
import type { CalendarEvent, Expense, Task, Wedding } from "../db-types";
import { guest } from "./test-helpers";
import { buildCalendarItems, itemsByDate, monthMatrix } from "./calendar";
import { GUEST_COLUMNS, columnForHeader, guestsToRows, parseCategory, parseGuestRows, parseInvitation, parseRsvp, parseSide, toCsv } from "./csv";

const w = { partner1_name: "Paulo", partner2_name: "Inês" };

describe("importação de convidados (CSV/Excel)", () => {
  it("reconhece cabeçalhos em português, com variantes e sem acentos", () => {
    expect(columnForHeader("Nome completo")).toBe("full_name");
    expect(columnForHeader("NOME")).toBe("full_name");
    expect(columnForHeader("Telemóvel")).toBe("phone");
    expect(columnForHeader("N.º acompanhantes")).toBe("companions_count");
    expect(columnForHeader("Nº crianças")).toBe("children_count");
    expect(columnForHeader("Presença")).toBe("rsvp_status");
    expect(columnForHeader("coluna estranha")).toBeUndefined();
  });
  it("converte valores textuais nos estados da aplicação", () => {
    expect(parseSide("inês", w)).toBe("partner2");
    expect(parseSide("Paulo", w)).toBe("partner1");
    expect(parseSide("ambos", w)).toBe("both");
    expect(parseSide("", w)).toBe("both");
    expect(parseSide("outro", w)).toBeNull();
    expect(parseCategory("Família")).toBe("familia");
    expect(parseCategory("Colegas")).toBe("trabalho");
    expect(parseInvitation("Convite enviado")).toBe("enviado");
    expect(parseInvitation("")).toBe("por_convidar");
    expect(parseInvitation("???")).toBeNull();
    expect(parseRsvp("Não vai comparecer")).toBe("nao_vai");
    expect(parseRsvp("Sim")).toBe("confirmado");
    expect(parseRsvp("")).toBe("sem_resposta");
  });
  it("valida linha a linha: aceita as boas, rejeita as más com a mensagem e o número da linha", () => {
    const rows = [
      { "Nome completo": "Ana Reis", Lado: "Inês", Categoria: "Amigos", "N.º acompanhantes": "1", Email: "ana@x.pt", "Grupo/Família": "Reis" },
      { "Nome completo": "", Lado: "Paulo" },
      { "Nome completo": "Rui", Lado: "Marte" },
      { "Nome completo": "Eva", "N.º crianças": "99" },
      { "Nome completo": "Zé", Email: "mau" },
      { "Nome completo": "", Lado: "" },
    ];
    const r = parseGuestRows(rows, w, []);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.guest).toMatchObject({ full_name: "Ana Reis", side: "partner2", category: "amigos", companions_count: 1, email: "ana@x.pt", invitation_status: "por_convidar", rsvp_status: "sem_resposta" });
    expect(r.rows[0]!.groupName).toBe("Reis");
    expect(r.errors.map((e) => e.rowNumber)).toEqual([3, 4, 5, 6]);
    expect(r.errors[0]!.message).toMatch(/nome/i);
    expect(r.errors[1]!.message).toMatch(/Lado inválido/);
    expect(r.errors[2]!.message).toMatch(/crianças inválido/);
    expect(r.errors[3]!.message).toMatch(/Email inválido/);
    expect(r.newGroups).toEqual(["Reis"]);
  });
  it("assinala duplicados (já existentes ou repetidos no ficheiro)", () => {
    const existing = [guest({ full_name: "Maria Costa", phone: "911" })];
    const r = parseGuestRows([{ Nome: "Maria Costa", Telefone: "911" }, { Nome: "João", Telefone: "" }, { Nome: "João", Telefone: "" }], w, existing);
    expect(r.rows.map((x) => x.duplicate)).toEqual([true, false, true]);
  });
  it("sem coluna de nome não importa nada", () => {
    const r = parseGuestRows([{ Telefone: "1" }], w, []);
    expect(r.missingNameColumn).toBe(true);
    expect(r.rows).toEqual([]);
  });
  it("lista cabeçalhos desconhecidos para avisar o utilizador", () => {
    expect(parseGuestRows([{ Nome: "A", Cor: "azul" }], w, []).unknownHeaders).toEqual(["Cor"]);
  });
});

describe("exportação de convidados", () => {
  it("exporta todos os campos com os cabeçalhos pedidos e volta a poder ser importada (ida e volta)", () => {
    const g = guest({ full_name: "Rita Sá", side: "partner1", category: "familia", companions_count: 2, children_count: 1, invitation_status: "entregue", rsvp_status: "confirmado", companion_names: "Rui; Eva", dietary_restrictions: "Vegan", allergies: "Nozes", group_id: "grp" });
    const rows = guestsToRows([g], { wedding: w, groups: [{ id: "grp", wedding_id: "w", name: "Sá", notes: null, created_at: "" }], tableOf: () => "Mesa 3", seatsOf: () => "1–4" });
    expect(Object.keys(rows[0]!)).toEqual(GUEST_COLUMNS.map((c) => c.header));
    expect(rows[0]).toMatchObject({ "Nome completo": "Rita Sá", Lado: "Paulo", Categoria: "Família", "Estado do convite": "Convite entregue", Presença: "Confirmado", Mesa: "Mesa 3", Lugares: "1–4", "Grupo/Família": "Sá" });
    const back = parseGuestRows(rows, w, []);
    expect(back.errors).toEqual([]);
    expect(back.rows[0]!.guest).toMatchObject({ full_name: "Rita Sá", side: "partner1", category: "familia", companions_count: 2, children_count: 1, invitation_status: "entregue", rsvp_status: "confirmado" });
  });
  it("CSV com ';', BOM UTF-8, aspas escapadas e proteção contra fórmulas", () => {
    const csv = toCsv([{ "Nome completo": 'Ana "A" Reis; Jr', Telefone: "=1+1", Email: "-5" }], ["Nome completo", "Telefone", "Email"]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Ana ""A"" Reis; Jr"');
    expect(csv).toContain("'=1+1");
    expect(csv.split("\r\n")[1]).toMatch(/;'=1\+1;-5$/);
  });
});

describe("calendário", () => {
  const wedding = { id: "w", name: "N", partner1_name: "Paulo", partner2_name: "Inês", wedding_date: "2027-07-02" } as Wedding;
  const ev = (o: Partial<CalendarEvent>): CalendarEvent => ({ id: "e1", wedding_id: "w", title: "Prova do fato", event_type: "prova_roupa", event_date: "2027-03-10", start_time: "15:00:00", end_time: null, location: "Alfaiate", notes: null, vendor_id: null, ...o });
  const task = (o: Partial<Task>): Task => ({ id: "t1", wedding_id: "w", title: "Escolher bolo", description: null, category: "Festa", assignee: "both", assignee_other: null, due_date: "2027-03-10", priority: "media", status: "por_iniciar", completed_at: null, ...o });
  const exp = (o: Partial<Expense>): Expense => ({ id: "x1", wedding_id: "w", category_id: "c", vendor_id: null, description: "Sinal quinta", planned_amount: 500, paid_amount: 0, payment_status: "por_pagar", payment_date: null, due_date: "2027-03-01", notes: null, ...o });
  it("junta eventos, tarefas, pagamentos e o dia do casamento", () => {
    const items = buildCalendarItems({ events: [ev({})], tasks: [task({}), task({ id: "t2", due_date: null }), task({ id: "t3", status: "concluida", due_date: "2027-02-01" })], expenses: [exp({}), exp({ id: "x2", paid_amount: 500, payment_date: "2027-02-15", due_date: "2027-02-10" })], wedding });
    expect(items.map((i) => `${i.date} ${i.source} ${i.title}`)).toEqual([
      "2027-02-01 task Escolher bolo",
      "2027-02-15 expense Pago: Sinal quinta",
      "2027-03-01 expense Pagar: Sinal quinta",
      "2027-03-10 event Prova do fato",
      "2027-03-10 task Escolher bolo",
      "2027-07-02 wedding Paulo & Inês: o grande dia",
    ]);
    expect(items.find((i) => i.id === "task:t3")!.done).toBe(true);
    expect(items.find((i) => i.source === "event")!.time).toBe("15:00");
  });
  it("agrupa por data e gera semanas completas começando à segunda-feira", () => {
    const items = buildCalendarItems({ events: [ev({}), ev({ id: "e2", title: "Outra" })], tasks: [], expenses: [], wedding });
    expect(itemsByDate(items).get("2027-03-10")).toHaveLength(2);
    const weeks = monthMatrix(new Date(2027, 6, 1)); // julho de 2027
    expect(weeks.every((wk) => wk.length === 7)).toBe(true);
    expect(weeks[0]![0]!.getDay()).toBe(1);
    expect(weeks.flat().some((d) => d.getMonth() === 6 && d.getDate() === 2)).toBe(true);
  });
});
