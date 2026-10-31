"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, startOfMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarPlus, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventDialog } from "@/components/calendar/event-dialog";
import { MonthGrid, TYPE_STYLE } from "@/components/calendar/month-grid";
import { ErrorState, PageHeader, SkeletonRows } from "@/components/page";
import { useEvents, useExpenses, useTasks, useWedding, EMPTY } from "@/lib/data/queries";
import { formatShortDate, parseDate, toISODate } from "@/lib/dates";
import { buildCalendarItems, type CalendarItem } from "@/lib/domain/calendar";
import type { CalendarEvent, EventType } from "@/lib/db-types";
import { entries, eventTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

function CalendarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const wedding = useWedding();
  const eventsQ = useEvents();
  const tasksQ = useTasks();
  const expQ = useExpenses();
  const initial = params.get("data") ? parseDate(params.get("data")!) : new Date();
  const [month, setMonth] = useState(startOfMonth(initial));
  const [day, setDay] = useState<Date | null>(initial);
  const [hidden, setHidden] = useState<Set<EventType>>(new Set());
  const [dlg, setDlg] = useState<{ open: boolean; event: CalendarEvent | null; date?: string }>({ open: false, event: null });

  const events = eventsQ.data ?? EMPTY;
  const all = useMemo(() => buildCalendarItems({ events, tasks: tasksQ.data ?? EMPTY, expenses: expQ.data ?? EMPTY, wedding }), [events, tasksQ.data, expQ.data, wedding]);
  const items = useMemo(() => all.filter((i) => !hidden.has(i.type)), [all, hidden]);
  const selectedIso = day ? toISODate(day) : null;
  const dayItems = selectedIso ? items.filter((i) => i.date === selectedIso) : [];
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const upcoming = items.filter((i) => i.date >= todayIso && !i.done).slice(0, 8);
  const toggle = (t: EventType) => setHidden((h) => { const n = new Set(h); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  const open = (i: CalendarItem) => {
    if (i.source === "event") setDlg({ open: true, event: events.find((e) => e.id === i.sourceId) ?? null });
    else if (i.source === "task") router.push(`/tarefas?busca=${encodeURIComponent(i.title)}`);
    else if (i.source === "expense") router.push(`/orcamento?busca=${encodeURIComponent(i.title.replace(/^(Pagar|Pago): /, ""))}`);
  };

  const renderList = (list: CalendarItem[], showDate?: boolean) => (
    <ul className="grid gap-2">
      {list.map((i) => (
        <li key={i.id}>
          <button onClick={() => open(i)} disabled={i.source === "wedding"} className="flex w-full items-start gap-2.5 rounded-lg border bg-card p-2.5 text-left transition-colors hover:bg-secondary/60 disabled:cursor-default disabled:hover:bg-card">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", TYPE_STYLE[i.type].dot)} />
            <span className="min-w-0 flex-1">
              <span className={cn("block font-medium", i.done && "text-muted-foreground line-through")}>{i.title}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {showDate && <span>{formatShortDate(i.date)}</span>}
                <span>{eventTypeLabel[i.type]}</span>
                {i.time && <span className="flex items-center gap-0.5"><Clock className="size-3" />{i.time}</span>}
                {i.subtitle && <span className="flex items-center gap-0.5"><MapPin className="size-3" />{i.subtitle}</span>}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader title="Calendário" description="Pagamentos, reuniões, prazos, provas de roupa e datas importantes num só lugar." actions={<Button onClick={() => setDlg({ open: true, event: null, date: selectedIso ?? undefined })}><CalendarPlus /> Novo evento</Button>} />

      {eventsQ.isPending ? <SkeletonRows n={6} /> : eventsQ.isError ? <ErrorState onRetry={() => eventsQ.refetch()} /> : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Tipos de evento visíveis">
            {entries(eventTypeLabel).map((o) => {
              const off = hidden.has(o.value);
              return <button key={o.value} onClick={() => toggle(o.value)} aria-pressed={!off} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", off ? "bg-transparent text-muted-foreground line-through" : "bg-card")}><span className={cn("size-2 rounded-full", TYPE_STYLE[o.value].dot)} />{o.label}</button>;
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
            <MonthGrid month={month} onMonthChange={setMonth} items={items} selected={day} onSelect={(d) => { setDay(d); if (d.getMonth() !== month.getMonth()) setMonth(startOfMonth(d)); }} />
            <div className="grid content-start gap-4">
              <Card className="gap-3">
                <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg capitalize">{day ? format(day, "EEEE, d 'de' MMMM", { locale: pt }) : "Escolha um dia"}</CardTitle>{day && <Button size="sm" variant="outline" onClick={() => setDlg({ open: true, event: null, date: toISODate(day) })}>+ Evento</Button>}</CardHeader>
                <CardContent>{dayItems.length === 0 ? <p className="text-sm text-muted-foreground">Nada marcado para este dia.</p> : renderList(dayItems)}</CardContent>
              </Card>
              <Card className="gap-3">
                <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg">Próximos</CardTitle><Badge variant="outline">{upcoming.length}</Badge></CardHeader>
                <CardContent>{upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Sem eventos futuros. Crie reuniões, provas ou prazos para os ver aqui.</p> : renderList(upcoming, true)}</CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <EventDialog open={dlg.open} onOpenChange={(o) => setDlg((s) => ({ ...s, open: o }))} event={dlg.event} date={dlg.date} />
    </>
  );
}

export default function CalendarPage() {
  return <Suspense fallback={<SkeletonRows n={6} />}><CalendarInner /></Suspense>;
}
