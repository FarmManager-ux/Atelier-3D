import type { Guest, GuestGroup, GuestSeating, Invitation, TableRow } from "../db-types";
import { parseDate, toISODate } from "../dates";

const sum = <T>(items: T[], f: (t: T) => number) => items.reduce((a, t) => a + f(t), 0);

/**
 * Definições (sempre em PESSOAS individuais, incluindo acompanhantes e crianças, sem duplicar registos):
 *  - pessoas convidadas: convidado + acompanhantes + crianças dos registos cujo convite já saiu (≠ "por convidar")
 *  - confirmadas: pessoas que vão realmente (os acompanhantes confirmados no RSVP)
 *  - não vão: quem recusou + acompanhantes autorizados que não vêm
 *  - sem resposta: pessoas dos registos que ainda não responderam
 */
export interface GuestStats {
  totalRecords: number;          // registos de convidados
  totalPeople: number;           // todas as pessoas (convidadas ou não)
  invitedPeople: number;         // pessoas cujo convite já foi enviado
  toInvitePeople: number;        // pessoas ainda por convidar
  invitesSent: number;           // convites (registos) já enviados
  invitesToSend: number;         // convites (registos) por enviar
  confirmedPeople: number;
  declinedPeople: number;
  noReplyPeople: number;
  pendingInvites: number;        // convites enviados sem resposta (registos)
  confirmationRate: number;      // 0..1 = confirmadas / pessoas convidadas
  invitationBreakdown: Record<Guest["invitation_status"], number>;   // registos por estado do convite
  rsvpBreakdownPeople: { confirmado: number; nao_vai: number; sem_resposta: number };
}

export function computeGuestStats(guests: Guest[]): GuestStats {
  const sent = guests.filter((g) => g.invitation_status !== "por_convidar");
  const answered = guests.filter((g) => g.rsvp_status !== "sem_resposta");
  const confirmedPeople = sum(guests.filter((g) => g.rsvp_status === "confirmado"), (g) => g.expected_count);
  const declinedPeople = sum(answered, (g) => g.invited_count - g.expected_count);
  const noReplyPeople = sum(guests.filter((g) => g.rsvp_status === "sem_resposta"), (g) => g.invited_count);
  const invitedPeople = sum(sent, (g) => g.invited_count);
  const breakdown = { por_convidar: 0, enviado: 0, entregue: 0, recusado: 0 };
  for (const g of guests) breakdown[g.invitation_status]++;
  return {
    totalRecords: guests.length,
    totalPeople: sum(guests, (g) => g.invited_count),
    invitedPeople,
    toInvitePeople: sum(guests.filter((g) => g.invitation_status === "por_convidar"), (g) => g.invited_count),
    invitesSent: sent.length,
    invitesToSend: guests.length - sent.length,
    confirmedPeople,
    declinedPeople,
    noReplyPeople,
    pendingInvites: sent.filter((g) => g.rsvp_status === "sem_resposta").length,
    confirmationRate: invitedPeople > 0 ? confirmedPeople / invitedPeople : 0,
    invitationBreakdown: breakdown,
    rsvpBreakdownPeople: { confirmado: confirmedPeople, nao_vai: declinedPeople, sem_resposta: noReplyPeople },
  };
}

export interface SeatStats { tables: number; capacity: number; occupied: number; free: number; unseatedPeople: number; unseatedGuests: number; fullTables: number }

export function computeSeatStats(tables: TableRow[], seatings: GuestSeating[], guests: Guest[]): SeatStats {
  const capacity = sum(tables, (t) => t.capacity);
  const used = new Map<string, number>();
  const seated = new Set<string>();
  for (const s of seatings) { used.set(s.table_id, (used.get(s.table_id) ?? 0) + 1); seated.add(s.guest_id); }
  const unseated = guests.filter((g) => g.expected_count > 0 && !seated.has(g.id));
  return {
    tables: tables.length,
    capacity,
    occupied: seatings.length,
    free: capacity - seatings.length,
    unseatedPeople: sum(unseated, (g) => g.expected_count),
    unseatedGuests: unseated.length,
    fullTables: tables.filter((t) => (used.get(t.id) ?? 0) >= t.capacity).length,
  };
}

export type Distribution = { key: string; label: string; people: number; records: number };

/** Distribuição de PESSOAS por categoria, grupo (família) ou lado dos noivos. */
export function distribution(guests: Guest[], by: "category" | "group" | "side", labels: { group: GuestGroup[]; side: Record<Guest["side"], string>; category: Record<Guest["category"], string> }): Distribution[] {
  const map = new Map<string, Distribution>();
  const add = (key: string, label: string, g: Guest) => {
    const cur = map.get(key) ?? { key, label, people: 0, records: 0 };
    cur.people += g.invited_count; cur.records += 1;
    map.set(key, cur);
  };
  for (const g of guests) {
    if (by === "category") add(g.category, labels.category[g.category], g);
    else if (by === "side") add(g.side, labels.side[g.side], g);
    else {
      const grp = labels.group.find((x) => x.id === g.group_id);
      add(grp ? grp.id : "sem-grupo", grp ? grp.name : "Sem grupo", g);
    }
  }
  return [...map.values()].sort((a, b) => b.people - a.people || a.label.localeCompare(b.label, "pt"));
}

/** Evolução acumulada das pessoas confirmadas, por dia da resposta. */
export function confirmationEvolution(guests: Guest[], invitations: Invitation[]): { date: string; people: number }[] {
  const byGuest = new Map(invitations.map((i) => [i.guest_id, i]));
  const perDay = new Map<string, number>();
  for (const g of guests) {
    if (g.rsvp_status !== "confirmado") continue;
    const at = byGuest.get(g.id)?.responded_at;
    if (!at) continue;
    const day = toISODate(new Date(at));
    perDay.set(day, (perDay.get(day) ?? 0) + g.expected_count);
  }
  let total = 0;
  return [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, n]) => ({ date, people: (total += n) }));
}

export const sortByDate = <T extends { date: string }>(items: T[]) => [...items].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
