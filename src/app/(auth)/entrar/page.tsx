import Link from "next/link";
import type { Metadata } from "next";
import { signIn } from "@/app/actions";
import { AuthForm, Field } from "@/components/form";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.nav.signIn };
const t = messages.auth;

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.signInTitle}</h1>
      {sp.erro && <p role="alert" className="text-sm text-[var(--danger)]">{t.linkInvalid}</p>}
      <AuthForm action={signIn} submitLabel={t.submitSignIn} hidden={{ next: safeRedirectPath(sp.next) }}>
        <>
            <Field label={t.email} name="email" type="email" autoComplete="email" />
            <Field label={t.password} name="password" type="password" autoComplete="current-password" />
          </>
      </AuthForm>
      <div className="flex flex-col gap-1 text-sm">
        <Link className="underline" href="/recuperar-palavra-passe">{t.forgotLink}</Link>
        <p>{t.noAccount} <Link className="underline" href="/registar">{messages.nav.signUp}</Link></p>
      </div>
    </>
  );
}
