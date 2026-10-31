"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormError, TextField } from "@/components/fields";
import { authErrorMessage } from "@/lib/auth-messages";
import { getSupabase } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validation";

type In = z.input<typeof signupSchema>;
type Out = z.output<typeof signupSchema>;

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(signupSchema), defaultValues: { email: "", password: "", confirm: "" } });

  const onSubmit = async (v: Out) => {
    setError(null);
    const { data, error: e } = await getSupabase().auth.signUp({
      email: v.email, password: v.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmar?next=/` },
    });
    if (e) { setError(authErrorMessage(e)); return; }
    // Com a confirmação por email desativada, a sessão já existe: segue para a aplicação.
    if (data.session) { window.location.assign("/"); return; }
    setDone(true);
  };

  if (done) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 text-center" role="status">
        <MailCheck className="size-8 text-sage-500" />
        <h1 className="font-serif text-2xl font-semibold">Verifique o seu email</h1>
        <p className="text-sm text-muted-foreground">Se o pedido for válido, enviámos uma ligação de confirmação. Depois de confirmar, volte aqui para entrar.</p>
        <Button asChild variant="outline"><Link href="/entrar">Ir para a entrada</Link></Button>
      </CardContent></Card>
    );
  }
  return (
    <Card>
      <CardContent>
        <h1 className="mb-1 text-center font-serif text-2xl font-semibold">Criar conta</h1>
        <p className="mb-4 text-center text-sm text-muted-foreground">Depois de criar a conta, o casamento é configurado no primeiro acesso, ou o seu par convida-o(a) com este email.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
            <TextField control={form.control} name="password" label="Palavra-passe" type="password" autoComplete="new-password" description="Mínimo de 10 caracteres." />
            <TextField control={form.control} name="confirm" label="Repetir palavra-passe" type="password" autoComplete="new-password" />
            <FormError message={error} />
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Criar conta</Button>
          </form>
        </Form>
        <p className="mt-5 text-center text-sm text-muted-foreground">Já tem conta? <Link href="/entrar" className="text-primary underline-offset-4 hover:underline">Entrar</Link></p>
      </CardContent>
    </Card>
  );
}
