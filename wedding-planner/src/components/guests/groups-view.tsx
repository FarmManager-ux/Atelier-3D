"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/page";
import { TextField, TextareaField } from "@/components/fields";
import { useConfirm } from "@/components/confirm";
import { useApi, useRun } from "@/lib/data/actions";
import { useGroups, useGuests, EMPTY } from "@/lib/data/queries";
import { normalizeText } from "@/lib/domain/guests";
import type { GuestGroup } from "@/lib/db-types";
import { groupSchema } from "@/lib/validation";
import { useEffect } from "react";

type In = z.input<typeof groupSchema>;
type Out = z.output<typeof groupSchema>;

function GroupDialog({ open, onOpenChange, group }: { open: boolean; onOpenChange: (o: boolean) => void; group: GuestGroup | null }) {
  const api = useApi();
  const { run, pending } = useRun();
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(groupSchema), defaultValues: { name: "", notes: "" } });
  useEffect(() => { if (open) form.reset({ name: group?.name ?? "", notes: group?.notes ?? "" }); }, [open, group, form]);
  const onSubmit = async (v: Out) => {
    const ok = await run(() => api.saveGroup(group?.id ?? null, v).then(() => true), { success: group ? "Grupo atualizado." : "Grupo criado.", invalidate: ["guest_groups"] });
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{group ? "Editar grupo" : "Novo grupo ou família"}</DialogTitle><DialogDescription>Agrupe pessoas do mesmo agregado familiar ou de um mesmo círculo.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <TextField control={form.control} name="name" label="Nome do grupo *" placeholder="Ex.: Família Silva" />
            <TextareaField control={form.control} name="notes" label="Observações" />
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Guardar</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddMembersDialog({ open, onOpenChange, group }: { open: boolean; onOpenChange: (o: boolean) => void; group: GuestGroup }) {
  const guests = useGuests().data ?? EMPTY;
  const groups = useGroups().data ?? EMPTY;
  const api = useApi();
  const { run, pending } = useRun();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => { if (open) { setQ(""); setPicked(new Set()); } }, [open]);
  const candidates = useMemo(() => guests.filter((g) => g.group_id !== group.id && (!q || normalizeText(g.full_name).includes(normalizeText(q)))).slice(0, 80), [guests, group.id, q]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar a “{group.name}”</DialogTitle><DialogDescription>Escolha as pessoas que pertencem a este agregado.</DialogDescription></DialogHeader>
        <Input placeholder="Pesquisar por nome…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar convidados" />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {candidates.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhum convidado disponível.</li>}
          {candidates.map((g) => (
            <li key={g.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary">
              <Checkbox id={`m-${g.id}`} checked={picked.has(g.id)} onCheckedChange={(c) => setPicked((s) => { const n = new Set(s); if (c === true) n.add(g.id); else n.delete(g.id); return n; })} />
              <Label htmlFor={`m-${g.id}`} className="flex-1 cursor-pointer font-normal">{g.full_name}{g.group_id && <span className="ml-2 text-xs text-muted-foreground">({groups.find((x) => x.id === g.group_id)?.name})</span>}</Label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!picked.size || pending} onClick={async () => { const ok = await run(() => api.setGroupMembers(group.id, [...picked]).then(() => true), { success: `${picked.size} adicionados ao grupo.`, invalidate: ["guests"] }); if (ok) onOpenChange(false); }}>{pending && <Loader2 className="animate-spin" />}Adicionar {picked.size || ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupsView() {
  const groups = useGroups().data ?? EMPTY;
  const guests = useGuests().data ?? EMPTY;
  const api = useApi();
  const { run } = useRun();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<GuestGroup | null | undefined>(undefined);
  const [add, setAdd] = useState<GuestGroup | null>(null);

  const stats = useMemo(() => groups.map((g) => {
    const members = guests.filter((x) => x.group_id === g.id);
    return { group: g, members, people: members.reduce((a, m) => a + m.invited_count, 0) };
  }), [groups, guests]);
  const ungrouped = guests.filter((g) => !g.group_id);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Associe várias pessoas ao mesmo agregado familiar. A contagem usa sempre pessoas individuais, sem duplicar registos.</p>
        <Button onClick={() => setEdit(null)}><Plus /> Novo grupo</Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={Users} title="Ainda não há famílias nem grupos" description="Crie um grupo (por exemplo, “Família Silva”) e associe-lhe os convidados que pertencem ao mesmo agregado." action={<Button onClick={() => setEdit(null)}><Plus /> Criar o primeiro grupo</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stats.map(({ group, members, people }) => (
            <Card key={group.id} className="gap-3">
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div className="min-w-0"><CardTitle className="truncate text-lg">{group.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? "registo" : "registos"} · {people} {people === 1 ? "pessoa" : "pessoas"}</p></div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEdit(group)} aria-label={`Editar ${group.name}`}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${group.name}`} onClick={async () => {
                    if (await confirm({ title: `Eliminar o grupo “${group.name}”?`, description: members.length ? `Os ${members.length} convidados deste grupo não são apagados: ficam apenas sem grupo.` : undefined }))
                      await run(() => api.deleteGroup(group.id), { success: "Grupo eliminado.", invalidate: ["guest_groups", "guests"] });
                  }}><Trash2 /></Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-1">
                {members.length === 0 && <p className="text-sm text-muted-foreground">Sem pessoas associadas.</p>}
                {members.map((m) => (
                  <div key={m.id} className="group flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary">
                    <span className="truncate">{m.full_name}{m.invited_count > 1 && <Badge variant="outline" className="ml-2">{m.invited_count}</Badge>}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Retirar ${m.full_name} do grupo`} onClick={() => run(() => api.setGroupMembers(null, [m.id]), { success: "Retirado do grupo.", invalidate: ["guests"] })}><UserMinus /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => setAdd(group)}><UserPlus /> Adicionar pessoas</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <p className="text-sm text-muted-foreground">{ungrouped.length === 0 ? "Todos os convidados estão num grupo." : `${ungrouped.length} ${ungrouped.length === 1 ? "convidado está" : "convidados estão"} sem grupo.`}</p>
      )}

      <GroupDialog open={edit !== undefined} onOpenChange={(o) => { if (!o) setEdit(undefined); }} group={edit ?? null} />
      {add && <AddMembersDialog open onOpenChange={(o) => { if (!o) setAdd(null); }} group={add} />}
    </div>
  );
}
