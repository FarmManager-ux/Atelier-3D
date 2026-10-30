import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeRedirectPath("/conta/encomendas?x=1")).toBe("/conta/encomendas?x=1");
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "conta",
    "/ok\nSet-Cookie: a=b",
    "",
    null,
    undefined,
  ])("rejeita %j", (v) => {
    expect(safeRedirectPath(v as string | null | undefined)).toBe("/conta");
  });
  it("usa o fallback indicado", () => {
    expect(safeRedirectPath("//x", "/entrar")).toBe("/entrar");
  });
});
