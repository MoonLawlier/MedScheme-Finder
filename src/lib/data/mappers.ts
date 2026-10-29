/**
 * Converts database rows (snake_case, as stored in Postgres and in the seed
 * file) into domain objects. Both the Supabase repository and the local
 * development store use these mappers, so they share one data model.
 */
import type {
  EligibilityRule,
  Hospital,
  MedicalNeed,
  ReferenceData,
  RuleDefinition,
  Scheme,
  SchemeDocument,
  SchemeHospital,
  SchemeTreatment,
  Source,
  SourcedText,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const texts = (v: unknown): SourcedText[] =>
  Array.isArray(v) ? v.map((t: Row) => ({ text: String(t.text), sourceId: t.source_id ?? null })) : [];

export const mapSource = (r: Row): Source => ({
  id: r.id,
  title: r.title,
  publisher: r.publisher,
  url: r.url,
  sourceType: r.source_type,
  publishedOn: r.published_on ?? null,
  accessedOn: r.accessed_on,
  notes: r.notes ?? null,
});

export const mapNeed = (r: Row): MedicalNeed => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  specialty: r.specialty,
  summary: r.summary,
  sortOrder: r.sort_order,
});

export const mapScheme = (r: Row, sourceIds: string[]): Scheme => ({
  id: r.id,
  officialName: r.official_name,
  shortName: r.short_name,
  issuingAuthority: r.issuing_authority,
  scope: r.scope,
  applicableStates: r.applicable_states ?? [],
  summary: r.summary,
  intendedBeneficiaries: r.intended_beneficiaries,
  benefitAmountInr: r.benefit_amount_inr === null || r.benefit_amount_inr === undefined ? null : Number(r.benefit_amount_inr),
  benefitUnit: r.benefit_unit ?? null,
  benefitMechanism: r.benefit_mechanism,
  paymentRecipient: r.payment_recipient,
  benefitDetails: texts(r.benefit_details),
  patientCostsNote: r.patient_costs_note ?? null,
  applicationChannel: r.application_channel,
  applicationSteps: texts(r.application_steps),
  applicationUrl: r.application_url ?? null,
  applicationUrlStatus: r.application_url_status,
  infoUrl: r.info_url ?? null,
  hospitalDirectoryUrl: r.hospital_directory_url ?? null,
  helpdesk: texts(r.helpdesk),
  verificationStatus: r.verification_status,
  lastVerifiedOn: String(r.last_verified_on),
  sourceUpdatedOn: r.source_updated_on ?? null,
  uncertaintyNotes: r.uncertainty_notes ?? [],
  isDemo: Boolean(r.is_demo),
  sourceIds,
});

export const mapTreatment = (r: Row): SchemeTreatment => ({
  schemeId: r.scheme_id,
  needId: r.medical_need_id,
  coverageLevel: r.coverage_level,
  coverageNote: r.coverage_note,
  sourceId: r.source_id ?? null,
});

export const mapRule = (r: Row): EligibilityRule => ({
  id: r.id,
  schemeId: r.scheme_id,
  criterion: r.criterion,
  definition: r.definition as RuleDefinition,
  mandatory: Boolean(r.mandatory),
  anyOfGroup: r.any_of_group ?? null,
  officialText: r.official_text,
  sourceId: r.source_id ?? null,
  sortOrder: r.sort_order,
});

export const mapDocument = (r: Row): SchemeDocument => ({
  schemeId: r.scheme_id,
  document: r.document,
  note: r.note ?? null,
  sourceId: r.source_id ?? null,
  isProvisional: Boolean(r.is_provisional),
  sortOrder: r.sort_order,
});

export const mapHospital = (r: Row): Hospital => ({
  id: r.id,
  name: r.name,
  addressLine: r.address_line ?? null,
  city: r.city,
  district: r.district ?? null,
  state: r.state,
  pin: r.pin ?? null,
  latitude: r.latitude === null || r.latitude === undefined ? null : Number(r.latitude),
  longitude: r.longitude === null || r.longitude === undefined ? null : Number(r.longitude),
  coordinatesNote: r.coordinates_note ?? null,
  phone: r.phone ?? null,
  website: r.website ?? null,
  verificationStatus: r.verification_status,
  lastVerifiedOn: String(r.last_verified_on),
  sourceId: r.source_id ?? null,
});

export const mapSchemeHospital = (r: Row): SchemeHospital => ({
  schemeId: r.scheme_id,
  hospitalId: r.hospital_id,
  needId: r.medical_need_id ?? null,
  department: r.department ?? null,
  status: r.status,
  sourceId: r.source_id ?? null,
  note: r.note ?? null,
});

export interface RawReferenceRows {
  version: string;
  sources: Row[];
  medical_needs: Row[];
  schemes: Row[];
  scheme_sources: { scheme_id: string; source_id: string }[];
  scheme_treatments: Row[];
  scheme_eligibility_rules: Row[];
  scheme_documents: Row[];
  hospitals: Row[];
  scheme_hospitals: Row[];
}

export function buildReferenceData(raw: RawReferenceRows): ReferenceData {
  const sourcesByScheme = new Map<string, string[]>();
  for (const link of raw.scheme_sources) {
    const list = sourcesByScheme.get(link.scheme_id) ?? [];
    list.push(link.source_id);
    sourcesByScheme.set(link.scheme_id, list);
  }
  return {
    version: raw.version,
    sources: raw.sources.map(mapSource),
    medicalNeeds: raw.medical_needs.map(mapNeed).sort((a, b) => a.sortOrder - b.sortOrder),
    schemes: raw.schemes.map((s) => mapScheme(s, sourcesByScheme.get(s.id) ?? [])),
    treatments: raw.scheme_treatments.map(mapTreatment),
    rules: raw.scheme_eligibility_rules.map(mapRule),
    documents: raw.scheme_documents.map(mapDocument),
    hospitals: raw.hospitals.map(mapHospital),
    schemeHospitals: raw.scheme_hospitals.map(mapSchemeHospital),
  };
}

/**
 * The seed file keeps scheme→source links inline (`source_ids`) for
 * readability; the database stores them in `scheme_sources`.
 */
export function seedFileToRows(seed: Row): RawReferenceRows {
  const scheme_sources: { scheme_id: string; source_id: string }[] = [];
  const schemes = (seed.schemes as Row[]).map((s) => {
    const { source_ids, ...rest } = s;
    for (const id of (source_ids as string[]) ?? []) scheme_sources.push({ scheme_id: s.id, source_id: id });
    return rest;
  });
  return {
    version: seed.version,
    sources: seed.sources,
    medical_needs: seed.medical_needs,
    schemes,
    scheme_sources,
    scheme_treatments: seed.scheme_treatments,
    scheme_eligibility_rules: seed.scheme_eligibility_rules,
    scheme_documents: seed.scheme_documents,
    hospitals: seed.hospitals,
    scheme_hospitals: seed.scheme_hospitals,
  };
}
