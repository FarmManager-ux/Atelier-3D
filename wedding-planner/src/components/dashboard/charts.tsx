"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

const TIP = { borderRadius: 8, border: "1px solid #e6dfcf", fontSize: 12 } as const;

export interface Slice { name: string; value: number; color: string }

/** Donut com o total ao centro e legenda ao lado (nunca depende só da cor: tem etiquetas e valores). */
export function Donut({ data, centerLabel, unit, ariaLabel }: { data: Slice[]; centerLabel: string; unit: string; ariaLabel: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[11rem_1fr]" role="img" aria-label={`${ariaLabel}. ${data.map((d) => `${d.name}: ${d.value}`).join("; ")}.`}>
      <div className="relative mx-auto h-44 w-44">
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={data.filter((d) => d.value > 0)} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="94%" paddingAngle={2} stroke="none">{data.filter((d) => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip contentStyle={TIP} formatter={(v) => `${v} ${unit}`} /></PieChart>
          </ResponsiveContainer>
        ) : <div className="grid size-full place-items-center rounded-full border-[14px] border-sand-200" />}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-serif text-3xl leading-none font-semibold text-sage-900 tabular-nums">{total}</p><p className="mt-0.5 text-xs text-muted-foreground">{centerLabel}</p></div></div>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="truncate">{d.name}</span><span className="ml-auto tabular-nums font-medium">{d.value}</span><span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{total ? Math.round((d.value / total) * 100) : 0}%</span></li>
        ))}
      </ul>
    </div>
  );
}

export function DistributionBars({ data }: { data: { label: string; people: number }[] }) {
  const rows = data.slice(0, 8);
  return (
    <div style={{ height: Math.max(140, rows.length * 38 + 24) }} role="img" aria-label={`Distribuição de pessoas: ${rows.map((r) => `${r.label} ${r.people}`).join("; ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#e6dfcf" strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7566" }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 12, fill: "#2f3a2c" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TIP} cursor={{ fill: "#f1ebdd" }} formatter={(v) => [`${v} pessoas`, ""]} />
          <Bar dataKey="people" fill="#8fa37e" radius={[0, 4, 4, 0]} barSize={18} label={{ position: "right", fontSize: 11, fill: "#6b7566" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EvolutionArea({ data }: { data: { date: string; people: number }[] }) {
  return (
    <div className="h-56" role="img" aria-label={`Evolução das confirmações: ${data.length ? `${data[data.length - 1]!.people} pessoas confirmadas até agora` : "sem confirmações ainda"}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs><linearGradient id="evo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b704f" stopOpacity={0.35} /><stop offset="100%" stopColor="#5b704f" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid stroke="#e6dfcf" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "d MMM", { locale: pt })} tick={{ fontSize: 11, fill: "#6b7566" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7566" }} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={TIP} labelFormatter={(d) => format(parseISO(String(d)), "d 'de' MMMM yyyy", { locale: pt })} formatter={(v) => [`${v} pessoas`, "Confirmadas"]} />
          <Area type="monotone" dataKey="people" stroke="#5b704f" strokeWidth={2} fill="url(#evo)" dot={data.length < 20 ? { r: 3, fill: "#5b704f" } : false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
