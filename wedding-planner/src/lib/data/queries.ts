"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import type {
  BudgetCategory, CalendarEvent, DocumentRow, Expense, Guest, GuestGroup, GuestSeating, Invitation, RsvpResponse,
  TableRow, TableSeat, Task, Vendor, Wedding, WeddingInvitation, WeddingMember,
} from "@/lib/db-types";
import { useWeddingContext } from "./context";

export const key = (weddingId: string, table: string) => ["wp", weddingId, table] as const;

const PAGE = 1000;

/** Lê TODAS as linhas (a API devolve no máximo 1000 por pedido). */
async function fetchAll<T>(table: string, weddingId: string, order?: { column: string; ascending?: boolean }): Promise<T[]> {
  const supabase = getSupabase();
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select("*").eq(table === "weddings" ? "id" : "wedding_id", weddingId);
    if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
    q = q.order("id").range(from, from + PAGE - 1);
    const rows = unwrap<T[]>(await q);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function makeList<T>(table: string, order?: { column: string; ascending?: boolean }) {
  return function useList() {
    const { wedding } = useWeddingContext();
    return useQuery({
      queryKey: key(wedding.id, table),
      queryFn: () => fetchAll<T>(table, wedding.id, order),
      staleTime: 10_000,
    });
  };
}

export const useGuests = makeList<Guest>("guests", { column: "full_name" });
export const useGroups = makeList<GuestGroup>("guest_groups", { column: "name" });
export const useInvitations = makeList<Invitation>("invitations");
export const useRsvpResponses = makeList<RsvpResponse>("rsvp_responses", { column: "submitted_at", ascending: false });
export const useTables = makeList<TableRow>("tables", { column: "created_at" });
export const useSeats = makeList<TableSeat>("table_seats");
export const useSeatings = makeList<GuestSeating>("guest_seatings");
export const useCategories = makeList<BudgetCategory>("budget_categories", { column: "sort_order" });
export const useExpenses = makeList<Expense>("expenses", { column: "created_at", ascending: false });
export const useVendors = makeList<Vendor>("vendors", { column: "company_name" });
export const useTasks = makeList<Task>("tasks", { column: "created_at", ascending: false });
export const useDocuments = makeList<DocumentRow>("documents", { column: "created_at", ascending: false });
export const useEvents = makeList<CalendarEvent>("calendar_events", { column: "event_date" });
export const useMembers = makeList<WeddingMember>("wedding_members", { column: "created_at" });
export const useWeddingInvites = makeList<WeddingInvitation>("wedding_invitations", { column: "created_at" });

/** O casamento (definições) sempre atualizado; parte do valor inicial vindo do servidor. */
export function useWedding(): Wedding {
  const { wedding } = useWeddingContext();
  const { data } = useQuery({
    queryKey: key(wedding.id, "weddings"),
    queryFn: async () => (await fetchAll<Wedding>("weddings", wedding.id))[0] ?? wedding,
    initialData: wedding,
    staleTime: 10_000,
  });
  return data;
}

export const invalidate = (qc: QueryClient, weddingId: string, ...tables: string[]) =>
  Promise.all(tables.map((t) => qc.invalidateQueries({ queryKey: key(weddingId, t) })));

/** Invalida conjuntos de tabelas depois de uma alteração. */
export function useInvalidate() {
  const qc = useQueryClient();
  const { wedding } = useWeddingContext();
  return (...tables: string[]) => invalidate(qc, wedding.id, ...tables);
}

export const ALL_TABLES = ["weddings", "wedding_members", "wedding_invitations", "guest_groups", "guests", "invitations", "rsvp_responses",
  "tables", "table_seats", "guest_seatings", "budget_categories", "vendors", "expenses", "tasks", "documents", "calendar_events"] as const;
export const EMPTY: never[] = [];
