import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import type { CalendarEvent, EventType, Expense, Task, Wedding } from "../db-types";
import { toISODate } from "../dates";
import { eventTypeLabel } from "../labels";

export interface CalendarItem {
  id: string;
  date: string;          // yyyy-MM-dd
  title: string;
  type: EventType;
  source: "event" | "task" | "expense" | "wedding";
  sourceId: string;
  time?: string | null;
  subtitle?: string | null;
  done?: boolean;
}

/** Junta eventos próprios, prazos das tarefas, pagamentos e o dia do casamento num só calendário. */
export function buildCalendarItems(input: { events: CalendarEvent[]; tasks: Task[]; expenses: Expense[]; wedding: Wedding }): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const e of input.events) {
    items.push({ id: `event:${e.id}`, date: e.event_date, title: e.title, type: e.event_type, source: "event", sourceId: e.id,
      time: e.start_time ? e.start_time.slice(0, 5) : null, subtitle: e.location });
  }
  for (const t of input.tasks) {
    if (!t.due_date) continue;
    items.push({ id: `task:${t.id}`, date: t.due_date, title: t.title, type: "tarefa", source: "task", sourceId: t.id, done: t.status === "concluida", subtitle: t.category });
  }
  for (const x of input.expenses) {
    const open = x.paid_amount < x.planned_amount;
    if (x.due_date && open) items.push({ id: `expense-due:${x.id}`, date: x.due_date, title: `Pagar: ${x.description}`, type: "pagamento", source: "expense", sourceId: x.id });
    if (x.payment_date && x.paid_amount > 0) items.push({ id: `expense-paid:${x.id}`, date: x.payment_date, title: `Pago: ${x.description}`, type: "pagamento", source: "expense", sourceId: x.id, done: true });
  }
  items.push({ id: `wedding:${input.wedding.id}`, date: input.wedding.wedding_date, title: `${input.wedding.partner1_name} & ${input.wedding.partner2_name}: o grande dia`, type: "data_importante", source: "wedding", sourceId: input.wedding.id });
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99") || a.title.localeCompare(b.title, "pt"));
}

export const itemsByDate = (items: CalendarItem[]): Map<string, CalendarItem[]> => {
  const m = new Map<string, CalendarItem[]>();
  for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
  return m;
};

/** Semanas (segunda a domingo) que cobrem o mês. */
export function monthMatrix(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return weeks;
}

export const typeLabel = (t: EventType) => eventTypeLabel[t];
export { toISODate };
