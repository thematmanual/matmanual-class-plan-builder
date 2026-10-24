-- Mat Manual Class Plan Builder — schema additions (Supabase / Postgres)
-- Deploy: run in the SQL editor of the EXISTING Mat Manual Supabase
-- project (rsnttmawjayytoidompx — the same project the Curriculum
-- Builder, Training Journal, Ready to Test?, Flashcards and
-- Combination Builder use), AFTER those tools' schema files. Owner
-- rule: all Mat Manual tools share this one project on the Supabase
-- Free plan for as long as possible — do NOT create a separate
-- project for this tool. This file only ADDS the class_plans table;
-- it does not touch profiles/curricula/lessons/journal/readiness/
-- flashcards/combinations tables, and it reuses the shared
-- public.profiles (plan) + auth, so one Pro unlock covers every
-- Mat Manual tool.
--
-- WHY ONE ROW PER USER WITH A JSONB PAYLOAD (not one row per plan):
-- a teacher's class plans are a document — named plans, each an
-- ordered list of timed segments — and the field set will keep
-- evolving as the app learns how instructors plan. This mirrors
-- combinations/review_queue/readiness exactly: cloud sync is one
-- upsert of the whole state document, the app uses the same shape
-- locally and in the cloud so the two can never disagree about
-- identity, and adding a field needs NO migration.
--
-- THE IMPORT reads the user's OWN Curriculum Builder rows
-- (public.curricula / lessons / lesson_items) — no new access is
-- created here; those tables' owner-only RLS already scopes every
-- read to the signed-in owner's rows.
--
-- FREE-TIER LIMITS are enforced in the app layer, NOT in the
-- database (same as the sibling tools): Free = up to 3 saved
-- plans, standalone mode only, on-screen; Pro = unlimited plans,
-- Curriculum Builder import, printing. RLS below only enforces
-- ownership. Nothing here deletes or hides a free user's plans —
-- the cap only blocks creating new ones in the app, and plans
-- already saved stay fully usable.
--
-- BILLING: unchanged from the sibling tools. Stripe's webhook
-- writes public.profiles.plan (service role); every Mat Manual
-- tool reads the same row.

-- -------------------------------------------------- class_plans
create table if not exists public.class_plans (
  owner_id   uuid primary key references auth.users (id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,  -- the whole app state, exactly as stored locally
  updated_at timestamptz not null default now()
);

comment on table public.class_plans is
  'Class Plan Builder per-user state (saved timed class plans: segments, level mix, source curriculum ref) as one jsonb document. App-layer plan limits; RLS enforces ownership only.';

-- ===================================================================== RLS
alter table public.class_plans enable row level security;

-- Owner-only CRUD: a user can read and write exactly their own
-- class plans, nothing else. Anonymous (publishable-key, signed-out)
-- access therefore returns zero rows — to be verified by REST probe
-- at ship, and the applied columns verified against this file in
-- information_schema (an anon probe alone cannot detect drift).
drop policy if exists "class_plans: owner all" on public.class_plans;
create policy "class_plans: owner all" on public.class_plans
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
