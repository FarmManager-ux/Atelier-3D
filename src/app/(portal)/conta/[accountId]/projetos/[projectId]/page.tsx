import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveVersion, setFileArchived } from "@/app/(portal)/actions";
import { Card, SmallButton } from "@/components/ui";
import { UploadForm } from "@/components/upload-form";
import { loadAccount } from "@/lib/action-helpers";
import { publicEnv } from "@/lib/env";
import { messages } from "@/lib/i18n/pt-PT";
import { uuidSchema } from "@/lib/validation/profile";

export const metadata: Metadata = { title: messages.projects.title };
const t = messages.projects;

const formatSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);

export default async function ProjectPage({ params }: { params: Promise<{ accountId: string; projectId: string }> }) {
  const { accountId, projectId } = await params;
  if (!uuidSchema.safeParse(projectId).success) notFound();
  const { supabase, account, canManage } = await loadAccount(accountId);
  const { data: project } = await supabase.from("projects").select("id, name, description")
    .eq("id", projectId).eq("account_id", account.id).maybeSingle();
  if (!project) notFound();

  const { data: files } = await supabase.from("files")
    .select("id, display_name, kind, approved_version_id, archived_at, file_versions(id, version_number, original_filename, size_bytes, sha256, created_at)")
    .eq("account_id", account.id).eq("project_id", project.id)
    .eq("file_versions.status", "available")
    .order("created_at", { ascending: false });
  const env = publicEnv();
  // Ficheiros sem nenhuma versão verificada (uploads falhados/pendentes) não são listados.
  const library = (files ?? []).filter((f) => (f.file_versions ?? []).length > 0);

  return (
    <>
      <Link className="text-sm underline" href={`/conta/${account.id}/projetos`}>← {t.back}</Link>
      <div>
        <h2 className="text-xl font-semibold">{project.name}</h2>
        {project.description && <p className="text-[var(--muted)]">{project.description}</p>}
      </div>
      <p className="text-sm text-[var(--muted)]">{t.approvedHelp}</p>

      <h3 className="text-lg font-medium">{t.files}</h3>
      {library.length ? (
        <ul className="flex flex-col gap-3">
          {library.map((f) => {
            const versions = [...(f.file_versions ?? [])].sort((a, b) => b.version_number - a.version_number);
            return (
              <li key={f.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{f.display_name}{f.archived_at ? ` · ${t.archived}` : ""}</p>
                    {canManage && (
                      <form action={setFileArchived}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <input type="hidden" name="fileId" value={f.id} />
                        <input type="hidden" name="archived" value={f.archived_at ? "false" : "true"} />
                        <SmallButton>{f.archived_at ? t.unarchive : t.archive}</SmallButton>
                      </form>
                    )}
                  </div>
                  <ul className="flex flex-col divide-y divide-[var(--border)]">
                    {versions.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div className="min-w-0">
                          <p>
                            <span className="font-medium">{t.version} {v.version_number}</span>
                            {f.approved_version_id === v.id && <span className="ml-2 rounded bg-[var(--ok)]/15 px-2 py-0.5 text-[var(--ok)]">{t.approved}</span>}
                          </p>
                          <p className="break-all text-[var(--muted)]">{v.original_filename} · {formatSize(Number(v.size_bytes))} · {new Date(v.created_at).toLocaleDateString("pt-PT")}</p>
                        </div>
                        <div className="flex gap-2">
                          <a className="flex min-h-11 items-center rounded-md border border-[var(--border)] px-3" href={`/conta/${account.id}/ficheiros/${v.id}/descarregar`}>{t.download}</a>
                          {canManage && f.approved_version_id !== v.id && (
                            <form action={approveVersion}>
                              <input type="hidden" name="accountId" value={account.id} />
                              <input type="hidden" name="versionId" value={v.id} />
                              <SmallButton>{t.approve}</SmallButton>
                            </form>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!f.archived_at && (
                    <details>
                      <summary className="flex min-h-11 cursor-pointer items-center text-sm underline">{t.uploadNewVersion}</summary>
                      <div className="pt-3">
                        <UploadForm supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL} anonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
                          accountId={account.id} projectId={project.id} fileId={f.id} defaultName={f.display_name} />
                      </div>
                    </details>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[var(--muted)]">{t.noFiles}</p>
      )}

      <Card>
        <h3 className="mb-3 text-lg font-medium">{t.upload}</h3>
        <UploadForm supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL} anonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          accountId={account.id} projectId={project.id} fileId={null} />
      </Card>
    </>
  );
}
