"use client";

import { useMemo, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { AlertTriangle, GripVertical, Search, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/lib/domain/guests";
import { canFit, type SeatingView } from "@/lib/domain/seating";
import type { Guest } from "@/lib/db-types";

/** Aspeto do cartão de um convidado (sem lógica de arrastar: serve também para a sobreposição durante o arrasto). */
export function GuestChipView({ guest, children, className, subtitle, ...rest }: { guest: Guest; children?: React.ReactNode; className?: string; subtitle?: React.ReactNode } & React.ComponentProps<"div">) {
  return (
    <div {...rest} className={cn("flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-sm shadow-xs select-none", className)}>
      <GripVertical className="size-4 shrink-0 text-sage-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{guest.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {subtitle ?? <>{guest.expected_count} {guest.expected_count === 1 ? "lugar" : "lugares"}</>}
          {(guest.dietary_restrictions || guest.allergies) && <span className="ml-1.5 text-gold-600" title={[guest.dietary_restrictions, guest.allergies].filter(Boolean).join(" · ")}>⚠ dieta</span>}
        </p>
      </div>
      {children}
    </div>
  );
}

/** Cartão arrastável de um convidado (usado na lista "sem mesa" e dentro das mesas). */
export function GuestChip({ guest, children, className, dragId, subtitle }: { guest: Guest; children?: React.ReactNode; className?: string; dragId?: string; subtitle?: React.ReactNode }) {
  const drag = useDraggable({ id: dragId ?? `guest:${guest.id}`, data: { type: "guest", guestId: guest.id } });
  return (
    <GuestChipView ref={drag.setNodeRef as never} {...drag.attributes} {...drag.listeners} style={{ touchAction: "none" }} guest={guest} subtitle={subtitle}
      className={cn("cursor-grab", drag.isDragging && "opacity-40", className)}>{children}</GuestChipView>
  );
}

/** Lista lateral dos convidados ainda sem mesa. Também é zona de largada para retirar convidados de uma mesa. */
export function UnseatedPanel({ view, onAssign, className }: { view: SeatingView; onAssign: (g: Guest, tableId: string) => void; className?: string }) {
  const [q, setQ] = useState("");
  const drop = useDroppable({ id: "drop:unseated", data: { type: "unseated" } });
  const list = useMemo(() => view.unseated.filter((g) => !q || normalizeText(g.full_name).includes(normalizeText(q))), [view.unseated, q]);
  const people = view.unseated.reduce((a, g) => a + g.expected_count, 0);

  return (
    <section ref={drop.setNodeRef} aria-label="Convidados sem mesa"
      className={cn("flex min-h-0 flex-col gap-2 rounded-xl border bg-card p-3 transition-colors", drop.isOver && "border-sage-400 bg-sage-50 ring-2 ring-sage-300", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold">Sem mesa</h2>
        <Badge variant={view.unseated.length ? "warning" : "success"}>{view.unseated.length ? `${view.unseated.length} · ${people} ${people === 1 ? "pessoa" : "pessoas"}` : "Todos sentados"}</Badge>
      </div>
      {view.unseated.length > 6 && (
        <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar…" className="h-8 pl-8 text-sm" aria-label="Procurar convidado sem mesa" /></div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {view.unseated.length === 0 ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><UserCheck className="size-4 text-sage-500" />Todos os convidados têm lugar. Arraste um convidado para aqui para o retirar da mesa.</p>
        ) : list.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Ninguém encontrado.</p> : list.map((g) => (
          <GuestChip key={g.id} guest={g}>
            <Select value="" onValueChange={(t) => onAssign(g, t)}>
              <SelectTrigger size="sm" className="h-7 w-auto gap-1 px-2 text-xs" aria-label={`Atribuir ${g.full_name} a uma mesa`} onPointerDown={(e) => e.stopPropagation()}><SelectValue placeholder="Mesa…" /></SelectTrigger>
              <SelectContent>
                {view.tables.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Crie uma mesa primeiro.</div>}
                {view.tables.map((s) => { const fits = canFit(s, g); return <SelectItem key={s.table.id} value={s.table.id} disabled={!fits}>{s.table.name} · {s.free} livres{fits ? "" : " (não cabe)"}</SelectItem>; })}
              </SelectContent>
            </Select>
          </GuestChip>
        ))}
      </div>
      {view.tables.length > 0 && view.unseated.some((g) => !view.tables.some((t) => canFit(t, g))) && (
        <p className="flex items-start gap-1.5 rounded-md bg-[#f6ead0] p-2 text-xs text-[#7a5a12]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Alguns convidados não cabem em nenhuma mesa com lugares livres. Aumente uma capacidade ou crie uma mesa.</p>
      )}
    </section>
  );
}
