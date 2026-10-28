import { describe, expect, it } from "vitest";
import { fieldErrors, loginSchema, registerSchema, resetPasswordSchema } from "./auth";

const valid = {
  fullName: "Ana Silva",
  email: "  ANA@Example.PT ",
  password: "uma-palavra-passe-longa",
  accountType: "individual",
  acceptTerms: "on",
};

describe("registerSchema", () => {
  it("normaliza o email", () => {
    const r = registerSchema.parse(valid);
    expect(r.email).toBe("ana@example.pt");
  });
  it("exige palavra-passe com 12+ caracteres", () => {
    const r = registerSchema.safeParse({ ...valid, password: "curta" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).password).toMatch(/12/);
  });
  it("exige nome de empresa em contas de empresa", () => {
    const r = registerSchema.safeParse({ ...valid, accountType: "company" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).companyName).toBeDefined();
    expect(registerSchema.safeParse({ ...valid, accountType: "company", companyName: "Acme, Lda" }).success).toBe(true);
  });
  it("exige aceitação dos termos", () => {
    const { acceptTerms: _a, ...rest } = valid;
    void _a;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });
  it("rejeita tipos de conta inválidos e emails inválidos", () => {
    expect(registerSchema.safeParse({ ...valid, accountType: "admin" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, email: "nao-e-email" }).success).toBe(false);
  });
});

describe("loginSchema / resetPasswordSchema", () => {
  it("no login não impõe o comprimento (não revela a política)", () => {
    expect(loginSchema.safeParse({ email: "a@b.pt", password: "x" }).success).toBe(true);
  });
  it("na redefinição impõe 12+", () => {
    expect(resetPasswordSchema.safeParse({ password: "123" }).success).toBe(false);
  });
});
