import Link from "next/link";
import type { Metadata } from "next";
import { requestPasswordReset } from "@/app/actions";
import { AuthForm, Field } from "@/components/form";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.auth.forgotTitle };
const t = messages.auth;

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.forgotTitle}</h1>
      <AuthForm action={requestPasswordReset} submitLabel={t.submitForgot}>
        <Field label={t.email} name="email" type="email" autoComplete="email" />
      </AuthForm>
      <Link className="text-sm underline" href="/entrar">{messages.nav.signIn}</Link>
    </>
  );
}
