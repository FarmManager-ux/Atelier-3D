import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { ensureAccount } from "@/lib/accounts";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "recovery", "email", "invite", "magiclink", "email_change"];

/** Confirmação de email / recuperação: valida o token_hash e abre a sessão. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get("next"));

  if (tokenHash && type && OTP_TYPES.includes(type) && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (type === "signup") {
        const { data } = await supabase.auth.getUser();
        if (data.user) await ensureAccount(supabase, data.user);
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL("/entrar?erro=ligacao", origin));
}
