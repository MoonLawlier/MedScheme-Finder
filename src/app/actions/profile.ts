"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { DataUnavailableError } from "@/lib/data/reference";
import { getUserStore } from "@/lib/data/user-store";
import type { Profile } from "@/lib/data/user-types";
import { fieldErrors, profileSchema } from "@/lib/validation/schemas";

export type SaveResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Input is untrusted: it is validated here regardless of what the client sends. */
export async function saveProfile(input: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again to save." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some details need fixing before saving.", fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    const store = await getUserStore();
    const profile = await store.upsertProfile(user.id, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, error: e instanceof DataUnavailableError ? e.userMessage : "Saving failed. Try again." };
  }
}

const searchToProfileSchema = z.object({
  incomeRangeId: z.string().nullable(),
  incomeExactInr: z.union([z.number(), z.string(), z.null()]),
  insuranceStatus: z.string().nullable(),
  insuranceInsurer: z.string().nullable(),
  insurancePolicyType: z.string().nullable(),
  pmjayStatus: z.string().nullable(),
  stateBeneficiaryDocument: z.string().nullable(),
});

/**
 * Explicit "Save these to my profile" from a profile-mode search. Only the
 * reusable, non-medical answers are saved, and income is saved only because
 * the user pressed the button (which records consent).
 */
export async function saveSearchAnswersToProfile(input: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again to save." };
  const answers = searchToProfileSchema.safeParse(input);
  if (!answers.success) return { ok: false, error: "Those answers couldn't be read." };
  try {
    const store = await getUserStore();
    const existing = await store.getProfile(user.id);
    if (!existing) return { ok: false, error: "Complete your profile first, then you can save search answers to it." };
    const a = answers.data;
    const hasIncome = Boolean(a.incomeRangeId) || (a.incomeExactInr !== null && a.incomeExactInr !== "");
    const merged: Record<string, unknown> = {
      fullName: existing.fullName,
      dateOfBirth: existing.dateOfBirth,
      phoneNumber: existing.phoneNumber ?? "",
      religion: existing.religion,
      socialCategory: existing.socialCategory,
      permanentAddress: existing.permanentAddress,
      currentSameAsPermanent: existing.currentSameAsPermanent,
      currentAddress: existing.currentAddress,
      incomeConsent: hasIncome || existing.incomeConsent,
      incomeRangeId: a.incomeRangeId,
      incomeExactInr: a.incomeExactInr,
      insuranceStatus: a.insuranceStatus,
      insuranceInsurer: a.insuranceInsurer,
      insurancePolicyType: a.insurancePolicyType,
      pmjayStatus: a.pmjayStatus,
      stateBeneficiaryDocument: a.stateBeneficiaryDocument,
    };
    const parsed = profileSchema.safeParse(merged);
    if (!parsed.success) return { ok: false, error: "Some answers aren't valid for your profile.", fieldErrors: fieldErrors(parsed.error) };
    const profile = await store.upsertProfile(user.id, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, error: e instanceof DataUnavailableError ? e.userMessage : "Saving failed. Try again." };
  }
}
