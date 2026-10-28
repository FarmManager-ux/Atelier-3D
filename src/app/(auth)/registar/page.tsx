import Link from "next/link";
import type { Metadata } from "next";
import { signUp } from "@/app/actions";
import { AuthForm, Field, FieldError } from "@/components/form";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.nav.signUp };
const t = messages.auth;

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.signUpTitle}</h1>
      <AuthForm action={signUp} submitLabel={t.submitSignUp}>
        <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t.accountType}</legend>
              <label className="flex min-h-11 items-center gap-2"><input type="radio" name="accountType" value="individual" defaultChecked /> {t.individual}</label>
              <label className="flex min-h-11 items-center gap-2"><input type="radio" name="accountType" value="company" /> {t.company}</label>
            </fieldset>
            <Field label={t.companyName} name="companyName" required={false} autoComplete="organization" />
            <Field label={t.fullName} name="fullName" autoComplete="name" />
            <Field label={t.email} name="email" type="email" autoComplete="email" />
            <Field label={t.password} name="password" type="password" autoComplete="new-password" hint={t.passwordHint} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="acceptTerms" className="mt-1" /> <span>{t.acceptTerms}</span>
            </label>
            <FieldError name="acceptTerms" />
          </>
      </AuthForm>
      <p className="text-sm">{t.haveAccount} <Link className="underline" href="/entrar">{messages.nav.signIn}</Link></p>
    </>
  );
}
