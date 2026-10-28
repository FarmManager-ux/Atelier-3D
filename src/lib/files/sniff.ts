/**
 * Verificação do conteúdo real do ficheiro (não confia na extensão nem no MIME do browser).
 * Valida apenas a assinatura/estrutura mínima; NÃO substitui análise antivírus (Fase 7).
 */
export type SniffResult = { ok: true } | { ok: false; reason: string };

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);

const ascii = (b: Uint8Array, from = 0, to = b.length) =>
  new TextDecoder("latin1").decode(b.subarray(from, Math.min(to, b.length)));

const hasNul = (b: Uint8Array) => b.includes(0);

export function sniffFile(extension: string, head: Uint8Array, totalSize: number): SniffResult {
  const bad = (reason: string): SniffResult => ({ ok: false, reason });
  switch (extension) {
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? { ok: true } : bad("Não é um PNG válido");
    case "jpg":
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]) ? { ok: true } : bad("Não é um JPEG válido");
    case "webp":
      return startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)
        ? { ok: true }
        : bad("Não é um WebP válido");
    case "3mf":
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]) ? { ok: true } : bad("Não é um 3MF válido");
    case "step":
    case "stp":
      return /^\uFEFF?\s*ISO-10303-21/.test(ascii(head, 0, 64)) ? { ok: true } : bad("Não é um STEP válido");
    case "stl": {
      // STL binário: 80 bytes de cabeçalho + uint32 triângulos + 50 bytes/triângulo.
      if (head.length >= 84 && totalSize >= 84) {
        const triangles = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(80, true);
        if (84 + triangles * 50 === totalSize) return { ok: true };
      }
      // STL ASCII.
      if (/^\s*solid/i.test(ascii(head, 0, 16)) && !hasNul(head.subarray(0, 1024))) return { ok: true };
      return bad("Não é um STL válido");
    }
    case "obj": {
      const text = ascii(head, 0, 4096);
      if (hasNul(head.subarray(0, 4096))) return bad("Não é um OBJ válido");
      return /^\s*(v|vt|vn|vp|f|o|g|s|l|p|mtllib|usemtl)\s/m.test(text) ? { ok: true } : bad("Não é um OBJ válido");
    }
    default:
      return bad("Formato não suportado");
  }
}
