-- The `users` table was the one table in this schema restricted to
-- "yourself, or a trainer" for reads — every other table (session_media,
-- media_comments, training_sessions, ...) already lets any signed-in cohort
-- member read everything, which is what the feed, standings and @mentions
-- all rely on to resolve OTHER people's names. A participant querying
-- `users` only ever got their own row back, so anything built on it —
-- other people's posts in the feed, the mailbox @mention autocomplete, etc.
-- — silently came back empty for non-trainers. Align it with the rest of
-- the schema: full names/teams are already shown across the whole cohort,
-- so this doesn't expose anything new.
drop policy if exists users_select_self_or_trainer on public.users;
drop policy if exists users_select_cohort on public.users;
create policy users_select_cohort on public.users
  for select using (auth.uid() is not null);
