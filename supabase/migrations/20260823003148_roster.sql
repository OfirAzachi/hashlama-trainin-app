-- =====================================================================
-- Roster: the official fitness-test result sheet, imported in bulk from an
-- Excel export ("בוחן כושר גופני — פתיחה"). This is the source of truth for
-- who is allowed to sign up as a participant and what their pre-existing
-- test results are — signup matches a personal number (מ.א) against this
-- table rather than letting anyone self-declare an account.
--
-- Group assignment (primary/secondary competition group) is intentionally
-- NOT part of this table yet — it lands in a follow-up migration once the
-- updated source file with those two columns is imported.
-- =====================================================================

create type roster_grade as enum ('V', 'X', 'חסר');

create table if not exists public.roster (
  -- מ.א — the personal number used to match a sign-up to this row.
  personal_number   text primary key check (personal_number ~ '^[0-9]+$'),
  last_name         text not null,
  first_name        text not null,
  gender            text not null check (gender in ('ז', 'נ')),

  -- The run component, as recorded at the test event.
  run_start_time    text,             -- זמן הזנקה, "HH:MM:SS"
  run_finish_time   text,             -- זמן סיום, "HH:MM:SS"
  final_run_seconds integer,          -- זמן ריצה סופי, parsed to whole seconds
  run_grade         roster_grade,     -- הערכה ריצה

  -- The strength component.
  pushup_achievement integer,         -- הישג (סמיכה)
  strength_grade     roster_grade,    -- הערכה כוח

  final_score    integer,             -- ציון סופי
  final_grade    roster_grade,        -- הערכה סופית
  unit           text not null,       -- יחידה
  status_notes   text,                -- סטטוס / נדרש להשלים — exemptions, injuries, staged completion

  -- Filled in at sign-up time, not by the import.
  email           text unique,
  matched_user_id uuid unique references public.users (id) on delete set null,
  confirmed_at    timestamptz,        -- when the participant agreed their details are correct

  created_at timestamptz not null default now()
);

create index if not exists idx_roster_matched_user on public.roster (matched_user_id);

alter table public.roster enable row level security;

-- No anonymous access: the sign-up flow matches a personal number against
-- this table through a service-role server action, not a client-side query,
-- so unauthenticated visitors never get a read policy at all.

-- Trainers manage the whole roster (import, corrections, group assignment).
drop policy if exists roster_trainer_all on public.roster;
create policy roster_trainer_all on public.roster
  for all using (public.is_trainer()) with check (public.is_trainer());

-- A participant may only ever *see* their own matched row — never write it
-- directly. Confirming details (setting confirmed_at) goes through a server
-- action using the service-role client instead, so a crafted request can
-- never let someone edit their own test scores.
drop policy if exists roster_select_own on public.roster;
create policy roster_select_own on public.roster
  for select using (matched_user_id = auth.uid());
