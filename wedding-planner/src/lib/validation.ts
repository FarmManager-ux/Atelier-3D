import { isValid, parseISO } from "date-fns";
import { z } from "zod";
import { parseMoney } from "./money";

/** Mensagens em português de Portugal para todos os formulários. */
const M = {
  required: "Campo obrigatório.",
  tooLong: (n: number) => `Máximo de ${n} caracteres.`,
  email: "Indique um email válido.",
  url: "Indique um endereço começado por http:// ou https://.",
  date: "Indique uma data válida.",
  money: "Indique um valor em euros válido (ex.: 1250,50).",
  moneyNeg: "O valor não pode ser negativo.",
  int: "Indique um número inteiro.",
};

const text = (max: number) => z.string().trim().max(max, M.tooLong(max));
const reqText = (max: number) => z.string().trim().min(1, M.required).max(max, M.tooLong(max));
/** Texto opcional: vazio → null. */
const optText = (max: number) => text(max).transform((v) => (v === "" ? null : v));

export const emailField = z.string().trim().toLowerCase().min(1, M.required).max(254, M.tooLong(254)).pipe(z.email(M.email));
const optEmail = z.string().trim().toLowerCase().max(254, M.tooLong(254))
  .refine((v) => v === "" || z.email().safeParse(v).success, M.email).transform((v) => (v === "" ? null : v));
const optUrl = z.string().trim().max(300, M.tooLong(300))
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), M.url).transform((v) => (v === "" ? null : v));
const dateField = z.string().trim().min(1, M.required).refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && isValid(parseISO(v)), M.date);
const optDate = z.string().trim().refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && isValid(parseISO(v))), M.date).transform((v) => (v === "" ? null : v));
const timeField = z.string().trim().refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Hora inválida (hh:mm).").transform((v) => (v === "" ? null : v));
const money = z.string().trim().transform((v, ctx) => {
  const n = parseMoney(v === "" ? "0" : v);
  if (n === null) { ctx.addIssue({ code: "custom", message: M.money }); return z.NEVER; }
  if (n < 0) { ctx.addIssue({ code: "custom", message: M.moneyNeg }); return z.NEVER; }
  return n;
});
const optMoney = z.string().trim().transform((v, ctx) => {
  if (v === "") return null;
  const n = parseMoney(v);
  if (n === null) { ctx.addIssue({ code: "custom", message: M.money }); return z.NEVER; }
  if (n < 0) { ctx.addIssue({ code: "custom", message: M.moneyNeg }); return z.NEVER; }
  return n;
});
const count = (max = 20) => z.string().trim().transform((v, ctx) => {
  const n = v === "" ? 0 : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) { ctx.addIssue({ code: "custom", message: `Indique um número entre 0 e ${max}.` }); return z.NEVER; }
  return n;
});

