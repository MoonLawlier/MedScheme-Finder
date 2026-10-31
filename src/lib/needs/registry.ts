/**
 * Need-specific form fields. The medical need itself (name, kind, specialty)
 * lives in the database; this registry only describes which extra questions
 * the search form shows for it. Add a new entry to support a new need.
 *
 * None of these fields are used to make clinical judgements. They are only
 * collected when a documented scheme criterion could depend on them, and
 * every question offers "Not sure".
 */

export interface NeedFieldOption {
  value: string;
  label: string;
}

export interface NeedField {
  key: string;
  label: string;
  help?: string;
  options: NeedFieldOption[];
  /** Show only when another field has one of these values. */
  showWhen?: { key: string; values: string[] };
  /** Options that depend on another field's value (e.g. phase per subtype). */
  optionsByValueOf?: { key: string; map: Record<string, NeedFieldOption[]> };
}

const NOT_SURE: NeedFieldOption = { value: "not_sure", label: "Not sure / not provided" };

const treatmentStatus = (verbs: [string, string, string]): NeedField => ({
  key: "status",
  label: "Where are things with the treatment?",
  help: "Some schemes only work before or during hospitalisation, so this helps us flag timing questions.",
  options: [
    { value: "recommended", label: verbs[0] },
    { value: "planned", label: verbs[1] },
    { value: "completed", label: verbs[2] },
    NOT_SURE,
  ],
});

export const NEED_FIELDS: Record<string, NeedField[]> = {
  "knee-replacement": [
    treatmentStatus([
      "A doctor has recommended it",
      "Surgery is scheduled",
      "Surgery is already done",
    ]),
  ],
  leukemia: [
    {
      key: "subtype",
      label: "Condition subtype, if known",
      help: "Only as written on a report. Choose “Not sure” if you don't know.",
      options: [
        { value: "all", label: "Acute lymphoblastic (ALL)" },
        { value: "aml", label: "Acute myeloid (AML)" },
        { value: "apl", label: "Acute promyelocytic (APL)" },
        { value: "cml", label: "Chronic myeloid (CML)" },
        { value: "cll", label: "Chronic lymphocytic (CLL)" },
        { value: "other", label: "Another type" },
        NOT_SURE,
      ],
    },
    {
      key: "classification",
      label: "Phase or clinical classification, if known",
      help: "Clinical classifications vary by subtype, so the choices change with the type.",
      showWhen: { key: "subtype", values: ["all", "aml", "apl", "cml", "cll"] },
      options: [NOT_SURE],
      optionsByValueOf: {
        key: "subtype",
        map: {
          all: [
            { value: "newly_diagnosed", label: "Newly diagnosed" },
            { value: "remission", label: "In remission" },
            { value: "relapsed", label: "Relapsed or refractory" },
            NOT_SURE,
          ],
          aml: [
            { value: "newly_diagnosed", label: "Newly diagnosed" },
            { value: "remission", label: "In remission" },
            { value: "relapsed", label: "Relapsed or refractory" },
            NOT_SURE,
          ],
          apl: [
            { value: "induction", label: "Starting or in induction treatment" },
            { value: "consolidation", label: "Consolidation / maintenance" },
            NOT_SURE,
          ],
          cml: [
            { value: "chronic", label: "Chronic phase" },
            { value: "accelerated", label: "Accelerated phase" },
            { value: "blast", label: "Blast phase" },
            NOT_SURE,
          ],
          cll: [
            { value: "early", label: "Early stage (as told by the doctor)" },
            { value: "intermediate", label: "Intermediate stage" },
            { value: "advanced", label: "Advanced stage" },
            NOT_SURE,
          ],
        },
      },
    },
    {
      key: "treatmentType",
      label: "Treatment being considered or given",
      options: [
        { value: "chemotherapy", label: "Chemotherapy" },
        { value: "targeted", label: "Targeted therapy / oral medicines" },
        { value: "transplant", label: "Bone marrow / stem cell transplant" },
        { value: "radiotherapy", label: "Radiotherapy" },
        { value: "other", label: "Other" },
        NOT_SURE,
      ],
    },
    {
      key: "status",
      label: "Treatment status",
      options: [
        { value: "considering", label: "Considering treatment" },
        { value: "ongoing", label: "Treatment ongoing" },
        { value: "completed", label: "Treatment completed" },
        NOT_SURE,
      ],
    },
  ],
  angioplasty: [
    treatmentStatus([
      "A doctor has recommended it",
      "Procedure is planned or ongoing",
      "Procedure is already done",
    ]),
  ],
};

export function fieldsForNeed(needId: string): NeedField[] {
  return NEED_FIELDS[needId] ?? [];
}

export function optionsFor(field: NeedField, values: Record<string, string>): NeedFieldOption[] {
  if (field.optionsByValueOf) {
    const parent = values[field.optionsByValueOf.key];
    return field.optionsByValueOf.map[parent] ?? field.options;
  }
  return field.options;
}

export function isFieldVisible(field: NeedField, values: Record<string, string>): boolean {
  if (!field.showWhen) return true;
  return field.showWhen.values.includes(values[field.showWhen.key]);
}

/** Allowed values per need (used for server-side validation). */
export function allowedValues(needId: string, key: string): string[] {
  const field = fieldsForNeed(needId).find((f) => f.key === key);
  if (!field) return [];
  const all = new Set(field.options.map((o) => o.value));
  if (field.optionsByValueOf) {
    for (const opts of Object.values(field.optionsByValueOf.map)) opts.forEach((o) => all.add(o.value));
  }
  return [...all];
}
