import { describe, expect, it } from "vitest";
import { countdown, daysUntil, formatDate, formatShortDate } from "./dates";
import { formatEuro, parseMoney } from "./money";
import { expenseSchema, eventSchema, guestSchema, publicRsvpSchema, signupSchema, taskSchema, tableSchema, vendorSchema, weddingSchema } from "./validation";

describe("dinheiro em euros", () => {
  it.each([["1250", 1250], ["1 250,50", 1250.5], ["1.250,50", 1250.5], ["1,250.50", 1250.5], ["1250.5", 1250.5], ["€ 99", 99], ["0,1", 0.1], ["1.250", 1250], ["12,5", 12.5], ["", null], ["abc", null], ["1,2,3x", null]])("parseMoney(%j) = %j", (i, o) => {
    expect(parseMoney(i as string)).toBe(o);
  });
  it("formata em euros no formato português", () => {
    expect(formatEuro(1234.5).replace(/\s/g, " ")).toBe("1234,50 €");
    expect(formatEuro(null).replace(/\s/g, " ")).toBe("0,00 €");
  });
});

describe("datas e contagem decrescente", () => {
  it("dias até ao casamento (2 de julho de 2027)", () => {
    expect(daysUntil("2027-07-02", new Date(2027, 6, 1))).toBe(1);
    expect(daysUntil("2027-07-02", new Date(2027, 6, 2, 23, 59))).toBe(0);
    expect(daysUntil("2027-07-02", new Date(2026, 6, 2))).toBe(365);
    expect(daysUntil("2027-07-02", new Date(2027, 6, 5))).toBe(-3);
  });
  it("mensagem da contagem", () => {
    expect(countdown("2027-07-02", new Date(2027, 5, 2)).label).toBe("Faltam 30 dias");
    expect(countdown("2027-07-02", new Date(2027, 6, 1)).label).toBe("Falta 1 dia");
    expect(countdown("2027-07-02", new Date(2027, 6, 2)).label).toBe("É hoje!");
    expect(countdown("2027-07-02", new Date(2027, 6, 4))).toMatchObject({ past: true, label: "Passaram 2 dias" });
  });
  it("formata em português", () => {
    expect(formatDate("2027-07-02")).toBe("2 de julho de 2027");
    expect(formatShortDate("2027-07-02")).toBe("02/07/2027");
    expect(formatDate(null)).toBe("—");
  });
});

const guestBase = { full_name: " Maria Silva ", surname: "", phone: "", email: "", group_id: "none", relationship: "", side: "both", category: "outros", age_group: "adulto", companion_names: "", companions_count: "", children_count: "", dietary_restrictions: "", allergies: "", notes: "", invitation_status: "por_convidar", rsvp_status: "sem_resposta" };

