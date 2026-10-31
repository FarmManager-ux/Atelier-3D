import type pg from "pg";
import { asUser, createTestDatabase, createUser } from "./helpers";

export type Pool = pg.Pool;
export { asUser, createTestDatabase, createUser };

export type Q = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;

/** Executa SQL como utilizador autenticado e confirma (commit). */
export const run = async (pool: Pool, uid: string, sql: string, params: unknown[] = []) =>
  (await asUser(pool, uid, (q) => q(sql, params), { commit: true })).rows;

export type World = {
  pool: Pool;
  drop: () => Promise<void>;
  paulo: string; ines: string; outsider: string; other: string;
  wedding: string; otherWedding: string;
};

/** Cria os 2 noivos (mesmo casamento) e um casal estranho (outro casamento), tudo via RPC reais. */
export async function createWorld(): Promise<World> {
  const { pool, drop } = await createTestDatabase();
  const paulo = await createUser(pool, "paulo@example.test", "Paulo");
  const ines = await createUser(pool, "ines@example.test", "Inês");
  const other = await createUser(pool, "outro@example.test", "Outro");
  const outsider = await createUser(pool, "estranho@example.test", "Estranho");
  const wedding = (await run(pool, paulo, `select public.create_wedding() id`))[0].id as string;
  await run(pool, paulo, `insert into public.wedding_invitations (wedding_id, email, invited_by) values ($1,'ines@example.test',$2)`, [wedding, paulo]);
  await run(pool, ines, `select public.accept_wedding_invitation()`);
  const otherWedding = (await run(pool, other, `select public.create_wedding('Casamento Alheio','Rui','Ana','2028-05-05') id`))[0].id as string;
  return { pool, drop, paulo, ines, outsider, other, wedding, otherWedding };
}

export const addGuest = async (w: World, uid: string, fields: Record<string, unknown> & { full_name: string }, wedding = w.wedding) => {
  const cols = ["wedding_id", ...Object.keys(fields)];
  const vals = [wedding, ...Object.values(fields)];
  const rows = await run(w.pool, uid, `insert into public.guests (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`, vals);
  return rows[0].id as string;
};

export const addTable = async (w: World, uid: string, name: string, capacity: number, wedding = w.wedding) =>
  (await run(w.pool, uid, `insert into public.tables (wedding_id, name, capacity) values ($1,$2,$3) returning id`, [wedding, name, capacity]))[0].id as string;

export const seatsOf = async (pool: Pool, guest: string) =>
  (await pool.query(`select ts.seat_number, gs.person_index from public.guest_seatings gs join public.table_seats ts on ts.id=gs.seat_id where gs.guest_id=$1 order by gs.person_index`, [guest])).rows;
