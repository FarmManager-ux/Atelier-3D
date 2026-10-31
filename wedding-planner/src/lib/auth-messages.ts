/** Mensagens de erro de autenticação do Supabase em português, sem revelar se um email existe. */
export function authErrorMessage(error: { message?: string; status?: number; code?: string } | null | undefined): string {
  const m = (error?.message ?? "").toLowerCase();
  if (error?.status === 429 || m.includes("rate limit")) return "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "Email ou palavra-passe incorretos.";
  if (m.includes("email not confirmed")) return "Confirme o seu email antes de entrar (veja a caixa de correio).";
  if (m.includes("password") && m.includes("weak")) return "A palavra-passe é demasiado fraca. Use pelo menos 10 caracteres.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem ligação à internet. Tente novamente.";
  return "Não foi possível concluir o pedido. Tente novamente.";
}

/** Só permite redirecionamentos para caminhos internos (evita "open redirect"). */
export function safeNext(input: string | null | undefined, fallback = "/"): string {
  if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
   
  if (/[\u0000-\u001f\u007f]/.test(input)) return fallback;
  return input;
}
