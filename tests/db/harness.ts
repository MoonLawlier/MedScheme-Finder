/**
 * Spins up an in-process Postgres (PGlite), adds a minimal stand-in for
 * Supabase's `auth` schema and API roles, then applies the real migration and
 * the generated seed. Used to test constraints and RLS policies without a
 * hosted Supabase project.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(__dirname, "../..");

const AUTH_SHIM = `
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
`;

export async function createTestDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_SHIM);
  const migrationsDir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  await db.exec(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  return db;
}

/** Run `fn` as an API role, optionally as a signed-in user, inside a transaction. */
export async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated",
  userId: string | null,
  fn: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role};`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    return fn(tx);
  });
}
