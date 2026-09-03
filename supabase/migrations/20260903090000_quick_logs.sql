-- Self-logged activities: a participant records a run or a set of push-ups
-- any time, with no trainer-published session behind it. Unlimited entries,
-- each with its own timestamp — points accumulate into the group standings
-- exactly like a logged training does.
--
-- Scoring mirrors the existing formulas, both at the BASE weight, because
-- these numbers are self-reported and ungraded (no trainer-set pace category,
-- no chosen exercise level):
--   running  — round(metres / 100) x gender multiplier   (the 'walk' weight)
--   pushups  — reps x 1 x gender multiplier              (level 1)
-- Same gender rule as everywhere else: x1.5 for women.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'quick_activity') then
    create type quick_activity as enum ('running', 'pushups');
  end if;
end
$$;

create table if not exists public.quick_logs (
  id              uuid           primary key default gen_random_uuid(),
  user_id         uuid           not null references public.users (id) on delete cascade,
  activity        quick_activity not null,
  -- Exactly one of these is set, per the activity — see quick_logs_shape.
  distance_meters integer,
  reps            integer,
  points          integer        not null default 0,
  created_at      timestamptz    not null default now(),
  constraint quick_logs_shape check (
    (activity = 'running' and distance_meters > 0 and reps is null)
    or (activity = 'pushups' and reps > 0 and distance_meters is null)
  )
);

create index if not exists idx_quick_logs_user on public.quick_logs (user_id, created_at desc);

-- Points are computed server-side only — the client never supplies them.
create or replace function public.compute_quick_log_points()
returns trigger
language plpgsql
as $$
declare
  mult numeric := 1;
begin
  select case when u.gender = 'נ' then 1.5 else 1 end into mult
  from public.users u where u.id = new.user_id;

  new.points := case new.activity
    when 'running' then round(round(new.distance_meters / 100.0) * coalesce(mult, 1))::integer
    when 'pushups' then round(new.reps * 1 * coalesce(mult, 1))::integer
  end;
  return new;
end;
$$;

drop trigger if exists trg_quick_log_points on public.quick_logs;
create trigger trg_quick_log_points
  before insert or update on public.quick_logs
  for each row execute function public.compute_quick_log_points();

alter table public.quick_logs enable row level security;

-- Everyone signed in can read them (they feed the shared leaderboards);
-- you may only write or remove your own.
drop policy if exists quick_logs_select on public.quick_logs;
create policy quick_logs_select on public.quick_logs
  for select using (auth.uid() is not null);

drop policy if exists quick_logs_write_own on public.quick_logs;
create policy quick_logs_write_own on public.quick_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
