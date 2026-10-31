import type { Guest, GuestCategory, GuestGroup, GuestSide, InvitationStatus, RsvpStatus, Wedding, AgeGroup } from "../db-types";
import { ageGroupLabel, categoryLabel, invitationStatusLabel, rsvpStatusLabel, sideLabel } from "../labels";
import { normalizeText } from "./guests";

/** Cabeçalhos de exportação (e os aceites na importação, com variantes). */
export const GUEST_COLUMNS = [
  { key: "full_name", header: "Nome completo", aliases: ["nome", "nome completo", "convidado", "name", "full name"] },
  { key: "surname", header: "Apelido", aliases: ["apelido", "surname", "last name"] },
  { key: "phone", header: "Telefone", aliases: ["telefone", "telemovel", "telemóvel", "contacto", "phone", "mobile"] },
  { key: "email", header: "Email", aliases: ["email", "e-mail", "correio eletronico"] },
  { key: "group", header: "Grupo/Família", aliases: ["grupo", "familia", "grupo/familia", "grupo familia", "grupo ou familia", "group", "family"] },
  { key: "relationship", header: "Relação", aliases: ["relacao", "relação com os noivos", "relacao com os noivos", "relationship"] },
  { key: "side", header: "Lado", aliases: ["lado", "lado dos noivos", "side"] },
  { key: "category", header: "Categoria", aliases: ["categoria", "category", "tipo"] },
  { key: "age_group", header: "Adulto/Criança", aliases: ["adulto/crianca", "adulto ou crianca", "idade", "faixa etaria", "age"] },
  { key: "companion_names", header: "Nomes dos acompanhantes", aliases: ["acompanhantes", "nome dos acompanhantes", "nomes dos acompanhantes", "companions"] },
  { key: "companions_count", header: "N.º acompanhantes", aliases: ["n acompanhantes", "numero de acompanhantes", "n.º acompanhantes", "nº acompanhantes", "num acompanhantes", "companions count"] },
  { key: "children_count", header: "N.º crianças", aliases: ["n criancas", "numero de criancas", "n.º crianças", "nº crianças", "criancas", "children"] },
  { key: "dietary_restrictions", header: "Restrições alimentares", aliases: ["restricoes alimentares", "restricoes", "dieta", "dietary"] },
  { key: "allergies", header: "Alergias", aliases: ["alergias", "alergias alimentares", "allergies"] },
  { key: "notes", header: "Observações", aliases: ["observacoes", "notas", "obs", "notes"] },
  { key: "invitation_status", header: "Estado do convite", aliases: ["estado do convite", "convite", "invitation"] },
  { key: "rsvp_status", header: "Presença", aliases: ["presenca", "confirmacao", "confirmação", "estado da presenca", "rsvp"] },
  { key: "table", header: "Mesa", aliases: ["mesa", "table"] },
  { key: "seats", header: "Lugares", aliases: ["lugares", "lugar", "seats"] },
] as const;
export type GuestColumnKey = (typeof GUEST_COLUMNS)[number]["key"];

const ALIAS = new Map<string, GuestColumnKey>();
for (const c of GUEST_COLUMNS) { ALIAS.set(normalizeText(c.header), c.key); for (const a of c.aliases) ALIAS.set(normalizeText(a), c.key); }
export const columnForHeader = (h: string): GuestColumnKey | undefined => ALIAS.get(normalizeText(h).replace(/[.º°]/g, ""))  ?? ALIAS.get(normalizeText(h));

// ----------------------------------------------------------------- exportação
export interface ExportContext { wedding: Pick<Wedding, "partner1_name" | "partner2_name">; groups: GuestGroup[]; tableOf: (guestId: string) => string; seatsOf: (guestId: string) => string }

export function guestsToRows(guests: Guest[], ctx: ExportContext): Record<string, string | number>[] {
  const group = new Map(ctx.groups.map((g) => [g.id, g.name]));
  return guests.map((g) => ({
    "Nome completo": g.full_name,
    "Apelido": g.surname ?? "",
    "Telefone": g.phone ?? "",
    "Email": g.email ?? "",
    "Grupo/Família": g.group_id ? (group.get(g.group_id) ?? "") : "",
    "Relação": g.relationship ?? "",
    "Lado": sideLabel(g.side, ctx.wedding),
    "Categoria": categoryLabel[g.category],
    "Adulto/Criança": ageGroupLabel[g.age_group],
    "Nomes dos acompanhantes": g.companion_names ?? "",
    "N.º acompanhantes": g.companions_count,
    "N.º crianças": g.children_count,
    "Restrições alimentares": g.dietary_restrictions ?? "",
    "Alergias": g.allergies ?? "",
    "Observações": g.notes ?? "",
    "Estado do convite": invitationStatusLabel[g.invitation_status],
    "Presença": rsvpStatusLabel[g.rsvp_status],
    "Mesa": ctx.tableOf(g.id),
    "Lugares": ctx.seatsOf(g.id),
  }));
}

