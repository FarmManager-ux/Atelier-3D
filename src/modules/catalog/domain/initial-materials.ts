/**
 * Materiais iniciais do catálogo (apenas FDM). Contêm só identificação, sem preços nem
 * parâmetros de produção: esses valores são definidos pela equipa no painel (Fase 8).
 * O Atelier 3D trabalha exclusivamente com impressão 3D FDM: não existe SLA nem resina.
 */
export const SUPPORTED_TECHNOLOGY = "FDM" as const;

export type MaterialFamily = "standard" | "engineering" | "flexible" | "polyamide" | "high_performance";

export const INITIAL_MATERIALS: readonly { code: string; name: string; family: MaterialFamily; carbonFiber?: boolean }[] = [
  { code: "PLA", name: "PLA", family: "standard" },
  { code: "PETG", name: "PETG", family: "standard" },
  { code: "ABS", name: "ABS", family: "engineering" },
  { code: "ASA", name: "ASA", family: "engineering" },
  { code: "TPU", name: "TPU", family: "flexible" },
  { code: "PA6", name: "PA6", family: "polyamide" },
  { code: "PA12", name: "PA12", family: "polyamide" },
  { code: "PA12-CF", name: "PA12-CF", family: "polyamide", carbonFiber: true },
  { code: "PPS-CF", name: "PPS-CF", family: "high_performance", carbonFiber: true },
  { code: "PEEK", name: "PEEK", family: "high_performance" },
  { code: "ULTEM-1010", name: "Ultem 1010", family: "high_performance" },
];
