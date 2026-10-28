import Link from "next/link";
import { Card } from "@/components/ui";
import { loadAccount } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export default async function AccountOverview({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { supabase, account } = await loadAccount(accountId);
  const [{ count: projects }, { count: files }] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("account_id", account.id),
    supabase.from("files").select("id", { count: "exact", head: true }).eq("account_id", account.id),
  ]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link href={`/conta/${account.id}/projetos`}>
        <Card className="hover:bg-[var(--border)]/30">
          <p className="text-3xl font-semibold">{projects ?? 0}</p>
          <p className="text-sm text-[var(--muted)]">{messages.projects.title}</p>
        </Card>
      </Link>
      <Card>
        <p className="text-3xl font-semibold">{files ?? 0}</p>
        <p className="text-sm text-[var(--muted)]">{messages.projects.files}</p>
      </Card>
      <p className="text-sm text-[var(--muted)] sm:col-span-2">{messages.portal.phase1}</p>
    </div>
  );
}
