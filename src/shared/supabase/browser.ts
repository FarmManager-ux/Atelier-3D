import { createBrowserClient } from "@supabase/ssr";

/** Cliente para o browser (apenas chave pública). Usado no upload direto para o Storage. */
export function createBrowserSupabase(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey);
}
