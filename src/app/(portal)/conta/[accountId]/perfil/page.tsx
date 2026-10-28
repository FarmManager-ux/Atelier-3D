import type { Metadata } from "next";
import { saveFiscalData, updateAccountDetails } from "@/app/(portal)/actions";
import { ActionForm, Field } from "@/components/form";
import { Card } from "@/components/ui";
import { loadAccount } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.accounts.tabs.profile };
const t = messages.profileForms;

export default async function AccountProfilePage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { supabase, account, canManage } = await loadAccount(accountId);
  // A RLS só devolve dados fiscais a proprietários/administradores da conta.
  const { data: fiscal } = canManage
    ? await supabase.from("account_fiscal_data").select("legal_name, nif, country").eq("account_id", account.id).maybeSingle()
    : { data: null };

  if (!canManage) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t.details}</h2>
        <p>{account.display_name}</p>
        <p className="text-sm text-[var(--muted)]">{t.readOnly}</p>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <h2 className="mb-3 text-lg font-medium">{t.details}</h2>
        <ActionForm action={updateAccountDetails} submitLabel={t.save} hidden={{ accountId: account.id }}>
          <Field label={t.displayName} name="displayName" defaultValue={account.display_name} />
          <Field label={t.phone} name="phone" type="tel" inputMode="tel" autoComplete="tel" required={false} defaultValue={account.phone} />
          <Field label={t.website} name="website" type="url" inputMode="url" required={false} defaultValue={account.website} />
          <Field label={t.billingEmail} name="billingEmail" type="email" required={false} defaultValue={account.billing_email} />
          <Field label={t.activity} name="activity" required={false} defaultValue={account.activity} />
        </ActionForm>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-medium">{t.fiscal}</h2>
        <ActionForm action={saveFiscalData} submitLabel={t.save} hidden={{ accountId: account.id }}>
          <Field label={t.legalName} name="legalName" required={false} defaultValue={fiscal?.legal_name} />
          <Field label={t.nif} name="nif" required={false} inputMode="numeric" defaultValue={fiscal?.nif} />
          <Field label={t.country} name="country" required={false} maxLength={2} defaultValue={fiscal?.country ?? "PT"} />
        </ActionForm>
      </Card>
    </>
  );
}
