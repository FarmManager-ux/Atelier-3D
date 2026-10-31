/** Converte erros do Supabase/PostgREST em mensagens seguras e compreensíveis (pt-PT). */
type Err = { code?: string; message?: string; details?: string | null; status?: number } | null | undefined;

// Códigos próprios das nossas funções SQL: as mensagens já estão em português e são seguras.
const OWN_CODES = new Set(["WP001", "WP002", "22023"]);

export function friendlyError(error: Err | unknown): string {
  const e = (error ?? {}) as NonNullable<Err>;
  const msg = e.message ?? "";
  if (e.code && OWN_CODES.has(e.code)) return msg;
  switch (e.code) {
    case "42501": return "Não tem permissão para fazer esta alteração.";
    case "23505": return "Já existe um registo com estes dados.";
    case "23503": return /violates foreign key constraint.*(expenses|guests|documents|calendar)/i.test(msg) || /still referenced/i.test(`${msg} ${e.details ?? ""}`)
      ? "Não é possível apagar: existem registos associados a este item." : "Os dados indicados não são válidos.";
    case "23514": case "P0001": {
      const technical = /violates|constraint|relation|column|new row/i.test(msg);
      return technical || !msg ? "Os dados indicados não são válidos. Verifique os campos." : msg;
    }
    case "22P02": return "Os dados indicados não são válidos.";
    case "PGRST301": case "401": return "A sessão expirou. Volte a iniciar sessão.";
  }
  if (e.status === 401) return "A sessão expirou. Volte a iniciar sessão.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Sem ligação à internet. Tente novamente.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

export class AppError extends Error {}

/** Lança AppError com mensagem amigável se o resultado do Supabase tiver erro. */
export function unwrap<T>(res: { data: T | null; error: Err | unknown }): T {
  if (res.error) throw new AppError(friendlyError(res.error));
  return res.data as T;
}
