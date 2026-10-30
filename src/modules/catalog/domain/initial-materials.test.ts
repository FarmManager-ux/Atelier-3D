import { describe, expect, it } from "vitest";
import { INITIAL_MATERIALS, SUPPORTED_TECHNOLOGY } from "./initial-materials";

describe("catálogo inicial FDM", () => {
  it("contém exatamente os 11 materiais acordados, sem duplicados", () => {
    expect(INITIAL_MATERIALS.map((m) => m.code)).toEqual(
      ["PLA", "PETG", "ABS", "ASA", "TPU", "PA6", "PA12", "PA12-CF", "PPS-CF", "PEEK", "ULTEM-1010"]);
    expect(new Set(INITIAL_MATERIALS.map((m) => m.code)).size).toBe(INITIAL_MATERIALS.length);
  });
  it("é exclusivamente FDM: nenhuma resina nem referência a SLA", () => {
    expect(SUPPORTED_TECHNOLOGY).toBe("FDM");
    const text = JSON.stringify(INITIAL_MATERIALS).toLowerCase();
    for (const banned of ["resina", "resin", "sla", "dlp", "sls"]) expect(text).not.toContain(banned);
  });
  it("não inclui preços nem parâmetros de produção inventados", () => {
    for (const m of INITIAL_MATERIALS) expect(Object.keys(m).sort().join()).toMatch(/^carbonFiber,code,family,name$|^code,family,name$/);
  });
});
