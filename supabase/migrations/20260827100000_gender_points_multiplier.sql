-- Women get x1.5 points on every strength/endurance/warmup/cooldown round
-- and every running segment. A generated column can only read other columns
-- of the same row, but the multiplier depends on public.users.gender — so
-- reps/points (strength_logs) and total_distance_meters/points
-- (running_logs) move from generated columns to trigger-populated ones.
-- DROP EXPRESSION (PG12+) converts a stored generated column to a normal
-- one in place, keeping its current values — then the trigger recomputes
-- everything explicitly, still purely from that row's own input columns
-- plus a lookup of the submitting user's gender.

alter table public.strength_logs alter column reps drop expression if exists;
alter table public.strength_logs alter column points drop expression if exists;

create or replace function public.compute_strength_points()
returns trigger
language plpgsql
as $$
declare
  mult numeric := 1;
begin
  select case when u.gender = 'נ' then 1.5 else 1 end into mult
  from public.users u where u.id = new.user_id;

  new.reps := floor(new.raw_value / new.units_per_rep);
  new.points := round(new.reps * new.level * coalesce(mult, 1))::integer;
  return new;
end;
$$;

drop trigger if exists trg_strength_points on public.strength_logs;
create trigger trg_strength_points
  before insert or update on public.strength_logs
  for each row execute function public.compute_strength_points();

-- Recompute existing rows under the new rule (no-op value assignment still
-- fires the BEFORE UPDATE trigger).
update public.strength_logs set raw_value = raw_value;

alter table public.running_logs alter column total_distance_meters drop expression if exists;
alter table public.running_logs alter column points drop expression if exists;

create or replace function public.compute_running_points()
returns trigger
language plpgsql
as $$
declare
  mult numeric := 1;
  pace_weight integer;
begin
  select case when u.gender = 'נ' then 1.5 else 1 end into mult
  from public.users u where u.id = new.user_id;

  pace_weight := case new.pace_category
    when 'walk'   then 1
    when 'talk'   then 2
    when 'borg'   then 3
    when 'sprint' then 4
  end;

  new.total_distance_meters := new.distance_meters * new.repeats_done;
  new.points := round(round(new.total_distance_meters / 100.0) * pace_weight * coalesce(mult, 1))::integer;
  return new;
end;
$$;

drop trigger if exists trg_running_points on public.running_logs;
create trigger trg_running_points
  before insert or update on public.running_logs
  for each row execute function public.compute_running_points();

update public.running_logs set actual_seconds = actual_seconds;
