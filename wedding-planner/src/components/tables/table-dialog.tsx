"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SelectField, TextField, TextareaField } from "@/components/fields";
import { useApi, useRun } from "@/lib/data/actions";
import { useTables, useWedding, EMPTY } from "@/lib/data/queries";
import { readPreferences } from "@/lib/preferences";
import { defaultSize, nextPosition, nextTableNames } from "@/lib/domain/floorplan";
import type { TableRow } from "@/lib/db-types";
import { entries, shapeLabel } from "@/lib/labels";
import { tableSchema } from "@/lib/validation";

type In = z.input<typeof tableSchema>;
type Out = z.output<typeof tableSchema>;

export function TableDialog({ open, onOpenChange, table, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; table?: TableRow | null; onCreated?: (id: string) => void }) {
  const tables = useTables().data ?? EMPTY;
  const prefs = readPreferences(useWedding());
  const api = useApi();
  const { run, pending } = useRun();
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(tableSchema) });

  useEffect(() => {
    if (!open) return;
    setError(null); setQty("1");
    if (table) form.reset({ name: table.name, shape: table.shape, capacity: String(table.capacity), width: String(table.width), height: String(table.height), notes: table.notes ?? "" });
    else { const d = defaultSize("redonda", prefs.defaultCapacity); form.reset({ name: nextTableNames(tables.map((t) => t.name), 1)[0]!, shape: "redonda", capacity: String(prefs.defaultCapacity), width: String(d.width), height: String(d.height), notes: "" }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, table?.id]);

  // Ao mudar o formato/capacidade de uma mesa nova, sugere um tamanho adequado.
  const shape = form.watch("shape"), capacity = form.watch("capacity");
  useEffect(() => {
    if (table || !open) return;
    const cap = Number(capacity);
    if (Number.isInteger(cap) && cap >= 1 && cap <= 40) { const d = defaultSize(shape, cap); form.setValue("width", String(d.width)); form.setValue("height", String(d.height)); }
  }, [shape, capacity, table, open, form]);

  const onSubmit = async (v: Out) => {
    setError(null);
    if (table) {
      const ok = await run(() => api.saveTable(table.id, { name: v.name, shape: v.shape, capacity: v.capacity, width: v.width, height: v.height, notes: v.notes }).then(() => true), { success: "Mesa atualizada.", invalidate: ["tables", "table_seats", "guest_seatings"] });
      if (ok) onOpenChange(false); else setError("Não foi possível guardar. Se reduziu a capacidade, retire primeiro convidados da mesa.");
      return;
    }
    const n = Math.max(1, Math.min(30, Number(qty) || 1));
    const names = n === 1 ? [v.name] : nextTableNames(tables.map((t) => t.name), n, v.name.replace(/\s*\d+$/, "") || "Mesa");
    const placed = [...tables];
    let lastId: string | undefined;
    const ok = await run(async () => {
      for (const name of names) {
        const pos = nextPosition(placed, v.width, v.height);
        const created = await api.saveTable(null, { name, shape: v.shape, capacity: v.capacity, width: v.width, height: v.height, x: pos.x, y: pos.y, notes: v.notes });
        placed.push({ x: pos.x, y: pos.y, width: v.width, height: v.height } as TableRow);
        lastId = created?.id;
      }
      return true;
    }, { success: n === 1 ? "Mesa criada." : `${n} mesas criadas.`, invalidate: ["tables", "table_seats"] });
    if (ok) { onOpenChange(false); if (lastId && n === 1) onCreated?.(lastId); }
    else setError("Não foi possível criar a mesa. Verifique se o nome já existe.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{table ? "Editar mesa" : "Nova mesa"}</DialogTitle><DialogDescription>{table ? "Altere o nome, o formato, a capacidade ou o tamanho." : "Escolha o nome, o formato e quantos lugares tem."}</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="name" label="Nome ou número *" className="sm:col-span-2" />
            <SelectField control={form.control} name="shape" label="Formato" options={entries(shapeLabel)} />
            <TextField control={form.control} name="capacity" label="Capacidade (lugares)" type="number" min={1} max={40} inputMode="numeric" />
            <TextField control={form.control} name="width" label="Largura" type="number" min={40} max={600} inputMode="numeric" />
            <TextField control={form.control} name="height" label="Altura" type="number" min={40} max={600} inputMode="numeric" />
            {!table && (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="table-qty">Quantas mesas criar</Label>
                <Input id="table-qty" type="number" min={1} max={30} value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" />
                <p className="text-xs text-muted-foreground">Com mais de uma, são numeradas automaticamente (Mesa 1, Mesa 2…).</p>
              </div>
            )}
            <TextareaField control={form.control} name="notes" label="Observações" className="sm:col-span-2" />
            <div className="sm:col-span-2"><FormError message={error} /></div>
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{table ? "Guardar" : "Criar"}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
