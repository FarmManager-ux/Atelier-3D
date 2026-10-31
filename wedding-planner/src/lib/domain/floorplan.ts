import type { TableRow, TableShape } from "../db-types";

export const WORLD = { width: 4000, height: 3000 } as const;
export const GRID = 10;
export const ZOOM = { min: 0.25, max: 2.5 } as const;

export const snap = (n: number, grid = GRID) => Math.round(n / grid) * grid;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Tamanho por omissão de uma mesa conforme o formato e a capacidade. */
export function defaultSize(shape: TableShape, capacity: number): { width: number; height: number } {
  const base = clamp(80 + capacity * 6, 100, 200);
  if (shape === "retangular") return { width: clamp(base + capacity * 8, 140, 360), height: clamp(base * 0.6, 70, 140) };
  return { width: base, height: base };
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, gap = 30) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

/** Primeira posição livre (em grelha) para uma nova mesa, sem sobrepor as existentes. */
export function nextPosition(tables: Pick<TableRow, "x" | "y" | "width" | "height">[], width: number, height: number): { x: number; y: number } {
  const stepX = 240, stepY = 240, startX = 80, startY = 80, cols = 12;
  for (let i = 0; i < 400; i++) {
    const cand = { x: startX + (i % cols) * stepX, y: startY + Math.floor(i / cols) * stepY, width, height };
    if (!tables.some((t) => overlaps(cand, t))) return { x: cand.x, y: cand.y };
  }
  return { x: startX, y: startY };
}

export interface ViewState { x: number; y: number; k: number }

/** Vista (translação e zoom) que enquadra todas as mesas no ecrã. */
export function fitView(tables: Pick<TableRow, "x" | "y" | "width" | "height">[], vw: number, vh: number, pad = 48): ViewState {
  if (!tables.length || vw <= 0 || vh <= 0) return { x: 24, y: 24, k: 1 };
  const minX = Math.min(...tables.map((t) => t.x)), minY = Math.min(...tables.map((t) => t.y));
  const maxX = Math.max(...tables.map((t) => t.x + t.width)), maxY = Math.max(...tables.map((t) => t.y + t.height));
  const k = clamp(Math.min((vw - pad * 2) / (maxX - minX), (vh - pad * 2) / (maxY - minY)), ZOOM.min, 1.2);
  return { k, x: (vw - (maxX - minX) * k) / 2 - minX * k, y: (vh - (maxY - minY) * k) / 2 - minY * k };
}

/** Zoom mantendo fixo o ponto (px, py) do ecrã. */
export function zoomAt(v: ViewState, factor: number, px: number, py: number): ViewState {
  const k = clamp(v.k * factor, ZOOM.min, ZOOM.max);
  const r = k / v.k;
  return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
}

/** Centra a vista numa mesa. */
export function centerOn(t: Pick<TableRow, "x" | "y" | "width" | "height">, v: ViewState, vw: number, vh: number): ViewState {
  const k = clamp(v.k < 0.7 ? 0.9 : v.k, ZOOM.min, ZOOM.max);
  return { k, x: vw / 2 - (t.x + t.width / 2) * k, y: vh / 2 - (t.y + t.height / 2) * k };
}

/** Nome da próxima mesa ("Mesa 1", "Mesa 2"...) sem repetir nomes existentes. */
export function nextTableNames(existing: string[], count: number, prefix = "Mesa"): string[] {
  const used = new Set(existing.map((n) => n.trim().toLowerCase()));
  const out: string[] = [];
  for (let n = 1; out.length < count && n < 10_000; n++) {
    const name = `${prefix} ${n}`;
    if (!used.has(name.toLowerCase())) out.push(name);
  }
  return out;
}
