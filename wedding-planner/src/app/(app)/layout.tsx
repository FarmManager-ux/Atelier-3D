import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ConfirmProvider } from "@/components/confirm";
import { Onboarding } from "@/components/onboarding";
import { WeddingProvider } from "@/lib/data/context";
import { isSupabaseConfigured } from "@/lib/env";
import type { MemberRole, Wedding } from "@/lib/db-types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  const { data: membership } = await supabase.from("wedding_members").select("wedding_id, role").eq("user_id", auth.user.id).maybeSingle();
  if (!membership) return <Onboarding email={auth.user.email ?? ""} />;
  const { data: wedding } = await supabase.from("weddings").select("*").eq("id", membership.wedding_id).single<Wedding>();
  if (!wedding) return <Onboarding email={auth.user.email ?? ""} />;

  return (
    <WeddingProvider value={{ wedding, user: { id: auth.user.id, email: auth.user.email }, role: membership.role as MemberRole }}>
      <ConfirmProvider><AppShell>{children}</AppShell></ConfirmProvider>
    </WeddingProvider>
  );
}
