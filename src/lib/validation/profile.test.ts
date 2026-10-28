import { describe, expect, it } from "vitest";
import { fieldErrors } from "./auth";
import { accountDetailsSchema, addressSchema, contactSchema, fiscalSchema, inviteSchema, prepareUploadSchema } from "./profile";

describe("fiscalSchema", () => {
  it("valida o dígito de controlo do NIF português", () => {
    expect(fiscalSchema.safeParse({ nif: "123 456 789" }).success).toBe(true);
    const bad = fiscalSchema.safeParse({ nif: "123456788", country: "PT" });
    expect(bad.success).toBe(false);
    expect(fieldErrors(bad.error!).nif).toMatch(/NIF/);
  });
  it("aceita identificador estrangeiro simples e vazio", () => {
    expect(fiscalSchema.safeParse({ nif: "DE123456789", country: "de" }).data?.country).toBe("DE");
    expect(fiscalSchema.safeParse({ nif: "" }).success).toBe(true);
    expect(fiscalSchema.safeParse({ nif: "ab", country: "ES" }).success).toBe(false);
  });
});

describe("addressSchema", () => {
  const base = { kind: "shipping", recipientName: "Ana", line1: "Rua A 1", postalCode: "4000-001", city: "Porto", country: "PT" };
  it("exige código postal PT no formato 0000-000", () => {
    expect(addressSchema.safeParse(base).success).toBe(true);
    expect(fieldErrors(addressSchema.safeParse({ ...base, postalCode: "4000" }).error!).postalCode).toMatch(/0000-000/);
    expect(addressSchema.safeParse({ ...base, country: "FR", postalCode: "75001" }).success).toBe(true);
  });
  it("converte a caixa de predefinida", () => {
    expect(addressSchema.parse({ ...base, isDefault: "on" }).isDefault).toBe(true);
    expect(addressSchema.parse(base).isDefault).toBe(false);
  });
});

describe("contactSchema / accountDetailsSchema / inviteSchema", () => {
  it("contacto exige email ou telefone", () => {
    expect(contactSchema.safeParse({ name: "X" }).success).toBe(false);
    expect(contactSchema.safeParse({ name: "X", phone: "910000000" }).success).toBe(true);
    expect(contactSchema.safeParse({ name: "X", email: "x@acme.example" }).success).toBe(true);
    expect(contactSchema.safeParse({ name: "X", email: "inválido" }).success).toBe(false);
  });
  it("site só http/https", () => {
    expect(accountDetailsSchema.safeParse({ displayName: "A", website: "https://a.pt" }).success).toBe(true);
    expect(accountDetailsSchema.safeParse({ displayName: "A", website: "javascript:alert(1)" }).success).toBe(false);
    expect(accountDetailsSchema.parse({ displayName: "A", website: "" }).website).toBeUndefined();
  });
  it("convite só admin/member (nunca owner)", () => {
    expect(inviteSchema.safeParse({ email: "a@b.pt", role: "owner" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "A@B.pt", role: "member" }).data?.email).toBe("a@b.pt");
  });
});

describe("prepareUploadSchema", () => {
  const ok = { accountId: crypto.randomUUID(), projectId: null, fileId: null, displayName: "Suporte", filename: "a.stl", size: 10, sha256: "a".repeat(64) };
  it("valida o payload", () => {
    expect(prepareUploadSchema.safeParse(ok).success).toBe(true);
    expect(prepareUploadSchema.safeParse({ ...ok, sha256: "xx" }).success).toBe(false);
    expect(prepareUploadSchema.safeParse({ ...ok, accountId: "1" }).success).toBe(false);
    expect(prepareUploadSchema.safeParse({ ...ok, size: -1 }).success).toBe(false);
  });
});
