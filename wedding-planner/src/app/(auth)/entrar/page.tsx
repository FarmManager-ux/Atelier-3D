"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormError, TextField } from "@/components/fields";
import { authErrorMessage, safeNext } from "@/lib/auth-messages";
import { getSupabase } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation";

type In = z.input<typeof loginSchema>;
type Out = z.output<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get("erro") === "ligacao" ? "A ligação é inválida ou expirou. Peça uma nova." : null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (v: Out) => {
    setError(null);
    const { error: e } = await getSupabase().auth.signInWithPassword({ email: v.email, password: v.password });
    if (e) { setError(authErrorMessage(e)); return; }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  };

  return (
    <Card>
      <CardContent>
        <h1 className="mb-4 text-center font-serif text-2xl font-semibold">Entrar</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
            <TextField control={form.control} name="password" label="Palavra-passe" type="password" autoComplete="current-password" />
            <FormError message={error} />
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Entrar</Button>
          </form>
        </Form>
        <div className="mt-5 flex flex-col gap-1.5 text-center text-sm">
          <Link href="/recuperar" className="text-primary underline-offset-4 hover:underline">Esqueceu-se da palavra-passe?</Link>
          <p className="text-muted-foreground">Ainda não tem conta? <Link href="/registar" className="text-primary underline-offset-4 hover:underline">Criar conta</Link></p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
