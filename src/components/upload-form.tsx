"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { completeUpload, prepareUpload } from "@/app/(portal)/actions";
import { ACCEPT_ATTRIBUTE, checkFile, sanitizeFilename } from "@/lib/files/rules";
import { messages } from "@/lib/i18n/pt-PT";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const t = messages.projects;
type Phase = "idle" | "hashing" | "sending" | "verifying";

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function UploadForm({
  supabaseUrl, anonKey, accountId, projectId, fileId, defaultName,
}: {
  supabaseUrl: string; anonKey: string; accountId: string; projectId: string | null;
  fileId: string | null; defaultName?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setDone(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return setError(messages.files.errors.empty);

    // Pré-validação no browser (conveniência; o servidor e a BD voltam a validar tudo).
    const filename = sanitizeFilename(file.name);
    const check = checkFile(filename, file.size);
    if (!check.ok) return setError(messages.files.errors[check.error]);

    try {
      setPhase("hashing");
      const sha256 = await sha256Hex(file);
      const prepared = await prepareUpload({
        accountId, projectId, fileId,
        displayName: String(fd.get("displayName") || filename.replace(/\.[^.]+$/, "")),
        filename, size: file.size, sha256, notes: String(fd.get("notes") ?? ""),
      });
      if (!prepared.ok) return setError(prepared.message);

      setPhase("sending");
      const supabase = createBrowserSupabase(supabaseUrl, anonKey);
      const { error: upErr } = await supabase.storage.from("project-files").uploadToSignedUrl(prepared.path, prepared.token, file);
      if (upErr) return setError(messages.db.generic);

      setPhase("verifying");
      const result = await completeUpload(prepared.versionId);
      if (!result.ok) return setError(result.message);
      setDone(result.message);
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError(messages.db.generic);
    } finally {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";
  const label = { idle: fileId ? t.uploadNewVersion : t.upload, hashing: t.uploading, sending: t.sending, verifying: t.verifying }[phase];
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={`file-${fileId ?? "new"}`} className="text-sm font-medium">{t.chooseFile}</label>
        <input id={`file-${fileId ?? "new"}`} name="file" type="file" accept={ACCEPT_ATTRIBUTE} required disabled={busy}
          className="min-h-11 rounded-md border border-[var(--border)] p-2 text-sm" />
      </div>
      {!fileId && (
        <div className="flex flex-col gap-1">
          <label htmlFor="displayName" className="text-sm font-medium">{t.displayName}</label>
          <input id="displayName" name="displayName" maxLength={200} disabled={busy}
            className="min-h-11 rounded-md border border-[var(--border)] bg-transparent px-3 text-base" />
        </div>
      )}
      {fileId && <input type="hidden" name="displayName" value={defaultName} />}
      <div className="flex flex-col gap-1">
        <label htmlFor={`notes-${fileId ?? "new"}`} className="text-sm font-medium">{t.notes}</label>
        <input id={`notes-${fileId ?? "new"}`} name="notes" maxLength={1000} disabled={busy}
          className="min-h-11 rounded-md border border-[var(--border)] bg-transparent px-3 text-base" />
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      {done && <p role="status" className="text-sm text-[var(--ok)]">{done}</p>}
      <button type="submit" disabled={busy}
        className="min-h-11 rounded-md bg-[var(--brand)] px-4 font-medium text-[var(--brand-fg)] disabled:opacity-60">
        {label}
      </button>
    </form>
  );
}
