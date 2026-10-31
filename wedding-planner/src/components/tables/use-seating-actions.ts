"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi, useRun } from "@/lib/data/actions";
import { key } from "@/lib/data/queries";
import { useWeddingContext } from "@/lib/data/context";
import { canFit, missingSeats, type SeatingView } from "@/lib/domain/seating";
import type { Guest, TableRow } from "@/lib/db-types";

type Op =
  | { kind: "assign"; guestId: string; name: string; from: string | null; to: string | null }
  | { kind: "move"; tableId: string; name: string; from: { x: number; y: number } }
  | { kind: "resize"; tableId: string; name: string; from: { width: number; height: number } };

const MAX_UNDO = 30;

/** Atribuições de convidados a mesas com validação, avisos e "desfazer" das últimas alterações. */
const seatingTables = ["guest_seatings", "table_seats"];

export function useSeatingActions(view: SeatingView) {
  const api = useApi();
  const { run, pending } = useRun();
  const qc = useQueryClient();
  const { wedding } = useWeddingContext();
  const [undoStack, setUndoStack] = useState<Op[]>([]);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const push = (op: Op) => setUndoStack((s) => [...s.slice(-(MAX_UNDO - 1)), op]);

  /** Atribui (ou move) um convidado para uma mesa. Devolve true se ficou guardado. */
  const assign = useCallback(async (guest: Guest, tableId: string): Promise<boolean> => {
    const v = viewRef.current;
    const state = v.byId.get(tableId);
    const from = v.tableOfGuest.get(guest.id) ?? null;
    if (!state) return false;
    if (from === tableId) { toast.info(`${guest.full_name} já está nesta mesa.`); return false; }
    if (guest.expected_count === 0) { toast.error(`${guest.full_name} não vai comparecer e não precisa de lugar.`); return false; }
    if (!canFit(state, guest)) {
      toast.error(`${state.table.name} não tem lugares suficientes para ${guest.full_name} (faltam ${missingSeats(state, guest)}).`);
      return false;
    }
    const ok = await run(() => api.assign(guest.id, tableId).then(() => true), { quiet: true, invalidate: seatingTables });
    if (!ok) return false;
    push({ kind: "assign", guestId: guest.id, name: guest.full_name, from, to: tableId });
    toast.success(`${guest.full_name} → ${state.table.name}`);
    if (state.free - guest.expected_count <= 0) toast.warning(`${state.table.name} ficou cheia.`);
    return true;
  }, [api, run]);

  const unassign = useCallback(async (guest: Guest): Promise<boolean> => {
    const from = viewRef.current.tableOfGuest.get(guest.id) ?? null;
    if (!from) return false;
    const ok = await run(() => api.unassign(guest.id).then(() => true), { quiet: true, invalidate: seatingTables });
    if (!ok) return false;
    push({ kind: "assign", guestId: guest.id, name: guest.full_name, from, to: null });
    toast.success(`${guest.full_name} retirado da mesa.`);
    return true;
  }, [api, run]);

  /** Guarda a nova posição da mesa (atualização imediata no ecrã + gravação automática). */
  const moveTable = useCallback(async (t: TableRow, x: number, y: number, record = true) => {
    const k = key(wedding.id, "tables");
    qc.setQueryData<TableRow[]>(k, (rows) => rows?.map((r) => (r.id === t.id ? { ...r, x, y } : r)));
    const ok = await run(() => api.moveTable(t.id, x, y).then(() => true), { quiet: true });
    if (!ok) { await qc.invalidateQueries({ queryKey: k }); return false; }
    if (record) push({ kind: "move", tableId: t.id, name: t.name, from: { x: t.x, y: t.y } });
    return true;
  }, [api, qc, run, wedding.id]);

  const resizeTable = useCallback(async (t: TableRow, width: number, height: number) => {
    const k = key(wedding.id, "tables");
    qc.setQueryData<TableRow[]>(k, (rows) => rows?.map((r) => (r.id === t.id ? { ...r, width, height } : r)));
    const ok = await run(() => api.saveTable(t.id, { width, height }).then(() => true), { quiet: true });
    if (!ok) { await qc.invalidateQueries({ queryKey: k }); return false; }
    push({ kind: "resize", tableId: t.id, name: t.name, from: { width: t.width, height: t.height } });
    return true;
  }, [api, qc, run, wedding.id]);

  const undo = useCallback(async () => {
    const op = undoStack[undoStack.length - 1];
    if (!op) return;
    const v = viewRef.current;
    let ok = false;
    if (op.kind === "assign") {
      ok = op.from
        ? !!(await run(() => api.assign(op.guestId, op.from!).then(() => true), { quiet: true, invalidate: seatingTables }))
        : !!(await run(() => api.unassign(op.guestId).then(() => true), { quiet: true, invalidate: seatingTables }));
    } else if (op.kind === "move") {
      const t = v.byId.get(op.tableId)?.table;
      ok = !!t && (await moveTable(t, op.from.x, op.from.y, false));
    } else {
      qc.setQueryData<TableRow[]>(key(wedding.id, "tables"), (rows) => rows?.map((r) => (r.id === op.tableId ? { ...r, ...op.from } : r)));
      ok = !!(await run(() => api.saveTable(op.tableId, op.from).then(() => true), { quiet: true }));
    }
    if (ok) {
      setUndoStack((s) => s.slice(0, -1));
      toast.success(`Desfeito: ${op.kind === "assign" ? `lugar de ${op.name}` : op.kind === "move" ? `posição de ${op.name}` : `tamanho de ${op.name}`}.`);
    }
  }, [undoStack, api, run, moveTable, qc, wedding.id]);

  return { assign, unassign, moveTable, resizeTable, undo, canUndo: undoStack.length > 0, undoCount: undoStack.length, saving: pending };
}
