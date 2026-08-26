-- Lets a trainer paste a direct link to a real exercise GIF (found anywhere
-- they like) instead of relying on the ExerciseDB auto-match, which only
-- covers exercises that happen to exist in that catalogue under a
-- recognisable name. A pasted override always wins over the auto-match.
create table if not exists public.exercise_gif_overrides (
  exercise_id text        primary key,
  gif_url     text        not null,
  updated_at  timestamptz not null default now()
);

alter table public.exercise_gif_overrides enable row level security;

drop policy if exists exercise_gif_overrides_select on public.exercise_gif_overrides;
create policy exercise_gif_overrides_select on public.exercise_gif_overrides
  for select using (auth.uid() is not null);

drop policy if exists exercise_gif_overrides_write_trainer on public.exercise_gif_overrides;
create policy exercise_gif_overrides_write_trainer on public.exercise_gif_overrides
  for all using (public.is_trainer()) with check (public.is_trainer());
