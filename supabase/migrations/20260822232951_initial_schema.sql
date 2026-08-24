-- =====================================================================
-- Hashlama training course — PostgreSQL / Supabase schema
-- Covers: enums, tables, indexes, RLS policies, storage bucket, and the
-- calculated views that back the delta / analytics UI.
--
-- Five training types share one interval/points engine (strength,
-- endurance, warm-up, cool-down) except running, which is segment-based.
-- There is no group "goal" anywhere — points only accumulate toward the
-- group's standing in the home-page league table.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
do $$ begin
  create type user_role        as enum ('trainer', 'participant');
  create type training_group   as enum ('A', 'B', 'C');
  create type session_target   as enum ('all', 'A', 'B', 'C');
  create type test_type        as enum ('initial', 'final');
  create type metric_type      as enum ('reps', 'time_seconds', 'distance_meters', 'weight_kg');
  create type training_type    as enum ('running', 'endurance', 'strength', 'warmup', 'cooldown');
  create type catalog_kind     as enum ('strength', 'endurance', 'warmup', 'cooldown');
  -- One enum across every catalogue — each id already belongs to exactly one.
  create type strength_category as enum (
    'lower', 'push', 'back', 'core',                        -- strength
    'jumps', 'machines', 'fullbody', 'agility',              -- endurance
    'dynamic_stretch', 'pulse_raiser',                       -- warm-up
    'stretch_lower', 'stretch_upper', 'stretch_back'         -- cool-down
  );
  create type strength_unit    as enum ('reps', 'seconds', 'meters');
  create type run_mode         as enum ('intervals', 'steady');
  -- The trainer dictates effort qualitatively, not a pace-per-km number.
  create type run_pace_category as enum ('walk', 'talk', 'borg', 'sprint');
exception
  when duplicate_object then null;
end $$;

-- --------------------------------------------------------------- tables

-- Mirrors auth.users; `id` is the Supabase auth uid.
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text        not null,
  email       text        not null unique,
  role        user_role   not null default 'participant',
  group_id    training_group,                                  -- null for trainers
  avatar_url  text,
  joined_at   date        not null default current_date,
  created_at  timestamptz not null default now(),
  -- A participant must belong to a group; a trainer must not.
  constraint users_group_matches_role check (
    (role = 'participant' and group_id is not null) or
    (role = 'trainer'     and group_id is null)
  )
);

create table if not exists public.benchmark_tests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid        not null references public.users (id) on delete cascade,
  test_type       test_type   not null,
  run_3km_seconds integer     not null check (run_3km_seconds between 300 and 3600),
  max_pushups     integer     not null check (max_pushups between 0 and 300),
  recorded_date   date        not null default current_date,
  created_at      timestamptz not null default now(),
  -- One initial and one final result per athlete.
  unique (user_id, test_type)
);

create table if not exists public.training_sessions (
  id                   uuid           primary key default gen_random_uuid(),
  date                 date           not null,
  title                text           not null,
  target_group         session_target not null default 'all',
  workout_instructions text           not null default '',
  week_index           integer        not null check (week_index > 0),
  training_type        training_type  not null default 'running',
  created_by           uuid           references public.users (id) on delete set null,
  created_at           timestamptz    not null default now()
);

-- A session carries one prescribed track per group (standard / endurance /
-- low-impact) for accessory work, so injury-adapted athletes get their own
-- exercises. Used by running trainings; points games have no tracks.
create table if not exists public.session_tracks (
  id           uuid           primary key default gen_random_uuid(),
  session_id   uuid           not null references public.training_sessions (id) on delete cascade,
  target_group session_target not null,
  label        text           not null,
  unique (session_id, target_group)
);

create table if not exists public.track_exercises (
  id            uuid        primary key default gen_random_uuid(),
  track_id      uuid        not null references public.session_tracks (id) on delete cascade,
  name          text        not null,
  metric_type   metric_type not null,
  prescription  text        not null default '',
  target_value  numeric,
  position      integer     not null default 0
);

