-- =====================================================================
-- Real teams (1-8, from the roster's צוות column) replace the placeholder
-- A/B/C mock groups everywhere: training targeting AND the league table.
-- A second, independent dimension — unit (יחידה) — is added purely as a
-- second leaderboard; it never drives which training content someone gets.
-- =====================================================================

-- These calculated views were never queried by the app — every aggregate
-- (benchmark deltas, attendance, the league table) is computed in
-- lib/metrics.ts / lib/points.ts instead, over raw rows fetched through
-- lib/data.ts. Rather than maintain two parallel implementations of the
-- same math, drop the views so the group-column rework below isn't blocked
-- by their dependency on users.group_id.
drop view if exists public.v_group_analytics;
drop view if exists public.v_participant_attendance;
drop view if exists public.v_benchmark_deltas;
drop view if exists public.v_group_points;
drop view if exists public.v_running_points;
drop view if exists public.v_strength_points;
drop view if exists public.v_session_log_export;

-- ---------------------------------------------------------------- users
alter table public.users drop constraint if exists users_group_matches_role;

alter table public.users add column if not exists team smallint check (team between 1 and 8);
alter table public.users add column if not exists unit text;

drop index if exists idx_users_group;
alter table public.users drop column if exists group_id;

alter table public.users add constraint users_team_matches_role check (
  (role = 'participant' and team is not null) or
  (role = 'trainer' and team is null)
);

create index if not exists idx_users_team on public.users (team);

-- --------------------------------------------------- session targeting
-- `target_team` null means "everyone"; a specific team number means that
-- team's alternative variant (mirrors the old target_group 'all'/'A'/'B'/'C').

alter table public.training_sessions add column if not exists target_team smallint check (target_team between 1 and 8);
alter table public.training_sessions drop column if exists target_group;

alter table public.session_tracks add column if not exists target_team smallint check (target_team between 1 and 8);
alter table public.session_tracks drop column if exists target_group;

alter table public.running_segments add column if not exists target_team smallint check (target_team between 1 and 8);
alter table public.running_segments drop column if exists target_group;

-- The old per-group-letter uniqueness on session_tracks doesn't translate
-- directly (target_team is nullable now); re-add it treating null as its
-- own value via a partial unique index plus a normal composite one.
drop index if exists session_tracks_session_id_target_group_key;
create unique index if not exists session_tracks_session_target_team_key
  on public.session_tracks (session_id, target_team)
  where target_team is not null;
create unique index if not exists session_tracks_session_target_all_key
  on public.session_tracks (session_id)
  where target_team is null;

-- ------------------------------------------------------------ cleanup
drop type if exists public.training_group;
drop type if exists public.session_target;

-- ---------------------------------------------------------- auth sync
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, team, unit)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'participant'),
    nullif(new.raw_user_meta_data ->> 'team', '')::smallint,
    new.raw_user_meta_data ->> 'unit'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
