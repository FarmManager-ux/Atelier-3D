"use client";

import { Armchair, MoveRight, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { canFit, seatLabel, type SeatingView, type TableState } from "@/lib/domain/seating";
import { personLabel } from "@/lib/domain/guests";
import { shapeLabel } from "@/lib/labels";
import type { Guest } from "@/lib/db-types";
import { GuestChip } from "./unseated-panel";

export interface TableActions {
  assign: (g: Guest, tableId: string) => Promise<boolean> | void;
  unassign: (g: Guest) => Promise<boolean> | void;
  onEdit: (tableId: string) => void;
  onDelete: (tableId: string) => void;
}

/** Conteúdo de uma mesa: ocupação, lista de convidados com lugares e ações. */
export function TableDetails({ state, view, actions, draggable = true, className }: { state: TableState; view: SeatingView; actions: TableActions; draggable?: boolean; className?: string }) {
  const t = state.table;
  const pct = Math.round((state.used / t.capacity) * 100);
  const others = view.tables.filter((s) => s.table.id !== t.id);


  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-2xl font-semibold text-sage-900">{t.name}</h2>
          <p className="text-xs text-muted-foreground">{shapeLabel[t.shape]} · {t.capacity} lugares</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => actions.onEdit(t.id)} aria-label={`Editar ${t.name}`}><Pencil /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => actions.onDelete(t.id)} aria-label={`Eliminar ${t.name}`}><Trash2 /></Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span><strong className="tabular-nums">{state.used}</strong> ocupados · <strong className="tabular-nums">{state.free}</strong> livres</span>
          {state.full ? <Badge variant="gold">Mesa cheia</Badge> : <Badge variant="default">{pct}%</Badge>}
        </div>
        <Progress value={pct} indicatorClassName={state.full ? "bg-gold" : undefined} aria-label={`${state.used} de ${t.capacity} lugares ocupados`} />
      </div>
      {t.notes && <p className="rounded-md bg-secondary/70 p-2 text-sm text-muted-foreground">{t.notes}</p>}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {state.guests.length === 0 ? (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Armchair className="size-4 text-sage-300" />Mesa vazia. Arraste convidados para aqui ou use “Adicionar”.</p>
        ) : state.guests.map((sg) => <TableGuestRow key={sg.guest.id} sg={sg} others={others} actions={actions} draggable={draggable} />)}
      </div>

      <Select value="" onValueChange={(gid) => { const g = view.unseated.find((x) => x.id === gid); if (g) actions.assign(g, t.id); }}>
        <SelectTrigger className="w-full" disabled={view.unseated.length === 0} aria-label="Adicionar convidado a esta mesa"><UserPlus className="size-4" /><SelectValue placeholder={view.unseated.length ? "Adicionar convidado…" : "Não há convidados sem mesa"} /></SelectTrigger>
        <SelectContent>
          {view.unseated.map((g) => { const ok = canFit(state, g); return <SelectItem key={g.id} value={g.id} disabled={!ok}>{g.full_name} · {g.expected_count}{ok ? "" : " (não cabe)"}</SelectItem>; })}
        </SelectContent>
      </Select>
    </div>
  );
}

function TableGuestRow({ sg, others, actions, draggable }: { sg: TableState["guests"][number]; others: TableState[]; actions: TableActions; draggable: boolean }) {
  const content = (
    <>
      <Select value="" onValueChange={(id) => actions.assign(sg.guest, id)}>
        <SelectTrigger size="sm" className="h-7 w-auto gap-1 px-2 text-xs" aria-label={`Mover ${sg.guest.full_name} para outra mesa`} onPointerDown={(e) => e.stopPropagation()}><MoveRight className="size-3.5" /><SelectValue placeholder="Mover" /></SelectTrigger>
        <SelectContent>
          {others.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Não há outras mesas.</div>}
          {others.map((s) => { const ok = canFit(s, sg.guest); return <SelectItem key={s.table.id} value={s.table.id} disabled={!ok}>{s.table.name} · {s.free} livres{ok ? "" : " (não cabe)"}</SelectItem>; })}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon-sm" onClick={() => actions.unassign(sg.guest)} onPointerDown={(e) => e.stopPropagation()} aria-label={`Retirar ${sg.guest.full_name} da mesa`}><UserMinus /></Button>
    </>
  );
  const names = sg.people > 1 ? Array.from({ length: sg.people - 1 }, (_, i) => personLabel(sg.guest, i + 1)).join(", ") : "";
  if (draggable) return <GuestChip guest={sg.guest} className="py-1.5" subtitle={<>Lugar {seatLabel(sg.seatNumbers)}{names && ` · ${names}`}</>}>{content}</GuestChip>;
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm">
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{sg.guest.full_name}</p><p className="truncate text-xs text-muted-foreground">Lugar {seatLabel(sg.seatNumbers)}{names && ` · ${names}`}</p></div>
      {content}
    </div>
  );
}
