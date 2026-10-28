import { z } from "zod";
import { messages } from "@/lib/i18n/pt-PT";
import { emailSchema } from "./auth";
import { isValidPortugueseNif } from "./nif";

const m = messages.validation;

/** Texto opcional: "" → undefined, com limite de comprimento. */
const optText = (max: number) =>
  z.string().trim().max(max, m.tooLong).optional().transform((v) => (v ? v : undefined));

const optEmail = z.string().trim().optional().transform((v) => (v ? v : undefined)).pipe(emailSchema.optional());

const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, m.invalidCountry).default("PT");

const optUrl = z
  .string().trim().max(300, m.tooLong).optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^https?:\/\/[^\s]+$/i.test(v), m.invalidUrl);

export const userProfileSchema = z.object({
  fullName: z.string({ error: m.required }).trim().min(2, m.required).max(200, m.tooLong),
  phone: optText(40),
});

export const accountDetailsSchema = z.object({
  displayName: z.string({ error: m.required }).trim().min(1, m.required).max(200, m.tooLong),
  phone: optText(40),
  website: optUrl,
  billingEmail: optEmail,
  activity: optText(500),
});

export const fiscalSchema = z
  .object({
    legalName: optText(300),
    nif: z.string().optional().transform((v) => (v ? v.replace(/\s/g, "") : undefined)),
    country,
  })
  .superRefine((v, ctx) => {
    if (!v.nif) return;
    if (v.country === "PT" && !isValidPortugueseNif(v.nif)) {
      ctx.addIssue({ code: "custom", path: ["nif"], message: m.invalidNif });
    } else if (v.country !== "PT" && !/^[A-Za-z0-9]{4,20}$/.test(v.nif)) {
      ctx.addIssue({ code: "custom", path: ["nif"], message: m.invalidTaxId });
    }
  });

export const addressSchema = z
  .object({
    kind: z.enum(["billing", "shipping", "other"], { error: m.required }),
    label: optText(100),
    recipientName: z.string({ error: m.required }).trim().min(1, m.required).max(200, m.tooLong),
    line1: z.string({ error: m.required }).trim().min(1, m.required).max(200, m.tooLong),
    line2: optText(200),
    postalCode: z.string({ error: m.required }).trim().min(1, m.required).max(20, m.tooLong),
    city: z.string({ error: m.required }).trim().min(1, m.required).max(100, m.tooLong),
    region: optText(100),
    country,
    phone: optText(40),
    isDefault: z.string().optional().transform((v) => v === "on"),
  })
  .superRefine((v, ctx) => {
    if (v.country === "PT" && !/^\d{4}-\d{3}$/.test(v.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: m.invalidPostalCodePt });
    }
  });

export const contactSchema = z
  .object({
    name: z.string({ error: m.required }).trim().min(1, m.required).max(200, m.tooLong),
    email: optEmail,
    phone: optText(40),
    jobTitle: optText(200),
    isPrimary: z.string().optional().transform((v) => v === "on"),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) {
      ctx.addIssue({ code: "custom", path: ["email"], message: m.emailOrPhone });
    }
  });

export const projectSchema = z.object({
  name: z.string({ error: m.required }).trim().min(1, m.required).max(200, m.tooLong),
  description: optText(2000),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "member"], { error: m.required }),
});

export const uuidSchema = z.uuid();

export const prepareUploadSchema = z.object({
  accountId: z.uuid(),
  projectId: z.uuid().nullable(),
  fileId: z.uuid().nullable(),
  displayName: z.string().trim().min(1, m.required).max(200, m.tooLong),
  filename: z.string().min(1).max(1000),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  notes: optText(1000),
});
