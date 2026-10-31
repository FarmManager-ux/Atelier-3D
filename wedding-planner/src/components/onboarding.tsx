"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { TextField, FormError } from "@/components/fields";
import { getSupabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { setupSchema } from "@/lib/validation";

type In = z.input<typeof setupSchema>;
type Out = z.output<typeof setupSchema>;

/** Primeiro acesso: aceita um convite pendente ou cria o casamento. */
export function Onboarding({ email }: { email: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(setupSchema),
    defaultValues: { name: "O Nosso Casamento", partner1_name: "Paulo", partner2_name: "Inês", wedding_date: "2027-07-02" },
  });

  const checkInvite = async (manual = false) => {
    setChecking(true);
    const { data, error: e } = await getSupabase().rpc("accept_wedding_invitation");
    if (!e && data) { toast.success("Bem-vindo(a)! Foi adicionado(a) ao casamento."); router.refresh(); return; }
    if (e) setError(friendlyError(e));
    else if (manual) toast.info("Ainda não há nenhum convite para este email.");
    setChecking(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void checkInvite(); }, []);

  const onSubmit = async (v: Out) => {
    setError(null);
    const { error: e } = await getSupabase().rpc("create_wedding", { p_name: v.name, p_partner1: v.partner1_name, p_partner2: v.partner2_name, p_date: v.wedding_date });
    if (e) { setError(friendlyError(e)); return; }
    toast.success("Casamento criado. Boa organização!");
    router.refresh();
  };

  if (checking) return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-6 animate-spin text-sage-500" aria-label="A carregar" /></div>;
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl place-items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <span className="mb-2 grid size-12 place-items-center rounded-full bg-sage-100 text-gold-600"><Heart className="size-5 fill-current" /></span>
          <CardTitle className="text-3xl">Vamos começar</CardTitle>
          <CardDescription>Configure o seu casamento. Pode alterar tudo mais tarde nas Definições.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
              <TextField control={form.control} name="name" label="Nome do projeto" />
              <div className="grid grid-cols-2 gap-3">
                <TextField control={form.control} name="partner1_name" label="Noivo(a) 1" />
                <TextField control={form.control} name="partner2_name" label="Noivo(a) 2" />
              </div>
              <TextField control={form.control} name="wedding_date" label="Data do casamento" type="date" />
              <FormError message={error} />
              <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Criar o nosso casamento</Button>
            </form>
          </Form>
          <div className="mt-6 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
            <p>O seu par já criou o casamento? Peça-lhe para o convidar em <strong>Definições → Utilizadores</strong> com o email <strong className="break-all text-foreground">{email}</strong> e depois verifique aqui.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void checkInvite(true)}>Verificar convite</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
