import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { connection } from "next/server";
import { backendMode } from "@/lib/config";
import { buildReferenceData, seedFileToRows, type RawReferenceRows } from "@/lib/data/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReferenceData } from "@/lib/types";

export class DataUnavailableError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage);
  }
}

async function loadFromSupabase(): Promise<ReferenceData> {
  const supabase = await createSupabaseServerClient();
  const tables = [
    "sources",
    "medical_needs",
    "schemes",
    "scheme_sources",
    "scheme_treatments",
    "scheme_eligibility_rules",
    "scheme_documents",
    "hospitals",
    "scheme_hospitals",
  ] as const;
  const results = await Promise.all(tables.map((t) => supabase.from(t).select("*")));
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    // Log the table-level code only; no user data is involved in these queries.
    console.error("[reference-data] query failed:", failed.error.code);
    throw new DataUnavailableError("Scheme data could not be loaded from the database. Try again shortly.");
  }
  const [sources, medical_needs, schemes, scheme_sources, scheme_treatments, rules, documents, hospitals, scheme_hospitals] =
    results.map((r) => r.data ?? []);
  const meta = await supabase.from("reference_meta").select("version").maybeSingle();
  const raw: RawReferenceRows = {
    version: (meta.data?.version as string | undefined) ?? "unknown",
    sources,
    medical_needs: medical_needs.filter((n) => n.active !== false),
    schemes,
    scheme_sources: scheme_sources as RawReferenceRows["scheme_sources"],
    scheme_treatments,
    scheme_eligibility_rules: rules,
    scheme_documents: documents,
    hospitals,
    scheme_hospitals,
  };
  return buildReferenceData(raw);
}

/**
 * DEVELOPMENT FALLBACK ONLY: reads the same seed file that scripts/seed.ts
 * writes into Postgres, so the local store mirrors the database model.
 */
async function loadFromSeedFile(): Promise<ReferenceData> {
  const file = path.join(process.cwd(), "supabase", "seed", "reference-data.json");
  const json = JSON.parse(await readFile(file, "utf8"));
  return buildReferenceData(seedFileToRows(json));
}

export const getReferenceData = cache(async (): Promise<ReferenceData> => {
  await connection(); // data is read per request so updates show without a rebuild
  if (backendMode === "supabase") return loadFromSupabase();
  if (backendMode === "dev") return loadFromSeedFile();
  throw new DataUnavailableError("The database is not configured for this deployment.");
});
