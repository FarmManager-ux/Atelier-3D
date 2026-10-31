"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormError, TextField } from "@/components/fields";
import { useConfirm } from "@/components/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { authErrorMessage } from "@/lib/auth-messages";
import { getSupabase } from "@/lib/supabase/client";
import { useApi, useRun } from "@/lib/data/actions";
import { useWeddingContext } from "@/lib/data/context";
import { useMembers, useWedding, useWeddingInvites, EMPTY } from "@/lib/data/queries";
import { formatDateTime } from "@/lib/dates";
import { readPreferences } from "@/lib/preferences";
import { inviteMemberSchema, resetSchema, weddingSchema } from "@/lib/validation";

type WIn = z.input<typeof weddingSchema>;
type WOut = z.output<typeof weddingSchema>;

export function WeddingForm() {
  const wedding = useWedding();
  const api = useApi();
  const { run, pending } = useRun();
  const form = useForm<WIn, unknown, WOut>({ resolver: zodResolver(weddingSchema) });
  useEffect(() => {
    form.reset({ name: wedding.name, partner1_name: wedding.partner1_name, partner2_name: wedding.partner2_name, wedding_date: wedding.wedding_date, venue_name: wedding.venue_name ?? "", total_budget: String(wedding.total_budget).replace(".", ",") });
  }, [wedding, form]);
  const onSubmit = (v: WOut) => run(() => api.saveWedding(v), { success: "Dados do casamento guardados.", invalidate: ["weddings"] });
  return (
    <Card>
      <CardHeader><CardTitle>O casamento</CardTitle><CardDescription>Estas informações aparecem em toda a aplicação e nos links de confirmação enviados aos convidados.</CardDescription></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="name" label="Nome do projeto *" className="sm:col-span-2" />
            <TextField control={form.control} name="partner1_name" label="Noivo(a) 1 *" />
            <TextField control={form.control} name="partner2_name" label="Noivo(a) 2 *" />
            <TextField control={form.control} name="wedding_date" label="Data do casamento *" type="date" />
            <TextField control={form.control} name="total_budget" label="Orçamento total (€)" inputMode="decimal" description="O limite que definiram para todas as despesas." />
            <TextField control={form.control} name="venue_name" label="Local da cerimónia/festa" className="sm:col-span-2" />
            <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Guardar alterações</Button></div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const prefsSchema = z.object({
  followUpDays: z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 60, "Indique um número de dias entre 1 e 60.").transform(Number),
  defaultCapacity: z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 40, "Indique uma capacidade entre 1 e 40.").transform(Number),
});
type PIn = z.input<typeof prefsSchema>;
type POut = z.output<typeof prefsSchema>;

