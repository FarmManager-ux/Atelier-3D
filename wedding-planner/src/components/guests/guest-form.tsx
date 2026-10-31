"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectField, TextField, TextareaField, FormError } from "@/components/fields";
import { useRun, useApi } from "@/lib/data/actions";
import { useGroups, useSeatings, useSeats, useTables, useGuests, useWedding, EMPTY } from "@/lib/data/queries";
import { buildSeatingView, seatLabel } from "@/lib/domain/seating";
import type { Guest } from "@/lib/db-types";
import { ageGroupLabel, categoryLabel, entries, invitationStatusLabel, rsvpStatusLabel, sideLabel } from "@/lib/labels";
import { guestSchema, type GuestFormInput, type GuestFormOutput } from "@/lib/validation";

const blank: GuestFormInput = {
  full_name: "", surname: "", phone: "", email: "", group_id: "none", relationship: "", side: "both", category: "outros", age_group: "adulto",
  companion_names: "", companions_count: "0", children_count: "0", dietary_restrictions: "", allergies: "", notes: "",
  invitation_status: "por_convidar", rsvp_status: "sem_resposta",
};

const toForm = (g: Guest): GuestFormInput => ({
  full_name: g.full_name, surname: g.surname ?? "", phone: g.phone ?? "", email: g.email ?? "", group_id: g.group_id ?? "none", relationship: g.relationship ?? "",
  side: g.side, category: g.category, age_group: g.age_group, companion_names: g.companion_names ?? "", companions_count: String(g.companions_count),
  children_count: String(g.children_count), dietary_restrictions: g.dietary_restrictions ?? "", allergies: g.allergies ?? "", notes: g.notes ?? "",
  invitation_status: g.invitation_status, rsvp_status: g.rsvp_status,
});