create table if not exists public.session_logs (
  id            uuid        primary key default gen_random_uuid(),
  session_id    uuid        not null references public.training_sessions (id) on delete cascade,
  user_id       uuid        not null references public.users (id) on delete cascade,
  exercise_name text        not null,
  metric_type   metric_type not null,
  metric_value  numeric     not null check (metric_value > 0),
  rpe           smallint    not null check (rpe between 1 and 10),
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.session_media (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.training_sessions (id) on delete cascade,
  user_id     uuid        not null references public.users (id) on delete cascade,
  image_url   text        not null,
  caption     text,
  tags        text[]      not null default '{}',
  uploaded_at timestamptz not null default now()
);

-- Feed interactions ---------------------------------------------------
create table if not exists public.media_likes (
  media_id   uuid        not null references public.session_media (id) on delete cascade,
  user_id    uuid        not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One like per person per photo.
  primary key (media_id, user_id)
);

create table if not exists public.media_comments (
  id         uuid        primary key default gen_random_uuid(),
  media_id   uuid        not null references public.session_media (id) on delete cascade,
  user_id    uuid        not null references public.users (id) on delete cascade,
  body       text        not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Points games (strength / endurance / warm-up / cool-down)
--   Points = Reps x Level
--   Static holds: every 5 seconds = 1 rep
--   Bear crawl:   every 2 metres  = 1 rep
--   No goal: every point just accumulates toward the group's standing.
-- =====================================================================

-- Static metadata for every category across all four catalogues.
create table if not exists public.exercise_categories (
  id          strength_category primary key,
  catalog     catalog_kind       not null,
  name        text               not null,   -- Hebrew, as the programme is written
  name_en     text               not null,
  description text               not null default ''
);

-- The catalogue itself. `gif_url` is null while the app renders its built-in
-- animation; fill it in to swap in a filmed demo without touching the UI.
create table if not exists public.strength_exercises (
  id            text     primary key,
  name          text     not null,
  name_en       text     not null,
  catalog       catalog_kind not null default 'strength',
  category      strength_category not null,
  level         smallint not null check (level between 1 and 3),
  unit          strength_unit not null default 'reps',
  -- Raw units per scoring rep: 1 rep, 5 seconds, or 2 metres.
  units_per_rep numeric  not null default 1 check (units_per_rep > 0),
  animation_key text     not null,
  gif_url       text
);

-- Interval setup for one points game.
create table if not exists public.strength_configs (
  session_id         uuid    primary key references public.training_sessions (id) on delete cascade,
  -- Which catalogue the participant picks from.
  catalog            catalog_kind not null default 'strength',
  work_seconds       integer not null default 40 check (work_seconds between 5 and 600),
  rest_seconds       integer not null default 20 check (rest_seconds between 0 and 600),
  -- The muscle/heart-rate category assigned to each interval, in order — one
  -- entry per round. Only used for the "open" catalogues (strength,
  -- endurance): the participant still picks their own exercise inside it.
  round_categories   strength_category[] not null default '{}',
  -- The exact exercise assigned to each round, in order — only used for
  -- warm-up/cool-down: no participant choice and no level, the trainer
  -- picks the movement and the athlete just performs it.
  round_exercise_ids text[]  not null default '{}',
  -- Only at these levels — each person picks what they can do safely.
  -- Unused (empty) when round_exercise_ids is set.
  allowed_levels     smallint[] not null default '{1,2,3}'
);

-- One filled interval slot. reps and points are derived, never client-supplied.
create table if not exists public.strength_logs (
  id            uuid     primary key default gen_random_uuid(),
  session_id    uuid     not null references public.training_sessions (id) on delete cascade,
  user_id       uuid     not null references public.users (id) on delete cascade,
  round_index   smallint not null check (round_index >= 0),
  exercise_id   text     not null references public.strength_exercises (id),
  -- Snapshot of the scoring inputs, so historic points never shift if the
  -- catalogue is re-tuned later.
  level         smallint not null check (level between 1 and 3),
  unit          strength_unit not null,
  units_per_rep numeric  not null check (units_per_rep > 0),
  raw_value     numeric  not null check (raw_value > 0),
  reps          integer  generated always as (floor(raw_value / units_per_rep)) stored,
  points        integer  generated always as (floor(raw_value / units_per_rep) * level) stored,
  created_at    timestamptz not null default now(),
  -- One entry per interval slot; re-logging a round replaces it.
  unique (session_id, user_id, round_index)
);

create index if not exists idx_strength_logs_session on public.strength_logs (session_id);
create index if not exists idx_strength_logs_user    on public.strength_logs (user_id, session_id);
create index if not exists idx_strength_ex_category  on public.strength_exercises (category, level);

-- Individual points per game.
create or replace view public.v_strength_points as
select
  l.session_id,
  l.user_id,
  u.name,
  u.group_id,
  sum(l.points)::integer as points,
  sum(l.reps)::integer   as reps,
  count(*)::integer      as rounds_filled
from public.strength_logs l
join public.users u on u.id = l.user_id
group by l.session_id, l.user_id, u.name, u.group_id;

-- =====================================================================
-- Running trainings
--   points = (metres covered / 100) x the prescribed pace category's weight
--   Pure competition — no group goal to unlock.
-- =====================================================================

create table if not exists public.running_configs (
  session_id uuid     primary key references public.training_sessions (id) on delete cascade,
  mode       run_mode not null default 'intervals'
);

-- One prescribed piece of the run. A steady run is a single segment with one
-- repeat; a group-targeted segment replaces the shared plan for that group.
create table if not exists public.running_segments (
  id               uuid           primary key default gen_random_uuid(),
  session_id       uuid           not null references public.training_sessions (id) on delete cascade,
  label            text           not null,
  target_group     session_target not null default 'all',
  position         integer        not null default 0,
  repeats          integer        not null default 1 check (repeats between 1 and 50),
  distance_meters  integer        not null check (distance_meters > 0),
  pace_category    run_pace_category not null,
  recovery_seconds integer        not null default 0 check (recovery_seconds >= 0)
);

-- What the athlete actually ran. The prescribed distance and pace category
-- are snapshotted so re-tuning a segment later never rewrites history; the
-- athlete enters either time or pace client-side and only the canonical
-- `actual_seconds` is stored.
create table if not exists public.running_logs (
  id                    uuid     primary key default gen_random_uuid(),
  session_id            uuid     not null references public.training_sessions (id) on delete cascade,
  user_id               uuid     not null references public.users (id) on delete cascade,
  segment_id            uuid     not null references public.running_segments (id) on delete cascade,
  segment_index         integer  not null default 0,
  distance_meters       integer  not null check (distance_meters > 0),
  pace_category         run_pace_category not null,
  repeats_done          integer  not null check (repeats_done >= 1),
  actual_seconds        numeric  not null check (actual_seconds > 0),
  total_distance_meters integer  generated always as (distance_meters * repeats_done) stored,
  points                integer  generated always as (
    round((distance_meters * repeats_done) / 100.0) * (
      case pace_category
        when 'walk'   then 1
        when 'talk'   then 2
        when 'borg'   then 3
        when 'sprint' then 4
      end
    )
  ) stored,
  created_at            timestamptz not null default now(),
  -- One entry per segment; re-logging updates it.
  unique (session_id, user_id, segment_id)
);

create index if not exists idx_run_segments_session on public.running_segments (session_id, position);
create index if not exists idx_run_logs_session     on public.running_logs (session_id);
create index if not exists idx_run_logs_user        on public.running_logs (user_id, session_id);

-- Running points per athlete, mirroring the points-game view.
create or replace view public.v_running_points as
select
  l.session_id,
  l.user_id,
  u.name,
  u.group_id,
  sum(l.points)::integer                as points,
  sum(l.total_distance_meters)::integer as metres
from public.running_logs l
join public.users u on u.id = l.user_id
group by l.session_id, l.user_id, u.name, u.group_id;

-- The home page league table: points from every training type, per group.
create or replace view public.v_group_points as
with combined as (
  select p.session_id, p.group_id, p.points from public.v_strength_points p
  union all
  select r.session_id, r.group_id, r.points from public.v_running_points r
)
select
  c.group_id,
  sum(c.points)::integer as points,
  count(distinct c.session_id)::integer as trainings_scored
from combined c
group by c.group_id;

-- -------------------------------------------------------------- indexes
create index if not exists idx_users_group          on public.users (group_id);
create index if not exists idx_benchmarks_user      on public.benchmark_tests (user_id);
create index if not exists idx_sessions_date        on public.training_sessions (date desc);
create index if not exists idx_tracks_session       on public.session_tracks (session_id);
create index if not exists idx_exercises_track      on public.track_exercises (track_id, position);
create index if not exists idx_logs_user_session    on public.session_logs (user_id, session_id);
create index if not exists idx_logs_session         on public.session_logs (session_id);
create index if not exists idx_logs_exercise        on public.session_logs (exercise_name);
create index if not exists idx_media_session        on public.session_media (session_id, uploaded_at desc);
create index if not exists idx_media_user           on public.session_media (user_id);
create index if not exists idx_likes_media          on public.media_likes (media_id);
create index if not exists idx_comments_media       on public.media_comments (media_id, created_at);

-- =====================================================================
-- Other calculated views
-- =====================================================================

-- Baseline vs. exit benchmark per athlete, with pace and % improvement.
-- Run improvement is positive when the athlete got faster.
create or replace view public.v_benchmark_deltas as
select
  u.id   as user_id,
  u.name,
  u.group_id,
  i.run_3km_seconds                                    as initial_run_seconds,
  f.run_3km_seconds                                    as final_run_seconds,
  f.run_3km_seconds - i.run_3km_seconds                as run_delta_seconds,
  round(((i.run_3km_seconds - f.run_3km_seconds)::numeric
         / nullif(i.run_3km_seconds, 0)) * 100, 2)     as run_improvement_pct,
  round(i.run_3km_seconds / 3.0, 1)                    as initial_pace_seconds_per_km,
  round(f.run_3km_seconds / 3.0, 1)                    as final_pace_seconds_per_km,
  i.max_pushups                                        as initial_pushups,
  f.max_pushups                                        as final_pushups,
  f.max_pushups - i.max_pushups                        as pushup_delta,
  round(((f.max_pushups - i.max_pushups)::numeric
         / nullif(i.max_pushups, 0)) * 100, 2)         as pushup_improvement_pct,
  round(
    ((i.run_3km_seconds - f.run_3km_seconds)::numeric / nullif(i.run_3km_seconds, 0)) * 100 * 1.6
    + ((f.max_pushups - i.max_pushups)::numeric / nullif(i.max_pushups, 0)) * 100 * 0.4
  , 2)                                                 as composite_score
from public.users u
left join public.benchmark_tests i on i.user_id = u.id and i.test_type = 'initial'
left join public.benchmark_tests f on f.user_id = u.id and f.test_type = 'final'
where u.role = 'participant';

-- Attendance and effort per athlete: a session counts as attended when at
-- least one log of any kind (aerobic, strength, or running) exists for it.
create or replace view public.v_participant_attendance as
with eligible as (
  select u.id as user_id, s.id as session_id
  from public.users u
  join public.training_sessions s
    on s.target_group = 'all' or s.target_group::text = u.group_id::text
  where u.role = 'participant'
),
attended as (
  select user_id, session_id from public.session_logs
  union
  select user_id, session_id from public.strength_logs
  union
  select user_id, session_id from public.running_logs
)
select
  e.user_id,
  count(*)                                                   as total_sessions,
  count(a.session_id)                                        as attended_sessions,
  round(count(a.session_id)::numeric / nullif(count(*), 0), 3) as attendance_rate,
  (select round(avg(rpe), 2) from public.session_logs l where l.user_id = e.user_id) as avg_rpe
from eligible e
left join attended a on a.user_id = e.user_id and a.session_id = e.session_id
group by e.user_id;

-- Group roll-up powering the trainer's cohort cards and comparison charts.
create or replace view public.v_group_analytics as
select
  d.group_id,
  count(*)                                as participant_count,
  round(avg(d.run_improvement_pct), 2)    as avg_run_improvement_pct,
  round(avg(d.pushup_delta), 2)           as avg_pushup_gain,
  round(avg(d.pushup_improvement_pct), 2) as avg_pushup_improvement_pct,
  round(avg(d.initial_run_seconds), 0)    as avg_initial_run_seconds,
  round(avg(d.final_run_seconds), 0)      as avg_final_run_seconds,
  round(avg(d.initial_pushups), 1)        as avg_initial_pushups,
  round(avg(d.final_pushups), 1)          as avg_final_pushups,
  round(avg(a.attendance_rate), 3)        as attendance_rate,
  round(avg(a.avg_rpe), 2)                as avg_rpe
from public.v_benchmark_deltas d
left join public.v_participant_attendance a on a.user_id = d.user_id
group by d.group_id;

-- Flat, export-friendly log view (matches the CSV columns in the UI).
create or replace view public.v_session_log_export as
select
  l.id            as log_id,
  l.session_id,
  s.date          as session_date,
  s.title         as session_title,
  u.name          as participant,
  u.email,
  u.group_id,
  l.exercise_name,
  l.metric_type,
  l.metric_value,
  l.rpe,
  l.notes,
  l.created_at
from public.session_logs l
join public.users u on u.id = l.user_id
join public.training_sessions s on s.id = l.session_id;

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.users               enable row level security;
alter table public.benchmark_tests     enable row level security;
alter table public.training_sessions   enable row level security;
alter table public.session_tracks      enable row level security;
alter table public.track_exercises     enable row level security;
alter table public.session_logs        enable row level security;
alter table public.session_media       enable row level security;
alter table public.media_likes         enable row level security;
alter table public.media_comments      enable row level security;
alter table public.exercise_categories enable row level security;
alter table public.strength_exercises  enable row level security;
alter table public.strength_configs    enable row level security;
alter table public.strength_logs       enable row level security;
alter table public.running_configs     enable row level security;
alter table public.running_segments    enable row level security;
alter table public.running_logs        enable row level security;

-- Helper: is the caller a trainer? SECURITY DEFINER avoids recursive RLS
-- evaluation when policies on public.users consult public.users.
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'trainer'
  );
$$;

-- users ---------------------------------------------------------------
drop policy if exists users_select_self_or_trainer on public.users;
create policy users_select_self_or_trainer on public.users
  for select using (id = auth.uid() or public.is_trainer());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists users_manage_trainer on public.users;
create policy users_manage_trainer on public.users
  for all using (public.is_trainer()) with check (public.is_trainer());

-- benchmark_tests: athletes read their own; only trainers record them ---
drop policy if exists benchmarks_select on public.benchmark_tests;
create policy benchmarks_select on public.benchmark_tests
  for select using (user_id = auth.uid() or public.is_trainer());

drop policy if exists benchmarks_write_trainer on public.benchmark_tests;
create policy benchmarks_write_trainer on public.benchmark_tests
  for all using (public.is_trainer()) with check (public.is_trainer());

-- sessions, tracks, exercises: readable by all signed-in users ---------
drop policy if exists sessions_select on public.training_sessions;
create policy sessions_select on public.training_sessions
  for select using (auth.uid() is not null);

drop policy if exists sessions_write_trainer on public.training_sessions;
create policy sessions_write_trainer on public.training_sessions
  for all using (public.is_trainer()) with check (public.is_trainer());

drop policy if exists tracks_select on public.session_tracks;
create policy tracks_select on public.session_tracks
  for select using (auth.uid() is not null);

drop policy if exists tracks_write_trainer on public.session_tracks;
create policy tracks_write_trainer on public.session_tracks
  for all using (public.is_trainer()) with check (public.is_trainer());

drop policy if exists exercises_select on public.track_exercises;
create policy exercises_select on public.track_exercises
  for select using (auth.uid() is not null);

drop policy if exists exercises_write_trainer on public.track_exercises;
create policy exercises_write_trainer on public.track_exercises
  for all using (public.is_trainer()) with check (public.is_trainer());

-- session_logs: athletes own their rows; trainers see everything -------
drop policy if exists logs_select on public.session_logs;
create policy logs_select on public.session_logs
  for select using (user_id = auth.uid() or public.is_trainer());

drop policy if exists logs_insert_self on public.session_logs;
create policy logs_insert_self on public.session_logs
  for insert with check (user_id = auth.uid());

drop policy if exists logs_update_self on public.session_logs;
create policy logs_update_self on public.session_logs
  for update using (user_id = auth.uid() or public.is_trainer())
  with check (user_id = auth.uid() or public.is_trainer());

drop policy if exists logs_delete_self on public.session_logs;
create policy logs_delete_self on public.session_logs
  for delete using (user_id = auth.uid() or public.is_trainer());

-- session_media: the feed is visible cohort-wide, writes are own-only --
drop policy if exists media_select on public.session_media;
create policy media_select on public.session_media
  for select using (auth.uid() is not null);

drop policy if exists media_insert_self on public.session_media;
create policy media_insert_self on public.session_media
  for insert with check (user_id = auth.uid());

drop policy if exists media_delete_self on public.session_media;
create policy media_delete_self on public.session_media
  for delete using (user_id = auth.uid() or public.is_trainer());

-- feed: everyone in the cohort reads; you own your likes and comments ---
drop policy if exists likes_select on public.media_likes;
create policy likes_select on public.media_likes
  for select using (auth.uid() is not null);

drop policy if exists likes_write_own on public.media_likes;
create policy likes_write_own on public.media_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists comments_select on public.media_comments;
create policy comments_select on public.media_comments
  for select using (auth.uid() is not null);

drop policy if exists comments_insert_own on public.media_comments;
create policy comments_insert_own on public.media_comments
  for insert with check (user_id = auth.uid());

drop policy if exists comments_update_own on public.media_comments;
create policy comments_update_own on public.media_comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The author of a comment or the trainer can remove it.
drop policy if exists comments_delete_own on public.media_comments;
create policy comments_delete_own on public.media_comments
  for delete using (user_id = auth.uid() or public.is_trainer());

-- exercise catalogue: everyone reads, nobody writes through the app -----
drop policy if exists exercise_categories_select on public.exercise_categories;
create policy exercise_categories_select on public.exercise_categories
  for select using (auth.uid() is not null);

drop policy if exists strength_exercises_select on public.strength_exercises;
create policy strength_exercises_select on public.strength_exercises
  for select using (auth.uid() is not null);

-- points games: readable cohort-wide, trainer configures, athletes log own
drop policy if exists strength_configs_select on public.strength_configs;
create policy strength_configs_select on public.strength_configs
  for select using (auth.uid() is not null);

drop policy if exists strength_configs_write_trainer on public.strength_configs;
create policy strength_configs_write_trainer on public.strength_configs
  for all using (public.is_trainer()) with check (public.is_trainer());

drop policy if exists strength_logs_select on public.strength_logs;
create policy strength_logs_select on public.strength_logs
  for select using (auth.uid() is not null);

drop policy if exists strength_logs_write_own on public.strength_logs;
create policy strength_logs_write_own on public.strength_logs
  for all using (user_id = auth.uid() or public.is_trainer())
  with check (user_id = auth.uid());

-- running: readable cohort-wide, trainer configures, athletes log own ---
drop policy if exists running_configs_select on public.running_configs;
create policy running_configs_select on public.running_configs
  for select using (auth.uid() is not null);

drop policy if exists running_configs_write_trainer on public.running_configs;
create policy running_configs_write_trainer on public.running_configs
  for all using (public.is_trainer()) with check (public.is_trainer());

drop policy if exists running_segments_select on public.running_segments;
create policy running_segments_select on public.running_segments
  for select using (auth.uid() is not null);

drop policy if exists running_segments_write_trainer on public.running_segments;
create policy running_segments_write_trainer on public.running_segments
  for all using (public.is_trainer()) with check (public.is_trainer());

drop policy if exists running_logs_select on public.running_logs;
create policy running_logs_select on public.running_logs
  for select using (auth.uid() is not null);

drop policy if exists running_logs_write_own on public.running_logs;
create policy running_logs_write_own on public.running_logs
  for all using (user_id = auth.uid() or public.is_trainer())
  with check (user_id = auth.uid());

-- =====================================================================
-- Storage: workout photos
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-media', 'session-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Objects are stored as `<user_id>/<session_id>/<filename>`, so the first
-- path segment is the owner and can be checked directly.
drop policy if exists media_objects_read on storage.objects;
create policy media_objects_read on storage.objects
  for select using (bucket_id = 'session-media');

drop policy if exists media_objects_insert_own on storage.objects;
create policy media_objects_insert_own on storage.objects
  for insert with check (
    bucket_id = 'session-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists media_objects_delete_own on storage.objects;
create policy media_objects_delete_own on storage.objects
  for delete using (
    bucket_id = 'session-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_trainer())
  );

-- =====================================================================
-- Auth: keep public.users in sync with auth.users
--
-- The sign-up form collects name/role/group and passes them as auth user
-- metadata; this trigger copies them into public.users on account creation.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, group_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'participant'),
    (new.raw_user_meta_data ->> 'group_id')::training_group
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