/** CSV com ";" e BOM UTF-8: abre corretamente no Excel em português. */
export function toCsv(rows: Record<string, string | number>[], headers: string[] = GUEST_COLUMNS.map((c) => c.header)): string {
  const esc = (v: string | number) => {
    let s = String(v ?? "");
    // Proteção contra injeção de fórmulas em folhas de cálculo.
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers.map(esc).join(";"), ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(";"))].join("\r\n");
}

// ----------------------------------------------------------------- importação
export interface GuestInsert {
  full_name: string; surname: string | null; phone: string | null; email: string | null; relationship: string | null;
  side: GuestSide; category: GuestCategory; age_group: AgeGroup; companion_names: string | null;
  companions_count: number; children_count: number; dietary_restrictions: string | null; allergies: string | null; notes: string | null;
  invitation_status: InvitationStatus; rsvp_status: RsvpStatus;
}
export interface ParsedRow { rowNumber: number; guest: GuestInsert; groupName: string | null; duplicate: boolean; warnings: string[] }
export interface RowError { rowNumber: number; message: string }
export interface ParseResult { rows: ParsedRow[]; errors: RowError[]; unknownHeaders: string[]; missingNameColumn: boolean; newGroups: string[] }

const SIDE_BOTH = ["ambos", "ambas", "os dois", "both", "casal", "noivos"];
export function parseSide(v: string, w: Pick<Wedding, "partner1_name" | "partner2_name">): GuestSide | null {
  const n = normalizeText(v);
  if (!n) return "both";
  if (SIDE_BOTH.includes(n)) return "both";
  if (n === normalizeText(w.partner1_name) || n === "noivo" || n === "partner1") return "partner1";
  if (n === normalizeText(w.partner2_name) || n === "noiva" || n === "partner2") return "partner2";
  return null;
}
const lookup = <T extends string>(v: string, table: Record<string, T>, empty: T): T | null => {
  const n = normalizeText(v);
  if (!n) return empty;
  return table[n] ?? null;
};
export const parseCategory = (v: string) => lookup<GuestCategory>(v, { familia: "familia", family: "familia", amigos: "amigos", amigo: "amigos", amiga: "amigos", friends: "amigos", trabalho: "trabalho", colegas: "trabalho", work: "trabalho", outros: "outros", outro: "outros", other: "outros" }, "outros");
export const parseAge = (v: string) => lookup<AgeGroup>(v, { adulto: "adulto", adult: "adulto", adultos: "adulto", crianca: "crianca", child: "crianca", kid: "crianca" }, "adulto");
export const parseInvitation = (v: string) => lookup<InvitationStatus>(v, {
  "por convidar": "por_convidar", "nao convidado": "por_convidar", "por_convidar": "por_convidar",
  "convite enviado": "enviado", enviado: "enviado", "convite entregue": "entregue", entregue: "entregue",
  "convite recusado": "recusado", recusado: "recusado",
}, "por_convidar");
export const parseRsvp = (v: string) => lookup<RsvpStatus>(v, {
  "sem resposta": "sem_resposta", pendente: "sem_resposta", sem_resposta: "sem_resposta",
  confirmado: "confirmado", confirmada: "confirmado", sim: "confirmado", vai: "confirmado",
  "nao vai comparecer": "nao_vai", "nao vai": "nao_vai", nao: "nao_vai", "nao confirmado": "nao_vai", nao_vai: "nao_vai", recusou: "nao_vai",
}, "sem_resposta");

const parseCount = (v: string): number | null => {
  const t = v.trim();
  if (!t) return 0;
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n <= 20 ? n : null;
};
const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clean = (v: string | undefined, max: number): string | null => { const s = (v ?? "").trim(); return s ? s.slice(0, max) : null; };

