"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Armchair, CheckCircle2, LayoutGrid, List, Loader2, Plus, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useConfirm } from "@/components/confirm";
import { ErrorState, PageHeader, SkeletonRows } from "@/components/page";
import { FloorPlan, type FloorPlanHandle } from "@/components/tables/floor-plan";
import { TablesListView } from "@/components/tables/list-view";
import { TableDetails, type TableActions } from "@/components/tables/table-panel";
import { TableDialog } from "@/components/tables/table-dialog";
import { GuestChipView, UnseatedPanel } from "@/components/tables/unseated-panel";
import { useSeatingActions } from "@/components/tables/use-seating-actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useApi, useRun } from "@/lib/data/actions";
import { useGuests, useSeatings, useSeats, useTables, EMPTY } from "@/lib/data/queries";
import { clamp, snap, WORLD } from "@/lib/domain/floorplan";
import { buildSeatingView, type SeatingView } from "@/lib/domain/seating";
import { computeSeatStats } from "@/lib/domain/stats";

// Convidados: só interessa o ponteiro; mesas: também (a deteção usa o ponteiro primeiro).
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : rectIntersection(args);
};

function TablesPageInner() {
  const params = useSearchParams();
  const guestsQ = useGuests();
  const tablesQ = useTables();
  const seatingsQ = useSeatings();
  const seatsQ = useSeats();
  const api = useApi();
  const { run } = useRun();
  const confirm = useConfirm();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const guests = guestsQ.data;
  const tables = tablesQ.data;
  const view: SeatingView = useMemo(() => buildSeatingView(tables ?? [], guests ?? [], seatingsQ.data ?? EMPTY, seatsQ.data ?? EMPTY), [tables, guests, seatingsQ.data, seatsQ.data]);
  const stats = useMemo(() => computeSeatStats(tables ?? [], seatingsQ.data ?? EMPTY, guests ?? []), [tables, seatingsQ.data, guests]);
  const guestsById = useMemo(() => new Map((guests ?? []).map((g) => [g.id, g])), [guests]);
  const actions = useSeatingActions(view);

  const [mode, setMode] = useState<"planta" | "lista">("planta");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("mesa"));
  const [dialog, setDialog] = useState<{ open: boolean; table: string | null }>({ open: false, table: null });
  const [activeGuest, setActiveGuest] = useState<string | null>(null);
  const planRef = useRef<FloorPlanHandle>(null);
  const lastTableDrag = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // Se a mesa selecionada deixou de existir (ex.: apagada pelo outro noivo), fecha o painel.
  useEffect(() => { if (selectedId && tables && !tables.some((t) => t.id === selectedId)) setSelectedId(null); }, [tables, selectedId]);
  // Vindo da pesquisa global: foca a mesa pedida.
  const focusParam = params.get("mesa");
  useEffect(() => { if (focusParam && tables?.length) { setSelectedId(focusParam); setTimeout(() => planRef.current?.focus(focusParam), 50); } }, [focusParam, tables?.length]);

  // Ctrl/Cmd+Z desfaz a última alteração (se não estiver a escrever num campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault(); void actions.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  const onDragStart = (e: DragStartEvent) => { if (e.active.data.current?.type === "guest") setActiveGuest(e.active.data.current.guestId as string); };
  const onDragEnd = useCallback((e: DragEndEvent) => {
    const a = e.active.data.current, over = e.over?.data.current;
    setActiveGuest(null);
    if (a?.type === "guest") {
      const g = guestsById.get(a.guestId as string);
      if (!g) return;
      if (over?.type === "table-drop") void actions.assign(g, over.tableId as string);
      else if (over?.type === "unseated") void actions.unassign(g);
    } else if (a?.type === "table") {
      lastTableDrag.current = Date.now();
      const t = view.byId.get(a.tableId as string)?.table;
      if (!t) return;
      const k = planRef.current?.scale() ?? 1;
      const x = clamp(snap(t.x + e.delta.x / k), 0, WORLD.width - t.width), y = clamp(snap(t.y + e.delta.y / k), 0, WORLD.height - t.height);
      if (x !== t.x || y !== t.y) void actions.moveTable(t, x, y);
    }
  }, [actions, guestsById, view.byId]);

  const select = (id: string | null) => { if (Date.now() - lastTableDrag.current < 250) return; setSelectedId(id); };
  const selected = selectedId ? view.byId.get(selectedId) ?? null : null;

  const deleteTable = async (id: string) => {
    const s = view.byId.get(id); if (!s) return;
    if (await confirm({ title: `Eliminar a ${s.table.name}?`, description: s.used ? `Os ${s.used} lugares ocupados ficam livres e os convidados voltam a “Sem mesa”.` : "Esta ação não pode ser desfeita." }))
      if (await run(() => api.deleteTable(id).then(() => true), { success: "Mesa eliminada.", invalidate: ["tables", "table_seats", "guest_seatings"] })) setSelectedId(null);
  };
  const tableActions: TableActions = {
    assign: (g, t) => actions.assign(g, t), unassign: (g) => actions.unassign(g),
    onEdit: (id) => setDialog({ open: true, table: id }), onDelete: deleteTable,
  };

  const loading = tablesQ.isPending || guestsQ.isPending || seatingsQ.isPending || seatsQ.isPending;
  const error = tablesQ.isError || guestsQ.isError || seatingsQ.isError || seatsQ.isError;
  const overlayGuest = activeGuest ? guestsById.get(activeGuest) : null;

  const headerActions = (
    <>
      <Button onClick={() => setDialog({ open: true, table: null })}><Plus /> Nova mesa</Button>
      <Button variant="outline" onClick={() => void actions.undo()} disabled={!actions.canUndo} title="Desfazer a última alteração (Ctrl+Z)"><Undo2 /> Desfazer{actions.undoCount ? ` (${actions.undoCount})` : ""}</Button>
    </>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveGuest(null)} autoScroll={false}>
      <PageHeader title="Organização das mesas" description="Crie as mesas, defina a capacidade e arraste os convidados para os seus lugares." actions={headerActions} />

      {loading ? <SkeletonRows n={6} /> : error ? <ErrorState onRetry={() => { void tablesQ.refetch(); void guestsQ.refetch(); void seatingsQ.refetch(); void seatsQ.refetch(); }} /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)} aria-label="Modo de visualização">
              <ToggleGroupItem value="planta"><LayoutGrid />Planta</ToggleGroupItem>
              <ToggleGroupItem value="lista"><List />Lista</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge variant="neutral"><Armchair />{stats.tables} {stats.tables === 1 ? "mesa" : "mesas"}</Badge>
              <Badge variant="default">{stats.occupied}/{stats.capacity} lugares</Badge>
              <Badge variant={stats.unseatedGuests ? "warning" : "success"}>{stats.unseatedGuests ? `${stats.unseatedPeople} por sentar` : "Todos sentados"}</Badge>
              {stats.fullTables > 0 && <Badge variant="gold">{stats.fullTables} {stats.fullTables === 1 ? "mesa cheia" : "mesas cheias"}</Badge>}
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              {actions.saving ? <><Loader2 className="size-3.5 animate-spin" />A guardar…</> : <><CheckCircle2 className="size-3.5 text-sage-500" />Guardado automaticamente</>}
            </span>
          </div>

          {mode === "planta" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_21rem]">
              <FloorPlan handleRef={planRef} view={view} selectedId={selectedId} onSelect={select} guestsById={guestsById}
                onMoveTable={(t, x, y) => void actions.moveTable(t, x, y)} onResizeTable={(t, w, h) => void actions.resizeTable(t, w, h)}
                className="h-[62dvh] min-h-[420px] lg:h-[calc(100dvh-13rem)]" />
              <div className="flex min-h-0 flex-col gap-3 lg:h-[calc(100dvh-13rem)]">
                {isDesktop && selected && (
                  <section aria-label={`Mesa ${selected.table.name}`} className="flex max-h-[58%] min-h-0 flex-col rounded-xl border bg-card p-3">
                    <TableDetails state={selected} view={view} actions={tableActions} />
                  </section>
                )}
                <UnseatedPanel view={view} onAssign={(g, t) => void actions.assign(g, t)} className="min-h-[14rem] flex-1" />
              </div>
            </div>
          ) : (
            <TablesListView view={view} actions={tableActions} onCreate={() => setDialog({ open: true, table: null })} selectedId={selectedId} />
          )}

          {/* Telemóvel/tablet: a mesa selecionada abre numa folha inferior */}
          {!isDesktop && mode === "planta" && (
            <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
              <SheetContent side="bottom" className="max-h-[80dvh] gap-0">
                <SheetHeader className="sr-only"><SheetTitle>{selected?.table.name}</SheetTitle><SheetDescription>Convidados desta mesa</SheetDescription></SheetHeader>
                {selected && <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-5"><TableDetails state={selected} view={view} actions={tableActions} draggable={false} /></div>}
              </SheetContent>
            </Sheet>
          )}
        </>
      )}

      <DragOverlay dropAnimation={null}>
        {overlayGuest && <GuestChipView guest={overlayGuest} className="w-64 cursor-grabbing border-sage-400 shadow-lg" />}
      </DragOverlay>

      <TableDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} table={dialog.table ? view.byId.get(dialog.table)?.table : null}
        onCreated={(id) => { setSelectedId(id); setTimeout(() => planRef.current?.focus(id), 400); }} />
    </DndContext>
  );
}

export default function TablesPage() {
  return <Suspense fallback={<SkeletonRows n={6} />}><TablesPageInner /></Suspense>;
}
