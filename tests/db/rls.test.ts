import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createTestDb } from "./harness";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

const profileSql = `insert into public.profiles
  (id, full_name, date_of_birth, permanent_address_line, permanent_state, permanent_district, permanent_pin)
  values ($1, $2, '1950-01-01', 'Test address', 'MH', 'Pune', '411001')`;

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'alice@example.test'), ($2, 'bob@example.test')`, [ALICE, BOB]);
}, 60_000);

describe("migration + seed", () => {
  it("loads the reference data", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.schemes");
    expect(rows[0].n).toBeGreaterThan(0);
  });

  it("rejects an unverified application link that still has a URL", async () => {
    await expect(
      db.query(`update public.schemes set application_url_status = 'not_verified' where id = 'pmjay-family'`),
    ).rejects.toThrow();
  });

  it("rejects a non-provisional document without a source", async () => {
    await expect(
      db.query(`insert into public.scheme_documents (scheme_id, document, is_provisional) values ('pmjay-family', 'X', false)`),
    ).rejects.toThrow();
  });
});

describe("row level security", () => {
  it("lets anonymous visitors read reference data but not private tables", async () => {
    await asRole(db, "anon", null, async (tx) => {
      const schemes = await tx.query("select id from public.schemes");
      expect(schemes.rows.length).toBeGreaterThan(0);
      await expect(tx.query("select * from public.profiles")).rejects.toThrow();
    });
  });

  it("blocks clients from writing reference data", async () => {
    await expect(
      asRole(db, "authenticated", ALICE, (tx) =>
        tx.query(`update public.schemes set benefit_amount_inr = 1 where id = 'pmjay-family'`),
      ),
    ).rejects.toThrow();
  });

  it("lets a user create and read only their own profile", async () => {
    await asRole(db, "authenticated", ALICE, (tx) => tx.query(profileSql, [ALICE, "Alice Test"]));
    await asRole(db, "authenticated", BOB, (tx) => tx.query(profileSql, [BOB, "Bob Test"]));

    const seenByAlice = await asRole(db, "authenticated", ALICE, (tx) =>
      tx.query<{ id: string }>("select id from public.profiles"),
    );
    expect(seenByAlice.rows.map((r) => r.id)).toEqual([ALICE]);
  });

  it("prevents creating a profile for someone else", async () => {
    const MALLORY = "33333333-3333-4333-8333-333333333333";
    await db.query(`insert into auth.users (id) values ($1)`, [MALLORY]);
    await expect(
      asRole(db, "authenticated", ALICE, (tx) => tx.query(profileSql, [MALLORY, "Not Alice"])),
    ).rejects.toThrow();
  });

  it("prevents modifying another user's profile", async () => {
    const result = await asRole(db, "authenticated", ALICE, (tx) =>
      tx.query(`update public.profiles set full_name = 'Hacked' where id = $1`, [BOB]),
    );
    expect(result.affectedRows ?? 0).toBe(0);
    const { rows } = await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [BOB]);
    expect(rows[0].full_name).toBe("Bob Test");
  });

  it("keeps search history private and prevents spoofing user_id", async () => {
    await asRole(db, "authenticated", BOB, (tx) =>
      tx.query(
        `insert into public.searches (user_id, medical_need_id, mode, reference_version) values ($1, 'leukemia', 'open', 'v')`,
        [BOB],
      ),
    );
    const aliceView = await asRole(db, "authenticated", ALICE, (tx) => tx.query("select * from public.searches"));
    expect(aliceView.rows).toHaveLength(0);

    await expect(
      asRole(db, "authenticated", ALICE, (tx) =>
        tx.query(
          `insert into public.searches (user_id, medical_need_id, mode, reference_version) values ($1, 'leukemia', 'open', 'v')`,
          [BOB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("refuses to store a treatment location for open-mode searches", async () => {
    await expect(
      asRole(db, "authenticated", ALICE, (tx) =>
        tx.query(
          `insert into public.searches (user_id, medical_need_id, mode, treatment_state, reference_version) values ($1, 'leukemia', 'open', 'MH', 'v')`,
          [ALICE],
        ),
      ),
    ).rejects.toThrow();
  });

  it("refuses to link an interaction to another user's search", async () => {
    const bobSearch = await db.query<{ id: string }>("select id from public.searches where user_id = $1 limit 1", [BOB]);
    await expect(
      asRole(db, "authenticated", ALICE, (tx) =>
        tx.query(
          `insert into public.scheme_interactions (user_id, search_id, scheme_id, action) values ($1, $2, 'pmjay-family', 'opened')`,
          [ALICE, bobSearch.rows[0].id],
        ),
      ),
    ).rejects.toThrow();
  });

  it("refuses to store income without consent", async () => {
    await expect(
      asRole(db, "authenticated", ALICE, (tx) =>
        tx.query(`update public.profiles set income_range_id = 'lt_1l', income_consent = false where id = $1`, [ALICE]),
      ),
    ).rejects.toThrow();
  });
});
