import { DOCUMENT_MAX_BYTES } from "@/lib/validation";

const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp", "heic", "doc", "docx", "xls", "xlsx", "txt"]);

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / 1024))} kB`;
}

/** Valida o ficheiro no browser (a BD e o Storage voltam a validar tamanho e tipo). */
export function validateDocumentFile(f: { name: string; size: number }): string | null {
  const ext = /\.([A-Za-z0-9]+)$/.exec(f.name)?.[1]?.toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) return "formato não suportado (use PDF, imagem, Word, Excel ou texto)";
  if (f.size === 0) return "o ficheiro está vazio";
  if (f.size > DOCUMENT_MAX_BYTES) return `excede ${formatBytes(DOCUMENT_MAX_BYTES)}`;
  return null;
}

export const isImage = (mime: string | null, name: string) => (mime ?? "").startsWith("image/") && !/\.heic$/i.test(name);
