import { z } from "zod";
import { messages } from "@/lib/i18n/pt-PT";

const m = messages.validation;

export const emailSchema = z
  .string({ error: m.required })
  .trim()
  .toLowerCase()
  .min(1, m.required)
  .max(254, m.tooLong)
  .pipe(z.email({ error: m.invalidEmail }));

// Política: mínimo 12 caracteres (recomendação NIST/OWASP, sem regras de composição forçadas).
export const passwordSchema = z
  .string({ error: m.required })
  .min(12, m.passwordTooShort)
  .max(128, m.tooLong);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: m.required }).min(1, m.required).max(128, m.tooLong),
});

export const registerSchema = z.object({
  fullName: z.string({ error: m.required }).trim().min(2, m.required).max(200, m.tooLong),
  email: emailSchema,
  password: passwordSchema,
  accountType: z.enum(["individual", "company"], { error: m.required }),
  companyName: z.string().trim().max(200, m.tooLong).optional(),
  acceptTerms: z.literal("on", { error: m.acceptTerms }),
}).superRefine((v, ctx) => {
  if (v.accountType === "company" && !v.companyName) {
    ctx.addIssue({ code: "custom", path: ["companyName"], message: m.required });
  }
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: passwordSchema });

export type FieldErrors = Record<string, string>;

/** Converte erros do Zod num mapa campo → primeira mensagem. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}
