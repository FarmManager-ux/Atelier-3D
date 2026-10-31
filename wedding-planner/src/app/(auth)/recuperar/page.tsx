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
import { recoverSchema } from "@/lib/validation";

type In = z.input<typeof recoverSchema>;
type Out = z.output<typeof recoverSchema>;

export default function RecoverPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });

  const onSubmit = async (v: Out) => {
    setError(null);
    const { error: e } = await getSupabase().auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/auth/confirmar?next=/redefinir` });
    if (e && (e.status === 429 || /rate limit/i.test(e.message))) { setError(authErrorMessage(e)); return; }
    setDone(true); // resposta neutra: não revela se o email existe
  };

  if (done) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 text-center" role="status">
        <MailCheck className="size-8 text-sage-500" />
        <h1 className="font-serif text-2xl font-semibold">Verifique o seu email</h1>
        <p className="text-sm text-muted-foreground">Se existir uma conta com este email, enviámos uma ligação para definir uma nova palavra-passe.</p>
        <Button asChild variant="outline"><Link href="/entrar">Voltar à entrada</Link></Button>
      </CardContent></Card>
    );
  }
  return (
    <Card>
      <CardContent>
        <h1 className="mb-1 text-center font-serif text-2xl font-semibold">Recuperar palavra-passe</h1>
        <p className="mb-4 text-center text-sm text-muted-foreground">Indique o email da sua conta.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
            <FormError message={error} />
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Enviar ligação de recuperação</Button>
          </form>
        </Form>
        <p className="mt-5 text-center text-sm"><Link href="/entrar" className="text-primary underline-offset-4 hover:underline">Voltar à entrada</Link></p>
      </CardContent>
    </Card>
  );
}
