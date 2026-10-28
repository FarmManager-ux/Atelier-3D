import { describe, expect, it } from "vitest";
import { sniffFile } from "./sniff";

const bytes = (...n: number[]) => Uint8Array.from(n);
const text = (s: string) => new TextEncoder().encode(s);

function binaryStl(triangles: number) {
  const b = new Uint8Array(84 + triangles * 50);
  new DataView(b.buffer).setUint32(80, triangles, true);
  return b;
}

describe("sniffFile", () => {
  it("PNG / JPEG / WebP / 3MF", () => {
    expect(sniffFile("png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0), 9).ok).toBe(true);
    expect(sniffFile("jpg", bytes(0xff, 0xd8, 0xff, 0xe0), 4).ok).toBe(true);
    expect(sniffFile("webp", Uint8Array.from([...text("RIFF"), 0, 0, 0, 0, ...text("WEBP")]), 12).ok).toBe(true);
    expect(sniffFile("3mf", bytes(0x50, 0x4b, 0x03, 0x04), 4).ok).toBe(true);
  });
  it("rejeita executáveis disfarçados de imagem ou modelo", () => {
    const mz = text("MZ\x90\x00 programa");
    for (const ext of ["png", "jpg", "webp", "3mf", "stl", "step", "obj"]) {
      expect(sniffFile(ext, mz, 5000).ok, ext).toBe(false);
    }
  });
  it("STL binário (tamanho consistente) e ASCII", () => {
    const bin = binaryStl(3);
    expect(sniffFile("stl", bin, bin.length).ok).toBe(true);
    expect(sniffFile("stl", bin, bin.length + 1).ok).toBe(false);
    expect(sniffFile("stl", text("solid peca\nfacet normal 0 0 1\n"), 2000).ok).toBe(true);
    expect(sniffFile("stl", Uint8Array.from([...text("solid x"), 0, 1, 2]), 2000).ok).toBe(false);
  });
  it("STEP", () => {
    expect(sniffFile("step", text("ISO-10303-21;\nHEADER;"), 100).ok).toBe(true);
    expect(sniffFile("stp", text("\n  ISO-10303-21;"), 100).ok).toBe(true);
    expect(sniffFile("step", text("hello"), 100).ok).toBe(false);
  });
  it("OBJ", () => {
    expect(sniffFile("obj", text("# comentário\nv 0 0 0\nv 1 0 0\nf 1 2 3\n"), 100).ok).toBe(true);
    expect(sniffFile("obj", Uint8Array.from([0, 1, 2, 3]), 4).ok).toBe(false);
    expect(sniffFile("obj", text("isto não é um modelo"), 20).ok).toBe(false);
  });
  it("extensão desconhecida", () => {
    expect(sniffFile("exe", text("MZ"), 2).ok).toBe(false);
  });
});
