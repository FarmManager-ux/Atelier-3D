"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { Maximize2, Minus, Plus, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canFit, seatPositions, type SeatingView, type TableState } from "@/lib/domain/seating";
import { centerOn, clamp, fitView, snap, WORLD, zoomAt, type ViewState } from "@/lib/domain/floorplan";
import type { Guest, TableRow } from "@/lib/db-types";

export interface FloorPlanHandle { fit: () => void; focus: (tableId: string) => void; scale: () => number }

interface Props {
  view: SeatingView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveTable: (t: TableRow, x: number, y: number) => void;
  onResizeTable: (t: TableRow, w: number, h: number) => void;
  guestsById: Map<string, Guest>;
  handleRef?: Ref<FloorPlanHandle>;
  className?: string;
}

function TableNode({ state, scale, selected, activeGuest, atTable, onSelect, onResize }: {
  state: TableState; scale: number; selected: boolean; activeGuest: Guest | null; atTable: boolean;
  onSelect: () => void; onResize: (w: number, h: number) => void;
}) {
  const t = state.table;
  const drag = useDraggable({ id: `table:${t.id}`, data: { type: "table", tableId: t.id } });
  const drop = useDroppable({ id: `drop:${t.id}`, data: { type: "table-drop", tableId: t.id } });
  const setRef = useCallback((n: HTMLElement | null) => { drag.setNodeRef(n); drop.setNodeRef(n); }, [drag, drop]);
  const [resizing, setResizing] = useState<{ w: number; h: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const w = resizing?.w ?? t.width, h = resizing?.h ?? t.height;
  const tx = drag.transform ? drag.transform.x / scale : 0, ty = drag.transform ? drag.transform.y / scale : 0;
  const over = drop.isOver && !!activeGuest;
  const fits = !activeGuest || canFit(state, activeGuest, atTable);
  const occupied = new Set(state.guests.flatMap((g) => g.seatNumbers));
  const dots = seatPositions(t.shape, t.capacity);
  const dot = t.capacity > 24 ? 9 : 13;

  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { x: e.clientX, y: e.clientY, w: t.width, h: t.height };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current; if (!r) return;
    const dw = (e.clientX - r.x) / scale, dh = (e.clientY - r.y) / scale;
    if (t.shape === "retangular") setResizing({ w: clamp(snap(r.w + dw), 80, 480), h: clamp(snap(r.h + dh), 60, 300) });
    else { const s = clamp(snap(Math.max(r.w + dw, r.h + dh)), 80, 360); setResizing({ w: s, h: s }); }
  };
  const onResizeUp = (e: React.PointerEvent) => {
    const r = resizeRef.current; resizeRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* já libertado */ }
    if (r && resizing && (resizing.w !== t.width || resizing.h !== t.height)) onResize(resizing.w, resizing.h);
    setResizing(null);
  };

  return (
    <div
      ref={setRef} {...drag.attributes} {...drag.listeners}
      data-table={t.id} role="button" tabIndex={0}
      aria-label={`${t.name}: ${state.used} de ${t.capacity} lugares ocupados${state.full ? ", cheia" : ""}. Clique para ver os convidados.`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(); drag.listeners?.onKeyDown?.(e); }}
      style={{ position: "absolute", left: t.x, top: t.y, width: w, height: h, transform: `translate3d(${tx}px, ${ty}px, 0)`, touchAction: "none", zIndex: drag.isDragging || selected ? 20 : 1 }}
      className={cn("select-none", drag.isDragging ? "cursor-grabbing" : "cursor-grab")}
    >
      <div className={cn(
        "relative size-full border-2 shadow-sm transition-[box-shadow,border-color,background-color]",
        t.shape === "redonda" ? "rounded-full" : "rounded-xl",
        state.full ? "border-gold bg-accent" : "border-sage-300 bg-card",
        selected && "ring-4 ring-sage-300/70",
        over && (fits ? "border-sage-500 bg-sage-100 ring-4 ring-sage-400/60" : "border-destructive bg-[#f4dfdb] ring-4 ring-destructive/40"),
        drag.isDragging && "shadow-xl",
      )}>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center leading-tight">
          <span className="line-clamp-2 font-serif text-base font-semibold text-sage-900" style={{ fontSize: clamp(Math.min(w, h) / 7, 12, 20) }}>{t.name}</span>
          <span className={cn("tabular-nums", state.full ? "font-semibold text-gold-600" : "text-muted-foreground")} style={{ fontSize: clamp(Math.min(w, h) / 10, 10, 14) }}>
            {state.used}/{t.capacity}{state.full ? " · cheia" : ` · ${state.free} livres`}
          </span>
        </div>
        {dots.map((p, i) => (
          <span key={i} aria-hidden className={cn("absolute rounded-full border", occupied.has(i + 1) ? "border-sage-600 bg-sage-500" : "border-sage-300 bg-background")}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: dot, height: dot, transform: "translate(-50%, -50%)" }} />
        ))}
      </div>
      {selected && !drag.isDragging && (
        <span role="separator" aria-label="Redimensionar mesa" title="Arraste para redimensionar"
          onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp}
          className="absolute -right-2 -bottom-2 z-30 size-5 cursor-nwse-resize rounded-full border-2 border-sage-500 bg-card shadow" style={{ touchAction: "none" }} />
      )}
    </div>
  );
}