export function PreferencesForm() {
  const wedding = useWedding();
  const api = useApi();
  const { run, pending } = useRun();
  const form = useForm<PIn, unknown, POut>({ resolver: zodResolver(prefsSchema) });
  useEffect(() => { const p = readPreferences(wedding); form.reset({ followUpDays: String(p.followUpDays), defaultCapacity: String(p.defaultCapacity) }); }, [wedding, form]);
  const onSubmit = (v: POut) => run(() => api.saveWedding({ preferences: { ...wedding.preferences, ...v } }), { success: "Preferências guardadas.", invalidate: ["weddings"] });
  return (
    <Card>
      <CardHeader><CardTitle>Preferências</CardTitle><CardDescription>Ajustes de funcionamento partilhados pelos dois noivos.</CardDescription></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="followUpDays" label="Voltar a contactar após (dias)" type="number" min={1} max={60} inputMode="numeric" description="Convidados sem resposta há mais dias aparecem em “A contactar”." />
            <TextField control={form.control} name="defaultCapacity" label="Capacidade por omissão das mesas" type="number" min={1} max={40} inputMode="numeric" description="Usada ao criar novas mesas." />
            <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Guardar preferências</Button></div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

type IIn = z.input<typeof inviteMemberSchema>;
type IOut = z.output<typeof inviteMemberSchema>;

export function UsersCard() {
  const { user, role } = useWeddingContext();
  const membersQ = useMembers();
  const invitesQ = useWeddingInvites();
  const api = useApi();
  const { run, pending } = useRun();
  const confirm = useConfirm();
  const form = useForm<IIn, unknown, IOut>({ resolver: zodResolver(inviteMemberSchema), defaultValues: { email: "" } });
  const members = membersQ.data ?? EMPTY;
  const pendingInvites = (invitesQ.data ?? EMPTY).filter((i) => !i.accepted_at);

  const invite = async (v: IOut) => {
    if (members.some((m) => m.email?.toLowerCase() === v.email)) { form.setError("email", { message: "Esta pessoa já tem acesso." }); return; }
    const ok = await run(() => api.inviteMember(v.email).then(() => true), { success: "Convite criado. A pessoa só tem de criar conta com este email.", invalidate: ["wedding_invitations"] });
    if (ok) form.reset({ email: "" });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Utilizadores autorizados</CardTitle><CardDescription>Só estas pessoas veem e editam os dados do casamento, em simultâneo.</CardDescription></CardHeader>
      <CardContent className="grid gap-4">
        {membersQ.isPending ? <Skeleton className="h-16" /> : (
          <ul className="grid gap-2">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage-100 font-semibold text-sage-800">{(m.email ?? "?").charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.email ?? "Utilizador"}{m.user_id === user.id && <span className="ml-1.5 text-xs text-muted-foreground">(você)</span>}</p><p className="text-xs text-muted-foreground">Desde {formatDateTime(m.created_at)}</p></div>
                <Badge variant={m.role === "owner" ? "gold" : "default"}>{m.role === "owner" ? <><ShieldCheck />Proprietário</> : "Membro"}</Badge>
                {role === "owner" && m.role !== "owner" && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remover acesso de ${m.email}`} onClick={async () => { if (await confirm({ title: `Remover o acesso de ${m.email}?`, description: "Deixa de poder ver ou editar o casamento.", confirmLabel: "Remover acesso" })) await run(() => api.removeMember(m.user_id), { success: "Acesso removido.", invalidate: ["wedding_members"] }); }}><Trash2 /></Button>
                )}
                {m.user_id === user.id && m.role !== "owner" && (
                  <Button variant="ghost" size="sm" onClick={async () => { if (await confirm({ title: "Sair deste casamento?", description: "Perde o acesso até ser convidado(a) de novo.", confirmLabel: "Sair" })) { await run(() => api.removeMember(m.user_id), {}); window.location.assign("/"); } }}>Sair</Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {pendingInvites.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Convites pendentes</h3>
            <ul className="grid gap-1.5">{pendingInvites.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-sm"><Mail className="size-4 text-sage-400" /><span className="min-w-0 flex-1 truncate">{i.email}</span><span className="text-xs text-muted-foreground">aguarda registo</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Revogar convite de ${i.email}`} onClick={() => run(() => api.revokeInvite(i.id), { success: "Convite revogado.", invalidate: ["wedding_invitations"] })}><Trash2 /></Button></li>
            ))}</ul>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(invite)} className="grid gap-2 rounded-lg bg-secondary/60 p-3" noValidate>
            <p className="text-sm font-medium">Convidar o seu par (ou outra pessoa)</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start"><TextField control={form.control} name="email" label="Email" type="email" inputMode="email" className="flex-1 [&>label]:sr-only" placeholder="email@exemplo.pt" /><Button type="submit" disabled={pending} className="sm:mt-0"><UserPlus />Convidar</Button></div>
            <p className="text-xs text-muted-foreground">A pessoa cria conta em “Criar conta” com este email e entra automaticamente neste casamento. Máximo de 6 utilizadores.</p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function AccountCard() {
  const { user } = useWeddingContext();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof resetSchema>, unknown, z.output<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });
  const onSubmit = async (v: z.output<typeof resetSchema>) => {
    setError(null);
    const { error: e } = await getSupabase().auth.updateUser({ password: v.password });
    if (e) { setError(authErrorMessage(e)); return; }
    toast.success("Palavra-passe atualizada."); form.reset({ password: "", confirm: "" });
  };
  const logout = async () => { await getSupabase().auth.signOut(); router.replace("/entrar"); router.refresh(); };
  return (
    <Card>
      <CardHeader><CardTitle>A minha conta</CardTitle><CardDescription>{user.email}</CardDescription></CardHeader>
      <CardContent className="grid gap-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="password" label="Nova palavra-passe" type="password" autoComplete="new-password" description="Mínimo de 10 caracteres." />
            <TextField control={form.control} name="confirm" label="Repetir palavra-passe" type="password" autoComplete="new-password" />
            <div className="sm:col-span-2"><FormError message={error} /></div>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}<KeyRound />Alterar palavra-passe</Button><Button type="button" variant="outline" onClick={logout}><LogOut />Terminar sessão</Button></div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
