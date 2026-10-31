"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, startOfMonth } from "date-fns";
import { CalendarDays, CheckCheck, List, ListChecks, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthGrid } from "@/components/calendar/month-grid";
import { useConfirm } from "@/components/confirm";
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from "@/components/page";
import { PriorityBadge, TaskStatusBadge } from "@/components/status";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useApi, useRun } from "@/lib/data/actions";
import { useTasks, useWedding, EMPTY } from "@/lib/data/queries";
import { formatShortDate, parseDate, toISODate } from "@/lib/dates";
import { buildCalendarItems } from "@/lib/domain/calendar";
import { normalizeText } from "@/lib/domain/guests";
import type { Task, TaskAssignee, TaskPriority, TaskStatus } from "@/lib/db-types";
import { entries, taskPriorityLabel, taskStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

function TasksInner() {
  const params = useSearchParams();
  const wedding = useWedding();
  const tasksQ = useTasks();
  const api = useApi();
  const { run } = useRun();
  const confirm = useConfirm();
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [q, setQ] = useState(params.get("busca") ?? "");
  const [status, setStatus] = useState<"all" | TaskStatus>("all");
  const [priority, setPriority] = useState<"all" | TaskPriority>("all");
  const [assignee, setAssignee] = useState<"all" | TaskAssignee>("all");
  const [category, setCategory] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dlg, setDlg] = useState<{ open: boolean; task: Task | null; due?: string }>({ open: false, task: null });
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [day, setDay] = useState<Date | null>(new Date());

  const tasks = tasksQ.data ?? EMPTY;
  const today = format(new Date(), "yyyy-MM-dd");
  const assigneeName = (t: Task) => t.assignee === "partner1" ? wedding.partner1_name : t.assignee === "partner2" ? wedding.partner2_name : t.assignee === "both" ? "Ambos" : (t.assignee_other ?? "Outro");
  const isOverdue = useCallback((t: Task) => !!t.due_date && t.due_date < today && t.status !== "concluida", [today]);
  const categories = useMemo(() => [...new Set(tasks.map((t) => t.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "pt")), [tasks]);

  const counts = useMemo(() => ({ todo: tasks.filter((t) => t.status === "por_iniciar").length, doing: tasks.filter((t) => t.status === "em_andamento").length, done: tasks.filter((t) => t.status === "concluida").length, overdue: tasks.filter(isOverdue).length }),
    [tasks, isOverdue]);
  const rows = useMemo(() => tasks.filter((t) => {
    if (status !== "all" && t.status !== status) return false;
    if (priority !== "all" && t.priority !== priority) return false;
    if (assignee !== "all" && t.assignee !== assignee) return false;
    if (category !== "all" && t.category !== category) return false;
    if (overdueOnly && !isOverdue(t)) return false;
    return !q || normalizeText([t.title, t.description, t.category].filter(Boolean).join(" ")).includes(normalizeText(q));
  }).sort((a, b) => (a.status === "concluida" ? 1 : 0) - (b.status === "concluida" ? 1 : 0) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || ({ alta: 0, media: 1, baixa: 2 }[a.priority] - { alta: 0, media: 1, baixa: 2 }[b.priority])),
  [tasks, status, priority, assignee, category, overdueOnly, q, isOverdue]);
  const hasFilters = status !== "all" || priority !== "all" || assignee !== "all" || category !== "all" || overdueOnly || !!q;

  const setStatusOf = (t: Task, s: TaskStatus) => run(() => api.upsert("tasks", t.id, { status: s }), { success: s === "concluida" ? "Tarefa concluída." : "Estado atualizado.", invalidate: ["tasks"] });
  const del = async (t: Task) => { if (await confirm({ title: `Eliminar “${t.title}”?`, description: "Esta ação não pode ser desfeita." })) await run(() => api.remove("tasks", t.id), { success: "Tarefa eliminada.", invalidate: ["tasks"] }); };
  const total = tasks.length;
  const calItems = useMemo(() => buildCalendarItems({ events: [], tasks: rows, expenses: [], wedding }).filter((i) => i.source === "task"), [rows, wedding]);
  const dayItems = day ? calItems.filter((i) => i.date === toISODate(day)) : [];

  return (
    <>
      <PageHeader title="Tarefas" description="Tudo o que falta fazer para o grande dia, com responsável e data limite." actions={<Button onClick={() => setDlg({ open: true, task: null })}><Plus /> Nova tarefa</Button>} />

      {tasksQ.isPending ? <SkeletonRows n={6} /> : tasksQ.isError ? <ErrorState onRetry={() => tasksQ.refetch()} /> : (
        <>
          <Card className="mb-4 gap-2 py-3"><CardContent>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span><strong>{counts.done}</strong> de {total} concluídas</span>
              <span className="flex flex-wrap gap-1.5"><Badge variant="neutral">{counts.todo} por iniciar</Badge><Badge variant="gold">{counts.doing} em andamento</Badge>{counts.overdue > 0 && <Badge variant="danger">{counts.overdue} em atraso</Badge>}</span>
            </div>
            <Progress value={total ? (counts.done / total) * 100 : 0} aria-label="Progresso das tarefas" />
          </CardContent></Card>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as typeof view)} aria-label="Modo de visualização"><ToggleGroupItem value="lista"><List />Lista</ToggleGroupItem><ToggleGroupItem value="calendario"><CalendarDays />Calendário</ToggleGroupItem></ToggleGroup>
            <div className="relative min-w-44 flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar tarefas…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar tarefas" /></div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger size="sm" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os estados</SelectItem>{entries(taskStatusLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}><SelectTrigger size="sm" aria-label="Filtrar por prioridade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as prioridades</SelectItem>{entries(taskPriorityLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            <Select value={assignee} onValueChange={(v) => setAssignee(v as typeof assignee)}><SelectTrigger size="sm" aria-label="Filtrar por responsável"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os responsáveis</SelectItem><SelectItem value="partner1">{wedding.partner1_name}</SelectItem><SelectItem value="partner2">{wedding.partner2_name}</SelectItem><SelectItem value="both">Ambos</SelectItem><SelectItem value="other">Outra pessoa</SelectItem></SelectContent></Select>
            {categories.length > 0 && <Select value={category} onValueChange={setCategory}><SelectTrigger size="sm" aria-label="Filtrar por categoria"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>}
            <Button size="sm" variant={overdueOnly ? "default" : "outline"} onClick={() => setOverdueOnly((o) => !o)} aria-pressed={overdueOnly}>Em atraso</Button>
            {hasFilters && <Button size="sm" variant="ghost" onClick={() => { setQ(""); setStatus("all"); setPriority("all"); setAssignee("all"); setCategory("all"); setOverdueOnly(false); }}><X /> Limpar</Button>}
          </div>

          {total === 0 ? (
            <EmptyState icon={ListChecks} title="Ainda não há tarefas" description="Crie as primeiras tarefas, por exemplo “Escolher o fotógrafo” ou “Provar o vestido”, com responsável e data limite." action={<Button onClick={() => setDlg({ open: true, task: null })}><Plus /> Criar tarefa</Button>} />
          ) : view === "lista" ? (
            rows.length === 0 ? <EmptyState icon={Search} title="Nenhuma tarefa corresponde aos filtros" action={<Button variant="outline" onClick={() => { setQ(""); setStatus("all"); setPriority("all"); setAssignee("all"); setCategory("all"); setOverdueOnly(false); }}>Limpar filtros</Button>} /> : (
              <ul className="grid gap-2">
                {rows.map((t) => (
                  <li key={t.id} className={cn("flex items-start gap-3 rounded-xl border bg-card p-3", t.status === "concluida" && "bg-secondary/40")}>
                    <Checkbox className="mt-1" checked={t.status === "concluida"} onCheckedChange={(c) => setStatusOf(t, c === true ? "concluida" : "por_iniciar")} aria-label={`Marcar “${t.title}” como ${t.status === "concluida" ? "por iniciar" : "concluída"}`} />
                    <div className="min-w-0 flex-1">
                      <button className={cn("block max-w-full text-left font-medium hover:underline", t.status === "concluida" && "text-muted-foreground line-through")} onClick={() => setDlg({ open: true, task: t })}>{t.title}</button>
                      {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <PriorityBadge priority={t.priority} />
                        <Select value={t.status} onValueChange={(v) => setStatusOf(t, v as TaskStatus)}><SelectTrigger size="sm" className="h-6 gap-1 rounded-full border-0 bg-transparent px-1 text-xs shadow-none" aria-label={`Estado de ${t.title}`}><TaskStatusBadge status={t.status} /></SelectTrigger><SelectContent>{entries(taskStatusLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                        {t.category && <Badge variant="outline">{t.category}</Badge>}
                        <span className="text-muted-foreground">{assigneeName(t)}</span>
                        {t.due_date && <span className={cn("ml-auto font-medium", isOverdue(t) ? "text-destructive" : "text-muted-foreground")}>{isOverdue(t) ? "Atrasada · " : "até "}{formatShortDate(t.due_date)}</span>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações para ${t.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDlg({ open: true, task: t })}><Pencil /> Editar</DropdownMenuItem>
                        {t.status !== "concluida" && <DropdownMenuItem onSelect={() => setStatusOf(t, "concluida")}><CheckCheck /> Marcar como concluída</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => del(t)}><Trash2 /> Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
              <MonthGrid month={month} onMonthChange={setMonth} items={calItems} selected={day} onSelect={(d) => { setDay(d); }} />
              <Card className="h-fit gap-3">
                <CardContent>
                  <div className="mb-2 flex items-center justify-between"><h2 className="font-serif text-lg font-semibold">{day ? formatShortDate(toISODate(day)) : "Escolha um dia"}</h2>{day && <Button size="sm" variant="outline" onClick={() => setDlg({ open: true, task: null, due: toISODate(day) })}><Plus /> Tarefa</Button>}</div>
                  {dayItems.length === 0 ? <p className="text-sm text-muted-foreground">Sem tarefas com data limite neste dia.</p> : (
                    <ul className="grid gap-2">{dayItems.map((i) => { const t = tasks.find((x) => x.id === i.sourceId)!; return <li key={i.id} className="rounded-lg border p-2.5 text-sm"><button className="text-left font-medium hover:underline" onClick={() => setDlg({ open: true, task: t })}>{t.title}</button><div className="mt-1 flex flex-wrap gap-1.5"><PriorityBadge priority={t.priority} /><TaskStatusBadge status={t.status} /></div></li>; })}</ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <TaskDialog open={dlg.open} onOpenChange={(o) => setDlg((s) => ({ ...s, open: o }))} task={dlg.task} defaults={dlg.due ? { due_date: dlg.due } : undefined} />
    </>
  );
}

export default function TasksPage() {
  return <Suspense fallback={<SkeletonRows n={6} />}><TasksInner /></Suspense>;
}
