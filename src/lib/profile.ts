import type { Profile } from "@/lib/data/user-types";

export interface Completion {
  done: number;
  total: number;
  missing: string[];
}

/** Essentials used to prefill searches. Sensitive optional fields are never counted. */
export function profileCompletion(p: Profile | null, phoneFromAuth: string | null = null): Completion {
  const checks: [string, boolean][] = [
    ["Full name", Boolean(p?.fullName)],
    ["Date of birth", Boolean(p?.dateOfBirth)],
    ["Contact number", Boolean(p?.phoneNumber || phoneFromAuth)],
    ["Permanent address", Boolean(p?.permanentAddress?.line)],
    ["State and district", Boolean(p?.permanentAddress?.state && p?.permanentAddress?.district)],
    ["PIN code", Boolean(p?.permanentAddress?.pin)],
  ];
  return {
    done: checks.filter(([, ok]) => ok).length,
    total: checks.length,
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}

export function firstName(p: Profile | null): string | null {
  return p?.fullName?.trim().split(/\s+/)[0] ?? null;
}
