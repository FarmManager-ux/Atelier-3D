import { messages } from "@/lib/i18n/pt-PT";

type PgLikeError = { code?: string; message?: string } | null | undefined;

/**
 * Converte erros do Postgres/Supabase em mensagens seguras para o utilizador.
 * Mensagens de regras de negócio (escritas em pt-PT nas funções SQL) passam;
 * erros técnicos (constraints, RLS, nomes de tabelas) nunca são expostos.
 */
export function friendlyDbError(error: PgLikeError): string {
  const t = messages.db;
  const msg = error?.message ?? "";
  switch (error?.code) {
    case "42501":
      return t.forbidden;
    case "23505":
      return t.conflict;
    case "23503":
    case "22P02":
      return t.invalid;
    case "23514":
    case "P0001": {
      // Mensagens das nossas funções/gatilhos (pt-PT) não contêm detalhes técnicos.
      const technical = /violates|constraint|relation|column|\bnew row\b/i.test(msg);
      return technical || !msg ? t.invalid : msg;
    }
    default:
      return t.generic;
  }
}
