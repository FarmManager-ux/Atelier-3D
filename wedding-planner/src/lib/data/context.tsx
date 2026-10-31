"use client";

import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { MemberRole, Wedding } from "@/lib/db-types";

interface Ctx { wedding: Wedding; user: Pick<User, "id" | "email">; role: MemberRole }
const WeddingContext = createContext<Ctx | null>(null);

export function WeddingProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <WeddingContext.Provider value={value}>{children}</WeddingContext.Provider>;
}

export function useWeddingContext(): Ctx {
  const ctx = useContext(WeddingContext);
  if (!ctx) throw new Error("useWeddingContext fora do WeddingProvider");
  return ctx;
}
