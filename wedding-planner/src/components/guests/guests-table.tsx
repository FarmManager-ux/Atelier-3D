"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvitationBadge, RsvpBadge } from "@/components/status";
import type { Guest, GuestGroup, Wedding } from "@/lib/db-types";
import type { SortKey } from "@/lib/domain/guests";
import type { SeatingView } from "@/lib/domain/seating";
import { seatLabel } from "@/lib/domain/seating";
import { categoryLabel, sideLabel } from "@/lib/labels";

export interface GuestRowActions { onEdit: (g: Guest) => void; onDuplicate: (g: Guest) => void; onDelete: (g: Guest) => void }

interface Props extends GuestRowActions {
  guests: Guest[];
  groups: GuestGroup[];
  wedding: Wedding;
  view: SeatingView;
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onTogglePage: (on: boolean) => void;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
}

function RowMenu({ g, ...a }: { g: Guest } & GuestRowActions) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações para ${g.full_name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => a.onEdit(g)}><Pencil /> Editar</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => a.onDuplicate(g)}><Copy /> Duplicar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => a.onDelete(g)}><Trash2 /> Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PeopleBadge({ g }: { g: Guest }) {
  const parts = [g.companions_count ? `+${g.companions_count}` : "", g.children_count ? `${g.children_count} cr.` : ""].filter(Boolean).join(" · ");
  return (
    <span className="tabular-nums" title={`${g.invited_count} pessoas convidadas${g.expected_count !== g.invited_count ? ` · ${g.expected_count} esperadas` : ""}`}>
      {g.invited_count}{parts && <span className="ml-1 text-xs text-muted-foreground">({parts})</span>}
    </span>
  );
}

function SeatCell({ g, view }: { g: Guest; view: SeatingView }) {
  const tid = view.tableOfGuest.get(g.id);
  if (!tid) return <span className="text-xs text-muted-foreground">{g.expected_count === 0 ? "—" : "Sem mesa"}</span>;
  const state = view.byId.get(tid);
  const nums = state?.guests.find((x) => x.guest.id === g.id)?.seatNumbers ?? [];
  return <span className="text-sm">{state?.table.name}<span className="ml-1 text-xs text-muted-foreground">· lugar {seatLabel(nums)}</span></span>;
}

function SortHead({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: Props["sort"]; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => onSort(k)} className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none">
        {label}<Icon className={active ? "size-3.5 text-sage-600" : "size-3.5 opacity-40"} />
      </button>
    </TableHead>
  );
}

export function GuestsTable(p: Props) {
  const group = (id: string | null) => p.groups.find((g) => g.id === id)?.name;
  const allOn = p.guests.length > 0 && p.guests.every((g) => p.selected.has(g.id));
  const someOn = p.guests.some((g) => p.selected.has(g.id));

  return (
    <>
      {/* Tabela (tablet e computador) */}
      <div className="hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Checkbox checked={allOn ? true : someOn ? "indeterminate" : false} onCheckedChange={(c) => p.onTogglePage(c === true)} aria-label="Selecionar todos os desta página" /></TableHead>
              <SortHead label="Nome" k="full_name" sort={p.sort} onSort={p.onSort} />
              <SortHead label="Grupo" k="group" sort={p.sort} onSort={p.onSort} className="hidden xl:table-cell" />
              <SortHead label="Lado" k="side" sort={p.sort} onSort={p.onSort} className="hidden lg:table-cell" />
              <SortHead label="Pessoas" k="people" sort={p.sort} onSort={p.onSort} />
              <SortHead label="Convite" k="invitation_status" sort={p.sort} onSort={p.onSort} />
              <SortHead label="Presença" k="rsvp_status" sort={p.sort} onSort={p.onSort} />
              <SortHead label="Mesa" k="table" sort={p.sort} onSort={p.onSort} />
              <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.guests.map((g) => (
              <TableRow key={g.id} data-state={p.selected.has(g.id) ? "selected" : undefined}>
                <TableCell><Checkbox checked={p.selected.has(g.id)} onCheckedChange={(c) => p.onToggle(g.id, c === true)} aria-label={`Selecionar ${g.full_name}`} /></TableCell>
                <TableCell className="max-w-[16rem]">
                  <button className="block max-w-full truncate text-left font-medium hover:underline" onClick={() => p.onEdit(g)}>{g.full_name}</button>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{categoryLabel[g.category]}</span>{g.age_group === "crianca" && <span>Criança</span>}
                    {(g.dietary_restrictions || g.allergies) && <span title={[g.dietary_restrictions, g.allergies].filter(Boolean).join(" · ")}>⚠ dieta/alergias</span>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm xl:table-cell">{group(g.group_id) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="hidden text-sm lg:table-cell">{sideLabel(g.side, p.wedding)}</TableCell>
                <TableCell><PeopleBadge g={g} /></TableCell>
                <TableCell><InvitationBadge status={g.invitation_status} /></TableCell>
                <TableCell><RsvpBadge status={g.rsvp_status} /></TableCell>
                <TableCell><SeatCell g={g} view={p.view} /></TableCell>
                <TableCell><RowMenu g={g} onEdit={p.onEdit} onDuplicate={p.onDuplicate} onDelete={p.onDelete} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cartões (telemóvel) */}
      <ul className="grid gap-2 md:hidden">
        <li className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          <Checkbox checked={allOn ? true : someOn ? "indeterminate" : false} onCheckedChange={(c) => p.onTogglePage(c === true)} aria-label="Selecionar todos os desta página" />Selecionar página
        </li>
        {p.guests.map((g) => (
          <li key={g.id} className="rounded-xl border bg-card p-3 data-[selected=true]:border-sage-300 data-[selected=true]:bg-sage-50" data-selected={p.selected.has(g.id)}>
            <div className="flex items-start gap-3">
              <Checkbox className="mt-1" checked={p.selected.has(g.id)} onCheckedChange={(c) => p.onToggle(g.id, c === true)} aria-label={`Selecionar ${g.full_name}`} />
              <button className="min-w-0 flex-1 text-left" onClick={() => p.onEdit(g)}>
                <span className="block truncate font-medium">{g.full_name}</span>
                <span className="block truncate text-xs text-muted-foreground">{[group(g.group_id), sideLabel(g.side, p.wedding), categoryLabel[g.category]].filter(Boolean).join(" · ")}</span>
              </button>
              <RowMenu g={g} onEdit={p.onEdit} onDuplicate={p.onDuplicate} onDelete={p.onDelete} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
              <InvitationBadge status={g.invitation_status} /><RsvpBadge status={g.rsvp_status} />
              <Badge variant="outline">{g.invited_count} {g.invited_count === 1 ? "pessoa" : "pessoas"}</Badge>
              <span className="ml-auto"><SeatCell g={g} view={p.view} /></span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
