"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, SelectField, TextField, TextareaField } from "@/components/fields";
import { useConfirm } from "@/components/confirm";
import { useApi, useRun } from "@/lib/data/actions";
import { useVendors, EMPTY } from "@/lib/data/queries";
import type { CalendarEvent } from "@/lib/db-types";
import { entries, eventTypeLabel } from "@/lib/labels";
import { eventSchema } from "@/lib/validation";

type In = z.input<typeof eventSchema>;
type Out = z.output<typeof eventSchema>;

export function EventDialog({ open, onOpenChange, event, date }: { open: boolean; onOpenChange: (o: boolean) => void; event?: CalendarEvent | null; date?: string }) {
  const vendors = useVendors().data ?? EMPTY;
  const api = useApi();
  const { run, pending } = useRun();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(eventSchema) });

  useEffect(() => {
    if (!open) return;
    setError(null);
    form.reset(event
      ? { title: event.title, event_type: event.event_type, event_date: event.event_date, start_time: event.start_time?.slice(0, 5) ?? "", end_time: event.end_time?.slice(0, 5) ?? "", location: event.location ?? "", notes: event.notes ?? "", vendor_id: event.vendor_id ?? "none" }
      : { title: "", event_type: "reuniao", event_date: date ?? "", start_time: "", end_time: "", location: "", notes: "", vendor_id: "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, date]);

  const onSubmit = async (v: Out) => {
    setError(null);
    const ok = await run(() => api.upsert("calendar_events", event?.id ?? null, v).then(() => true), { success: event ? "Evento atualizado." : "Evento criado.", invalidate: ["calendar_events"] });
    if (ok) onOpenChange(false); else setError("Não foi possível guardar o evento.");
  };
  const del = async () => {
    if (!event || !(await confirm({ title: `Eliminar “${event.title}”?` }))) return;
    if (await run(() => api.remove("calendar_events", event.id).then(() => true), { success: "Evento eliminado.", invalidate: ["calendar_events"] })) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle><DialogDescription>Reuniões, provas de roupa, prazos e outras datas importantes.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="title" label="Título *" className="sm:col-span-2" />
            <SelectField control={form.control} name="event_type" label="Tipo" options={entries(eventTypeLabel)} />
            <TextField control={form.control} name="event_date" label="Data *" type="date" />
            <TextField control={form.control} name="start_time" label="Hora de início" type="time" />
            <TextField control={form.control} name="end_time" label="Hora de fim" type="time" />
            <TextField control={form.control} name="location" label="Local" />
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem><FormLabel>Fornecedor</FormLabel>
                <Select value={field.value || "none"} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">Nenhum</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}</SelectContent></Select>
              </FormItem>
            )} />
            <TextareaField control={form.control} name="notes" label="Observações" className="sm:col-span-2" />
            <div className="sm:col-span-2"><FormError message={error} /></div>
            <DialogFooter className="sm:col-span-2">
              {event && <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={del}><Trash2 /> Eliminar</Button>}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{event ? "Guardar" : "Criar evento"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
