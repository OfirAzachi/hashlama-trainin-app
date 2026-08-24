-- 1. כמ (operational-fitness) status: a participant can carry more than one
--    level at once (e.g. "כמ 1 - עבר, כמ 0" in the source sheet), so it's a
--    small array of 0/1/2 rather than a single enum value.
alter table public.roster add column if not exists km_levels smallint[] not null default '{}';
alter table public.roster add constraint roster_km_levels_valid check (km_levels <@ array[0, 1, 2]::smallint[]);

-- 2. The onboarding confirmation screen is becoming editable — a participant
--    who disagrees with a roster-derived value can correct it there. `users`
--    already holds the editable/effective copy for team and unit; extend
--    that same pattern to the rest of the fields shown on that screen so a
--    correction never mutates the original `roster` import row.
alter table public.users add column if not exists gender text check (gender in ('ז', 'נ'));
alter table public.users add column if not exists final_run_seconds integer;
alter table public.users add column if not exists pushup_achievement integer;
alter table public.users add column if not exists final_score integer;
alter table public.users add column if not exists km_levels smallint[] not null default '{}';
alter table public.users add constraint users_km_levels_valid check (km_levels <@ array[0, 1, 2]::smallint[]);
