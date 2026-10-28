import { afterAll, beforeAll, expect, it } from "vitest";
import type pg from "pg";
import { FILE_TYPE_RULES } from "../../src/lib/files/rules";
import { createTestDatabase } from "./helpers";

let pool: pg.Pool;
let drop: () => Promise<void>;
beforeAll(async () => { ({ pool, drop } = await createTestDatabase()); });
afterAll(async () => { await drop?.(); });

it("as regras de formatos/limites em TypeScript coincidem com a base de dados", async () => {
  const { rows } = await pool.query(`select extension, kind, max_bytes::bigint from public.file_type_rules order by 1`);
  const db = Object.fromEntries(rows.map((r) => [r.extension, { kind: r.kind, maxBytes: Number(r.max_bytes) }]));
  expect(FILE_TYPE_RULES).toEqual(db);
});
