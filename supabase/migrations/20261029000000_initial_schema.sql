-- MedScheme Finder — initial schema
-- Public reference data (schemes, hospitals, sources) is read-only to clients.
-- Private user data (profiles, searches, interactions, statuses) is protected
-- by Row Level Security so each user can only reach their own rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public reference data
-- ---------------------------------------------------------------------------
create table public.reference_meta (
  id boolean primary key default true check (id),
  version text not null,
  updated_at timestamptz not null default now()
);

create table public.sources (
  id text primary key,
  title text not null,
  publisher text not null,
  url text not null check (url ~ '^https?://'),
  source_type text not null check (source_type in ('official_primary', 'official_secondary', 'hospital_official', 'news_report')),
  published_on date,
  accessed_on date not null,
  notes text,
  updated_at timestamptz not null default now()
);

create table public.medical_needs (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  kind text not null check (kind in ('procedure', 'disease', 'both')),
  specialty text not null,
  summary text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.schemes (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  official_name text not null,
  short_name text not null,
  issuing_authority text not null,
  scope text not null check (scope in ('national', 'state')),
  applicable_states text[] not null default '{}',
  summary text not null,
  intended_beneficiaries text not null,
  benefit_amount_inr numeric(14, 0) check (benefit_amount_inr is null or benefit_amount_inr >= 0),
  benefit_unit text,
  benefit_mechanism text not null check (benefit_mechanism in ('cashless_package', 'one_time_grant_to_hospital', 'partial_assistance', 'reimbursement', 'other', 'unknown')),
  payment_recipient text not null check (payment_recipient in ('hospital', 'beneficiary', 'varies', 'unknown')),
  benefit_details jsonb not null default '[]'::jsonb,
  patient_costs_note text,
  application_channel text not null,
  application_steps jsonb not null default '[]'::jsonb,
  application_url text check (application_url is null or application_url ~ '^https://'),
  application_url_status text not null check (application_url_status in ('official_verified', 'official_domain_unfetched', 'not_verified')),
  info_url text check (info_url is null or info_url ~ '^https://'),
  -- Official hospital search for this scheme, when one exists.
  hospital_directory_url text check (hospital_directory_url is null or hospital_directory_url ~ '^https://'),
  helpdesk jsonb not null default '[]'::jsonb,
  verification_status text not null check (verification_status in ('verified', 'partially_verified', 'requires_verification')),
  last_verified_on date not null,
  source_updated_on date,
  uncertainty_notes text[] not null default '{}',
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  -- A scheme without a verified link must not claim one.
  constraint application_url_matches_status check (
    (application_url is null and application_url_status = 'not_verified')
    or (application_url is not null and application_url_status <> 'not_verified')
  ),
  constraint state_scope_has_states check (scope = 'national' or cardinality(applicable_states) > 0)
);

create table public.scheme_sources (
  scheme_id text not null references public.schemes (id) on delete cascade,
  source_id text not null references public.sources (id) on delete restrict,
  primary key (scheme_id, source_id)
);

create table public.scheme_treatments (
  scheme_id text not null references public.schemes (id) on delete cascade,
  medical_need_id text not null references public.medical_needs (id) on delete cascade,
  coverage_level text not null check (coverage_level in ('procedure_verified', 'category_verified', 'secondary_source', 'unverified')),
  coverage_note text not null,
  source_id text references public.sources (id) on delete restrict,
  primary key (scheme_id, medical_need_id)
);
create index scheme_treatments_need_idx on public.scheme_treatments (medical_need_id);

create table public.scheme_eligibility_rules (
  id text primary key,
  scheme_id text not null references public.schemes (id) on delete cascade,
  criterion text not null check (criterion in ('age', 'income', 'residence', 'social_category', 'beneficiary_status', 'treatment', 'insurance', 'facility', 'other')),
  definition jsonb not null check (definition ? 'type'),
  mandatory boolean not null default true,
  any_of_group text,
  official_text text not null,
  source_id text references public.sources (id) on delete restrict,
  sort_order integer not null default 0
);
create index scheme_rules_scheme_idx on public.scheme_eligibility_rules (scheme_id);

create table public.scheme_documents (
  id bigint generated always as identity primary key,
  scheme_id text not null references public.schemes (id) on delete cascade,
  document text not null,
  note text,
  source_id text references public.sources (id) on delete restrict,
  is_provisional boolean not null default false,
  sort_order integer not null default 0,
  -- Non-provisional documents must be traceable to a source.
  constraint document_sourced check (is_provisional or source_id is not null)
);
create index scheme_documents_scheme_idx on public.scheme_documents (scheme_id);

create table public.hospitals (
  id text primary key,
  name text not null,
  address_line text,
  city text not null,
  district text,
  state text not null,
  pin text check (pin is null or pin ~ '^[1-9][0-9]{5}$'),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  coordinates_note text,
  phone text,
  website text check (website is null or website ~ '^https://'),
  verification_status text not null check (verification_status in ('hospital_official_source', 'government_listing', 'unverified')),
  last_verified_on date not null,
  source_id text references public.sources (id) on delete restrict,
  updated_at timestamptz not null default now()
);
create index hospitals_state_idx on public.hospitals (state, district);

create table public.scheme_hospitals (
  id bigint generated always as identity primary key,
  scheme_id text not null references public.schemes (id) on delete cascade,
  hospital_id text not null references public.hospitals (id) on delete cascade,
  medical_need_id text references public.medical_needs (id) on delete cascade,
  department text,
  status text not null check (status in ('listed_by_hospital', 'listed_by_scheme_document', 'unverified')),
  source_id text references public.sources (id) on delete restrict,
  note text,
  constraint scheme_hospital_sourced check (status = 'unverified' or source_id is not null),
  unique nulls not distinct (scheme_id, hospital_id, medical_need_id)
);
create index scheme_hospitals_scheme_idx on public.scheme_hospitals (scheme_id);

create trigger sources_updated_at before update on public.sources for each row execute function public.set_updated_at();
create trigger medical_needs_updated_at before update on public.medical_needs for each row execute function public.set_updated_at();
create trigger schemes_updated_at before update on public.schemes for each row execute function public.set_updated_at();
create trigger hospitals_updated_at before update on public.hospitals for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Private user data
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  date_of_birth date not null check (date_of_birth > date '1900-01-01'),
  phone_number text check (phone_number is null or phone_number ~ '^\+?[0-9]{10,15}$'),
  religion text check (religion is null or char_length(religion) <= 60),
  social_category text check (social_category in ('general', 'obc', 'sc', 'st', 'ews', 'other', 'prefer_not_to_say')),
  permanent_address_line text not null,
  permanent_state text not null,
  permanent_district text not null,
  permanent_pin text not null check (permanent_pin ~ '^[1-9][0-9]{5}$'),
  current_same_as_permanent boolean not null default true,
  current_address_line text,
  current_state text,
  current_district text,
  current_pin text check (current_pin is null or current_pin ~ '^[1-9][0-9]{5}$'),
  income_consent boolean not null default false,
  income_range_id text,
  income_exact_inr numeric(14, 0) check (income_exact_inr is null or income_exact_inr >= 0),
  insurance_status text check (insurance_status in ('yes', 'no', 'not_sure')),
  insurance_insurer text,
  insurance_policy_type text,
  pmjay_status text check (pmjay_status in ('has_card', 'listed', 'not_listed', 'not_sure')),
  state_beneficiary_document text check (state_beneficiary_document in ('yes', 'no', 'not_sure')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Income is only stored with explicit consent.
  constraint income_requires_consent check (income_consent or (income_range_id is null and income_exact_inr is null)),
  constraint current_address_complete check (
    current_same_as_permanent
    or (current_address_line is not null and current_state is not null and current_district is not null and current_pin is not null)
  )
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Search history stores no medical details, income or third-party data:
-- only which need was searched, in which mode, and summary counts.
create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  medical_need_id text not null references public.medical_needs (id) on delete restrict,
  mode text not null check (mode in ('profile', 'open')),
  treatment_state text,
  result_counts jsonb not null default '{}'::jsonb,
  reference_version text not null,
  created_at timestamptz not null default now(),
  constraint open_mode_stores_no_location check (mode = 'profile' or treatment_state is null)
);
create index searches_user_idx on public.searches (user_id, created_at desc);

create table public.scheme_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  scheme_id text not null references public.schemes (id) on delete cascade,
  action text not null check (action in ('opened', 'application_link_clicked')),
  created_at timestamptz not null default now()
);
create index scheme_interactions_user_idx on public.scheme_interactions (user_id, created_at desc);

