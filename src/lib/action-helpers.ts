import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { uuidSchema } from "@/lib/validation/profile";

/** Utilizador autenticado + cliente com a sua sessão (a RLS aplica-se sempre). */
export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");
  return { supabase, user: data.user };
}

export type AccountRole = "owner" | "admin" | "member";

/** Carrega a conta pedida; 404 se não existir OU se o utilizador não tiver acesso (não revela a diferença). */
export const loadAccount = cache(async (accountId: string) => {
  if (!uuidSchema.safeParse(accountId).success) notFound();
  const { supabase, user } = await requireUser();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, type, display_name, phone, website, billing_email, activity")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) notFound();
  const { data: membership } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (membership?.role ?? null) as AccountRole | null;
  return {
    supabase,
    user,
    account,
    role,
    canManage: role === "owner" || role === "admin",
    isOwner: role === "owner",
  };
});

export function formObject(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
}
