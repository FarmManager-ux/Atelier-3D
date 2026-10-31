import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Cliente do browser (chave pública + sessão do utilizador; a RLS protege os dados). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    // As variáveis NEXT_PUBLIC_* são substituídas em tempo de build.
    client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return client;
}