-- Application status is only ever set explicitly by the user.
create table public.application_statuses (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scheme_id text not null references public.schemes (id) on delete cascade,
  status text not null check (status in ('planning', 'applied', 'approved', 'rejected', 'withdrawn')),
  updated_at timestamptz not null default now(),
  primary key (user_id, scheme_id)
);
create trigger application_statuses_updated_at before update on public.application_statuses for each row execute function public.set_updated_at();

-- An interaction may only reference the user's own search.
create or replace function public.check_interaction_search_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.search_id is not null and not exists (
    select 1 from public.searches s where s.id = new.search_id and s.user_id = new.user_id
  ) then
    raise exception 'search does not belong to this user' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger scheme_interactions_search_owner before insert or update on public.scheme_interactions
  for each row execute function public.check_interaction_search_owner();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.reference_meta enable row level security;
alter table public.sources enable row level security;
alter table public.medical_needs enable row level security;
alter table public.schemes enable row level security;
alter table public.scheme_sources enable row level security;
alter table public.scheme_treatments enable row level security;
alter table public.scheme_eligibility_rules enable row level security;
alter table public.scheme_documents enable row level security;
alter table public.hospitals enable row level security;
alter table public.scheme_hospitals enable row level security;
alter table public.profiles enable row level security;
alter table public.searches enable row level security;
alter table public.scheme_interactions enable row level security;
alter table public.application_statuses enable row level security;

