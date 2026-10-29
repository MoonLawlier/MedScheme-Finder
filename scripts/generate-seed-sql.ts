/**
 * Validates supabase/seed/reference-data.json and writes supabase/seed.sql,
 * which `supabase db reset` applies automatically after migrations.
 *   npm run seed:sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { seedFileToRows } from "../src/lib/data/mappers";
import { checkSeedIntegrity } from "../src/lib/data/seed-integrity";
import { buildSeedSql } from "./lib/seed-sql";

const root = path.resolve(__dirname, "..");
const raw = seedFileToRows(JSON.parse(readFileSync(path.join(root, "supabase/seed/reference-data.json"), "utf8")));
const errors = checkSeedIntegrity(raw);
if (errors.length) {
  console.error("Seed data failed integrity checks:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
writeFileSync(path.join(root, "supabase/seed.sql"), buildSeedSql(raw));
console.log(`Wrote supabase/seed.sql (${raw.schemes.length} schemes, ${raw.hospitals.length} hospitals, version ${raw.version}).`);
