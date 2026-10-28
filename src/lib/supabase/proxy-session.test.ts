import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./proxy-session";

describe("isProtectedPath", () => {
  it.each(["/conta", "/conta/encomendas", "/conta/", "/perfil", "/convite/abc"])("protege %s", (p) => {
    expect(isProtectedPath(p)).toBe(true);
  });
  it.each(["/", "/entrar", "/contabilidade", "/api/health"])("não protege %s", (p) => {
    expect(isProtectedPath(p)).toBe(false);
  });
});
