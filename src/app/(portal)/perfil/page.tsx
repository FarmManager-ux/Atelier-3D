import type { Metadata } from "next";
import { updateUserProfile } from "@/app/(portal)/actions";
import { ActionForm, Field } from "@/components/form";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.profileForms.userTitle };
export const dynamic = "force-dynamic";

export default async function UserProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.profileForms.userTitle}</h1>
      <Card>
        <p className="mb-3 text-sm text-[var(--muted)]">{user.email}</p>
        <ActionForm action={updateUserProfile} submitLabel={messages.profileForms.save}>
          <Field label={messages.auth.fullName} name="fullName" autoComplete="name" defaultValue={profile?.full_name} />
          <Field label={messages.profileForms.phone} name="phone" type="tel" inputMode="tel" autoComplete="tel" required={false} defaultValue={profile?.phone} />
        </ActionForm>
      </Card>
    </>
  );
}
