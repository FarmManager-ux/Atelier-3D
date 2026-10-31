"use client";

import { use, useEffect, useState } from "react";
import { CalendarHeart, CheckCircle2, Heart, Loader2, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FormError, SelectField, TextField, TextareaField } from "@/components/fields";
import { getSupabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/dates";
import { publicRsvpSchema } from "@/lib/validation";

interface Payload {
  wedding: { name: string; partner1: string; partner2: string; date: string; venue: string | null };
  guest: { name: string; authorized_companions: number; authorized_children: number; companion_names: string | null };
  current: { status: "sem_resposta" | "confirmado" | "nao_vai"; companions: number | null; children: number | null; dietary_restrictions: string | null; allergies: string | null };
}
type In = z.input<typeof publicRsvpSchema>;
type Out = z.output<typeof publicRsvpSchema>;
const range = (n: number) => Array.from({ length: n + 1 }, (_, i) => ({ value: String(i), label: String(i) }));

/** Página pública (sem login) de confirmação de presença: o token do link é a credencial. */
export default function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "invalid" | "form" | "done">("loading");
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(publicRsvpSchema), defaultValues: { status: undefined, companions: "0", children: "0", companion_names: "", dietary: "", allergies: "", message: "" } });

  const apply = (p: Payload) => {
    setData(p);
    form.reset({
      status: p.current.status === "sem_resposta" ? undefined : p.current.status,
      companions: String(p.current.companions ?? p.guest.authorized_companions), children: String(p.current.children ?? p.guest.authorized_children),
      companion_names: p.guest.companion_names ?? "", dietary: p.current.dietary_restrictions ?? "", allergies: p.current.allergies ?? "", message: "",
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: d, error: e } = await getSupabase().rpc("get_rsvp_invitation", { p_token: token });
      if (!alive) return;
      if (e || !d) { setState("invalid"); return; }
      apply(d as Payload); setState("form");
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const status = form.watch("status");

  const onSubmit = async (v: Out) => {
    setError(null);
    const { data: d, error: e } = await getSupabase().rpc("submit_rsvp", {
      p_token: token, p_status: v.status, p_companions: v.status === "confirmado" ? v.companions : 0, p_children: v.status === "confirmado" ? v.children : 0,
      p_companion_names: v.companion_names || null, p_dietary: v.dietary || null, p_allergies: v.allergies || null, p_message: v.message || null,
    });
    if (e) { setError(e.message && /inválido|Demasiadas|acompanhantes|crianças/i.test(e.message) ? e.message : "Não foi possível enviar a sua resposta. Tente novamente."); return; }
    apply(d as Payload); setState("done");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-5 px-4 py-10">
      {state === "loading" && <div className="grid place-items-center py-20" role="status"><Loader2 className="size-6 animate-spin text-sage-500" aria-label="A carregar" /></div>}

      {state === "invalid" && (
        <Card><CardContent className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
          <Heart className="size-8 text-gold" />
          <h1 className="font-serif text-2xl font-semibold">Este link não está disponível</h1>
          <p className="text-sm text-muted-foreground">O link de confirmação é inválido ou foi desativado. Por favor, contacte os noivos.</p>
        </CardContent></Card>
      )}

      {data && (state === "form" || state === "done") && (
        <>
          <header className="text-center">
            <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-sage-100 text-gold-600"><Heart className="size-6 fill-current" /></span>
            <p className="text-sm tracking-widest text-muted-foreground uppercase">Convite de casamento</p>
            <h1 className="mt-1 font-serif text-4xl leading-tight font-semibold text-sage-900">{data.wedding.partner1} <span className="text-gold">&amp;</span> {data.wedding.partner2}</h1>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm"><CalendarHeart className="size-4 text-gold" />{formatDate(data.wedding.date)}</p>
            {data.wedding.venue && <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{data.wedding.venue}</p>}
          </header>

          {state === "done" ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-6 text-center" role="status">
              <CheckCircle2 className="size-9 text-sage-500" />
              <h2 className="font-serif text-2xl font-semibold">Obrigado, {data.guest.name.split(" ")[0]}!</h2>
              <p className="text-sm text-muted-foreground">{data.current.status === "confirmado" ? "A sua presença ficou confirmada. Mal podemos esperar por celebrar consigo!" : "Lamentamos que não possa estar presente. Obrigado por nos avisar."}</p>
              <Button variant="outline" onClick={() => setState("form")}>Alterar a minha resposta</Button>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent>
                <p className="mb-4 text-center">Olá, <strong>{data.guest.name}</strong>. Vai estar presente no nosso casamento?</p>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">A sua resposta</FormLabel>
                        <FormControl>
                          <RadioGroup value={field.value ?? ""} onValueChange={field.onChange} className="grid-cols-1 gap-2 sm:grid-cols-2">
                            <Label htmlFor="r-yes" className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 has-[[data-state=checked]]:border-sage-400 has-[[data-state=checked]]:bg-sage-50"><RadioGroupItem id="r-yes" value="confirmado" />Sim, estarei presente</Label>
                            <Label htmlFor="r-no" className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 has-[[data-state=checked]]:border-sage-400 has-[[data-state=checked]]:bg-sage-50"><RadioGroupItem id="r-no" value="nao_vai" />Não poderei ir</Label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {status === "confirmado" && (
                      <>
                        {(data.guest.authorized_companions > 0 || data.guest.authorized_children > 0) && (
                          <div className="grid grid-cols-2 gap-3">
                            {data.guest.authorized_companions > 0 && <SelectField control={form.control} name="companions" label={`Acompanhantes (até ${data.guest.authorized_companions})`} options={range(data.guest.authorized_companions)} />}
                            {data.guest.authorized_children > 0 && <SelectField control={form.control} name="children" label={`Crianças (até ${data.guest.authorized_children})`} options={range(data.guest.authorized_children)} />}
                          </div>
                        )}
                        {data.guest.authorized_companions > 0 && <TextField control={form.control} name="companion_names" label="Nome dos acompanhantes" description="Separe os nomes por vírgula." />}
                        <TextField control={form.control} name="dietary" label="Restrições alimentares" placeholder="Ex.: vegetariano, sem lactose" />
                        <TextField control={form.control} name="allergies" label="Alergias" placeholder="Ex.: frutos secos, marisco" />
                      </>
                    )}
                    {status && <TextareaField control={form.control} name="message" label="Quer deixar uma mensagem? (opcional)" />}
                    <FormError message={error} />
                    <Button type="submit" size="lg" disabled={form.formState.isSubmitting || !status}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Enviar resposta</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          <p className="text-center text-xs text-muted-foreground">Este link é pessoal. Só permite responder por si.</p>
        </>
      )}
    </main>
  );
}
