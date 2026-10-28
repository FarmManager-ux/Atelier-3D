import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

// Sem dados sensíveis: apenas estado da aplicação para monitorização.
export function GET() {
  return NextResponse.json(
    { status: "ok", supabaseConfigured: isSupabaseConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