-- Reference data: readable by everyone, writable only by the service role
-- (which bypasses RLS) through the seed script.
create policy "reference_meta readable" on public.reference_meta for select to anon, authenticated using (true);
create policy "sources readable" on public.sources for select to anon, authenticated using (true);
create policy "medical_needs readable" on public.medical_needs for select to anon, authenticated using (true);
create policy "schemes readable" on public.schemes for select to anon, authenticated using (true);
create policy "scheme_sources readable" on public.scheme_sources for select to anon, authenticated using (true);
create policy "scheme_treatments readable" on public.scheme_treatments for select to anon, authenticated using (true);
create policy "scheme_rules readable" on public.scheme_eligibility_rules for select to anon, authenticated using (true);
create policy "scheme_documents readable" on public.scheme_documents for select to anon, authenticated using (true);
create policy "hospitals readable" on public.hospitals for select to anon, authenticated using (true);
create policy "scheme_hospitals readable" on public.scheme_hospitals for select to anon, authenticated using (true);

-- Profiles: owner only.
create policy "profiles select own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles delete own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

-- Searches: owner only; immutable once written.
create policy "searches select own" on public.searches for select to authenticated using ((select auth.uid()) = user_id);
create policy "searches insert own" on public.searches for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "searches delete own" on public.searches for delete to authenticated using ((select auth.uid()) = user_id);

-- Interactions: owner only; immutable once written.
create policy "interactions select own" on public.scheme_interactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "interactions insert own" on public.scheme_interactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "interactions delete own" on public.scheme_interactions for delete to authenticated using ((select auth.uid()) = user_id);

-- Application statuses: owner only.
create policy "statuses select own" on public.application_statuses for select to authenticated using ((select auth.uid()) = user_id);
create policy "statuses insert own" on public.application_statuses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "statuses update own" on public.application_statuses for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "statuses delete own" on public.application_statuses for delete to authenticated using ((select auth.uid()) = user_id);

-- Least privilege for API roles.
revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;
grant select on public.reference_meta, public.sources, public.medical_needs, public.schemes, public.scheme_sources,
  public.scheme_treatments, public.scheme_eligibility_rules, public.scheme_documents, public.hospitals,
  public.scheme_hospitals to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, delete on public.searches, public.scheme_interactions to authenticated;
grant select, insert, update, delete on public.application_statuses to authenticated;
