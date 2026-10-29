/**
 * Seeds the reference tables of a hosted Supabase project.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (e.g. `.env.local`). The service-role key is used only here and
 * is never bundled into the app.
 *   npm run seed
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { seedFileToRows } from "../src/lib/data/mappers";
import { checkSeedIntegrity } from "../src/lib/data/seed-integrity";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
    process.exit(1);
  }
  const root = path.resolve(__dirname, "..");
  const raw = seedFileToRows(JSON.parse(readFileSync(path.join(root, "supabase/seed/reference-data.json"), "utf8")));
  const errors = checkSeedIntegrity(raw);
  if (errors.length) {
    console.error("Seed data failed integrity checks:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const step = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) throw new Error(`${label}: ${error.message}`);
    console.log(`✓ ${label}`);
  };

  // Children first, so parents can be refreshed. User tables are untouched.
  await step("clear scheme_hospitals", db.from("scheme_hospitals").delete().gte("id", 0));
  await step("clear scheme_documents", db.from("scheme_documents").delete().gte("id", 0));
  await step("clear scheme_eligibility_rules", db.from("scheme_eligibility_rules").delete().neq("id", ""));
  await step("clear scheme_treatments", db.from("scheme_treatments").delete().neq("scheme_id", ""));
  await step("clear scheme_sources", db.from("scheme_sources").delete().neq("scheme_id", ""));

  await step("upsert reference_meta", db.from("reference_meta").upsert({ id: true, version: raw.version }));
  await step("upsert sources", db.from("sources").upsert(raw.sources));
  await step("upsert medical_needs", db.from("medical_needs").upsert(raw.medical_needs));
  await step("upsert schemes", db.from("schemes").upsert(raw.schemes));
  await step("upsert hospitals", db.from("hospitals").upsert(raw.hospitals));
  await step("insert scheme_sources", db.from("scheme_sources").insert(raw.scheme_sources));
  await step("insert scheme_treatments", db.from("scheme_treatments").insert(raw.scheme_treatments));
  await step("insert scheme_eligibility_rules", db.from("scheme_eligibility_rules").insert(raw.scheme_eligibility_rules));
  await step("insert scheme_documents", db.from("scheme_documents").insert(raw.scheme_documents));
  await step("insert scheme_hospitals", db.from("scheme_hospitals").insert(raw.scheme_hospitals));
  console.log(`Seeded reference data version ${raw.version}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
