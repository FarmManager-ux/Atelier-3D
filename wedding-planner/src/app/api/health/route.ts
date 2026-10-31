import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

// Estado da aplicação (sem dados sensíveis), útil para monitorização.
export function GET() {
  return NextResponse.json({ status: "ok", supabaseConfigured: isSupabaseConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
