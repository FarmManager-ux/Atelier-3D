"use client";

import { addMonths, format, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { itemsByDate, monthMatrix, type CalendarItem } from "@/lib/domain/calendar";
import { toISODate } from "@/lib/dates";
import type { EventType } from "@/lib/db-types";

/** Cor de cada tipo de evento (discreta: tons de sálvia, areia e dourado). */
export const TYPE_STYLE: Record<EventType, { dot: string; chip: string }> = {
  pagamento: { dot: "bg-gold", chip: "bg-accent text-accent-foreground" },
  reuniao: { dot: "bg-sage-600", chip: "bg-sage-100 text-sage-900" },
  prazo: { dot: "bg-[#b0544a]", chip: "bg-[#f4dfdb] text-[#8a3b32]" },
  tarefa: { dot: "bg-sage-400", chip: "bg-sage-50 text-sage-800 border border-sage-200" },
  prova_roupa: { dot: "bg-sand-400", chip: "bg-sand-200 text-[#5f4a22]" },
  contacto_fornecedor: { dot: "bg-sage-300", chip: "bg-sage-100 text-sage-800" },
  data_importante: { dot: "bg-gold-600", chip: "bg-gold text-white" },
  outro: { dot: "bg-muted-foreground", chip: "bg-secondary text-secondary-foreground" },
};

export function MonthGrid({ month, onMonthChange, items, selected, onSelect }: {
  month: Date; onMonthChange: (m: Date) => void; items: CalendarItem[]; selected: Date | null; onSelect: (d: Date) => void;
}) {
  const weeks = monthMatrix(month);
  const byDate = itemsByDate(items);
  const today = new Date();
  const title = format(month, "MMMM 'de' yyyy", { locale: pt });

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <h2 className="font-serif text-2xl font-semibold capitalize">{title}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => { onMonthChange(startOfMonth(today)); onSelect(today); }}>Hoje</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Mês seguinte"><ChevronRight /></Button>
        </div>
      </div>
      <div role="grid" aria-label={`Calendário de ${title}`}>
        <div role="row" className="grid grid-cols-7 border-b text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d} role="columnheader" className="py-2">{d}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((day) => {
              const iso = toISODate(day);
              const list = byDate.get(iso) ?? [];
              const inMonth = isSameMonth(day, month);
              const isSel = !!selected && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              return (
                <button key={iso} role="gridcell" aria-selected={isSel} aria-label={`${format(day, "d 'de' MMMM", { locale: pt })}${list.length ? `, ${list.length} ${list.length === 1 ? "evento" : "eventos"}` : ""}`}
                  onClick={() => onSelect(day)}
                  className={cn("flex min-h-14 flex-col items-stretch gap-0.5 border-r border-b p-1 text-left transition-colors outline-none last:border-r-0 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset sm:min-h-24 sm:p-1.5",
                    !inMonth && "bg-secondary/30 text-muted-foreground/60", isSel && "bg-sage-50 ring-2 ring-sage-300 ring-inset")}>
                  <span className={cn("grid size-6 place-items-center self-start rounded-full text-xs font-medium", isToday && "bg-primary text-primary-foreground")}>{day.getDate()}</span>
                  {/* telemóvel: pontos; computador: etiquetas */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">{list.slice(0, 4).map((i) => <span key={i.id} className={cn("size-1.5 rounded-full", TYPE_STYLE[i.type].dot, i.done && "opacity-40")} />)}</span>
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {list.slice(0, 3).map((i) => <span key={i.id} className={cn("truncate rounded px-1 py-0.5 text-[11px] leading-tight", TYPE_STYLE[i.type].chip, i.done && "line-through opacity-60")}>{i.time ? `${i.time} ` : ""}{i.title}</span>)}
                    {list.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} mais</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