/**
 * Converte linhas (cabeçalho → texto) numa pré-visualização validada. Nada é guardado aqui.
 * Linhas com erros ficam de fora; duplicados (mesmo nome + mesmo telefone/email, ou mesmo nome) são assinalados.
 */
export function parseGuestRows(raw: Record<string, unknown>[], w: Pick<Wedding, "partner1_name" | "partner2_name">, existing: Guest[]): ParseResult {
  // União dos cabeçalhos de TODAS as linhas (uma coluna pode só aparecer a meio do ficheiro).
  const headers = [...new Set(raw.flatMap((r) => Object.keys(r)))];
  const map = new Map<string, GuestColumnKey>();
  const unknownHeaders: string[] = [];
  for (const h of headers) { const k = columnForHeader(h); if (k) map.set(h, k); else if (h.trim()) unknownHeaders.push(h); }
  const missingNameColumn = ![...map.values()].includes("full_name");
  const result: ParseResult = { rows: [], errors: [], unknownHeaders, missingNameColumn, newGroups: [] };
  if (missingNameColumn) return result;

  const seen = new Set(existing.map((g) => `${normalizeText(g.full_name)}|${normalizeText(g.phone ?? g.email ?? "")}`));
  const seenNames = new Set(existing.map((g) => normalizeText(g.full_name)));
  const existingGroups = new Set<string>();
  const newGroups = new Map<string, string>();

  raw.forEach((r, i) => {
    const rowNumber = i + 2; // +1 do cabeçalho, +1 por começar em 1
    const f: Partial<Record<GuestColumnKey, string>> = {};
    for (const [h, k] of map) f[k] = String(r[h] ?? "").trim();
    if (Object.values(f).every((v) => !v)) return; // linha vazia
    const errs: string[] = [];
    const name = f.full_name ?? "";
    if (!name) errs.push("Falta o nome completo");
    if (name.length > 160) errs.push("Nome demasiado longo (máx. 160)");
    const side = parseSide(f.side ?? "", w); if (!side) errs.push(`Lado inválido: "${f.side}" (use ${w.partner1_name}, ${w.partner2_name} ou Ambos)`);
    const category = parseCategory(f.category ?? ""); if (!category) errs.push(`Categoria inválida: "${f.category}"`);
    const age = parseAge(f.age_group ?? ""); if (!age) errs.push(`Adulto/Criança inválido: "${f.age_group}"`);
    const invitation = parseInvitation(f.invitation_status ?? ""); if (!invitation) errs.push(`Estado do convite inválido: "${f.invitation_status}"`);
    const rsvp = parseRsvp(f.rsvp_status ?? ""); if (!rsvp) errs.push(`Presença inválida: "${f.rsvp_status}"`);
    const companions = parseCount(f.companions_count ?? ""); if (companions === null) errs.push(`N.º de acompanhantes inválido: "${f.companions_count}" (0 a 20)`);
    const children = parseCount(f.children_count ?? ""); if (children === null) errs.push(`N.º de crianças inválido: "${f.children_count}" (0 a 20)`);
    const email = clean(f.email, 254); if (email && !emailRe.test(email)) errs.push(`Email inválido: "${email}"`);
    if (errs.length) { result.errors.push({ rowNumber, message: errs.join("; ") }); return; }

    const key = `${normalizeText(name)}|${normalizeText(clean(f.phone, 40) ?? email ?? "")}`;
    const duplicate = seen.has(key) || (seenNames.has(normalizeText(name)) && !f.phone && !email);
    seen.add(key); seenNames.add(normalizeText(name));
    const warnings: string[] = [];
    if (f.table) warnings.push("A coluna Mesa/Lugares é ignorada (as mesas organizam-se na planta)");
    const groupName = clean(f.group, 120);
    if (groupName) newGroups.set(normalizeText(groupName), groupName);

    result.rows.push({
      rowNumber, groupName, duplicate, warnings,
      guest: {
        full_name: name, surname: clean(f.surname, 100), phone: clean(f.phone, 40), email, relationship: clean(f.relationship, 120),
        side: side!, category: category!, age_group: age!, companion_names: clean(f.companion_names, 500),
        companions_count: companions!, children_count: children!, dietary_restrictions: clean(f.dietary_restrictions, 500),
        allergies: clean(f.allergies, 500), notes: clean(f.notes, 2000), invitation_status: invitation!, rsvp_status: rsvp!,
      },
    });
  });
  void existingGroups;
  result.newGroups = [...newGroups.values()];
  return result;
}
