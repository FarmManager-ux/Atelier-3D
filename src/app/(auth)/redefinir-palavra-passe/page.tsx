import type { Metadata } from "next";
import { resetPassword } from "@/app/actions";
import { AuthForm, Field } from "@/components/form";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.auth.resetTitle };
const t = messages.auth;

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.resetTitle}</h1>
      <AuthForm action={resetPassword} submitLabel={t.submitReset}>
        <Field label={t.newPassword} name="password" type="password" autoComplete="new-password" hint={t.passwordHint} />
      </AuthForm>
    </>
  );
}