describe("validação dos formulários", () => {
  it("convidado: normaliza vazios para null e números", () => {
    const r = guestSchema.parse({ ...guestBase, email: " MARIA@Example.PT ", companions_count: "2" });
    expect(r).toMatchObject({ full_name: "Maria Silva", email: "maria@example.pt", surname: null, group_id: null, companions_count: 2, children_count: 0 });
  });
  it("convidado: rejeita nome vazio, email inválido e contagens fora do intervalo", () => {
    const bad = guestSchema.safeParse({ ...guestBase, full_name: "  ", email: "xx", companions_count: "21", children_count: "-1" });
    expect(bad.success).toBe(false);
    const paths = bad.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["full_name", "email", "companions_count", "children_count"]));
    expect(guestSchema.safeParse({ ...guestBase, side: "x" }).success).toBe(false);
    expect(guestSchema.safeParse({ ...guestBase, companions_count: "1.5" }).success).toBe(false);
  });
  it("casamento: data e orçamento em euros", () => {
    const r = weddingSchema.parse({ name: "O Nosso Casamento", partner1_name: "Paulo", partner2_name: "Inês", wedding_date: "2027-07-02", venue_name: "", total_budget: "25 000,50" });
    expect(r).toMatchObject({ wedding_date: "2027-07-02", venue_name: null, total_budget: 25000.5 });
    expect(weddingSchema.safeParse({ name: "x", partner1_name: "a", partner2_name: "b", wedding_date: "2027-02-30", venue_name: "", total_budget: "0" }).success).toBe(false);
    expect(weddingSchema.safeParse({ name: "x", partner1_name: "a", partner2_name: "b", wedding_date: "2027-07-02", venue_name: "", total_budget: "-5" }).success).toBe(false);
  });
  it("despesa: valores, categoria obrigatória e datas", () => {
    const ok = expenseSchema.parse({ description: "Sinal", category_id: "c1", vendor_id: "none", planned_amount: "1500", paid_amount: "500,25", payment_date: "", due_date: "2027-03-01", notes: "" });
    expect(ok).toMatchObject({ planned_amount: 1500, paid_amount: 500.25, vendor_id: null, payment_date: null, due_date: "2027-03-01" });
    expect(expenseSchema.safeParse({ description: "", category_id: "", planned_amount: "x", paid_amount: "", vendor_id: "", payment_date: "", due_date: "", notes: "" }).success).toBe(false);
  });
  it("tarefa: responsável 'outro' exige nome", () => {
    const base = { title: "Reservar DJ", description: "", category: "", assignee: "other", assignee_other: "", due_date: "", priority: "alta", status: "por_iniciar" };
    expect(taskSchema.safeParse(base).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, assignee_other: "Tia Rosa" }).success).toBe(true);
  });
  it("mesa: capacidade entre 1 e 40", () => {
    const base = { name: "Mesa 1", shape: "redonda", notes: "", width: "120", height: "120" };
    expect(tableSchema.safeParse({ ...base, capacity: "8" }).success).toBe(true);
    for (const bad of ["0", "41", "2.5", "x", ""]) expect(tableSchema.safeParse({ ...base, capacity: bad }).success, bad).toBe(false);
    expect(tableSchema.safeParse({ ...base, capacity: "8", width: "20" }).success).toBe(false);
    expect(tableSchema.safeParse({ ...base, capacity: "8", height: "700" }).success).toBe(false);
  });
  it("fornecedor: email, site e valores opcionais", () => {
    const v = vendorSchema.parse({ company_name: "Foto Arte", service_type: "", contact_name: "", phone: "", email: "", website: "https://foto.pt", quoted_amount: "", contracted_amount: "1.800", status: "contratado", notes: "" });
    expect(v).toMatchObject({ website: "https://foto.pt", quoted_amount: null, contracted_amount: 1800, email: null });
    expect(vendorSchema.safeParse({ ...v, website: "javascript:alert(1)", quoted_amount: "", contracted_amount: "", email: "", service_type: "", contact_name: "", phone: "", notes: "" }).success).toBe(false);
  });
  it("evento: a hora de fim tem de ser depois da de início", () => {
    const base = { title: "Prova", event_type: "prova_roupa", event_date: "2027-03-10", location: "", notes: "", vendor_id: "" };
    expect(eventSchema.safeParse({ ...base, start_time: "10:00", end_time: "11:00" }).success).toBe(true);
    expect(eventSchema.safeParse({ ...base, start_time: "11:00", end_time: "10:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, start_time: "25:00", end_time: "" }).success).toBe(false);
  });
  it("RSVP público: exige escolha e limita textos", () => {
    const base = { status: "confirmado", companions: "0", children: "0", companion_names: "", dietary: "", allergies: "", message: "" };
    expect(publicRsvpSchema.safeParse(base).success).toBe(true);
    expect(publicRsvpSchema.safeParse({ ...base, status: undefined }).success).toBe(false);
    expect(publicRsvpSchema.safeParse({ ...base, message: "x".repeat(1001) }).success).toBe(false);
  });
  it("registo: palavras-passe com 10+ caracteres e iguais", () => {
    expect(signupSchema.safeParse({ email: "a@b.pt", password: "curta", confirm: "curta" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.pt", password: "uma-frase-longa", confirm: "outra-frase-longa" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "A@B.pt", password: "uma-frase-longa", confirm: "uma-frase-longa" }).success).toBe(true);
  });
});
