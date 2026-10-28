import Link from "next/link";
import { signOut } from "@/app/actions";
import { messages } from "@/lib/i18n/pt-PT";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/conta" className="min-h-11 content-center text-lg font-semibold tracking-tight">{messages.brand}</Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/perfil" className="flex min-h-11 items-center rounded-md px-3 hover:bg-[var(--border)]/40">{messages.nav.profile}</Link>
          <form action={signOut}>
            <button className="min-h-11 rounded-md px-3 hover:bg-[var(--border)]/40">{messages.nav.signOut}</button>
          </form>
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-6 pb-10">{children}</main>
    </div>
  );
}
