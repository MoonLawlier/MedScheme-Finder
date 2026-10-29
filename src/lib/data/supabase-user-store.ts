import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplicationStatus,
  InteractionRecord,
  Profile,
  SearchRecord,
  UserStore,
} from "@/lib/data/user-types";
import { DataUnavailableError } from "@/lib/data/reference";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function fail(op: string, error: { code?: string } | null): never {
  // Never log row contents: they may include health or demographic data.
  console.error(`[user-store] ${op} failed`, error?.code ?? "unknown");
  throw new DataUnavailableError("Your data could not be saved or loaded right now. Try again shortly.");
}

const toProfile = (r: Row): Profile => ({
  userId: r.id,
  fullName: r.full_name,
  dateOfBirth: r.date_of_birth,
  phoneNumber: r.phone_number,
  religion: r.religion,
  socialCategory: r.social_category,
  permanentAddress: {
    line: r.permanent_address_line,
    state: r.permanent_state,
    district: r.permanent_district,
    pin: r.permanent_pin,
  },
  currentSameAsPermanent: r.current_same_as_permanent,
  currentAddress: r.current_same_as_permanent
    ? null
    : { line: r.current_address_line, state: r.current_state, district: r.current_district, pin: r.current_pin },
  incomeConsent: r.income_consent,
  incomeRangeId: r.income_range_id,
  incomeExactInr: r.income_exact_inr === null ? null : Number(r.income_exact_inr),
  insuranceStatus: r.insurance_status,
  insuranceInsurer: r.insurance_insurer,
  insurancePolicyType: r.insurance_policy_type,
  pmjayStatus: r.pmjay_status,
  stateBeneficiaryDocument: r.state_beneficiary_document,
  updatedAt: r.updated_at,
});

const toSearch = (r: Row): SearchRecord => ({
  id: r.id,
  userId: r.user_id,
  needId: r.medical_need_id,
  mode: r.mode,
  treatmentState: r.treatment_state,
  resultCounts: r.result_counts,
  referenceVersion: r.reference_version,
  createdAt: r.created_at,
});

/** Runs every query with the user's own session, so RLS is the final gate. */
export class SupabaseUserStore implements UserStore {
  constructor(private readonly db: SupabaseClient) {}

  async getProfile(userId: string) {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) fail("getProfile", error);
    return data ? toProfile(data) : null;
  }

  async upsertProfile(userId: string, p: Omit<Profile, "userId" | "updatedAt">) {
    const row = {
      id: userId,
      full_name: p.fullName,
      date_of_birth: p.dateOfBirth,
      phone_number: p.phoneNumber,
      religion: p.religion,
      social_category: p.socialCategory,
      permanent_address_line: p.permanentAddress.line,
      permanent_state: p.permanentAddress.state,
      permanent_district: p.permanentAddress.district,
      permanent_pin: p.permanentAddress.pin,
      current_same_as_permanent: p.currentSameAsPermanent,
      current_address_line: p.currentAddress?.line ?? null,
      current_state: p.currentAddress?.state ?? null,
      current_district: p.currentAddress?.district ?? null,
      current_pin: p.currentAddress?.pin ?? null,
      income_consent: p.incomeConsent,
      income_range_id: p.incomeRangeId,
      income_exact_inr: p.incomeExactInr,
      insurance_status: p.insuranceStatus,
      insurance_insurer: p.insuranceInsurer,
      insurance_policy_type: p.insurancePolicyType,
      pmjay_status: p.pmjayStatus,
      state_beneficiary_document: p.stateBeneficiaryDocument,
    };
    const { data, error } = await this.db.from("profiles").upsert(row).select("*").single();
    if (error) fail("upsertProfile", error);
    return toProfile(data);
  }

  async createSearch(userId: string, rec: Omit<SearchRecord, "id" | "userId" | "createdAt">) {
    const { data, error } = await this.db
      .from("searches")
      .insert({
        user_id: userId,
        medical_need_id: rec.needId,
        mode: rec.mode,
        treatment_state: rec.treatmentState,
        result_counts: rec.resultCounts,
        reference_version: rec.referenceVersion,
      })
      .select("*")
      .single();
    if (error) fail("createSearch", error);
    return toSearch(data);
  }

  async listSearches(userId: string, limit = 50) {
    const { data, error } = await this.db
      .from("searches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("listSearches", error);
    return (data ?? []).map(toSearch);
  }

  async recordInteraction(userId: string, rec: Omit<InteractionRecord, "id" | "userId" | "createdAt">) {
    const { error } = await this.db
      .from("scheme_interactions")
      .insert({ user_id: userId, search_id: rec.searchId, scheme_id: rec.schemeId, action: rec.action });
    if (error) fail("recordInteraction", error);
  }

  async listInteractions(userId: string, limit = 100) {
    const { data, error } = await this.db
      .from("scheme_interactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("listInteractions", error);
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      userId: r.user_id,
      searchId: r.search_id,
      schemeId: r.scheme_id,
      action: r.action,
      createdAt: r.created_at,
    }));
  }

  async setApplicationStatus(userId: string, schemeId: string, status: ApplicationStatus | null) {
    if (status === null) {
      const { error } = await this.db.from("application_statuses").delete().eq("user_id", userId).eq("scheme_id", schemeId);
      if (error) fail("clearApplicationStatus", error);
      return;
    }
    const { error } = await this.db
      .from("application_statuses")
      .upsert({ user_id: userId, scheme_id: schemeId, status }, { onConflict: "user_id,scheme_id" });
    if (error) fail("setApplicationStatus", error);
  }

  async listApplicationStatuses(userId: string) {
    const { data, error } = await this.db.from("application_statuses").select("*").eq("user_id", userId);
    if (error) fail("listApplicationStatuses", error);
    return (data ?? []).map((r: Row) => ({
      userId: r.user_id,
      schemeId: r.scheme_id,
      status: r.status,
      updatedAt: r.updated_at,
    }));
  }
}