/** Planta interativa: zoom (roda, botões, pinça), deslocação e mesas arrastáveis. */
export function FloorPlan({ view, selectedId, onSelect, onMoveTable, onResizeTable, guestsById, handleRef, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<ViewState>({ x: 24, y: 24, k: 1 });
  const vRef = useRef(v);
  useEffect(() => { vRef.current = v; }, [v]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const pinch = useRef<{ dist: number } | null>(null);
  const { active } = useDndContext();
  const activeGuest = active?.data.current?.type === "guest" ? (guestsById.get(active.data.current.guestId as string) ?? null) : null;
  const fitted = useRef(false);

  const size = () => { const r = box.current?.getBoundingClientRect(); return { w: r?.width ?? 800, h: r?.height ?? 600 }; };
  const fit = useCallback(() => { const s = size(); setV(fitView(view.tables.map((t) => t.table), s.w, s.h)); }, [view.tables]);
  const focus = useCallback((id: string) => {
    const t = view.byId.get(id)?.table; if (!t) return;
    const s = size(); setV((cur) => centerOn(t, cur, s.w, s.h));
  }, [view.byId]);
  useImperativeHandle(handleRef, () => ({ fit, focus, scale: () => vRef.current.k }), [fit, focus]);

  // Primeira vez: enquadra todas as mesas.
  useLayoutEffect(() => { if (!fitted.current && view.tables.length) { fitted.current = true; fit(); } }, [view.tables.length, fit]);

  // Zoom com a roda do rato (ouvinte não passivo para impedir o scroll da página).
  useEffect(() => {
    const el = box.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setV((cur) => zoomAt(cur, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-table]")) return;       // arrastar mesas é com o dnd-kit
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) pan.current = { x: e.clientX, y: e.clientY, vx: vRef.current.x, vy: vRef.current.y };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) }; pan.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const r = box.current!.getBoundingClientRect();
      const factor = dist / pinch.current.dist; pinch.current.dist = dist;
      setV((cur) => zoomAt(cur, factor, (a!.x + b!.x) / 2 - r.left, (a!.y + b!.y) / 2 - r.top));
    } else if (pan.current) {
      const p = pan.current;
      setV((cur) => ({ ...cur, x: p.vx + (e.clientX - p.x), y: p.vy + (e.clientY - p.y) }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const moved = pan.current ? Math.hypot(e.clientX - pan.current.x, e.clientY - pan.current.y) : 99;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) { pan.current = null; if (moved < 4) onSelect(null); }
  };

  const zoomBy = (f: number) => { const s = size(); setV((cur) => zoomAt(cur, f, s.w / 2, s.h / 2)); };

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-sand-100/60", className)}>
      <div ref={box} className="absolute inset-0 touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} role="application" aria-label="Planta do espaço. Arraste o fundo para deslocar; use a roda ou os botões para ampliar.">
        <div style={{ position: "absolute", left: 0, top: 0, width: WORLD.width, height: WORLD.height, transformOrigin: "0 0", transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})`,
          backgroundImage: "radial-gradient(circle, rgb(184 151 90 / 0.28) 1.2px, transparent 1.4px)", backgroundSize: "40px 40px" }}>
          {view.tables.map((s) => (
            <TableNode key={s.table.id} state={s} scale={v.k} selected={selectedId === s.table.id} activeGuest={activeGuest}
              atTable={!!activeGuest && view.tableOfGuest.get(activeGuest.id) === s.table.id}
              onSelect={() => onSelect(s.table.id)} onResize={(w, h) => onResizeTable(s.table, w, h)} />
          ))}
        </div>
      </div>

      {view.tables.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
          <div><p className="font-serif text-xl font-semibold text-sage-900">A planta está vazia</p><p className="mt-1 text-sm text-muted-foreground">Crie a primeira mesa com o botão “Nova mesa”.</p></div>
        </div>
      )}

      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 rounded-lg border bg-card/95 p-1 shadow-sm backdrop-blur">
        <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(1.25)} aria-label="Ampliar"><Plus /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(0.8)} aria-label="Reduzir"><Minus /></Button>
        <Button variant="ghost" size="icon-sm" onClick={fit} aria-label="Ajustar a planta ao ecrã"><Maximize2 /></Button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-full border bg-card/95 px-2.5 py-1 text-xs text-muted-foreground shadow-sm"><ZoomIn className="size-3.5" />{Math.round(v.k * 100)}%</div>
    </div>
  );
}
