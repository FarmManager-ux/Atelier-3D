import { describe, expect, it } from "vitest";
import { checkFile, extensionOf, sanitizeFilename } from "./rules";

describe("checkFile", () => {
  it("aceita formatos suportados dentro do limite", () => {
    expect(checkFile("peca.STL", 1000)).toEqual({ ok: true, extension: "stl", kind: "model_3d" });
    expect(checkFile("foto.jpeg", 1000)).toMatchObject({ ok: true, kind: "image" });
  });
  it("rejeita formatos, ficheiros vazios e demasiado grandes", () => {
    expect(checkFile("a.exe", 10)).toMatchObject({ ok: false, error: "unsupported_format" });
    expect(checkFile("a.pdf", 10)).toMatchObject({ ok: false, error: "unsupported_format" });
    expect(checkFile("semextensao", 10)).toMatchObject({ ok: false, error: "no_extension" });
    expect(checkFile("a.stl", 0)).toMatchObject({ ok: false, error: "empty" });
    expect(checkFile("a.stl", 100 * 1024 * 1024 + 1)).toMatchObject({ ok: false, error: "too_large" });
    expect(checkFile("a.png", 15 * 1024 * 1024 + 1)).toMatchObject({ ok: false, error: "too_large" });
  });
  it("extensão dupla usa a última", () => {
    expect(extensionOf("a.stl.exe")).toBe("exe");
    expect(checkFile("a.stl.exe", 5)).toMatchObject({ ok: false });
  });
});

describe("sanitizeFilename", () => {
  it.each([
    ["../../etc/passwd.stl", "passwd.stl"],
    ["C:\\temp\\peça.stl", "peça.stl"],
    ["  ..oculto.stl", "oculto.stl"],
    ["a\u0000b\nc.stl", "abc.stl"],
  ])("%j → %j", (i, o) => expect(sanitizeFilename(i)).toBe(o));
  it("limita a 255 caracteres preservando a extensão", () => {
    const out = sanitizeFilename("x".repeat(400) + ".stl");
    expect(out.length).toBe(255);
    expect(out.endsWith(".stl")).toBe(true);
  });
});
