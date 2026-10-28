import { createHash } from "node:crypto";
import { sniffFile } from "./sniff";

export type PendingVersion = {
  id: string;
  storagePath: string;
  extension: string;
  sizeBytes: number;
  declaredSha256: string;
};

/** Dependências injetadas (Supabase em produção, simulações nos testes). */
export interface FinalizeDeps {
  getPending(versionId: string): Promise<PendingVersion | null>;
  openObject(path: string): Promise<AsyncIterable<Uint8Array> | null>;
  removeObject(path: string): Promise<void>;
  complete(versionId: string, size: number, sha256: string): Promise<"available" | "rejected">;
  reject(versionId: string, reason: string): Promise<void>;
}

export type FinalizeResult =
  | { status: "available"; sha256: string }
  | { status: "rejected"; reason: string }
  | { status: "not_found" };

const HEAD_BYTES = 4096;

/**
 * Verifica o objeto carregado (tamanho real, SHA-256, assinatura do formato) e só então
 * marca a versão como disponível. Em qualquer falha a versão é rejeitada e o objeto removido.
 */
export async function finalizeUpload(deps: FinalizeDeps, versionId: string): Promise<FinalizeResult> {
  const version = await deps.getPending(versionId);
  if (!version) return { status: "not_found" };

  const fail = async (reason: string, remove = true): Promise<FinalizeResult> => {
    await deps.reject(version.id, reason);
    if (remove) await deps.removeObject(version.storagePath).catch(() => {});
    return { status: "rejected", reason };
  };

  const stream = await deps.openObject(version.storagePath);
  if (!stream) return fail("O ficheiro não foi carregado", false);

  const hash = createHash("sha256");
  const head = new Uint8Array(HEAD_BYTES);
  let headLen = 0;
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    // Corta cedo se o objeto exceder o tamanho declarado (proteção de recursos).
    if (total > version.sizeBytes) return fail("O ficheiro excede o tamanho declarado");
    hash.update(chunk);
    if (headLen < HEAD_BYTES) {
      const n = Math.min(HEAD_BYTES - headLen, chunk.length);
      head.set(chunk.subarray(0, n), headLen);
      headLen += n;
    }
  }
  if (total !== version.sizeBytes) return fail("O tamanho do ficheiro não coincide com o declarado");

  const sniff = sniffFile(version.extension, head.subarray(0, headLen), total);
  if (!sniff.ok) return fail(sniff.reason);

  const sha256 = hash.digest("hex");
  if (sha256 !== version.declaredSha256) return fail("A impressão digital (SHA-256) não coincide");

  const status = await deps.complete(version.id, total, sha256);
  if (status === "rejected") {
    await deps.removeObject(version.storagePath).catch(() => {});
    return { status: "rejected", reason: "Verificação falhou" };
  }
  return { status: "available", sha256 };
}
