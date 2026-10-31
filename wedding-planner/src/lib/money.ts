const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const eurCompact = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatEuro = (n: number | null | undefined): string => eur.format(n ?? 0);
export const formatEuroShort = (n: number | null | undefined): string => eurCompact.format(n ?? 0);

/**
 * Converte texto introduzido por humanos em euros: aceita "1250", "1 250,50", "1.250,50", "1250.5", "€ 99".
 * Devolve null se não for um valor válido.
 */
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) / 100 : null;
  let s = input.replace(/[€\s ]/g, "");
  if (!s) return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // O último separador é o decimal; o outro é de milhares.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
