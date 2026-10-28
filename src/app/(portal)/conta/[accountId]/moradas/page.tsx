import type { Metadata } from "next";
import { addAddress, deleteAddress } from "@/app/(portal)/actions";
import { ActionForm, CheckField, Field, SelectField } from "@/components/form";
import { Card, SmallButton } from "@/components/ui";
import { loadAccount } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.book.addresses };
const t = messages.book;

export default async function AddressesPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { supabase, account, canManage } = await loadAccount(accountId);
  const { data: addresses } = await supabase.from("account_addresses").select("*").eq("account_id", account.id).order("created_at");
  const kindLabel = { billing: t.billing, shipping: t.shipping, other: t.other } as const;

  return (
    <>
      <h2 className="text-xl font-semibold">{t.addresses}</h2>
      {addresses?.length ? (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card className="flex items-start justify-between gap-3">
                <address className="text-sm not-italic">
                  <p className="font-medium">
                    {kindLabel[a.kind as keyof typeof kindLabel]}{a.label ? ` · ${a.label}` : ""}
                    {a.is_default ? ` · ${t.default}` : ""}
                  </p>
                  <p>{a.recipient_name}</p>
                  <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                  <p>{a.postal_code} {a.city}{a.region ? `, ${a.region}` : ""} ({a.country})</p>
                </address>
                {canManage && (
                  <form action={deleteAddress}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="id" value={a.id} />
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
          <h3 className="mb-3 text-lg font-medium">{t.addAddress}</h3>
          <ActionForm action={addAddress} submitLabel={t.addAddress} hidden={{ accountId: account.id }} resetOnSuccess>
            <SelectField label={t.kind} name="kind" defaultValue="shipping"
              options={[{ value: "shipping", label: t.shipping }, { value: "billing", label: t.billing }, { value: "other", label: t.other }]} />
            <Field label={t.label} name="label" required={false} />
            <Field label={t.recipient} name="recipientName" autoComplete="name" />
            <Field label={t.line1} name="line1" autoComplete="address-line1" />
            <Field label={t.line2} name="line2" required={false} autoComplete="address-line2" />
            <Field label={t.postalCode} name="postalCode" autoComplete="postal-code" inputMode="numeric" hint="0000-000" />
            <Field label={t.city} name="city" autoComplete="address-level2" />
            <Field label={t.region} name="region" required={false} />
            <Field label={messages.profileForms.country} name="country" required={false} maxLength={2} defaultValue="PT" />
            <Field label={messages.profileForms.phone} name="phone" type="tel" inputMode="tel" required={false} autoComplete="tel" />
            <CheckField label={t.isDefault} name="isDefault" />
          </ActionForm>
        </Card>
      )}
    </>
  );
}
