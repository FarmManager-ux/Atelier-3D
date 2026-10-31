import { z } from "zod";
import type { Wedding } from "./db-types";

/** Preferências da aplicação (guardadas em weddings.preferences, partilhadas pelos dois noivos). */
export const preferencesSchema = z.object({
  followUpDays: z.number().int().min(1).max(60).default(7),         // dias sem resposta até voltar a contactar um convidado
  defaultCapacity: z.number().int().min(1).max(40).default(8),       // capacidade por omissão ao criar mesas
});
export type Preferences = z.infer<typeof preferencesSchema>;

export function readPreferences(w: Pick<Wedding, "preferences">): Preferences {
  const parsed = preferencesSchema.safeParse(w.preferences ?? {});
  return parsed.success ? parsed.data : preferencesSchema.parse({});
}
