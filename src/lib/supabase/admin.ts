import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com a chave de serviço (ignora RLS). USO RESTRITO a operações de servidor já
 * autorizadas com o cliente do utilizador (ex.: finalizar uploads). Nunca importar em
 * componentes de cliente — o pacote "server-only" impede-o em tempo de build.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY em falta. Ver docs/ACOES-MANUAIS.md.");
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
