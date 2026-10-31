import type { Guest, GuestSide, Invitation, InvitationStatus, RsvpStatus } from "../db-types";

/** Texto sem acentos, minúsculas, espaços normalizados (para pesquisa e importação). */
export const normalizeText = (s: string | null | undefined): string =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface GuestFilters {
  search: string;
  groupId: "all" | "none" | string;
  side: GuestSide | "all";
  invitation: InvitationStatus | "all";
  rsvp: RsvpStatus | "all";
  table: "all" | "none" | string;
}

export const emptyFilters: GuestFilters = { search: "", groupId: "all", side: "all", invitation: "all", rsvp: "all", table: "all" };

export function filterGuests(guests: Guest[], f: GuestFilters, tableOfGuest: Map<string, string>): Guest[] {
  const q = normalizeText(f.search);
  return guests.filter((g) => {
    if (q) {
      const hay = normalizeText([g.full_name, g.surname, g.email, g.phone, g.companion_names, g.relationship].filter(Boolean).join(" "));
      if (!hay.includes(q)) return false;
    }
    if (f.groupId === "none" ? g.group_id !== null : f.groupId !== "all" && g.group_id !== f.groupId) return false;
    if (f.side !== "all" && g.side !== f.side) return false;
    if (f.invitation !== "all" && g.invitation_status !== f.invitation) return false;
    if (f.rsvp !== "all" && g.rsvp_status !== f.rsvp) return false;
    const t = tableOfGuest.get(g.id);
    if (f.table === "none" ? t !== undefined : f.table !== "all" && t !== f.table) return false;
    return true;
  });
}

export type SortKey = "full_name" | "group" | "side" | "category" | "invitation_status" | "rsvp_status" | "people" | "table";
export interface SortContext { groupName: (id: string | null) => string; tableName: (guestId: string) => string }

const ORDER_INVITATION: Record<InvitationStatus, number> = { por_convidar: 0, enviado: 1, entregue: 2, recusado: 3 };
const ORDER_RSVP: Record<RsvpStatus, number> = { sem_resposta: 0, confirmado: 1, nao_vai: 2 };

export function sortGuests(guests: Guest[], key: SortKey, dir: "asc" | "desc", ctx: SortContext): Guest[] {
  const val = (g: Guest): string | number => {
    switch (key) {
      case "full_name": return normalizeText(g.full_name);
      case "group": return normalizeText(ctx.groupName(g.group_id));
      case "side": return g.side;
      case "category": return g.category;
      case "invitation_status": return ORDER_INVITATION[g.invitation_status];
      case "rsvp_status": return ORDER_RSVP[g.rsvp_status];
      case "people": return g.invited_count;
      case "table": return normalizeText(ctx.tableName(g.id)) || "￿";
    }
  };
  const m = dir === "asc" ? 1 : -1;
  return [...guests].sort((a, b) => {
    const va = val(a), vb = val(b);
    const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt");
    return c !== 0 ? c * m : a.full_name.localeCompare(b.full_name, "pt");
  });
}

export type FollowUp = "to_invite" | "to_follow_up" | "waiting" | "done";

/**
 * Estado de acompanhamento de um convidado:
 *  - to_invite: o convite ainda não saiu;
 *  - to_follow_up: o convite saiu, não houve resposta e já passaram `staleDays` desde o último contacto;
 *  - waiting: o convite saiu há pouco tempo, sem resposta;
 *  - done: já respondeu (ou o convite foi recusado).
 */
export function followUpState(g: Guest, inv: Invitation | undefined, now: Date = new Date(), staleDays = 7): FollowUp {
  if (g.invitation_status === "por_convidar") return "to_invite";
  if (g.rsvp_status !== "sem_resposta" || g.invitation_status === "recusado") return "done";
  const last = inv?.last_contacted_at ?? inv?.delivered_at ?? inv?.sent_at;
  if (!last) return "to_follow_up";
  const days = (now.getTime() - new Date(last).getTime()) / 86_400_000;
  return days >= staleDays ? "to_follow_up" : "waiting";
}

/** Pessoas que ainda precisam de ser contactadas (por convidar ou sem resposta há muito tempo). */
export const needsContact = (g: Guest, inv: Invitation | undefined, now?: Date, staleDays?: number) => {
  const s = followUpState(g, inv, now, staleDays);
  return s === "to_invite" || s === "to_follow_up";
};

/** Nome para mostrar de uma pessoa extra de um registo ("Maria +1", "Maria +2"). */
export const personLabel = (g: Pick<Guest, "full_name" | "companion_names">, index: number): string => {
  if (index === 0) return g.full_name;
  const names = (g.companion_names ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return names[index - 1] ?? `${g.full_name} +${index}`;
};
