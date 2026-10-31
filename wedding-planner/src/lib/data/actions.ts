"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { AppError, friendlyError, unwrap } from "@/lib/errors";
import { useWeddingContext } from "./context";
import { useInvalidate } from "./queries";
import type { GuestInsert } from "@/lib/domain/csv";
import type { Guest, GuestSide, InvitationStatus, RsvpStatus } from "@/lib/db-types";

export interface RunOptions { success?: string; invalidate?: string[]; quiet?: boolean }

/**
 * Executa uma operação com feedback visual: notificação de sucesso/erro e atualização dos dados.
 * Devolve o resultado, ou `undefined` se falhou (o erro já foi mostrado ao utilizador).
 */
export function useRun() {
  const invalidate = useInvalidate();
  const [pending, setPending] = useState(0);
  const run = useCallback(async <T,>(fn: () => Promise<T>, opts: RunOptions = {}): Promise<T | undefined> => {
    setPending((n) => n + 1);
    try {
      const result = await fn();
      if (opts.invalidate?.length) await invalidate(...opts.invalidate);
      if (opts.success && !opts.quiet) toast.success(opts.success);
      return result;
    } catch (e) {
      toast.error(e instanceof AppError ? e.message : friendlyError(e));
      return undefined;
    } finally {
      setPending((n) => n - 1);
    }
  }, [invalidate]);
  return { run, pending: pending > 0 };
}

const db = () => getSupabase();

/** Operações sobre convidados, mesas, convites e orçamento (a RLS e a BD validam sempre). */
export function useApi() {
  const { wedding, user } = useWeddingContext();
  const w = wedding.id;
  return {
    wedding: w,
    // ---- convidados
    async createGuest(v: Record<string, unknown>) {
      return unwrap<Guest>(await db().from("guests").insert({ ...v, wedding_id: w }).select().single());
    },
    async updateGuest(id: string, v: Record<string, unknown>) {
      unwrap(await db().from("guests").update(v).eq("id", id).select("id").single());
    },
    async deleteGuests(ids: string[]) {
      unwrap(await db().from("guests").delete().in("id", ids).select("id"));
    },
    async duplicateGuest(g: Guest) {
      const { id: _id, wedding_id: _w, invited_count: _i, expected_count: _e, created_at: _c, updated_at: _u, attending_companions: _ac, attending_children: _ach, ...rest } = g;
      void _id; void _w; void _i; void _e; void _c; void _u; void _ac; void _ach;
      return unwrap<Guest>(await db().from("guests").insert({ ...rest, full_name: `${g.full_name} (cópia)`, invitation_status: "por_convidar", rsvp_status: "sem_resposta", wedding_id: w }).select().single());
    },
    async bulkGuests(ids: string[], patch: Partial<{ invitation_status: InvitationStatus; rsvp_status: RsvpStatus; group_id: string | null; side: GuestSide }>) {
      unwrap(await db().from("guests").update(patch).in("id", ids).select("id"));
    },
    async importGuests(rows: { guest: GuestInsert; groupName: string | null }[], existingGroups: { id: string; name: string }[]) {
      const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
      const groupId = new Map(existingGroups.map((g) => [norm(g.name), g.id]));
      const missing = [...new Set(rows.map((r) => r.groupName).filter((n): n is string => !!n && !groupId.has(norm(n))))];
      if (missing.length) {
        const created = unwrap<{ id: string; name: string }[]>(await db().from("guest_groups").insert(missing.map((name) => ({ wedding_id: w, name }))).select("id, name"));
        for (const g of created) groupId.set(norm(g.name), g.id);
      }
      const payload = rows.map((r) => ({ ...r.guest, group_id: r.groupName ? (groupId.get(norm(r.groupName)) ?? null) : null, wedding_id: w }));
      for (let i = 0; i < payload.length; i += 200) unwrap(await db().from("guests").insert(payload.slice(i, i + 200)).select("id"));
      return payload.length;
    },
    // ---- grupos
    async saveGroup(id: string | null, v: { name: string; notes: string | null }) {
      if (id) unwrap(await db().from("guest_groups").update(v).eq("id", id).select("id").single());
      else unwrap(await db().from("guest_groups").insert({ ...v, wedding_id: w }).select("id").single());
    },
    async deleteGroup(id: string) {
      // Os convidados ficam sem grupo (não são apagados).
      unwrap(await db().from("guests").update({ group_id: null }).eq("group_id", id).select("id"));
      unwrap(await db().from("guest_groups").delete().eq("id", id).select("id"));
    },
    async setGroupMembers(groupId: string | null, guestIds: string[]) {
      if (guestIds.length) unwrap(await db().from("guests").update({ group_id: groupId }).in("id", guestIds).select("id"));
    },
    // ---- mesas e lugares
    async assign(guestId: string, tableId: string) {
      unwrap(await db().rpc("assign_guest_to_table", { p_guest: guestId, p_table: tableId }));
    },
    async unassign(guestId: string) {
      unwrap(await db().rpc("unassign_guest", { p_guest: guestId }));
    },
    async saveTable(id: string | null, v: Record<string, unknown>) {
      if (id) unwrap(await db().from("tables").update(v).eq("id", id).select("id").single());
      else return unwrap<{ id: string }>(await db().from("tables").insert({ ...v, wedding_id: w }).select("id").single());
    },
    async moveTable(id: string, x: number, y: number) {
      unwrap(await db().from("tables").update({ x, y }).eq("id", id).select("id").single());
    },
    async deleteTable(id: string) {
      unwrap(await db().from("tables").delete().eq("id", id).select("id"));
    },
    // ---- convites e RSVP
    async updateInvitation(id: string, v: Record<string, unknown>) {
      unwrap(await db().from("invitations").update(v).eq("id", id).select("id").single());
    },
    async regenerateToken(guestId: string) {
      return unwrap<string>(await db().rpc("regenerate_rsvp_token", { p_guest: guestId }));
    },
    async recordRsvp(guestId: string, v: { status: string; companions: number; children: number; dietary: string | null; allergies: string | null; message: string | null }) {
      unwrap(await db().rpc("record_manual_rsvp", { p_guest: guestId, p_status: v.status, p_companions: v.companions, p_children: v.children, p_dietary: v.dietary, p_allergies: v.allergies, p_message: v.message }));
    },
    // ---- definições / utilizadores
    async saveWedding(v: Record<string, unknown>) {
      unwrap(await db().from("weddings").update(v).eq("id", w).select("id").single());
    },
    async inviteMember(email: string) {
      unwrap(await db().from("wedding_invitations").insert({ wedding_id: w, email, invited_by: user.id }).select("id").single());
    },
    async revokeInvite(id: string) { unwrap(await db().from("wedding_invitations").delete().eq("id", id).select("id")); },
    async removeMember(userId: string) { unwrap(await db().from("wedding_members").delete().eq("user_id", userId).eq("wedding_id", w).select("user_id")); },
    // ---- orçamento, fornecedores, tarefas, eventos (CRUD genérico)
    async upsert(table: string, id: string | null, v: Record<string, unknown>) {
      if (id) unwrap(await db().from(table).update(v).eq("id", id).select("id").single());
      else unwrap(await db().from(table).insert({ ...v, wedding_id: w }).select("id").single());
    },
    async remove(table: string, id: string) { unwrap(await db().from(table).delete().eq("id", id).select("id")); },
  };
}
