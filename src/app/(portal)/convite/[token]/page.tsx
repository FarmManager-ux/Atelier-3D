import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvitation } from "@/app/(portal)/actions";
import { Card } from "@/components/ui";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.team.accept, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await acceptInvitation(token);
  if (result.accountId) redirect(`/conta/${result.accountId}`);
  return (
    <Card className="flex flex-col gap-3">
      <p role="alert">{result.message}</p>
      <Link className="underline" href="/conta">{messages.accounts.title}</Link>
    </Card>
  );
}
