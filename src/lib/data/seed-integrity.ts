/**
 * Integrity checks for the reference dataset. Run by the seed scripts and the
 * unit tests so a record can't be seeded unless every real-world claim points
 * at a source we store.
 */
import { STATE_CODES } from "@/lib/reference/india";
import type { RawReferenceRows } from "@/lib/data/mappers";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const RULE_TYPES = new Set([
  "age_range",
  "income_max",
  "residence_state",
  "social_category",
  "pmjay_beneficiary",
  "state_beneficiary_document",
  "insurance_not_excluded",
  "no_restriction",
  "requires_official_check",
  "informational",
]);

export function checkSeedIntegrity(raw: RawReferenceRows): string[] {
  const errors: string[] = [];
  const sourceIds = new Set(raw.sources.map((s) => s.id));
  const schemeIds = new Set(raw.schemes.map((s) => s.id));
  const needIds = new Set(raw.medical_needs.map((n) => n.id));
  const hospitalIds = new Set(raw.hospitals.map((h) => h.id));

  const needSource = (where: string, id: string | null | undefined, required: boolean) => {
    if (id === null || id === undefined) {
      if (required) errors.push(`${where}: missing source_id`);
      return;
    }
    if (!sourceIds.has(id)) errors.push(`${where}: unknown source_id "${id}"`);
  };

  for (const s of raw.sources) {
    if (!/^https:\/\//.test(s.url)) errors.push(`source ${s.id}: url must be https`);
    if (!s.accessed_on) errors.push(`source ${s.id}: accessed_on required`);
  }

  for (const s of raw.schemes as Row[]) {
    const where = `scheme ${s.id}`;
    const linked = raw.scheme_sources.filter((l) => l.scheme_id === s.id);
    if (!s.is_demo && linked.length === 0) errors.push(`${where}: real schemes need at least one source`);
    if (s.is_demo && !String(s.official_name).includes("DEMO DATA")) errors.push(`${where}: demo records must be labelled DEMO DATA`);
    if (s.scope === "state" && (!s.applicable_states?.length || s.applicable_states.some((c: string) => !STATE_CODES.includes(c))))
      errors.push(`${where}: state scheme needs valid applicable_states`);
    if (s.scope === "national" && s.applicable_states?.length) errors.push(`${where}: national scheme must not list states`);
    if (s.application_url && s.application_url_status === "not_verified")
      errors.push(`${where}: unverified application URL must be null`);
    if (!s.application_url && s.application_url_status !== "not_verified")
      errors.push(`${where}: link status says verified but no URL`);
    for (const t of [...(s.benefit_details ?? []), ...(s.application_steps ?? []), ...(s.helpdesk ?? [])]) {
      if (t.source_id) needSource(`${where} text`, t.source_id, false);
    }
    if (s.benefit_amount_inr !== null && !(s.benefit_details ?? []).some((t: Row) => t.source_id))
      errors.push(`${where}: a benefit amount needs a sourced benefit detail`);
  }
  for (const l of raw.scheme_sources) {
    if (!schemeIds.has(l.scheme_id)) errors.push(`scheme_sources: unknown scheme ${l.scheme_id}`);
    needSource(`scheme_sources ${l.scheme_id}`, l.source_id, true);
  }
  for (const t of raw.scheme_treatments) {
    const where = `treatment ${t.scheme_id}/${t.medical_need_id}`;
    if (!schemeIds.has(t.scheme_id)) errors.push(`${where}: unknown scheme`);
    if (!needIds.has(t.medical_need_id)) errors.push(`${where}: unknown need`);
    needSource(where, t.source_id, t.coverage_level !== "unverified");
  }
  for (const r of raw.scheme_eligibility_rules) {
    const where = `rule ${r.id}`;
    if (!schemeIds.has(r.scheme_id)) errors.push(`${where}: unknown scheme`);
    if (!RULE_TYPES.has(r.definition?.type)) errors.push(`${where}: unknown rule type ${r.definition?.type}`);
    needSource(where, r.source_id, true);
  }
  for (const d of raw.scheme_documents) {
    const where = `document ${d.scheme_id}: ${d.document}`;
    if (!schemeIds.has(d.scheme_id)) errors.push(`${where}: unknown scheme`);
    needSource(where, d.source_id, !d.is_provisional);
  }
  for (const h of raw.hospitals) {
    if (!STATE_CODES.includes(h.state)) errors.push(`hospital ${h.id}: invalid state`);
    needSource(`hospital ${h.id}`, h.source_id, h.verification_status !== "unverified");
    if (h.latitude !== null && !h.coordinates_note) errors.push(`hospital ${h.id}: coordinates need a provenance note`);
  }
  for (const l of raw.scheme_hospitals) {
    const where = `scheme_hospital ${l.scheme_id}/${l.hospital_id}`;
    if (!schemeIds.has(l.scheme_id)) errors.push(`${where}: unknown scheme`);
    if (!hospitalIds.has(l.hospital_id)) errors.push(`${where}: unknown hospital`);
    if (l.medical_need_id && !needIds.has(l.medical_need_id)) errors.push(`${where}: unknown need`);
    needSource(where, l.source_id, l.status !== "unverified");
  }
  return errors;
}
