/**
 * Formatos e limites de ficheiros. Espelho de public.file_type_rules na BD
 * (a BD é a fonte de verdade; o teste tests/db/rules-parity.test.ts garante a paridade).
 */
export type FileKind = "model_3d" | "image";

const MB = 1024 * 1024;

export const FILE_TYPE_RULES: Record<string, { kind: FileKind; maxBytes: number }> = {
  stl: { kind: "model_3d", maxBytes: 100 * MB },
  "3mf": { kind: "model_3d", maxBytes: 100 * MB },
  step: { kind: "model_3d", maxBytes: 100 * MB },
  stp: { kind: "model_3d", maxBytes: 100 * MB },
  obj: { kind: "model_3d", maxBytes: 100 * MB },
  png: { kind: "image", maxBytes: 15 * MB },
  jpg: { kind: "image", maxBytes: 15 * MB },
  jpeg: { kind: "image", maxBytes: 15 * MB },
  webp: { kind: "image", maxBytes: 15 * MB },
};

export const ACCEPT_ATTRIBUTE = Object.keys(FILE_TYPE_RULES).map((e) => `.${e}`).join(",");

export function extensionOf(filename: string): string | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(filename);
  return m ? m[1]!.toLowerCase() : null;
}

/** Remove caminhos, caracteres de controlo e limita o comprimento (mantém a extensão). */
export function sanitizeFilename(input: string): string {
  const base = input.normalize("NFC").split(/[\\/]/).pop() ?? "";
  let name = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  name = name.replace(/^\.+/, "");
  if (name.length > 255) {
    const ext = extensionOf(name);
    const suffix = ext ? `.${ext}` : "";
    name = name.slice(0, 255 - suffix.length) + suffix;
  }
  return name;
}

export type FileCheck =
  | { ok: true; extension: string; kind: FileKind }
  | { ok: false; error: "no_extension" | "unsupported_format" | "empty" | "too_large"; maxBytes?: number };

export function checkFile(filename: string, size: number): FileCheck {
  const extension = extensionOf(filename);
  if (!extension) return { ok: false, error: "no_extension" };
  const rule = FILE_TYPE_RULES[extension];
  if (!rule) return { ok: false, error: "unsupported_format" };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "empty" };
  if (size > rule.maxBytes) return { ok: false, error: "too_large", maxBytes: rule.maxBytes };
  return { ok: true, extension, kind: rule.kind };
}
