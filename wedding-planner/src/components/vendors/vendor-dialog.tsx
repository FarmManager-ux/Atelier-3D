"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { FormError, SelectField, TextField, TextareaField } from "@/components/fields";
import { useApi, useRun } from "@/lib/data/actions";
import type { Vendor } from "@/lib/db-types";
import { entries, vendorStatusLabel } from "@/lib/labels";
import { vendorSchema } from "@/lib/validation";

type In = z.input<typeof vendorSchema>;
type Out = z.output<typeof vendorSchema>;
const num = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const SERVICES = ["Espaço", "Catering", "Fotografia", "Vídeo", "Música/DJ", "Decoração", "Flores", "Vestido", "Fato", "Bolo", "Transporte", "Alojamento", "Convites", "Cabelo e maquilhagem"];

export function VendorDialog({ open, onOpenChange, vendor }: { open: boolean; onOpenChange: (o: boolean) => void; vendor?: Vendor | null }) {
  const api = useApi();
  const { run, pending } = useRun();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(vendorSchema) });

  useEffect(() => {
    if (!open) return;
    setError(null);
    form.reset(vendor
      ? { company_name: vendor.company_name, service_type: vendor.service_type ?? "", contact_name: vendor.contact_name ?? "", phone: vendor.phone ?? "", email: vendor.email ?? "", website: vendor.website ?? "", quoted_amount: num(vendor.quoted_amount), contracted_amount: num(vendor.contracted_amount), status: vendor.status, notes: vendor.notes ?? "" }
      : { company_name: "", service_type: "", contact_name: "", phone: "", email: "", website: "", quoted_amount: "", contracted_amount: "", status: "por_contactar", notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vendor?.id]);

  const onSubmit = async (v: Out) => {
    setError(null);
    const ok = await run(() => api.upsert("vendors", vendor?.id ?? null, v).then(() => true), { success: vendor ? "Fornecedor atualizado." : "Fornecedor adicionado.", invalidate: ["vendors"] });
    if (ok) onOpenChange(false); else setError("Não foi possível guardar o fornecedor.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{vendor ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle><DialogDescription>Guarde os contactos e o ponto da situação de cada fornecedor.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="company_name" label="Nome da empresa *" className="sm:col-span-2" />
            <TextField control={form.control} name="service_type" label="Tipo de serviço" list="vendor-services" placeholder="Ex.: Fotografia" />
            <datalist id="vendor-services">{SERVICES.map((s) => <option key={s} value={s} />)}</datalist>
            <SelectField control={form.control} name="status" label="Estado da contratação" options={entries(vendorStatusLabel)} />
            <TextField control={form.control} name="contact_name" label="Pessoa de contacto" />
            <TextField control={form.control} name="phone" label="Telefone" type="tel" inputMode="tel" />
            <TextField control={form.control} name="email" label="Email" type="email" inputMode="email" />
            <TextField control={form.control} name="website" label="Website" type="url" inputMode="url" placeholder="https://" />
            <TextField control={form.control} name="quoted_amount" label="Valor orçamentado (€)" inputMode="decimal" />
            <TextField control={form.control} name="contracted_amount" label="Valor contratado (€)" inputMode="decimal" />
            <TextareaField control={form.control} name="notes" label="Observações" className="sm:col-span-2" />
            <div className="sm:col-span-2"><FormError message={error} /></div>
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{vendor ? "Guardar" : "Adicionar fornecedor"}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
