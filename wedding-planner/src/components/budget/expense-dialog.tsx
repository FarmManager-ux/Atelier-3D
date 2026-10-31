"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, SelectField, TextField, TextareaField } from "@/components/fields";
import { PaymentBadge } from "@/components/status";
import { useApi, useRun } from "@/lib/data/actions";
import { useCategories, useVendors, EMPTY } from "@/lib/data/queries";
import { parseMoney } from "@/lib/money";
import type { Expense } from "@/lib/db-types";
import { expenseSchema } from "@/lib/validation";

type In = z.input<typeof expenseSchema>;
type Out = z.output<typeof expenseSchema>;
const num = (n: number) => (n ? String(n).replace(".", ",") : "0");

export function ExpenseDialog({ open, onOpenChange, expense, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; expense?: Expense | null; defaults?: Partial<In> }) {
  const categories = useCategories().data ?? EMPTY;
  const vendors = useVendors().data ?? EMPTY;
  const api = useApi();
  const { run, pending } = useRun();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(expenseSchema) });

  useEffect(() => {
    if (!open) return;
    setError(null);
    form.reset(expense
      ? { description: expense.description, category_id: expense.category_id, vendor_id: expense.vendor_id ?? "none", planned_amount: num(expense.planned_amount), paid_amount: num(expense.paid_amount), payment_date: expense.payment_date ?? "", due_date: expense.due_date ?? "", notes: expense.notes ?? "" }
      : { description: "", category_id: categories[0]?.id ?? "", vendor_id: "none", planned_amount: "", paid_amount: "0", payment_date: "", due_date: "", notes: "", ...defaults });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const planned = parseMoney(form.watch("planned_amount")) ?? 0;
  const paid = parseMoney(form.watch("paid_amount")) ?? 0;
  const status = paid <= 0 ? "por_pagar" : paid < planned ? "parcial" : "pago";

  const onSubmit = async (v: Out) => {
    setError(null);
    const ok = await run(() => api.upsert("expenses", expense?.id ?? null, v).then(() => true), { success: expense ? "Despesa atualizada." : "Despesa registada.", invalidate: ["expenses"] });
    if (ok) onOpenChange(false); else setError("Não foi possível guardar a despesa.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{expense ? "Editar despesa" : "Nova despesa"}</DialogTitle><DialogDescription>Valores em euros (€). O estado do pagamento é calculado automaticamente.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="description" label="Descrição *" className="sm:col-span-2" placeholder="Ex.: Sinal da quinta" />
            <SelectField control={form.control} name="category_id" label="Categoria *" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Fornecedor</FormLabel>
                <Select value={field.value || "none"} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="none">Sem fornecedor</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <TextField control={form.control} name="planned_amount" label="Valor previsto (€) *" inputMode="decimal" placeholder="0,00" />
            <TextField control={form.control} name="paid_amount" label="Valor já pago (€)" inputMode="decimal" placeholder="0,00" />
            <div className="flex items-center gap-2 text-sm sm:col-span-2"><span className="text-muted-foreground">Estado do pagamento:</span><PaymentBadge status={status} /></div>
            <TextField control={form.control} name="due_date" label="Data limite de pagamento" type="date" />
            <TextField control={form.control} name="payment_date" label="Data do pagamento" type="date" />
            <TextareaField control={form.control} name="notes" label="Observações" className="sm:col-span-2" />
            <div className="sm:col-span-2"><FormError message={error} /></div>
            <DialogFooter className="sm:col-span-2">
              {planned > 0 && paid < planned && <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => { form.setValue("paid_amount", num(planned)); form.setValue("payment_date", format(new Date(), "yyyy-MM-dd")); }}>Marcar como pago</Button>}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{expense ? "Guardar" : "Registar despesa"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
