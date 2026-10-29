# MedScheme Finder

A demo-ready MVP that helps people in India discover government medical-assistance schemes they **may** qualify for, see each eligibility rule explained, understand what the scheme pays (and to whom), find participating hospitals, and reach the official application channel.

It covers three needs today — **knee replacement**, **leukaemia** and **angioplasty** — and is built so new needs, schemes and rules are added as data, not code.

> This tool does not decide eligibility, replace official verification or hospital authorisation, or give medical advice. Benefit figures are documented ceilings, not promised payments.

---

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Tailwind CSS 4 · Supabase Auth + Postgres + RLS · Zod · Lucide · Vitest · Playwright · PGlite (in-process Postgres for migration/RLS tests).

UI primitives are hand-written in `src/components/ui` (shadcn-style, no Radix) because the shadcn registry wasn't reachable from the build environment.

## Quick start (no credentials needed)

```bash
npm install
npm run dev            # http://localhost:3000
```

With no Supabase variables set, the app runs in a clearly labelled **development mode**:

- Sign-in accepts any email **without verifying it** (banner on every page).
- Profiles, search history and statuses are written to `.data/dev-store.json`.
- Scheme data is read from the same seed file that populates Postgres.

Dev mode is disabled in production builds unless `ALLOW_DEV_FALLBACK=true`.

## Running with Supabase

1. Create a Supabase project (or run `supabase start` locally with the CLI).
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Apply the schema:
   ```bash
   supabase link --project-ref <ref>
   supabase db push                       # applies supabase/migrations/*
   ```
   or paste `supabase/migrations/20261029000000_initial_schema.sql` into the SQL editor.
4. Seed reference data (either):
   ```bash
   npm run seed                           # service-role upsert into the hosted project
   # or, for a local CLI stack: supabase db reset  (runs migrations + supabase/seed.sql)
   ```
5. `npm run dev`.

### Auth provider configuration

| Feature | What to configure | Flag |
|---|---|---|
| Email OTP + magic link | Auth → Providers → Email (on by default). Add `{{ .Token }}` to the *Magic Link* email template so users get a 6-digit code as well as the link. Add `<SITE_URL>/auth/callback` to Auth → URL Configuration → Redirect URLs. | — |
| Google OAuth | Create an OAuth client in Google Cloud (redirect URI `https://<ref>.supabase.co/auth/v1/callback`), add client ID/secret in Auth → Providers → Google. | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` |
| Phone sign-in & verification | Auth → Providers → Phone with an SMS provider (Twilio, MessageBird, Vonage…). | `NEXT_PUBLIC_AUTH_PHONE_ENABLED=true` |

When a flag is off, the button explains the provider isn't configured instead of failing. A phone number typed into the profile is stored as **unverified**; it's shown as verified only when Supabase Auth confirms an SMS code (`phone_confirmed_at`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm test` | Vitest: matching engine, validation, data integrity, **migration + RLS tests on PGlite** |
| `npm run test:e2e` | Playwright journeys against dev mode (starts its own server on :3100) |
| `npm run seed:sql` | Validates the dataset and regenerates `supabase/seed.sql` |
| `npm run seed` | Validates and seeds a hosted Supabase project (service role) |

Playwright needs a Chromium. Run `npx playwright install chromium`, or point at an existing binary with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing page; the hero runs the real engine on a sample person |
| `/sign-in`, `/auth/callback` | Email OTP / magic link, Google, phone; dev sign-in in dev mode |
| `/profile` | Profile with completion indicator, consent-gated income, phone verification |
| `/dashboard` | Mode selector, the three needs, recent activity, how it works |
| `/search/[need]` | Need-specific form with progressive disclosure, prefill chips, geolocation |
| `/results` | Summary, National/State filter, sort, expandable scheme cards |
| `/history` | Searches, schemes opened, user-recorded application status; empty state “Nothing Here!” |
| `/help` | How results work, privacy notice, data sources, deployment status |

## Architecture

```
src/
  proxy.ts                    Session refresh + optimistic route guard (Next 16 "proxy")
  app/actions/                Server actions: auth, profile, search, interactions, status
  lib/matching/engine.ts      Deterministic MATCH / DOES_NOT_MATCH / UNKNOWN engine
  lib/matching/hospitals.ts   Distance (only with real coordinates) or district/state ranking
  lib/data/reference.ts       Reference data from Postgres (or seed file in dev mode)
  lib/data/*-user-store.ts    Private data: Supabase (RLS) or dev JSON store
  lib/data/seed-integrity.ts  Blocks unsourced claims from being seeded
  lib/needs/registry.ts       Per-need form questions (add a need here + in the DB)
  lib/validation/schemas.ts   Zod schemas used on client and server
supabase/
  migrations/                 Schema, constraints, RLS, grants
  seed/reference-data.json    The sourced dataset (single source of truth)
  seed.sql                    Generated from the JSON
```

### Database

Public reference data: `reference_meta`, `sources`, `medical_needs`, `schemes`, `scheme_sources`, `scheme_treatments`, `scheme_eligibility_rules`, `scheme_documents`, `hospitals`, `scheme_hospitals` — readable by everyone, writable only by the service role.

Private data (RLS: owner only): `profiles`, `searches`, `scheme_interactions`, `application_statuses`. `scheme_interactions` + `searches.result_counts` serve as the search-results history.

Constraints enforce the data rules: income can't be stored without consent; open-mode searches can't store a location; an unverified application link must be null; non-provisional documents and hospital links must cite a source; an interaction can only reference the user's own search.

### Matching rules

