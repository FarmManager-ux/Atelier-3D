import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FinalizeDeps } from "./finalize";

export const FILES_BUCKET = "project-files";

/** Implementação de produção das dependências de finalização (chave de serviço). */
export function supabaseFinalizeDeps(): FinalizeDeps {
  const admin = createAdminClient();
  return {
    async getPending(id) {
      const { data } = await admin
        .from("file_versions")
        .select("id, storage_path, extension, size_bytes, declared_sha256, status")
        .eq("id", id)
        .maybeSingle();
      if (!data || data.status !== "pending") return null;
      return {
        id: data.id,
        storagePath: data.storage_path,
        extension: data.extension,
        sizeBytes: Number(data.size_bytes),
        declaredSha256: data.declared_sha256,
      };
    },
    async openObject(path) {
      const { data, error } = await admin.storage.from(FILES_BUCKET).createSignedUrl(path, 60);
      if (error || !data) return null;
      const res = await fetch(data.signedUrl);
      if (!res.ok || !res.body) return null;
      return res.body as unknown as AsyncIterable<Uint8Array>;
    },
    async removeObject(path) {
      await admin.storage.from(FILES_BUCKET).remove([path]);
    },
    async complete(id, size, sha) {
      const { data, error } = await admin.rpc("complete_file_upload", { p_version: id, p_size: size, p_sha256: sha });
      if (error) throw error;
      return data as "available" | "rejected";
    },
    async reject(id, reason) {
      const { error } = await admin.rpc("reject_file_upload", { p_version: id, p_reason: reason });
      if (error) throw error;
    },
  };
}
