import type { Metadata } from "next";
import Link from "next/link";
import { createProject } from "@/app/(portal)/actions";
import { ActionForm, Field } from "@/components/form";
import { Card } from "@/components/ui";
import { loadAccount } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.projects.title };
const t = messages.projects;

export default async function ProjectsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { supabase, account } = await loadAccount(accountId);
  const { data: projects } = await supabase.from("projects").select("id, name, description, status, created_at")
    .eq("account_id", account.id).order("created_at", { ascending: false });
  return (
    <>
      <h2 className="text-xl font-semibold">{t.title}</h2>
      {projects?.length ? (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/conta/${account.id}/projetos/${p.id}`}>
                <Card className="hover:bg-[var(--border)]/30">
                  <p className="font-medium">{p.name}</p>
                  {p.description && <p className="line-clamp-2 text-sm text-[var(--muted)]">{p.description}</p>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--muted)]">{t.none}</p>
      )}
      <Card>
        <h3 className="mb-3 text-lg font-medium">{t.create}</h3>
        <ActionForm action={createProject} submitLabel={t.submit} hidden={{ accountId: account.id }}>
          <Field label={t.name} name="name" />
          <Field label={t.description} name="description" required={false} />
        </ActionForm>
      </Card>
    </>
  );
}
