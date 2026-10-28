import { loadAccount } from "@/lib/action-helpers";
import { TabLink } from "@/components/ui";
import { messages } from "@/lib/i18n/pt-PT";

export default async function AccountLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { account } = await loadAccount(accountId);
  const t = messages.accounts.tabs;
  const base = `/conta/${account.id}`;
  return (
    <>
      <div>
        <p className="text-sm text-[var(--muted)]">{account.type === "company" ? messages.auth.company : messages.auth.individual}</p>
        <h1 className="text-2xl font-semibold">{account.display_name}</h1>
      </div>
      <nav aria-label="Secções da conta" className="-mx-4 flex gap-1 overflow-x-auto px-4">
        <TabLink href={base}>{t.overview}</TabLink>
        <TabLink href={`${base}/projetos`}>{t.projects}</TabLink>
        <TabLink href={`${base}/perfil`}>{t.profile}</TabLink>
        <TabLink href={`${base}/moradas`}>{t.addresses}</TabLink>
        <TabLink href={`${base}/contactos`}>{t.contacts}</TabLink>
        <TabLink href={`${base}/equipa`}>{t.team}</TabLink>
      </nav>
      {children}
    </>
  );
}
