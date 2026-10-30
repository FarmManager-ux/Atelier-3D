import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./session";

describe("isProtectedPath", () => {
  it.each(["/cliente", "/cliente/orcamentos", "/cliente/", "/admin", "/admin/crm"])("protege %s", (p) => {
    expect(isProtectedPath(p)).toBe(true);
  });
  it.each(["/", "/entrar", "/clientes-exemplo", "/administracao", "/api/health"])("não protege %s", (p) => {
    expect(isProtectedPath(p)).toBe(false);
  });
});
