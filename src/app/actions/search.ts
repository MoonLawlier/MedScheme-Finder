"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { countByStatus, runMatching } from "@/lib/matching/engine";
import { DataUnavailableError, getReferenceData } from "@/lib/data/reference";
import { getUserStore } from "@/lib/data/user-store";
import { applicationStatusSchema, fieldErrors, interactionSchema, searchCriteriaSchema } from "@/lib/validation/schemas";
import type { OfficialResource, ReferenceData, SchemeResult, SearchCriteria } from "@/lib/types";
import { safeExternalUrl } from "@/lib/utils/cn";
import { relevantStateFor } from "@/lib/matching/engine";

export type RunSearchResponse =
  | {
      ok: true;
      searchId: string | null;
      needName: string;
      criteria: SearchCriteria;
      results: SchemeResult[];
      referenceVersion: string;
      historyWarning: string | null;
      officialResources: OfficialResource[];
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; authRequired?: boolean };

/**
 * Validates the search on the server, runs the deterministic matching engine
 * against the database, and records a minimal history entry. Search inputs
 * are returned to this browser tab only; they are not stored.
 */
export async function runSearch(input: unknown): Promise<RunSearchResponse> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again to search.", authRequired: true };

  const parsed = searchCriteriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some details need fixing.", fieldErrors: fieldErrors(parsed.error) };
  }
  const criteria: SearchCriteria = parsed.data;

  let data;
  try {
    data = await getReferenceData();
  } catch (e) {
    return { ok: false, error: e instanceof DataUnavailableError ? e.userMessage : "Scheme data could not be loaded." };
  }
  const need = data.medicalNeeds.find((n) => n.id === criteria.needId);
  if (!need) return { ok: false, error: "That medical need isn't supported yet." };

  const results = runMatching(data, criteria);

  let searchId: string | null = null;
  let historyWarning: string | null = null;
  try {
    const store = await getUserStore();
    const rec = await store.createSearch(user.id, {
      needId: criteria.needId,
      mode: criteria.mode,
      // Open mode is about someone else: keep no location for them.
      treatmentState: criteria.mode === "profile" ? criteria.treatmentLocation.state : null,
      resultCounts: countByStatus(results),
      referenceVersion: data.version,
    });
    searchId = rec.id;
    revalidatePath("/history");
    revalidatePath("/dashboard");
  } catch {
    historyWarning = "Results are shown, but this search couldn't be added to your history.";
  }

  return {
    ok: true,
    searchId,
    needName: need.name,
    criteria,
    results,
    referenceVersion: data.version,
    historyWarning,
    officialResources: officialResourcesFor(data, relevantStateFor(criteria)),
  };
}

export async function recordSchemeInteraction(input: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const parsed = interactionSchema.safeParse(input);
  if (!user || !parsed.success) return { ok: false };
  try {
    await (await getUserStore()).recordInteraction(user.id, parsed.data);
    revalidatePath("/history");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function setApplicationStatus(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to save this." };
  const parsed = applicationStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That status isn't valid." };
  try {
    await (await getUserStore()).setApplicationStatus(user.id, parsed.data.schemeId, parsed.data.status);
    revalidatePath("/history");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof DataUnavailableError ? e.userMessage : "Couldn't save the status." };
  }
}

/** Official places to look further, taken from the scheme records themselves. */
function officialResourcesFor(data: ReferenceData, state: string | null): OfficialResource[] {
  const seen = new Set<string>();
  const out: OfficialResource[] = [];
  for (const s of data.schemes) {
    if (s.isDemo) continue;
    if (s.scope === "state" && (!state || !s.applicableStates.includes(state))) continue;
    for (const [url, kind] of [
      [s.infoUrl, "Scheme information"],
      [s.hospitalDirectoryUrl, "Hospital directory"],
    ] as const) {
      const safe = safeExternalUrl(url);
      if (!safe || seen.has(safe)) continue;
      seen.add(safe);
      out.push({ label: `${s.shortName}: ${kind}`, url: safe });
    }
  }
  return out;
}