export function GuestFormDialog({ open, onOpenChange, guest, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; guest?: Guest | null; defaults?: Partial<GuestFormInput> }) {
  const wedding = useWedding();
  const api = useApi();
  const { run, pending } = useRun();
  const groups = useGroups().data ?? EMPTY;
  const guests = useGuests().data ?? EMPTY;
  const tables = useTables().data ?? EMPTY;
  const seats = useSeats().data ?? EMPTY;
  const seatings = useSeatings().data ?? EMPTY;
  const [error, setError] = useState<string | null>(null);
  const [tableId, setTableId] = useState("none");

  const form = useForm<GuestFormInput, unknown, GuestFormOutput>({ resolver: zodResolver(guestSchema), defaultValues: blank });
  const view = useMemo(() => buildSeatingView(tables, guests, seatings, seats), [tables, guests, seatings, seats]);
  const currentTable = guest ? (view.tableOfGuest.get(guest.id) ?? "none") : "none";
  const currentSeats = guest ? view.byId.get(currentTable)?.guests.find((x) => x.guest.id === guest.id)?.seatNumbers ?? [] : [];

  useEffect(() => {
    if (!open) return;
    setError(null);
    form.reset(guest ? toForm(guest) : { ...blank, ...defaults });
    setTableId(guest ? (view.tableOfGuest.get(guest.id) ?? "none") : "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guest?.id]);

  const rsvp = form.watch("rsvp_status");
  const companions = Number(form.watch("companions_count")) || 0;
  const children = Number(form.watch("children_count")) || 0;
  const people = 1 + companions + children;

  const onSubmit = async (v: GuestFormOutput) => {
    setError(null);
    const ok = await run(async () => {
      let id = guest?.id;
      if (guest) await api.updateGuest(guest.id, v);
      else id = (await api.createGuest(v)).id;
      if (id && tableId !== currentTable) {
        if (tableId === "none") await api.unassign(id); else await api.assign(id, tableId);
      }
      return true;
    }, { success: guest ? "Convidado atualizado." : "Convidado adicionado.", invalidate: ["guests", "invitations", "guest_seatings", "table_seats"] });
    if (ok) onOpenChange(false);
    else setError("Não foi possível guardar. Verifique os campos e a capacidade da mesa.");
  };

  const dialogTitle = guest ? "Editar convidado" : "Adicionar convidado";
  const tableOptions = tables.map((t) => {
    const s = view.byId.get(t.id);
    const free = (s?.free ?? t.capacity) + (t.id === currentTable ? currentSeats.length : 0);
    const need = rsvp === "nao_vai" ? 0 : people;
    return { value: t.id, label: `${t.name} · ${free} livres`, disabled: free < need && t.id !== currentTable };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{guest ? "Altere os dados do convidado e do seu agregado." : "Registe o convidado e, se for caso disso, os acompanhantes e crianças."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
            <section className="grid gap-3 sm:grid-cols-2">
              <TextField control={form.control} name="full_name" label="Nome completo *" autoComplete="off" className="sm:col-span-2" />
              <TextField control={form.control} name="surname" label="Apelido" />
              <TextField control={form.control} name="phone" label="Telefone" type="tel" inputMode="tel" />
              <TextField control={form.control} name="email" label="Email" type="email" inputMode="email" className="sm:col-span-2" />
            </section>
            <section className="grid gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="group_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo ou família</FormLabel>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="none">Sem grupo</SelectItem>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormDescription>Crie grupos no separador “Famílias”.</FormDescription>
                </FormItem>
              )} />
              <TextField control={form.control} name="relationship" label="Relação com os noivos" placeholder="Ex.: prima da Inês" />
              <SelectField control={form.control} name="side" label="Lado" options={[{ value: "partner1", label: sideLabel("partner1", wedding) }, { value: "partner2", label: sideLabel("partner2", wedding) }, { value: "both", label: "Ambos" }]} />
              <SelectField control={form.control} name="category" label="Categoria" options={entries(categoryLabel)} />
              <SelectField control={form.control} name="age_group" label="Adulto ou criança" options={entries(ageGroupLabel)} />
            </section>
            <section className="grid gap-3 rounded-lg bg-secondary/60 p-3 sm:grid-cols-2">
              <TextField control={form.control} name="companion_names" label="Nome dos acompanhantes" className="sm:col-span-2" description="Separe os nomes por vírgula." />
              <TextField control={form.control} name="companions_count" label="N.º de acompanhantes" type="number" min={0} max={20} inputMode="numeric" />
              <TextField control={form.control} name="children_count" label="N.º de crianças" type="number" min={0} max={20} inputMode="numeric" />
              <p className="text-sm text-muted-foreground sm:col-span-2">Este registo representa <strong className="text-foreground">{people} {people === 1 ? "pessoa" : "pessoas"}</strong> (convidado + acompanhantes + crianças).</p>
            </section>
            <section className="grid gap-3 sm:grid-cols-2">
              <TextField control={form.control} name="dietary_restrictions" label="Restrições alimentares" placeholder="Ex.: vegetariano" />
              <TextField control={form.control} name="allergies" label="Alergias alimentares" placeholder="Ex.: frutos secos" />
            </section>
            <section className="grid gap-3 sm:grid-cols-2">
              <SelectField control={form.control} name="invitation_status" label="Estado do convite" options={entries(invitationStatusLabel)} />
              <SelectField control={form.control} name="rsvp_status" label="Estado da presença" options={entries(rsvpStatusLabel)} description="É independente do estado do convite." />
              <FormItem className="sm:col-span-2">
                <FormLabel htmlFor="guest-table">Mesa atribuída</FormLabel>
                <Select value={tableId} onValueChange={setTableId} disabled={rsvp === "nao_vai"}>
                  <SelectTrigger id="guest-table" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem mesa</SelectItem>
                    {tableOptions.map((o) => <SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}{o.disabled ? " (não cabe)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {rsvp === "nao_vai" ? "Quem não vai comparecer não ocupa lugares." : currentSeats.length ? `Lugares atuais: ${seatLabel(currentSeats)}. A distribuição visual faz-se em “Organização das mesas”.` : "Pode também arrastar o convidado na planta de mesas."}
                </FormDescription>
              </FormItem>
              <TextareaField control={form.control} name="notes" label="Observações" className="sm:col-span-2" />
            </section>
            <FormError message={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{guest ? "Guardar alterações" : "Adicionar convidado"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
