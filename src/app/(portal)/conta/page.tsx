import type { Metadata } from "next";
import Link from "next/link";
import { createCompanyAccount } from "@/app/(portal)/actions";
import { ActionForm, Field } from "@/components/form";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.nav.account };
export const dynamic = "force-dynamic";
const t = messages.accounts;

export default async function AccountsPage() {
  const { supabase } = await requireUser();
  // A RLS devolve apenas as contas a que o utilizador pertence.
  const { data: accounts } = await supabase.from("accounts").select("id, type, display_name").order("created_at");

  return (
    <>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      {accounts?.length ? (
        <ul className="flex flex-col gap-2">
          {accounts.map((a) => (
            <li key={a.id}>
              <Link href={`/conta/${a.id}`} className="flex min-h-14 flex-col justify-center rounded-lg border border-[var(--border)] px-4 py-2 hover:bg-[var(--border)]/30">
                <span className="font-medium">{a.display_name}</span>
                <span className="text-sm text-[var(--muted)]">{a.type === "company" ? messages.auth.company : messages.auth.individual}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>{messages.portal.noAccount}</p>
      )}
      <Card>
        <h2 className="mb-3 text-lg font-medium">{t.createCompany}</h2>
        <ActionForm action={createCompanyAccount} submitLabel={t.createCompanySubmit}>
          <Field label={messages.auth.companyName} name="displayName" autoComplete="organization" />
        </ActionForm>
      </Card>
    </>
  );
}
