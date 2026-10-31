"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCheck, Copy, MailCheck, MailQuestion, MessageSquareText, MoreHorizontal, Search, Send, Settings2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InvitationDialog } from "@/components/invites/invitation-dialog";
import { ManualRsvpDialog } from "@/components/invites/manual-rsvp-dialog";
import { copyLink, rsvpUrl } from "@/components/invites/rsvp-link";
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Stat } from "@/components/page";
import { InvitationBadge, RsvpBadge } from "@/components/status";
import { useApi, useRun } from "@/lib/data/actions";
import { useGuests, useInvitations, useRsvpResponses, useWedding, EMPTY } from "@/lib/data/queries";
import { readPreferences } from "@/lib/preferences";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { followUpState, normalizeText, type FollowUp } from "@/lib/domain/guests";
import type { Guest, Invitation } from "@/lib/db-types";
import { channelLabel } from "@/lib/labels";

type Filter = "all" | "contact" | "to_invite" | "to_follow_up" | "waiting" | "done";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "contact", label: "A contactar" }, { value: "to_invite", label: "Por convidar" }, { value: "to_follow_up", label: "Sem resposta há dias" },
  { value: "waiting", label: "À espera" }, { value: "done", label: "Responderam" }, { value: "all", label: "Todos" },
];

export default function InvitationsPage() {
  const guestsQ = useGuests();
  const invQ = useInvitations();
  const prefs = readPreferences(useWedding());
  const responses = useRsvpResponses().data ?? EMPTY;
  const api = useApi();
  const { run } = useRun();
  const [filter, setFilter] = useState<Filter>("contact");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dlg, setDlg] = useState<{ guest: Guest; inv: Invitation; kind: "invite" | "rsvp" } | null>(null);

  const guests = guestsQ.data ?? EMPTY;
  const invByGuest = useMemo(() => new Map((invQ.data ?? EMPTY).map((i) => [i.guest_id, i])), [invQ.data]);
  const now = useMemo(() => new Date(), []);
  const state = (g: Guest): FollowUp => followUpState(g, invByGuest.get(g.id), now, prefs.followUpDays);

  const counts = useMemo(() => {
    const c = { to_invite: 0, to_follow_up: 0, waiting: 0, done: 0 };
    for (const g of guests) c[state(g)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, invByGuest, prefs.followUpDays]);

  const rows = useMemo(() => guests.filter((g) => {
    const s = state(g);
    if (filter === "contact" ? !(s === "to_invite" || s === "to_follow_up") : filter !== "all" && s !== filter) return false;
    return !q || normalizeText([g.full_name, g.phone, g.email].filter(Boolean).join(" ")).includes(normalizeText(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [guests, invByGuest, filter, q, prefs.followUpDays]);

  const recent = responses.slice(0, 6);
  const guestName = (id: string) => guests.find((g) => g.id === id)?.full_name ?? "Convidado";
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const invalidate = ["guests", "invitations"];

  const markStatus = (ids: string[], status: "enviado" | "entregue") =>
    run(() => api.bulkGuests(ids, { invitation_status: status }).then(() => true), { success: `${ids.length} ${ids.length === 1 ? "convite marcado" : "convites marcados"} como ${status === "enviado" ? "enviados" : "entregues"}.`, invalidate }).then((ok) => { if (ok) setSelected(new Set()); });
  const contacted = (inv: Invitation) => run(() => api.updateInvitation(inv.id, { last_contacted_at: new Date().toISOString() }), { success: "Contacto registado.", invalidate: ["invitations"] });

  return (
    <>
      <PageHeader title="Convites e confirmações" description="Acompanhe o envio dos convites, as respostas e quem ainda precisa de ser contactado." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Por convidar" value={counts.to_invite} icon={Send} hint="Convite ainda não enviado" tone="warning" />
        <Stat label="Sem resposta há dias" value={counts.to_follow_up} icon={BellRing} hint={`Sem resposta há ${prefs.followUpDays}+ dias`} tone="warning" />
        <Stat label="À espera" value={counts.waiting} icon={MailQuestion} hint="Enviado há pouco tempo" />
        <Stat label="Responderam" value={counts.done} icon={UserCheck} hint="Confirmaram ou recusaram" tone="gold" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <section className="grid min-w-0 gap-3">
          <div className="flex flex-col gap-2">
            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} className="w-full overflow-x-auto" aria-label="Filtrar convites">
              {FILTERS.map((f) => <ToggleGroupItem key={f.value} value={f.value} className="shrink-0">{f.label}</ToggleGroupItem>)}
            </ToggleGroup>
            <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar convidado…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar convidado" /></div>
          </div>

          {selected.size > 0 && (
            <div role="region" aria-label="Ações em massa" className="flex flex-wrap items-center gap-2 rounded-xl border border-sage-300 bg-sage-50 p-2.5">
              <span className="px-1 text-sm font-medium">{selected.size} selecionados</span>
              <Button size="sm" variant="outline" onClick={() => markStatus([...selected], "enviado")}><Send /> Marcar enviados</Button>
              <Button size="sm" variant="outline" onClick={() => markStatus([...selected], "entregue")}><CheckCheck /> Marcar entregues</Button>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          )}

          {guestsQ.isPending || invQ.isPending ? <SkeletonRows n={8} /> : guestsQ.isError ? <ErrorState onRetry={() => guestsQ.refetch()} /> : guests.length === 0 ? (
            <EmptyState icon={MailCheck} title="Ainda não há convites para acompanhar" description="Adicione os convidados primeiro: cada convidado tem automaticamente o seu convite e o seu link de confirmação." action={<Button asChild><Link href="/convidados">Ir para Convidados</Link></Button>} />
          ) : rows.length === 0 ? (
            <EmptyState icon={CheckCheck} title={filter === "contact" ? "Ninguém precisa de ser contactado agora" : "Nenhum convidado nesta lista"} description={filter === "contact" ? "Todos os convites foram enviados e há respostas ou é cedo para insistir." : "Experimente outro filtro."} action={<Button variant="outline" onClick={() => setFilter("all")}>Ver todos</Button>} />
          ) : (
            <>
              <div className="hidden rounded-xl border bg-card md:block">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead><Checkbox aria-label="Selecionar todos" checked={rows.length > 0 && rows.every((g) => selected.has(g.id))} onCheckedChange={(c) => setSelected(c === true ? new Set(rows.map((g) => g.id)) : new Set())} /></TableHead>
                    <TableHead>Convidado</TableHead><TableHead>Convite</TableHead><TableHead className="hidden lg:table-cell">Enviado</TableHead><TableHead className="hidden lg:table-cell">Resposta</TableHead><TableHead>Presença</TableHead><TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map((g) => {
                      const inv = invByGuest.get(g.id);
                      return (
                        <TableRow key={g.id}>
                          <TableCell><Checkbox aria-label={`Selecionar ${g.full_name}`} checked={selected.has(g.id)} onCheckedChange={(c) => toggle(g.id, c === true)} /></TableCell>
                          <TableCell className="max-w-[14rem]"><p className="truncate font-medium">{g.full_name}</p><p className="truncate text-xs text-muted-foreground">{inv?.channel ? channelLabel[inv.channel] : g.phone ?? g.email ?? "Sem contacto"}</p></TableCell>
                          <TableCell><InvitationBadge status={g.invitation_status} /></TableCell>
                          <TableCell className="hidden text-sm lg:table-cell">{formatShortDate(inv?.sent_at?.slice(0, 10))}</TableCell>
                          <TableCell className="hidden text-sm lg:table-cell">{formatShortDate(inv?.responded_at?.slice(0, 10))}</TableCell>
                          <TableCell><RsvpBadge status={g.rsvp_status} /></TableCell>
                          <TableCell>{inv && <RowMenu g={g} inv={inv} onOpen={(kind) => setDlg({ guest: g, inv, kind })} onMark={(s) => markStatus([g.id], s)} onContacted={() => contacted(inv)} />}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ul className="grid gap-2 md:hidden">
                {rows.map((g) => {
                  const inv = invByGuest.get(g.id);
                  return (
                    <li key={g.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox className="mt-1" aria-label={`Selecionar ${g.full_name}`} checked={selected.has(g.id)} onCheckedChange={(c) => toggle(g.id, c === true)} />
                        <div className="min-w-0 flex-1"><p className="truncate font-medium">{g.full_name}</p><p className="truncate text-xs text-muted-foreground">{g.phone ?? g.email ?? "Sem contacto"}</p></div>
                        {inv && <RowMenu g={g} inv={inv} onOpen={(kind) => setDlg({ guest: g, inv, kind })} onMark={(s) => markStatus([g.id], s)} onContacted={() => contacted(inv)} />}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-7"><InvitationBadge status={g.invitation_status} /><RsvpBadge status={g.rsvp_status} /></div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <aside className="min-w-0">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MessageSquareText className="size-4 text-gold" />Últimas respostas</CardTitle></CardHeader>
            <CardContent>
              {recent.length === 0 ? <p className="text-sm text-muted-foreground">As respostas dos convidados (pelo link ou registadas por si) aparecem aqui.</p> : (
                <ul className="grid gap-3">
                  {recent.map((r) => (
                    <li key={r.id} className="text-sm">
                      <p className="font-medium">{guestName(r.guest_id)} <span className={r.status === "confirmado" ? "text-sage-600" : "text-destructive"}>· {r.status === "confirmado" ? "confirmou" : "recusou"}</span></p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.submitted_at)} · {r.source === "link" ? "pelo link" : "manual"}</p>
                      {r.message && <p className="mt-0.5 text-muted-foreground">“{r.message}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {dlg?.kind === "invite" && <InvitationDialog open onOpenChange={(o) => !o && setDlg(null)} guest={dlg.guest} invitation={dlg.inv} />}
      {dlg?.kind === "rsvp" && <ManualRsvpDialog open onOpenChange={(o) => !o && setDlg(null)} guest={dlg.guest} />}
    </>
  );
}

function RowMenu({ g, inv, onOpen, onMark, onContacted }: { g: Guest; inv: Invitation; onOpen: (k: "invite" | "rsvp") => void; onMark: (s: "enviado" | "entregue") => void; onContacted: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações para ${g.full_name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onMark("enviado")}><Send /> Marcar como enviado</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onMark("entregue")}><CheckCheck /> Marcar como entregue</DropdownMenuItem>
        <DropdownMenuItem onSelect={onContacted}><BellRing /> Registar contacto agora</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpen("rsvp")}><UserCheck /> Registar resposta…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copyLink(rsvpUrl(inv.token))}><Copy /> Copiar link de RSVP</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpen("invite")}><Settings2 /> Detalhes do convite…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
