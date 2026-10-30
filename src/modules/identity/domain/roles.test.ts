import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSIONS, isPermission } from "./permissions";
import { ROLES, STAFF_ROLES, roleHas } from "./roles";

describe("catálogo de permissões", () => {
  it("todas as chaves têm o formato módulo.ação e uma descrição em português", () => {
    for (const [key, desc] of Object.entries(PERMISSIONS)) {
      expect(key).toMatch(/^[a-z]+(\.[a-z]+){1,2}$/);
      expect(desc.length).toBeGreaterThan(8);
    }
  });
  it("isPermission distingue chaves válidas e inválidas", () => {
    expect(isPermission("crm.read")).toBe(true);
    expect(isPermission("crm.destroy")).toBe(false);
    expect(isPermission("__proto__")).toBe(false);
  });
});

describe("matriz de funções", () => {
  it("o administrador tem todas as permissões", () => {
    for (const p of ALL_PERMISSIONS) expect(roleHas("admin", p)).toBe(true);
  });
  it("só o administrador gere a equipa e as definições", () => {
    for (const r of STAFF_ROLES.filter((r) => r !== "admin")) {
      expect(roleHas(r, "staff.manage")).toBe(false);
      expect(roleHas(r, "settings.manage")).toBe(false);
      expect(roleHas(r, "automations.manage")).toBe(false);
    }
  });
  it("só o administrador e o financeiro escrevem dados financeiros e de faturação", () => {
    for (const r of STAFF_ROLES) {
      const expected = r === "admin" || r === "finance";
      expect(roleHas(r, "finance.write"), r).toBe(expected);
      expect(roleHas(r, "customers.billing.write"), r).toBe(expected);
    }
  });
  it("produção e modelação não vêem dados de faturação nem financeiros", () => {
    for (const r of ["production", "modeler"] as const) {
      expect(roleHas(r, "customers.billing.read")).toBe(false);
      expect(roleHas(r, "finance.read")).toBe(false);
    }
  });
  it("a equipa comercial não vê o financeiro", () => {
    expect(roleHas("sales", "finance.read")).toBe(false);
    expect(roleHas("sales", "customers.billing.read")).toBe(false);
  });
  it("nenhuma função refere permissões inexistentes e toda a permissão é atribuída a alguém", () => {
    for (const r of STAFF_ROLES) for (const p of ROLES[r].permissions) expect(isPermission(p)).toBe(true);
    for (const p of ALL_PERMISSIONS) expect(STAFF_ROLES.some((r) => roleHas(r, p)), p).toBe(true);
  });
  it("cada permissão de escrita pressupõe a de leitura do mesmo módulo", () => {
    for (const r of STAFF_ROLES) {
      for (const p of ROLES[r].permissions) {
        if (p.endsWith(".write") && !p.includes("billing")) {
          const read = p.replace(/\.write$/, ".read") as typeof p;
          if (read in PERMISSIONS) expect(roleHas(r, read as never), `${r}: ${p} sem ${read}`).toBe(true);
        }
      }
    }
  });
});
