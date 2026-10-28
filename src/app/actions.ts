"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { ensureAccount } from "@/lib/accounts";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { messages } from "@/lib/i18n/pt-PT";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type FieldErrors,
} from "@/lib/validation/auth";

export type FormState = { errors?: FieldErrors; message?: string; ok?: boolean };

const t = messages.auth;

function formObject(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
}

function unavailable(): FormState {
  return { message: t.genericError };
}

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return unavailable();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { message: error.status === 429 ? t.rateLimited : t.invalidCredentials };
  }
  redirect(safeRedirectPath(String(fd.get("next") ?? "")));
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(formObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return unavailable();

  const { fullName, email, password, accountType, companyName } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirmar?next=/conta`,
      // A conta (particular/empresa) é criada após a confirmação do email (ver /conta).
      data: { full_name: fullName, pending_account_type: accountType, pending_account_name: companyName ?? fullName },
    },
  });
  if (error && error.status === 429) return { message: t.rateLimited };
  // Confirmação de email desativada → já há sessão; cria a conta de imediato.
  if (!error && data.session && data.user) {
    await ensureAccount(supabase, data.user);
    redirect("/conta");
  }
  // Resposta idêntica com ou sem erro "já registado": não revela se o email existe.
  return { ok: true, message: t.signUpDone };
}

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return unavailable();

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirmar?next=/redefinir-palavra-passe`,
  });
  if (error && error.status === 429) return { message: t.rateLimited };
  return { ok: true, message: t.forgotDone };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(formObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return unavailable();

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { message: t.linkInvalid };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: t.genericError };
  redirect("/conta");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  // Origem lida só para garantir contexto de request; destino fixo e interno.
  await headers();
  redirect("/entrar");
}
