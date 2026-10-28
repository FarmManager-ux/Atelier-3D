import { messages } from "@/lib/i18n/pt-PT";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <p className="text-lg font-semibold tracking-tight">{messages.brand}</p>
      {children}
    </main>
  );
}
