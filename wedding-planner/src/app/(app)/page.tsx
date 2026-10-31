"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight, Armchair, CalendarHeart, CheckCircle2, Clock, Heart, MailCheck, MailQuestion, Percent, Send, UserCheck, UserPlus, Users, UserX, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { DistributionBars, Donut, EvolutionArea } from "@/components/dashboard/charts";
import { EmptyState, ErrorState, PageHeader, Stat } from "@/components/page";
import { PriorityBadge } from "@/components/status";
import { useExpenses, useGroups, useGuests, useInvitations, useSeatings, useTables, useTasks, useWedding, EMPTY } from "@/lib/data/queries";
import { countdown, formatDate, formatShortDate } from "@/lib/dates";
import { computeBudget, overdue } from "@/lib/domain/budget";
import { computeGuestStats, computeSeatStats, confirmationEvolution, distribution } from "@/lib/domain/stats";
import { followUpState } from "@/lib/domain/guests";
import { formatEuro } from "@/lib/money";
import { categoryLabel, sideLabel } from "@/lib/labels";
import { readPreferences } from "@/lib/preferences";

export default function DashboardPage() {
  const wedding = useWedding();
  const guestsQ = useGuests();
  const groups = useGroups().data ?? EMPTY;
  const invitations = useInvitations().data ?? EMPTY;
  const tables = useTables().data ?? EMPTY;
  const seatings = useSeatings().data ?? EMPTY;
  const expensesQ = useExpenses();
  const tasksQ = useTasks();
  const [by, setBy] = useState<"category" | "group" | "side">("category");

  const guests = guestsQ.data ?? EMPTY;
  const expenses = expensesQ.data ?? EMPTY;
  const tasks = tasksQ.data ?? EMPTY;
  const cd = countdown(wedding.wedding_date);
  const prefs = readPreferences(wedding);
  const today = format(new Date(), "yyyy-MM-dd");

  const g = useMemo(() => computeGuestStats(guests), [guests]);
  const seat = useMemo(() => computeSeatStats(tables, seatings, guests), [tables, seatings, guests]);
  const budget = useMemo(() => computeBudget(wedding.total_budget, expenses), [wedding.total_budget, expenses]);
  const evolution = useMemo(() => confirmationEvolution(guests, invitations), [guests, invitations]);
  const dist = useMemo(() => distribution(guests, by, { group: groups, side: { partner1: wedding.partner1_name, partner2: wedding.partner2_name, both: "Ambos" }, category: categoryLabel }).map((d) => ({ label: d.label, people: d.people })), [guests, groups, by, wedding]);
  const upcomingTasks = useMemo(() => tasks.filter((t) => t.status !== "concluida").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")).slice(0, 5), [tasks]);
  const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "concluida").length;
  const overduePayments = overdue(expenses, today).length;
  const toFollowUp = useMemo(() => { const by = new Map(invitations.map((i) => [i.guest_id, i])); const now = new Date(); return guests.filter((x) => followUpState(x, by.get(x.id), now, prefs.followUpDays) === "to_follow_up").length; }, [guests, invitations, prefs.followUpDays]);

  const loading = guestsQ.isPending || tasksQ.isPending || expensesQ.isPending;
  if (guestsQ.isError) return <ErrorState onRetry={() => guestsQ.refetch()} />;

  const attention = [
    g.invitesToSend > 0 && { icon: Send, text: `${g.invitesToSend} ${g.invitesToSend === 1 ? "convite por enviar" : "convites por enviar"}`, href: "/convidados?convite=por_convidar" },
    toFollowUp > 0 && { icon: MailQuestion, text: `${toFollowUp} sem resposta há mais de ${prefs.followUpDays} dias`, href: "/convites" },
    seat.unseatedGuests > 0 && tables.length > 0 && { icon: Armchair, text: `${seat.unseatedPeople} pessoas ainda sem mesa`, href: "/mesas" },
    overduePayments > 0 && { icon: AlertTriangle, text: `${overduePayments} ${overduePayments === 1 ? "pagamento em atraso" : "pagamentos em atraso"}`, href: "/orcamento" },
    overdueTasks > 0 && { icon: Clock, text: `${overdueTasks} ${overdueTasks === 1 ? "tarefa em atraso" : "tarefas em atraso"}`, href: "/tarefas" },
  ].filter(Boolean) as { icon: typeof Send; text: string; href: string }[];

  return (
    <>
      <PageHeader title={`${wedding.partner1_name} & ${wedding.partner2_name}`} description={`${wedding.name} · ${formatDate(wedding.wedding_date)}${wedding.venue_name ? ` · ${wedding.venue_name}` : ""}`} />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" role="status" aria-label="A carregar">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <Card className="col-span-2 gap-1 border-gold/40 bg-accent/60 py-3.5 sm:col-span-1">
              <div className="flex items-center justify-between px-4"><span className="text-xs font-medium tracking-wide text-accent-foreground/80 uppercase">Contagem decrescente</span><CalendarHeart className="size-4 text-gold" /></div>
              <div className="px-4 font-serif text-4xl leading-none font-semibold text-sage-900 tabular-nums">{cd.today ? "Hoje!" : cd.past ? cd.days * -1 : cd.days}</div>
              <div className="px-4 text-xs text-accent-foreground/80">{cd.today ? "É o grande dia" : cd.past ? "dias desde o casamento" : cd.days === 1 ? "dia até ao casamento" : `dias até ao casamento · ${cd.weeks} semanas`}</div>
            </Card>
            <Link href="/convidados"><Stat label="Convidados registados" value={g.totalRecords} icon={Users} hint={`${g.totalPeople} pessoas no total`} className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/convidados"><Stat label="Pessoas convidadas" value={g.invitedPeople} icon={Users2} hint="Convite já enviado" className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/convidados?convite=por_convidar"><Stat label="Por convidar" value={g.toInvitePeople} icon={UserPlus} tone="warning" hint={`${g.invitesToSend} ${g.invitesToSend === 1 ? "convite" : "convites"} por enviar`} className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/convites"><Stat label="Convites enviados" value={g.invitesSent} icon={Send} hint={`de ${g.totalRecords} registos`} className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/convidados?presenca=confirmado"><Stat label="Confirmações" value={g.confirmedPeople} icon={UserCheck} tone="gold" hint="Pessoas que vão estar" className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/convites"><Stat label="Pendentes de resposta" value={g.pendingInvites} icon={MailQuestion} tone="warning" hint="Convites sem resposta" className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/convidados?presenca=nao_vai"><Stat label="Não vão estar" value={g.declinedPeople} icon={UserX} hint="Pessoas ausentes" className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/mesas"><Stat label="Mesas criadas" value={seat.tables} icon={Armchair} hint={seat.fullTables ? `${seat.fullTables} cheias` : undefined} className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/mesas"><Stat label="Lugares ocupados" value={seat.occupied} icon={CheckCircle2} hint={seat.unseatedPeople ? `${seat.unseatedPeople} por sentar` : "Todos sentados"} className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Link href="/mesas"><Stat label="Lugares disponíveis" value={seat.free} icon={Armchair} hint={`de ${seat.capacity} lugares`} className="h-full transition-colors hover:bg-secondary/40" /></Link>
            <Stat label="Confirmações" value={`${Math.round(g.confirmationRate * 100)}%`} icon={Percent} tone="gold" hint="Confirmadas / convidadas" />
          </div>

          {g.totalRecords === 0 && (
            <div className="mt-5"><EmptyState icon={Heart} title="Comecem por registar os convidados" description="Adicionem os convidados um a um ou importem a lista a partir de um ficheiro Excel ou CSV. Os indicadores e os gráficos preenchem-se sozinhos." action={<Button asChild><Link href="/convidados"><UserPlus /> Ir para Convidados</Link></Button>} /></div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Estado dos convites</CardTitle><CardDescription>Registos de convidados por estado do convite</CardDescription></CardHeader><CardContent>
              <Donut ariaLabel="Estado dos convites" unit="convites" centerLabel="registos" data={[
                { name: "Por convidar", value: g.invitationBreakdown.por_convidar, color: "#d8cbae" }, { name: "Enviado", value: g.invitationBreakdown.enviado, color: "#8fa37e" },
                { name: "Entregue", value: g.invitationBreakdown.entregue, color: "#5b704f" }, { name: "Recusado", value: g.invitationBreakdown.recusado, color: "#b8975a" }]} />
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Confirmações de presença</CardTitle><CardDescription>Pessoas (incluindo acompanhantes e crianças)</CardDescription></CardHeader><CardContent>
              <Donut ariaLabel="Confirmações de presença" unit="pessoas" centerLabel="pessoas" data={[
                { name: "Confirmadas", value: g.rsvpBreakdownPeople.confirmado, color: "#5b704f" }, { name: "Sem resposta", value: g.rsvpBreakdownPeople.sem_resposta, color: "#d8cbae" },
                { name: "Não vão", value: g.rsvpBreakdownPeople.nao_vai, color: "#b0544a" }]} />
            </CardContent></Card>
            <Card><CardHeader className="flex-row items-start justify-between gap-2"><div><CardTitle>Distribuição de convidados</CardTitle><CardDescription>Pessoas por {by === "category" ? "categoria" : by === "group" ? "grupo/família" : "lado"}</CardDescription></div>
              <ToggleGroup type="single" value={by} onValueChange={(v) => v && setBy(v as typeof by)} aria-label="Agrupar por"><ToggleGroupItem value="category" className="px-2 text-xs">Categoria</ToggleGroupItem><ToggleGroupItem value="group" className="px-2 text-xs">Grupo</ToggleGroupItem><ToggleGroupItem value="side" className="px-2 text-xs">Lado</ToggleGroupItem></ToggleGroup></CardHeader>
              <CardContent>{dist.length ? <DistributionBars data={dist} /> : <p className="py-10 text-center text-sm text-muted-foreground">Sem convidados para mostrar.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Evolução das confirmações</CardTitle><CardDescription>Pessoas confirmadas, acumulado por dia de resposta</CardDescription></CardHeader>
              <CardContent>{evolution.length ? <EvolutionArea data={evolution} /> : <p className="py-10 text-center text-sm text-muted-foreground">Ainda não há confirmações registadas.</p>}</CardContent></Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1"><CardHeader className="flex-row items-center justify-between"><CardTitle>Tarefas próximas</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/tarefas">Ver todas <ArrowRight /></Link></Button></CardHeader>
              <CardContent>{upcomingTasks.length === 0 ? <p className="text-sm text-muted-foreground">{tasks.length ? "Todas as tarefas estão concluídas. Bom trabalho!" : "Ainda não há tarefas. Crie a primeira em Tarefas."}</p> : (
                <ul className="grid gap-2.5">{upcomingTasks.map((t) => <li key={t.id} className="flex items-start gap-2 text-sm"><PriorityBadge priority={t.priority} /><div className="min-w-0 flex-1"><p className="truncate font-medium">{t.title}</p><p className={t.due_date && t.due_date < today ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{t.due_date ? `${t.due_date < today ? "Atrasada · " : "até "}${formatShortDate(t.due_date)}` : "Sem data limite"}</p></div></li>)}</ul>)}</CardContent></Card>

            <Card className="lg:col-span-1"><CardHeader className="flex-row items-center justify-between"><CardTitle>Resumo do orçamento</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/orcamento">Detalhes <ArrowRight /></Link></Button></CardHeader>
              <CardContent className="grid gap-3">
                <div><div className="mb-1 flex items-baseline justify-between text-sm"><span className="text-muted-foreground">Previsto</span><strong className="tabular-nums">{formatEuro(budget.planned)}</strong></div>
                  {budget.totalBudget > 0 ? <><Progress value={budget.usedShare * 100} indicatorClassName={budget.overBudget ? "bg-destructive" : undefined} aria-label="Orçamento comprometido" /><p className="mt-1 text-xs text-muted-foreground">{Math.round(budget.usedShare * 100)}% de {formatEuro(budget.totalBudget)}</p></> : <p className="text-xs text-muted-foreground">Defina o orçamento total em <Link href="/definicoes" className="underline">Definições</Link>.</p>}</div>
                <dl className="grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Pago</dt><dd className="font-medium tabular-nums">{formatEuro(budget.paid)}</dd></div><div><dt className="text-xs text-muted-foreground">Por pagar</dt><dd className="font-medium tabular-nums">{formatEuro(budget.toPay)}</dd></div><div><dt className="text-xs text-muted-foreground">{budget.difference >= 0 ? "Margem" : "Excesso"}</dt><dd className={budget.difference < 0 ? "font-medium text-destructive tabular-nums" : "font-medium tabular-nums"}>{formatEuro(Math.abs(budget.difference))}</dd></div></dl>
              </CardContent></Card>

            <Card className="lg:col-span-1"><CardHeader><CardTitle>O que falta organizar</CardTitle></CardHeader>
              <CardContent>{attention.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><MailCheck className="size-4 text-sage-500" />Nada urgente neste momento.</p> : (
                <ul className="grid gap-1.5">{attention.map((a) => <li key={a.text}><Link href={a.href} className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary/60"><a.icon className="size-4 shrink-0 text-gold-600" /><span className="min-w-0 flex-1">{a.text}</span><ArrowRight className="size-4 text-muted-foreground" /></Link></li>)}</ul>)}</CardContent></Card>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Os indicadores contam sempre pessoas individuais (convidado + acompanhantes + crianças), sem duplicar registos. “Pessoas convidadas” são as dos convites já enviados; “Confirmações” são as pessoas que vão estar presentes.</p>
          <span className="sr-only">{sideLabel("both", wedding)}</span><Badge className="sr-only">resumo</Badge>
        </>
      )}
    </>
  );
}
