"use client";

import { EMPTY } from "@/lib/data/queries";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Armchair, CalendarDays, FileText, ListChecks, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getSupabase } from "@/lib/supabase/client";
import { useWeddingContext } from "@/lib/data/context";
import { normalizeText } from "@/lib/domain/guests";
import { NAV } from "./nav";

interface Hit { id: string; label: string; hint?: string; href: string; icon: LucideIcon; group: string }

/** Escapa % e _ para a pesquisa ILIKE. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { wedding } = useWeddingContext();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setBusy(false); return; }
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(async () => {
      const s = getSupabase();
      const p = like(term);
      const wid = wedding.id;
      const [guests, vendors, tasks, tables, expenses, docs, events] = await Promise.all([
        s.from("guests").select("id, full_name, surname, invited_count").eq("wedding_id", wid).or(`full_name.ilike.${p},surname.ilike.${p},email.ilike.${p},phone.ilike.${p}`).limit(6),
        s.from("vendors").select("id, company_name, service_type").eq("wedding_id", wid).ilike("company_name", p).limit(4),
        s.from("tasks").select("id, title, due_date").eq("wedding_id", wid).ilike("title", p).limit(4),
        s.from("tables").select("id, name, capacity").eq("wedding_id", wid).ilike("name", p).limit(4),
        s.from("expenses").select("id, description").eq("wedding_id", wid).ilike("description", p).limit(4),
        s.from("documents").select("id, name").eq("wedding_id", wid).ilike("name", p).limit(4),
        s.from("calendar_events").select("id, title, event_date").eq("wedding_id", wid).ilike("title", p).limit(4),
      ]);
      if (cancelled) return;
      const enc = encodeURIComponent;
      const out: Hit[] = [
        ...(guests.data ?? EMPTY).map((g) => ({ id: `g${g.id}`, label: g.full_name, hint: g.invited_count > 1 ? `${g.invited_count} pessoas` : undefined, href: `/convidados?busca=${enc(g.full_name)}`, icon: Users, group: "Convidados" })),
        ...(tables.data ?? EMPTY).map((t) => ({ id: `t${t.id}`, label: t.name, hint: `${t.capacity} lugares`, href: `/mesas?mesa=${t.id}`, icon: Armchair, group: "Mesas" })),
        ...(tasks.data ?? EMPTY).map((t) => ({ id: `k${t.id}`, label: t.title, href: `/tarefas?busca=${enc(t.title)}`, icon: ListChecks, group: "Tarefas" })),
        ...(vendors.data ?? EMPTY).map((v) => ({ id: `v${v.id}`, label: v.company_name, hint: v.service_type ?? undefined, href: `/fornecedores?busca=${enc(v.company_name)}`, icon: Store, group: "Fornecedores" })),
        ...(expenses.data ?? EMPTY).map((e) => ({ id: `e${e.id}`, label: e.description, href: `/orcamento?busca=${enc(e.description)}`, icon: Wallet, group: "Despesas" })),
        ...(docs.data ?? EMPTY).map((d) => ({ id: `d${d.id}`, label: d.name, href: `/documentos?busca=${enc(d.name)}`, icon: FileText, group: "Documentos" })),
        ...(events.data ?? EMPTY).map((e) => ({ id: `c${e.id}`, label: e.title, hint: e.event_date, href: `/calendario?data=${e.event_date}`, icon: CalendarDays, group: "Calendário" })),
      ];
      setHits(out);
      setBusy(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, wedding.id]);

  const go = (href: string) => { onOpenChange(false); setQ(""); router.push(href); };
  const pages = NAV.filter((n) => !q.trim() || normalizeText(n.label).includes(normalizeText(q)));
  const groups = [...new Set(hits.map((h) => h.group))];

  return (
    <CommandDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }}>
      <CommandInput value={q} onValueChange={setQ} placeholder="Pesquisar convidados, mesas, tarefas, fornecedores…" />
      <CommandList>
        {q.trim().length >= 2 && !busy && hits.length === 0 && pages.length === 0 && <CommandEmpty>Nada encontrado para “{q}”.</CommandEmpty>}
        {busy && <div className="py-6 text-center text-sm text-muted-foreground">A pesquisar…</div>}
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {hits.filter((h) => h.group === g).map((h) => (
              <CommandItem key={h.id} value={h.id} onSelect={() => go(h.href)}><h.icon /><span className="truncate">{h.label}</span>{h.hint && <span className="ml-auto text-xs text-muted-foreground">{h.hint}</span>}</CommandItem>
            ))}
          </CommandGroup>
        ))}
        {pages.length > 0 && (
          <CommandGroup heading="Ir para">
            {pages.map((n) => <CommandItem key={n.href} value={`p${n.href}`} onSelect={() => go(n.href)}><n.icon />{n.label}</CommandItem>)}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
