import type { Metadata } from "next";
import { addContact, deleteContact } from "@/app/(portal)/actions";
import { ActionForm, CheckField, Field } from "@/components/form";
import { Card, SmallButton } from "@/components/ui";
import { loadAccount } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.book.contacts };
const t = messages.book;

export default async function ContactsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { supabase, account, canManage } = await loadAccount(accountId);
  const { data: contacts } = await supabase.from("account_contacts").select("*").eq("account_id", account.id).order("created_at");
  return (
    <>
      <h2 className="text-xl font-semibold">{t.contacts}</h2>
      {contacts?.length ? (
        <ul className="flex flex-col gap-3">
          {contacts.map((c) => (
            <li key={c.id}>
              <Card className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{c.name}{c.is_primary ? ` · ${t.primary}` : ""}</p>
                  {c.job_title && <p>{c.job_title}</p>}
                  {c.email && <p className="break-all">{c.email}</p>}
                  {c.phone && <p>{c.phone}</p>}
                </div>
                {canManage && (
                  <form action={deleteContact}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="id" value={c.id} />
                    <SmallButton danger>{t.remove}</SmallButton>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--muted)]">{t.empty}</p>
      )}
      {canManage && (
        <Card>
          <h3 className="mb-3 text-lg font-medium">{t.addContact}</h3>
          <ActionForm action={addContact} submitLabel={t.addContact} hidden={{ accountId: account.id }} resetOnSuccess>
            <Field label={t.name} name="name" autoComplete="name" />
            <Field label={t.jobTitle} name="jobTitle" required={false} autoComplete="organization-title" />
            <Field label={t.email} name="email" type="email" required={false} autoComplete="email" />
            <Field label={messages.profileForms.phone} name="phone" type="tel" inputMode="tel" required={false} autoComplete="tel" />
            <CheckField label={t.isPrimary} name="isPrimary" />
          </ActionForm>
        </Card>
      )}
    </>
  );
}
