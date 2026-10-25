# Mat Manual — Class Plan Builder

Tool #7 in the Mat Manual tools family (after the Curriculum Builder,
Training Journal, Training Timer, Ready to Test?, Exam Prep Flashcards,
and Combination Builder). It is the Curriculum Builder's other half:
that tool decides *what the rotation teaches over 16 weeks*; this one
turns **one class** of it into a timed plan an instructor can carry
onto the mat.

**Live (once shipped):** https://classplan.matmanual.com

## What it does

- **Import a class (Pro):** pick one of your saved Curriculum Builder
  curricula, then one class in its rotation. The plan is built from
  that class's saved requirements (`lesson_items` category/requirement
  snapshots), at the curriculum's class length, with the level mix
  defaulted from the rotation phase (Foundations → beginners,
  Test Ready → advanced).
- **Standalone (Free):** type the techniques yourself — one per line.
- **The plan:** warm-up, one or two technique blocks, partner drills,
  live practice, conditioning, cool-down. Segment minutes **always
  sum exactly to the class length** — that invariant is the product's
  core promise and is fuzz-tested. Every segment is editable
  (title, minutes, items, coaching note), reorderable, removable;
  a one-click **Balance** rescales edited segments back to the exact
  class length.
- **Per-art language:** segments speak the selected art's own terms —
  judo warms up with ukemi and finishes with randori, BJJ rolls,
  Muay Thai works pads, taekwondo spars (kyorugi), Shotokan drills
  kumite and spars jiyu kumite. A neutral "general" profile covers
  classes outside the six arts. (Multi-domain rule: a label is shared
  only where every art genuinely uses it the same way.)
- **Print sheet (Pro):** a clean one-page plan — segment table with
  clock times when a start time is set (offsets otherwise), items,
  coaching notes, class notes.
- **Local-first:** works signed out; the whole document lives in
  `localStorage` under `mmcp.state.v1`. Signed-in users sync to the
  `class_plans` table in the shared Mat Manual Supabase project
  (owner-only RLS, one row per user, jsonb payload — the same shape
  as the sibling tools, so local and cloud can never disagree).

## Plans (profiles.plan, shared with every Mat Manual tool)

- **Free:** up to 3 saved plans, standalone mode, on-screen.
- **Pro:** unlimited plans, Curriculum Builder import, printing.
- A downgrade deletes nothing — Free limits apply to new plans only,
  and plans already saved stay fully usable (same wording/behaviour
  as the sibling tools).

## Files

- `index.html` — the whole app (single file; logic inlined
  byte-identically from `logic.js`, verified by `splice.js`).
- `logic.js` — pure logic: per-art profiles, the exact-sum minute
  allocator, generation, rebalance, clock maths, import mapping,
  sanitising, tier gating. No dependencies; runs in browser + Node.
- `logic.test.js` — `node logic.test.js` (4,725 assertions: exact
  sums across 7 arts × 3 level mixes × 11 class lengths × technique
  counts, a 300-case rebalance fuzz, clock maths, Curriculum Builder
  art/phase mapping, sanitiser, gating).
- `splice.js` — `node splice.js` inlines `logic.js` into
  `index.html`; `--check` verifies byte-identity without writing.
- `supabase/schema.sql` — the `class_plans` table for the shared
  project (apply once, like the sibling tools' schemas).
- `vercel.json` — baseline security headers per SECURITY-RUNBOOK.md.

## Ship checklist (dashboard steps)

1. Run `supabase/schema.sql` in the shared project
   (rsnttmawjayytoidompx) SQL editor, then catalog-verify:
   `select column_name, data_type from information_schema.columns
   where table_schema='public' and table_name='class_plans'` must
   show exactly `owner_id uuid`, `payload jsonb`,
   `updated_at timestamptz` — an anon REST probe alone cannot
   detect column drift. Anon probe afterwards:
   `GET /rest/v1/class_plans` with the publishable key must return
   `[]` (RLS owner-only), not rows.
2. Create the GitHub repo `thematmanual/matmanual-class-plan-builder`,
   push `main` (auto-deploy, like the sibling tools).
3. Vercel: create the project from the repo, add the custom domain
   `classplan.matmanual.com` (+ the Porkbun CNAME it asks for).
4. Supabase Auth: add `https://classplan.matmanual.com` to the
   redirect allowlist (10 entries after this tool).
5. Verify live: security headers present, anon probe `[]`,
   sign-up → confirmation link lands on the production origin.

## Deliberately left out of v1

- No multi-class / week view — the product is one class, done well;
  the Curriculum Builder already owns the rotation level.
- No shared/team plans for a school's whole staff — owner-only is
  the runbook's default posture for every tool.
- No automatic technique content: the plan organises the instructor's
  own techniques; it does not invent a syllabus.

## Idle sign-out (2026-10-25)

This app carries the shared idle watcher: `mm-idle.js` at the repo
root, a byte-identical copy of the canonical module in
`~/workspace/matmanual/mm-idle.js` (change it there, re-copy
everywhere, never edit a copy in place). While signed in, 55 idle
minutes bring the "Still there?" warning and 60 sign the user out
through this app's own sign-out, which clears the shared session on
every Mat Manual surface. Mouse, keyboard, touch, and scroll all
count as activity, and activity in any tab counts (shared
localStorage stamp). Design and verification notes:
`~/workspace/matmanual/idle-signout.md`.
