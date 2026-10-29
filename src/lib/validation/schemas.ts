import { z } from "zod";
import { INCOME_RANGES, STATE_CODES } from "@/lib/reference/india";
import { allowedValues, fieldsForNeed } from "@/lib/needs/registry";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const stateCode = z.enum(STATE_CODES as [string, ...string[]], { message: "Choose a state or union territory." });
const optionalState = z
  .union([stateCode, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const pin = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a 6-digit PIN code.");

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{10,15}$/, "Enter a valid phone number, e.g. +91 98765 43210.");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() && d.getUTCFullYear() >= 1900;
  }, "Enter a real date of birth in the past.");

const triState = z.enum(["yes", "no", "not_sure"]);
const optionalTri = z
  .union([triState, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const incomeRangeId = z
  .union([z.enum(INCOME_RANGES.map((r) => r.id) as [string, ...string[]]), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const exactIncome = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s₹]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter annual income as a number of rupees, e.g. 120000." });
      return z.NEVER;
    }
    return Math.round(n);
  });

export const socialCategoryEnum = z.enum(["general", "obc", "sc", "st", "ews", "other", "prefer_not_to_say"]);
const optionalSocial = z
  .union([socialCategoryEnum, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const pmjayStatus = z
  .union([z.enum(["has_card", "listed", "not_listed", "not_sure"]), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const addressSchema = z.object({
  line: trimmed(300).min(3, "Enter the address."),
  state: stateCode,
  district: trimmed(80).min(2, "Enter the district."),
  pin,
});

export const profileSchema = z
  .object({
    fullName: trimmed(120).min(2, "Enter your full name."),
    dateOfBirth: isoDate,
    phoneNumber: z.union([phone, z.literal("")]).transform((v) => (v ? v.replace(/\s/g, "") : null)),
    religion: optionalText(60),
    socialCategory: optionalSocial,
    permanentAddress: addressSchema,
    currentSameAsPermanent: z.boolean(),
    currentAddress: addressSchema.nullable().optional().transform((v) => v ?? null),
    incomeConsent: z.boolean(),
    incomeRangeId,
    incomeExactInr: exactIncome,
    insuranceStatus: optionalTri,
    insuranceInsurer: optionalText(120),
    insurancePolicyType: optionalText(80),
    pmjayStatus,
    stateBeneficiaryDocument: optionalTri,
  })
  .superRefine((v, ctx) => {
    if (!v.currentSameAsPermanent && !v.currentAddress) {
      ctx.addIssue({ code: "custom", path: ["currentAddress"], message: "Enter the current address or tick “Same as permanent”." });
    }
  })
  .transform((v) => ({
    ...v,
    currentAddress: v.currentSameAsPermanent ? null : v.currentAddress,
    // Income is only stored with explicit consent.
    incomeRangeId: v.incomeConsent ? v.incomeRangeId : null,
    incomeExactInr: v.incomeConsent ? v.incomeExactInr : null,
    insuranceInsurer: v.insuranceStatus === "yes" ? v.insuranceInsurer : null,
    insurancePolicyType: v.insuranceStatus === "yes" ? v.insurancePolicyType : null,
  }));

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;

export const searchCriteriaSchema = z
  .object({
    needId: z.string().regex(/^[a-z0-9-]{2,60}$/),
    mode: z.enum(["profile", "open"]),
    age: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((v, ctx) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 120) {
          ctx.addIssue({ code: "custom", message: "Enter an age between 0 and 120." });
          return z.NEVER;
        }
        return n;
      }),
    residenceState: optionalState,
    residenceDistrict: optionalText(80),
    income: z.object({ rangeId: incomeRangeId, exactInr: exactIncome }),
    insurance: z.object({ status: optionalTri, insurer: optionalText(120), policyType: optionalText(80) }),
    socialCategory: optionalSocial,
    pmjayStatus,
    stateBeneficiaryDocument: optionalTri,
    needDetails: z.record(z.string(), z.string().max(40)).default({}),
    treatmentLocation: z.object({
      state: optionalState,
      district: optionalText(80),
      cityOrPin: optionalText(80),
      latitude: z.number().min(-90).max(90).nullable().optional().transform((v) => v ?? null),
      longitude: z.number().min(-180).max(180).nullable().optional().transform((v) => v ?? null),
      source: z.enum(["manual", "browser"]).default("manual"),
    })
    // Field-level so the message appears alongside other errors in the same submit.
    .superRefine((loc, ctx) => {
      if (!loc.state && loc.latitude === null) {
        ctx.addIssue({
          code: "custom",
          path: ["state"],
          message: "Choose the state where treatment is needed, or use your current location.",
        });
      }
    }),
  })
  .superRefine((v, ctx) => {
    for (const [key, value] of Object.entries(v.needDetails)) {
      if (!fieldsForNeed(v.needId).some((f) => f.key === key)) {
        ctx.addIssue({ code: "custom", path: ["needDetails", key], message: "Unknown field." });
      } else if (value && !allowedValues(v.needId, key).includes(value)) {
        ctx.addIssue({ code: "custom", path: ["needDetails", key], message: "Choose one of the listed options." });
      }
    }
  });

export type SearchCriteriaInput = z.input<typeof searchCriteriaSchema>;

export const applicationStatusSchema = z.object({
  schemeId: z.string().regex(/^[a-z0-9-]{2,60}$/),
  status: z.union([z.enum(["planning", "applied", "approved", "rejected", "withdrawn"]), z.null()]),
});

export const interactionSchema = z.object({
  schemeId: z.string().regex(/^[a-z0-9-]{2,60}$/),
  searchId: z.string().uuid().nullable(),
  action: z.enum(["opened", "application_link_clicked"]),
});

/** Turns zod issues into { "path.to.field": "message" } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
