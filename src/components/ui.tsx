import Link from "next/link";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[var(--border)] p-4 ${className}`}>{children}</section>;
}

export function SmallButton({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      className={`min-h-11 rounded-md border px-3 text-sm ${danger ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--border)]"}`}
    >
      {children}
    </button>
  );
}

export function TabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm hover:bg-[var(--border)]/40">
      {children}
    </Link>
  );
}