// --------------------------------------------------------------- autenticação
export const loginSchema = z.object({ email: emailField, password: z.string().min(1, M.required).max(128) });
export const signupSchema = z.object({
  email: emailField,
  password: z.string().min(10, "A palavra-passe deve ter pelo menos 10 caracteres.").max(128),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As palavras-passe não coincidem." });
export const recoverSchema = z.object({ email: emailField });
export const resetSchema = z.object({
  password: z.string().min(10, "A palavra-passe deve ter pelo menos 10 caracteres.").max(128),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As palavras-passe não coincidem." });

// ------------------------------------------------------------------ casamento
export const weddingSchema = z.object({
  name: reqText(120), partner1_name: reqText(60), partner2_name: reqText(60),
  wedding_date: dateField, venue_name: optText(200), total_budget: money,
});
export const setupSchema = z.object({ name: reqText(120), partner1_name: reqText(60), partner2_name: reqText(60), wedding_date: dateField });
export const inviteMemberSchema = z.object({ email: emailField });

// ------------------------------------------------------------------ convidados
export const guestSchema = z.object({
  full_name: reqText(160),
  surname: optText(100),
  phone: optText(40),
  email: optEmail,
  group_id: z.string().transform((v) => (v === "" || v === "none" ? null : v)),
  relationship: optText(120),
  side: z.enum(["partner1", "partner2", "both"]),
  category: z.enum(["familia", "amigos", "trabalho", "outros"]),
  age_group: z.enum(["adulto", "crianca"]),
  companion_names: optText(500),
  companions_count: count(),
  children_count: count(),
  dietary_restrictions: optText(500),
  allergies: optText(500),
  notes: optText(2000),
  invitation_status: z.enum(["por_convidar", "enviado", "entregue", "recusado"]),
  rsvp_status: z.enum(["sem_resposta", "confirmado", "nao_vai"]),
});
export type GuestFormInput = z.input<typeof guestSchema>;
export type GuestFormOutput = z.output<typeof guestSchema>;

export const groupSchema = z.object({ name: reqText(120), notes: optText(1000) });

export const invitationSchema = z.object({
  channel: z.enum(["none", "whatsapp", "email", "mao", "correio", "outro"]).transform((v) => (v === "none" ? null : v)),
  sent_at: optDate, delivered_at: optDate, last_contacted_at: optDate, notes: optText(1000),
});

export const manualRsvpSchema = z.object({
  status: z.enum(["confirmado", "nao_vai"]),
  companions: count(), children: count(),
  dietary: optText(500), allergies: optText(500), message: optText(1000),
});

/** Formulário público de RSVP (o convidado). */
export const publicRsvpSchema = z.object({
  status: z.enum(["confirmado", "nao_vai"], { error: "Escolha se vai estar presente." }),
  companions: count(), children: count(),
  companion_names: text(500), dietary: text(500), allergies: text(500), message: text(1000),
});

// --------------------------------------------------------------------- mesas
const sizeField = z.string().trim().transform((v, ctx) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 40 || n > 600) { ctx.addIssue({ code: "custom", message: "O tamanho deve estar entre 40 e 600." }); return z.NEVER; }
  return Math.round(n);
});
export const tableSchema = z.object({
  name: reqText(60),
  shape: z.enum(["redonda", "retangular", "quadrada"]),
  capacity: z.string().trim().transform((v, ctx) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 40) { ctx.addIssue({ code: "custom", message: "A capacidade deve estar entre 1 e 40 lugares." }); return z.NEVER; }
    return n;
  }),
  width: sizeField,
  height: sizeField,
  notes: optText(500),
});

// ------------------------------------------------------------------ orçamento
export const categorySchema = z.object({ name: reqText(80), planned_budget: money });
export const expenseSchema = z.object({
  description: reqText(200),
  category_id: z.string().min(1, "Escolha uma categoria."),
  vendor_id: z.string().transform((v) => (v === "" || v === "none" ? null : v)),
  planned_amount: money,
  paid_amount: money,
  payment_date: optDate,
  due_date: optDate,
  notes: optText(2000),
});

// ------------------------------------------------------------------- tarefas
export const taskSchema = z.object({
  title: reqText(200),
  description: optText(2000),
  category: optText(60),
  assignee: z.enum(["partner1", "partner2", "both", "other"]),
  assignee_other: optText(80),
  due_date: optDate,
  priority: z.enum(["baixa", "media", "alta"]),
  status: z.enum(["por_iniciar", "em_andamento", "concluida"]),
}).refine((v) => v.assignee !== "other" || !!v.assignee_other, { path: ["assignee_other"], message: "Indique o nome do responsável." });

// -------------------------------------------------------------- fornecedores
export const vendorSchema = z.object({
  company_name: reqText(160), service_type: optText(80), contact_name: optText(120), phone: optText(40),
  email: optEmail, website: optUrl, quoted_amount: optMoney, contracted_amount: optMoney,
  status: z.enum(["por_contactar", "contactado", "orcamento_recebido", "em_negociacao", "contratado", "recusado"]),
  notes: optText(2000),
});

// ---------------------------------------------------------------- documentos
export const documentSchema = z.object({
  name: reqText(200),
  category: z.enum(["contrato", "orcamento", "fatura", "comprovativo", "inspiracao", "outro"]),
  vendor_id: z.string().transform((v) => (v === "" || v === "none" ? null : v)),
  notes: optText(1000),
});
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt";
export const DOCUMENT_MIME = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain",
]);

// ---------------------------------------------------------------- calendário
export const eventSchema = z.object({
  title: reqText(200),
  event_type: z.enum(["pagamento", "reuniao", "prazo", "tarefa", "prova_roupa", "contacto_fornecedor", "data_importante", "outro"]),
  event_date: dateField,
  start_time: timeField, end_time: timeField,
  location: optText(200), notes: optText(2000),
  vendor_id: z.string().transform((v) => (v === "" || v === "none" ? null : v)),
}).refine((v) => !v.start_time || !v.end_time || v.end_time > v.start_time, { path: ["end_time"], message: "A hora de fim tem de ser depois da hora de início." });
