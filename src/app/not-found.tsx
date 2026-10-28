import Link from "next/link";
import { messages } from "@/lib/i18n/pt-PT";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{messages.errors.notFound}</h1>
      <Link className="underline" href="/conta">{messages.nav.account}</Link>
    </main>
  );
}
