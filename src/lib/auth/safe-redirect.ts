/**
 * Só permite redirecionamentos para caminhos internos (evita "open redirect").
 * Rejeita URLs absolutos, "//host", barras invertidas e caracteres de controlo.
 */
export function safeRedirectPath(input: string | null | undefined, fallback = "/conta"): string {
  if (!input || typeof input !== "string") return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(input)) return fallback;
  try {
    const url = new URL(input, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
  } catch {
    return fallback;
  }
  return input;
}
