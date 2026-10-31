import type { Guest, GuestSeating, TableRow, TableSeat } from "../db-types";

export interface SeatedGuest { guest: Guest; seatNumbers: number[]; people: number }
export interface TableState {
  table: TableRow;
  guests: SeatedGuest[];
  used: number;
  free: number;
  full: boolean;
  over: boolean;
}

export interface SeatingView {
  tables: TableState[];
  byId: Map<string, TableState>;
  unseated: Guest[];                 // convidados que precisam de lugar e ainda não têm mesa
  tableOfGuest: Map<string, string>; // guest_id → table_id
}

/** Junta mesas, convidados e lugares guardados na base de dados num único modelo para a interface. */
export function buildSeatingView(tables: TableRow[], guests: Guest[], seatings: GuestSeating[], seats: TableSeat[]): SeatingView {
  const seatNumber = new Map(seats.map((s) => [s.id, s.seat_number]));
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const perTable = new Map<string, Map<string, number[]>>();
  const tableOfGuest = new Map<string, string>();
  for (const s of seatings) {
    const g = perTable.get(s.table_id) ?? new Map<string, number[]>();
    const arr = g.get(s.guest_id) ?? [];
    arr.push(seatNumber.get(s.seat_id) ?? 0);
    g.set(s.guest_id, arr);
    perTable.set(s.table_id, g);
    tableOfGuest.set(s.guest_id, s.table_id);
  }
  const states: TableState[] = tables.map((table) => {
    const entries = [...(perTable.get(table.id)?.entries() ?? [])];
    const list: SeatedGuest[] = entries
      .map(([gid, nums]) => ({ guest: guestById.get(gid)!, seatNumbers: nums.sort((a, b) => a - b), people: nums.length }))
      .filter((x) => x.guest)
      .sort((a, b) => (a.seatNumbers[0] ?? 0) - (b.seatNumbers[0] ?? 0));
    const used = list.reduce((a, x) => a + x.people, 0);
    return { table, guests: list, used, free: Math.max(0, table.capacity - used), full: used >= table.capacity, over: used > table.capacity };
  });
  const unseated = guests
    .filter((g) => g.expected_count > 0 && !tableOfGuest.has(g.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt"));
  return { tables: states, byId: new Map(states.map((s) => [s.table.id, s])), unseated, tableOfGuest };
}

/** Cabe o convidado (todas as pessoas esperadas) nesta mesa? Se já lá está, conta como cabe. */
export function canFit(state: TableState, guest: Guest, alreadyAtTable = false): boolean {
  return alreadyAtTable ? true : state.free >= guest.expected_count;
}

export function missingSeats(state: TableState, guest: Guest): number {
  return Math.max(0, guest.expected_count - state.free);
}

/** Etiqueta curta de lugares: "1–3" ou "1, 4". */
export function seatLabel(nums: number[]): string {
  if (nums.length === 0) return "—";
  const sorted = [...nums].sort((a, b) => a - b);
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
  return consecutive && sorted.length > 1 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(", ");
}

/** Posição (em %) dos lugares à volta da mesa, para os desenhar na planta. */
export function seatPositions(shape: TableRow["shape"], capacity: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (shape === "redonda") {
    for (let i = 0; i < capacity; i++) {
      const a = (2 * Math.PI * i) / capacity - Math.PI / 2;
      out.push({ x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) });
    }
    return out;
  }
  // Retangular/quadrada: distribui pelo perímetro (cima, direita, baixo, esquerda).
  const perSide = shape === "quadrada" ? [0, 1, 2, 3].map((i) => Math.floor(capacity / 4) + (i < capacity % 4 ? 1 : 0))
    : (() => { const long = Math.ceil(capacity / 2); const short = 0; const top = Math.ceil(long), bottom = capacity - top; return [top, short, bottom, short]; })();
  const [top, right, bottom, left] = perSide as [number, number, number, number];
  const line = (n: number, f: (t: number) => { x: number; y: number }) => { for (let i = 0; i < n; i++) out.push(f((i + 1) / (n + 1))); };
  line(top, (t) => ({ x: 100 * t, y: 0 }));
  line(right, (t) => ({ x: 100, y: 100 * t }));
  line(bottom, (t) => ({ x: 100 * (1 - t), y: 100 }));
  line(left, (t) => ({ x: 0, y: 100 * (1 - t) }));
  return out;
}
