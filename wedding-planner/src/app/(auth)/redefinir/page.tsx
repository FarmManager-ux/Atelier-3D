"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormError, TextField } from "@/components/fields";
import { authErrorMessage } from "@/lib/auth-messages";
import { getSupabase } from "@/lib/supabase/client";
import { resetSchema } from "@/lib/validation";

type In = z.input<typeof resetSchema>;
type Out = z.output<typeof resetSchema>;

export default function ResetPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = async (v: Out) => {
    setError(null);
    const supabase = getSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setError("A ligação expirou. Peça uma nova recuperação de palavra-passe."); return; }
    const { error: e } = await supabase.auth.updateUser({ password: v.password });
    if (e) { setError(authErrorMessage(e)); return; }
    toast.success("Palavra-passe atualizada.");
    router.replace("/");
    router.refresh();
  };

  return (
    <Card>
      <CardContent>
        <h1 className="mb-4 text-center font-serif text-2xl font-semibold">Nova palavra-passe</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <TextField control={form.control} name="password" label="Nova palavra-passe" type="password" autoComplete="new-password" description="Mínimo de 10 caracteres." />
            <TextField control={form.control} name="confirm" label="Repetir palavra-passe" type="password" autoComplete="new-password" />
            <FormError message={error} />
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="animate-spin" />}Guardar palavra-passe</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
