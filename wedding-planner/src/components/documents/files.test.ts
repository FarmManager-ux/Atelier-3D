import { describe, expect, it } from "vitest";
import { formatBytes, isImage, validateDocumentFile } from "./files";

describe("validação de documentos", () => {
  it("aceita formatos permitidos até 25 MB", () => {
    expect(validateDocumentFile({ name: "contrato.PDF", size: 1000 })).toBeNull();
    expect(validateDocumentFile({ name: "foto.heic", size: 5_000_000 })).toBeNull();
    expect(validateDocumentFile({ name: "x.docx", size: 25 * 1024 * 1024 })).toBeNull();
  });
  it("recusa executáveis, ficheiros sem extensão, vazios e demasiado grandes", () => {
    expect(validateDocumentFile({ name: "virus.exe", size: 10 })).toMatch(/formato/);
    expect(validateDocumentFile({ name: "script.js", size: 10 })).toMatch(/formato/);
    expect(validateDocumentFile({ name: "semextensao", size: 10 })).toMatch(/formato/);
    expect(validateDocumentFile({ name: "a.pdf", size: 0 })).toMatch(/vazio/);
    expect(validateDocumentFile({ name: "a.pdf", size: 25 * 1024 * 1024 + 1 })).toMatch(/excede/);
  });
  it("formata tamanhos e deteta imagens com pré-visualização", () => {
    expect(formatBytes(500)).toBe("1 kB");
    expect(formatBytes(1536 * 1024)).toBe("1,5 MB");
    expect(isImage("image/png", "a.png")).toBe(true);
    expect(isImage("image/heic", "a.heic")).toBe(false);
    expect(isImage("application/pdf", "a.pdf")).toBe(false);
  });
});
