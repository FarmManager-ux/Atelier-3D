import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/shared/config/env";

// Apenas estado da aplicação para monitorização; nunca dados sensíveis.
export function GET() {
  return NextResponse.json(
    { status: "ok", supabaseConfigured: isSupabaseConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
