import { describe, expect, it } from "vitest";
import { centerOn, clamp, defaultSize, fitView, nextPosition, nextTableNames, snap, zoomAt, ZOOM } from "./floorplan";

const T = (x: number, y: number, w = 120, h = 120) => ({ x, y, width: w, height: h });

describe("planta: geometria", () => {
  it("encaixa na grelha e limita valores", () => {
    expect(snap(14)).toBe(10); expect(snap(15)).toBe(20); expect(snap(-4)).toBe(-0);
    expect(clamp(5, 1, 3)).toBe(3);
  });
  it("tamanho por omissão: redondas e quadradas são quadradas; retangulares são mais compridas", () => {
    const r = defaultSize("redonda", 8), q = defaultSize("quadrada", 4), rect = defaultSize("retangular", 12);
    expect(r.width).toBe(r.height); expect(q.width).toBe(q.height);
    expect(rect.width).toBeGreaterThan(rect.height);
    expect(defaultSize("redonda", 40).width).toBeLessThanOrEqual(200);
  });
  it("a próxima posição livre nunca sobrepõe mesas existentes", () => {
    const tables = [T(80, 80), T(320, 80), T(560, 80)];
    const p = nextPosition(tables, 120, 120);
    expect(tables.every((t) => !(p.x < t.x + t.width && p.x + 120 > t.x && p.y < t.y + t.height && p.y + 120 > t.y))).toBe(true);
    expect(nextPosition([], 120, 120)).toEqual({ x: 80, y: 80 });
    expect(nextPosition([T(80, 80)], 120, 120)).toEqual({ x: 320, y: 80 });
  });
  it("muitas mesas continuam a ter posições distintas", () => {
    const tables: ReturnType<typeof T>[] = [];
    for (let i = 0; i < 60; i++) { const p = nextPosition(tables, 160, 160); tables.push(T(p.x, p.y, 160, 160)); }
    expect(new Set(tables.map((t) => `${t.x},${t.y}`)).size).toBe(60);
  });
  it("ajusta a vista para mostrar todas as mesas", () => {
    const v = fitView([T(100, 100), T(900, 700)], 800, 600);
    expect(v.k).toBeGreaterThanOrEqual(ZOOM.min); expect(v.k).toBeLessThanOrEqual(1.2);
    for (const t of [T(100, 100), T(900, 700)]) {
      expect(t.x * v.k + v.x).toBeGreaterThanOrEqual(0); expect((t.x + t.width) * v.k + v.x).toBeLessThanOrEqual(800);
      expect(t.y * v.k + v.y).toBeGreaterThanOrEqual(0); expect((t.y + t.height) * v.k + v.y).toBeLessThanOrEqual(600);
    }
    expect(fitView([], 800, 600)).toEqual({ x: 24, y: 24, k: 1 });
  });
  it("o zoom mantém fixo o ponto sob o cursor e respeita os limites", () => {
    const v = { x: 50, y: 30, k: 1 };
    const z = zoomAt(v, 2, 200, 100);
    expect((200 - v.x) / v.k).toBeCloseTo((200 - z.x) / z.k);   // mesmo ponto do mundo sob o cursor
    expect((100 - v.y) / v.k).toBeCloseTo((100 - z.y) / z.k);
    expect(zoomAt({ x: 0, y: 0, k: 2.4 }, 5, 0, 0).k).toBe(ZOOM.max);
    expect(zoomAt({ x: 0, y: 0, k: 0.3 }, 0.1, 0, 0).k).toBe(ZOOM.min);
  });
  it("centra a vista numa mesa", () => {
    const t = T(1000, 800, 100, 100);
    const v = centerOn(t, { x: 0, y: 0, k: 0.4 }, 800, 600);
    expect((t.x + 50) * v.k + v.x).toBeCloseTo(400); expect((t.y + 50) * v.k + v.y).toBeCloseTo(300);
  });
  it("nomes de mesas sequenciais sem repetir existentes", () => {
    expect(nextTableNames([], 3)).toEqual(["Mesa 1", "Mesa 2", "Mesa 3"]);
    expect(nextTableNames(["mesa 1", "Mesa 3"], 3)).toEqual(["Mesa 2", "Mesa 4", "Mesa 5"]);
  });
});
