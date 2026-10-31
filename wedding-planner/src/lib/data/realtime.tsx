"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { ALL_TABLES, invalidate } from "./queries";
import { useWeddingContext } from "./context";

export type SyncState = "connecting" | "live" | "offline";

/**
 * Atualização automática: ouve alterações da base de dados (Supabase Realtime) e atualiza os dados no ecrã.
 * Os dois noivos veem o trabalho um do outro sem recarregar. Se o tempo real falhar, os dados
 * continuam a atualizar ao voltar à janela e a cada 30 segundos.
 */
export function useRealtimeSync(): SyncState {
  const qc = useQueryClient();
  const { wedding } = useWeddingContext();
  const [state, setState] = useState<SyncState>("connecting");

  useEffect(() => {
    const supabase = getSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();
    const flush = () => { invalidate(qc, wedding.id, ...pending); pending.clear(); };
    const schedule = (table: string) => { pending.add(table); clearTimeout(timer); timer = setTimeout(flush, 120); };

    let channel = supabase.channel(`wedding-${wedding.id}`);
    for (const table of ALL_TABLES) {
      const filter = table === "weddings" ? `id=eq.${wedding.id}` : `wedding_id=eq.${wedding.id}`;
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, () => schedule(table));
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setState("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setState("offline");
    });

    const poll = setInterval(() => { for (const t of ALL_TABLES) pending.add(t); flush(); }, 30_000);
    return () => { clearTimeout(timer); clearInterval(poll); supabase.removeChannel(channel); };
  }, [qc, wedding.id]);

  return state;
}
