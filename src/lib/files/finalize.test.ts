import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { finalizeUpload, type FinalizeDeps, type PendingVersion } from "./finalize";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const text = (s: string) => new TextEncoder().encode(s);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

async function* chunks(b: Uint8Array, size = 5) {
  for (let i = 0; i < b.length; i += size) yield b.subarray(i, i + size);
}

function setup(content: Uint8Array | null, over: Partial<PendingVersion> = {}) {
  const state = { removed: [] as string[], rejected: [] as string[], completed: [] as unknown[] };
  const version: PendingVersion = {
    id: "v1", storagePath: "a/f/v1", extension: "png", sizeBytes: content?.length ?? 0, declaredSha256: content ? sha(content) : "0".repeat(64), ...over,
  };
  const deps: FinalizeDeps = {
    getPending: async (id) => (id === "v1" ? version : null),
    openObject: async () => (content ? chunks(content) : null),
    removeObject: async (p) => void state.removed.push(p),
    complete: async (...a) => (state.completed.push(a), "available"),
    reject: async (_id, r) => void state.rejected.push(r),
  };
  return { deps, state };
}

describe("finalizeUpload", () => {
  it("ficheiro correto → disponível com o hash verificado", async () => {
    const { deps, state } = setup(PNG);
    const r = await finalizeUpload(deps, "v1");
    expect(r).toEqual({ status: "available", sha256: sha(PNG) });
    expect(state.completed).toEqual([["v1", PNG.length, sha(PNG)]]);
    expect(state.removed).toEqual([]);
  });
  it("versão inexistente ou já concluída → not_found", async () => {
    expect((await finalizeUpload(setup(PNG).deps, "outra")).status).toBe("not_found");
  });
  it("objeto em falta → rejeitado", async () => {
    const { deps, state } = setup(null, { sizeBytes: 10 });
    const r = await finalizeUpload(deps, "v1");
    expect(r.status).toBe("rejected");
    expect(state.rejected).toHaveLength(1);
  });
  it("conteúdo não corresponde à extensão → rejeitado e objeto removido", async () => {
    const exe = text("MZ\x90\x00 isto é um executável");
    const { deps, state } = setup(exe);
    const r = await finalizeUpload(deps, "v1");
    expect(r).toMatchObject({ status: "rejected", reason: expect.stringMatching(/PNG/) });
    expect(state.removed).toEqual(["a/f/v1"]);
    expect(state.completed).toHaveLength(0);
  });
  it("tamanho real menor ou maior que o declarado → rejeitado", async () => {
    for (const declared of [PNG.length + 5, PNG.length - 3]) {
      const { deps, state } = setup(PNG, { sizeBytes: declared });
      expect((await finalizeUpload(deps, "v1")).status).toBe("rejected");
      expect(state.removed).toEqual(["a/f/v1"]);
    }
  });
  it("hash declarado diferente → rejeitado", async () => {
    const { deps, state } = setup(PNG, { declaredSha256: "f".repeat(64) });
    const r = await finalizeUpload(deps, "v1");
    expect(r).toMatchObject({ status: "rejected", reason: expect.stringMatching(/SHA-256/) });
    expect(state.completed).toHaveLength(0);
  });
  it("se a BD rejeitar na conclusão, remove o objeto", async () => {
    const { deps, state } = setup(PNG);
    deps.complete = async () => "rejected";
    expect((await finalizeUpload(deps, "v1")).status).toBe("rejected");
    expect(state.removed).toEqual(["a/f/v1"]);
  });
});
