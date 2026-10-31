"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Plus, Search, Upload, UserX, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/components/confirm";
import { ErrorState, EmptyState, PageHeader, SkeletonRows } from "@/components/page";
import { GroupsView } from "@/components/guests/groups-view";
import { GuestFormDialog } from "@/components/guests/guest-form";
import { GuestsTable } from "@/components/guests/guests-table";
import { ImportDialog } from "@/components/guests/import-dialog";
import { exportCsv, exportXlsx } from "@/components/guests/download";
import { useApi, useRun } from "@/lib/data/actions";
import { useGroups, useGuests, useSeatings, useSeats, useTables, useWedding, EMPTY } from "@/lib/data/queries";
import { guestsToRows } from "@/lib/domain/csv";
import { emptyFilters, filterGuests, sortGuests, type GuestFilters, type SortKey } from "@/lib/domain/guests";
import { buildSeatingView, seatLabel } from "@/lib/domain/seating";
import type { Guest } from "@/lib/db-types";
import { entries, invitationStatusLabel, rsvpStatusLabel, sideLabel } from "@/lib/labels";

const PAGE_SIZE = 50;

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="min-w-0 flex-1 sm:flex-none" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function GuestsPageInner() {
  const params = useSearchParams();
  const wedding = useWedding();
  const guestsQ = useGuests();
  const groups = useGroups().data ?? EMPTY;
  const tables = useTables().data ?? EMPTY;
  const seatings = useSeatings().data ?? EMPTY;
  const seats = useSeats().data ?? EMPTY;
  const api = useApi();
  const { run } = useRun();
  const confirm = useConfirm();
  const guests = guestsQ.data;

  const [filters, setFilters] = useState<GuestFilters>({
    ...emptyFilters,
    search: params.get("busca") ?? "",
    invitation: (params.get("convite") as GuestFilters["invitation"]) ?? "all",
    rsvp: (params.get("presenca") as GuestFilters["rsvp"]) ?? "all",
    table: params.get("mesa") ?? "all",
    side: (params.get("lado") as GuestFilters["side"]) ?? "all",
    groupId: params.get("grupo") ?? "all",
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "full_name", dir: "asc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const view = useMemo(() => buildSeatingView(tables, guests ?? [], seatings, seats), [tables, guests, seatings, seats]);
  const ctx = useMemo(() => ({
    groupName: (id: string | null) => groups.find((g) => g.id === id)?.name ?? "",
    tableName: (gid: string) => { const t = view.tableOfGuest.get(gid); return t ? (view.byId.get(t)?.table.name ?? "") : ""; },
  }), [groups, view]);

  const filtered = useMemo(() => sortGuests(filterGuests(guests ?? [], filters, view.tableOfGuest), sort.key, sort.dir, ctx), [guests, filters, view, sort, ctx]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const people = filtered.reduce((a, g) => a + g.invited_count, 0);
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(emptyFilters);

  useEffect(() => { setPage(0); }, [filters]);
  // Remove da seleção quem já não existe (ex.: apagado pelo outro noivo).
  useEffect(() => { if (guests) setSelected((s) => { const ids = new Set(guests.map((g) => g.id)); const n = new Set([...s].filter((i) => ids.has(i))); return n.size === s.size ? s : n; }); }, [guests]);

  const patch = (p: Partial<GuestFilters>) => setFilters((f) => ({ ...f, ...p }));
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const toggle = useCallback((id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; }), []);
  const togglePage = (on: boolean) => setSelected((s) => { const n = new Set(s); pageRows.forEach((g) => (on ? n.add(g.id) : n.delete(g.id))); return n; });

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (g: Guest) => { setEditing(g); setFormOpen(true); };
  const onDuplicate = (g: Guest) => run(() => api.duplicateGuest(g), { success: `“${g.full_name}” duplicado.`, invalidate: ["guests", "invitations"] });
  const onDelete = async (g: Guest) => {
    const seated = view.tableOfGuest.has(g.id);
    if (await confirm({ title: `Eliminar ${g.full_name}?`, description: `Esta ação não pode ser desfeita.${seated ? " O convidado deixa de ocupar lugares na mesa." : ""}` }))
      await run(() => api.deleteGuests([g.id]), { success: "Convidado eliminado.", invalidate: ["guests", "invitations", "guest_seatings", "table_seats", "rsvp_responses"] });
  };
  const bulk = async (patchData: Parameters<typeof api.bulkGuests>[1], msg: string) => {
    const ids = [...selected];
    const ok = await run(() => api.bulkGuests(ids, patchData).then(() => true), { success: `${msg} (${ids.length}).`, invalidate: ["guests", "invitations", "guest_seatings", "table_seats"] });
    if (ok) setSelected(new Set());
  };
  const bulkDelete = async () => {
    const ids = [...selected];
    if (await confirm({ title: `Eliminar ${ids.length} convidados?`, description: "Esta ação não pode ser desfeita." }))
      if (await run(() => api.deleteGuests(ids).then(() => true), { success: `${ids.length} convidados eliminados.`, invalidate: ["guests", "invitations", "guest_seatings", "table_seats", "rsvp_responses"] })) setSelected(new Set());
  };

  const exportRows = () => guestsToRows(filtered, {
    wedding, groups,
    tableOf: (id) => ctx.tableName(id),
    seatsOf: (id) => { const t = view.tableOfGuest.get(id); return t ? seatLabel(view.byId.get(t)?.guests.find((x) => x.guest.id === id)?.seatNumbers ?? []) : ""; },
  });

  const actions = (
    <>
      <Button onClick={openNew}><Plus /> Adicionar convidado</Button>
      <Button variant="outline" onClick={() => setImportOpen(true)}><Upload /> Importar</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" disabled={!filtered.length}><Download /> Exportar</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => exportCsv(exportRows())}><FileText /> CSV ({filtered.length})</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportXlsx(exportRows())}><FileSpreadsheet /> Excel ({filtered.length})</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <>
      <PageHeader title="Convidados" description="Registe, filtre e acompanhe todas as pessoas convidadas." actions={actions} />
      <Tabs defaultValue="lista">
        <TabsList><TabsTrigger value="lista"><Users />Lista</TabsTrigger><TabsTrigger value="familias">Famílias e grupos</TabsTrigger></TabsList>

        <TabsContent value="lista" className="grid gap-3">
          <div className="grid gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={filters.search} onChange={(e) => patch({ search: e.target.value })} placeholder="Pesquisar por nome, email ou telefone…" className="pl-9" aria-label="Pesquisar convidados" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect label="Grupo" value={filters.groupId} onChange={(v) => patch({ groupId: v })} options={[{ value: "all", label: "Todos os grupos" }, { value: "none", label: "Sem grupo" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
              <FilterSelect label="Lado" value={filters.side} onChange={(v) => patch({ side: v as GuestFilters["side"] })} options={[{ value: "all", label: "Todos os lados" }, { value: "partner1", label: sideLabel("partner1", wedding) }, { value: "partner2", label: sideLabel("partner2", wedding) }, { value: "both", label: "Ambos" }]} />
              <FilterSelect label="Estado do convite" value={filters.invitation} onChange={(v) => patch({ invitation: v as GuestFilters["invitation"] })} options={[{ value: "all", label: "Todos os convites" }, ...entries(invitationStatusLabel)]} />
              <FilterSelect label="Presença" value={filters.rsvp} onChange={(v) => patch({ rsvp: v as GuestFilters["rsvp"] })} options={[{ value: "all", label: "Toda a presença" }, ...entries(rsvpStatusLabel)]} />
              <FilterSelect label="Mesa" value={filters.table} onChange={(v) => patch({ table: v })} options={[{ value: "all", label: "Todas as mesas" }, { value: "none", label: "Sem mesa" }, ...tables.map((t) => ({ value: t.id, label: t.name }))]} />
              {hasFilters && <Button variant="ghost" size="sm" onClick={() => setFilters(emptyFilters)}><X /> Limpar filtros</Button>}
            </div>
          </div>

          {selected.size > 0 && (
            <div role="region" aria-label="Ações em massa" className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-sage-300 bg-sage-50 p-2.5 shadow-sm">
              <span className="px-1 text-sm font-medium">{selected.size} selecionados</span>
              <Select value="" onValueChange={(v) => bulk({ invitation_status: v as never }, "Estado do convite alterado")}><SelectTrigger size="sm" aria-label="Alterar estado do convite"><SelectValue placeholder="Alterar convite…" /></SelectTrigger><SelectContent>{entries(invitationStatusLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
              <Select value="" onValueChange={(v) => bulk({ rsvp_status: v as never }, "Presença alterada")}><SelectTrigger size="sm" aria-label="Alterar presença"><SelectValue placeholder="Alterar presença…" /></SelectTrigger><SelectContent>{entries(rsvpStatusLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
              <Select value="" onValueChange={(v) => bulk({ group_id: v === "none" ? null : v }, "Grupo alterado")}><SelectTrigger size="sm" aria-label="Atribuir grupo"><SelectValue placeholder="Atribuir grupo…" /></SelectTrigger><SelectContent><SelectItem value="none">Sem grupo</SelectItem>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>
              <Button size="sm" variant="destructive" onClick={bulkDelete}>Eliminar</Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
            </div>
          )}

          {guestsQ.isPending ? <SkeletonRows n={8} /> : guestsQ.isError ? <ErrorState onRetry={() => guestsQ.refetch()} /> : guests!.length === 0 ? (
            <EmptyState icon={Users} title="Ainda não há convidados" description="Adicione o primeiro convidado ou importe a sua lista a partir de um ficheiro Excel ou CSV." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={openNew}><Plus /> Adicionar convidado</Button><Button variant="outline" onClick={() => setImportOpen(true)}><Upload /> Importar lista</Button></div>} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={UserX} title="Nenhum convidado corresponde aos filtros" description="Tente outra pesquisa ou limpe os filtros." action={<Button variant="outline" onClick={() => setFilters(emptyFilters)}>Limpar filtros</Button>} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground" aria-live="polite">{filtered.length} {filtered.length === 1 ? "registo" : "registos"} · <strong className="text-foreground">{people} {people === 1 ? "pessoa" : "pessoas"}</strong>{hasFilters && guests!.length !== filtered.length && ` (de ${guests!.length} registos)`}</p>
              <GuestsTable guests={pageRows} groups={groups} wedding={wedding} view={view} selected={selected} onToggle={toggle} onTogglePage={togglePage} sort={sort} onSort={onSort} onEdit={openEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
              {selected.size > 0 && selected.size < filtered.length && pageRows.every((g) => selected.has(g.id)) && pageCount > 1 && (
                <button className="w-fit text-sm text-primary underline-offset-4 hover:underline" onClick={() => setSelected(new Set(filtered.map((g) => g.id)))}>Selecionar os {filtered.length} convidados filtrados</button>
              )}
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <Button variant="outline" size="icon-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Página anterior"><ChevronLeft /></Button>
                  <span className="text-sm text-muted-foreground">Página {safePage + 1} de {pageCount}</span>
                  <Button variant="outline" size="icon-sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Página seguinte"><ChevronRight /></Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="familias"><GroupsView /></TabsContent>
      </Tabs>

      <GuestFormDialog open={formOpen} onOpenChange={setFormOpen} guest={editing} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}

export default function GuestsPage() {
  return <Suspense fallback={<SkeletonRows n={8} />}><GuestsPageInner /></Suspense>;
}
