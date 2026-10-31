"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatEuro, formatEuroShort } from "@/lib/money";

/** Paleta sálvia, areia e dourado (sem cores fortes). */
export const CHART_COLORS = ["#5b704f", "#b8975a", "#8fa37e", "#c4b18a", "#475840", "#dcc48e", "#b0c0a1", "#9a7b43", "#738a63", "#d8cbae", "#3a4835", "#e8dfcb"];

export interface Slice { name: string; value: number }

export function BudgetDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="grid items-center gap-2 sm:grid-cols-2" role="img" aria-label={`Distribuição das despesas previstas por categoria. Total ${formatEuro(total)}.`}>
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatEuro(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #e6dfcf", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-serif text-xl font-semibold text-sage-900">{formatEuroShort(total)}</p><p className="text-xs text-muted-foreground">previsto</p></div></div>
      </div>
      <ul className="grid gap-1 text-sm">
        {data.slice(0, 7).map((d, i) => (
          <li key={d.name} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="truncate">{d.name}</span><span className="ml-auto tabular-nums text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span></li>
        ))}
        {data.length > 7 && <li className="text-xs text-muted-foreground">+ {data.length - 7} categorias</li>}
      </ul>
    </div>
  );
}

export function PlannedVsPaid({ data }: { data: { name: string; previsto: number; pago: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Valor previsto e valor pago por categoria">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6dfcf" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7566" }} interval={0} angle={-30} textAnchor="end" height={64} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7566" }} tickFormatter={(v) => formatEuroShort(Number(v))} tickLine={false} axisLine={false} width={64} />
          <Tooltip formatter={(v) => formatEuro(Number(v))} cursor={{ fill: "#f1ebdd" }} contentStyle={{ borderRadius: 8, border: "1px solid #e6dfcf", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="previsto" name="Previsto" fill="#c4b18a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pago" name="Pago" fill="#5b704f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
