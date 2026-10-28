import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.nav.account };
// Depende da sessão: nunca pode ser pré-renderizada nem partilhada em cache.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isSupabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/entrar");

  // A RLS garante que só são devolvidas as contas do próprio utilizador.
  const { data: accounts } = await supabase.from("accounts").select("id, type, display_name").order("created_at");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{messages.portal.welcome}</h1>
        <form action={signOut}>
          <button className="min-h-11 rounded-md border border-[var(--border)] px-4">{messages.nav.signOut}</button>
        </form>
      </header>
      {accounts?.length ? (
        <ul className="flex flex-col gap-2">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-md border border-[var(--border)] p-4">
              <p className="font-medium">{a.display_name}</p>
              <p className="text-sm text-[var(--muted)]">{a.type === "company" ? messages.auth.company : messages.auth.individual}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{messages.portal.noAccount}</p>
      )}
      <p className="text-[var(--muted)]">{messages.portal.phase0}</p>
    </main>
  );
}
