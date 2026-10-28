import { describe, expect, it } from "vitest";
import { friendlyDbError } from "./db-errors";

describe("friendlyDbError", () => {
  it("não expõe detalhes técnicos", () => {
    const e = { code: "23514", message: 'new row for relation "account_fiscal_data" violates check constraint "account_fiscal_nif_valid"' };
    const out = friendlyDbError(e);
    expect(out).not.toMatch(/relation|constraint|account_fiscal/);
  });
  it("deixa passar mensagens de negócio em pt-PT", () => {
    expect(friendlyDbError({ code: "23514", message: "Formato de ficheiro não suportado: .exe" })).toBe("Formato de ficheiro não suportado: .exe");
  });
  it("mapeia permissões e conflitos", () => {
    expect(friendlyDbError({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/permissão/);
    expect(friendlyDbError({ code: "23505" })).toMatch(/Já existe/);
    expect(friendlyDbError({ code: "XX000", message: "internal" })).toMatch(/Não foi possível/);
    expect(friendlyDbError(null)).toMatch(/Não foi possível/);
  });
});