- Every rule evaluates to `MATCH`, `DOES_NOT_MATCH` or `UNKNOWN`; `UNKNOWN` never becomes a match.
- Rules in an `any_of_group` count as one (e.g. “ration card **or** listed institutional group”).
- A scheme is a **potential match** only if all mandatory rules match and the record isn't flagged `requires_verification`; any failed rule → **does not meet a known criterion**; otherwise **needs verification**.
- Treatment coverage is itself a rule: only `procedure_verified` / `category_verified` coverage can match.
- Income ranges decide a threshold only when the whole range sits on one side; otherwise the user is asked for the exact figure.
- No percentages, probabilities or promised payments.

### Privacy

Search answers (including medical details and Open-mode data) are kept in `sessionStorage` of the tab only — never in URLs, never in history. History stores need, mode, date, counts and (profile mode only) treatment state. Sign-out, Reset and leaving Open mode clear the relevant session data. Errors are logged by code only. Security headers limit framing and permissions; geolocation is requested only on click and not stored.

## Data: what is verified

All facts were checked on **29 Oct 2026**. Every row links to a source in `reference-data.json`; the Help page lists them all.

| Scheme | Scope | Key verified facts | Main sources |
|---|---|---|---|
| AB PM-JAY | National | ₹5 lakh/family/year, cashless, 3 days pre / 15 days post, SECC basis; PTCA package MC011 (HBP 2.1); 549 cancer procedures | [PIB 6-year doc](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2024/sep/doc2024923400001.pdf), [NHA HBP 2.1](https://nha.gov.in/img/pmjay-files/HBP-2.1.pdf), [Lok Sabha AU2641](https://eparlib.nic.in/bitstream/123456789/2500970/1/AU2641.pdf) |
| PM-JAY for 70+ | National | Age 70+ regardless of income; ₹5 lakh; exclusive top-up; private insurance/ESI eligible; CGHS/ECHS/CAPF may choose | [NHA press release](https://nha.gov.in/img/resources/Press_Release.pdf) |
| Integrated MJPJAY + PM-JAY | Maharashtra | ₹5 lakh floater; categories A–E; 1,356 packages; documents; Arogyamitra | [Govt. medical college summary](https://iggmc.edu.in/wp-content/uploads/2026/04/Integrated-Ayushman-Bharat.pdf) (secondary — portal unreadable) |
| Umbrella RAN | National | Up to ₹15 lakh one-time, paid to govt hospital; process and documents | [PIB 22 Jul 2022](https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=1843846&reg=48&lang=2), [AIIMS Bhubaneswar](https://aiimsbhubaneswar.nic.in/schemes/umbrella-scheme-rashtriya-arogya-nidhi-ran/) |
| HMCPF | National | Up to ₹15 lakh for cancer patients below poverty line at RCCs/TCCCs/SCIs | [Lok Sabha AU5561 (Apr 2025)](https://eparlib.sansad.in/bitstream/123456789/3010946/1/AU5561_tNqey7.pdf) |
| HMDG | National | Up to ₹1.25 lakh, family income ≤ ₹1.25 lakh | [PIB 22 Jul 2022](https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=1843846&reg=48&lang=2) — record flagged `requires_verification` |
| PMNRF | National | Partial assistance for heart surgery, kidney transplant, cancer; no amount published | [pmnrf.gov.in](https://pmnrf.gov.in/) |

Hospitals (3), each traced to a source:

- **Tata Memorial Hospital, Parel, Mumbai** — its own [patient booklet](https://tmc.gov.in/event/upload/12112025_5/TMH_Brochure_%20patient%20booklet.pdf) lists MJPJAY, AB-PMJAY and PMNRF, and adult haematology (acute leukaemia, CML) clinics. Linked to leukaemia only.
- **AIIMS Bhubaneswar** — its own [PM-JAY](https://aiimsbhubaneswar.nic.in/schemes/ayushman-bharat-pm-jay/) and RAN pages. Scheme-level only; treatment availability shown as not confirmed.
- **AIIMS New Delhi** — named on the [MoHFW RAN page](https://mohfw.gov.in/major-programmes/poor-patients-financial-assistance/rashtriya-arogya-nidhi) as holding a RAN revolving fund (page appears to predate 2019; flagged).

Hospital coordinates are approximate public-map values and are labelled as such wherever a distance is shown.

### Known gaps (shown honestly in the UI)

- **Knee replacement under PM-JAY** is supported only by a news report of a Dec 2025 Lok Sabha reply → shown as *needs official check*, never as a match.
- Procedure-level coverage under the Maharashtra scheme isn't verified.
- `pmjay.gov.in`, `beneficiary.nha.gov.in`, `hospitals.pmjay.gov.in`, `jeevandayee.gov.in` and the 2019 RAN guidelines blocked automated fetching; links point to these official domains with a note to confirm details there.
- No state schemes outside Maharashtra yet; the State filter shows a clear empty state.
- HMCPF / HMDG / PMNRF application processes and document lists weren't available; only provisional, clearly labelled checklists are shown.

## Adding a need or scheme

1. Add the need to `medical_needs` in `supabase/seed/reference-data.json` and (optionally) its questions to `src/lib/needs/registry.ts`.
2. Add `sources`, the `scheme`, its `scheme_treatments` (with a coverage level), `scheme_eligibility_rules` (structured `definition`), `scheme_documents` and `scheme_hospitals`.
3. `npm run seed:sql && npm test` — the integrity checks reject unsourced claims.
4. `npm run seed` (hosted) or `supabase db reset` (local).

Form questions such as the state ration-card question, PM-JAY status, social category and exact income appear automatically when a scheme for that need has a rule that uses them.

## Deployment

Deploy to any Node host (e.g. Vercel). Set the environment variables from `.env.example` (never `ALLOW_DEV_FALLBACK` in production), add the deployed `/auth/callback` URL to Supabase redirect URLs, and run the migration + seed against the production project.
