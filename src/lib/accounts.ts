import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Garante que o utilizador tem uma conta (particular ou empresa) depois de
 * confirmar o email. Usa a RPC `create_account` (security definer, validada na BD).
 * Idempotente para o caso comum: se já pertence a uma conta, não faz nada.
 */
export async function ensureAccount(supabase: SupabaseClient, user: User): Promise<void> {
  const { count } = await supabase
    .from("account_members")
    .select("account_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) return;

  const meta = user.user_metadata ?? {};
  const type = meta.pending_account_type === "company" ? "company" : "individual";
  const name = String(meta.pending_account_name ?? meta.full_name ?? "").trim().slice(0, 200);
  if (!name) return;
  await supabase.rpc("create_account", { p_type: type, p_display_name: name });
}
