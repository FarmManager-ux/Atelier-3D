"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/confirm";
import { useApi, useRun } from "@/lib/data/actions";
import { useCategories, useExpenses, EMPTY } from "@/lib/data/queries";
import { formatEuro, parseMoney } from "@/lib/money";

/** Gerir categorias: nome, verba prevista por categoria, adicionar e eliminar (se não tiver despesas). */
export function CategoriesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const categories = useCategories().data ?? EMPTY;
  const expenses = useExpenses().data ?? EMPTY;
  const api = useApi();
  const { run, pending } = useRun();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = (id: string, planned_budget: string) => {
    const n = parseMoney(planned_budget === "" ? "0" : planned_budget);
    if (n === null || n < 0) { setDrafts((d) => ({ ...d, [id]: "" })); return; }
    return run(() => api.upsert("budget_categories", id, { planned_budget: n }), { success: "Verba atualizada.", invalidate: ["budget_categories"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Categorias do orçamento</DialogTitle><DialogDescription>Defina, se quiser, uma verba para cada categoria. É apenas uma referência: o limite total está nas Definições.</DialogDescription></DialogHeader>
        <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto pr-1">
          {categories.map((c) => {
            const used = expenses.filter((e) => e.category_id === c.id);
            return (
              <li key={c.id} className="grid grid-cols-[1fr_8rem_2.5rem] items-center gap-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{used.length} {used.length === 1 ? "despesa" : "despesas"}</p></div>
                <Input aria-label={`Verba de ${c.name} (€)`} inputMode="decimal" placeholder="0,00" value={drafts[c.id] ?? (c.planned_budget ? String(c.planned_budget).replace(".", ",") : "")}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))} onBlur={(e) => { if (drafts[c.id] !== undefined && parseMoney(e.target.value === "" ? "0" : e.target.value) !== c.planned_budget) void save(c.id, e.target.value); }} />
                <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${c.name}`} onClick={async () => {
                  if (await confirm({ title: `Eliminar a categoria “${c.name}”?` })) await run(() => api.remove("budget_categories", c.id), { success: "Categoria eliminada.", invalidate: ["budget_categories"] });
                }} disabled={used.length > 0} title={used.length ? `Tem ${used.length} despesas associadas (${formatEuro(used.reduce((a, e) => a + e.planned_amount, 0))}). Mude-as de categoria primeiro.` : undefined}><Trash2 /></Button>
              </li>
            );
          })}
        </ul>
        <form className="flex gap-2 border-t pt-3" onSubmit={async (e) => { e.preventDefault(); const n = name.trim(); if (!n) return; if (await run(() => api.upsert("budget_categories", null, { name: n, sort_order: categories.length + 1 }).then(() => true), { success: "Categoria criada.", invalidate: ["budget_categories"] })) setName(""); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria…" maxLength={80} aria-label="Nome da nova categoria" />
          <Button type="submit" disabled={!name.trim() || pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />}Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
