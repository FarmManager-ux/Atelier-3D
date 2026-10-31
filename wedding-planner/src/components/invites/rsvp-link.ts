import { toast } from "sonner";

/** Link público de confirmação de presença de um convidado. */
export const rsvpUrl = (token: string): string => `${typeof window === "undefined" ? "" : window.location.origin}/rsvp/${token}`;

/** Copia texto; se o browser recusar, seleciona-o num campo temporário. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* continua */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

/** Número para o WhatsApp (assume Portugal se tiver 9 dígitos). */
export function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "").replace(/^00/, "");
  if (digits.length === 9 && /^[2-9]/.test(digits)) return `351${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function whatsappLink(phone: string | null, text: string): string | null {
  const n = whatsappNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** Copia o link e mostra uma notificação. */
export async function copyLink(url: string): Promise<void> {
  if (await copyText(url)) toast.success("Link copiado.");
  else toast.error("Não foi possível copiar. Selecione o link manualmente.");
}
