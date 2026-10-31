"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { SelectField, TextField, TextareaField } from "@/components/fields";
import { useApi, useRun } from "@/lib/data/actions";
import type { Guest } from "@/lib/db-types";
import { manualRsvpSchema } from "@/lib/validation";

type In = z.input<typeof manualRsvpSchema>;
type Out = z.output<typeof manualRsvpSchema>;

/** Para respostas recebidas por telefone, mensagem ou pessoalmente. */
export function ManualRsvpDialog({ open, onOpenChange, guest }: { open: boolean; onOpenChange: (o: boolean) => void; guest: Guest }) {
  const api = useApi();
  const { run, pending } = useRun();
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(manualRsvpSchema) });
  useEffect(() => {
    if (open) form.reset({ status: guest.rsvp_status === "nao_vai" ? "nao_vai" : "confirmado", companions: String(guest.attending_companions ?? guest.companions_count), children: String(guest.attending_children ?? guest.children_count), dietary: guest.dietary_restrictions ?? "", allergies: guest.allergies ?? "", message: "" });
  }, [open, guest, form]);
  const status = form.watch("status");

  const onSubmit = async (v: Out) => {
    const ok = await run(() => api.recordRsvp(guest.id, { status: v.status, companions: v.companions, children: v.children, dietary: v.dietary, allergies: v.allergies, message: v.message }).then(() => true), { success: "Resposta registada.", invalidate: ["guests", "invitations", "rsvp_responses", "guest_seatings", "table_seats"] });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registar resposta de {guest.full_name}</DialogTitle><DialogDescription>Máximo autorizado: {guest.companions_count} acompanhantes e {guest.children_count} crianças.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <SelectField control={form.control} name="status" label="Resposta" className="sm:col-span-2" options={[{ value: "confirmado", label: "Vai estar presente" }, { value: "nao_vai", label: "Não vai comparecer" }]} />
            {status === "confirmado" && (<>
              <TextField control={form.control} name="companions" label="Acompanhantes que vêm" type="number" min={0} max={guest.companions_count} inputMode="numeric" />
              <TextField control={form.control} name="children" label="Crianças que vêm" type="number" min={0} max={guest.children_count} inputMode="numeric" />
              <TextField control={form.control} name="dietary" label="Restrições alimentares" />
              <TextField control={form.control} name="allergies" label="Alergias" />
            </>)}
            <TextareaField control={form.control} name="message" label="Observação" className="sm:col-span-2" />
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Registar resposta</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
