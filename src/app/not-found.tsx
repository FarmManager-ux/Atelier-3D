import Link from "next/link";
import { common } from "@/shared/i18n/pt-PT";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="font-display text-6xl font-bold text-[var(--accent)]">404</p>
      <h1 className="text-xl">{common.notFound}</h1>
      <Link className="underline underline-offset-4" href="/">Voltar ao início</Link>
    </main>
  );
}
