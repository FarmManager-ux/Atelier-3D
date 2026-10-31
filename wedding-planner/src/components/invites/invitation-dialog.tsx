"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Copy, ExternalLink, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectField, TextField, TextareaField } from "@/components/fields";
import { useConfirm } from "@/components/confirm";
import { RsvpBadge } from "@/components/status";
import { useApi, useRun } from "@/lib/data/actions";
import { useRsvpResponses, useWedding, EMPTY } from "@/lib/data/queries";
import { formatDateTime } from "@/lib/dates";
import type { Guest, Invitation } from "@/lib/db-types";
import { channelLabel, entries } from "@/lib/labels";
import { invitationSchema } from "@/lib/validation";
import { copyLink, rsvpUrl, whatsappLink } from "./rsvp-link";

type In = z.input<typeof invitationSchema>;
type Out = z.output<typeof invitationSchema>;
const toDay = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd") : "");

export function InvitationDialog({ open, onOpenChange, guest, invitation }: { open: boolean; onOpenChange: (o: boolean) => void; guest: Guest; invitation: Invitation }) {
  const api = useApi();
  const wedding = useWedding();
  const confirm = useConfirm();
  const { run, pending } = useRun();
  const responses = (useRsvpResponses().data ?? EMPTY).filter((r) => r.guest_id === guest.id);
  const [enabled, setEnabled] = useState(invitation.rsvp_enabled);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(invitationSchema) });

  useEffect(() => {
    if (!open) return;
    setEnabled(invitation.rsvp_enabled);
    form.reset({ channel: invitation.channel ?? "none", sent_at: toDay(invitation.sent_at), delivered_at: toDay(invitation.delivered_at), last_contacted_at: toDay(invitation.last_contacted_at), notes: invitation.notes ?? "" });
  }, [open, invitation, form]);

  const url = rsvpUrl(invitation.token);
  const message = `Olá ${guest.full_name.split(" ")[0]}! O casamento do ${wedding.partner1_name} e da ${wedding.partner2_name} vai ser a ${wedding.wedding_date.split("-").reverse().join("/")}. Por favor confirme a sua presença aqui: ${url}`;
  const wa = whatsappLink(guest.phone, message);

  const onSubmit = async (v: Out) => {
    const iso = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toISOString() : null);
    const ok = await run(() => api.updateInvitation(invitation.id, { channel: v.channel, sent_at: iso(v.sent_at), delivered_at: iso(v.delivered_at), last_contacted_at: iso(v.last_contacted_at), notes: v.notes, rsvp_enabled: enabled }).then(() => true), { success: "Convite atualizado.", invalidate: ["invitations"] });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Convite de {guest.full_name}</DialogTitle><DialogDescription>Datas do convite, link de confirmação (RSVP) e notas.</DialogDescription></DialogHeader>

        <section className="grid gap-2 rounded-lg bg-secondary/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="rsvp-link" className="font-medium">Link individual de confirmação</Label>
            <div className="flex items-center gap-2"><Switch id="rsvp-on" checked={enabled} onCheckedChange={setEnabled} aria-label="Link ativo" /><Label htmlFor="rsvp-on" className="text-xs font-normal text-muted-foreground">{enabled ? "Ativo" : "Desativado"}</Label></div>
          </div>
          <Input id="rsvp-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => copyLink(url)}><Copy /> Copiar link</Button>
            <Button type="button" size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Pré-visualizar</a></Button>
            {wa ? <Button type="button" size="sm" variant="outline" asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button> : <span className="self-center text-xs text-muted-foreground">Sem telefone válido para WhatsApp.</span>}
            <Button type="button" size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Gerar um novo link?", description: "O link atual deixa de funcionar. Terá de enviar o novo link ao convidado.", confirmLabel: "Gerar novo link" })) await run(() => api.regenerateToken(guest.id), { success: "Novo link gerado.", invalidate: ["invitations"] }); }}><RefreshCw /> Novo link</Button>
          </div>
          <p className="text-xs text-muted-foreground">Este link só permite responder por <strong>este</strong> convidado: não dá acesso a mais nada.</p>
        </section>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <SelectField control={form.control} name="channel" label="Canal de envio" options={[{ value: "none", label: "—" }, ...entries(channelLabel)]} className="sm:col-span-2" />
            <TextField control={form.control} name="sent_at" label="Enviado em" type="date" />
            <TextField control={form.control} name="delivered_at" label="Entregue em" type="date" />
            <TextField control={form.control} name="last_contacted_at" label="Último contacto" type="date" description="Usado para saber quem deve ser contactado de novo." className="sm:col-span-2" />
            <TextareaField control={form.control} name="notes" label="Observações" className="sm:col-span-2" />
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Resposta registada em: <strong className="text-foreground">{formatDateTime(invitation.responded_at)}</strong> <RsvpBadge status={guest.rsvp_status} /></p>
            </div>
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Guardar</Button></DialogFooter>
          </form>
        </Form>

        {responses.length > 0 && (
          <section className="grid gap-2 border-t pt-3">
            <h3 className="font-serif text-lg font-semibold">Histórico de respostas</h3>
            <ul className="grid max-h-40 gap-2 overflow-y-auto text-sm">
              {responses.map((r) => (
                <li key={r.id} className="rounded-md border bg-card p-2.5">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant={r.status === "confirmado" ? "success" : "danger"}>{r.status === "confirmado" ? "Confirmou" : "Recusou"}</Badge><Badge variant="outline">{r.source === "link" ? "Pelo link" : "Registo manual"}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</span></div>
                  {r.status === "confirmado" && <p className="mt-1 text-xs text-muted-foreground">+{r.companions_attending} acompanhantes · {r.children_attending} crianças</p>}
                  {r.message && <p className="mt-1">“{r.message}”</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
