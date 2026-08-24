-- The strength catalogue widened from 3 difficulty tiers to 4 (בסיסי מאוד /
-- מתחיל / בינוני / מתקדם), and gained a 5th category — cardio (אירובי ללא
-- ריצה) — alongside push/back/lower/core.

alter type public.strength_category add value if not exists 'cardio';

alter table public.strength_exercises drop constraint if exists strength_exercises_level_check;
alter table public.strength_exercises add constraint strength_exercises_level_check
  check (level between 1 and 4);

alter table public.strength_logs drop constraint if exists strength_logs_level_check;
alter table public.strength_logs add constraint strength_logs_level_check
  check (level between 1 and 4);

alter table public.strength_configs alter column allowed_levels set default '{1,2,3,4}';
